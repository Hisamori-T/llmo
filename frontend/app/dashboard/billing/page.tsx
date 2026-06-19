'use client';

import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, getPlanLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { BillingInfo } from '@/lib/types';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const PLANS = [
  { id: 'starter', name: 'Starter', price: 5000, description: '月額 ¥5,000' },
  { id: 'pro', name: 'Pro', price: 15000, description: '月額 ¥15,000' },
  { id: 'enterprise', name: 'Enterprise', price: 50000, description: '月額 ¥50,000' },
];

const CREDIT_PACKS = [
  { credits: 100, label: '+100クレジット' },
  { credits: 500, label: '+500クレジット' },
  { credits: 1000, label: '+1,000クレジット' },
];

export default function BillingPage() {
  const { user } = useAuth();
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/billing/info').then((res) => setBillingInfo(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCheckout = async (planId: string, billingCycle: 'monthly' | 'yearly' = 'monthly') => {
    setCheckoutLoading(planId);
    try {
      const res = await apiClient.post('/billing/checkout', { plan_id: planId, billing_cycle: billingCycle });
      window.location.href = res.data.checkout_url;
    } catch {
      toast.error('決済ページへの遷移に失敗しました');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleBuyCredits = async (credits: number) => {
    setCheckoutLoading(`credits_${credits}`);
    try {
      const res = await apiClient.post('/billing/credits', { credits });
      window.location.href = res.data.checkout_url;
    } catch {
      toast.error('クレジット購入に失敗しました');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      const res = await apiClient.post('/billing/portal');
      window.location.href = res.data.url;
    } catch {
      toast.error('請求管理ページへの遷移に失敗しました');
    }
  };

  if (loading) return <div className="space-y-6"><div className="h-8 bg-slate-200 rounded-md w-48 animate-pulse" /><div className="bg-white rounded-xl border border-slate-200 h-48 animate-pulse" /></div>;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">請求・プラン管理</h1>
        <p className="text-sm text-body mt-1">現在のプランと請求情報を管理します</p>
      </div>

      {/* Current plan */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-4">現在のプラン</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-xs text-body uppercase tracking-wider mb-1">プラン</p>
            <p className="text-xl font-bold text-slate-900">{getPlanLabel(user?.plan ?? 'starter')}</p>
          </div>
          <div>
            <p className="text-xs text-body uppercase tracking-wider mb-1">月額</p>
            <p className="text-xl font-bold text-slate-900">{billingInfo ? formatCurrency(billingInfo.monthlyAmount) : '--'}</p>
          </div>
          <div>
            <p className="text-xs text-body uppercase tracking-wider mb-1">次回請求日</p>
            <p className="text-sm font-medium text-slate-900">{billingInfo ? formatDate(billingInfo.nextBillingDate) : '--'}</p>
          </div>
          <div>
            <p className="text-xs text-body uppercase tracking-wider mb-1">支払いサイクル</p>
            <p className="text-sm font-medium text-slate-900">{billingInfo?.billingCycle === 'yearly' ? '年払い（10%割引）' : '月払い'}</p>
          </div>
        </div>

        {billingInfo && (
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">今月の内訳</div>
            <div className="divide-y divide-slate-200">
              <div className="flex items-center justify-between px-4 py-2.5 text-sm"><span className="text-body">基本プラン（{getPlanLabel(billingInfo.planId)}）</span><span className="font-medium text-slate-900">{formatCurrency(billingInfo.breakdown.basePlan)}</span></div>
              {billingInfo.breakdown.additionalAccounts > 0 && <div className="flex items-center justify-between px-4 py-2.5 text-sm"><span className="text-body">追加アカウント</span><span className="font-medium text-slate-900">{formatCurrency(billingInfo.breakdown.additionalAccounts)}</span></div>}
              {billingInfo.breakdown.extraCredits > 0 && <div className="flex items-center justify-between px-4 py-2.5 text-sm"><span className="text-body">追加クレジット</span><span className="font-medium text-slate-900">{formatCurrency(billingInfo.breakdown.extraCredits)}</span></div>}
              {billingInfo.breakdown.phase3Runs > 0 && <div className="flex items-center justify-between px-4 py-2.5 text-sm"><span className="text-body">Phase 3 追加実行</span><span className="font-medium text-slate-900">{formatCurrency(billingInfo.breakdown.phase3Runs)}</span></div>}
              {billingInfo.breakdown.discount > 0 && <div className="flex items-center justify-between px-4 py-2.5 text-sm text-emerald-700"><span>年払い割引（10%）</span><span className="font-medium">-{formatCurrency(billingInfo.breakdown.discount)}</span></div>}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 font-semibold text-sm"><span className="text-slate-900">次回請求予定額</span><span className="text-slate-900">{formatCurrency(billingInfo.monthlyAmount)}</span></div>
            </div>
          </div>
        )}

        <button onClick={handleManageBilling} className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer">
          支払い方法を管理する
        </button>
      </div>

      {/* Plan upgrade */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-4">プラン変更</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = user?.plan === plan.id;
            return (
              <div key={plan.id} className={`rounded-lg border p-4 ${isCurrent ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-900">{plan.name}</span>
                  {isCurrent && <span className="bg-primary-500 text-white px-2 py-0.5 rounded-full text-xs">現在のプラン</span>}
                </div>
                <p className="text-sm text-body mb-4">{plan.description}</p>
                {!isCurrent && (
                  <div className="space-y-2">
                    <button onClick={() => handleCheckout(plan.id, 'monthly')} disabled={checkoutLoading === plan.id} className="w-full inline-flex items-center justify-center h-8 px-3 text-[0.875rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer disabled:opacity-50">
                      月払いで変更
                    </button>
                    <button onClick={() => handleCheckout(plan.id, 'yearly')} disabled={checkoutLoading === plan.id} className="w-full inline-flex items-center justify-center h-8 px-3 text-[0.875rem] font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer disabled:opacity-50">
                      年払いで変更（10%OFF）
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
        <p className="text-sm text-body mb-4">現在の残クレジット: <strong className="text-slate-900">{(user?.monthlyCreditsLimit ?? 0) - (user?.monthlyCreditsUsed ?? 0)}</strong></p>
        <div className="flex flex-wrap gap-3">
          {CREDIT_PACKS.map((pack) => (
            <button key={pack.credits} onClick={() => handleBuyCredits(pack.credits)} disabled={checkoutLoading === `credits_${pack.credits}`} className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[1rem] font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer disabled:opacity-50">
              {pack.label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice history */}
      {billingInfo?.invoices && billingInfo.invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">請求履歴</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-gray-50">
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">日付</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">金額</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">ステータス</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">領収書</th>
              </tr>
            </thead>
            <tbody>
              {billingInfo.invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors border-b border-slate-200 last:border-0">
                  <td className="py-3 px-4 text-sm text-body">{formatDate(inv.date)}</td>
                  <td className="py-3 px-4 text-sm text-slate-900 font-medium">{formatCurrency(inv.amount)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                      {inv.status === 'paid' ? '支払済' : '未払い'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {inv.pdfUrl && <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-500 hover:underline">PDF</a>}
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
