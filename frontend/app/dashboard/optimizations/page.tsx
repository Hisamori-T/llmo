'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Optimization {
  optimization_id: string;
  diagnosis_id: string;
  client_id: string;
  status: string;
  credits_used: number;
  created_at: string;
  completed_at: string | null;
  error: string | null;
}

type Filter = 'all' | 'completed' | 'running' | 'failed';

const STATUS_LABEL: Record<string, string> = {
  completed: '完了',
  running: '生成中',
  failed: 'エラー',
  pending: '待機中',
};

const STATUS_CLASS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  running: 'bg-primary-100 text-primary-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-slate-100 text-slate-700',
};

export default function OptimizationsPage() {
  const [items, setItems] = useState<Optimization[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    apiClient.get('/optimizations')
      .then((res) => setItems(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((o) => filter === 'all' || o.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">実装最適化</h1>
          <p className="text-sm text-body mt-1">診断結果から JSON-LD・FAQスキーマ・チェックリストなどを自動生成します</p>
        </div>
        <Link
          href="/dashboard/optimizations/new"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer"
        >
          + 新規最適化
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {(['all', 'completed', 'running', 'failed'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-selected={filter === f}
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm border cursor-pointer transition-colors ${filter === f ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-body border-slate-200 hover:bg-gray-50'}`}
          >
            {{ all: 'すべて', completed: '完了', running: '生成中', failed: 'エラー' }[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 h-16 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full inline-flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <p className="text-base font-medium text-slate-900">最適化がありません</p>
          <p className="text-sm text-body mt-1">完了した診断をもとに実装最適化を生成します</p>
          <Link
            href="/dashboard/optimizations/new"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer mt-4"
          >
            最初の最適化を作成する
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-gray-50">
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">診断ID</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">ステータス</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">消費クレジット</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">作成日</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">完了日</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">アクション</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.optimization_id} className="hover:bg-gray-50 transition-colors border-b border-slate-200 last:border-0">
                  <td className="py-3 px-4 text-sm text-slate-900 font-mono">{o.diagnosis_id.slice(0, 8)}…</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[o.status] ?? 'bg-slate-100 text-slate-700'}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-body">{o.credits_used} cr</td>
                  <td className="py-3 px-4 text-sm text-body">{formatDate(o.created_at)}</td>
                  <td className="py-3 px-4 text-sm text-body">{o.completed_at ? formatDate(o.completed_at) : '—'}</td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/dashboard/optimizations/${o.optimization_id}`}
                      className="text-sm text-primary-500 hover:underline"
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
