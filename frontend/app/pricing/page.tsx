import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '料金プラン | LLMO Score',
  description: 'AI認知度診断SaaS「LLMO Score」の料金プラン。Starter・Pro・Enterpriseの3プランから選択。',
};

const plans = [
  {
    name: 'Starter',
    price: 5000,
    yearlyPrice: 54000,
    credits: 100,
    accounts: 1,
    features: ['月100クレジット', '1アカウント', 'AI認知度診断', '簡易レポート', 'メールサポート'],
    cta: '無料で始める',
    highlight: false,
  },
  {
    name: 'Pro',
    price: 15000,
    yearlyPrice: 162000,
    credits: 500,
    accounts: 3,
    features: ['月500クレジット', '3アカウントまで', 'AI認知度診断', '詳細PDFレポート月2回', '優先サポート', 'チーム管理'],
    cta: 'Proを始める',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 50000,
    yearlyPrice: 540000,
    credits: 2000,
    accounts: 10,
    features: ['月2,000クレジット', '10アカウントまで', 'AI認知度診断', '詳細PDFレポート月4回', '専任サポート', 'チーム管理', 'API連携'],
    cta: 'Enterpriseを始める',
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">LLMO Score</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <Link href="/features" className="hover:text-slate-900">機能</Link>
            <Link href="/pricing" className="font-medium text-primary-600">料金</Link>
            <Link href="/blog" className="hover:text-slate-900">ブログ</Link>
            <Link href="/contact" className="hover:text-slate-900">お問い合わせ</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-slate-600 hover:text-slate-900">ログイン</Link>
            <Link href="/auth/signup" className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700">無料で始める</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">シンプルな料金プラン</h1>
          <p className="text-lg text-slate-600">14日間無料トライアル・クレジットカード不要</p>
          <p className="text-sm text-slate-500 mt-2">年払いで<strong className="text-emerald-600">10%割引</strong>適用</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {plans.map((plan) => (
            <div key={plan.name} className={`bg-white rounded-2xl border p-8 flex flex-col ${plan.highlight ? 'border-primary-500 shadow-lg shadow-primary-100 relative' : 'border-slate-200 shadow-sm'}`}>
              {plan.highlight && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-bold px-4 py-1.5 rounded-full">人気No.1</div>}
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h2>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold text-slate-900">¥{plan.price.toLocaleString()}</span>
                  <span className="text-slate-500 mb-1">/月</span>
                </div>
                <p className="text-sm text-slate-500">年払い: ¥{plan.yearlyPrice.toLocaleString()}/年（10%OFF）</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup" className={`inline-flex items-center justify-center h-11 px-6 text-base font-medium rounded-xl transition-colors ${plan.highlight ? 'bg-primary-500 text-white hover:bg-primary-700' : 'bg-slate-900 text-white hover:bg-slate-700'}`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-2">よくある質問</h3>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-3xl mx-auto">
            {[
              { q: 'クレジットとは？', a: '診断1回あたり10クレジット消費します。詳細PDFレポート生成は20クレジットです。' },
              { q: '途中でプラン変更できますか？', a: 'いつでも上位・下位プランに変更できます。変更は次の請求日から適用されます。' },
              { q: '14日間トライアルとは？', a: '初回登録から14日間はすべての機能を無料でお試しいただけます。カード登録も不要です。' },
              { q: '解約はできますか？', a: 'いつでも解約可能です。解約後も当月末まではサービスをご利用いただけます。' },
            ].map(({ q, a }) => (
              <div key={q}>
                <p className="text-sm font-semibold text-slate-900 mb-1">{q}</p>
                <p className="text-sm text-slate-600">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        <p>© 2026 LLMO Score. All rights reserved.</p>
      </footer>
    </div>
  );
}
