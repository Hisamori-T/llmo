'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

interface Client {
  client_id: string;
  name: string;
  industry: string;
  location: string;
}

export default function NewDiagnosisPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [creditCosts, setCreditCosts] = useState<Record<string, number>>({ simple_diagnosis: 5, detailed_diagnosis: 20 });
  const [form, setForm] = useState<{ clientId: string; keywords: string; type: 'simple' | 'detailed' }>({
    clientId: '',
    keywords: '',
    type: 'simple',
  });
  const [loading, setLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const COST_KEY = { simple: 'simple_diagnosis', detailed: 'detailed_diagnosis' } as const;
  const creditsNeeded = creditCosts[COST_KEY[form.type]] ?? 5;
  const creditsRemaining = (user?.monthlyCreditsLimit ?? 0) - (user?.monthlyCreditsUsed ?? 0);
  const canRun = creditsRemaining >= creditsNeeded && !!form.clientId;
  const selectedClient = clients.find((c) => c.client_id === form.clientId);

  useEffect(() => {
    apiClient.get('/clients')
      .then((res) => setClients(res.data || []))
      .catch(() => {})
      .finally(() => setClientsLoading(false));
    apiClient.get('/billing/credit-costs')
      .then((res) => setCreditCosts(res.data))
      .catch(() => {});
  }, []);

  const handleAutoKeywords = async () => {
    if (!selectedClient) return;
    setSuggestLoading(true);
    try {
      const res = await apiClient.post('/keywords/suggest', {
        company_name: selectedClient.name,
        industry: selectedClient.industry,
        location: selectedClient.location || '',
      });
      setForm((f) => ({ ...f, keywords: (res.data as string[]).join(', ') }));
      toast.success('キーワードを生成しました');
    } catch {
      toast.error('キーワード生成に失敗しました');
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { toast.error('クライアントを選択してください'); return; }
    if (creditsRemaining < creditsNeeded) { toast.error('クレジットが不足しています。追加購入してください。'); return; }
    setLoading(true);
    try {
      const res = await apiClient.post('/diagnoses', {
        client_id: form.clientId,
        keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        type: form.type,
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
        <p className="text-sm text-body mt-1">クライアントを選択してAI認知度診断を実行します</p>
      </div>

      {creditsRemaining < creditsNeeded && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg mb-6">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          <p className="text-sm">クレジットが不足しています。<a href="/dashboard/billing" className="font-medium underline">追加購入する</a></p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        {clientsLoading ? (
          <p className="text-sm text-body py-4 text-center">読み込み中...</p>
        ) : clients.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-body mb-4">診断を実行するにはまずクライアントを登録してください</p>
            <a href="/dashboard/clients/new" className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700">
              クライアントを登録する
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="leading-normal">
              <label htmlFor="clientId" className="block text-sm font-medium text-slate-700 mb-1">クライアント <span className="text-red-500">*</span></label>
              <div className="relative">
                <select
                  id="clientId"
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value, keywords: '' })}
                  required
                  className="appearance-none w-full pl-3 pr-10 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none bg-white"
                >
                  <option value="">選択してください</option>
                  {clients.map((c) => (
                    <option key={c.client_id} value={c.client_id}>{c.name}</option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </div>
              {selectedClient && (
                <p className="text-xs text-body mt-1">{selectedClient.industry}{selectedClient.location ? ` · ${selectedClient.location}` : ''}</p>
              )}
            </div>

            <div className="leading-normal">
              <label className="block text-sm font-medium text-slate-700 mb-1">診断タイプ</label>
              <div className="flex gap-3">
                {(['simple', 'detailed'] as const).map((t) => (
                  <label key={t} className={`flex-1 flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${form.type === t ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="type" value={t} checked={form.type === t} onChange={() => setForm({ ...form, type: t })} className="accent-primary-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{t === 'simple' ? 'シンプル診断' : '詳細診断'}</p>
                      <p className="text-xs text-body">{creditCosts[COST_KEY[t]] ?? '?'}クレジット</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="leading-normal">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="keywords" className="block text-sm font-medium text-slate-700">キーワード（任意・カンマ区切り）</label>
                <button
                  type="button"
                  onClick={handleAutoKeywords}
                  disabled={!selectedClient || suggestLoading}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {suggestLoading ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                      生成中...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
                      AIで自動生成
                    </>
                  )}
                </button>
              </div>
              <input
                id="keywords"
                type="text"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="AI診断, LLMO対策, SEO"
                className="w-full px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 caret-primary-500 outline-none"
              />
              <p className="text-xs text-body mt-1">診断精度を高めるキーワードを入力、またはAI生成をご利用ください</p>
            </div>

            <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-200 text-primary-800 rounded-lg">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25z" /></svg>
              <p className="text-xs">この診断では <strong>{creditsNeeded}クレジット</strong>を消費します。現在の残量: <strong>{creditsRemaining}</strong> クレジット</p>
            </div>

            <div className="flex gap-3 pt-2">
              <a href="/dashboard/diagnoses" className="inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                キャンセル
              </a>
              <button
                type="submit"
                disabled={loading || !canRun}
                className="inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50"
              >
                {loading ? '診断実行中...' : '診断を実行する'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
