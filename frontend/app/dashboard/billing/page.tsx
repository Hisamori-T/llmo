'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, getPlanLabel, getPlanColor } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface BackendBillingInfo {
  plan: string;
  billing_cycle: string;
  status: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  invoices: Array<{
    invoice_id: string;
    amount: number;
    currency: string;
    status: string;
    period_start: string | null;
    period_end: string | null;
    pdf_url: string | null;
    created_at: string;
  }>;
}

const PLANS = [
  { id: 'starter', name: 'Starter', monthlyPrice: 15000, yearlyPrice: 162000, clients: 10, credits: 100 },
  { id: 'pro', name: 'Pro', monthlyPrice: 30000, yearlyPrice: 324000, clients: 30, credits: 500 },
  { id: 'enterprise', name: 'Enterprise', monthlyPrice: 80000, yearlyPrice: 864000, clients: 100, credits: 2000 },
];

const CREDIT_PACKS = [
  { credits: 100, price: 3000 },
  { credits: 500, price: 12000 },
  { credits: 1000, price: 20000 },
];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://llmo.fact-ally.com';

export default function BillingPage() {
  const { user } = useAuth();
  const [billing, setBilling] = useState<BackendBillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/billing/info')
      .then((res) => setBilling(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCheckout = async (planId: string, billingCycle: 'monthly' | 'yearly') => {
    const key = `${planId}_${billingCycle}`;
    setActionLoading(key);
    try {
      const res = await apiClient.post('/billing/checkout', {
        plan: planId,
        billing_cycle: billingCycle,
        success_url: `${APP_URL}/dashboard/billing?success=1`,
        cancel_url: `${APP_URL}/dashboard/billing`,
      });
      window.location.href = res.data.checkout_url;
    } catch {
      toast.error('決済ページへの遷移に失敗しました');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBuyCredits = async (credits: number) => {
    setActionLoading(`credits_${credits}`);
    try {
      const res = await apiClient.post('/billing/credits', {
        amount: credits,
        success_url: `${APP_URL}/dashboard/billing?credits=1`,
        cancel_url: `${APP_URL}/dashboard/billing`,
      });
      window.location.href = res.data.checkout_url;
    } catch {
      toast.error('クレジット購入に失敗しました');
    } finally {
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading('portal');
    try {
      const res = await apiClient.post('/billing/portal');
      window.location.href = res.data.portal_url;
    } catch {
      toast.error('請求管理ページへの遷移に失敗しました');
    } finally {
      setActionLoading(null);
    }
  };

  const currentPlan = user?.plan ?? billing?.plan ?? 'starter';
  const creditsRemaining = (user?.monthlyCreditsLimit ?? 0) - (user?.monthlyCreditsUsed ?? 0);

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="h-8 bg-slate-200 rounded-md w-48 animate-pulse" />
        <div className="bg-white rounded-xl border border-slate-200 h-48 animate-pulse" />
        <div className="bg-white rounded-xl border border-slate-200 h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">請求・プラン管理</h1>
        <p className="text-sm text-body mt-1">現在のプランと請求情報を管理します</p>
      </div>

      {/* Current status */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-4">現在の状況</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-body uppercase tracking-wider mb-1">プラン</p>
            <span className={cn('px-2.5 py-1 rounded-full text-sm font-semibold', getPlanColor(currentPlan))}>
              {getPlanLabel(currentPlan)}
            </span>
          </div>
          <div>
            <p className="text-xs text-body uppercase tracking-wider mb-1">ステータス</p>
            <p className="text-sm font-medium text-slate-900">
              {billing?.status === 'active' ? '有効' : billing?.status === 'trial' ? 'トライアル' : billing?.status ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-body uppercase tracking-wider mb-1">支払いサイクル</p>
            <p className="text-sm font-medium text-slate-900">
              {billing?.billing_cycle === 'yearly' ? '年払い（10%割引）' : '月払い'}
            </p>
          </div>
          <div>
            <p className="text-xs text-body uppercase tracking-wider mb-1">次回更新日</p>
            <p className="text-sm font-medium text-slate-900">
              {billing?.current_period_end ? formatDate(billing.current_period_end) : '—'}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-body uppercase tracking-wider mb-1">クレジット残量</p>
            <p className="text-sm font-medium text-slate-900">{creditsRemaining} / {user?.monthlyCreditsLimit ?? 0}</p>
          </div>
          {billing?.stripe_customer_id && (
            <button
              onClick={handleManageBilling}
              disabled={actionLoading === 'portal'}
              className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {actionLoading === 'portal' ? '移動中...' : '支払い方法を管理'}
            </button>
          )}
        </div>
      </div>

      {/* Plan upgrade */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-4">プラン変更</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            return (
              <div key={plan.id} className={`rounded-lg border p-4 ${isCurrent ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-900">{plan.name}</span>
                  {isCurrent && <span className="bg-primary-500 text-white px-2 py-0.5 rounded-full text-xs">現在</span>}
                </div>
                <p className="text-lg font-bold text-slate-900 mb-1">{formatCurrency(plan.monthlyPrice)}<span className="text-xs font-normal text-body">/月</span></p>
                <ul className="text-xs text-body space-y-0.5 mb-4">
                  <li>クライアント最大 {plan.clients}社</li>
                  <li>月次クレジット {plan.credits}cr</li>
                </ul>
                {!isCurrent && (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleCheckout(plan.id, 'monthly')}
                      disabled={!!actionLoading}
                      className="w-full inline-flex items-center justify-center h-8 px-3 text-xs font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {actionLoading === `${plan.id}_monthly` ? '移動中...' : '月払いで変更'}
                    </button>
                    <button
                      onClick={() => handleCheckout(plan.id, 'yearly')}
                      disabled={!!actionLoading}
                      className="w-full inline-flex items-center justify-center h-8 px-3 text-xs font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {actionLoading === `${plan.id}_yearly` ? '移動中...' : `年払い（${formatCurrency(plan.yearlyPrice)}/年）`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Credit add-on */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-2">クレジット追加購入</h2>
        <p className="text-sm text-body mb-4">現在の残クレジット: <strong className="text-slate-900">{creditsRemaining}</strong></p>
        <div className="flex flex-wrap gap-3">
          {CREDIT_PACKS.map((pack) => {
            const key = `credits_${pack.credits}`;
            return (
              <button
                key={pack.credits}
                onClick={() => handleBuyCredits(pack.credits)}
                disabled={!!actionLoading}
                className="inline-flex flex-col items-center justify-center gap-0.5 h-auto px-5 py-3 text-sm font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <span className="font-bold">+{pack.credits.toLocaleString()}cr</span>
                <span className="text-xs text-body">{formatCurrency(pack.price)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Invoice history */}
      {billing && billing.invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">請求履歴</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-gray-50">
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">期間</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">金額</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">ステータス</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">領収書</th>
              </tr>
            </thead>
            <tbody>
              {billing.invoices.map((inv) => (
                <tr key={inv.invoice_id} className="hover:bg-gray-50 transition-colors border-b border-slate-200 last:border-0">
                  <td className="py-3 px-4 text-body">{formatDate(inv.period_start ?? inv.created_at)}</td>
                  <td className="py-3 px-4 font-medium text-slate-900">{formatCurrency(inv.amount / 100)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                      {inv.status === 'paid' ? '支払済' : '未払い'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {inv.pdf_url && <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">PDF</a>}
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
