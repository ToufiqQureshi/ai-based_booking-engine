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

  // Show premium loading state
  if (isLoading) {
    return (
      <div className="flex h-screen w-full bg-indigo-950 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent)]" />
        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
        
        {/* Sidebar skeleton */}
        <div className="hidden w-80 flex-col gap-6 border-r border-white/5 bg-black/20 backdrop-blur-3xl p-8 md:flex">
          <Skeleton className="h-12 w-40 bg-white/5 rounded-2xl" />
          <div className="space-y-6 mt-10">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="flex flex-1 flex-col relative">
          <div className="h-20 border-b border-white/5 bg-black/10 backdrop-blur-xl flex items-center px-10">
             <Skeleton className="h-8 w-64 bg-white/5 rounded-xl" />
          </div>
          <div className="flex-1 space-y-10 p-10">
            <div className="space-y-4">
              <Skeleton className="h-12 w-96 bg-white/5 rounded-2xl" />
              <Skeleton className="h-6 w-[600px] bg-white/5 rounded-xl" />
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-48 bg-white/5 rounded-[40px]" />
              ))}
            </div>
            <Skeleton className="h-[400px] w-full bg-white/5 rounded-[40px]" />
          </div>
        </div>

        <div className="absolute bottom-10 right-10 flex flex-col items-end gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300/40">Securing Master Node</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Elite Deactivated State
  if (hotel && hotel.is_active === false) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-indigo-950 p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.15),transparent)]" />
        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
        
        <div className="relative z-10 animate-enter">
            <div className="w-32 h-32 bg-indigo-500/10 rounded-[40px] border border-indigo-500/20 flex items-center justify-center mb-10 mx-auto shadow-[0_0_50px_rgba(99,102,241,0.1)] group">
                <ShieldX className="w-16 h-16 text-indigo-400 group-hover:scale-110 transition-transform duration-500" />
            </div>
            
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 mb-6">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Security Protocol: Suspension Active
            </div>
            
            <h1 className="text-5xl sm:text-7xl font-black text-white mb-6 tracking-tighter">
                Infrastructure <span className="text-indigo-400">Locked</span>
            </h1>
            
            <p className="text-indigo-200/50 max-w-xl mb-12 text-lg font-medium leading-relaxed mx-auto">
                Access to the <span className="text-white">Staybooker Neural Engine</span> has been restricted for this entity. This typically occurs during license expiration or compliance synchronization.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <Button className="h-16 px-12 rounded-[24px] bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_20px_40px_rgba(99,102,241,0.2)] font-black uppercase tracking-widest text-xs flex gap-3 group transition-all active:scale-95">
                    <MessageSquare className="h-5 w-5" />
                    Contact Protocol Support
                </Button>
                <Button 
                    variant="outline" 
                    className="h-16 px-12 rounded-[24px] bg-transparent border-white/10 hover:bg-white/5 text-white/60 hover:text-white font-black uppercase tracking-widest text-xs flex gap-3 transition-all"
                    onClick={logout}
                >
                    <LogOut className="h-5 w-5" />
                    Terminate Session
                </Button>
            </div>
            
            <p className="mt-20 text-[10px] text-indigo-300/30 font-black uppercase tracking-[0.4em]">Staybooker Enterprise Core v3.0</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#f8faff] overflow-hidden">
        {/* Subtle background layers */}
        <div className="fixed inset-0 bg-[radial-gradient(at_top_right,rgba(99,102,241,0.03),transparent_50%)] pointer-events-none" />
        <div className="fixed inset-0 bg-[radial-gradient(at_bottom_left,rgba(139,92,246,0.03),transparent_50%)] pointer-events-none" />
        
        <AppSidebar />
        
        <SidebarInset className="flex flex-1 flex-col bg-transparent relative z-10 overflow-hidden">
          <AppHeader />
          <main className={cn(
            "flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-indigo-100/50 hover:scrollbar-thumb-indigo-200/50 transition-all",
            "p-0 sm:p-0" // We'll let pages handle their own padding for full-bleed effects
          )}>
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default DashboardLayout;
