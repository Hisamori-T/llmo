import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'プライバシーポリシー | LLMO Score',
  description: 'LLMO Score のプライバシーポリシーです。',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">プライバシーポリシー</h1>
        <p className="text-sm text-gray-500 mb-10">最終更新日: 2026年6月24日</p>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-8 text-gray-700 text-sm leading-7">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. 収集する情報</h2>
            <p>本サービスでは、以下の情報を収集します。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>メールアドレス・氏名・会社名（登録時）</li>
              <li>ご利用の診断対象URL・キーワード</li>
              <li>ブラウザ・OS情報・IPアドレス（セッション管理目的）</li>
              <li>本サービスの利用履歴</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. 情報の利用目的</h2>
            <p>収集した情報は以下の目的で利用します。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>本サービスの提供・運営のため</li>
              <li>ユーザーからのお問い合わせに回答するため</li>
              <li>不正アクセス・不正利用の防止のため</li>
              <li>本サービスの改善・新機能開発のため</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. 第三者への提供</h2>
            <p>当社は、以下の場合を除き、ユーザーの個人情報を第三者に開示・提供しません。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>ユーザーの同意がある場合</li>
              <li>法令に基づく場合</li>
              <li>人の生命、身体または財産の保護のために必要がある場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. 利用するサービス</h2>
            <p>本サービスでは以下の外部サービスを利用します。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Stripe</strong>: 決済処理（クレジットカード情報は当社サーバーに保存しません）</li>
              <li><strong>OpenAI / Google Gemini</strong>: AI分析エンジン（診断対象URL・キーワードを送信します）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Cookieの使用</h2>
            <p>本サービスはセッション管理のためにhttpOnly Cookieを使用します。これはセキュリティ上必要なものであり、拒否すると本サービスをご利用いただけません。</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. 個人情報の開示・訂正・削除</h2>
            <p>ご自身の個人情報の開示・訂正・削除をご希望の場合は、お問い合わせフォームよりご連絡ください。本人確認のうえ、合理的な期間内に対応いたします。</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. セキュリティ</h2>
            <p>当社は、個人情報の紛失・破壊・改ざん・漏洩等を防止するため、適切なセキュリティ対策を講じています。パスワードはbcryptによりハッシュ化して保存し、通信はTLS/SSLで暗号化されます。</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. プライバシーポリシーの変更</h2>
            <p>本ポリシーは必要に応じて変更することがあります。変更後のポリシーは本ページに掲示した時点から効力を生じます。</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. お問い合わせ</h2>
            <p>個人情報の取り扱いに関するお問い合わせは、<Link href="/contact" className="text-indigo-600 hover:underline">お問い合わせページ</Link>よりご連絡ください。</p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <Link href="/auth/signup" className="text-indigo-600 hover:underline text-sm">
            ← 新規登録に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
