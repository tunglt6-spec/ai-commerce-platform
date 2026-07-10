'use client';

import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth';
import {
  Bell,
  Bot,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  Package,
  Plug,
  ShoppingCart,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/products', label: 'Sản phẩm', icon: Package },
  { href: '/orders', label: 'Đơn hàng', icon: ShoppingCart },
  { href: '/customers', label: 'Khách hàng', icon: Users },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/sales', label: 'Sales & FAQ', icon: MessagesSquare },
  { href: '/workflows', label: 'Tự động hoá', icon: Workflow },
  { href: '/integrations', label: 'Tích hợp', icon: Plug },
  { href: '/ai', label: 'AI Teammate', icon: Bot },
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
      <div className="flex min-h-screen items-center justify-center text-gray-400">Đang tải phiên đăng nhập…</div>
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
    <div className="min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-100 bg-white lg:flex">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white">
            <div className="flex justify-end p-3">
              <button onClick={() => setMobileOpen(false)} aria-label="Đóng menu">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white/80 px-4 backdrop-blur lg:px-8">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Mở menu">
            <Menu className="h-6 w-6 text-gray-600" />
          </button>
          <div className="hidden text-sm text-gray-500 lg:block">Xin chào, quản trị đội ngũ AI của bạn 👋</div>
          <div className="flex items-center gap-3">
            <NotificationsBell />
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800">{user?.email}</p>
              <p className="text-xs capitalize text-gray-400">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              aria-label="Đăng xuất"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1280px] p-4 lg:p-8">{children}</main>
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
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
        aria-label="Thông báo"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-72 rounded-xl border border-gray-100 bg-white p-2 shadow-lg">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase text-gray-400">Thông báo</p>
          {!data || data.notifications.length === 0 ? (
            <p className="px-2 py-3 text-sm text-gray-400">Không có thông báo mới</p>
          ) : (
            data.notifications.map((n) => (
              <div key={n.type} className="rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <span
                  className={
                    n.severity === 'critical'
                      ? 'text-red-600'
                      : n.severity === 'warning'
                        ? 'text-amber-600'
                        : 'text-gray-600'
                  }
                >
                  ●
                </span>{' '}
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
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
          <Bot className="h-5 w-5" />
        </div>
        <span className="text-[15px] font-semibold text-gray-800">AI Commerce</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50',
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 p-4 text-xs text-gray-400">v0.1.0 · MVP</div>
    </>
  );
}
