'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatRelativeTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Session } from '@/lib/types';

type Tab = 'profile' | 'security' | 'team' | 'notifications';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [lineUserIds, setLineUserIds] = useState('');
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    if (tab === 'security') {
      apiClient.get('/users/sessions').then((res) => {
        const raw: Array<Record<string, unknown>> = Array.isArray(res.data) ? res.data : (res.data?.sessions ?? []);
        setSessions(raw.map((s) => ({
          sessionId: s.session_id as string,
          browserName: (s.browser_name as string) || 'Unknown',
          browserVersion: (s.browser_version as string) || '',
          os: (s.os as string) || 'Unknown',
          osVersion: (s.os_version as string) || '',
          ipAddress: (s.ip_address as string) || '',
          lastActivity: (s.last_activity as string) || '',
          createdAt: (s.created_at as string) || '',
          status: 'active' as const,
          isCurrent: s.is_current as boolean,
        })));
      }).catch(() => {});
    }
    if (tab === 'notifications') {
      apiClient.get('/agency').then((res) => {
        const ch = res.data?.notification_channels ?? {};
        setSlackWebhook(ch.slack?.webhook_url ?? '');
        setLineUserIds((ch.line?.user_ids ?? []).join(', '));
      }).catch(() => {});
    }
  }, [tab]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch('/users/me', { display_name: displayName });
      await refreshUser();
      toast.success('プロフィールを更新しました');
    } catch {
      toast.error('更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiClient.delete(`/users/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      toast.success('セッションを終了しました');
    } catch {
      toast.error('セッション終了に失敗しました');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/users/team/invite', { email: inviteEmail });
      toast.success(`${inviteEmail} に招待メールを送りました`);
      setInviteEmail('');
    } catch {
      toast.error('招待に失敗しました');
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotif(true);
    try {
      await apiClient.patch('/agency', {
        notification_channels: {
          slack: { webhook_url: slackWebhook.trim() },
          line: {
            user_ids: lineUserIds
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          },
        },
      });
      toast.success('通知チャネルを保存しました');
    } catch {
      toast.error('保存に失敗しました');
    } finally {
      setSavingNotif(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'プロフィール' },
    { key: 'security', label: 'セキュリティ' },
    { key: 'team', label: 'チーム管理' },
    { key: 'notifications', label: '通知チャネル' },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">設定</h1>
        <p className="text-sm text-body mt-1">アカウント・セキュリティ・チームを管理します</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} aria-selected={tab === t.key} className={`pb-3 text-sm cursor-pointer transition-colors border-b-2 ${tab === t.key ? 'font-semibold text-primary-500 border-primary-500' : 'font-medium text-slate-500 border-transparent hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {tab === 'profile' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-4">プロフィール情報</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
            <div className="leading-normal">
              <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 mb-1">表示名</label>
              <input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none" />
            </div>
            <div className="leading-normal">
              <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
              <input type="email" value={user?.email ?? ''} disabled className="w-full px-3 py-2 text-base border border-slate-200 rounded-lg bg-gray-50 text-slate-500 cursor-not-allowed" />
              <p className="text-xs text-body mt-1">メールアドレスの変更は Firebase Console から行ってください</p>
            </div>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50">
              {saving ? '保存中...' : '変更を保存'}
            </button>
          </form>
        </div>
      )}

      {/* Security / Sessions */}
      {tab === 'security' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">アクティブセッション</h2>
            <p className="text-sm text-body mt-1">現在ログイン中のブラウザ・デバイス一覧</p>
          </div>
          {sessions.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-12">セッション情報を読み込み中...</div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {sessions.map((s) => (
                <li key={s.sessionId} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{s.browserName} {s.browserVersion}</p>
                      {s.isCurrent && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-medium">現在のセッション</span>}
                    </div>
                    <p className="text-xs text-body mt-0.5">{s.os} {s.osVersion} · IP: {s.ipAddress}</p>
                    <p className="text-xs text-body mt-0.5">最終アクティビティ: {formatRelativeTime(s.lastActivity)}</p>
                  </div>
                  {!s.isCurrent && (
                    <button onClick={() => handleRevokeSession(s.sessionId)} className="inline-flex items-center justify-center h-8 px-3 text-[0.875rem] font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer">
                      終了
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Notifications */}
      {tab === 'notifications' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-1">通知チャネル設定</h2>
          <p className="text-sm text-body mb-5">自動化アラートの送信先を設定します。未入力のチャネルは使用されません。</p>
          <form onSubmit={handleSaveNotifications} className="space-y-5 max-w-lg">
            <div className="space-y-1.5">
              <label htmlFor="slack-webhook" className="block text-sm font-medium text-slate-700">
                Slack Incoming Webhook URL
              </label>
              <input
                id="slack-webhook"
                type="url"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-body">Slack ワークスペースの Incoming Webhook を設定してください</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="line-user-ids" className="block text-sm font-medium text-slate-700">
                LINE 通知先ユーザーID
              </label>
              <input
                id="line-user-ids"
                type="text"
                value={lineUserIds}
                onChange={(e) => setLineUserIds(e.target.value)}
                placeholder="Uxxxxxxxx, Uxxxxxxxx（カンマ区切りで複数可）"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-body">LINE Developers の Webhook で取得できる userId（U から始まる文字列）をカンマ区切りで入力</p>
            </div>
            <button
              type="submit"
              disabled={savingNotif}
              className="inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50"
            >
              {savingNotif ? '保存中...' : '変更を保存'}
            </button>
          </form>
        </div>
      )}

      {/* Team */}
      {tab === 'team' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">メンバー招待</h2>
            <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-4">
              <div className="leading-normal flex-1 min-w-48">
                <label htmlFor="inviteEmail" className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
                <input id="inviteEmail" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required placeholder="member@example.com" className="w-full px-3 py-2 h-11 leading-normal text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none" />
              </div>
              <button type="submit" className="inline-flex items-center justify-center h-11 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
                招待を送る
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
