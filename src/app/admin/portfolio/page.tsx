'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { PortfolioBoard } from '@/components/portfolio/PortfolioBoard';
import portfolioData from '@/data/portfolio.json';
import type { PortfolioData } from '@/lib/portfolio';

function PortfolioAdminContent() {
  const { isAdmin, loading } = useAuth();
  const searchParams = useSearchParams();

  if (loading) return null;
  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', padding: 60, textAlign: 'center', background: '#0c0f14', color: '#acacaf' }}>
        <p>Admin access required.</p>
        <Link href="/login" style={{ color: '#5cb8ff' }}>Sign in</Link>
      </div>
    );
  }

  return <PortfolioBoard data={portfolioData as PortfolioData} initialProjectId={searchParams.get('project')} />;
}

export default function PortfolioAdminPage() {
  return (
    <Suspense fallback={null}>
      <PortfolioAdminContent />
    </Suspense>
  );
}
