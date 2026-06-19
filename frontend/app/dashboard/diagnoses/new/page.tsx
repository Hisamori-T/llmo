'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

const INDUSTRIES = ['IT・テクノロジー', '製造業', '小売・EC', '飲食・フード', '医療・ヘルスケア', '不動産', '教育', '金融・保険', 'コンサルティング', 'その他'];

export default function NewDiagnosisPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState({ companyName: '', industry: '', location: '', keywords: '' });
  const [loading, setLoading] = useState(false);

  const creditsNeeded = 10;
  const canRun = (user?.monthlyCreditsLimit ?? 0) - (user?.monthlyCreditsUsed ?? 0) >= creditsNeeded;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRun) { toast.error('クレジットが不足しています。追加購入してください。'); return; }
    setLoading(true);
    try {
      const res = await apiClient.post('/diagnoses', {
        company_name: form.companyName,
        industry: form.industry,
        location: form.location || undefined,
        keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      });
      toast.success('診断を開始しました');
      router.push(`/dashboard/diagnoses/${res.data.diagnosis_id}`);
    } catch {
      toast.error('診断の開始に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">新規診断</h1>
        <p className="text-sm text-body mt-1">企業情報を入力してAI認知度診断を実行します（10クレジット消費）</p>
      </div>

      {!canRun && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg mb-6">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          <p className="text-sm">クレジットが不足しています。<a href="/dashboard/billing" className="font-medium underline">追加購入する</a></p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="leading-normal">
            <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-1">企業名 <span className="text-red-500">*</span></label>
            <input id="companyName" type="text" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required placeholder="株式会社サンプル" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none" />
          </div>

          <div className="leading-normal">
            <label htmlFor="industry" className="block text-sm font-medium text-slate-700 mb-1">業種 <span className="text-red-500">*</span></label>
            <div className="relative">
              <select id="industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} required className="appearance-none w-full pl-3 pr-10 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none bg-white">
                <option value="">選択してください</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
            </div>
          </div>

          <div className="leading-normal">
            <label htmlFor="location" className="block text-sm font-medium text-slate-700 mb-1">所在地（任意）</label>
            <input id="location" type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="東京都渋谷区" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none" />
          </div>

          <div className="leading-normal">
            <label htmlFor="keywords" className="block text-sm font-medium text-slate-700 mb-1">キーワード（任意・カンマ区切り）</label>
            <input id="keywords" type="text" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="AI診断, LLMO, SEO対策" className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none" />
            <p className="text-xs text-body mt-1">診断精度を高めるキーワードを入力してください</p>
          </div>

          <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-200 text-primary-800 rounded-lg">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25z" /></svg>
            <p className="text-xs">この診断では <strong>10クレジット</strong>を消費します。現在の残量: <strong>{(user?.monthlyCreditsLimit ?? 0) - (user?.monthlyCreditsUsed ?? 0)}</strong> クレジット</p>
          </div>

          <div className="flex gap-3 pt-2">
            <a href="/dashboard/diagnoses" className="inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              キャンセル
            </a>
            <button type="submit" disabled={loading || !canRun} className="inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50">
              {loading ? '診断実行中...' : '診断を実行する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
