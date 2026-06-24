import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '利用規約 | LLMO Score',
  description: 'LLMO Score の利用規約です。',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">利用規約</h1>
        <p className="text-sm text-gray-500 mb-10">最終更新日: 2026年6月24日</p>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-8 text-gray-700 text-sm leading-7">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">第1条（適用）</h2>
            <p>本利用規約（以下「本規約」）は、LLMO Score（以下「本サービス」）の利用条件を定めるものです。登録ユーザーの皆さまは本規約に同意のうえ、本サービスをご利用ください。</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">第2条（利用登録）</h2>
            <p>登録希望者が所定の方法によって利用登録を申請し、当社がこれを承認することによって利用登録が完了します。当社は、以下の場合に利用登録を拒否することがあります。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>虚偽の事項を届け出た場合</li>
              <li>本規約に違反したことがある者からの申請である場合</li>
              <li>その他当社が利用登録を相当でないと判断した場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">第3条（禁止事項）</h2>
            <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>本サービスの運営を妨害するおそれのある行為</li>
              <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
              <li>不正アクセスをし、またはこれを試みる行為</li>
              <li>他のユーザーに成りすます行為</li>
              <li>その他、当社が不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">第4条（本サービスの提供の停止等）</h2>
            <p>当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができます。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>本サービスにかかるコンピュータシステムの保守点検または更新を行う場合</li>
              <li>地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合</li>
              <li>その他、当社が本サービスの提供が困難と判断した場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">第5条（免責事項）</h2>
            <p>当社は、本サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について一切責任を負いません。</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">第6条（規約の変更）</h2>
            <p>当社は必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができます。変更後の利用規約は、本サービス上に掲示した時点から効力を生じるものとします。</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">第7条（準拠法・裁判管轄）</h2>
            <p>本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします。</p>
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
