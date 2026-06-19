'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { formatDate, getScoreColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Diagnosis } from '@/lib/types';

export default function DiagnosisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const fetchAndPoll = async () => {
      const res = await apiClient.get(`/diagnoses/${id}`);
      setDiagnosis(res.data);
      setLoading(false);
      if (res.data.status === 'running' || res.data.status === 'pending') {
        setTimeout(fetchAndPoll, 3000);
      }
    };
    fetchAndPoll().catch(() => setLoading(false));
  }, [id]);

  const handleGenerateReport = async (type: 'simple' | 'detailed') => {
    setReportLoading(true);
    try {
      const res = await apiClient.post(`/reports`, { diagnosis_id: id, type });
      toast.success('レポートを生成しました');
      router.push(`/dashboard/reports/${res.data.report_id}`);
    } catch {
      toast.error('レポート生成に失敗しました');
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) return <div className="space-y-6"><div className="h-8 bg-slate-200 rounded-md w-64 animate-pulse" /><div className="bg-white rounded-xl border border-slate-200 h-64 animate-pulse" /></div>;
  if (!diagnosis) return <div className="text-center py-16 text-body">診断が見つかりません</div>;

  const scores = [
    { label: 'AI認知度', key: 'aiAwareness' as const },
    { label: 'ブランド認識', key: 'brandRecognition' as const },
    { label: 'コンテンツ品質', key: 'contentQuality' as const },
    { label: '競合ギャップ', key: 'competitorGap' as const },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <a href="/dashboard/diagnoses" className="text-sm text-primary-500 hover:underline">診断一覧</a>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-900 font-medium">{diagnosis.companyName}</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{diagnosis.companyName}</h1>
          <p className="text-sm text-body mt-1">{diagnosis.industry} · {formatDate(diagnosis.createdAt)}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${diagnosis.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : diagnosis.status === 'running' ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-700'}`}>
          {diagnosis.status === 'running' && <span className="animate-spin inline-block mr-1">⟳</span>}
          {{ completed: '完了', running: '診断中...', failed: 'エラー', pending: '待機中' }[diagnosis.status]}
        </span>
      </div>

      {diagnosis.status === 'completed' && (
        <>
          {/* Scores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {scores.map((s) => (
              <div key={s.key} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
                <div className={`text-4xl font-bold mb-1 ${getScoreColor(diagnosis.scores[s.key])}`}>{diagnosis.scores[s.key]}</div>
                <div className="text-xs text-body">{s.label}</div>
                <div className="mt-2 bg-slate-200 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${diagnosis.scores[s.key] >= 80 ? 'bg-emerald-500' : diagnosis.scores[s.key] >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${diagnosis.scores[s.key]}%` }} role="progressbar" aria-valuenow={diagnosis.scores[s.key]} aria-valuemin={0} aria-valuemax={100} />
                </div>
              </div>
            ))}
          </div>

          {/* Findings */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">発見事項</h2>
            <div className="space-y-3">
              {diagnosis.findings.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${f.severity === 'high' ? 'bg-red-100 text-red-700' : f.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                    {f.severity === 'high' ? '高' : f.severity === 'medium' ? '中' : '低'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{f.title}</p>
                    <p className="text-sm text-body mt-0.5">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">改善推奨事項</h2>
            <ul className="space-y-2">
              {diagnosis.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-body">
                  <span className="text-primary-500 mt-0.5 flex-shrink-0">→</span>{r}
                </li>
              ))}
            </ul>
          </div>

          {/* Report actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">レポート生成</h2>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => handleGenerateReport('simple')} disabled={reportLoading} className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer disabled:opacity-50">
                簡易レポート（無料）
              </button>
              <button onClick={() => handleGenerateReport('detailed')} disabled={reportLoading} className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50">
                詳細レポートPDF
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
