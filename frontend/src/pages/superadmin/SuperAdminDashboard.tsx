import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ShieldCheck,
    Shield,
    Building2,
    User as UserIcon,
    Users,
    LogOut,
    Hotel,
    Search,
    RefreshCw,
    ExternalLink,
    MoreVertical,
    FileDown,
    Trash2,
    BrainCircuit,
    MessageSquare,
    TrendingUp,
    MapPin,
    XCircle,
    CheckCircle2,
    CreditCard,
    Zap,
    Bot
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from '@/components/ui/use-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';

interface HotelAdminData {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    owner_email: string;
    owner_name: string;
    feature_ai_agent: boolean;
    feature_guest_bot: boolean;
    feature_rate_shopper: boolean;
    subscription: {
        plan: string;
        status: string;
        end_date: string | null;
    } | null;
}

interface UserAdminData {
    id: string;
    name: string;
    email: string;
    role: string;
    created_at: string;
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function SuperAdminDashboard() {
    const { user, logout, isLoading: authLoading } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: hotels = [], isLoading, refetch } = useQuery<HotelAdminData[]>({
        queryKey: ['superadmin-hotels'],
        queryFn: () => apiClient.get('/superadmin/hotels'),
        enabled: !!user && user.role === 'SUPER_ADMIN'
    });

    const { data: users = [], isLoading: isLoadingUsers } = useQuery<UserAdminData[]>({
        queryKey: ['superadmin-users', userSearchQuery],
        queryFn: () => apiClient.get(`/superadmin/users?query=${userSearchQuery}`),
        enabled: !!user && user.role === 'SUPER_ADMIN'
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) =>
            apiClient.patch(`/superadmin/hotels/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
            toast({ title: 'Updated', description: 'Hotel configuration saved successfully.' });
        }
    });

    const updateRoleMutation = useMutation({
        mutationFn: ({ id, role }: { id: string, role: string }) =>
            apiClient.patch(`/superadmin/users/${id}/role?role=${role}`, {}),
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['superadmin-users'] });
            toast({ title: 'Role Updated', description: res.message });
        }
    });

    const deleteHotelMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/superadmin/hotels/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
            toast({ title: 'Deleted', description: 'Hotel has been removed from the system.' });
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to delete hotel.', variant: 'destructive' });
        }
    });

    // Layer 0: Wait for authentication to initialize
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-semibold animate-pulse tracking-tight">Staybooker Enterprise</p>
                </div>
            </div>
        );
    }

    // Layer 1: Role Enforcement
    if (!user || user.role !== 'SUPER_ADMIN') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4 font-inter">
                <Card className="max-w-md w-full border-slate-200 shadow-xl">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4 border border-red-100">
                            <XCircle className="w-10 h-10" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-slate-900">Security Access Denied</CardTitle>
                        <CardDescription className="text-slate-500 font-medium mt-2">
                            Admin-only restricted portal.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-xl text-[10px] font-mono text-slate-400 border border-slate-100">
                            ERR_AUTH_PRIV_LOW: superadmin.staybooker.ai
                        </div>
                        <Button
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-xl"
                            onClick={async () => {
                                await logout();
                                window.location.href = '/login';
                            }}
                        >
                            Return to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const toggleActive = (id: string, currentStatus: boolean) => {
        updateMutation.mutate({ id, data: { is_active: !currentStatus } });
    };

    const toggleFeature = (id: string, feature: string, currentVal: boolean) => {
        const keyMap: Record<string, string> = {
            'ai_enabled': 'feature_ai_agent',
            'guest_bot_enabled': 'feature_guest_bot',
            'rate_shopper_enabled': 'feature_rate_shopper'
        };
        const apiField = keyMap[feature] || feature;
        updateMutation.mutate({ id, data: { [apiField]: !currentVal } });
    };

    const filteredHotels = hotels.filter(h =>
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.owner_email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#F9FAFB] font-inter selection:bg-indigo-100">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 px-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
                        <Shield className="text-white w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-none">Staybooker <span className="text-indigo-600">Admin</span></h1>
                        <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mt-1">Platform Control Center</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                            placeholder="Global Search..."
                            className="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-sm font-bold text-slate-900">{user.email.split('@')[0]}</p>
                            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-tighter">Super Admin</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors"
                            onClick={() => logout()}
                        >
                            <LogOut className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="p-8 max-w-[1600px] mx-auto space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Hotels', value: hotels.length, trend: '+12%', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                        { label: 'Active Users', value: users.length, trend: '+5%', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: 'AI Features Active', value: hotels.filter(h => h.feature_ai_agent).length, trend: 'Trending', icon: BrainCircuit, color: 'text-purple-600', bg: 'bg-purple-50' },
                        { label: 'System Health', value: '99.9%', trend: 'Operational', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
                    ].map((stat, i) => (
                        <Card key={i} className="border-slate-200 shadow-sm hover:shadow-md transition-all">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                                        <stat.icon className="w-6 h-6" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</span>
                                </div>
                                <div className="flex items-end justify-between">
                                    <h3 className="text-3xl font-black text-slate-900 tabular-nums tracking-tight">{stat.value}</h3>
                                    <span className="text-[10px] font-black px-2 py-1 bg-slate-100 rounded-lg text-slate-600">{stat.trend}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Tabs & Content */}
                <Tabs defaultValue="hotels" className="w-full">
                    <div className="flex items-center justify-between mb-6">
                        <TabsList className="bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <TabsTrigger value="hotels" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-6 h-10 transition-all">
                                <Hotel className="w-4 h-4 mr-2" /> Properties
                            </TabsTrigger>
                            <TabsTrigger value="users" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-6 h-10 transition-all">
                                <Users className="w-4 h-4 mr-2" /> User Accounts
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                className="rounded-xl border-slate-200 bg-white font-bold h-11 px-6 hover:bg-slate-50 transition-colors"
                                onClick={() => refetch()}
                            >
                                <RefreshCw className="w-4 h-4 mr-2" /> Refresh Data
                            </Button>
                            <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 shadow-lg shadow-indigo-100 transition-all">
                                <FileDown className="w-4 h-4 mr-2" /> Export Report
                            </Button>
                        </div>
                    </div>

                    <TabsContent value="hotels" className="mt-0">
                        <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl bg-white">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[300px] text-[10px] font-black uppercase tracking-widest text-slate-400 py-4 pl-8">Hotel Property</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ownership</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">AI Features</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right pr-8">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-64 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                                        <span className="text-sm font-bold text-slate-400 animate-pulse">Loading Portfolio...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredHotels.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-64 text-center text-slate-400 font-bold italic">
                                                    No properties matched your search.
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredHotels.map((hotel) => (
                                            <TableRow key={hotel.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                                                <TableCell className="py-5 pl-8">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 overflow-hidden group">
                                                            <Building2 className="w-6 h-6 text-slate-400 group-hover:scale-110 transition-transform" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900">{hotel.name}</div>
                                                            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                                                <MapPin className="w-3 h-3" /> Location Managed
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700 text-sm tabular-nums">{hotel.owner_email.split('@')[0]}</span>
                                                        <span className="text-[11px] text-slate-400">{hotel.owner_email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={`rounded-lg px-3 py-1 font-black text-[10px] uppercase tracking-widest border ${
                                                        hotel.is_active 
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' 
                                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}>
                                                        {hotel.is_active ? 'Active' : 'Locked'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center gap-8">
                                                        {[
                                                            { label: 'AI', key: 'ai_enabled', icon: BrainCircuit, val: hotel.feature_ai_agent },
                                                            { label: 'Bot', key: 'guest_bot_enabled', icon: MessageSquare, val: hotel.feature_guest_bot },
                                                            { label: 'Rates', key: 'rate_shopper_enabled', icon: TrendingUp, val: hotel.feature_rate_shopper },
                                                        ].map((feat) => (
                                                            <div key={feat.key} className="flex flex-col items-center gap-2">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{feat.label}</span>
                                                                <Switch
                                                                    checked={feat.val}
                                                                    onCheckedChange={() => toggleFeature(hotel.id, feat.key, feat.val)}
                                                                    className="scale-90 data-[state=checked]:bg-indigo-600"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-white hover:shadow-sm hover:border-slate-200 border border-transparent transition-all">
                                                            <ExternalLink className="w-4 h-4 text-slate-400 hover:text-indigo-600" />
                                                        </Button>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="rounded-xl hover:bg-white hover:shadow-sm">
                                                                    <MoreVertical className="w-4 h-4 text-slate-400" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-slate-200 bg-white">
                                                                <DropdownMenuLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">Property Control</DropdownMenuLabel>
                                                                <DropdownMenuSeparator className="bg-slate-50" />
                                                                <DropdownMenuItem className="rounded-xl py-3 cursor-pointer group" onClick={() => toggleActive(hotel.id, hotel.is_active)}>
                                                                    {hotel.is_active ? <XCircle className="w-4 h-4 mr-3 text-red-500" /> : <ShieldCheck className="w-4 h-4 mr-3 text-emerald-500" />}
                                                                    <span className="font-bold text-slate-700">{hotel.is_active ? 'Restrict Account' : 'Grant Full Access'}</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem className="rounded-xl py-3 cursor-pointer group" onClick={() => toast({ title: 'Subscription Manager', description: 'Redirecting to payment gateway...' })}>
                                                                    <CreditCard className="w-4 h-4 mr-3 text-indigo-500" />
                                                                    <span className="font-bold text-slate-700">Manage Billing</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator className="bg-slate-50" />
                                                                <DropdownMenuItem className="rounded-xl py-3 cursor-pointer group hover:bg-red-50" onClick={() => {
                                                                    if (confirm(`Are you absolutely sure you want to delete ${hotel.name}? This action is irreversible.`)) {
                                                                        deleteHotelMutation.mutate(hotel.id);
                                                                    }
                                                                }}>
                                                                    <Trash2 className="w-4 h-4 mr-3 text-red-600" />
                                                                    <span className="font-bold text-red-600">Delete Property Data</span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    </TabsContent>

                    <TabsContent value="users" className="mt-0">
                        <Card className="border-slate-200 shadow-sm rounded-2xl p-8 bg-white min-h-[400px]">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">System User Governance</h3>
                                    <p className="text-sm text-slate-400 font-medium mt-1">Review and manage platform administration levels.</p>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        placeholder="Filter by email address..."
                                        className="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm w-80 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {isLoadingUsers ? (
                                    <div className="col-span-full h-48 flex items-center justify-center">
                                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : users.map((u: any) => (
                                    <div key={u.id} className="p-6 rounded-2xl border border-slate-100 bg-slate-50/30 hover:border-indigo-100 hover:bg-white hover:shadow-xl hover:shadow-slate-100/50 transition-all group relative overflow-hidden">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                                <UserIcon className="w-6 h-6" />
                                            </div>
                                            <Badge className={`rounded-lg px-3 py-1 font-black text-[9px] uppercase tracking-widest ${
                                                u.role === 'SUPER_ADMIN' ? 'bg-indigo-600 text-white border-none' : 'bg-slate-200 text-slate-600'
                                            }`}>
                                                {u.role}
                                            </Badge>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-bold text-slate-900 truncate">{u.email}</p>
                                            <p className="text-[11px] text-slate-400 font-bold tracking-tight uppercase">Joined: {format(new Date(u.created_at), 'dd MMM yyyy')}</p>
                                        </div>
                                        <div className="mt-6 pt-6 border-t border-slate-100 flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                className={`flex-1 rounded-xl h-10 font-black text-[10px] uppercase tracking-wider ${u.role === 'SUPER_ADMIN' ? 'text-red-600 hover:bg-red-50 border-red-100' : 'text-indigo-600 hover:bg-indigo-50 border-indigo-100'}`}
                                                onClick={() => updateRoleMutation.mutate({
                                                    id: u.id,
                                                    role: u.role === 'SUPER_ADMIN' ? 'OWNER' : 'SUPER_ADMIN'
                                                })}
                                            >
                                                {u.role === 'SUPER_ADMIN' ? 'Revoke Super Admin' : 'Grant Admin Privileges'}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
