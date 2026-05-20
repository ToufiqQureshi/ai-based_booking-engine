import { Outlet, Navigate } from 'react-router-dom';
import { ShieldX, Loader2, LogOut, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Suspense } from 'react';
import { cn } from '@/lib/utils';

// ── Content-area skeleton (sidebar + header stay fully visible) ──────────────
function ContentSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-5 animate-pulse">
      {/* Page title skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-72 rounded-lg bg-slate-100 dark:bg-slate-800" />
      </div>
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
        ))}
      </div>
      {/* Main content block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
        <div className="h-72 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
      </div>
    </div>
  );
}

export function DashboardLayout() {
  const { isAuthenticated, isLoading, hotel, user, logout } = useAuth();

  // ── Auth loading: full skeleton (first load only) ────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="hidden w-60 shrink-0 flex-col gap-4 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:flex">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <div className="space-y-2 mt-6">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex flex-1 flex-col">
          <div className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center px-6">
            <Skeleton className="h-5 w-40 rounded-lg" />
          </div>
          <ContentSkeleton />
        </div>
        {/* Loading indicator */}
        <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full shadow border border-slate-200 dark:border-slate-700">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Loading…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ── Deactivated state ────────────────────────────────────────────────────
  if ((hotel && hotel.is_active === false) || (user && user.is_active === false)) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 p-10 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <ShieldX className="w-7 h-7 text-amber-500" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-5">
            <AlertCircle className="w-3 h-3" /> Account Inactive
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Access Restricted</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
            Your StayBooker account is currently inactive. This may be due to pending documentation or subscription renewal.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm gap-2 shadow-sm">
              <MessageSquare className="h-4 w-4" /> Contact Support
            </Button>
            <Button variant="ghost" className="h-10 px-6 rounded-xl text-slate-500 font-semibold text-sm gap-2" onClick={logout}>
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <AppHeader />
          {/*
            ── KEY PERFORMANCE FIX ──────────────────────────────────────────
            Inner Suspense wraps ONLY the page content (Outlet).
            Sidebar + AppHeader stay fully rendered on every navigation.
            Page transitions show a content skeleton instead of a white flash.
            ────────────────────────────────────────────────────────────────
          */}
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <Suspense fallback={<ContentSkeleton />}>
              <div className="animate-page-in">
                <Outlet />
              </div>
            </Suspense>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default DashboardLayout;




