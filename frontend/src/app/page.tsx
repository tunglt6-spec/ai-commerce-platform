'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';

export default function Home() {
  const router = useRouter();
  const { accessToken, hydrated } = useAuth();
  useEffect(() => {
    if (!hydrated) return;
    router.replace(accessToken ? '/dashboard' : '/login');
  }, [hydrated, accessToken, router]);
  return <div className="flex min-h-screen items-center justify-center text-gray-400">Đang chuyển hướng…</div>;
}
