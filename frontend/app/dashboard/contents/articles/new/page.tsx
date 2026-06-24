'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

interface Client {
  client_id: string;
  name: string;
}

interface Source {
  source_id: string;
  client_id: string;
  type: string;
  title: string;
}

const SOURCE_TYPE_LABEL: Record<string, string> = {
  interview: 'インタビュー',
  doc: 'ドキュメント',
  url: 'URL',
};

export default function NewArticlePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingSources, setLoadingSources] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [diagnosisId, setDiagnosisId] = useState('');

  useEffect(() => {
    apiClient.get('/clients')
      .then((res) => {
        const list: Client[] = res.data || [];
        setClients(list);
        if (list.length > 0) setClientId(list[0].client_id);
      })
      .catch(() => {})
      .finally(() => setLoadingClients(false));
  }, []);

  useEffect(() => {
    if (!clientId) return;
    setLoadingSources(true);
    setSelectedSources([]);
    apiClient.get(`/contents/sources?client_id=${clientId}`)
      .then((res) => setSources(res.data || []))
      .catch(() => {})
      .finally(() => setLoadingSources(false));
  }, [clientId]);

  function toggleSource(sourceId: string) {
    setSelectedSources((prev) =>
      prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : [...prev, sourceId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('クライアントを選択してください'); return; }
    if (!targetKeyword.trim()) { setError('ターゲットキーワードを入力してください'); return; }
    if (selectedSources.length === 0) { setError('一次情報ソースを1つ以上選択してください'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        client_id: clientId,
        target_keyword: targetKeyword.trim(),
        source_ids: selectedSources,
      };
      if (diagnosisId.trim()) payload.diagnosis_id = diagnosisId.trim();

      const res = await apiClient.post('/contents/articles', payload);
      router.push(`/dashboard/contents/articles/${res.data.article_id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '記事生成の開始に失敗しました');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/contents" className="inline-flex items-center gap-1 text-sm text-body hover:text-slate-900">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          コンテンツ一覧
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-slate-900">記事を生成</h1>
        <p className="text-sm text-body mt-1">GEO5原則（引用可能・定量・統計・権威性・結論）準拠の記事を生成します</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        {/* クライアント */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="client">クライアント</label>
          {loadingClients ? (
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <select
              id="client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {clients.length === 0 && <option value="">クライアントがいません</option>}
              {clients.map((c) => (
                <option key={c.client_id} value={c.client_id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* ターゲットキーワード */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="keyword">
            ターゲットキーワード <span className="text-red-500">*</span>
          </label>
          <input
            id="keyword"
            type="text"
            value={targetKeyword}
            onChange={(e) => setTargetKeyword(e.target.value)}
            placeholder="例：AI検索対策 中小企業"
            required
            className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* 診断ID（オプション） */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="diagnosis">
            診断ID（任意）
          </label>
          <input
            id="diagnosis"
            type="text"
            value={diagnosisId}
            onChange={(e) => setDiagnosisId(e.target.value)}
            placeholder="診断スコアを記事に反映する場合に入力"
            className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* 一次情報ソース選択 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              一次情報ソース <span className="text-red-500">*</span>
            </span>
            {selectedSources.length > 0 && (
              <span className="text-xs text-body">{selectedSources.length} 件選択中</span>
            )}
          </div>

          {loadingSources ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-body">このクライアントの一次情報がありません</p>
              <Link
                href="/dashboard/contents/sources/new"
                className="text-sm text-primary-500 hover:underline mt-1 inline-block"
              >
                一次情報を追加する →
              </Link>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {sources.map((s) => (
                <label
                  key={s.source_id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedSources.includes(s.source_id) ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(s.source_id)}
                    onChange={() => toggleSource(s.source_id)}
                    className="rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{s.title}</p>
                    <span className="text-xs text-body">{SOURCE_TYPE_LABEL[s.type] ?? s.type}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 送信 */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || loadingClients || sources.length === 0}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                生成中…
              </>
            ) : '記事を生成する'}
          </button>
          <Link
            href="/dashboard/contents"
            className="inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
