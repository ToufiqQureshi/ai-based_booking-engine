import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ShieldCheck,
    Building2,
    User as UserIcon,
    CreditCard,
    Zap,
    Bot,
    TrendingUp,
    CheckCircle2,
    XCircle,
    Search,
    RefreshCw,
    ExternalLink,
    MoreVertical,
    FileDown,
    Trash2
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
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse">Checking credentials...</p>
                </div>
            </div>
        );
    }

    // Layer 1: Role Enforcement
    if (!user || user.role !== 'SUPER_ADMIN') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="max-w-md w-full border-none shadow-2xl">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                            <XCircle className="w-10 h-10" />
                        </div>
                        <CardTitle className="text-2xl font-black text-slate-900">Access Denied</CardTitle>
                        <CardDescription className="text-slate-500 font-medium">
                            This area is restricted to authorized platform administrators only.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-slate-100 rounded-xl text-xs font-mono text-slate-600 break-all">
                            Error: Insufficient privileges for path /superadmin
                        </div>
                        <Button
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12"
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

    const handleDelete = (id: string, name: string) => {
        if (window.confirm(`Are you sure you want to delete ${name}? This will remove all associated data.`)) {
            deleteHotelMutation.mutate(id);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse">Loading Master Control...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-20">
            {/* Header Area */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                <ShieldCheck className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Master Control</h1>
                                <p className="text-slate-500 font-medium flex items-center gap-2">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    Global Platform Administration
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                className="bg-white border-slate-200 hover:bg-slate-50 font-bold"
                                onClick={() => refetch()}
                            >
                                <RefreshCw className="w-4 h-4 mr-2" /> Sync Data
                            </Button>
                            <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 font-bold">
                                <FileDown className="w-4 h-4 mr-2" /> Export Report
                            </Button>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
                        {[
                            { label: 'Total Hotels', value: hotels.length, icon: Building2, color: 'indigo' },
                            { label: 'Active Subscriptions', value: hotels.filter(h => h.subscription?.status === 'active').length, icon: CreditCard, color: 'emerald' },
                            { label: 'AI Features Active', value: hotels.filter(h => h.feature_ai_agent).length, icon: Bot, color: 'violet' },
                            { label: 'Global Admins', value: users.filter((u: any) => u.role === 'SUPER_ADMIN').length, icon: ShieldCheck, color: 'rose' }
                        ].map((stat, i) => (
                            <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all duration-300 group">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-slate-500 mb-1 uppercase tracking-wider">{stat.label}</p>
                                            <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                                        </div>
                                        <div className={`w-12 h-12 rounded-xl bg-${stat.color}-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                            <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>

            <Tabs defaultValue="hotels" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
                <TabsList className="bg-white p-1 border border-slate-200 rounded-xl mb-6 shadow-sm">
                    <TabsTrigger value="hotels" className="px-8 py-2.5 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold transition-all">
                        Hotels Management
                    </TabsTrigger>
                    <TabsTrigger value="team" className="px-8 py-2.5 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold transition-all">
                        Team & Roles
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="hotels">
                    <Card className="border-none shadow-sm overflow-hidden bg-white">
                        <CardHeader className="border-b border-slate-100 p-8">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-2xl font-bold text-slate-900">Hotel Management</CardTitle>
                                    <CardDescription className="text-slate-500 font-medium">Manage feature access, subscriptions and hotel status.</CardDescription>
                                </div>
                                <div className="relative w-full md:w-96">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        placeholder="Search by hotel name or email..."
                                        className="pl-10 bg-slate-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-500 h-11"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="hover:bg-transparent border-slate-100">
                                        <TableHead className="font-bold text-slate-700 py-5 pl-8">Hotel Details</TableHead>
                                        <TableHead className="font-bold text-slate-700">Subscription</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-center">AI Assistant</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-center">Guest Bot</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-center">Rate Shopper</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-right">Status</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {hotels.filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase())).map((hotel) => (
                                        <TableRow key={hotel.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                                            <TableCell className="py-6 pl-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs uppercase">
                                                        {hotel.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 flex items-center gap-1">
                                                            {hotel.name}
                                                            <ExternalLink className="w-3 h-3 text-slate-300" />
                                                        </div>
                                                        <div className="text-xs font-medium text-slate-400">{hotel.owner_email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <Badge variant="outline" className="w-fit text-red-500 border-red-100 bg-red-50 font-bold text-[10px] uppercase tracking-wider">
                                                        {hotel.subscription?.plan || 'Free'}
                                                    </Badge>
                                                    <span className="text-[10px] text-slate-400 font-medium mt-1">No Expiry</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Switch
                                                    checked={hotel.feature_ai_agent}
                                                    onCheckedChange={(checked) => updateMutation.mutate({ id: hotel.id, data: { feature_ai_agent: checked } })}
                                                    className="data-[state=checked]:bg-indigo-600"
                                                />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Switch
                                                    checked={hotel.feature_guest_bot}
                                                    onCheckedChange={(checked) => updateMutation.mutate({ id: hotel.id, data: { feature_guest_bot: checked } })}
                                                    className="data-[state=checked]:bg-indigo-600"
                                                />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Switch
                                                    checked={hotel.feature_rate_shopper}
                                                    onCheckedChange={(checked) => updateMutation.mutate({ id: hotel.id, data: { feature_rate_shopper: checked } })}
                                                    className="data-[state=checked]:bg-indigo-600"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <Badge variant={hotel.is_active ? "outline" : "destructive"} className={hotel.is_active ? "text-emerald-600 border-emerald-200 bg-emerald-50 font-black px-3 py-1" : "font-black px-3 py-1"}>
                                                    {hotel.is_active ? 'ACTIVE' : 'LOCKED'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="pr-8">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-slate-100 transition-all">
                                                            <MoreVertical className="w-5 h-5 text-slate-400" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-xl border-slate-100">
                                                        <DropdownMenuLabel className="text-xs uppercase font-bold text-slate-400 tracking-widest px-3 py-2">Actions</DropdownMenuLabel>
                                                        <DropdownMenuSeparator className="bg-slate-50" />
                                                        <DropdownMenuItem
                                                            className="rounded-lg font-bold text-slate-700 py-2.5 cursor-pointer"
                                                            onClick={() => toggleActive(hotel.id, hotel.is_active)}
                                                        >
                                                            {hotel.is_active ? <XCircle className="mr-3 w-4 h-4 text-red-500" /> : <CheckCircle2 className="mr-3 w-4 h-4 text-emerald-500" />}
                                                            {hotel.is_active ? 'Disable Account' : 'Enable Account'}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="rounded-lg font-bold text-slate-700 py-2.5 cursor-pointer">
                                                            <CreditCard className="mr-3 w-4 h-4 text-indigo-500" /> Manage Subscription
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator className="bg-slate-50" />
                                                        <DropdownMenuItem
                                                            className="rounded-lg font-bold text-red-600 focus:text-red-700 py-2.5 cursor-pointer hover:bg-red-50"
                                                            onClick={() => handleDelete(hotel.id, hotel.name)}
                                                        >
                                                            <Trash2 className="mr-3 w-4 h-4" /> Delete Hotel Data
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="team">
                    <Card className="border-none shadow-sm overflow-hidden bg-white">
                        <CardHeader className="border-b border-slate-100 p-8">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-2xl font-bold text-slate-900">Team Management</CardTitle>
                                    <CardDescription className="text-slate-500 font-medium">Promote users to Super Admin to give them global access.</CardDescription>
                                </div>
                                <div className="relative w-full md:w-96">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        placeholder="Search by name or email..."
                                        className="pl-10 bg-slate-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-500 h-11"
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="hover:bg-transparent border-slate-100">
                                    <TableHead className="font-bold text-slate-700 py-5 pl-8">User</TableHead>
                                    <TableHead className="font-bold text-slate-700">Email</TableHead>
                                    <TableHead className="font-bold text-slate-700">Current Role</TableHead>
                                    <TableHead className="font-bold text-slate-700">Joined</TableHead>
                                    <TableHead className="font-bold text-slate-700 text-right pr-8">Access Level</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((u: any) => (
                                    <TableRow key={u.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                                        <TableCell className="font-black text-slate-900 py-6 pl-8">{u.name}</TableCell>
                                        <TableCell className="font-medium text-slate-600">{u.email}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-black uppercase text-[10px] tracking-widest bg-slate-50 px-2 py-1">
                                                {u.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-slate-400 font-medium">{format(new Date(u.created_at), 'dd MMM yyyy')}</TableCell>
                                        <TableCell className="text-right pr-8">
                                            {u.role === 'SUPER_ADMIN' ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-red-600 border-red-200 hover:bg-red-50 font-black rounded-lg h-10 px-6 transition-all"
                                                    onClick={() => updateRoleMutation.mutate({ id: u.id, role: 'OWNER' })}
                                                >
                                                    Remove Admin
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    className="bg-indigo-600 hover:bg-indigo-700 font-black rounded-lg h-10 px-6 shadow-md shadow-indigo-100 transition-all"
                                                    onClick={() => updateRoleMutation.mutate({ id: u.id, role: 'SUPER_ADMIN' })}
                                                >
                                                    Make Super Admin
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
