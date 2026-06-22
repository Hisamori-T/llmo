'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { formatDate, getScoreColor } from '@/lib/utils';

interface DiagnosisScores {
  ai_awareness: number;
  overall: number;
}

interface Diagnosis {
  diagnosis_id: string;
  client_id: string;
  url: string;
  type: string;
  status: string;
  scores: DiagnosisScores | null;
  created_at: string;
}

export default function DiagnosesPage() {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'running'>('all');

  useEffect(() => {
    apiClient.get('/diagnoses').then((res) => setDiagnoses(res.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = diagnoses.filter((d) => filter === 'all' || d.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">診断管理</h1>
          <p className="text-sm text-body mt-1">企業のAI認知度を診断・管理します</p>
        </div>
        <Link href="/dashboard/diagnoses/new" className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
          + 新規診断
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['all', 'completed', 'running'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-selected={filter === f} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border cursor-pointer transition-colors ${filter === f ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-body border-slate-200 hover:bg-gray-50'}`}>
            {{ all: 'すべて', completed: '完了', running: '実行中' }[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 h-20 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full inline-flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5" /></svg>
          </div>
          <p className="text-base font-medium text-slate-900">診断がありません</p>
          <Link href="/dashboard/diagnoses/new" className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer mt-4">
            最初の診断を実行する
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-gray-50">
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">URL</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">種類</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">AIスコア</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">ステータス</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">実行日</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">アクション</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.diagnosis_id} className="hover:bg-gray-50 transition-colors border-b border-slate-200 last:border-0">
                  <td className="py-3 px-4 text-sm text-slate-900 font-medium max-w-[200px] truncate">{d.url}</td>
                  <td className="py-3 px-4 text-sm text-body">{d.type === 'detailed' ? '詳細診断' : 'シンプル診断'}</td>
                  <td className="py-3 px-4">
                    {d.status === 'completed' && d.scores ? (
                      <span className={`text-sm font-bold ${getScoreColor(d.scores.ai_awareness)}`}>{Math.round(d.scores.ai_awareness)}<span className="text-xs font-normal text-body">/100</span></span>
                    ) : <span className="text-sm text-body">--</span>}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${d.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : d.status === 'running' ? 'bg-primary-100 text-primary-700' : d.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                      {{ completed: '完了', running: '実行中', failed: 'エラー', pending: '待機中' }[d.status] ?? d.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-body">{formatDate(d.created_at)}</td>
                  <td className="py-3 px-4 flex items-center gap-2">
                    <Link href={`/dashboard/diagnoses/${d.diagnosis_id}`} className="text-sm text-primary-500 hover:underline">詳細</Link>
                    {d.status === 'completed' && <Link href={`/dashboard/reports?diagnosisId=${d.diagnosis_id}`} className="text-sm text-primary-500 hover:underline">レポート</Link>}
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
