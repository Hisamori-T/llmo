'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, getScoreColor, getPlanLabel } from '@/lib/utils';
import type { Diagnosis } from '@/lib/types';

interface DashboardStats {
  totalDiagnoses: number;
  avgScore: number;
  creditsUsed: number;
  creditsLimit: number;
  recentDiagnoses: Diagnosis[];
}

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/users/dashboard').then((res) => setStats(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded-md w-48 animate-pulse" aria-busy="true" role="status" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 h-32 animate-pulse" />)}
        </div>
      </div>
    );
  }

  const creditPct = stats ? Math.min((stats.creditsUsed / stats.creditsLimit) * 100, 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">ダッシュボード</h1>
        <p className="text-sm text-body mt-1">ようこそ、{user?.displayName ?? user?.email} さん — {getPlanLabel(user?.plan ?? 'starter')} プラン</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <p className="text-sm text-body">総診断数</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{stats?.totalDiagnoses ?? 0}</p>
          <Link href="/dashboard/diagnoses" className="text-xs text-primary-500 hover:underline mt-2 inline-block">診断を見る →</Link>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <p className="text-sm text-body">平均AIスコア</p>
          <p className={`text-3xl font-bold mt-1 ${getScoreColor(stats?.avgScore ?? 0)}`}>{stats?.avgScore ?? '--'}</p>
          <p className="text-xs text-body mt-2">/100点満点</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm col-span-1 sm:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-body">クレジット使用量</p>
            <span className="text-sm font-medium text-slate-900">{stats?.creditsUsed ?? 0} / {stats?.creditsLimit ?? 0}</span>
          </div>
          <div className="bg-slate-200 rounded-full h-2" role="progressbar" aria-valuenow={stats?.creditsUsed ?? 0} aria-valuemin={0} aria-valuemax={stats?.creditsLimit ?? 100}>
            <div className={`h-2 rounded-full transition-all ${creditPct > 80 ? 'bg-amber-500' : 'bg-primary-500'}`} style={{ width: `${creditPct}%` }} />
          </div>
          {creditPct > 80 && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg mt-3">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
              <p className="text-xs">クレジット残量が20%を切っています。<Link href="/dashboard/billing" className="font-medium underline">追加購入する</Link></p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Diagnoses */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">最近の診断</h2>
          <Link href="/dashboard/diagnoses" className="text-sm text-primary-500 hover:underline">すべて見る</Link>
        </div>
        {(!stats?.recentDiagnoses?.length) ? (
          <div className="text-base text-slate-500 text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full inline-flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" /></svg>
            </div>
            <p className="font-medium text-slate-900">まだ診断がありません</p>
            <p className="text-sm mt-1">最初の診断を実行してAI認知度を把握しましょう</p>
            <Link href="/dashboard/diagnoses/new" className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer mt-4">
              診断を始める
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-gray-50">
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">企業名</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">AIスコア</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">実行日</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">アクション</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentDiagnoses.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors border-b border-slate-200 last:border-0">
                  <td className="py-3 px-4 text-sm text-slate-900 font-medium">{d.companyName}</td>
                  <td className="py-3 px-4">
                    <span className={`text-sm font-bold ${getScoreColor(d.scores.aiAwareness)}`}>{d.scores.aiAwareness}</span>
                    <span className="text-xs text-body ml-1">/100</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-body">{formatDate(d.createdAt)}</td>
                  <td className="py-3 px-4">
                    <Link href={`/dashboard/diagnoses/${d.id}`} className="text-sm text-primary-500 hover:underline">詳細を見る</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
