import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ShieldCheck,
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
    Bot,
    Activity,
    Radio,
    UserCheck,
    Sliders,
    Plus,
    AlertTriangle,
    Send,
    Calendar,
    Clock,
    Lock,
    Globe,
    Layers
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
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
        whatsapp_credits: number;
        sms_credits: number;
        ai_usage_limit: number;
    } | null;
}

interface UserAdminData {
    id: string;
    name: string;
    email: string;
    role: string;
    created_at: string;
}

interface AuditLogData {
    id: string;
    user_email: string;
    action: string;
    description: string;
    ip_address: string;
    created_at: string;
}

interface BroadcastData {
    id: string;
    title: string;
    message: string;
    type: string;
    is_active: boolean;
    created_at: string;
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function SuperAdminDashboard() {
    const { user, logout, isLoading: authLoading } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [selectedQuotaHotel, setSelectedQuotaHotel] = useState<HotelAdminData | null>(null);
    const [whatsappCredits, setWhatsappCredits] = useState('1000');
    const [smsCredits, setSmsCredits] = useState('1000');
    const [aiUsageLimit, setAiUsageLimit] = useState('50000');

    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastType, setBroadcastType] = useState('info');

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

    const { data: auditLogs = [], isLoading: isLoadingAudit, refetch: refetchAudit } = useQuery<AuditLogData[]>({
        queryKey: ['superadmin-audit-logs'],
        queryFn: () => apiClient.get('/superadmin/audit-logs'),
        enabled: !!user && user.role === 'SUPER_ADMIN'
    });

    const { data: broadcasts = [], isLoading: isLoadingBroadcasts, refetch: refetchBroadcasts } = useQuery<BroadcastData[]>({
        queryKey: ['superadmin-broadcasts'],
        queryFn: () => apiClient.get('/superadmin/broadcasts'),
        enabled: !!user && user.role === 'SUPER_ADMIN'
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) =>
            apiClient.patch(`/superadmin/hotels/${id}`, data),
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey: ['superadmin-hotels'] });
            const previousHotels = queryClient.getQueryData<HotelAdminData[]>(['superadmin-hotels']);
            queryClient.setQueryData<HotelAdminData[]>(['superadmin-hotels'], old => 
                old ? old.map(hotel => hotel.id === id ? { ...hotel, ...data } : hotel) : []
            );
            return { previousHotels };
        },
        onError: (err, newHotel, context) => {
            if (context?.previousHotels) {
                queryClient.setQueryData(['superadmin-hotels'], context.previousHotels);
            }
            toast({ title: 'Error', description: 'Failed to update hotel configuration.', variant: 'destructive' });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
        onSuccess: () => {
            toast({ title: 'Updated', description: 'Hotel configuration saved successfully.' });
        }
    });

    const updateRoleMutation = useMutation({
        mutationFn: ({ id, role }: { id: string, role: string }) =>
            apiClient.patch(`/superadmin/users/${id}/role?role=${role}`, {}),
        onMutate: async ({ id, role }) => {
            await queryClient.cancelQueries({ queryKey: ['superadmin-users', userSearchQuery] });
            const previousUsers = queryClient.getQueryData<UserAdminData[]>(['superadmin-users', userSearchQuery]);
            queryClient.setQueryData<UserAdminData[]>(['superadmin-users', userSearchQuery], old => 
                old ? old.map(u => u.id === id ? { ...u, role } : u) : []
            );
            return { previousUsers };
        },
        onError: (err, variables, context) => {
            if (context?.previousUsers) {
                queryClient.setQueryData(['superadmin-users', userSearchQuery], context.previousUsers);
            }
            toast({ title: 'Error', description: 'Failed to update user role.', variant: 'destructive' });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['superadmin-users'] });
        },
        onSuccess: () => {
            toast({ title: 'Role Updated', description: 'User role updated successfully.' });
        }
    });

    const deleteHotelMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/superadmin/hotels/${id}`),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['superadmin-hotels'] });
            const previousHotels = queryClient.getQueryData<HotelAdminData[]>(['superadmin-hotels']);
            queryClient.setQueryData<HotelAdminData[]>(['superadmin-hotels'], old => 
                old ? old.filter(hotel => hotel.id !== id) : []
            );
            return { previousHotels };
        },
        onError: (err, id, context) => {
            if (context?.previousHotels) {
                queryClient.setQueryData(['superadmin-hotels'], context.previousHotels);
            }
            toast({ title: 'Error', description: 'Failed to delete hotel.', variant: 'destructive' });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
        onSuccess: () => {
            toast({ title: 'Deleted', description: 'Hotel has been removed from the system.' });
        }
    });

    const impersonateMutation = useMutation({
        mutationFn: (hotelId: string) => apiClient.post(`/superadmin/impersonate/${hotelId}`, {}),
        onSuccess: (data: any) => {
            const currentToken = localStorage.getItem('token');
            if (currentToken) {
                localStorage.setItem('superadmin_original_token', currentToken);
            }
            localStorage.setItem('token', data.access_token);
            toast({ title: 'Impersonating Hotel', description: 'Redirecting to hotel dashboard...' });
            window.location.href = '/';
        },
        onError: (err: any) => {
            toast({ title: 'Error', description: err.message || 'Failed to impersonate hotel.', variant: 'destructive' });
        }
    });

    const updateQuotasMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) =>
            apiClient.patch(`/superadmin/hotels/${id}/quotas`, data),
        onSuccess: () => {
            toast({ title: 'Quotas Updated', description: 'Hotel credit limits saved successfully.' });
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
            setSelectedQuotaHotel(null);
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to update hotel quotas.', variant: 'destructive' });
        }
    });

    const createBroadcastMutation = useMutation({
        mutationFn: (data: { title: string; message: string; type: string }) =>
            apiClient.post('/superadmin/broadcasts', data),
        onSuccess: () => {
            toast({ title: 'Broadcast Published', description: 'System announcement is now live.' });
            setBroadcastTitle('');
            setBroadcastMessage('');
            queryClient.invalidateQueries({ queryKey: ['superadmin-broadcasts'] });
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to publish broadcast.', variant: 'destructive' });
        }
    });

    const deleteBroadcastMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/superadmin/broadcasts/${id}`),
        onSuccess: () => {
            toast({ title: 'Broadcast Removed', description: 'System announcement deactivated.' });
            queryClient.invalidateQueries({ queryKey: ['superadmin-broadcasts'] });
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to remove broadcast.', variant: 'destructive' });
        }
    });

    // Layer 0: Wait for authentication to initialize
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground font-semibold animate-pulse tracking-tight">Staybooker Enterprise</p>
                </div>
            </div>
        );
    }

    // Layer 1: Role Enforcement
    if (!user || user.role !== 'SUPER_ADMIN') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4 font-inter">
                <Card className="max-w-md w-full border-border shadow-xl">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4 border border-red-100">
                            <XCircle className="w-10 h-10" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-foreground">Security Access Denied</CardTitle>
                        <CardDescription className="text-muted-foreground font-medium mt-2">
                            Admin-only restricted portal.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-muted/30 rounded-xl text-[10px] font-mono text-muted-foreground border border-border">
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
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border h-16 px-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
                        <ShieldCheck className="text-white w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-foreground leading-none">Staybooker <span className="text-indigo-600">Admin</span></h1>
                        <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase mt-1">Platform Control Center</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-indigo-600 transition-colors" />
                        <input
                            placeholder="Global Search..."
                            className="bg-muted/30 border border-border rounded-xl pl-10 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-sm font-bold text-foreground">{user.email.split('@')[0]}</p>
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
                        <Card key={i} className="border-border shadow-sm hover:shadow-md transition-all">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                                        <stat.icon className="w-6 h-6" />
                                    </div>
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                                </div>
                                <div className="flex items-end justify-between">
                                    <h3 className="text-3xl font-black text-foreground tabular-nums tracking-tight">{stat.value}</h3>
                                    <span className="text-[10px] font-black px-2 py-1 bg-muted rounded-lg text-muted-foreground">{stat.trend}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Tabs & Content */}
                <Tabs defaultValue="hotels" className="w-full">
                    <div className="flex items-center justify-between mb-6">
                        <TabsList className="bg-muted p-1 rounded-xl border border-border">
                            <TabsTrigger value="hotels" className="rounded-lg font-bold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-6 h-10 transition-all">
                                <Hotel className="w-4 h-4 mr-2" /> Properties
                            </TabsTrigger>
                            <TabsTrigger value="users" className="rounded-lg font-bold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-6 h-10 transition-all">
                                <Users className="w-4 h-4 mr-2" /> User Accounts
                            </TabsTrigger>
                            <TabsTrigger value="audit" className="rounded-lg font-bold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-6 h-10 transition-all">
                                <Activity className="w-4 h-4 mr-2" /> Audit & Activity
                            </TabsTrigger>
                            <TabsTrigger value="broadcasts" className="rounded-lg font-bold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-6 h-10 transition-all">
                                <Radio className="w-4 h-4 mr-2" /> System Broadcasts
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                className="rounded-xl border-border bg-background font-bold h-11 px-6 hover:bg-muted/30 transition-colors"
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
                        <Card className="border-border shadow-sm overflow-hidden rounded-2xl bg-background">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/30/50 border-b border-border">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[300px] text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 pl-8">Hotel Property</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ownership</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">AI Features</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-8">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-64 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                                        <span className="text-sm font-bold text-muted-foreground animate-pulse">Loading Portfolio...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredHotels.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-64 text-center text-muted-foreground font-bold italic">
                                                    No properties matched your search.
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredHotels.map((hotel) => (
                                            <TableRow key={hotel.id} className="hover:bg-muted/30/50 transition-colors border-border">
                                                <TableCell className="py-5 pl-8">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center border border-border overflow-hidden group">
                                                            <Building2 className="w-6 h-6 text-muted-foreground group-hover:scale-110 transition-transform" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-foreground">{hotel.name}</div>
                                                            <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                                                                <MapPin className="w-3 h-3" /> Location Managed
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-foreground text-sm tabular-nums">{hotel.owner_email.split('@')[0]}</span>
                                                        <span className="text-[11px] text-muted-foreground">{hotel.owner_email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={`rounded-lg px-3 py-1 font-black text-[10px] uppercase tracking-widest border ${
                                                        hotel.is_active 
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' 
                                                        : 'bg-muted text-muted-foreground border-border'
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
                                                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter">{feat.label}</span>
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
                                                        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-background hover:shadow-sm hover:border-border border border-transparent transition-all">
                                                            <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-indigo-600" />
                                                        </Button>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="rounded-xl hover:bg-background hover:shadow-sm">
                                                                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-border bg-background">
                                                                <DropdownMenuLabel className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-3 py-2">Property Control</DropdownMenuLabel>
                                                                <DropdownMenuSeparator className="bg-muted/30" />
                                                                <DropdownMenuItem className="rounded-xl py-3 cursor-pointer group" onClick={() => impersonateMutation.mutate(hotel.id)}>
                                                                    <UserCheck className="w-4 h-4 mr-3 text-emerald-600" />
                                                                    <span className="font-bold text-foreground">Impersonate Hotel</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem className="rounded-xl py-3 cursor-pointer group" onClick={() => {
                                                                    setSelectedQuotaHotel(hotel);
                                                                    setWhatsappCredits(hotel.subscription?.whatsapp_credits?.toString() || '1000');
                                                                    setSmsCredits(hotel.subscription?.sms_credits?.toString() || '1000');
                                                                    setAiUsageLimit(hotel.subscription?.ai_usage_limit?.toString() || '50000');
                                                                }}>
                                                                    <Sliders className="w-4 h-4 mr-3 text-purple-600" />
                                                                    <span className="font-bold text-foreground">Quotas & Limits</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem className="rounded-xl py-3 cursor-pointer group" onClick={() => toggleActive(hotel.id, hotel.is_active)}>
                                                                    {hotel.is_active ? <XCircle className="w-4 h-4 mr-3 text-red-500" /> : <ShieldCheck className="w-4 h-4 mr-3 text-emerald-500" />}
                                                                    <span className="font-bold text-foreground">{hotel.is_active ? 'Restrict Account' : 'Grant Full Access'}</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem className="rounded-xl py-3 cursor-pointer group" onClick={() => toast({ title: 'Subscription Manager', description: 'Redirecting to payment gateway...' })}>
                                                                    <CreditCard className="w-4 h-4 mr-3 text-indigo-500" />
                                                                    <span className="font-bold text-foreground">Manage Billing</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator className="bg-muted/30" />
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
                        <Card className="border-border shadow-sm rounded-2xl p-8 bg-background min-h-[400px]">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-foreground tracking-tight">System User Governance</h3>
                                    <p className="text-sm text-muted-foreground font-medium mt-1">Review and manage platform administration levels.</p>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        placeholder="Filter by email address..."
                                        className="bg-muted/30 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm w-80 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
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
                                    <div key={u.id} className="p-6 rounded-2xl border border-border bg-muted/30/30 hover:border-indigo-100 hover:bg-background hover:shadow-xl hover:shadow-slate-100/50 transition-all group relative overflow-hidden">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center shadow-sm border border-border text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                                <UserIcon className="w-6 h-6" />
                                            </div>
                                            <Badge className={`rounded-lg px-3 py-1 font-black text-[9px] uppercase tracking-widest ${
                                                u.role === 'SUPER_ADMIN' ? 'bg-indigo-600 text-white border-none' : 'bg-slate-200 text-muted-foreground'
                                            }`}>
                                                {u.role}
                                            </Badge>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-bold text-foreground truncate">{u.email}</p>
                                            <p className="text-[11px] text-muted-foreground font-bold tracking-tight uppercase">Joined: {format(new Date(u.created_at), 'dd MMM yyyy')}</p>
                                        </div>
                                        <div className="mt-6 pt-6 border-t border-border flex items-center gap-2">
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

                    {/* Audit Logs Tab Content */}
                    <TabsContent value="audit" className="mt-0">
                        <Card className="border-border shadow-sm rounded-2xl p-8 bg-background min-h-[400px]">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-foreground tracking-tight">Security Audit & Activity Trail</h3>
                                    <p className="text-sm text-muted-foreground font-medium mt-1">Immutable record of enterprise administration events and system modifications.</p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="rounded-xl border-border bg-background font-bold h-11 px-6 hover:bg-muted/30 transition-colors"
                                    onClick={() => refetchAudit()}
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh Trail
                                </Button>
                            </div>

                            <div className="overflow-x-auto border border-border rounded-2xl">
                                <Table>
                                    <TableHeader className="bg-muted/30/80 border-b border-border">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 pl-6">Timestamp</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operator Email</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action Type</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description / Details</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-6">IP Address</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoadingAudit ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-64 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                                        <span className="text-sm font-bold text-muted-foreground animate-pulse">Loading Audit Logs...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : auditLogs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-64 text-center text-muted-foreground font-bold italic">
                                                    No audit log trail recorded yet.
                                                </TableCell>
                                            </TableRow>
                                        ) : auditLogs.map((log) => (
                                            <TableRow key={log.id} className="hover:bg-muted/30/50 transition-colors border-border">
                                                <TableCell className="py-4 pl-6 text-xs font-mono font-medium text-muted-foreground whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                                        {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm:ss')}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-bold text-foreground text-xs">
                                                    {log.user_email}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className="rounded-lg px-2.5 py-1 font-black text-[9px] uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
                                                        {log.action}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground font-medium max-w-md">
                                                    {log.description}
                                                </TableCell>
                                                <TableCell className="text-right pr-6 font-mono text-[11px] text-muted-foreground">
                                                    {log.ip_address}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* Broadcasts Tab Content */}
                    <TabsContent value="broadcasts" className="mt-0">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <Card className="border-border shadow-sm rounded-2xl p-8 bg-background lg:col-span-1 h-fit">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100">
                                        <Radio className="w-5 h-5 animate-pulse" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-foreground tracking-tight">New Broadcast Banner</h4>
                                        <p className="text-xs text-muted-foreground font-medium">Instantly alert all tenant dashboards.</p>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Banner Title</label>
                                        <Input
                                            placeholder="e.g. Scheduled System Upkeep"
                                            className="h-12 bg-muted/30 border-border rounded-xl font-medium focus:ring-2 focus:ring-indigo-100"
                                            value={broadcastTitle}
                                            onChange={(e) => setBroadcastTitle(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Announcement Message</label>
                                        <textarea
                                            placeholder="Provide complete maintenance windows or platform updates..."
                                            rows={4}
                                            className="w-full p-4 bg-muted/30 border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none resize-none"
                                            value={broadcastMessage}
                                            onChange={(e) => setBroadcastMessage(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Severity Classification</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: 'Info', value: 'info', bg: 'bg-blue-50 text-blue-600 border-blue-200' },
                                                { label: 'Warning', value: 'warning', bg: 'bg-amber-50 text-amber-600 border-amber-200' },
                                                { label: 'Success', value: 'success', bg: 'bg-emerald-50 text-emerald-600 border-emerald-200' }
                                            ].map((t) => (
                                                <button
                                                    key={t.value}
                                                    type="button"
                                                    onClick={() => setBroadcastType(t.value)}
                                                    className={`py-3 px-4 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                                        broadcastType === t.value ? `${t.bg} shadow-md scale-105 ring-2 ring-indigo-600/20` : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                                                    }`}
                                                >
                                                    {t.value === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> : null}
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-indigo-100 transition-all gap-2"
                                        disabled={!broadcastTitle || !broadcastMessage || createBroadcastMutation.isPending}
                                        onClick={() => createBroadcastMutation.mutate({
                                            title: broadcastTitle,
                                            message: broadcastMessage,
                                            type: broadcastType
                                        })}
                                    >
                                        <Send className="w-4 h-4" /> Publish Global Broadcast
                                    </Button>
                                </div>
                            </Card>

                            <Card className="border-border shadow-sm rounded-2xl p-8 bg-background lg:col-span-2 min-h-[400px]">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-2xl font-black text-foreground tracking-tight">Active Platform Broadcasts</h3>
                                        <p className="text-sm text-muted-foreground font-medium mt-1">Manage global announcement banners appearing on all client interfaces.</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="rounded-xl border-border bg-background font-bold h-11 px-6 hover:bg-muted/30 transition-colors"
                                        onClick={() => refetchBroadcasts()}
                                    >
                                        <RefreshCw className="w-4 h-4 mr-2" /> Sync Banners
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    {isLoadingBroadcasts ? (
                                        <div className="h-64 flex flex-col items-center justify-center gap-3">
                                            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-sm font-bold text-muted-foreground animate-pulse">Syncing Broadcast Channels...</span>
                                        </div>
                                    ) : broadcasts.length === 0 ? (
                                        <div className="h-64 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center p-8 bg-muted/30/50">
                                            <Radio className="w-12 h-12 text-slate-300 mb-3 animate-pulse" />
                                            <h5 className="text-base font-bold text-foreground">No Active Announcements</h5>
                                            <p className="text-xs text-muted-foreground font-medium max-w-sm mt-1">Create a broadcast banner using the control module to broadcast live alerts across the enterprise.</p>
                                        </div>
                                    ) : broadcasts.map((b) => (
                                        <div
                                            key={b.id}
                                            className={`p-6 rounded-2xl border flex items-start justify-between gap-6 transition-all shadow-sm hover:shadow-md ${
                                                b.type === 'warning' ? 'bg-amber-50/60 border-amber-200' : b.type === 'success' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-blue-50/60 border-blue-200'
                                            }`}
                                        >
                                            <div className="flex gap-4 items-start">
                                                <div className={`p-3 rounded-2xl border ${
                                                    b.type === 'warning' ? 'bg-amber-100 text-amber-700 border-amber-200' : b.type === 'success' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                                                }`}>
                                                    <Radio className="w-6 h-6 animate-pulse" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="text-base font-black text-foreground tracking-tight">{b.title}</h4>
                                                        <Badge className={`rounded-lg px-2.5 py-0.5 font-black text-[9px] uppercase tracking-wider ${
                                                            b.type === 'warning' ? 'bg-amber-600 text-white' : b.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                                                        }`}>
                                                            {b.type}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs font-medium text-foreground leading-relaxed">{b.message}</p>
                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono pt-1">
                                                        <Clock className="w-3 h-3 text-muted-foreground" /> Broadcasted: {format(new Date(b.created_at), 'dd MMM yyyy, HH:mm')}
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="rounded-xl hover:bg-background hover:text-red-600 hover:shadow-sm transition-all text-muted-foreground self-center"
                                                onClick={() => {
                                                    if (confirm("Deactivate and remove this platform broadcast?")) {
                                                        deleteBroadcastMutation.mutate(b.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Quotas & Credit Limits Modal */}
                <Dialog open={!!selectedQuotaHotel} onOpenChange={(open) => !open && setSelectedQuotaHotel(null)}>
                    <DialogContent className="max-w-md bg-background p-8 rounded-3xl border border-border shadow-2xl">
                        <DialogHeader className="space-y-2">
                            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100 mb-2">
                                <Sliders className="w-6 h-6" />
                            </div>
                            <DialogTitle className="text-xl font-bold text-foreground">Enterprise Quotas & Usage Limits</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground font-medium">
                                Configure dedicated messaging credits and AI agent interaction caps for <span className="font-bold text-foreground">{selectedQuotaHotel?.name}</span>.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 my-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp Notification Credits
                                </label>
                                <Input
                                    type="number"
                                    className="h-12 bg-muted/30 border-border rounded-xl font-bold text-foreground"
                                    value={whatsappCredits}
                                    onChange={(e) => setWhatsappCredits(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Zap className="w-3.5 h-3.5 text-amber-500" /> SMS Dispatch Credits
                                </label>
                                <Input
                                    type="number"
                                    className="h-12 bg-muted/30 border-border rounded-xl font-bold text-foreground"
                                    value={smsCredits}
                                    onChange={(e) => setSmsCredits(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <BrainCircuit className="w-3.5 h-3.5 text-indigo-500" /> AI Agent Interaction Limit
                                </label>
                                <Input
                                    type="number"
                                    className="h-12 bg-muted/30 border-border rounded-xl font-bold text-foreground"
                                    value={aiUsageLimit}
                                    onChange={(e) => setAiUsageLimit(e.target.value)}
                                />
                            </div>
                        </div>

                        <DialogFooter className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 rounded-xl h-12 font-bold hover:bg-muted/30"
                                onClick={() => setSelectedQuotaHotel(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 rounded-xl h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-100"
                                disabled={updateQuotasMutation.isPending}
                                onClick={() => {
                                    if (!selectedQuotaHotel) return;
                                    updateQuotasMutation.mutate({
                                        id: selectedQuotaHotel.id,
                                        data: {
                                            whatsapp_credits: parseInt(whatsappCredits, 10) || 0,
                                            sms_credits: parseInt(smsCredits, 10) || 0,
                                            ai_usage_limit: parseInt(aiUsageLimit, 10) || 0,
                                        }
                                    });
                                }}
                            >
                                Save Enterprise Limits
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}
