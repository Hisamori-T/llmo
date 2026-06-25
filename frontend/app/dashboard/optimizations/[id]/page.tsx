'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface ChecklistItem {
  category?: string;
  item?: string;
  priority?: string;
  done?: boolean;
  [key: string]: unknown;
}

interface Optimization {
  optimization_id: string;
  diagnosis_id: string;
  client_id: string;
  status: string;
  json_ld: object | null;
  ai_summary: string | null;
  robots_txt: string | null;
  faq_structure: object[] | null;
  wp_preset: object | null;
  checklist: ChecklistItem[] | null;
  credits_used: number;
  created_at: string;
  completed_at: string | null;
  error: string | null;
}

const ARTIFACTS: { key: keyof Optimization; label: string; filename: string }[] = [
  { key: 'json_ld',       label: 'JSON-LD',       filename: 'json_ld.json' },
  { key: 'faq_structure', label: 'FAQスキーマ',   filename: 'faq_structure.json' },
  { key: 'wp_preset',     label: 'WP Preset',     filename: 'wp_preset.json' },
  { key: 'checklist',     label: 'チェックリスト', filename: 'checklist.json' },
  { key: 'ai_summary',    label: 'AI概要文',       filename: 'ai_summary.txt' },
  { key: 'robots_txt',    label: 'robots.txt',    filename: 'robots.txt' },
];

export default function OptimizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [opt, setOpt] = useState<Optimization | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchOpt = useCallback(() => {
    apiClient.get(`/optimizations/${id}`)
      .then((res) => setOpt(res.data))
      .catch((e) => { if (e?.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchOpt();
  }, [fetchOpt]);

  // Poll while running
  useEffect(() => {
    if (!opt || opt.status !== 'running') return;
    const timer = setTimeout(fetchOpt, 5000);
    return () => clearTimeout(timer);
  }, [opt, fetchOpt]);

  function downloadArtifact(artifactKey: keyof Optimization) {
    const artifact = ARTIFACTS.find((a) => a.key === artifactKey);
    if (!artifact || !opt) return;
    const value = opt[artifactKey];
    if (value === null || value === undefined) return;
    const isJson = artifact.filename.endsWith('.json');
    const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const mime = isJson ? 'application/json' : 'text/plain';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = artifact.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-100 rounded animate-pulse w-48" />
        <div className="bg-white rounded-xl border border-slate-200 h-64 animate-pulse" />
      </div>
    );
  }

  if (notFound || !opt) {
    return (
      <div className="text-center py-16">
        <p className="text-base font-medium text-slate-900">最適化が見つかりません</p>
        <Link href="/dashboard/optimizations" className="text-sm text-primary-500 hover:underline mt-2 inline-block">
          一覧に戻る
        </Link>
      </div>
    );
  }

  const statusClass = opt.status === 'completed'
    ? 'bg-emerald-100 text-emerald-700'
    : opt.status === 'running'
    ? 'bg-primary-100 text-primary-700'
    : opt.status === 'failed'
    ? 'bg-red-100 text-red-700'
    : 'bg-slate-100 text-slate-700';

  const statusLabel: Record<string, string> = {
    completed: '完了', running: '生成中', failed: 'エラー', pending: '待機中',
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/optimizations" className="inline-flex items-center gap-1 text-sm text-body hover:text-slate-900">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          実装最適化一覧
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">実装最適化 詳細</h1>
          <p className="text-sm text-body mt-1 font-mono">{opt.optimization_id}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusClass}`}>
          {statusLabel[opt.status] ?? opt.status}
        </span>
      </div>

      {/* メタ情報 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">診断ID</dt>
            <dd className="mt-1 text-sm text-slate-900 font-mono">{opt.diagnosis_id.slice(0, 8)}…</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">消費クレジット</dt>
            <dd className="mt-1 text-sm text-slate-900">{opt.credits_used} cr</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">作成日</dt>
            <dd className="mt-1 text-sm text-slate-900">{formatDate(opt.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">完了日</dt>
            <dd className="mt-1 text-sm text-slate-900">{opt.completed_at ? formatDate(opt.completed_at) : '—'}</dd>
          </div>
        </dl>
      </div>

      {/* 生成中 */}
      {opt.status === 'running' && (
        <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-200 text-primary-800 rounded-lg">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div>
            <p className="font-medium text-sm">最適化を生成中です</p>
            <p className="text-xs mt-0.5">完了すると自動的に更新されます（約30〜60秒）</p>
          </div>
        </div>
      )}

      {/* エラー */}
      {opt.status === 'failed' && opt.error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <div>
            <p className="font-medium">生成に失敗しました</p>
            <p className="mt-0.5 text-xs font-mono">{opt.error}</p>
          </div>
        </div>
      )}

      {/* 成果物 */}
      {opt.status === 'completed' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">生成済み成果物</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ARTIFACTS.map(({ key, label, filename }) => {
              const value = opt[key];
              if (value === null || value === undefined) return null;
              const count = Array.isArray(value) ? value.length : null;
              const preview = typeof value === 'string' ? value.slice(0, 120) : null;

              return (
                <div key={key} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">{label}</span>
                    {count !== null && (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {count}件
                      </span>
                    )}
                  </div>

                  {preview && (
                    <p className="text-xs text-body line-clamp-3 bg-gray-50 rounded p-2 font-mono leading-relaxed">
                      {preview}{preview.length === 120 ? '…' : ''}
                    </p>
                  )}

                  {key === 'checklist' && Array.isArray(value) && value.length > 0 && (
                    <ul className="space-y-1">
                      {(value as ChecklistItem[]).slice(0, 3).map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-body">
                          <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border border-slate-300 inline-block" />
                          {item.item ?? JSON.stringify(item)}
                        </li>
                      ))}
                      {value.length > 3 && (
                        <li className="text-xs text-body">…他 {value.length - 3} 件</li>
                      )}
                    </ul>
                  )}

                  {key === 'faq_structure' && Array.isArray(value) && value.length > 0 && (
                    <p className="text-xs text-body">FAQ {value.length} 件を含む</p>
                  )}

                  <button
                    onClick={() => downloadArtifact(key as string)}
                    className="mt-auto inline-flex items-center justify-center gap-2 h-8 px-3 text-sm font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    {filename} をダウンロード
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
