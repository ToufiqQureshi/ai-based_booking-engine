import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
    LogOut, Sun, Moon, ShieldCheck, Building2, Users, LayoutGrid,
    Radio, ClipboardList, BarChart3, RefreshCw, ChevronRight, Menu, X,
    Zap, Crown, Heart, DollarSign, Database, Shield, Download, Network,
    Percent, Banknote, Ticket, Settings2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient, tokenStorage } from '@/core/api/client';
import { useTheme } from '@/core/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/core/contexts/AuthContext';
import { StatsGrid } from '@/superadmin/components/StatsGrid';
import { SuperAdminCharts } from '@/superadmin/components/SuperAdminCharts';
import { HotelsTab } from '@/superadmin/components/HotelsTab';
import { HotelWorkspace } from '@/superadmin/components/HotelWorkspace';
import { AnalyticsTab } from '@/analytics/AnalyticsTab';
import { BroadcastsTab } from '@/superadmin/components/BroadcastsTab';
import { UsersTab } from '@/superadmin/components/UsersTab';
import { PlanFeaturesTab } from '@/superadmin/components/PlanFeaturesTab';
import { AuditLogsTab } from '@/superadmin/components/AuditLogsTab';
import { HealthTab } from '@/superadmin/components/HealthTab';
import { RevenueTab } from '@/superadmin/components/RevenueTab';
import { CacheTab } from '@/superadmin/components/CacheTab';
import { SessionsTab } from '@/superadmin/components/SessionsTab';
import { BrandsTab } from '@/superadmin/components/BrandsTab';
import { KycTab } from '@/superadmin/components/KycTab';
import { CommissionsTab } from '@/superadmin/components/CommissionsTab';
import { PayoutsTab } from '@/superadmin/components/PayoutsTab';
import { TicketsTab } from '@/superadmin/components/TicketsTab';
import { PlatformTab } from '@/superadmin/components/PlatformTab';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';

const SUPERADMIN_ORIGINAL_TOKENS_KEY = 'superadmin_original_tokens';

type NavSection = 'overview' | 'hotels' | 'users' | 'plans' | 'analytics' |
    'broadcasts' | 'audit' | 'health' | 'revenue' | 'cache' | 'sessions' | 'brands' |
    'kyc' | 'commissions' | 'payouts' | 'tickets' | 'platform';

const NAV_ITEMS: { id: NavSection; label: string; icon: any; group?: string }[] = [
    { id: 'overview',    label: 'Overview',        icon: LayoutGrid,    group: 'main' },
    { id: 'hotels',      label: 'Properties',      icon: Building2,     group: 'main' },
    { id: 'users',       label: 'Users',           icon: Users,         group: 'main' },
    { id: 'brands',      label: 'Brand Groups',    icon: Network,       group: 'main' },
    { id: 'plans',       label: 'Plan Features',   icon: Crown,         group: 'main' },
    { id: 'kyc',         label: 'KYC',             icon: ShieldCheck,   group: 'finance' },
    { id: 'commissions', label: 'Commissions',     icon: Percent,       group: 'finance' },
    { id: 'payouts',     label: 'Payouts',         icon: Banknote,      group: 'finance' },
    { id: 'tickets',     label: 'Support Tickets', icon: Ticket,        group: 'support' },
    { id: 'analytics',   label: 'Analytics',       icon: BarChart3,     group: 'insights' },
    { id: 'revenue',     label: 'Revenue',         icon: DollarSign,    group: 'insights' },
    { id: 'health',      label: 'Health Monitor',  icon: Heart,         group: 'insights' },
    { id: 'broadcasts',  label: 'Broadcasts',      icon: Radio,         group: 'system' },
    { id: 'audit',       label: 'Audit Trail',     icon: ClipboardList, group: 'system' },
    { id: 'sessions',    label: 'Sessions',        icon: Shield,        group: 'system' },
    { id: 'cache',       label: 'Cache',           icon: Database,      group: 'system' },
    { id: 'platform',    label: 'Platform Settings', icon: Settings2,   group: 'system' },
];

export default function SuperAdminDashboard() {
    const { user, logout, isLoading: authLoading } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { section = 'overview' } = useParams<{ section?: string }>();
    const activeSection = section as NavSection;
    const navigate = useNavigate();

    const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Effective sub-role + allowed nav tabs for this admin.
    // Founders (no sub-role) come back as is_owner=true → see everything.
    const { data: access } = useQuery<{ tier: string; is_owner: boolean; allowed_tabs: string[] }>({
        queryKey: ['superadmin-my-access'],
        queryFn: () => apiClient.get('/superadmin/me/access'),
        staleTime: 1000 * 60 * 5,
        enabled: !!user && user.role === 'SUPER_ADMIN',
    });

    const isOwnerAdmin = access?.is_owner ?? true;
    const allowedTabs = access?.allowed_tabs ?? [];
    const canView = (tab: string) =>
        tab === 'overview' || isOwnerAdmin || allowedTabs.includes(tab);
    const visibleNavItems = NAV_ITEMS.filter(n => canView(n.id));

    const { data: hotels = [], isLoading, refetch } = useQuery<any[]>({
        queryKey: ['superadmin-hotels'],
        queryFn: () => apiClient.get('/superadmin/hotels'),
        staleTime: 1000 * 60 * 2,
        enabled: !!user && user.role === 'SUPER_ADMIN' && 
            ['overview', 'hotels', 'brands', 'analytics', 'cache', 'commissions', 'payouts', 'tickets', 'platform'].includes(activeSection),
    });

    const selectedHotel = hotels.find((h: any) => h.id === selectedHotelId) || null;
    const handleSelectHotel = (h: any) => setSelectedHotelId(h ? h.id : null);

    const { data: users = [] } = useQuery<any[]>({
        queryKey: ['superadmin-users'],
        queryFn: () => apiClient.get('/superadmin/users'),
        staleTime: 1000 * 60 * 2,
        enabled: !!user && user.role === 'SUPER_ADMIN' && 
            ['overview', 'hotels', 'brands', 'analytics', 'tickets', 'platform'].includes(activeSection),
    });

    const impersonateMutation = useMutation({
        mutationFn: (hotelId: string) => apiClient.post(`/superadmin/impersonate/${hotelId}`, {}),
        onSuccess: (data: any) => {
            if (!data?.access_token) {
                toast.error("Impersonation failed: no access token returned");
                return;
            }
            try {
                const originalAccess = tokenStorage.getAccessToken();
                const originalRefresh = tokenStorage.getRefreshToken();
                if (!originalAccess) {
                    toast.error("Cannot impersonate: super-admin session is missing");
                    return;
                }
                localStorage.setItem(
                    SUPERADMIN_ORIGINAL_TOKENS_KEY,
                    JSON.stringify({ access_token: originalAccess, refresh_token: originalRefresh ?? '' })
                );
                tokenStorage.setTokens({
                    access_token: data.access_token,
                    refresh_token: data.refresh_token ?? '',
                    token_type: 'Bearer',
                    expires_in: data.expires_in ?? 3600,
                });
                
                // Redirect to the normal hotel dashboard (app subdomain) instead of staying on superadmin
                const appUrl = window.location.hostname.includes('superadmin.')
                    ? window.location.origin.replace('superadmin.', 'app.')
                    : window.location.origin;
                window.location.href = `${appUrl}/dashboard`;
            } catch (err) {
                localStorage.removeItem(SUPERADMIN_ORIGINAL_TOKENS_KEY);
                tokenStorage.clearTokens();
                toast.error("Impersonation failed — please log in again");
            }
        },
        onError: (err: any) => toast.error(err?.message || 'Failed to impersonate'),
    });

    if (authLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-muted-foreground">Loading admin panel…</p>
            </div>
        </div>
    );

    if (!user || user.role !== 'SUPER_ADMIN') return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="p-8 text-center border border-red-200 dark:border-red-900 rounded-2xl bg-red-50 dark:bg-red-950/20">
                <ShieldCheck className="w-10 h-10 text-red-500 mx-auto mb-3" />
                <p className="font-black text-red-700 dark:text-red-400 text-lg">Access Denied</p>
                <p className="text-sm text-muted-foreground mt-1">Super admin credentials required.</p>
            </div>
        </div>
    );

    const filteredHotels = hotels.filter((h: any) =>
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.owner_email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeHotels = hotels.filter((h: any) => h.subscription?.status === 'active').length;

    return (
        <div className="flex h-screen bg-background overflow-hidden">

            {/* ── Sidebar ──────────────────────────────────────────── */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.aside
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 240, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-shrink-0 h-full bg-background border-r border-border flex flex-col overflow-hidden z-30"
                    >
                        {/* Logo */}
                        <div className="h-16 px-5 flex items-center gap-3 border-b border-border shrink-0">
                            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                                <ShieldCheck className="text-white w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-foreground leading-none">Staybooker</p>
                                <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Admin Console</p>
                            </div>
                        </div>

                        {/* Nav */}
                        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
                            {(['main', 'finance', 'support', 'insights', 'system'] as const).map(group => {
                                const items = visibleNavItems.filter(n => n.group === group);
                                if (items.length === 0) return null;
                                const groupLabel = group === 'main' ? 'Management'
                                    : group === 'finance' ? 'Finance'
                                    : group === 'support' ? 'Support'
                                    : group === 'insights' ? 'Insights'
                                    : 'System';
                                return (
                                    <div key={group}>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-3 mb-1">{groupLabel}</p>
                                        <div className="space-y-0.5">
                                            {items.map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => { navigate(`/${item.id}`); setSelectedHotelId(null); }}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                                                        activeSection === item.id
                                                            ? "bg-indigo-600 text-white shadow-sm"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                                    )}
                                                >
                                                    <item.icon className="w-4 h-4 shrink-0" />
                                                    <span className="truncate">{item.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </nav>

                        {/* User info at bottom */}
                        <div className="p-3 border-t border-border shrink-0">
                            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-muted/40">
                                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                                    {user.name?.[0]?.toUpperCase() ?? 'A'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-foreground truncate">{user.name || 'Admin'}</p>
                                    <p className="text-[9px] text-muted-foreground truncate">{user.email}</p>
                                </div>
                            </div>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* ── Main Area ─────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* Top bar */}
                <header className="h-16 px-5 flex items-center justify-between border-b border-border bg-background/90 backdrop-blur-sm shrink-0 z-20">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(s => !s)}>
                            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                        </Button>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">
                                {selectedHotel
                                    ? NAV_ITEMS.find(n => n.id === 'hotels')?.label
                                    : NAV_ITEMS.find(n => n.id === activeSection)?.label}
                            </span>
                            {selectedHotel && (
                                <>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                    <span className="font-bold text-foreground">{selectedHotel.name}</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
                            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => logout()}
                            className="h-8 text-muted-foreground hover:text-red-600 gap-1.5 text-xs font-semibold"
                        >
                            <LogOut className="w-3.5 h-3.5" /> Sign out
                        </Button>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-[1400px] mx-auto p-6 space-y-6">

                        {/* Block direct-URL access to a tab this admin's role can't see */}
                        {!canView(activeSection) ? (
                            <div className="p-8 text-center border border-amber-200 dark:border-amber-900 rounded-2xl bg-amber-50 dark:bg-amber-950/20">
                                <ShieldCheck className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                                <p className="font-black text-amber-700 dark:text-amber-400 text-lg">Restricted</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Your admin role ({access?.tier}) does not have access to this section.
                                </p>
                                <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={() => navigate('/overview')}>
                                    Back to Overview
                                </Button>
                            </div>
                        ) : selectedHotel ? (
                            <HotelWorkspace
                                hotel={selectedHotel}
                                users={users}
                                onBack={() => setSelectedHotelId(null)}
                                onImpersonate={() => impersonateMutation.mutate(selectedHotel.id)}
                                isImpersonating={impersonateMutation.isPending}
                            />
                        ) : (
                            <>
                                {/* Overview section always shows stats */}
                                {activeSection === 'overview' && (
                                    <div className="space-y-6">
                                        <div>
                                            <h1 className="text-2xl font-black text-foreground">Platform Overview</h1>
                                            <p className="text-sm text-muted-foreground mt-0.5">
                                                {hotels.length} properties · {users.length} users · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </p>
                                        </div>
                                        <StatsGrid
                                            hotelsCount={hotels.length}
                                            usersCount={users.length}
                                            aiCount={hotels.filter((h: any) => h.feature_ai_agent).length}
                                            activeCount={activeHotels}
                                        />

                                        {/* Super Admin Charts */}
                                        <SuperAdminCharts />

                                        {/* Quick Alerts & Actions */}
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            {/* Alerts */}
                                            <div className="lg:col-span-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl p-5">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <Heart className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                                                    <h3 className="text-sm font-black text-amber-900 dark:text-amber-400">System Alerts</h3>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2 text-sm">
                                                        <span className="text-muted-foreground font-medium">Active Support Tickets (High Priority)</span>
                                                        <Badge variant="destructive">3 Open</Badge>
                                                    </div>
                                                    <div className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2 text-sm">
                                                        <span className="text-muted-foreground font-medium">Stripe API Webhook Sync</span>
                                                        <span className="text-emerald-600 font-bold flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Healthy</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quick Actions */}
                                            <div className="bg-background border border-border rounded-2xl p-5 flex flex-col justify-center gap-3">
                                                <Button onClick={() => navigate('/hotels')} className="w-full rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700">
                                                    <Building2 className="w-4 h-4 mr-2" /> Add New Property
                                                </Button>
                                                <Button onClick={() => navigate('/broadcasts')} variant="outline" className="w-full rounded-xl font-bold">
                                                    <Radio className="w-4 h-4 mr-2" /> Global Broadcast
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Quick access to recent hotels */}
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <h2 className="text-sm font-black text-foreground uppercase tracking-wider">Recent Properties</h2>
                                                <Button variant="ghost" size="sm" className="text-xs h-7 font-semibold text-indigo-600" onClick={() => navigate('/hotels')}>
                                                    View all <ChevronRight className="w-3 h-3 ml-1" />
                                                </Button>
                                            </div>
                                            <HotelsTab
                                                hotels={hotels.slice(0, 6)}
                                                users={users}
                                                onSelectHotel={handleSelectHotel}
                                                onImpersonate={(id) => impersonateMutation.mutate(id)}
                                                isImpersonating={impersonateMutation.isPending}
                                            />
                                        </div>
                                    </div>
                                )}

                                {activeSection === 'hotels' && (
                                    <div className="space-y-5">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <h1 className="text-2xl font-black text-foreground">Properties</h1>
                                                <p className="text-sm text-muted-foreground">{hotels.length} total · {activeHotels} active</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <input
                                                        placeholder="Search by name, slug, email…"
                                                        className="bg-muted/50 border border-border rounded-xl pl-4 pr-10 py-2 text-sm w-72 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all"
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                    />
                                                </div>
                                                <Button onClick={() => refetch()} variant="outline" size="sm" className="rounded-xl h-9 gap-1.5 font-semibold">
                                                    <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} /> Refresh
                                                </Button>
                                            </div>
                                        </div>
                                        <HotelsTab
                                            hotels={filteredHotels}
                                            users={users}
                                            onSelectHotel={handleSelectHotel}
                                            onImpersonate={(id) => impersonateMutation.mutate(id)}
                                            isImpersonating={impersonateMutation.isPending}
                                        />
                                    </div>
                                )}

                                {activeSection === 'users' && <UsersTab />}
                                {activeSection === 'brands' && <BrandsTab hotels={hotels} users={users} />}
                                {activeSection === 'plans' && <PlanFeaturesTab />}
                                {activeSection === 'analytics' && <AnalyticsTab hotels={hotels} onSelectHotel={handleSelectHotel} />}
                                {activeSection === 'revenue' && <RevenueTab />}
                                {activeSection === 'health' && <HealthTab onSelectHotel={handleSelectHotel} />}
                                {activeSection === 'broadcasts' && <BroadcastsTab />}
                                {activeSection === 'audit' && <AuditLogsTab />}
                                {activeSection === 'sessions' && <SessionsTab />}
                                {activeSection === 'cache' && <CacheTab hotels={hotels} />}
                                {activeSection === 'kyc' && <KycTab />}
                                {activeSection === 'commissions' && <CommissionsTab hotels={hotels} />}
                                {activeSection === 'payouts' && <PayoutsTab hotels={hotels} />}
                                {activeSection === 'tickets' && <TicketsTab hotels={hotels} admins={users} />}
                                {activeSection === 'platform' && <PlatformTab hotels={hotels} admins={users} />}
                            </>
                        )}
                    </div>
                </main>
            </div>

        </div>
    );
}


