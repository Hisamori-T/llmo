'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

interface Client {
  client_id: string;
  name: string;
  website: string;
}

const WEEKDAY_OPTIONS = [
  { value: 0, label: '月曜日' },
  { value: 1, label: '火曜日' },
  { value: 2, label: '水曜日' },
  { value: 3, label: '木曜日' },
  { value: 4, label: '金曜日' },
  { value: 5, label: '土曜日' },
  { value: 6, label: '日曜日' },
];

export default function NewSchedulePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [scheduleType, setScheduleType] = useState<'weekly' | 'monthly'>('monthly');
  const [executionDay, setExecutionDay] = useState(1);
  const [executionTime, setExecutionTime] = useState('09:00');
  const [channels, setChannels] = useState<string[]>(['email']);
  const [tasks, setTasks] = useState<string[]>(['diagnose', 'report']);

  useEffect(() => {
    apiClient.get('/clients')
      .then((res) => {
        const list: Client[] = res.data || [];
        setClients(list);
        if (list.length > 0) setClientId(list[0].client_id);
      })
      .catch(() => {})
      .finally(() => setLoadingClients(false));
  }, []);

  function toggleChannel(ch: string) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  }

  function toggleTask(t: string) {
    setTasks((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('クライアントを選択してください'); return; }
    if (channels.length === 0) { setError('通知チャネルを1つ以上選択してください'); return; }
    if (tasks.length === 0) { setError('タスクを1つ以上選択してください'); return; }

    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/automation/schedules', {
        client_id: clientId,
        schedule_type: scheduleType,
        execution_day: executionDay,
        execution_time: executionTime,
        channels,
        tasks,
      });
      router.push('/dashboard/automation');
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'スケジュールの作成に失敗しました');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/automation" className="inline-flex items-center gap-1 text-sm text-body hover:text-slate-900">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          自動化一覧
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-slate-900">スケジュール作成</h1>
        <p className="text-sm text-body mt-1">定期診断・レポート配信の実行スケジュールを設定します</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        {/* クライアント */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="client">クライアント</label>
          {loadingClients ? (
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <select
              id="client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {clients.length === 0 && <option value="">クライアントがいません</option>}
              {clients.map((c) => (
                <option key={c.client_id} value={c.client_id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* スケジュール種別 */}
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">実行頻度</span>
          <div className="flex gap-3">
            {(['monthly', 'weekly'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setScheduleType(t);
                  setExecutionDay(t === 'monthly' ? 1 : 0);
                }}
                className={`flex-1 h-10 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${scheduleType === t ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-slate-700 border-slate-200 hover:bg-gray-50'}`}
              >
                {{ monthly: '月次', weekly: '週次' }[t]}
              </button>
            ))}
          </div>
        </div>

        {/* 実行日 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="execution-day">
            {scheduleType === 'monthly' ? '実行日（1〜28日）' : '実行曜日'}
          </label>
          {scheduleType === 'monthly' ? (
            <input
              id="execution-day"
              type="number"
              min={1}
              max={28}
              value={executionDay}
              onChange={(e) => setExecutionDay(Number(e.target.value))}
              className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          ) : (
            <select
              id="execution-day"
              value={executionDay}
              onChange={(e) => setExecutionDay(Number(e.target.value))}
              className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {WEEKDAY_OPTIONS.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* 実行時刻 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="execution-time">実行時刻</label>
          <input
            id="execution-time"
            type="time"
            value={executionTime}
            onChange={(e) => setExecutionTime(e.target.value)}
            className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* 通知チャネル */}
        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700">通知チャネル</span>
          <div className="flex gap-4">
            {[{ value: 'email', label: 'メール' }, { value: 'slack', label: 'Slack' }, { value: 'line', label: 'LINE' }].map(({ value, label }) => (
              <label key={value} className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={channels.includes(value)}
                  onChange={() => toggleChannel(value)}
                  className="rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* タスク */}
        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700">実行タスク</span>
          <div className="flex gap-4">
            {[{ value: 'diagnose', label: '診断' }, { value: 'report', label: 'レポート生成' }].map(({ value, label }) => (
              <label key={value} className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tasks.includes(value)}
                  onChange={() => toggleTask(value)}
                  className="rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 送信 */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || loadingClients}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                作成中…
              </>
            ) : 'スケジュールを作成'}
          </button>
          <Link
            href="/dashboard/automation"
            className="inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
