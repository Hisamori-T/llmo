'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SignupPage() {
  const router = useRouter();
  const { refreshUser, setTokens } = useAuth();
  const [agencyName, setAgencyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const finishSignup = async (data: { access_token: string; session_id: string }) => {
    setTokens(data.access_token, data.session_id);
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `auth_token=${data.session_id}; path=/; expires=${expires}; SameSite=Strict`;
    await refreshUser();
    toast.success('アカウントを作成しました');
    router.push('/dashboard');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyName.trim()) { toast.error('代理店名を入力してください'); return; }
    if (password.length < 8) { toast.error('パスワードは8文字以上にしてください'); return; }
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/signup', {
        email,
        password,
        agency_name: agencyName,
        display_name: name,
      });
      await finishSignup(res.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        toast.error('このメールアドレスは既に使用されています');
      } else {
        toast.error('アカウント作成に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-xl font-bold text-slate-900">LLMO Score</Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-4 mb-2">新規登録</h1>
          <p className="text-sm text-body">14日間無料トライアル・クレジットカード不要</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="leading-normal">
            <label htmlFor="agencyName" className="block text-sm font-medium text-slate-700 mb-1">
              代理店名 <span className="text-red-500">*</span>
            </label>
            <input id="agencyName" type="text" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} required placeholder="株式会社〇〇" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none" />
          </div>
          <div className="leading-normal">
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">お名前</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="山田 太郎" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none" />
          </div>
          <div className="leading-normal">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none" />
          </div>
          <div className="leading-normal">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">パスワード（8文字以上）</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="••••••••" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none" />
          </div>
          <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50">
            {loading ? '登録中...' : '無料で始める'}
          </button>
        </form>

        <p className="text-center text-sm text-body mt-6">
          既にアカウントをお持ちの方は{' '}
          <Link href="/auth/login" className="text-primary-500 hover:underline font-medium">ログイン</Link>
        </p>
        <p className="text-center text-xs text-slate-500 mt-3">
          登録することで<Link href="/terms" className="hover:underline">利用規約</Link>・<Link href="/privacy" className="hover:underline">プライバシーポリシー</Link>に同意したことになります
        </p>
      </div>
    </div>
  );
}
