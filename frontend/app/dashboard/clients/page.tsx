'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { getScoreColor } from '@/lib/utils';

interface Client {
  client_id: string;
  name: string;
  url: string;
  industry: string;
  location: string;
  status: string;
  latest_score: number | null;
  latest_diagnosis_id: string | null;
  created_at: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiClient.get('/clients')
      .then((res) => setClients(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(
    (c) => c.status !== 'deleted' && (
      !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.url.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">クライアント</h1>
          <p className="text-sm text-body mt-1">登録済みクライアントの管理</p>
        </div>
        <Link
          href="/dashboard/clients/new"
          className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          新規登録
        </Link>
      </div>

      <div className="mb-5">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="企業名・URLで検索"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none bg-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-body text-center py-12">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>
          <p className="text-slate-500 font-medium mb-2">{search ? '検索結果がありません' : 'クライアントがまだ登録されていません'}</p>
          {!search && (
            <Link href="/dashboard/clients/new" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium mt-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              最初のクライアントを登録する
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">企業名</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">業種</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">エリア</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">スコア</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.client_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    <p className="text-xs text-body truncate max-w-xs">{c.url}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{c.industry || '—'}</td>
                  <td className="px-5 py-4 text-slate-600">{c.location || '—'}</td>
                  <td className="px-5 py-4">
                    {c.latest_score != null ? (
                      <span className={`font-bold text-lg ${getScoreColor(c.latest_score)}`}>{Math.round(c.latest_score)}</span>
                    ) : (
                      <span className="text-slate-300 text-sm">未診断</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/dashboard/diagnoses/new?client_id=${c.client_id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-800 mr-4"
                    >
                      診断実行
                    </Link>
                    <Link
                      href={`/dashboard/clients/${c.client_id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                    >
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
