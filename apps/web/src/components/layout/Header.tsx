'use client';
import { Bell, Search, Menu } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import api from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import Link from 'next/link';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/finance': 'Finance',
  '/hr': 'HR & Payroll',
  '/supply-chain': 'Supply Chain',
  '/forecasting': 'AI Forecasting',
  '/notifications': 'Notifications',
  '/audit': 'Audit Logs',
};

export function Header() {
  const { user } = useAuthStore();
  const pathname = usePathname();

  const title = Object.entries(pageTitles).find(([path]) =>
    pathname === path || pathname.startsWith(path + '/')
  )?.[1] || 'Amdox ERP';

  const { data: unread } = useQuery({
    queryKey: ['notifications-count', user?.id],
    queryFn: () => api.get('/api/v1/notifications/unread-count'),
    enabled: !!user?.id,
    refetchInterval: 30_000,
    retry: false,
  });

  const count = (unread as any)?.count || 0;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
          />
        </div>

        {/* Notification Bell */}
        <Link
          href="/notifications"
          className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
          title="Notifications"
        >
          <Bell className="w-5 h-5 text-slate-600" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Link>

        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold cursor-pointer select-none"
          title={`${user?.firstName} ${user?.lastName} · ${user?.role}`}
        >
          {user?.firstName?.[0] ?? '?'}{user?.lastName?.[0] ?? ''}
        </div>
      </div>
    </header>
  );
}
