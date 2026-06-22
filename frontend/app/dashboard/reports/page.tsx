'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Report {
  report_id: string;
  diagnosis_id: string;
  client_id: string;
  type: string;
  status: string;
  share_token: string | null;
  share_url: string | null;
  credits_used: number;
  created_at: string;
}

function ReportsPage() {
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const diagnosisId = searchParams.get('diagnosisId');
    const url = diagnosisId ? `/reports?diagnosis_id=${diagnosisId}` : '/reports';
    apiClient.get(url).then((res) => setReports(res.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [searchParams]);

  const handleDownload = async (reportId: string) => {
    try {
      const res = await apiClient.get(`/reports/${reportId}/download`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `llmo-report-${reportId.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('ダウンロードに失敗しました');
    }
  };

  const handleShare = async (reportId: string) => {
    try {
      const res = await apiClient.post(`/reports/${reportId}/share`);
      await navigator.clipboard.writeText(res.data.share_url);
      toast.success('共有リンクをコピーしました');
    } catch {
      toast.error('共有リンクの生成に失敗しました');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">レポート</h1>
        <p className="text-sm text-body mt-1">診断レポートの閲覧・ダウンロード・共有</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 h-20 animate-pulse" />)}</div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full inline-flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
          </div>
          <p className="text-base font-medium text-slate-900">レポートがありません</p>
          <p className="text-sm text-body mt-1">診断を実行してレポートを生成しましょう</p>
          <Link href="/dashboard/diagnoses/new" className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer mt-4">
            診断を始める
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-gray-50">
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">レポートID</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">種類</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">生成日</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">アクション</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.report_id} className="hover:bg-gray-50 transition-colors border-b border-slate-200 last:border-0">
                  <td className="py-3 px-4 text-body font-mono">{r.report_id.slice(0, 8)}...</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${r.type === 'detailed' ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-700'}`}>
                      {r.type === 'detailed' ? '詳細レポート' : '簡易レポート'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-body">{formatDate(r.created_at)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleDownload(r.report_id)} className="text-primary-500 hover:underline cursor-pointer">PDF DL</button>
                      <button onClick={() => handleShare(r.report_id)} className="text-body hover:text-slate-900 cursor-pointer">共有リンク</button>
                      <Link href={`/dashboard/reports/${r.report_id}`} className="text-primary-500 hover:underline">表示</Link>
                    </div>
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

export default function ReportsPageWrapper() {
  return (
    <Suspense fallback={<div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 h-20 animate-pulse" />)}</div>}>
      <ReportsPage />
    </Suspense>
  );
}
