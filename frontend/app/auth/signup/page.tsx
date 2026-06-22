'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

function setAuthSession(sessionId: string) {
  localStorage.setItem('session_id', sessionId);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `auth_token=${sessionId}; path=/; expires=${expires}; SameSite=Strict`;
}

export default function SignupPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [agencyName, setAgencyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const finishSignup = async (sessionId: string) => {
    setAuthSession(sessionId);
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
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      const idToken = await credential.user.getIdToken();
      const res = await apiClient.post('/auth/signup', {
        id_token: idToken,
        agency_name: agencyName,
        display_name: name,
      });
      await finishSignup(res.data.session_id);
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err) {
        const code = (err as { code: string }).code;
        if (code === 'auth/email-already-in-use') {
          toast.error('このメールアドレスは既に使用されています');
        } else {
          toast.error('アカウント作成に失敗しました');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (!agencyName.trim()) { toast.error('先に代理店名を入力してください'); return; }
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();
      const res = await apiClient.post('/auth/signup', {
        id_token: idToken,
        agency_name: agencyName,
        display_name: credential.user.displayName ?? '',
      });
      await finishSignup(res.data.session_id);
    } catch {
      toast.error('Googleでの登録に失敗しました');
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

        <form onSubmit={handleSignup} className="space-y-4 mb-6">
          <div className="leading-normal">
            <label htmlFor="agencyName" className="block text-sm font-medium text-slate-700 mb-1">
              代理店名 <span className="text-red-500">*</span>
            </label>
            <input
              id="agencyName"
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              required
              placeholder="株式会社〇〇"
              className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none"
            />
          </div>
          <div className="leading-normal">
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">お名前</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="山田 太郎"
              className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none"
            />
          </div>
          <div className="leading-normal">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none"
            />
          </div>
          <div className="leading-normal">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">パスワード（8文字以上）</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50"
          >
            {loading ? '登録中...' : '無料で始める'}
          </button>
        </form>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 border-t border-slate-200" />
          <span className="text-sm text-slate-500">または</span>
          <div className="flex-1 border-t border-slate-200" />
        </div>

        <button
          onClick={handleGoogleSignup}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Googleで登録（代理店名は先に入力）
        </button>

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
