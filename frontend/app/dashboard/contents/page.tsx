'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Source {
  source_id: string;
  client_id: string;
  type: string;
  title: string;
  body: string;
  source_url: string;
  created_at: string;
}

interface Article {
  article_id: string;
  client_id: string;
  target_keyword: string;
  title: string | null;
  status: string;
  credits_used: number;
  created_at: string;
}

type Tab = 'articles' | 'sources';

const SOURCE_TYPE_LABEL: Record<string, string> = {
  interview: 'インタビュー',
  doc: 'ドキュメント',
  url: 'URL',
};

const ARTICLE_STATUS_CLASS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  edited: 'bg-primary-100 text-primary-700',
  published: 'bg-emerald-100 text-emerald-700',
  generating: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
};

const ARTICLE_STATUS_LABEL: Record<string, string> = {
  draft: '下書き',
  edited: '編集済み',
  published: '公開済み',
  generating: '生成中',
  failed: 'エラー',
};

export default function ContentsPage() {
  const [tab, setTab] = useState<Tab>('articles');
  const [articles, setArticles] = useState<Article[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [loadingSources, setLoadingSources] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/contents/articles')
      .then((res) => setArticles(res.data || []))
      .catch(() => {})
      .finally(() => setLoadingArticles(false));
  }, []);

  useEffect(() => {
    if (tab !== 'sources') return;
    setLoadingSources(true);
    apiClient.get('/contents/sources')
      .then((res) => setSources(res.data || []))
      .catch(() => {})
      .finally(() => setLoadingSources(false));
  }, [tab]);

  async function deleteSource(sourceId: string) {
    setDeletingId(sourceId);
    try {
      await apiClient.delete(`/contents/sources/${sourceId}`);
      setSources((prev) => prev.filter((s) => s.source_id !== sourceId));
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">コンテンツ</h1>
          <p className="text-sm text-body mt-1">一次情報をもとに GEO5原則準拠の記事を生成します</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'articles' && (
            <Link
              href="/dashboard/contents/articles/new"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer"
            >
              + 記事を生成
            </Link>
          )}
          {tab === 'sources' && (
            <Link
              href="/dashboard/contents/sources/new"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer"
            >
              + 一次情報を追加
            </Link>
          )}
        </div>
      </div>

      {/* タブ */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6" aria-label="タブ">
          {(['articles', 'sources'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${tab === t ? 'border-primary-500 text-primary-500' : 'border-transparent text-body hover:text-slate-700'}`}
            >
              {{ articles: '記事', sources: '一次情報ソース' }[t]}
            </button>
          ))}
        </nav>
      </div>

      {/* 記事一覧 */}
      {tab === 'articles' && (
        loadingArticles ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 h-16 animate-pulse" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full inline-flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 7.5h7.5M8.25 15h7.5" />
              </svg>
            </div>
            <p className="text-base font-medium text-slate-900">記事がありません</p>
            <p className="text-sm text-body mt-1">一次情報を登録してから記事を生成します</p>
            <Link
              href="/dashboard/contents/articles/new"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer mt-4"
            >
              記事を生成する
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-gray-50">
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">タイトル / キーワード</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">ステータス</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">消費クレジット</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">作成日</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">アクション</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.article_id} className="hover:bg-gray-50 transition-colors border-b border-slate-200 last:border-0">
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-slate-900">{a.title ?? '—'}</p>
                      <p className="text-xs text-body mt-0.5">{a.target_keyword}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${ARTICLE_STATUS_CLASS[a.status] ?? 'bg-slate-100 text-slate-700'}`}>
                        {ARTICLE_STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-body">{a.credits_used} cr</td>
                    <td className="py-3 px-4 text-sm text-body">{formatDate(a.created_at)}</td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/dashboard/contents/articles/${a.article_id}`}
                        className="text-sm text-primary-500 hover:underline"
                      >
                        編集
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ソース一覧 */}
      {tab === 'sources' && (
        loadingSources ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 h-16 animate-pulse" />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full inline-flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
              </svg>
            </div>
            <p className="text-base font-medium text-slate-900">一次情報がありません</p>
            <p className="text-sm text-body mt-1">インタビュー・ドキュメント・URLを登録します</p>
            <Link
              href="/dashboard/contents/sources/new"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer mt-4"
            >
              一次情報を追加する
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-gray-50">
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">タイトル</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">種別</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">URL</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">登録日</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source_id} className="hover:bg-gray-50 transition-colors border-b border-slate-200 last:border-0">
                    <td className="py-3 px-4 text-sm font-medium text-slate-900">{s.title}</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-medium">
                        {SOURCE_TYPE_LABEL[s.type] ?? s.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-body max-w-[200px] truncate">
                      {s.source_url ? (
                        <a href={s.source_url} target="_blank" rel="noreferrer" className="text-primary-500 hover:underline">{s.source_url}</a>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-body">{formatDate(s.created_at)}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => deleteSource(s.source_id)}
                        disabled={deletingId === s.source_id}
                        className="text-sm text-red-500 hover:underline disabled:opacity-50 cursor-pointer"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
