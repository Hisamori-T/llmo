'use client';

import { useAuth } from '@/lib/auth-context';

export function DashboardMain({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          children
        )}
      </div>
    </main>
  );
}
