"""LLMO Score — dedicated worker container.

APScheduler の DBポーリング型 tick（1分間隔）で automation_schedules を監視し、
next_execution <= now() の active 行に対して execute() を呼び出す。

起動コマンド:
    python worker/main.py

環境変数:
    DATABASE_URL (同 API コンテナと同じ接続文字列)
"""
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text

# backend/app を import パスに追加
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.shared.db.postgres import get_engine, get_session_factory  # noqa: E402
from app.modules.automation.services import execute, _calc_next_execution  # noqa: E402

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger('worker')


async def _purge_raw_evidence() -> None:
    """retain_until < today の diagnoses の raw_evidence を NULL に設定（毎日 02:00 JST）。"""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            text(
                """
                UPDATE diagnoses
                SET raw_evidence = NULL
                WHERE retain_until < CURRENT_DATE
                  AND raw_evidence IS NOT NULL
                """
            )
        )
        await session.commit()
        purged = result.rowcount
    if purged:
        logger.info(f'purge: {purged} diagnosis raw_evidence record(s) cleared')


async def _tick() -> None:
    """1分毎に next_execution <= now() の active スケジュールをディスパッチ。

    SELECT と next_execution 前進 UPDATE を同一トランザクションで実行することで、
    FOR UPDATE SKIP LOCKED のロックが commit まで保持され多重発火を防止する。
    """
    factory = get_session_factory()
    schedule_ids: list[str] = []

    async with factory() as session:
        result = await session.execute(
            text(
                """
                SELECT id, schedule_type, execution_day, execution_time
                FROM automation_schedules
                WHERE status = 'active'
                  AND next_execution::timestamptz <= now()
                FOR UPDATE SKIP LOCKED
                """
            )
        )
        rows = result.fetchall()

        if rows:
            now_iso = datetime.now(timezone.utc).isoformat()
            for row in rows:
                sid, stype, eday, etime = row
                new_next = _calc_next_execution(stype, eday or 1, etime or '09:00')
                await session.execute(
                    text(
                        """
                        UPDATE automation_schedules
                        SET next_execution = :next_exec,
                            last_execution = :last_exec
                        WHERE id = :sid
                        """
                    ),
                    {'next_exec': new_next, 'last_exec': now_iso, 'sid': sid},
                )
                schedule_ids.append(sid)
            await session.commit()

    if schedule_ids:
        logger.info(f'tick: {len(schedule_ids)} schedule(s) due → dispatching')
        await asyncio.gather(*[execute(sid) for sid in schedule_ids])
    else:
        logger.debug('tick: no schedules due')


async def main() -> None:
    get_engine()  # エンジン・接続プールを eager に初期化（create_all は実行しない）
    logger.info('Worker started — polling every 60 seconds (Asia/Tokyo)')

    scheduler = AsyncIOScheduler(timezone='Asia/Tokyo')
    scheduler.add_job(_tick, 'interval', seconds=60, id='automation_tick', max_instances=1)
    scheduler.add_job(_purge_raw_evidence, 'cron', hour=2, minute=0, id='purge_raw_evidence', max_instances=1)
    scheduler.start()

    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, SystemExit):
        logger.info('Worker shutting down')
        scheduler.shutdown(wait=False)


if __name__ == '__main__':
    asyncio.run(main())
