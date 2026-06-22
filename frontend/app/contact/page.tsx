'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', company: '', email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSending(false);
    setSent(true);
    toast.success('お問い合わせを受け付けました');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">LLMO Score</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <Link href="/features" className="hover:text-slate-900">機能</Link>
            <Link href="/pricing" className="hover:text-slate-900">料金</Link>
            <Link href="/blog" className="hover:text-slate-900">ブログ</Link>
            <Link href="/contact" className="font-medium text-primary-600">お問い合わせ</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-slate-600 hover:text-slate-900">ログイン</Link>
            <Link href="/auth/signup" className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700">無料で始める</Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-20">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">お問い合わせ</h1>
          <p className="text-slate-600">ご質問・ご要望・企業向けプランのご相談はこちらからどうぞ。通常1〜2営業日以内にご返信します。</p>
        </div>

        {sent ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">送信しました</h2>
            <p className="text-sm text-slate-600 mb-6">お問い合わせを受け付けました。1〜2営業日以内にご返信いたします。</p>
            <Link href="/" className="text-sm text-primary-500 hover:underline">トップページへ戻る</Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="leading-normal">
                  <label className="block text-sm font-medium text-slate-700 mb-1">お名前 <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="山田 太郎" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none" />
                </div>
                <div className="leading-normal">
                  <label className="block text-sm font-medium text-slate-700 mb-1">会社名</label>
                  <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="株式会社〇〇" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none" />
                </div>
              </div>
              <div className="leading-normal">
                <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス <span className="text-red-500">*</span></label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none" />
              </div>
              <div className="leading-normal">
                <label className="block text-sm font-medium text-slate-700 mb-1">お問い合わせ内容 <span className="text-red-500">*</span></label>
                <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="ご質問・ご要望をお書きください" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none resize-none" />
              </div>
              <button type="submit" disabled={sending} className="w-full inline-flex items-center justify-center h-11 px-6 text-base font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer">
                {sending ? '送信中...' : '送信する'}
              </button>
            </form>
          </div>
        )}

        <div className="mt-8 text-center text-sm text-slate-500">
          <p>急ぎのご用件は <strong className="text-slate-700">hisa1975@gmail.com</strong> までご連絡ください。</p>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        <p>© 2026 LLMO Score. All rights reserved.</p>
      </footer>
    </div>
  );
}
