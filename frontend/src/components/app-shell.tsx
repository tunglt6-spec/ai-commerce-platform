'use client';

import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth';
import {
  BarChart3,
  Bell,
  Bot,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  Package,
  ClipboardCheck,
  Plug,
  Rocket,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import { roleAtLeast } from '@/lib/roles';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/onboarding', label: 'Bắt đầu', icon: Rocket },
  { href: '/products', label: 'Sản phẩm', icon: Package },
  { href: '/orders', label: 'Đơn hàng', icon: ShoppingCart },
  { href: '/customers', label: 'Khách hàng', icon: Users },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/sales', label: 'Sales & FAQ', icon: MessagesSquare },
  { href: '/workflows', label: 'Tự động hoá', icon: Workflow },
  { href: '/integrations', label: 'Tích hợp', icon: Plug },
  { href: '/ai', label: 'AI Teammate', icon: Bot },
  { href: '/reports', label: 'Báo cáo', icon: BarChart3, minRole: 'manager' as const },
  { href: '/compliance', label: 'Tuân thủ AI', icon: Scale, minRole: 'manager' as const },
  { href: '/compliance/approvals', label: 'Phê duyệt', icon: ClipboardCheck, minRole: 'manager' as const },
  { href: '/users', label: 'Người dùng', icon: ShieldCheck, minRole: 'manager' as const },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, accessToken, hydrated, clear } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (hydrated && !accessToken) router.replace('/login');
  }, [hydrated, accessToken, router]);

  if (!hydrated || !accessToken) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-ink-50 text-sm text-ink-500">
        Đang mở phiên làm việc
      </div>
    );
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    clear();
    router.replace('/login');
  };

  return (
    <div className="min-h-[100dvh]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-900"
      >
        Bỏ qua điều hướng
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[276px] p-3 lg:block">
        <div className="flex h-full flex-col rounded-[1.75rem] border border-ink-200 bg-white text-ink-900 shadow-panel">
          <SidebarContent pathname={pathname} role={user?.role} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-ink-900/45 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[286px] flex-col p-3">
            <div className="flex h-full flex-col rounded-[1.75rem] border border-ink-200 bg-white text-ink-900 shadow-panel">
              <div className="flex justify-end p-3">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                  aria-label="Đóng menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent pathname={pathname} role={user?.role} onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-[276px]">
        <header className="sticky top-0 z-20 px-3 pt-3 lg:px-6">
          <div className="flex h-16 items-center justify-between rounded-2xl border border-white/70 bg-white/[0.76] px-4 shadow-card backdrop-blur-xl lg:px-5">
            <div className="flex items-center gap-3">
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink-100 bg-white text-ink-700 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Mở menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden lg:block">
                <p className="text-sm font-semibold text-ink-900">Bảng vận hành AI Commerce</p>
                <p className="text-xs text-ink-500">Theo dõi sản phẩm, đơn hàng và đội ngũ AI trong một nơi.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <NotificationsBell />
              <Link
                href="/settings"
                className="group flex items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-ink-100"
                title="Cài đặt"
              >
                <span className="hidden text-right sm:block">
                  <span className="block max-w-[220px] truncate text-sm font-semibold text-ink-900">{user?.email}</span>
                  <span className="block text-xs capitalize text-ink-500">{user?.role}</span>
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-sm font-bold uppercase text-brand-800">
                  {user?.email?.slice(0, 1) ?? 'A'}
                </span>
              </Link>
              <button
                onClick={logout}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 active:translate-y-px"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-[1500px] px-3 py-5 sm:px-5 lg:px-6 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ notifications: any[]; total: number } | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get('/notifications')
      .then((res) => {
        if (active) setData(res.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const total = data?.total ?? 0;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
        aria-label="Thông báo"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-md bg-signal-rose px-1 text-[10px] font-bold text-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-80 rounded-2xl border border-white/70 bg-white p-2 shadow-panel">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Thông báo</p>
          {!data || data.notifications.length === 0 ? (
            <p className="px-3 py-5 text-sm text-ink-500">Không có thông báo mới</p>
          ) : (
            data.notifications.map((n) => (
              <div key={n.type} className="rounded-xl px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
                <span
                  className={cn(
                    'mr-2 inline-block h-2 w-2 rounded-full',
                    n.severity === 'critical'
                      ? 'bg-signal-rose'
                      : n.severity === 'warning'
                        ? 'bg-signal-amber'
                        : 'bg-brand-500',
                  )}
                />
                {n.message}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  pathname,
  role,
  onNavigate,
}: {
  pathname: string;
  role?: string;
  onNavigate?: () => void;
}) {
  const items = NAV.filter((item) => !('minRole' in item) || roleAtLeast(role, (item as any).minRole));
  return (
    <>
      <div className="px-4 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-ai text-white shadow-[0_10px_28px_rgba(124,58,237,.30)]">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-semibold leading-tight text-ink-900">AI Commerce</p>
            <p className="text-xs text-ink-500">Teammate OS</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition duration-200',
                active
                  ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
                  : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl transition',
                  active
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-ink-100 text-ink-500 group-hover:bg-ink-200 group-hover:text-ink-700',
                )}
              >
                <Icon className="h-[17px] w-[17px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {active && <ChevronRight className="h-4 w-4 text-brand-600" aria-hidden />}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-2xl border border-ink-200 bg-ink-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">MVP 0.1.0</p>
        <p className="mt-2 text-xs leading-5 text-ink-600">Ưu tiên bán thật, đo thật, tối ưu bằng AI sau mỗi vòng dữ liệu.</p>
      </div>
    </>
  );
}
