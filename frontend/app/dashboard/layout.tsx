import type { Metadata } from 'next';
import { Sidebar } from '@/components/Sidebar';
import { DashboardMain } from './DashboardMain';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-surface-app">
      <Sidebar />
      <DashboardMain>{children}</DashboardMain>
    </div>
  );
}
