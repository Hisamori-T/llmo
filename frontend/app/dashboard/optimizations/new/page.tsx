'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { formatDate, getScoreColor } from '@/lib/utils';

interface Diagnosis {
  diagnosis_id: string;
  url: string;
  type: string;
  scores: { ai_awareness: number; overall: number } | null;
  created_at: string;
}

export default function NewOptimizationPage() {
  const router = useRouter();
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/diagnoses?status=completed')
      .then((res) => {
        const all: Diagnosis[] = res.data || [];
        setDiagnoses(all.filter((d) => (d as any).status === 'completed'));
      })
      .catch(() => setError('診断一覧の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(diagnosisId: string) {
    setSubmitting(diagnosisId);
    setError(null);
    try {
      const res = await apiClient.post('/optimizations', { diagnosis_id: diagnosisId });
      router.push(`/dashboard/optimizations/${res.data.optimization_id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '最適化の作成に失敗しました');
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/optimizations"
          className="inline-flex items-center gap-1 text-sm text-body hover:text-slate-900"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          実装最適化一覧
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-slate-900">新規最適化</h1>
        <p className="text-sm text-body mt-1">最適化を生成する完了済み診断を選択してください</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 h-20 animate-pulse" />
          ))}
        </div>
      ) : diagnoses.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full inline-flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5" />
            </svg>
          </div>
          <p className="text-base font-medium text-slate-900">完了済みの診断がありません</p>
          <p className="text-sm text-body mt-1">まず詳細診断を実行してください</p>
          <Link
            href="/dashboard/diagnoses/new"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer mt-4"
          >
            診断を実行する
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
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">実行日</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {diagnoses.map((d) => (
                <tr key={d.diagnosis_id} className="hover:bg-gray-50 transition-colors border-b border-slate-200 last:border-0">
                  <td className="py-3 px-4 text-sm text-slate-900 font-medium max-w-[260px] truncate">{d.url}</td>
                  <td className="py-3 px-4 text-sm text-body">{d.type === 'detailed' ? '詳細診断' : 'シンプル診断'}</td>
                  <td className="py-3 px-4">
                    {d.scores ? (
                      <span className={`text-sm font-bold ${getScoreColor(d.scores.ai_awareness)}`}>
                        {Math.round(d.scores.ai_awareness)}<span className="text-xs font-normal text-body">/100</span>
                      </span>
                    ) : <span className="text-sm text-body">—</span>}
                  </td>
                  <td className="py-3 px-4 text-sm text-body">{formatDate(d.created_at)}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleCreate(d.diagnosis_id)}
                      disabled={submitting !== null}
                      className="inline-flex items-center justify-center gap-2 h-8 px-3 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting === d.diagnosis_id ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          生成中…
                        </>
                      ) : '最適化を生成'}
                    </button>
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
