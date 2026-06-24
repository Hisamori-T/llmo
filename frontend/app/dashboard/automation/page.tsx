'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Schedule {
  id: string;
  client_id: string;
  schedule_type: string;
  execution_day: number;
  execution_time: string;
  status: string;
  last_execution: string | null;
  next_execution: string | null;
  channels: string[];
  tasks: string[];
  created_at: string;
}

interface Log {
  id: string;
  schedule_id: string;
  client_id: string;
  executed_at: string;
  alert_level: string;
  tasks_completed: string[] | null;
  tasks_failed: string[] | null;
  credits_consumed: number;
  error_details: string | null;
}

type Tab = 'schedules' | 'logs';

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

const ALERT_CLASS: Record<string, string> = {
  none: 'bg-emerald-100 text-emerald-700',
  ok: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

const STATUS_CLASS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-slate-100 text-slate-700',
};

export default function AutomationPage() {
  const [tab, setTab] = useState<Tab>('schedules');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/automation/schedules')
      .then((res) => setSchedules(res.data || []))
      .catch(() => {})
      .finally(() => setLoadingSchedules(false));
  }, []);

  useEffect(() => {
    if (tab !== 'logs') return;
    setLoadingLogs(true);
    apiClient.get('/automation/logs?limit=100')
      .then((res) => setLogs(res.data || []))
      .catch(() => {})
      .finally(() => setLoadingLogs(false));
  }, [tab]);

  async function toggleStatus(schedule: Schedule) {
    const newStatus = schedule.status === 'active' ? 'paused' : 'active';
    setTogglingId(schedule.id);
    try {
      await apiClient.patch(`/automation/schedules/${schedule.id}`, { status: newStatus });
      setSchedules((prev) =>
        prev.map((s) => s.id === schedule.id ? { ...s, status: newStatus } : s)
      );
    } catch {
      // silently fail
    } finally {
      setTogglingId(null);
    }
  }

  function formatScheduleType(s: Schedule): string {
    if (s.schedule_type === 'monthly') return `毎月 ${s.execution_day} 日 ${s.execution_time}`;
    if (s.schedule_type === 'weekly') return `毎週${WEEKDAY_LABELS[s.execution_day] ?? s.execution_day} ${s.execution_time}`;
    return s.schedule_type;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">自動化</h1>
          <p className="text-sm text-body mt-1">定期診断・レポート配信のスケジュールを管理します</p>
        </div>
        <Link
          href="/dashboard/automation/new"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer"
        >
          + スケジュール作成
        </Link>
      </div>

      {/* タブ */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6" aria-label="タブ">
          {(['schedules', 'logs'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${tab === t ? 'border-primary-500 text-primary-500' : 'border-transparent text-body hover:text-slate-700'}`}
            >
              {{ schedules: 'スケジュール', logs: '実行ログ' }[t]}
            </button>
          ))}
        </nav>
      </div>

      {/* スケジュール一覧 */}
      {tab === 'schedules' && (
        loadingSchedules ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 h-16 animate-pulse" />
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full inline-flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="text-base font-medium text-slate-900">スケジュールがありません</p>
            <p className="text-sm text-body mt-1">定期診断・レポート配信を自動化します</p>
            <Link
              href="/dashboard/automation/new"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer mt-4"
            >
              最初のスケジュールを作成する
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-gray-50">
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">スケジュール</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">タスク</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">次回実行</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">前回実行</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">ステータス</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors border-b border-slate-200 last:border-0">
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-slate-900">{formatScheduleType(s)}</p>
                      <p className="text-xs text-body mt-0.5">
                        {s.channels.join(' / ')}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-sm text-body">
                      {s.tasks.map((t) => ({ diagnose: '診断', report: 'レポート' }[t] ?? t)).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-sm text-body">
                      {s.next_execution ? formatDate(s.next_execution) : '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-body">
                      {s.last_execution ? formatDate(s.last_execution) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[s.status] ?? 'bg-slate-100 text-slate-700'}`}>
                        {{ active: '有効', paused: '停止中' }[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleStatus(s)}
                        disabled={togglingId === s.id}
                        className="text-sm text-primary-500 hover:underline disabled:opacity-50 cursor-pointer"
                      >
                        {s.status === 'active' ? '停止' : '再開'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* 実行ログ */}
      {tab === 'logs' && (
        loadingLogs ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 h-16 animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
            <p className="text-base font-medium text-slate-900">実行ログがありません</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-gray-50">
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">実行日時</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">アラート</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">完了タスク</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">消費クレジット</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">エラー</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors border-b border-slate-200 last:border-0">
                    <td className="py-3 px-4 text-sm text-slate-900">{formatDate(log.executed_at)}</td>
                    <td className="py-3 px-4">
                      {(() => {
                        const hasFail = (log.tasks_failed?.length ?? 0) > 0 || !!log.error_details;
                        const cls = hasFail && log.alert_level === 'none'
                          ? 'bg-red-100 text-red-700'
                          : ALERT_CLASS[log.alert_level] ?? 'bg-slate-100 text-slate-700';
                        const lbl = hasFail && log.alert_level === 'none'
                          ? '失敗'
                          : ({ none: '正常', ok: '正常', warning: '警告', critical: '重大' }[log.alert_level] ?? log.alert_level);
                        return (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${cls}`}>{lbl}</span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 text-sm text-body">
                      {log.tasks_completed?.join(', ') ?? '—'}
                      {log.tasks_failed && log.tasks_failed.length > 0 && (
                        <span className="text-red-500 ml-1">(失敗: {log.tasks_failed.join(', ')})</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-body">{log.credits_consumed} cr</td>
                    <td className="py-3 px-4 text-xs text-red-600 font-mono max-w-[200px] truncate">
                      {log.error_details ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
