'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { ScoreBadge } from '@/components/ui/ScoreBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';

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

const FILTERS = ['all', 'completed', 'running'] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABELS: Record<Filter, string> = {
  all: 'すべて',
  completed: '完了',
  running: '実行中',
};

export default function DiagnosesPage() {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    apiClient
      .get('/diagnoses')
      .then((res) => setDiagnoses(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = diagnoses.filter((d) => filter === 'all' || d.status === filter);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-ink-900 tracking-[.01em] m-0">診断管理</h1>
          <p className="text-[13px] text-ink-500 mt-[5px] mb-0">企業のAI認知度を診断・管理します</p>
        </div>
        <Link
          href="/dashboard/diagnoses/new"
          className="inline-flex items-center justify-center gap-1.5 h-10 px-[18px] bg-primary-600 text-white rounded text-[14px] font-semibold hover:bg-primary-700 transition-colors no-underline flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[18px] leading-none">add</span>
          新規診断
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mt-[18px]">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-selected={filter === f}
            className={
              filter === f
                ? 'h-[34px] px-[16px] bg-primary-600 text-white border-none rounded text-[13px] font-semibold cursor-pointer transition-colors'
                : 'h-[34px] px-[16px] bg-[#FDFBF5] text-ink-600 border border-[#D9CFBC] rounded text-[13px] font-semibold cursor-pointer hover:bg-surface-hover transition-colors'
            }
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[#FDFBF5] rounded-lg border border-border h-20 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-16 text-center">
            <p className="text-[15px] font-medium text-ink-800 mb-4">診断がありません</p>
            <Link
              href="/dashboard/diagnoses/new"
              className="inline-flex items-center justify-center gap-1.5 h-10 px-[18px] bg-primary-600 text-white rounded text-[14px] font-semibold hover:bg-primary-700 transition-colors no-underline"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">add</span>
              最初の診断を実行する
            </Link>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <Thead>
                <Tr>
                  <Th>URL</Th>
                  <Th>種類</Th>
                  <Th>AIスコア</Th>
                  <Th>ステータス</Th>
                  <Th>実行日</Th>
                  <Th className="text-right">アクション</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filtered.map((d) => {
                  const score = d.scores?.ai_awareness;
                  return (
                    <Tr key={d.diagnosis_id} className="hover:bg-surface-hover transition-colors">
                      <Td className="max-w-[200px] truncate">{d.url}</Td>
                      <Td className="text-[13.5px] font-normal text-ink-600">
                        {d.type === 'detailed' ? '詳細診断' : 'シンプル診断'}
                      </Td>
                      <Td>
                        {d.status === 'completed' && score != null && !isNaN(score) ? (
                          <ScoreBadge score={score} />
                        ) : (
                          <span className="text-[14px] text-ink-400">—</span>
                        )}
                      </Td>
                      <Td>
                        <StatusBadge status={d.status} />
                      </Td>
                      <Td className="text-[13.5px] font-normal text-ink-500 tabular-nums">
                        {formatDate(d.created_at)}
                      </Td>
                      <Td className="text-right whitespace-nowrap">
                        <Link
                          href={`/dashboard/diagnoses/${d.diagnosis_id}`}
                          className="text-[13px] font-semibold text-primary-600 no-underline hover:underline mr-[14px]"
                        >
                          詳細
                        </Link>
                        {d.status === 'completed' && (
                          <Link
                            href={`/dashboard/reports?diagnosisId=${d.diagnosis_id}`}
                            className="text-[13px] font-semibold text-primary-600 no-underline hover:underline"
                          >
                            レポート
                          </Link>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
