import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LLMO Score — AI認知度診断SaaS | ChatGPT・Geminiに御社は見えていますか？',
  description: '企業がAI検索（ChatGPT・Gemini等）にどう認識されているかを診断・スコアリング。競合比較・改善提案まで一気通貫。月額5,000円から。',
  alternates: { canonical: 'https://llmo-saas.com' },
};

const plans = [
  {
    name: 'Starter',
    price: '5,000',
    yearlyPrice: '4,500',
    description: '個人事業主・小規模企業向け',
    features: ['1アカウント', '月100クレジット（診断10件）', '簡易レポート無制限', '詳細レポート月1回', 'メールサポート'],
    cta: '無料で始める',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '15,000',
    yearlyPrice: '13,500',
    description: '成長中の中小企業向け',
    features: ['3アカウントまで', '月500クレジット（診断50件）', '簡易レポート無制限', '詳細レポート月5回', 'Phase 3 自動診断 月2回', '24時間メールサポート'],
    cta: 'Proプランで始める',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '50,000',
    yearlyPrice: '45,000',
    description: '大手企業・全社展開向け',
    features: ['10アカウントまで', '月2,000クレジット（診断200件）', '詳細レポート無制限', 'Phase 3 自動診断 月4回', 'API直接利用・Webhook・Slack連携', '専任サポート・SLA保証'],
    cta: 'お問い合わせ',
    highlight: false,
  },
];

export default function LandingPage() {
  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">LLMO Score</Link>
          <nav aria-label="グローバルナビゲーション" className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-sm text-body hover:text-slate-900 transition-colors">機能</Link>
            <Link href="/pricing" className="text-sm text-body hover:text-slate-900 transition-colors">料金</Link>
            <Link href="/blog" className="text-sm text-body hover:text-slate-900 transition-colors">ブログ</Link>
            <Link href="/contact" className="text-sm text-body hover:text-slate-900 transition-colors">お問い合わせ</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              ログイン
            </Link>
            <Link href="/auth/signup" className="inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
              無料で始める
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-8 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200 mb-8">
          🚀 AI検索時代の新しいSEO戦略
        </div>
        <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
          ChatGPT・Geminiに<br className="hidden md:block" />
          <span className="text-primary-500">御社は見えていますか？</span>
        </h1>
        <p className="text-base text-body leading-relaxed max-w-2xl mx-auto mb-10">
          LLMO Scoreは、企業がAI検索エンジンにどう認識されているかを診断・スコアリングするSaaS。
          競合比較・改善提案まで一気通貫で提供し、LLMO（LLM Optimization）対策を加速します。
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/auth/signup" className="inline-flex items-center justify-center gap-2 h-12 px-8 text-[1rem] font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
            無料で診断を始める →
          </Link>
          <Link href="/features" className="inline-flex items-center justify-center gap-2 h-12 px-6 text-[1rem] font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            機能を見る
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">クレジットカード不要・14日間無料トライアル</p>
      </section>

      {/* Score preview */}
      <section className="max-w-7xl mx-auto px-8 pb-24">
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-medium text-slate-900">診断スコア例：株式会社サンプル</h3>
            <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium border border-emerald-200">診断完了</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            {[
              { label: 'AI認知度', score: 72 },
              { label: 'ブランド認識', score: 58 },
              { label: 'コンテンツ品質', score: 85 },
              { label: '競合差分', score: 43 },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className={`text-4xl font-bold mb-1 ${item.score >= 80 ? 'text-emerald-600' : item.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                  {item.score}
                </div>
                <div className="text-sm text-body">{item.label}</div>
                <div className="mt-2 bg-slate-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${item.score >= 80 ? 'bg-emerald-500' : item.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${item.score}%` }} role="progressbar" aria-valuenow={item.score} aria-valuemin={0} aria-valuemax={100} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-t border-slate-200 py-24">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">なぜLLMO Scoreが必要か</h2>
          <p className="text-base text-body text-center max-w-xl mx-auto mb-14">AI検索が普及した今、Googleだけでなくを AI にも「見える」企業になることが競争優位に直結します。</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '🔍', title: 'AI検索での認知度を数値化', desc: 'ChatGPT・Gemini・Perplexityなど主要AIに御社がどれだけ認識されているか、スコア100点満点で可視化します。' },
              { icon: '📊', title: '競合比較・ギャップ分析', desc: '同業他社との比較でどの領域が弱いかを明示。優先度の高い改善ポイントをAIが自動提案します。' },
              { icon: '📄', title: '詳細PDFレポート自動生成', desc: '診断結果を経営陣・クライアントに共有できるプロフェッショナルなPDFレポートを即時生成。' },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-body leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">料金プラン</h2>
          <p className="text-base text-body text-center mb-14">年払いで10%割引。すべてのプランで14日間無料トライアル。</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.name} className={`bg-white rounded-xl border p-8 shadow-sm flex flex-col ${plan.highlight ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-slate-200'}`}>
                {plan.highlight && (
                  <div className="mb-4">
                    <span className="bg-primary-500 text-white px-3 py-1 rounded-full text-xs font-medium">人気No.1</span>
                  </div>
                )}
                <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-body mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">¥{plan.price}</span>
                  <span className="text-sm text-body">/月</span>
                  <div className="text-xs text-slate-500 mt-1">年払い ¥{plan.yearlyPrice}/月（10%割引）</div>
                </div>
                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-body">
                      <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.name === 'Enterprise' ? '/contact' : '/auth/signup'} className={`inline-flex items-center justify-center h-10 px-4 text-[1rem] font-medium rounded-lg cursor-pointer ${plan.highlight ? 'bg-primary-500 text-white hover:bg-primary-700' : 'bg-white text-slate-700 border border-slate-200 hover:bg-gray-50'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary-500 py-20">
        <div className="max-w-7xl mx-auto px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">今すぐAI認知度を診断する</h2>
          <p className="text-base text-primary-100 mb-8">クレジットカード不要。14日間無料で全機能をお試しいただけます。</p>
          <Link href="/auth/signup" className="inline-flex items-center justify-center gap-2 h-12 px-8 text-[1rem] font-medium bg-white text-primary-600 rounded-lg hover:bg-primary-50 cursor-pointer">
            無料トライアルを始める →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm">© 2026 LLMO Score. All rights reserved.</p>
          <nav aria-label="フッターナビゲーション" className="flex gap-6 text-sm">
            <Link href="/privacy" className="hover:text-white transition-colors">プライバシーポリシー</Link>
            <Link href="/terms" className="hover:text-white transition-colors">利用規約</Link>
            <Link href="/contact" className="hover:text-white transition-colors">お問い合わせ</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
