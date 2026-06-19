'use client';

import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
      toast.success('リセットメールを送信しました');
    } catch {
      toast.error('メールの送信に失敗しました。メールアドレスを確認してください。');
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

        {sent ? (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg mb-6">
            <span className="text-xl">✓</span>
            <div>
              <p className="font-medium">メールを送信しました</p>
              <p className="text-sm mt-1">{email} にリセット用リンクを送りました。メールをご確認ください。</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
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
