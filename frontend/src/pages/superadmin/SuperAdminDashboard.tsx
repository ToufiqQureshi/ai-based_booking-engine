import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, RefreshCw, Sun, Moon, ShieldCheck, BarChart3, Radio } from 'lucide-react';
import { apiClient, tokenStorage } from '@/api/client';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/contexts/AuthContext';
import { StatsGrid } from '@/components/superadmin/StatsGrid';
import { HotelsTab } from '@/components/superadmin/HotelsTab';
import { HotelWorkspace } from '@/components/superadmin/HotelWorkspace';
import { AnalyticsTab } from '@/components/superadmin/AnalyticsTab';
import { BroadcastsTab } from '@/components/superadmin/BroadcastsTab';
import { UsersTab } from '@/components/superadmin/UsersTab';
import { PlanFeaturesTab } from '@/components/superadmin/PlanFeaturesTab';
import { toast } from 'sonner';

// Storage key for the super-admin's own token (saved while impersonating a hotel admin).
const SUPERADMIN_ORIGINAL_TOKENS_KEY = 'superadmin_original_tokens';

export default function SuperAdminDashboard() {
    const { user, logout, isLoading: authLoading } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [selectedHotel, setSelectedHotel] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const queryClient = useQueryClient();

    const { data: hotels = [], isLoading, refetch } = useQuery<any[]>({
        queryKey: ['superadmin-hotels'],
        queryFn: () => apiClient.get('/superadmin/hotels'),
        enabled: !!user && user.role === 'SUPER_ADMIN'
    });

    const { data: users = [] } = useQuery<any[]>({
        queryKey: ['superadmin-users'],
        queryFn: () => apiClient.get('/superadmin/users'),
        enabled: !!user && user.role === 'SUPER_ADMIN'
    });

    const impersonateMutation = useMutation({
        mutationFn: (hotelId: string) => apiClient.post(`/superadmin/impersonate/${hotelId}`, {}),
        onSuccess: (data: any) => {
            if (!data?.access_token) {
                toast.error("Impersonation failed: no access token returned by server");
                return;
            }
            try {
                // Save the super-admin's CURRENT tokens before swapping. We must use the
                // canonical token-storage keys (hotel_access_token / hotel_refresh_token)
                // because the rest of the app reads from those — using 'token' silently broke
                // every authenticated request.
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
                window.location.href = '/';
            } catch (err) {
                // If anything goes wrong, do NOT leave the user stranded with mixed tokens.
                localStorage.removeItem(SUPERADMIN_ORIGINAL_TOKENS_KEY);
                tokenStorage.clearTokens();
                toast.error("Impersonation flow failed — please log in again");
                console.error('Impersonation token swap failed:', err);
            }
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Failed to impersonate hotel admin');
        },
    });

    if (authLoading) return <div className="min-h-screen flex items-center justify-center">Loading Admin...</div>;
    if (!user || user.role !== 'SUPER_ADMIN') return <div className="p-8 text-center text-red-600 font-bold">Access Denied</div>;

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b h-16 px-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center"><ShieldCheck className="text-white w-5 h-5" /></div>
                    <h1 className="text-lg font-bold">Staybooker <span className="text-indigo-600">Admin</span></h1>
                </div>

                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={toggleTheme}>
                        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => logout()} className="hover:text-red-600">
                        <LogOut className="w-5 h-5" />
                    </Button>
                </div>
            </header>

            <main className="p-8 max-w-[1600px] mx-auto space-y-8">
                {selectedHotel && (
                    <HotelWorkspace
                        hotel={selectedHotel}
                        users={users}
                        onBack={() => setSelectedHotel(null)}
                    />
                )}
                
                <StatsGrid
                    hotelsCount={hotels.length}
                    usersCount={users.length}
                    aiCount={hotels.filter((h: any) => h.feature_ai_agent).length}
                />

                <Tabs defaultValue="hotels" className="w-full">
                    <TabsList className="bg-muted p-1 rounded-xl">
                        <TabsTrigger value="hotels" className="rounded-lg font-bold px-6">Properties</TabsTrigger>
                        <TabsTrigger value="users" className="rounded-lg font-bold px-6">Users</TabsTrigger>
                        <TabsTrigger value="plan-features" className="rounded-lg font-bold px-6">Plan Features</TabsTrigger>
                        <TabsTrigger value="analytics" className="rounded-lg font-bold px-6">Analytics</TabsTrigger>
                        <TabsTrigger value="broadcasts" className="rounded-lg font-bold px-6">Broadcasts</TabsTrigger>
                        <TabsTrigger value="audit" className="rounded-lg font-bold px-6">Audit Trail</TabsTrigger>
                    </TabsList>

                    <TabsContent value="hotels" className="mt-6">
                        <div className="flex justify-between items-center mb-6">
                            <div className="relative">
                                <input
                                    placeholder="Search hotels..."
                                    className="bg-muted/50 border rounded-xl pl-4 pr-10 py-2 text-sm w-80 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Button onClick={() => refetch()} variant="outline" className="rounded-xl"><RefreshCw className="w-4 h-4 mr-2" /> Sync Data</Button>
                        </div>
                        <HotelsTab
                            hotels={hotels.filter((h: any) => h.name.toLowerCase().includes(searchQuery.toLowerCase()))}
                            users={users}
                            onSelectHotel={setSelectedHotel}
                            onImpersonate={(id: string) => impersonateMutation.mutate(id)}
                            isImpersonating={impersonateMutation.isPending}
                        />
                    </TabsContent>
                    
                    <UsersTab />
                    <PlanFeaturesTab />
                    <AnalyticsTab hotels={hotels} users={users} onSelectHotel={setSelectedHotel} />
                    <BroadcastsTab />

                    <TabsContent value="audit" className="mt-6">
                        <div className="p-12 text-center border-2 border-dashed rounded-3xl text-muted-foreground font-medium">
                            Audit logs are being optimized for high-volume traffic.
                            <br/>Please check back shortly.
                        </div>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
