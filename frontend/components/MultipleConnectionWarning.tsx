'use client';

import { useState } from 'react';
import { formatRelativeTime } from '@/lib/utils';

interface Props {
  existingSession: { browser: string; device: string; lastActivity: string };
  newSessionInfo: { browser: string; device: string };
  isDeviceDifferent: boolean;
  onChooseNewDevice: () => Promise<void>;
  onCancel: () => void;
}

export function MultipleConnectionWarning({ existingSession, newSessionInfo, isDeviceDifferent, onChooseNewDevice, onCancel }: Props) {
  const [loading, setLoading] = useState(false);

  const message = isDeviceDifferent ? '別デバイスでログインしています' : '別ブラウザでログインしています';

  const handleChoose = async () => {
    setLoading(true);
    try {
      await onChooseNewDevice();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">セキュリティ確認</h2>
            <p className="text-sm text-body">{message}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">現在ログイン中のセッション</p>
            <p className="text-sm text-slate-900">{existingSession.browser} / {existingSession.device}</p>
            <p className="text-xs text-body">最終アクティビティ: {formatRelativeTime(existingSession.lastActivity)}</p>
          </div>
          <div role="separator" className="border-t border-slate-200" />
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">新規ログイン（このブラウザ）</p>
            <p className="text-sm text-slate-900">{newSessionInfo.browser} / {newSessionInfo.device}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-200 text-primary-800 rounded-lg mb-6">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25z" /></svg>
          <p className="text-xs">このアカウントは同時に1つのブラウザからのみログイン可能です。「このブラウザを使用」を選ぶと、既存セッションは自動的に終了します。</p>
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer disabled:opacity-50">
            キャンセル
          </button>
          <button onClick={handleChoose} disabled={loading} className="flex-1 inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50">
            {loading ? 'ログイン中...' : 'このブラウザを使用'}
          </button>
        </div>
      </div>
    </div>
  );
}
