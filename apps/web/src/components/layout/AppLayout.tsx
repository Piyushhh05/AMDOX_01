'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '../../store/auth.store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, fetchProfile } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth/login');
    } else {
      fetchProfile();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="ml-[260px] flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-6 page-enter">{children}</main>
      </div>
    </div>
  );
}
