// Main Dashboard Layout - wraps all authenticated pages
import { Outlet, Navigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, BedDouble, Users, Settings, LogOut, Menu, X, Receipt, Link2, ShieldX } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading skeleton while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen w-full">
        {/* Sidebar skeleton */}
        <div className="hidden w-64 flex-col gap-4 border-r bg-sidebar p-4 md:flex">
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        {/* Main content skeleton */}
        <div className="flex flex-1 flex-col">
          <Skeleton className="h-16 w-full" />
          <div className="flex-1 space-y-4 p-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  const { user } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (hotel && hotel.is_active === false) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-24 h-24 bg-red-100 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-red-100 rotate-12">
          <ShieldX className="w-12 h-12 text-red-600" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Account Deactivated</h1>
        <p className="text-slate-500 max-w-lg mb-8 text-lg font-medium leading-relaxed">
          Your access to the Staybooker platform has been suspended. This could be due to an expired subscription or a violation of terms.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button className="bg-slate-900 hover:bg-slate-800 px-8 py-6 text-lg font-bold rounded-2xl shadow-lg">
            Contact Billing
          </Button>
          <Button variant="outline" className="px-8 py-6 text-lg font-bold rounded-2xl bg-white border-slate-200" onClick={logout}>
            Logout
          </Button>
        </div>
        <p className="mt-12 text-sm text-slate-400 font-bold uppercase tracking-widest">Staybooker Master Control</p>
      </div>
    );
  }



  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default DashboardLayout;
