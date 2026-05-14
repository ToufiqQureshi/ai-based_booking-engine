import { Outlet, Navigate } from 'react-router-dom';
import { ShieldX, Loader2, LogOut, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function DashboardLayout() {
  const { isAuthenticated, isLoading, hotel, logout } = useAuth();

  // Professional loading state
  if (isLoading) {
    return (
      <div className="flex h-screen w-full bg-slate-50 overflow-hidden relative">
        {/* Sidebar skeleton */}
        <div className="hidden w-64 flex-col gap-6 border-r border-slate-200 bg-white p-6 md:flex">
          <Skeleton className="h-8 w-32 bg-slate-100 rounded-lg" />
          <div className="space-y-4 mt-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-slate-50 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="flex flex-1 flex-col relative">
          <div className="h-16 border-b border-slate-200 bg-white flex items-center px-8">
             <Skeleton className="h-6 w-48 bg-slate-100 rounded-lg" />
          </div>
          <div className="flex-1 space-y-8 p-8">
            <div className="space-y-3">
              <Skeleton className="h-10 w-80 bg-slate-100 rounded-lg" />
              <Skeleton className="h-4 w-[500px] bg-slate-50 rounded-lg" />
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 bg-white border border-slate-100 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-[400px] w-full bg-white border border-slate-100 rounded-xl" />
          </div>
        </div>

        <div className="absolute bottom-8 right-8 flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Loading Dashboard...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Deactivated State (Professional)
  if (hotel && hotel.is_active === false) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center relative overflow-hidden">
        <div className="relative z-10 max-w-2xl w-full bg-white p-12 rounded-3xl shadow-xl border border-slate-100">
            <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mb-8 mx-auto">
                <ShieldX className="w-10 h-10 text-amber-500" />
            </div>
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-6">
                <AlertCircle className="w-3 h-3" />
                Account Inactive
            </div>
            
            <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
                Access Restricted
            </h1>
            
            <p className="text-slate-500 max-w-md mb-10 text-base leading-relaxed mx-auto">
                Your StayBooker account is currently inactive. This may be due to pending documentation or subscription renewal.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex gap-2 shadow-lg shadow-blue-200 transition-all">
                    <MessageSquare className="h-4 w-4" />
                    Contact Support
                </Button>
                <Button 
                    variant="ghost" 
                    className="h-12 px-8 rounded-xl text-slate-600 font-bold text-sm flex gap-2"
                    onClick={logout}
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </Button>
            </div>
            
            <p className="mt-12 text-[10px] text-slate-300 font-bold uppercase tracking-widest">StayBooker Management System</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#f8faff] overflow-hidden">
        <AppSidebar />
        
        <SidebarInset className="flex flex-1 flex-col bg-transparent relative z-10 overflow-hidden">
          <AppHeader />
          <main className={cn(
            "flex-1 overflow-y-auto",
            "p-0 sm:p-0"
          )}>
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default DashboardLayout;
