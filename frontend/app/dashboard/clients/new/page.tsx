'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

const INDUSTRIES = [
  'IT・テクノロジー', '製造業', '小売・EC', '飲食・フード', '医療・ヘルスケア',
  '不動産', '建設・土木', '教育', '金融・保険', 'コンサルティング',
  '美容・サロン', '運輸・物流', '観光・ホテル', 'その他',
];

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

export default function NewClientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    url: '',
    industry: '',
    location: '',
    contact_name: '',
    contact_email: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('企業名を入力してください'); return; }
    if (!form.url.trim()) { toast.error('URLを入力してください'); return; }
    if (!form.industry) { toast.error('業種を選択してください'); return; }

    let url = form.url.trim();
    if (!/^https?:\/\//.test(url)) url = `https://${url}`;

    setLoading(true);
    try {
      await apiClient.post('/clients', {
        name: form.name.trim(),
        url,
        industry: form.industry,
        location: form.location,
        contact_name: form.contact_name.trim(),
        contact_email: form.contact_email.trim(),
      });
      toast.success('クライアントを登録しました');
      router.push('/dashboard/clients');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'クライアントの登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">クライアント登録</h1>
        <p className="text-sm text-body mt-1">新しいクライアントの基本情報を入力してください</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="leading-normal">
            <label className="block text-sm font-medium text-slate-700 mb-1">企業名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              required
              placeholder="株式会社サンプル"
              className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none"
            />
          </div>

          <div className="leading-normal">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Webサイト URL <span className="text-red-500">*</span>
              <span className="ml-1 text-xs text-body font-normal">（診断の起点となります）</span>
            </label>
            <input
              type="text"
              value={form.url}
              onChange={set('url')}
              required
              placeholder="https://example.co.jp"
              className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="leading-normal">
              <label className="block text-sm font-medium text-slate-700 mb-1">業種 <span className="text-red-500">*</span></label>
              <div className="relative">
                <select
                  value={form.industry}
                  onChange={set('industry')}
                  required
                  className="appearance-none w-full pl-3 pr-10 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none bg-white"
                >
                  <option value="">選択</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </div>
            </div>

            <div className="leading-normal">
              <label className="block text-sm font-medium text-slate-700 mb-1">都道府県</label>
              <div className="relative">
                <select
                  value={form.location}
                  onChange={set('location')}
                  className="appearance-none w-full pl-3 pr-10 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none bg-white"
                >
                  <option value="">選択（任意）</option>
                  {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">担当者情報（任意）</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="leading-normal">
                <label className="block text-sm font-medium text-slate-700 mb-1">担当者名</label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={set('contact_name')}
                  placeholder="山田 太郎"
                  className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none"
                />
              </div>
              <div className="leading-normal">
                <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={set('contact_email')}
                  placeholder="yamada@example.co.jp"
                  className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <a href="/dashboard/clients" className="inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              キャンセル
            </a>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50"
            >
              {loading ? '登録中...' : '登録する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
