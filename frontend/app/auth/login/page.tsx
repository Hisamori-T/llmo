'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import type { ExistingSession } from '@/lib/types';
import { MultipleConnectionWarning } from '@/components/MultipleConnectionWarning';

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser, setTokens } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingSession, setExistingSession] = useState<ExistingSession | null>(null);
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null);

  const finishLogin = async (data: { access_token: string; session_id: string }) => {
    setTokens(data.access_token, data.session_id);
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `auth_token=${data.session_id}; path=/; expires=${expires}; SameSite=Strict`;
    await refreshUser();
    router.push('/dashboard');
  };

  const processLogin = async (e_mail: string, pwd: string, force = false) => {
    const res = await apiClient.post('/auth/login', { email: e_mail, password: pwd, force });
    if (res.data.status === 'multiple_connection') {
      setPendingCreds({ email: e_mail, password: pwd });
      setExistingSession(res.data.existing_session);
      return;
    }
    await finishLogin(res.data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await processLogin(email, password);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 404) {
        toast.error('メールアドレスまたはパスワードが正しくありません');
      } else {
        toast.error('ログインに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogin = async () => {
    if (!pendingCreds) return;
    try {
      await processLogin(pendingCreds.email, pendingCreds.password, true);
    } catch {
      toast.error('ログインに失敗しました');
    } finally {
      setExistingSession(null);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-xl font-bold text-slate-900">LLMO Score</Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-4 mb-2">ログイン</h1>
          <p className="text-sm text-body">アカウントにサインインしてください</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="leading-normal">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none" />
          </div>
          <div className="leading-normal">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">パスワード</label>
              <Link href="/auth/reset-password" className="text-xs text-primary-500 hover:underline">忘れた方はこちら</Link>
            </div>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none" />
          </div>
          <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50">
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <p className="text-center text-sm text-body mt-6">
          アカウントをお持ちでない方は{' '}
          <Link href="/auth/signup" className="text-primary-500 hover:underline font-medium">新規登録</Link>
        </p>
      </div>

      {existingSession && (
        <MultipleConnectionWarning
          existingSession={existingSession}
          onChooseNewDevice={handleForceLogin}
          onCancel={() => setExistingSession(null)}
        />
      )}
    </div>
  );
}
