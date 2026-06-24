'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

interface Client {
  client_id: string;
  name: string;
}

type SourceType = 'interview' | 'doc' | 'url';

const TYPE_OPTIONS: { value: SourceType; label: string; description: string }[] = [
  { value: 'interview', label: 'インタビュー', description: '社員・顧客へのインタビュー内容' },
  { value: 'doc',       label: 'ドキュメント', description: '社内文書・マニュアル・ホワイトペーパー' },
  { value: 'url',       label: 'URL',          description: '参照したいWebページのURL' },
];

export default function NewSourcePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('interview');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('クライアントを選択してください'); return; }
    if (!title.trim()) { setError('タイトルを入力してください'); return; }

    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/contents/sources', {
        client_id: clientId,
        type: sourceType,
        title: title.trim(),
        body: body.trim(),
        source_url: sourceUrl.trim(),
      });
      router.push('/dashboard/contents?tab=sources');
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '一次情報の登録に失敗しました');
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
        <h1 className="text-3xl font-bold text-slate-900">一次情報を追加</h1>
        <p className="text-sm text-body mt-1">記事生成の根拠となる情報を登録します</p>
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

        {/* 種別 */}
        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700">情報の種別</span>
          <div className="grid grid-cols-3 gap-3">
            {TYPE_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSourceType(value)}
                className={`flex flex-col items-start p-3 rounded-lg border text-left transition-colors cursor-pointer ${sourceType === value ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:bg-gray-50'}`}
              >
                <span className={`text-sm font-medium ${sourceType === value ? 'text-primary-500' : 'text-slate-900'}`}>{label}</span>
                <span className="text-xs text-body mt-0.5">{description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* タイトル */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="title">タイトル <span className="text-red-500">*</span></label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：代表インタビュー 2026年1月"
            required
            className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* URL（url 種別のみ） */}
        {sourceType === 'url' && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="source-url">URL</label>
            <input
              id="source-url"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        )}

        {/* 本文 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="body">
            {sourceType === 'url' ? '概要・補足（任意）' : '本文'}
          </label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder={sourceType === 'interview' ? 'Q. ○○について教えてください\nA. …' : sourceType === 'doc' ? 'ドキュメントの内容をペーストしてください' : 'ページの概要や補足情報（任意）'}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
          />
        </div>

        {/* 送信 */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || loadingClients}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                登録中…
              </>
            ) : '一次情報を登録'}
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
