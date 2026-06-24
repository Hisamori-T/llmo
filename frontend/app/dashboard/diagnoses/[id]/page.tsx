'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, getScoreColor } from '@/lib/utils';
import toast from 'react-hot-toast';

interface DiagnosisScores {
  ai_awareness: number;
  brand_recognition: number;
  content_quality: number;
  competitor_gap: number;
  overall: number;
}

interface Finding {
  category: string;
  severity: string;
  title: string;
  description: string;
}

interface Recommendation {
  action: string;
  priority?: string;
  category?: string;
  impact?: string;
  timeline?: string;
}

interface BackendDiagnosis {
  diagnosis_id: string;
  client_id: string;
  agency_id: string;
  url: string;
  keywords: string[];
  type: string;
  status: string;
  scores: DiagnosisScores | null;
  findings: Finding[];
  recommendations: Recommendation[];
  credits_used: number;
  created_at: string;
  completed_at: string | null;
}

interface Client {
  name: string;
  industry: string;
}

export default function DiagnosisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [diagnosis, setDiagnosis] = useState<BackendDiagnosis | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchAndPoll = async () => {
      const res = await apiClient.get(`/diagnoses/${id}`);
      if (!active) return;
      const d: BackendDiagnosis = res.data;
      setDiagnosis(d);
      setLoading(false);

      if (d.client_id && !client) {
        apiClient.get(`/clients/${d.client_id}`).then((r) => {
          if (active) setClient({ name: r.data.name, industry: r.data.industry });
        }).catch(() => {});
      }

      if (d.status === 'completed') {
        refreshUser();
      } else if (d.status === 'running' || d.status === 'pending') {
        setTimeout(fetchAndPoll, 3000);
      }
    };
    fetchAndPoll().catch(() => setLoading(false));
    return () => { active = false; };
  }, [id]);

  const handleGenerateReport = async (type: 'simple' | 'detailed') => {
    setReportLoading(true);
    try {
      const res = await apiClient.post('/reports', { diagnosis_id: id, type });
      toast.success('レポートを生成しました');
      router.push(`/dashboard/reports/${res.data.report_id}`);
    } catch {
      toast.error('レポート生成に失敗しました');
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) return (
    <div className="space-y-6 max-w-4xl">
      <div className="h-8 bg-slate-200 rounded-md w-64 animate-pulse" />
      <div className="bg-white rounded-xl border border-slate-200 h-64 animate-pulse" />
    </div>
  );
  if (!diagnosis) return <div className="text-center py-16 text-body">診断が見つかりません</div>;

  const displayName = client?.name ?? diagnosis.url ?? diagnosis.diagnosis_id.slice(0, 8);
  const industry = client?.industry ?? '';

  const scoreItems = [
    { label: 'AI認知度', value: diagnosis.scores?.ai_awareness },
    { label: 'ブランド認識', value: diagnosis.scores?.brand_recognition },
    { label: 'コンテンツ品質', value: diagnosis.scores?.content_quality },
    { label: '競合ギャップ', value: diagnosis.scores?.competitor_gap },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/diagnoses" className="text-sm text-primary-500 hover:underline">診断一覧</Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-900 font-medium">{displayName}</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{displayName}</h1>
          <p className="text-sm text-body mt-1">
            {industry && <>{industry} · </>}
            {formatDate(diagnosis.created_at)}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${diagnosis.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : diagnosis.status === 'running' ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-700'}`}>
          {diagnosis.status === 'running' && <span className="animate-spin inline-block mr-1">⟳</span>}
          {{ completed: '完了', running: '診断中...', failed: 'エラー', pending: '待機中' }[diagnosis.status] ?? diagnosis.status}
        </span>
      </div>

      {diagnosis.status === 'running' || diagnosis.status === 'pending' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-base font-medium text-slate-900">診断を実行しています...</p>
          <p className="text-sm text-body mt-1">しばらくお待ちください。自動的に更新されます。</p>
        </div>
      ) : diagnosis.status === 'completed' && (
        <>
          {/* Scores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {scoreItems.map((s) => {
              const val = s.value ?? 0;
              return (
                <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
                  <div className={`text-4xl font-bold mb-1 ${getScoreColor(val)}`}>{Math.round(val)}</div>
                  <div className="text-xs text-body">{s.label}</div>
                  <div className="mt-2 bg-slate-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${val >= 80 ? 'bg-emerald-500' : val >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${val}%` }}
                      role="progressbar"
                      aria-valuenow={val}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall score */}
          {diagnosis.scores?.overall != null && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex items-center gap-6">
              <div className={`text-6xl font-bold ${getScoreColor(diagnosis.scores.overall)}`}>{Math.round(diagnosis.scores.overall)}</div>
              <div>
                <p className="text-sm font-medium text-slate-900">総合スコア</p>
                <p className="text-xs text-body mt-0.5">100点満点中</p>
              </div>
            </div>
          )}

          {/* Findings */}
          {diagnosis.findings.length > 0 && (
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
          )}

          {/* Recommendations */}
          {diagnosis.recommendations.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900 mb-4">改善推奨事項</h2>
              <ul className="space-y-2">
                {diagnosis.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-body">
                    <span className="text-primary-500 mt-0.5 flex-shrink-0">→</span>
                    <span>
                      {r.action}
                      {r.timeline && <span className="ml-2 text-xs text-slate-400">({r.timeline})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
