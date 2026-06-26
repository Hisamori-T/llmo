'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn, getPlanLabel } from '@/lib/utils';

const navItems = [
  { href: '/dashboard',              label: 'ホーム',       icon: 'home'         },
  { href: '/dashboard/clients',      label: 'クライアント', icon: 'group'        },
  { href: '/dashboard/diagnoses',    label: '診断',         icon: 'science'      },
  { href: '/dashboard/optimizations',label: '実装最適化',   icon: 'bolt'         },
  { href: '/dashboard/automation',   label: '自動化',       icon: 'schedule'     },
  { href: '/dashboard/contents',     label: 'コンテンツ',   icon: 'description'  },
  { href: '/dashboard/reports',      label: 'レポート',     icon: 'assessment'   },
  { href: '/dashboard/billing',      label: '請求',         icon: 'receipt_long' },
  { href: '/dashboard/settings',     label: '設定',         icon: 'settings'     },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <aside className="w-60 bg-[#FDFBF5] border-r border-border flex-shrink-0 flex flex-col h-screen">

      {/* ロゴ */}
      <div className="h-16 flex items-center px-5 border-b border-border-divider flex-none">
        <div className="flex items-center gap-[10px]">
          <div className="w-[27px] h-[27px] bg-primary-600 rounded flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[18px] leading-none text-white">monitoring</span>
          </div>
          <span className="text-[16px] font-bold text-ink-900 tracking-[.01em]">LLMO Score</span>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav aria-label="メインナビゲーション" className="px-3 pt-3 pb-1.5 flex flex-col gap-0.5 overflow-y-auto flex-1">
        {navItems.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-[11px] h-[38px] px-3 rounded transition-colors no-underline',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'hover:bg-surface-hover'
              )}
            >
              <span
                className={cn(
                  'material-symbols-outlined text-[20px] leading-none flex-shrink-0',
                  isActive ? 'text-primary-600' : 'text-ink-400'
                )}
              >
                {item.icon}
              </span>
              <span
                className={cn(
                  'text-[13.5px]',
                  isActive ? 'font-semibold text-primary-700' : 'font-medium text-ink-600'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* クレジット残量 — ロジック無改変、表示層のみSSOT準拠 */}
      {user && (
        <div className="mx-3 mb-0 px-[14px] py-3 border border-border rounded bg-surface-subtle flex-none">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[12px] font-semibold text-ink-600">クレジット残量</span>
            <span className="text-[12px] font-bold text-ink-900 tabular-nums">
              {user.creditsRemaining}/{user.monthlyCreditsLimit}
            </span>
          </div>
          <div className="h-[6px] bg-[#E5DDCE] rounded-[3px] overflow-hidden">
            {(() => {
              const ratio = user.monthlyCreditsLimit > 0
                ? user.creditsRemaining / user.monthlyCreditsLimit
                : 0;
              const barColor =
                ratio <= 0.2 ? 'bg-danger' :
                ratio <= 0.5 ? 'bg-warning' :
                'bg-primary-600';
              return (
                <div
                  className={cn('h-full rounded-[3px] transition-all', barColor)}
                  style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                  role="progressbar"
                  aria-valuenow={user.creditsRemaining}
                  aria-valuemin={0}
                  aria-valuemax={user.monthlyCreditsLimit}
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* ユーザー・ログアウト */}
      <div className="px-[14px] py-3 border-t border-border-divider flex flex-col gap-[10px] flex-none">
        {user && (
          <div className="flex items-center gap-[10px]">
            <div
              className="w-8 h-8 rounded bg-primary-50 flex items-center justify-center text-[13px] font-bold text-primary-600 flex-shrink-0"
              role="img"
              aria-label={user.email}
            >
              {(user.displayName?.[0] ?? user.email[0]).toUpperCase()}
            </div>
            <div className="flex flex-col gap-px min-w-0">
              <span className="text-[13px] font-semibold text-ink-800 truncate">
                {user.displayName ?? user.email}
              </span>
              <span className="text-[11px] font-medium text-ink-400">
                {getPlanLabel(user.plan)}
              </span>
            </div>
          </div>
        )}
        {!loading && (
          <button
            onClick={handleLogout}
            className="w-full h-[34px] border border-border-strong bg-[#FDFBF5] rounded text-[12.5px] font-semibold text-ink-600 cursor-pointer hover:bg-surface-hover transition-colors"
          >
            ログアウト
          </button>
        )}
      </div>
    </aside>
  );
}
