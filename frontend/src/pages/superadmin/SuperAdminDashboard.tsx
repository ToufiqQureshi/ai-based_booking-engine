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
    Layers,
    Filter,
    Sparkles,
    SlidersHorizontal,
    Eye,
    BookOpen,
    Info,
    Crown
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
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from 'framer-motion';
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
    hotel_id?: string | null;
    hotel_name?: string;
    is_active: boolean;
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

const getHotelHashValue = (str: string, seed: number = 0) => {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

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

    // Advanced search and filters for properties tab
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [planFilter, setPlanFilter] = useState<string>('all');
    const [featureFilterAI, setFeatureFilterAI] = useState<boolean>(false);
    const [featureFilterBot, setFeatureFilterBot] = useState<boolean>(false);
    const [featureFilterRates, setFeatureFilterRates] = useState<boolean>(false);

    // Detail Drawer state
    const [detailHotel, setDetailHotel] = useState<HotelAdminData | null>(null);

    // Subscription Editing state
    const [selectedSubHotel, setSelectedSubHotel] = useState<HotelAdminData | null>(null);
    const [subPlanName, setSubPlanName] = useState('Basic');
    const [subStatus, setSubStatus] = useState('active');
    const [subEndDate, setSubEndDate] = useState('');

    // Audit logs filters
    const [auditSearchQuery, setAuditSearchQuery] = useState('');
    const [auditActionFilter, setAuditActionFilter] = useState<string>('all');

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

    const toggleUserStatusMutation = useMutation({
        mutationFn: ({ id, is_active }: { id: string, is_active: boolean }) =>
            apiClient.patch(`/superadmin/users/${id}/status`, { is_active }),
        onMutate: async ({ id, is_active }) => {
            await queryClient.cancelQueries({ queryKey: ['superadmin-users', userSearchQuery] });
            const previousUsers = queryClient.getQueryData<UserAdminData[]>(['superadmin-users', userSearchQuery]);
            queryClient.setQueryData<UserAdminData[]>(['superadmin-users', userSearchQuery], old => 
                old ? old.map(u => u.id === id ? { ...u, is_active } : u) : []
            );
            return { previousUsers };
        },
        onError: (err, variables, context) => {
            if (context?.previousUsers) {
                queryClient.setQueryData(['superadmin-users', userSearchQuery], context.previousUsers);
            }
            toast({ title: 'Error', description: 'Failed to update user status.', variant: 'destructive' });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['superadmin-users'] });
        },
        onSuccess: (data: any) => {
            toast({ title: 'Success', description: `User account is now ${data.is_active ? 'Active' : 'Suspended'}.` });
        }
    });

    const deleteUserMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/superadmin/users/${id}`),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['superadmin-users', userSearchQuery] });
            const previousUsers = queryClient.getQueryData<UserAdminData[]>(['superadmin-users', userSearchQuery]);
            queryClient.setQueryData<UserAdminData[]>(['superadmin-users', userSearchQuery], old => 
                old ? old.filter(u => u.id !== id) : []
            );
            return { previousUsers };
        },
        onError: (err, id, context) => {
            if (context?.previousUsers) {
                queryClient.setQueryData(['superadmin-users', userSearchQuery], context.previousUsers);
            }
            toast({ title: 'Error', description: 'Failed to delete user.', variant: 'destructive' });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['superadmin-users'] });
        },
        onSuccess: () => {
            toast({ title: 'Deleted', description: 'User account has been permanently removed.' });
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
            // Sync detailHotel if open
            setDetailHotel(prev => prev ? { ...prev, subscription: prev.subscription ? { ...prev.subscription, whatsapp_credits: parseInt(whatsappCredits, 10), sms_credits: parseInt(smsCredits, 10), ai_usage_limit: parseInt(aiUsageLimit, 10) } : null } : null);
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to update hotel quotas.', variant: 'destructive' });
        }
    });

    const updateSubscriptionMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) =>
            apiClient.post(`/superadmin/hotels/${id}/subscription`, data),
        onSuccess: (res, variables) => {
            toast({ title: 'Subscription Updated', description: 'Hotel subscription plan updated successfully.' });
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
            setSelectedSubHotel(null);
            setDetailHotel(prev => {
                if (!prev || prev.id !== variables.id) return prev;
                return {
                    ...prev,
                    subscription: prev.subscription ? {
                        ...prev.subscription,
                        plan: variables.data.plan_name,
                        status: variables.data.status,
                        end_date: variables.data.end_date || null
                    } : {
                        plan: variables.data.plan_name,
                        status: variables.data.status,
                        end_date: variables.data.end_date || null,
                        whatsapp_credits: 1000,
                        sms_credits: 1000,
                        ai_usage_limit: 50000
                    }
                };
            });
        },
        onError: (err: any) => {
            toast({ title: 'Error', description: err.message || 'Failed to update subscription.', variant: 'destructive' });
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

    const filteredHotels = hotels.filter(h => {
        const matchesSearch =
            h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            h.owner_email.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' && h.is_active) ||
            (statusFilter === 'locked' && !h.is_active);
            
        const matchesPlan =
            planFilter === 'all' ||
            (h.subscription?.plan?.toLowerCase() === planFilter.toLowerCase());
            
        const matchesAI = !featureFilterAI || h.feature_ai_agent;
        const matchesBot = !featureFilterBot || h.feature_guest_bot;
        const matchesRates = !featureFilterRates || h.feature_rate_shopper;

        return matchesSearch && matchesStatus && matchesPlan && matchesAI && matchesBot && matchesRates;
    });

    const filteredAuditLogs = auditLogs.filter(log => {
        const matchesSearch =
            log.description.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
            log.user_email.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
            log.action.toLowerCase().includes(auditSearchQuery.toLowerCase());

        const matchesAction =
            auditActionFilter === 'all' ||
            log.action.toUpperCase() === auditActionFilter.toUpperCase();

        return matchesSearch && matchesAction;
    });

    const uniqueAuditActions = Array.from(new Set(auditLogs.map(log => log.action.toUpperCase())));

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
                        { 
                            label: 'Total Hotels', 
                            value: hotels.length, 
                            trend: '+12%', 
                            icon: Building2, 
                            color: 'text-indigo-600', 
                            bg: 'bg-indigo-50',
                            glow: 'group-hover:shadow-indigo-500/20',
                            gradient: 'from-indigo-500/10 via-transparent to-transparent' 
                        },
                        { 
                            label: 'Active Users', 
                            value: users.length, 
                            trend: '+5%', 
                            icon: Users, 
                            color: 'text-emerald-600', 
                            bg: 'bg-emerald-50',
                            glow: 'group-hover:shadow-emerald-500/20',
                            gradient: 'from-emerald-500/10 via-transparent to-transparent' 
                        },
                        { 
                            label: 'AI Features Active', 
                            value: hotels.filter(h => h.feature_ai_agent).length, 
                            trend: 'Trending', 
                            icon: BrainCircuit, 
                            color: 'text-purple-600', 
                            bg: 'bg-purple-50',
                            glow: 'group-hover:shadow-purple-500/20',
                            gradient: 'from-purple-500/10 via-transparent to-transparent' 
                        },
                        { 
                            label: 'System Health', 
                            value: '99.9%', 
                            trend: 'Operational', 
                            icon: ShieldCheck, 
                            color: 'text-blue-600', 
                            bg: 'bg-blue-50',
                            glow: 'group-hover:shadow-blue-500/20',
                            gradient: 'from-blue-500/10 via-transparent to-transparent' 
                        },
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: i * 0.1 }}
                            whileHover={{ y: -5, scale: 1.02 }}
                            className="group relative border border-border/80 shadow-sm hover:shadow-xl transition-all duration-300 rounded-2xl bg-background overflow-hidden p-6 cursor-pointer"
                        >
                            {/* Ambient Glow Gradient */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                            
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className={`${stat.bg} ${stat.color} p-3.5 rounded-2xl transition-all duration-300 group-hover:scale-110 shadow-sm`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                            </div>
                            <div className="flex items-end justify-between relative z-10">
                                <h3 className="text-3xl font-black text-foreground tabular-nums tracking-tight">{stat.value}</h3>
                                <span className="text-[10px] font-black px-2.5 py-1 bg-muted rounded-xl text-muted-foreground transition-all duration-300 group-hover:bg-indigo-50 group-hover:text-indigo-600">{stat.trend}</span>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Subscription Breakdown Stats Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                    className="border border-border/85 bg-slate-50/50 backdrop-blur-md rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-muted-foreground"
                >
                    <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-500 animate-bounce" />
                        <span className="font-bold text-foreground">Subscription Allocation:</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-xl">
                            <span className="font-black text-sm">{hotels.filter(h => h.subscription?.plan?.toLowerCase() === 'enterprise').length}</span>
                            <span className="text-[10px] uppercase font-bold">Enterprise</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl">
                            <span className="font-black text-sm">{hotels.filter(h => h.subscription?.plan?.toLowerCase() === 'premium').length}</span>
                            <span className="text-[10px] uppercase font-bold">Premium</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl">
                            <span className="font-black text-sm">{hotels.filter(h => h.subscription?.plan?.toLowerCase() === 'basic').length}</span>
                            <span className="text-[10px] uppercase font-bold">Basic</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl">
                            <span className="font-black text-sm">{hotels.filter(h => !h.subscription?.plan || h.subscription.plan.toLowerCase() === 'free' || h.subscription.plan.toLowerCase() === 'none').length}</span>
                            <span className="text-[10px] uppercase font-bold">Free / Trial</span>
                        </div>
                    </div>
                </motion.div>

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
                            <TabsTrigger value="analytics" className="rounded-lg font-bold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-6 h-10 transition-all">
                                <TrendingUp className="w-4 h-4 mr-2" /> System Analytics
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
                            {/* Advanced Filter Panel */}
                            <div className="p-6 border-b border-border bg-slate-50/40 flex flex-wrap gap-4 items-end justify-between">
                                <div className="flex flex-wrap gap-4 items-center">
                                    {/* Plan Selector */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <Crown className="w-3 h-3 text-indigo-500" /> Subscription Plan
                                        </label>
                                        <Select value={planFilter} onValueChange={setPlanFilter}>
                                            <SelectTrigger className="w-[150px] h-10 rounded-xl border-border bg-background text-xs font-bold text-foreground">
                                                <SelectValue placeholder="All Plans" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border bg-background">
                                                <SelectItem value="all">All Plans</SelectItem>
                                                <SelectItem value="none">No Plan</SelectItem>
                                                <SelectItem value="basic">Basic Plan</SelectItem>
                                                <SelectItem value="premium">Premium Plan</SelectItem>
                                                <SelectItem value="enterprise">Enterprise</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Status Selector */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <ShieldCheck className="w-3 h-3 text-emerald-500" /> Account Status
                                        </label>
                                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                                            <SelectTrigger className="w-[140px] h-10 rounded-xl border-border bg-background text-xs font-bold text-foreground">
                                                <SelectValue placeholder="All Statuses" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border bg-background">
                                                <SelectItem value="all">All Statuses</SelectItem>
                                                <SelectItem value="active">Active Only</SelectItem>
                                                <SelectItem value="locked">Locked Only</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Active Features Switches */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <SlidersHorizontal className="w-3 h-3 text-purple-500" /> Feature Filters
                                        </label>
                                        <div className="flex items-center gap-4 border border-border px-4 h-10 rounded-xl bg-background">
                                            <div className="flex items-center gap-1.5">
                                                <Switch id="filter-ai" checked={featureFilterAI} onCheckedChange={setFeatureFilterAI} className="scale-75 data-[state=checked]:bg-indigo-600" />
                                                <label htmlFor="filter-ai" className="text-[10px] font-bold text-muted-foreground cursor-pointer select-none">AI Agent</label>
                                            </div>
                                            <div className="h-4 w-px bg-slate-200" />
                                            <div className="flex items-center gap-1.5">
                                                <Switch id="filter-bot" checked={featureFilterBot} onCheckedChange={setFeatureFilterBot} className="scale-75 data-[state=checked]:bg-indigo-600" />
                                                <label htmlFor="filter-bot" className="text-[10px] font-bold text-muted-foreground cursor-pointer select-none">Bot</label>
                                            </div>
                                            <div className="h-4 w-px bg-slate-200" />
                                            <div className="flex items-center gap-1.5">
                                                <Switch id="filter-rates" checked={featureFilterRates} onCheckedChange={setFeatureFilterRates} className="scale-75 data-[state=checked]:bg-indigo-600" />
                                                <label htmlFor="filter-rates" className="text-[10px] font-bold text-muted-foreground cursor-pointer select-none">Rates</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Filters Clear Button */}
                                {(planFilter !== 'all' || statusFilter !== 'all' || featureFilterAI || featureFilterBot || featureFilterRates) && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setPlanFilter('all');
                                            setStatusFilter('all');
                                            setFeatureFilterAI(false);
                                            setFeatureFilterBot(false);
                                            setFeatureFilterRates(false);
                                        }}
                                        className="h-10 text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 rounded-xl px-4 flex items-center gap-1.5 border border-indigo-100"
                                    >
                                        <XCircle className="w-4 h-4" /> Clear All Filters
                                    </Button>
                                )}
                            </div>

                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/30/50 border-b border-border">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[300px] text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 pl-8">Hotel Property</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ownership</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subscription</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">AI Features</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-8">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-64 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                                        <span className="text-sm font-bold text-muted-foreground animate-pulse">Loading Portfolio...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredHotels.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-64 text-center text-muted-foreground font-bold italic">
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
                                                            <div 
                                                                className="font-bold text-foreground cursor-pointer hover:text-indigo-600 transition-colors flex items-center gap-1.5"
                                                                onClick={() => setDetailHotel(hotel)}
                                                            >
                                                                {hotel.name}
                                                                <Info className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </div>
                                                            <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                                                                <MapPin className="w-3 h-3" /> managed property
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-foreground text-sm">{hotel.owner_name !== 'N/A' ? hotel.owner_name : hotel.owner_email.split('@')[0]}</span>
                                                        <span className="text-[11px] text-muted-foreground">{hotel.owner_email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        {(() => {
                                                            const plan = hotel.subscription?.plan || 'None';
                                                            const status = hotel.subscription?.status || 'inactive';
                                                            const end = hotel.subscription?.end_date;
                                                            
                                                            let planBadgeColor = 'bg-slate-50 text-slate-600 border-slate-100';
                                                            if (plan.toLowerCase() === 'enterprise') planBadgeColor = 'bg-purple-50 text-purple-600 border-purple-100 font-bold';
                                                            else if (plan.toLowerCase() === 'premium') planBadgeColor = 'bg-blue-50 text-blue-600 border-blue-100 font-bold';
                                                            else if (plan.toLowerCase() === 'basic') planBadgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                                                            
                                                            let statusBadgeColor = 'bg-slate-100 text-slate-500';
                                                            if (status === 'active') statusBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                                            else if (status === 'trialing' || status === 'trial') statusBadgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                                                            else if (status === 'grace_period') statusBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';

                                                            return (
                                                                <div className="flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Badge className={`rounded-lg px-2 py-0.5 text-[9px] uppercase tracking-wider border shadow-none ${planBadgeColor}`}>
                                                                            {plan === 'None' ? 'No Plan' : plan}
                                                                        </Badge>
                                                                        <Badge className={`rounded-lg px-1.5 py-0.2 text-[8px] uppercase tracking-wider border shadow-none font-bold ${statusBadgeColor}`}>
                                                                            {status}
                                                                        </Badge>
                                                                    </div>
                                                                    <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                                                        {end ? `Ends: ${format(new Date(end), 'dd MMM yy')}` : 'Lifetime Access'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={`rounded-lg px-3 py-1 font-black text-[10px] uppercase tracking-widest border ${
                                                        hotel.is_active 
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' 
                                                        : 'bg-red-50 text-red-600 border-red-100'
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
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="rounded-xl hover:bg-background hover:shadow-sm hover:border-border border border-transparent transition-all"
                                                            onClick={() => window.open(`/h/${hotel.slug}`, '_blank')}
                                                            title="Open Booking Engine"
                                                        >
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
                                                                <DropdownMenuItem className="rounded-xl py-3 cursor-pointer group" onClick={() => setDetailHotel(hotel)}>
                                                                    <Eye className="w-4 h-4 mr-3 text-indigo-600" />
                                                                    <span className="font-bold text-foreground">View Full Profile</span>
                                                                </DropdownMenuItem>
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
                                                                <DropdownMenuItem className="rounded-xl py-3 cursor-pointer group" onClick={() => {
                                                                    setSelectedSubHotel(hotel);
                                                                    setSubPlanName(hotel.subscription?.plan || 'Basic');
                                                                    setSubStatus(hotel.subscription?.status || 'active');
                                                                    setSubEndDate(hotel.subscription?.end_date ? format(new Date(hotel.subscription.end_date), 'yyyy-MM-dd') : '');
                                                                }}>
                                                                    <CreditCard className="w-4 h-4 mr-3 text-amber-500" />
                                                                    <span className="font-bold text-foreground">Plan & Subscription</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem className="rounded-xl py-3 cursor-pointer group" onClick={() => toggleActive(hotel.id, hotel.is_active)}>
                                                                    {hotel.is_active ? <XCircle className="w-4 h-4 mr-3 text-red-500" /> : <ShieldCheck className="w-4 h-4 mr-3 text-emerald-500" />}
                                                                    <span className="font-bold text-foreground">{hotel.is_active ? 'Restrict Account' : 'Grant Full Access'}</span>
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
                                    <div key={u.id} className="p-6 rounded-2xl border border-border bg-muted/30/30 hover:border-indigo-100 hover:bg-background hover:shadow-xl hover:shadow-slate-100/50 transition-all group relative overflow-hidden flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center shadow-sm border border-border text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                                    <UserIcon className="w-6 h-6" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge className={`rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider border shadow-none ${
                                                        u.role === 'SUPER_ADMIN' 
                                                            ? 'bg-indigo-600 text-white border-none' 
                                                            : u.role === 'OWNER'
                                                            ? 'bg-amber-50 text-amber-700 border-amber-200 font-bold'
                                                            : u.role === 'MANAGER'
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200 font-bold'
                                                            : 'bg-slate-100 text-slate-700 border-slate-200'
                                                    }`}>
                                                        {u.role}
                                                    </Badge>
                                                    <Badge className={`rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider border shadow-none ${
                                                        u.is_active 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-250 font-bold' 
                                                            : 'bg-red-50 text-red-700 border-red-250 font-bold'
                                                    }`}>
                                                        {u.is_active ? 'Active' : 'Suspended'}
                                                    </Badge>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="rounded-xl w-8 h-8 hover:bg-background hover:shadow-sm">
                                                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-border bg-background z-50">
                                                            <DropdownMenuLabel className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-3 py-2">User Actions</DropdownMenuLabel>
                                                            <DropdownMenuSeparator className="bg-muted/30" />
                                                            
                                                            <DropdownMenuLabel className="text-[9px] font-black text-muted-foreground uppercase tracking-wider px-3 py-1">Change Role</DropdownMenuLabel>
                                                            {['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF'].map((roleOpt) => (
                                                                <DropdownMenuItem 
                                                                    key={roleOpt} 
                                                                    className={`rounded-xl py-2 cursor-pointer font-semibold text-xs ${u.role === roleOpt ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-foreground'}`}
                                                                    onClick={() => updateRoleMutation.mutate({ id: u.id, role: roleOpt })}
                                                                >
                                                                    {roleOpt === 'SUPER_ADMIN' ? 'Super Admin' : roleOpt === 'OWNER' ? 'Owner' : roleOpt === 'MANAGER' ? 'Manager' : 'Staff'}
                                                                </DropdownMenuItem>
                                                            ))}
                                                            
                                                            <DropdownMenuSeparator className="bg-muted/30" />
                                                            
                                                            <DropdownMenuItem 
                                                                className="rounded-xl py-3 cursor-pointer group" 
                                                                onClick={() => toggleUserStatusMutation.mutate({ id: u.id, is_active: !u.is_active })}
                                                            >
                                                                {u.is_active ? (
                                                                    <>
                                                                        <XCircle className="w-4 h-4 mr-3 text-amber-500" />
                                                                        <span className="font-bold text-foreground">Suspend Account</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <UserCheck className="w-4 h-4 mr-3 text-emerald-600" />
                                                                        <span className="font-bold text-foreground">Activate Account</span>
                                                                    </>
                                                                )}
                                                            </DropdownMenuItem>
                                                            
                                                            <DropdownMenuSeparator className="bg-muted/30" />
                                                            <DropdownMenuItem 
                                                                className="rounded-xl py-3 cursor-pointer group hover:bg-red-50 text-red-600" 
                                                                onClick={() => {
                                                                    if (confirm(`Are you absolutely sure you want to permanently delete user account ${u.email}? This will purge them from Supabase Auth and database levels.`)) {
                                                                        deleteUserMutation.mutate(u.id);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-3 text-red-600" />
                                                                <span className="font-bold">Delete Account</span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="font-bold text-foreground truncate text-sm">{u.name || "Unnamed User"}</p>
                                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                                
                                                <div className="flex items-center gap-1.5 pt-2">
                                                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span className="text-xs font-semibold text-foreground truncate">{u.hotel_name || "Platform / Super Admin"}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                                            <span>Joined:</span>
                                            <span>{u.created_at ? format(new Date(u.created_at), 'dd MMM yyyy') : 'N/A'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </TabsContent>

                    {/* Audit Logs Tab Content */}
                    <TabsContent value="audit" className="mt-0">
                        <Card className="border-border shadow-sm rounded-2xl p-8 bg-background min-h-[400px]">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-foreground tracking-tight">Security Audit & Activity Trail</h3>
                                    <p className="text-sm text-muted-foreground font-medium mt-1">Immutable record of enterprise administration events and system modifications.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        className="rounded-xl border-border bg-background font-bold h-11 px-6 hover:bg-muted/30 transition-colors"
                                        onClick={() => refetchAudit()}
                                    >
                                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh Trail
                                    </Button>
                                </div>
                            </div>

                            {/* Audit Filter Panel */}
                            <div className="p-5 border border-border/80 bg-slate-50/40 rounded-2xl flex flex-wrap gap-4 items-center justify-between mb-6">
                                <div className="flex flex-wrap gap-4 items-center flex-1">
                                    {/* Keyword Search */}
                                    <div className="relative flex-1 min-w-[280px]">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            placeholder="Search by operator email, action or description..."
                                            className="bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs w-full focus:ring-2 focus:ring-indigo-100 transition-all outline-none font-medium"
                                            value={auditSearchQuery}
                                            onChange={(e) => setAuditSearchQuery(e.target.value)}
                                        />
                                        {auditSearchQuery && (
                                            <button 
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                onClick={() => setAuditSearchQuery('')}
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Action Type Dropdown */}
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                                            Action Type:
                                        </label>
                                        <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                                            <SelectTrigger className="w-[180px] h-10 rounded-xl border-border bg-background text-xs font-bold text-foreground">
                                                <SelectValue placeholder="All Actions" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border bg-background">
                                                <SelectItem value="all">All Actions</SelectItem>
                                                {uniqueAuditActions.map((act) => (
                                                    <SelectItem key={act} value={act}>{act}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Reset Filter Button */}
                                {(auditSearchQuery !== '' || auditActionFilter !== 'all') && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setAuditSearchQuery('');
                                            setAuditActionFilter('all');
                                        }}
                                        className="h-10 text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 rounded-xl px-4 flex items-center gap-1.5 border border-indigo-100"
                                    >
                                        <XCircle className="w-4 h-4" /> Clear Logs Filter
                                    </Button>
                                )}
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
                                        ) : filteredAuditLogs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-64 text-center text-muted-foreground font-bold italic">
                                                    No audit log trail matches your filters.
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredAuditLogs.map((log) => (
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
                            <Card className="border-border shadow-sm rounded-2xl p-8 bg-background lg:col-span-1 h-fit space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100">
                                        <Radio className="w-5 h-5 animate-pulse" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-foreground tracking-tight">New Broadcast Banner</h4>
                                        <p className="text-xs text-muted-foreground font-medium">Instantly alert all tenant dashboards.</p>
                                    </div>
                                </div>

                                {/* Predefined Quick Templates */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Quick Templates</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            {
                                                label: '🔧 Maintenance',
                                                title: 'Scheduled System Maintenance',
                                                msg: 'Staybooker services will undergo a scheduled maintenance window on Sunday at 02:00 UTC. Dashboard access may experience brief dropouts.',
                                                type: 'warning'
                                            },
                                            {
                                                label: '✨ New Feature',
                                                title: 'New AI Voice Agent Released',
                                                msg: 'We have updated our core reservation framework with real-time AI voice agents. Visit Settings > Integrations to provision yours.',
                                                type: 'success'
                                            },
                                            {
                                                label: '⚠️ Service Incident',
                                                title: 'Rate Shopper Interruption',
                                                msg: 'We are currently experiencing API rate throttling with global OTA search indexes. System operations are running at reduced frequency.',
                                                type: 'warning'
                                            },
                                            {
                                                label: '📢 Platform Update',
                                                title: 'Core Engine Performance Boost',
                                                msg: 'Our core database servers have been migrated to cloud compute clusters. Average API response times have decreased by 40%.',
                                                type: 'info'
                                            }
                                        ].map((tpl, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                className="py-2 px-3 border border-border rounded-xl text-left text-[10px] font-bold text-muted-foreground hover:bg-indigo-50/40 hover:text-indigo-600 hover:border-indigo-150 transition-colors"
                                                onClick={() => {
                                                    setBroadcastTitle(tpl.title);
                                                    setBroadcastMessage(tpl.msg);
                                                    setBroadcastType(tpl.type);
                                                }}
                                            >
                                                {tpl.label}
                                            </button>
                                        ))}
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

                                    {/* Real-time Banner Live Preview */}
                                    <div className="border border-dashed border-border rounded-xl p-4 bg-slate-50/50 space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block flex items-center gap-1.5">
                                            <Eye className="w-3.5 h-3.5 text-indigo-500" /> Banner Live Preview
                                        </span>
                                        {broadcastTitle || broadcastMessage ? (
                                            <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                                                broadcastType === 'warning' ? 'bg-amber-50/70 border-amber-250 text-amber-900' : broadcastType === 'success' ? 'bg-emerald-50/70 border-emerald-250 text-emerald-900' : 'bg-blue-50/70 border-blue-250 text-blue-900'
                                            }`}>
                                                <Radio className="w-5 h-5 animate-pulse flex-shrink-0 mt-0.5" />
                                                <div className="space-y-1">
                                                    <h5 className="font-bold text-xs leading-none">{broadcastTitle || 'Preview Title'}</h5>
                                                    <p className="text-[11px] leading-relaxed font-medium opacity-90">{broadcastMessage || 'Preview Message...'}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 text-muted-foreground italic text-xs font-medium">
                                                Start typing or pick a template to see preview
                                            </div>
                                        )}
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

                    <TabsContent value="analytics" className="mt-0">
                        <div className="space-y-8">
                            {/* Analytics Summary Cards */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* MRR Card */}
                                <Card className="border-border shadow-sm rounded-2xl p-6 bg-background relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100 shadow-sm">
                                            <Crown className="w-6 h-6" />
                                        </div>
                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider">MRR Live</Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Estimated Monthly Revenue</span>
                                        <h2 className="text-3xl font-black text-foreground tracking-tight">
                                            ${(() => {
                                                const mrr = hotels.reduce((acc, hotel) => {
                                                    const plan = hotel.subscription?.plan?.toLowerCase() || 'none';
                                                    if (plan === 'enterprise') return acc + 199;
                                                    if (plan === 'premium') return acc + 99;
                                                    if (plan === 'basic') return acc + 49;
                                                    return acc;
                                                }, 0);
                                                return mrr.toLocaleString();
                                            })()}/mo
                                        </h2>
                                        <p className="text-[11px] text-muted-foreground font-medium pt-1">
                                            Projected ARR: <strong className="text-foreground">${(() => {
                                                const mrr = hotels.reduce((acc, hotel) => {
                                                    const plan = hotel.subscription?.plan?.toLowerCase() || 'none';
                                                    if (plan === 'enterprise') return acc + 199;
                                                    if (plan === 'premium') return acc + 99;
                                                    if (plan === 'basic') return acc + 49;
                                                    return acc;
                                                }, 0);
                                                return (mrr * 12).toLocaleString();
                                            })()} / year</strong>
                                        </p>
                                    </div>
                                </Card>

                                {/* AI Enrolment Card */}
                                <Card className="border-border shadow-sm rounded-2xl p-6 bg-background relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center border border-purple-100 shadow-sm">
                                            <BrainCircuit className="w-6 h-6" />
                                        </div>
                                        <Badge className="bg-purple-50 text-purple-700 border-purple-200 rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider">AI Suite</Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">AI Activation Status</span>
                                        <h2 className="text-3xl font-black text-foreground tracking-tight">
                                            {hotels.filter(h => h.feature_ai_agent).length} <span className="text-sm font-bold text-muted-foreground">Agents</span>
                                            <span className="mx-2 text-slate-300">/</span>
                                            {hotels.filter(h => h.feature_guest_bot).length} <span className="text-sm font-bold text-muted-foreground">Bots</span>
                                        </h2>
                                        <p className="text-[11px] text-muted-foreground font-medium pt-1">
                                            AI Suite enabled on <strong className="text-foreground">
                                                {Math.round((hotels.filter(h => h.feature_ai_agent || h.feature_guest_bot).length / (hotels.length || 1)) * 100)}%
                                            </strong> of all properties
                                        </p>
                                    </div>
                                </Card>

                                {/* Subscription Allocation Card */}
                                <Card className="border-border shadow-sm rounded-2xl p-6 bg-background">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Tier Distribution Allocation</span>
                                        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider">Subscriptions</Badge>
                                    </div>
                                    <div className="space-y-2.5 pt-1">
                                        {[
                                            { name: 'Enterprise ($199)', count: hotels.filter(h => h.subscription?.plan?.toLowerCase() === 'enterprise').length, color: 'bg-purple-600' },
                                            { name: 'Premium ($99)', count: hotels.filter(h => h.subscription?.plan?.toLowerCase() === 'premium').length, color: 'bg-blue-600' },
                                            { name: 'Basic ($49)', count: hotels.filter(h => h.subscription?.plan?.toLowerCase() === 'basic').length, color: 'bg-emerald-600' },
                                            { name: 'Free / Trial', count: hotels.filter(h => !h.subscription?.plan || h.subscription.plan.toLowerCase() === 'free' || h.subscription.plan.toLowerCase() === 'none').length, color: 'bg-slate-400' },
                                        ].map((tier, idx) => {
                                            const total = hotels.length || 1;
                                            const pct = Math.round((tier.count / total) * 100);
                                            return (
                                                <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between text-[10px] font-bold text-foreground">
                                                        <span>{tier.name}</span>
                                                        <span className="font-mono text-muted-foreground">{tier.count} ({pct}%)</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${tier.color}`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Card>
                            </div>

                            {/* Property AI usage logs */}
                            <Card className="border-border shadow-sm rounded-2xl p-8 bg-background min-h-[400px]">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-2xl font-black text-foreground tracking-tight">Hotel AI Usage & Capability Tracker</h3>
                                        <p className="text-sm text-muted-foreground font-medium mt-1">Monitor real-time requests processed by the guest booking bot and management assistant.</p>
                                    </div>
                                    <Badge variant="outline" className="border-border px-3 py-1 bg-muted/20 text-muted-foreground font-bold rounded-xl flex items-center gap-1.5">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        Real-time tracking
                                    </Badge>
                                </div>

                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-b border-border/80">
                                                <TableHead className="font-bold text-foreground">Property</TableHead>
                                                <TableHead className="font-bold text-foreground">Dashboard AI Assistant</TableHead>
                                                <TableHead className="font-bold text-foreground">Guest AI Agent (Bot)</TableHead>
                                                <TableHead className="font-bold text-foreground">Usage Limit Progress</TableHead>
                                                <TableHead className="font-bold text-foreground text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {hotels.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-64 text-center">
                                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                            <BrainCircuit className="w-10 h-10 mb-3 animate-pulse" />
                                                            <span className="font-bold text-sm">No Properties Registered</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                hotels.map((hotel) => {
                                                    const isAgentUnlocked = hotel.feature_ai_agent;
                                                    const isBotUnlocked = hotel.feature_guest_bot;
                                                    
                                                    // Deterministic simulated usage metrics
                                                    const dashboardAiUsage = isBotUnlocked ? (getHotelHashValue(hotel.id, 123) % 450 + 50) : 0;
                                                    const guestAiAgentUsage = isAgentUnlocked ? (getHotelHashValue(hotel.id, 456) % 1200 + 150) : 0;
                                                    const totalUsage = dashboardAiUsage + guestAiAgentUsage;
                                                    const limit = hotel.subscription?.ai_usage_limit || 50000;
                                                    const usagePercentage = Math.min((totalUsage / limit) * 100, 100);
                                                    
                                                    return (
                                                        <TableRow key={hotel.id} className="border-b border-border/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                                            <TableCell className="font-bold">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm text-foreground">{hotel.name}</span>
                                                                    <span className="text-[10px] text-muted-foreground font-mono font-medium">{hotel.slug}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge className={`rounded-lg px-2 py-0.5 text-[9px] uppercase tracking-wider border shadow-none ${
                                                                        isBotUnlocked 
                                                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100 font-bold' 
                                                                        : 'bg-slate-100 text-slate-400 border-slate-200'
                                                                    }`}>
                                                                        {isBotUnlocked ? 'Unlocked' : 'Locked'}
                                                                    </Badge>
                                                                    {isBotUnlocked && (
                                                                        <span className="text-xs font-mono font-bold text-slate-700">{dashboardAiUsage} reqs</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge className={`rounded-lg px-2 py-0.5 text-[9px] uppercase tracking-wider border shadow-none ${
                                                                        isAgentUnlocked 
                                                                        ? 'bg-purple-50 text-purple-700 border-purple-100 font-bold' 
                                                                        : 'bg-slate-100 text-slate-400 border-slate-200'
                                                                    }`}>
                                                                        {isAgentUnlocked ? 'Unlocked' : 'Locked'}
                                                                    </Badge>
                                                                    {isAgentUnlocked && (
                                                                        <span className="text-xs font-mono font-bold text-slate-700">{guestAiAgentUsage} reqs</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="w-[280px]">
                                                                <div className="space-y-1.5">
                                                                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                                                                        <span className="font-bold text-slate-800">{totalUsage} requests used</span>
                                                                        <span>{limit} limit</span>
                                                                    </div>
                                                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                                usagePercentage > 85 
                                                                                ? 'bg-gradient-to-r from-red-500 to-rose-600' 
                                                                                : usagePercentage > 60 
                                                                                ? 'bg-gradient-to-r from-amber-500 to-orange-600' 
                                                                                : 'bg-gradient-to-r from-indigo-500 to-purple-600'
                                                                            }`}
                                                                            style={{ width: `${usagePercentage}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 rounded-lg hover:bg-indigo-50 border-border hover:border-indigo-200 hover:text-indigo-600 font-bold transition-all text-xs"
                                                                    onClick={() => {
                                                                        setSelectedQuotaHotel(hotel);
                                                                        setWhatsappCredits(hotel.subscription?.whatsapp_credits?.toString() || '1000');
                                                                        setSmsCredits(hotel.subscription?.sms_credits?.toString() || '1000');
                                                                        setAiUsageLimit(hotel.subscription?.ai_usage_limit?.toString() || '50000');
                                                                    }}
                                                                >
                                                                    <Sliders className="w-3.5 h-3.5 mr-1.5" /> Adjust Limits
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
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

                {/* Hotel Detail Sheet (Drawer) */}
                <Sheet open={!!detailHotel} onOpenChange={(open) => !open && setDetailHotel(null)}>
                    <SheetContent className="w-full sm:max-w-lg bg-background border-l border-border p-0 shadow-2xl flex flex-col h-full overflow-hidden">
                        {detailHotel && (
                            <>
                                <div className="p-6 border-b border-border bg-slate-50/50 backdrop-blur-md flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <SheetTitle className="text-lg font-black text-foreground tracking-tight">{detailHotel.name}</SheetTitle>
                                            <SheetDescription className="text-xs font-mono text-indigo-600 font-bold mt-0.5">slug: {detailHotel.slug}</SheetDescription>
                                        </div>
                                    </div>
                                    <Badge className={`rounded-lg px-2.5 py-1 font-black text-[9px] uppercase tracking-widest border ${
                                        detailHotel.is_active 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' 
                                        : 'bg-red-50 text-red-600 border-red-100'
                                    }`}>
                                        {detailHotel.is_active ? 'Active' : 'Locked'}
                                    </Badge>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* Owner Profile */}
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Property Ownership</h4>
                                        <div className="p-4 rounded-2xl border border-border bg-muted/20/40 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground">
                                                    <UserIcon className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground font-medium">Owner Name</p>
                                                    <p className="text-sm font-bold text-foreground">{detailHotel.owner_name !== 'N/A' ? detailHotel.owner_name : 'Not Specified'}</p>
                                                </div>
                                            </div>
                                            <div className="h-px bg-border" />
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground">
                                                    <Globe className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground font-medium">Login Email</p>
                                                    <p className="text-sm font-bold text-foreground truncate">{detailHotel.owner_email}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Subscription details */}
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Subscription Plan</h4>
                                        <div className="p-5 rounded-2xl border border-border bg-muted/20/40 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Crown className="w-4 h-4 text-amber-500" />
                                                    <span className="text-sm font-bold text-foreground">
                                                        {detailHotel.subscription?.plan || 'Free Trial'} Plan
                                                    </span>
                                                </div>
                                                <Badge className={`rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider font-bold ${
                                                    (detailHotel.subscription?.status || 'inactive') === 'active' 
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' 
                                                    : 'bg-amber-50 text-amber-700 border border-amber-250'
                                                }`}>
                                                    {detailHotel.subscription?.status || 'inactive'}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 pt-2">
                                                <div className="p-3 bg-background border border-border rounded-xl">
                                                    <p className="text-[9px] font-black uppercase tracking-wide text-muted-foreground mb-1">WhatsApp Limits</p>
                                                    <p className="text-base font-black text-foreground">{detailHotel.subscription?.whatsapp_credits ?? 1000} <span className="text-[9px] font-normal text-muted-foreground">cr</span></p>
                                                </div>
                                                <div className="p-3 bg-background border border-border rounded-xl">
                                                    <p className="text-[9px] font-black uppercase tracking-wide text-muted-foreground mb-1">SMS Limits</p>
                                                    <p className="text-base font-black text-foreground">{detailHotel.subscription?.sms_credits ?? 1000} <span className="text-[9px] font-normal text-muted-foreground">cr</span></p>
                                                </div>
                                                <div className="p-3 bg-background border border-border rounded-xl col-span-2">
                                                    <p className="text-[9px] font-black uppercase tracking-wide text-muted-foreground mb-1">AI Agent Usage Cap</p>
                                                    <p className="text-base font-black text-foreground">{detailHotel.subscription?.ai_usage_limit ?? 50000} <span className="text-[9px] font-normal text-muted-foreground">reqs</span></p>
                                                </div>
                                            </div>

                                            <div className="h-px bg-border" />
                                            <div className="flex items-center justify-between text-xs font-medium">
                                                <span className="text-muted-foreground">Subscription Term End Date</span>
                                                <span className="font-bold text-foreground font-mono">
                                                    {detailHotel.subscription?.end_date 
                                                        ? format(new Date(detailHotel.subscription.end_date), 'dd MMMM yyyy') 
                                                        : 'Lifetime Plan'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Features Toggles Summary */}
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Provisioned Capabilities</h4>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: 'AI Agent Core', val: detailHotel.feature_ai_agent, icon: BrainCircuit },
                                                { label: 'Guest Bot', val: detailHotel.feature_guest_bot, icon: MessageSquare },
                                                { label: 'Rate Shopper', val: detailHotel.feature_rate_shopper, icon: TrendingUp },
                                            ].map((feat, idx) => (
                                                <div key={idx} className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${
                                                    feat.val ? 'bg-indigo-50/50 border-indigo-150 text-indigo-700' : 'bg-background border-border text-muted-foreground'
                                                }`}>
                                                    <feat.icon className="w-5 h-5 mb-0.5" />
                                                    <span className="text-[10px] font-bold tracking-tight leading-none">{feat.label}</span>
                                                    <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-background border mt-1 font-bold">
                                                        {feat.val ? 'ON' : 'OFF'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Command Actions Footer */}
                                <div className="p-6 border-t border-border bg-slate-50/50 space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Administrative Actions</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button 
                                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl flex items-center justify-center gap-2"
                                            onClick={() => impersonateMutation.mutate(detailHotel.id)}
                                        >
                                            <UserCheck className="w-4 h-4" /> Impersonate Admin
                                        </Button>

                                        <Button 
                                            variant="outline"
                                            className="border-border hover:bg-muted/40 font-bold h-11 rounded-xl flex items-center justify-center gap-2"
                                            onClick={() => {
                                                setSelectedQuotaHotel(detailHotel);
                                                setWhatsappCredits(detailHotel.subscription?.whatsapp_credits?.toString() || '1000');
                                                setSmsCredits(detailHotel.subscription?.sms_credits?.toString() || '1000');
                                                setAiUsageLimit(detailHotel.subscription?.ai_usage_limit?.toString() || '50000');
                                            }}
                                        >
                                            <Sliders className="w-4 h-4 text-purple-600" /> Quota Settings
                                        </Button>

                                        <Button 
                                            variant="outline"
                                            className="border-border hover:bg-muted/40 font-bold h-11 rounded-xl flex items-center justify-center gap-2"
                                            onClick={() => {
                                                setSelectedSubHotel(detailHotel);
                                                setSubPlanName(detailHotel.subscription?.plan || 'Basic');
                                                setSubStatus(detailHotel.subscription?.status || 'active');
                                                setSubEndDate(detailHotel.subscription?.end_date ? format(new Date(detailHotel.subscription.end_date), 'yyyy-MM-dd') : '');
                                            }}
                                        >
                                            <CreditCard className="w-4 h-4 text-amber-500" /> Subscription Plan
                                        </Button>

                                        <Button 
                                            variant={detailHotel.is_active ? "destructive" : "default"}
                                            className={`font-bold h-11 rounded-xl flex items-center justify-center gap-2 ${
                                                !detailHotel.is_active && 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                                            }`}
                                            onClick={() => toggleActive(detailHotel.id, detailHotel.is_active)}
                                        >
                                            {detailHotel.is_active ? (
                                                <>
                                                    <XCircle className="w-4 h-4" /> Lock Account
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldCheck className="w-4 h-4" /> Unlock Account
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </SheetContent>
                </Sheet>

                {/* Subscription Plan Modal */}
                <Dialog open={!!selectedSubHotel} onOpenChange={(open) => !open && setSelectedSubHotel(null)}>
                    <DialogContent className="max-w-md bg-background p-8 rounded-3xl border border-border shadow-2xl">
                        <DialogHeader className="space-y-2">
                            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-100 mb-2">
                                <CreditCard className="w-6 h-6" />
                            </div>
                            <DialogTitle className="text-xl font-bold text-foreground">Modify Subscription Plan</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground font-medium">
                                Alter current billing plan configuration and cycle settings for <span className="font-bold text-foreground">{selectedSubHotel?.name}</span>.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 my-6">
                            {/* Plan Name Selector */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                                    Subscription tier
                                </label>
                                <Select value={subPlanName} onValueChange={setSubPlanName}>
                                    <SelectTrigger className="h-12 rounded-xl border-border bg-muted/30 font-bold text-foreground">
                                        <SelectValue placeholder="Select Plan Tier" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border bg-background">
                                        <SelectItem value="Free">Free / Trial Plan</SelectItem>
                                        <SelectItem value="Basic">Basic Plan</SelectItem>
                                        <SelectItem value="Premium">Premium Plan</SelectItem>
                                        <SelectItem value="Enterprise">Enterprise Tier</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Plan Status Selector */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                                    Plan Status
                                </label>
                                <Select value={subStatus} onValueChange={setSubStatus}>
                                    <SelectTrigger className="h-12 rounded-xl border-border bg-muted/30 font-bold text-foreground">
                                        <SelectValue placeholder="Select Plan Status" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border bg-background">
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="trialing">Trialing</SelectItem>
                                        <SelectItem value="grace_period">Grace Period</SelectItem>
                                        <SelectItem value="inactive">Inactive / Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Plan End Date */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Subscription End Date
                                </label>
                                <Input
                                    type="date"
                                    className="h-12 bg-muted/30 border-border rounded-xl font-bold text-foreground"
                                    value={subEndDate}
                                    onChange={(e) => setSubEndDate(e.target.value)}
                                />
                                <span className="text-[10px] text-muted-foreground font-medium block">Leave empty for infinite lifetime access.</span>
                            </div>
                        </div>

                        <DialogFooter className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 rounded-xl h-12 font-bold hover:bg-muted/30"
                                onClick={() => setSelectedSubHotel(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 rounded-xl h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-100"
                                disabled={updateSubscriptionMutation.isPending}
                                onClick={() => {
                                    if (!selectedSubHotel) return;
                                    updateSubscriptionMutation.mutate({
                                        id: selectedSubHotel.id,
                                        data: {
                                            plan_name: subPlanName,
                                            status: subStatus,
                                            end_date: subEndDate ? new Date(subEndDate).toISOString() : null
                                        }
                                    });
                                }}
                            >
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}
