import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ブログ | LLMO Score',
  description: 'AI検索最適化（LLMO）・中小企業のAI対策に関するノウハウを発信します。',
};

const posts = [
  {
    slug: 'what-is-llmo',
    title: 'LLMOとは？AI検索時代の新しいSEO戦略',
    excerpt: 'ChatGPTやGeminiなどのAIが検索の主流になりつつある今、企業は「AIにどう認識されるか」を意識する必要があります。LLMOの基本概念と重要性を解説します。',
    date: '2026-06-15',
    category: 'LLMO基礎',
    readTime: '5分',
  },
  {
    slug: 'ai-search-impact-sme',
    title: '中小企業こそAI検索対策が急務な理由',
    excerpt: '大企業に比べてオンラインプレゼンスが薄い中小企業は、AI検索での認知度が極めて低い傾向があります。具体的なデータとともに、その影響と対策を紹介します。',
    date: '2026-06-10',
    category: '中小企業向け',
    readTime: '7分',
  },
  {
    slug: 'improve-ai-awareness',
    title: 'AIスコアを上げる5つの施策',
    excerpt: 'LLMO Scoreで診断した後、どのように改善すればよいか。Googleビジネスプロフィール、SNS活用、コンテンツ戦略など、すぐに実践できる5つの施策を紹介します。',
    date: '2026-06-05',
    category: '改善施策',
    readTime: '8分',
  },
  {
    slug: 'gemini-chatgpt-difference',
    title: 'GeminiとChatGPTで企業の認識はどう違う？',
    excerpt: '同じ企業でも、AIモデルによって評価が大きく異なる場合があります。各AIの特性と、それに合わせた情報発信の方法について解説します。',
    date: '2026-05-28',
    category: 'AI分析',
    readTime: '6分',
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">LLMO Score</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <Link href="/features" className="hover:text-slate-900">機能</Link>
            <Link href="/pricing" className="hover:text-slate-900">料金</Link>
            <Link href="/blog" className="font-medium text-primary-600">ブログ</Link>
            <Link href="/contact" className="hover:text-slate-900">お問い合わせ</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-slate-600 hover:text-slate-900">ログイン</Link>
            <Link href="/auth/signup" className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700">無料で始める</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">LLMOブログ</h1>
          <p className="text-lg text-slate-600">AI検索時代の企業認知・LLMO対策に関するノウハウを発信します。</p>
        </div>

        <div className="space-y-6">
          {posts.map((post) => (
            <article key={post.slug} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-primary-50 text-primary-600 text-xs font-medium px-2.5 py-1 rounded-full">{post.category}</span>
                <span className="text-xs text-slate-400">{post.date}</span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-400">読了 {post.readTime}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2 hover:text-primary-600 transition-colors">
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">{post.excerpt}</p>
              <Link href={`/blog/${post.slug}`} className="text-sm font-medium text-primary-500 hover:underline">
                続きを読む →
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-12 bg-primary-50 border border-primary-100 rounded-2xl p-8 text-center">
          <h3 className="text-lg font-bold text-slate-900 mb-2">AI認知度を無料で診断する</h3>
          <p className="text-sm text-slate-600 mb-4">14日間トライアル・カード不要</p>
          <Link href="/auth/signup" className="inline-flex items-center justify-center h-10 px-6 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-700">
            無料で始める
          </Link>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        <p>© 2026 LLMO Score. All rights reserved.</p>
      </footer>
    </div>
  );
}
