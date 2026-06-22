'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { formatDate, formatRelativeTime, getScoreColor } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Client {
  client_id: string;
  name: string;
  url: string;
  industry: string;
  location: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  note: string;
  status: string;
  latest_score: number | null;
  latest_diagnosis_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Diagnosis {
  diagnosis_id: string;
  type: string;
  status: string;
  scores: { overall: number } | null;
  keywords: string[];
  credits_used: number;
  created_at: string;
  completed_at: string | null;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get(`/clients/${id}`),
      apiClient.get(`/diagnoses?client_id=${id}`),
    ])
      .then(([clientRes, diagRes]) => {
        setClient(clientRes.data);
        setDiagnoses(diagRes.data || []);
      })
      .catch(() => router.push('/dashboard/clients'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/clients/${id}`);
      toast.success('クライアントを削除しました');
      router.push('/dashboard/clients');
    } catch {
      toast.error('削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="h-8 bg-slate-200 rounded-md w-48 animate-pulse" />
        <div className="bg-white rounded-xl border border-slate-200 h-48 animate-pulse" />
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/clients" className="text-body hover:text-slate-900">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
            <a href={client.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline">{client.url}</a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/diagnoses/new?client_id=${client.client_id}`}
            className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
            診断を実行
          </Link>
          <Link
            href={`/dashboard/clients/${id}/edit`}
            className="inline-flex items-center gap-2 h-9 px-3 text-sm font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50"
          >
            編集
          </Link>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">基本情報</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-body mb-1">業種</dt>
            <dd className="text-sm font-medium text-slate-900">{client.industry || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-body mb-1">エリア</dt>
            <dd className="text-sm font-medium text-slate-900">{client.location || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-body mb-1">担当者</dt>
            <dd className="text-sm font-medium text-slate-900">{client.contact_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-body mb-1">メール</dt>
            <dd className="text-sm font-medium text-slate-900">
              {client.contact_email ? <a href={`mailto:${client.contact_email}`} className="text-primary-600 hover:underline">{client.contact_email}</a> : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-body mb-1">登録日</dt>
            <dd className="text-sm font-medium text-slate-900">{formatDate(client.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-body mb-1">最新スコア</dt>
            <dd className="text-sm font-medium">
              {client.latest_score != null
                ? <span className={`text-2xl font-bold ${getScoreColor(client.latest_score)}`}>{Math.round(client.latest_score)}</span>
                : <span className="text-slate-400">未診断</span>}
            </dd>
          </div>
        </dl>
        {client.note && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <dt className="text-xs text-body mb-1">メモ</dt>
            <dd className="text-sm text-slate-700 whitespace-pre-wrap">{client.note}</dd>
          </div>
        )}
      </div>

      {/* Diagnoses list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">診断履歴</h2>
          <span className="text-xs text-body">{diagnoses.length}件</span>
        </div>
        {diagnoses.length === 0 ? (
          <div className="text-center py-10 text-sm text-body">診断履歴がありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">種類</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">スコア</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">ステータス</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">実行日</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diagnoses.map((d) => (
                <tr key={d.diagnosis_id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{d.type === 'detailed' ? '詳細診断' : 'シンプル診断'}</td>
                  <td className="px-5 py-3">
                    {d.scores?.overall != null
                      ? <span className={`font-bold text-lg ${getScoreColor(d.scores.overall)}`}>{Math.round(d.scores.overall)}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      d.status === 'running' ? 'bg-blue-100 text-blue-700' :
                      d.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {d.status === 'completed' ? '完了' : d.status === 'running' ? '実行中' : d.status === 'failed' ? '失敗' : d.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-body">{formatRelativeTime(d.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/dashboard/diagnoses/${d.diagnosis_id}`} className="text-xs text-primary-600 hover:text-primary-800 font-medium">
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-red-200 p-5">
        <h2 className="text-sm font-semibold text-red-600 mb-2">このクライアントを削除</h2>
        <p className="text-xs text-body mb-3">削除するとこのクライアントの診断・レポートが参照できなくなります。</p>
        {!deleteConfirm ? (
          <button onClick={() => setDeleteConfirm(true)} className="inline-flex items-center h-8 px-3 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
            削除する
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600 font-medium">本当に削除しますか？</span>
            <button onClick={handleDelete} className="inline-flex items-center h-8 px-3 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-700">
              削除する
            </button>
            <button onClick={() => setDeleteConfirm(false)} className="inline-flex items-center h-8 px-3 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-gray-50">
              キャンセル
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
