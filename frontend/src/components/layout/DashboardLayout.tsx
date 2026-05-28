import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldX, Loader2, LogOut, MessageSquare, AlertCircle, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Suspense } from 'react';
import { cn } from '@/lib/utils';

const DEFAULT_ROLE_PERMISSIONS = {
  OWNER: [
    "/dashboard", "/analytics", "/agent", "/rooms", "/rates", "/rate-shopper", 
    "/availability", "/bookings", "/guests", "/payments", "/addons", "/amenities",
    "/channel-settings", "/integration", "/settings"
  ],
  MANAGER: [
    "/dashboard", "/analytics", "/rooms", "/rates", "/amenities",
    "/availability", "/bookings", "/guests", "/payments", "/settings"
  ],
  STAFF: [
    "/availability", "/bookings", "/guests"
  ]
};

const getRouteLabel = (path: string) => {
  if (path === '/dashboard') return 'Dashboard';
  if (path === '/availability') return 'Calendar Grid';
  if (path === '/bookings') return 'Bookings';
  if (path === '/guests') return 'Guests';
  if (path === '/rooms') return 'Rooms';
  if (path === '/rates') return 'Rates';
  return 'Operational View';
};

// ── Content-area skeleton (sidebar + header stay fully visible) ──────────────
function ContentSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-5 animate-pulse">
      {/* Page title skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-72 rounded-lg bg-muted dark:bg-slate-800" />
      </div>
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-background dark:bg-slate-800 border border-border dark:border-slate-700" />
        ))}
      </div>
      {/* Main content block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 rounded-xl bg-background dark:bg-slate-800 border border-border dark:border-slate-700" />
        <div className="h-72 rounded-xl bg-background dark:bg-slate-800 border border-border dark:border-slate-700" />
      </div>
    </div>
  );
}

function AccessDeniedView({ userRole, onRedirect, fallbackLabel }: { userRole: string, onRedirect: () => void, fallbackLabel: string }) {
  return (
    <div className="flex-1 p-8 flex items-center justify-center min-h-[70vh]">
      <div className="max-w-md w-full bg-background dark:bg-slate-900 border border-border dark:border-slate-800 rounded-3xl p-8 text-center shadow-xl shadow-slate-100/50 dark:shadow-none animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/30 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-red-100 dark:border-red-900/20 shadow-inner">
          <Lock className="w-8 h-8 text-red-500 dark:text-red-400" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 mb-5 border border-red-100 dark:border-red-900/30">
          Access Restricted
        </div>
        <h2 className="text-xl font-extrabold text-foreground dark:text-white tracking-tight mb-2">Permission Required</h2>
        <p className="text-muted-foreground text-xs leading-relaxed mb-6 font-medium">
          Aapke system profile (<strong className="text-indigo-600 dark:text-indigo-400">{userRole}</strong>) ke paas is section ko view karne ke rights nahi hain. Kripya apne hotel administrator se permission allow karne ke liye contact karein.
        </p>
        <Button 
          className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md shadow-indigo-100 dark:shadow-none"
          onClick={onRedirect}
        >
          Back to {fallbackLabel}
        </Button>
      </div>
    </div>
  );
}

export function DashboardLayout() {
  const { isAuthenticated, isLoading, hotel, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // ── Auth loading: full skeleton (first load only) ────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-screen w-full bg-muted/30 dark:bg-slate-950 overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="hidden w-60 shrink-0 flex-col gap-4 border-r border-border dark:border-slate-800 bg-background dark:bg-slate-900 p-5 md:flex">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <div className="space-y-2 mt-6">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex flex-1 flex-col">
          <div className="h-14 border-b border-border dark:border-slate-800 bg-background dark:bg-slate-900 flex items-center px-6">
            <Skeleton className="h-5 w-40 rounded-lg" />
          </div>
          <ContentSkeleton />
        </div>
        {/* Loading indicator */}
        <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-background dark:bg-slate-800 px-3 py-1.5 rounded-full shadow border border-border dark:border-slate-700">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Loading…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to app subdomain if logged in on root domain
  if (!window.location.hostname.startsWith('app.') && window.location.hostname.includes('staybooker.ai')) {
    window.location.href = `https://app.staybooker.ai${location.pathname}${location.search}`;
    return null;
  }

  // ── Deactivated state ────────────────────────────────────────────────────
  if ((hotel && hotel.is_active === false) || (user && user.is_active === false)) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-muted/30 dark:bg-slate-950 p-6 text-center">
        <div className="max-w-md w-full bg-background dark:bg-slate-900 p-10 rounded-2xl shadow-lg border border-border dark:border-slate-800">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <ShieldX className="w-7 h-7 text-amber-500" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-5">
            <AlertCircle className="w-3 h-3" /> Account Inactive
          </div>
          <h1 className="text-2xl font-bold text-foreground dark:text-white mb-3">Access Restricted</h1>
          <p className="text-muted-foreground dark:text-muted-foreground text-sm leading-relaxed mb-8">
            Your StayBooker account is currently inactive. This may be due to pending documentation or subscription renewal.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm gap-2 shadow-sm">
              <MessageSquare className="h-4 w-4" /> Contact Support
            </Button>
            <Button variant="ghost" className="h-10 px-6 rounded-xl text-muted-foreground font-semibold text-sm gap-2" onClick={logout}>
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isImpersonating = !!localStorage.getItem('superadmin_original_token');

  const handleExitImpersonation = () => {
    const originalToken = localStorage.getItem('superadmin_original_token');
    if (originalToken) {
      localStorage.setItem('token', originalToken);
      localStorage.removeItem('superadmin_original_token');
      window.location.href = '/superadmin';
    }
  };

  // Route path permission checks
  const permissions = (hotel?.settings as any)?.role_permissions?.[user?.role || ''] || 
    (DEFAULT_ROLE_PERMISSIONS as any)[user?.role || 'STAFF'] || [];

  const currentPath = location.pathname;

  const isPathAllowed = () => {
    // Super admins can view all paths
    if (user?.role === 'SUPER_ADMIN') return true;

    // Allow root page redirects and profile page
    if (currentPath === '/' || currentPath === '/settings/profile') return true;

    // Check custom role permissions list
    if (!permissions.includes(currentPath)) return false;

    // Check hotel specific feature locks
    if (currentPath === '/agent' && !hotel?.feature_ai_agent) return false;
    if (currentPath === '/rate-shopper' && !hotel?.feature_rate_shopper) return false;

    return true;
  };

  const allowedPaths = permissions.filter((p: string) => {
    if (p === '/agent' && !hotel?.feature_ai_agent) return false;
    if (p === '/rate-shopper' && !hotel?.feature_rate_shopper) return false;
    return true;
  });
  
  const fallbackPath = allowedPaths[0] || '/availability';
  const allowed = isPathAllowed();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30 dark:bg-slate-950 overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {isImpersonating && (
            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white text-xs font-bold px-6 py-2 flex items-center justify-between border-b border-yellow-700/20 shadow-md relative z-50 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                <span>
                  Impersonating: <strong>{hotel?.name || 'Hotel'}</strong> ({user?.email})
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 bg-white text-amber-700 hover:bg-amber-50 hover:text-amber-800 font-black px-3 rounded-lg shadow-sm border-none transition-all flex items-center"
                onClick={handleExitImpersonation}
              >
                Exit Impersonation
              </Button>
            </div>
          )}
          <AppHeader />
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <Suspense fallback={<ContentSkeleton />}>
              <div className="animate-page-in">
                {allowed ? (
                  <Outlet />
                ) : (
                  <AccessDeniedView 
                    userRole={user?.role || 'STAFF'} 
                    onRedirect={() => navigate(fallbackPath)} 
                    fallbackLabel={getRouteLabel(fallbackPath)} 
                  />
                )}
              </div>
            </Suspense>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default DashboardLayout;




