'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
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

interface ProgressInfo {
  stage: string;
  current?: number;
  total?: number;
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
  degraded: boolean;
  progress: ProgressInfo | null;
}

interface Client {
  name: string;
  industry: string;
}

type Tier = 'high' | 'mid' | 'low';

function getScoreTier(score: number): Tier {
  if (score >= 80) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}

const TIER_CONFIG: Record<Tier, { color: string; bg: string; dotColor: string; textColor: string; label: string }> = {
  high: { color: '#3F8C5C', bg: '#E6F1E7', dotColor: '#3F8C5C', textColor: '#2E6B45', label: '良好' },
  mid:  { color: '#C28A1E', bg: '#FBF0D5', dotColor: '#C28A1E', textColor: '#9A7415', label: '改善の余地あり' },
  low:  { color: '#CF4A41', bg: '#FBE7E3', dotColor: '#CF4A41', textColor: '#CF4A41', label: '要改善' },
};

const FINDING_CONFIG: Record<string, { icon: string; color: string }> = {
  high:   { icon: 'error',        color: '#CF4A41' },
  medium: { icon: 'warning',      color: '#C28A1E' },
  low:    { icon: 'check_circle', color: '#3F8C5C' },
};
const FINDING_FALLBACK = { icon: 'info', color: '#837D6F' };

const scoreColor = (val: number) => val >= 80 ? '#3F8C5C' : val >= 50 ? '#C28A1E' : '#CF4A41';

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
    { label: 'AI認知度',    value: diagnosis.scores?.ai_awareness },
    { label: 'ブランド認識', value: diagnosis.scores?.brand_recognition },
    { label: 'コンテンツ品質', value: diagnosis.scores?.content_quality },
    { label: '競合ギャップ', value: diagnosis.scores?.competitor_gap },
  ];

  /* ===== completed 状態: SSOT フレーム03 レイアウト ===== */
  if (diagnosis.status === 'completed') {
    const overallScore = diagnosis.scores?.overall ?? 0;
    const tier = getScoreTier(overallScore);
    const tierCfg = TIER_CONFIG[tier];

    const sortedFindings = [...diagnosis.findings]
      .sort((a, b) => {
        const ord: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (ord[a.severity] ?? 3) - (ord[b.severity] ?? 3);
      })
      .slice(0, 5);

    return (
      <div className="flex flex-col">
        {/* Back link */}
        <Link
          href="/dashboard/diagnoses"
          className="inline-flex items-center gap-[3px] text-[13px] font-medium text-ink-500 no-underline mb-[14px] hover:text-primary-600 transition-colors self-start"
        >
          <span className="material-symbols-outlined text-[18px] leading-none">chevron_left</span>
          診断管理
        </Link>

        {/* Header row */}
        <div className="flex justify-between items-start gap-4 mb-5">
          <div>
            <h1 className="m-0 text-[24px] font-bold text-ink-900 tracking-[.01em]">診断結果</h1>
            <div className="flex items-center gap-[10px] mt-[7px] flex-wrap">
              <span className="text-[14px] font-medium text-ink-700">{diagnosis.url}</span>
              <span className="text-[11.5px] font-semibold text-ink-600 bg-surface-hover border border-border rounded-sm px-2 py-[2px]">
                {diagnosis.type === 'detailed' ? '詳細診断' : 'シンプル診断'}
              </span>
              <span className="text-[12.5px] text-ink-400">{formatDate(diagnosis.created_at)} 実行</span>
            </div>
          </div>
          <div className="flex gap-[10px] flex-shrink-0">
            <button
              onClick={() => router.push('/dashboard/diagnoses/new')}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-[16px] bg-[#FDFBF5] text-ink-800 border border-border-strong rounded text-[14px] font-semibold hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">refresh</span>
              再診断
            </button>
            <button
              onClick={() => handleGenerateReport('detailed')}
              disabled={reportLoading}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-[18px] bg-primary-600 text-white border-none rounded text-[14px] font-semibold hover:bg-primary-700 transition-colors cursor-pointer disabled:bg-[#A9BBD8] disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">download</span>
              {reportLoading ? '生成中...' : 'レポート出力'}
            </button>
          </div>
        </div>

        {/* Degraded warning — ロジック・コンテンツ無改変 */}
        {diagnosis.degraded && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3 mb-[18px]">
            <span className="text-amber-500 text-lg flex-shrink-0 mt-0.5">⚠</span>
            <div>
              <p className="text-sm font-medium text-amber-800">診断品質が低下しています</p>
              <p className="text-xs text-amber-700 mt-0.5">
                一部のAIモデルまたはWeb検索が利用できない状態で診断が実行されました。スコアは参考値としてご利用ください。管理者にお問い合わせください。
              </p>
            </div>
          </div>
        )}

        {/* Score card: 総合AIスコア + GEO5原則スコア */}
        <Card className="flex gap-[32px] px-[30px] py-[26px] mb-[18px]">
          {/* Left: 総合AIスコア */}
          <div className="min-w-[212px] border-r border-border-divider pr-[32px]">
            <span className="text-[12px] font-semibold text-ink-500 tracking-[.02em]">総合AIスコア</span>
            <div className="flex items-baseline gap-[5px] mt-2">
              <span
                className="text-[64px] font-bold leading-none tabular-nums"
                style={{ color: tierCfg.color }}
              >
                {Math.round(overallScore)}
              </span>
              <span className="text-[20px] font-semibold" style={{ color: '#B0A998' }}>/100</span>
            </div>
            <span
              className="inline-flex items-center gap-[5px] mt-3 px-[11px] py-1 rounded"
              style={{ background: tierCfg.bg }}
            >
              <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: tierCfg.dotColor }} />
              <span className="text-[12.5px] font-semibold" style={{ color: tierCfg.textColor }}>
                {tierCfg.label}
              </span>
            </span>
          </div>

          {/* Right: GEO5原則スコア (実データは4項目) */}
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-semibold text-ink-500 tracking-[.02em]">GEO5原則スコア</span>
            <div className="mt-[14px] flex flex-col gap-[13px]">
              {scoreItems.map((s) => {
                const val = s.value ?? 0;
                const color = scoreColor(val);
                return (
                  <div key={s.label} className="flex items-center gap-[14px]">
                    <span className="w-[84px] text-[13px] font-medium text-ink-700 flex-none">{s.label}</span>
                    <div className="flex-1 h-[7px] bg-border-divider rounded overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{ width: `${Math.min(Math.round(val), 100)}%`, background: color }}
                        role="progressbar"
                        aria-valuenow={Math.round(val)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                    <span
                      className="w-[46px] text-right text-[13px] font-bold tabular-nums flex-none"
                      style={{ color }}
                    >
                      {Math.round(val)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Findings */}
        {diagnosis.findings.length > 0 && (
          <Card className="px-[28px] pt-2 pb-5">
            <div className="flex items-center justify-between pt-4 pb-1">
              <span className="text-[15px] font-bold text-ink-900">発見事項</span>
              <span className="text-[12px] font-medium text-ink-500">優先度の高い順に5件</span>
            </div>
            {sortedFindings.map((f, i) => {
              const cfg = FINDING_CONFIG[f.severity] ?? FINDING_FALLBACK;
              return (
                <div key={i} className="flex items-start gap-[14px] py-[13px] border-b border-border-divider last:border-0">
                  <span
                    className="material-symbols-outlined flex-none"
                    style={{ fontSize: '21px', lineHeight: '1.2', color: cfg.color }}
                  >
                    {cfg.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[9px]">
                      <span className="text-[14px] font-semibold text-ink-800">{f.title}</span>
                      {f.category && (
                        <span className="text-[11px] font-semibold text-ink-500 bg-surface-hover border border-border rounded-sm px-[7px] py-[2px] flex-none">
                          {f.category}
                        </span>
                      )}
                    </div>
                    <div
                      className="text-[13px] leading-[1.65] mt-[3px]"
                      style={{ color: '#6B665B' }}
                    >
                      {f.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    );
  }

  /* ===== running / pending / failed 状態: 既存レイアウト無改変 ===== */
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
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${diagnosis.status === 'running' ? 'bg-primary-100 text-primary-700' : diagnosis.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
          {diagnosis.status === 'running' && <span className="animate-spin inline-block mr-1">⟳</span>}
          {{ completed: '完了', running: '診断中...', failed: 'エラー', pending: '待機中' }[diagnosis.status] ?? diagnosis.status}
        </span>
      </div>

      {diagnosis.status === 'failed' ? (
        <div className="bg-white rounded-xl border border-red-200 p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008z" /></svg>
          </div>
          <p className="text-base font-medium text-slate-900">診断に失敗しました</p>
          <p className="text-sm text-body mt-1">クレジットは消費されていません。</p>
          <Link href="/dashboard/diagnoses/new" className="inline-flex items-center justify-center h-10 px-4 mt-4 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700">
            再実行する
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-base font-medium text-slate-900">
            {diagnosis.progress?.stage === 'querying_llms' && diagnosis.progress.current != null && diagnosis.progress.total != null
              ? `AI診断中 (${diagnosis.progress.current}/${diagnosis.progress.total})`
              : diagnosis.progress?.stage === 'aggregating'
              ? '集計中...'
              : 'キーワード生成中...'}
          </p>
          <p className="text-sm text-body mt-1">自動的に更新されます。このページを閉じても診断は続行されます。</p>
          <div className="mt-4 max-w-xs mx-auto">
            <div className="bg-slate-200 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-primary-500 transition-all duration-700"
                style={{ width: `${
                  diagnosis.progress?.stage === 'querying_llms' && diagnosis.progress.current != null && diagnosis.progress.total != null
                    ? Math.round(10 + (diagnosis.progress.current / diagnosis.progress.total) * 70)
                    : diagnosis.progress?.stage === 'aggregating'
                    ? 85
                    : 5
                }%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
