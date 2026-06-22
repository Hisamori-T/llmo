import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '機能 | LLMO Score',
  description: 'LLMO ScoreのAI認知度診断・レポート生成・セッション管理などの機能を紹介します。',
};

const features = [
  {
    icon: '🤖',
    title: 'AI認知度診断',
    description: 'ChatGPT・Gemini・ClaudeなどのAIが、あなたの企業をどのように認識・評価しているかを定量スコアで可視化します。',
    details: ['AI認知度スコア（0-100）', 'ブランド認知度分析', 'コンテンツ品質評価', '競合との比較ギャップ'],
  },
  {
    icon: '📊',
    title: '詳細PDFレポート',
    description: '診断結果を12-16ページの詳細PDFレポートとして生成。専門的な分析と具体的な改善策を提供します。',
    details: ['発見事項の詳細説明', '優先度付き改善ロードマップ', '競合他社比較', '共有リンク生成（7日間有効）'],
  },
  {
    icon: '🔐',
    title: 'セキュアなセッション管理',
    description: '同一アカウントは同時に1ブラウザのみという厳格なセッション制御で、情報漏洩リスクを最小化します。',
    details: ['デバイス別・ブラウザ別識別', '複数接続時の警告UI', 'アクティブセッション一覧', '不審なアクセスの即座な無効化'],
  },
  {
    icon: '👥',
    title: 'チーム管理',
    description: '複数メンバーでLLMO対策を推進。役割ベースのアクセス制御でチームの協業をサポートします。',
    details: ['Admin / Editor / Viewer の3役割', 'メール招待による追加', '月間クレジットの共有管理', 'アクティビティログ'],
  },
  {
    icon: '💳',
    title: '柔軟な課金体系',
    description: 'Starter・Pro・Enterpriseの3プランと年払いオプション。成長に合わせてプランを変更できます。',
    details: ['月払い / 年払い（10%割引）', 'クレジット追加購入', 'Stripe決済（安全）', '請求履歴・領収書PDF'],
  },
  {
    icon: '⚡',
    title: 'リアルタイム進捗表示',
    description: '診断の実行状況をリアルタイムで確認。数分でスコアと詳細な発見事項が得られます。',
    details: ['ステータスのリアルタイム更新', '診断履歴の管理', '複数企業の並行診断', '診断結果の比較'],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">LLMO Score</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <Link href="/features" className="font-medium text-primary-600">機能</Link>
            <Link href="/pricing" className="hover:text-slate-900">料金</Link>
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
          <h1 className="text-4xl font-bold text-slate-900 mb-4">AI時代の企業認知を可視化する</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">LLMO Scoreは、ChatGPTやGeminiなどのAI検索エンジンにあなたの企業がどう認識されているかを診断・改善するSaaSです。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h2>
              <p className="text-sm text-slate-600 mb-4">{f.description}</p>
              <ul className="space-y-1.5">
                {f.details.map((d) => (
                  <li key={d} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bg-primary-500 rounded-2xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">AI認知度を今すぐ診断する</h2>
          <p className="text-primary-100 mb-8">14日間無料トライアル・クレジットカード不要</p>
          <Link href="/auth/signup" className="inline-flex items-center justify-center h-12 px-8 text-base font-bold bg-white text-primary-600 rounded-xl hover:bg-primary-50 transition-colors">
            無料で始める →
          </Link>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        <p>© 2026 LLMO Score. All rights reserved.</p>
      </footer>
    </div>
  );
}
