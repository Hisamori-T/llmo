'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface GeoChecklist {
  citations: boolean;
  numbers: boolean;
  statistics: boolean;
  authority: boolean;
  conclusions: boolean;
}

interface Article {
  article_id: string;
  client_id: string;
  target_keyword: string;
  title: string | null;
  outline: object[] | null;
  body_markdown: string | null;
  geo_checklist: GeoChecklist | null;
  source_ids: string[];
  status: string;
  credits_used: number;
  created_at: string;
  updated_at: string | null;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: '下書き' },
  { value: 'edited', label: '編集済み' },
  { value: 'published', label: '公開済み' },
];

const GEO_LABELS: Record<keyof GeoChecklist, string> = {
  citations: '引用可能な具体的文章',
  numbers: '定量データ3箇所以上',
  statistics: '統計・調査データ',
  authority: '権威性指標',
  conclusions: '各セクションに結論',
};

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editStatus, setEditStatus] = useState('draft');

  const fetchArticle = useCallback(() => {
    apiClient.get(`/contents/articles/${id}`)
      .then((res) => {
        const a: Article = res.data;
        setArticle(a);
        setEditTitle(a.title ?? '');
        setEditBody(a.body_markdown ?? '');
        setEditStatus(a.status);
      })
      .catch((e) => { if (e?.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchArticle(); }, [fetchArticle]);

  // Poll while generating
  useEffect(() => {
    if (!article || article.status !== 'generating') return;
    const timer = setTimeout(fetchArticle, 5000);
    return () => clearTimeout(timer);
  }, [article, fetchArticle]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await apiClient.patch(`/contents/articles/${id}`, {
        title: editTitle.trim() || undefined,
        body_markdown: editBody.trim() || undefined,
        status: editStatus,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setSaveError(e?.response?.data?.detail ?? '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-100 rounded animate-pulse w-48" />
        <div className="bg-white rounded-xl border border-slate-200 h-96 animate-pulse" />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="text-center py-16">
        <p className="text-base font-medium text-slate-900">記事が見つかりません</p>
        <Link href="/dashboard/contents" className="text-sm text-primary-500 hover:underline mt-2 inline-block">
          一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/contents" className="inline-flex items-center gap-1 text-sm text-body hover:text-slate-900">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          コンテンツ一覧
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{article.title ?? '（タイトル未生成）'}</h1>
          <p className="text-sm text-body mt-1">キーワード: {article.target_keyword}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-body">{article.credits_used} cr</span>
          <span className="text-xs text-body">{formatDate(article.created_at)}</span>
        </div>
      </div>

      {/* 生成中 */}
      {article.status === 'generating' && (
        <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-200 text-primary-800 rounded-lg">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div>
            <p className="font-medium text-sm">記事を生成中です</p>
            <p className="text-xs mt-0.5">完了すると自動的に更新されます</p>
          </div>
        </div>
      )}

      {/* GEOチェックリスト */}
      {article.geo_checklist && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">GEO5原則チェック</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(GEO_LABELS) as (keyof GeoChecklist)[]).map((key) => (
              <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${article.geo_checklist![key] ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>
                {article.geo_checklist![key] ? (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                )}
                {GEO_LABELS[key]}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 編集フォーム */}
      {article.status !== 'generating' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-semibold text-slate-900">記事を編集</h2>

          {saveError && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              {saveError}
            </div>
          )}

          {saved && (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              保存しました
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="title">タイトル</label>
            <input
              id="title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="status">ステータス</label>
            <select
              id="status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="w-48 h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="body">本文（Markdown）</label>
            <textarea
              id="body"
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={24}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y font-mono"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  保存中…
                </>
              ) : '変更を保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
