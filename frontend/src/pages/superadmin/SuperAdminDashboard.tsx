import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, RefreshCw, Sun, Moon, ShieldCheck, BarChart3, Radio } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/contexts/AuthContext';
import { StatsGrid } from '@/components/superadmin/StatsGrid';
import { HotelsTab } from '@/components/superadmin/HotelsTab';
import { HotelWorkspace } from '@/components/superadmin/HotelWorkspace';
import { AnalyticsTab } from '@/components/superadmin/AnalyticsTab';
import { BroadcastsTab } from '@/components/superadmin/BroadcastsTab';

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
            const currentToken = localStorage.getItem('token');
            if (currentToken) localStorage.setItem('superadmin_original_token', currentToken);
            localStorage.setItem('token', data.access_token);
            window.location.href = '/';
        }
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
                {selectedHotel ? (
                    <HotelWorkspace
                        hotel={selectedHotel}
                        users={users}
                        onBack={() => setSelectedHotel(null)}
                    />
                ) : (
                    <>
                        <StatsGrid
                            hotelsCount={hotels.length}
                            usersCount={users.length}
                            aiCount={hotels.filter((h: any) => h.feature_ai_agent).length}
                        />

                        <Tabs defaultValue="hotels" className="w-full">
                            <TabsList className="bg-muted p-1 rounded-xl">
                                <TabsTrigger value="hotels" className="rounded-lg font-bold px-6">Properties</TabsTrigger>
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
                            
                            <AnalyticsTab hotels={hotels} users={users} onSelectHotel={setSelectedHotel} />
                            <BroadcastsTab />

                            <TabsContent value="audit" className="mt-6">
                                <div className="p-12 text-center border-2 border-dashed rounded-3xl text-muted-foreground font-medium">
                                    Audit logs are being optimized for high-volume traffic.
                                    <br/>Please check back shortly.
                                </div>
                            </TabsContent>
                        </Tabs>
                    </>
                )}
            </main>
        </div>
    );
}
