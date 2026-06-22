'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface ReportDetail {
  id: string;
  type: string;
  createdAt: string;
  diagnosisId: string;
  downloadUrl?: string;
}

export default function ReportDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/reports/${id}`).then((res) => setReport(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleDownload = async () => {
    try {
      const res = await apiClient.get(`/reports/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `llmo-report-${id}.pdf`;
      a.click();
    } catch {
      toast.error('ダウンロードに失敗しました');
    }
  };

  const handleShare = async () => {
    try {
      const res = await apiClient.post(`/reports/${id}/share`);
      await navigator.clipboard.writeText(res.data.share_url);
      toast.success('共有リンクをコピーしました');
    } catch {
      toast.error('共有リンクの生成に失敗しました');
    }
  };

  if (loading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 h-24 animate-pulse" />)}</div>;
  }

  if (!report) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
        <p className="text-base font-medium text-slate-900">レポートが見つかりません</p>
        <Link href="/dashboard/reports" className="text-sm text-primary-500 hover:underline mt-2 inline-block">レポート一覧へ戻る</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-sm text-body mb-1">
            <Link href="/dashboard/reports" className="hover:text-slate-900">レポート</Link>
            <span className="mx-2">/</span>
            <span className="font-mono">{id.slice(0, 8)}...</span>
          </nav>
          <h1 className="text-3xl font-bold text-slate-900">レポート詳細</h1>
          <p className="text-sm text-body mt-1">生成日: {formatDate(report.createdAt)}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleShare} className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            共有リンク
          </button>
          <button onClick={handleDownload} className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
            PDFダウンロード
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-body">レポートID</span><p className="font-mono font-medium text-slate-900 mt-1">{report.id}</p></div>
          <div><span className="text-body">種類</span><p className="font-medium text-slate-900 mt-1">{report.type === 'detailed' ? '詳細レポート' : '簡易レポート'}</p></div>
        </div>
        {report.diagnosisId && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <Link href={`/dashboard/diagnoses/${report.diagnosisId}`} className="text-sm text-primary-500 hover:underline">
              対応する診断を見る →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
