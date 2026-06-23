'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('リセットメールを送信しました');
    } catch {
      toast.error('メールの送信に失敗しました。メールアドレスを確認してください。');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error('パスワードは8文字以上にしてください'); return; }
    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { token, new_password: newPassword });
      toast.success('パスワードを更新しました');
      router.push('/auth/login');
    } catch {
      toast.error('リセットリンクが無効または期限切れです');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-xl font-bold text-slate-900">LLMO Score</Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-4 mb-2">パスワードリセット</h1>
        </div>

        {token ? (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-sm text-body mb-4">新しいパスワードを入力してください。</p>
            <div className="leading-normal">
              <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-1">新しいパスワード（8文字以上）</label>
              <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} placeholder="••••••••" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none" />
            </div>
            <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50">
              {loading ? '更新中...' : 'パスワードを更新'}
            </button>
          </form>
        ) : sent ? (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg mb-6">
            <span className="text-xl">✓</span>
            <div>
              <p className="font-medium">メールを送信しました</p>
              <p className="text-sm mt-1">{email} にリセット用リンクを送りました。メールをご確認ください。</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleForgot} className="space-y-4">
            <p className="text-sm text-body mb-4">登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。</p>
            <div className="leading-normal">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none" />
            </div>
            <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50">
              {loading ? '送信中...' : 'リセットメールを送信'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-body mt-6">
          <Link href="/auth/login" className="text-primary-500 hover:underline">← ログインに戻る</Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
