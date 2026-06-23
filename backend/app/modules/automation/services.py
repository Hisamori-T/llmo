"""Automation module services — スケジュール管理と execute() ロジック。

worker/main.py の tick がこの execute() を呼び出す。
API router からは CRUD 操作のみ呼び出す（execute は worker 専用）。
"""
import asyncio
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app.shared.constants.plans import CREDIT_COSTS
from app.shared.db.firestore import db_get, db_query, db_set, db_update
from app.shared.db.postgres import get_session_factory

JST = ZoneInfo('Asia/Tokyo')
_SEMAPHORE = asyncio.Semaphore(3)
logger = logging.getLogger('automation')


# ── スケジュール CRUD ──────────────────────────────────────────────────────

def _calc_next_execution(schedule_type: str, execution_day: int, execution_time: str) -> str:
    """作成日以降の最初の該当日（当日一致は翌周期へ）を JST で返す。"""
    now_jst = datetime.now(JST)
    today = now_jst.date()
    h, m = (int(x) for x in execution_time.split(':'))

    if schedule_type == 'monthly':
        candidate = today.replace(day=execution_day)
        if candidate <= today:
            if today.month == 12:
                candidate = date(today.year + 1, 1, execution_day)
            else:
                candidate = date(today.year, today.month + 1, execution_day)
    else:  # weekly (0=Mon..6=Sun)
        days_ahead = (execution_day - today.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7  # 当日は翌週
        candidate = today + timedelta(days=days_ahead)

    dt = datetime(candidate.year, candidate.month, candidate.day, h, m, tzinfo=JST)
    return dt.isoformat()


async def create_schedule(
    agency_id: str,
    client_id: str,
    member_id: str,
    schedule_type: str,
    execution_day: int,
    execution_time: str,
    channels: list,
    recipients: Optional[dict],
    tasks: list,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    schedule_id = str(uuid.uuid4())
    next_exec = _calc_next_execution(schedule_type, execution_day, execution_time)

    await db_set('automation_schedules', schedule_id, {
        'id': schedule_id,
        'agency_id': agency_id,
        'client_id': client_id,
        'member_id': member_id,
        'schedule_type': schedule_type,
        'execution_day': execution_day,
        'execution_time': execution_time,
        'channels': channels,
        'recipients': recipients,
        'tasks': tasks,
        'last_execution': None,
        'next_execution': next_exec,
        'status': 'active',
        'created_at': now,
    })
    return await db_get('automation_schedules', schedule_id)


async def update_schedule(schedule_id: str, agency_id: str, updates: dict) -> dict:
    schedule = await db_get('automation_schedules', schedule_id)
    if not schedule or schedule.get('agency_id') != agency_id:
        raise ValueError('Schedule not found')

    update_data = {k: v for k, v in updates.items() if v is not None}

    if 'execution_day' in update_data or 'execution_time' in update_data:
        stype = schedule.get('schedule_type', 'monthly')
        eday = update_data.get('execution_day', schedule.get('execution_day', 1))
        etime = update_data.get('execution_time', schedule.get('execution_time', '09:00'))
        update_data['next_execution'] = _calc_next_execution(stype, eday, etime)

    await db_update('automation_schedules', schedule_id, update_data)
    return await db_get('automation_schedules', schedule_id)


async def list_schedules(agency_id: str, client_id: Optional[str] = None) -> list:
    docs = await db_query(
        'automation_schedules',
        filters=[('agency_id', '==', agency_id)],
        limit=200,
    )
    if client_id:
        docs = [d for d in docs if d.get('client_id') == client_id]
    docs.sort(key=lambda d: d.get('created_at', ''), reverse=True)
    return docs


async def list_logs(agency_id: str, schedule_id: Optional[str] = None, limit: int = 50) -> list:
    filters = [('agency_id', '==', agency_id)]
    if schedule_id:
        filters.append(('schedule_id', '==', schedule_id))
    docs = await db_query('automation_logs', filters=filters, order_by='executed_at', desc=True, limit=limit)
    return docs


# ── api_credits 操作 ───────────────────────────────────────────────────────

async def _reset_credits_if_needed(agency_id: str) -> dict:
    """当月リセットが未実施ならリセットして返す。tick 内遅延評価。"""
    credit = await db_query('api_credits', filters=[('agency_id', '==', agency_id)], limit=1)
    credit = credit[0] if credit else None

    if not credit:
        return {'monthly_limit': 0, 'monthly_used': 0}

    this_month = date.today().strftime('%Y-%m')
    if (credit.get('last_reset') or '')[:7] != this_month:
        await db_update('api_credits', credit['id'], {
            'monthly_used': 0,
            'last_reset': date.today().isoformat(),
        })
        credit['monthly_used'] = 0
    return credit


async def _consume_agency_credits(
    agency_id: str,
    amount: int,
    usage_type: str,
    resource_id: str,
    initiated_by: str,
) -> Optional[int]:
    """agency 全体枠から amount を原子的に消費し credit_usage に記録する。

    Returns balance_after on success, None if insufficient credits at consume time.
    診断は既に完了しているため None でも診断結果は保存済み。
    """
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            text("""
                UPDATE api_credits
                SET monthly_used = monthly_used + :amount
                WHERE agency_id = :agency_id
                  AND monthly_used + :amount <= monthly_limit
                RETURNING monthly_limit - monthly_used AS balance_after
            """),
            {'amount': amount, 'agency_id': agency_id},
        )
        row = result.fetchone()
        if row is None:
            return None
        balance_after = row[0]
        await session.commit()

    usage_id = str(uuid.uuid4())
    await db_set('credit_usage', usage_id, {
        'id': usage_id,
        'agency_id': agency_id,
        'member_id': initiated_by,
        'initiated_by': initiated_by,
        'amount': amount,
        'usage_type': usage_type,
        'resource_id': resource_id,
        'client_id': None,
        'balance_after': balance_after,
        'created_at': datetime.now(timezone.utc).isoformat(),
    })
    return balance_after


# ── 通知先解決 ────────────────────────────────────────────────────────────

async def _resolve_recipients(agency_id: str, recipients: Optional[dict]) -> tuple[list[str], list[str]]:
    """(user_ids, extra_emails) を解決する。recipients 未指定 → admin 全員。"""
    extra_emails: list[str] = []
    if recipients:
        user_ids = recipients.get('user_ids') or []
        extra_emails = recipients.get('extra_emails') or []
        if user_ids:
            return user_ids, extra_emails

    # fallback: agency の admin 全員
    members = await db_query(
        'agency_members',
        filters=[('agency_id', '==', agency_id)],
        limit=100,
    )
    admin_ids = [m['user_id'] for m in members if m.get('role') in ('admin', 'owner')]
    return admin_ids, extra_emails


async def _resolve_admin_user_ids(agency_id: str) -> list[str]:
    """insufficient_credits など admin 限定通知用。"""
    members = await db_query(
        'agency_members',
        filters=[('agency_id', '==', agency_id)],
        limit=100,
    )
    return [m['user_id'] for m in members if m.get('role') in ('admin', 'owner')]


# ── ハルシネーション検知 ──────────────────────────────────────────────────

def _detect_hallucinations(current: dict, previous: Optional[dict]) -> list[dict]:
    """A（conflict）+ B（regression）を常時検知。C（factual_mismatch）は将来拡張。"""
    findings = []

    # A: conflict — Gemini と GPT-4o の mention が割れているキーワード
    ai_analysis = current.get('ai_analysis') or {}
    gemini_kws = {k: v for k, v in (ai_analysis.get('gemini') or {}).items()}
    gpt4o_kws = {k: v for k, v in (ai_analysis.get('gpt4o') or {}).items()}
    for kw in set(gemini_kws) & set(gpt4o_kws):
        g_mention = gemini_kws[kw].get('mention', 'not_mentioned')
        o_mention = gpt4o_kws[kw].get('mention', 'not_mentioned')
        if g_mention != o_mention:
            findings.append({
                'type': 'conflict',
                'keyword': kw,
                'gemini': g_mention,
                'gpt4o': o_mention,
                'severity': 'warning',
            })

    # B: regression — 前回 mentioned/partial → 今回 not_mentioned（ai_analysis 構造を使用）
    if previous:
        prev_ai = previous.get('ai_analysis') or {}
        curr_ai = current.get('ai_analysis') or {}
        all_kws: set[str] = set()
        for model_data in prev_ai.values():
            if isinstance(model_data, dict):
                all_kws |= set(model_data.keys())
        for kw in all_kws:
            prev_mentioned = any(
                isinstance(model_data, dict)
                and model_data.get(kw, {}).get('mention', 'not_mentioned') in ('mentioned', 'partial')
                for model_data in prev_ai.values()
            )
            curr_mentioned = any(
                isinstance(model_data, dict)
                and model_data.get(kw, {}).get('mention', 'not_mentioned') in ('mentioned', 'partial')
                for model_data in curr_ai.values()
            )
            if prev_mentioned and not curr_mentioned:
                findings.append({
                    'type': 'regression',
                    'keyword': kw,
                    'prev': 'mentioned',
                    'now': 'not_mentioned',
                    'severity': 'critical',
                })

    return findings


# ── 差分算出 ─────────────────────────────────────────────────────────────

def _calc_diff(current: dict, previous: Optional[dict]) -> dict:
    if not previous:
        return {}
    curr_scores = current.get('scores') or {}
    prev_scores = previous.get('scores') or {}
    return {
        'overall_delta': round(
            float(curr_scores.get('overall', 0) or 0)
            - float(prev_scores.get('overall', 0) or 0),
            1,
        ),
        'ai_awareness_delta': round(
            float(curr_scores.get('ai_awareness', 0) or 0)
            - float(prev_scores.get('ai_awareness', 0) or 0),
            1,
        ),
    }


# ── メイン execute ────────────────────────────────────────────────────────

async def execute(schedule_id: str) -> None:
    """tick から呼ばれる実行エントリポイント。Semaphore で同時実行数を制御。"""
    async with _SEMAPHORE:
        await _execute_inner(schedule_id)


async def _execute_inner(schedule_id: str) -> None:
    schedule = await db_get('automation_schedules', schedule_id)
    if not schedule:
        return

    agency_id = schedule['agency_id']
    client_id = schedule['client_id']
    member_id = schedule.get('member_id', '')
    schedule_type = schedule.get('schedule_type', 'monthly')
    is_monthly = schedule_type == 'monthly'
    now_iso = datetime.now(timezone.utc).isoformat()
    log_id = str(uuid.uuid4())
    diagnosis_cost = CREDIT_COSTS['automation_monthly' if is_monthly else 'automation_weekly']

    # 0. クレジット事前チェック（楽観的スキップ用。整合性担保は step5 の原子的 UPDATE）
    credit = await _reset_credits_if_needed(agency_id)
    monthly_limit = credit.get('monthly_limit', 0)
    monthly_used = credit.get('monthly_used', 0)

    if monthly_limit > 0 and monthly_used + diagnosis_cost > monthly_limit:
        await db_set('automation_logs', log_id, {
            'id': log_id,
            'schedule_id': schedule_id,
            'agency_id': agency_id,
            'client_id': client_id,
            'executed_at': now_iso,
            'diff': None,
            'alert_level': 'warning',
            'hallucination_findings': None,
            'tasks_completed': [],
            'tasks_failed': ['diagnose'],
            'credits_consumed': 0,
            'error_details': 'insufficient_credits',
        })
        admin_ids, _ = await _resolve_recipients(agency_id, None)
        await _notify(
            agency_id=agency_id,
            channels=schedule.get('channels', ['email']),
            user_ids=admin_ids,
            extra_emails=[],
            alert_level='warning',
            message='クレジット残量が不足しています。プランのアップグレードをご検討ください。',
        )
        return

    # 1. 再診断（同プロセス worker 内で diagnosis services を import して呼ぶ）
    diagnosis_id = None
    new_diagnosis = None
    tasks_completed = []
    tasks_failed = []

    try:
        from app.modules.diagnosis.services import DiagnosisService
        client_doc = await db_get('clients', client_id) or {}
        keyword_sets = await db_query('keywords', filters=[('client_id', '==', client_id)], limit=1)
        keywords = keyword_sets[0].get('keywords', []) if keyword_sets else []
        url = client_doc.get('url', '')

        source_label = 'automation_monthly' if is_monthly else 'automation_weekly'
        svc = DiagnosisService()
        new_diagnosis = await svc.run(
            client_id=client_id,
            agency_id=agency_id,
            member_id=member_id,
            url=url,
            keywords=keywords,
            diagnosis_type='detailed',
            source=source_label,
        )
        diagnosis_id = new_diagnosis.get('id')
        tasks_completed.append('diagnose')
    except Exception as e:
        tasks_failed.append('diagnose')
        await db_set('automation_logs', log_id, {
            'id': log_id,
            'schedule_id': schedule_id,
            'agency_id': agency_id,
            'client_id': client_id,
            'executed_at': now_iso,
            'diff': None,
            'alert_level': 'none',
            'hallucination_findings': None,
            'tasks_completed': tasks_completed,
            'tasks_failed': tasks_failed,
            'credits_consumed': 0,
            'error_details': str(e),
        })
        return

    # 2. 前回診断取得 + 差分算出
    prev_diagnoses = await db_query(
        'diagnoses',
        filters=[('client_id', '==', client_id), ('status', '==', 'completed')],
        order_by='created_at',
        desc=True,
        limit=5,
    )
    previous = next(
        (d for d in prev_diagnoses if d.get('id') != diagnosis_id),
        None,
    )
    diff = _calc_diff(new_diagnosis, previous)

    # 3. ハルシネーション検知
    hallucination_findings = _detect_hallucinations(new_diagnosis, previous)

    # 4. alert_level 判定
    has_critical = any(f.get('severity') == 'critical' for f in hallucination_findings)
    has_warning = any(f.get('severity') == 'warning' for f in hallucination_findings)
    score_drop = diff.get('overall_delta', 0) < -10
    alert_level = 'none'
    if has_critical or score_drop:
        alert_level = 'critical'
    elif has_warning:
        alert_level = 'warning'

    if alert_level in ('critical', 'warning'):
        user_ids, extra_emails = await _resolve_recipients(agency_id, schedule.get('recipients'))
        message = _build_alert_message(alert_level, diff, hallucination_findings, client_id)
        await _notify(agency_id, schedule.get('channels', ['email']), user_ids, extra_emails, alert_level, message)

    # 5. クレジット消費（原子的 UPDATE — 並列実行による二重消費を防止）
    balance_after = await _consume_agency_credits(
        agency_id=agency_id,
        amount=diagnosis_cost,
        usage_type=f'automation_{"monthly" if is_monthly else "weekly"}',
        resource_id=diagnosis_id or '',
        initiated_by=member_id,
    )
    if balance_after is not None:
        tasks_completed.append('consume_credits')
        credits_consumed = diagnosis_cost
        final_alert = alert_level
        final_error = None
    else:
        # step0 をすり抜けた並列実行で上限超過 — 診断は保存済み、台帳計上のみ失敗
        tasks_failed.append('consume_credits')
        credits_consumed = 0
        final_alert = 'warning'
        final_error = 'insufficient_at_consume'

    # 6. 月次のみ: 月次レポート生成
    if is_monthly:
        try:
            from app.modules.reporting.services import ReportService
            month = datetime.now(JST).strftime('%Y-%m')
            report_svc = ReportService()
            report = await report_svc.generate_monthly_report(client_id, agency_id, month)
            user_ids, extra_emails = await _resolve_recipients(agency_id, schedule.get('recipients'))
            await _notify(
                agency_id=agency_id,
                channels=schedule.get('channels', ['email']),
                user_ids=user_ids,
                extra_emails=extra_emails,
                alert_level='none',
                message=f'月次レポートが生成されました（{month}）。',
                report_id=report.get('id'),
            )
            tasks_completed.append('monthly_report')
        except Exception as e:
            logger.exception(e)
            tasks_failed.append('monthly_report')

    # 7. ログ保存（next_execution は tick 側で前進済みのため更新不要）
    await db_set('automation_logs', log_id, {
        'id': log_id,
        'schedule_id': schedule_id,
        'agency_id': agency_id,
        'client_id': client_id,
        'executed_at': now_iso,
        'diff': diff,
        'alert_level': final_alert,
        'hallucination_findings': hallucination_findings,
        'tasks_completed': tasks_completed,
        'tasks_failed': tasks_failed,
        'credits_consumed': credits_consumed,
        'error_details': final_error,
    })


def _build_alert_message(
    alert_level: str,
    diff: dict,
    hallucination_findings: list,
    client_id: str,
) -> str:
    lines = [f'【{alert_level.upper()}】LLMO Score アラート (client: {client_id})']
    delta = diff.get('overall_delta', 0)
    if delta:
        lines.append(f'総合スコア変動: {delta:+.1f}点')
    regressions = [f for f in hallucination_findings if f['type'] == 'regression']
    if regressions:
        lines.append(f'認識消失キーワード: {", ".join(f["keyword"] for f in regressions)}')
    conflicts = [f for f in hallucination_findings if f['type'] == 'conflict']
    if conflicts:
        lines.append(f'AI間認識不一致: {", ".join(f["keyword"] for f in conflicts)}')
    return '\n'.join(lines)


async def _notify(
    agency_id: str,
    channels: list,
    user_ids: list,
    extra_emails: list,
    alert_level: str,
    message: str,
    report_id: Optional[str] = None,
) -> None:
    """Notification Module のアクセサ経由で通知を送信する（チャネル実体は持たない）。"""
    try:
        from app.core.notification.services import NotificationService
        svc = NotificationService()
        await svc.send_automation_alert(
            agency_id=agency_id,
            channels=channels,
            user_ids=user_ids,
            extra_emails=extra_emails,
            alert_level=alert_level,
            message=message,
            report_id=report_id,
        )
    except Exception as e:
        logger.exception(e)
