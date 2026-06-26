import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/auth-context';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LLMO Score — AI認知度診断SaaS',
  description: '企業がAI検索（ChatGPT・Gemini等）にどう認識されているかを診断・可視化。AIに見えている御社のブランドを把握し、LLMO対策を始めましょう。',
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: 'https://llmo-saas.com',
    siteName: 'LLMO Score',
    title: 'LLMO Score — AI認知度診断SaaS',
    description: '企業のAI認知度を診断・可視化するSaaS。月額5,000円から。',
  },
  twitter: { card: 'summary_large_image', title: 'LLMO Score', description: 'AI認知度診断SaaS' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className={notoSansJP.className}>
        <AuthProvider>
          {children}
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </AuthProvider>
      </body>
    </html>
  );
}
