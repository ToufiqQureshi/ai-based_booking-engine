import { useState, useEffect } from 'react';
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
    UserCheck,
    Radio,
    Sliders,
    Settings,
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
    Crown,
    Sun,
    Moon,
    ChevronLeft,
    ArrowLeft
} from 'lucide-react';

import { apiClient } from '@/api/client';
import { useTheme } from '@/contexts/ThemeContext';
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
import { cn } from '@/lib/utils';

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
    feature_new_booking: boolean;
    feature_color_palette: boolean;
    feature_custom_logo: boolean;
    feature_custom_widget: boolean;
    role_permissions?: Record<string, string[]>;
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

const DEFAULT_ROLE_PERMISSIONS = {
  OWNER: [
    "/dashboard", "/analytics", "/agent", "/rooms", "/rates", "/rate-shopper", 
    "/availability", "/bookings", "/guests", "/payments", "/addons", "/amenities",
    "/channel-settings", "/integration", "/settings"
  ],
  MANAGER: [
    "/dashboard", "/analytics", "/rooms", "/rates", "/amenities",
    "/availability", "/bookings", "/guests", "/payments", "/settings"
  ],
  STAFF: [
    "/availability", "/bookings", "/guests"
  ]
};

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
    const { theme, toggleTheme } = useTheme();
    const [selectedWorkspaceHotel, setSelectedWorkspaceHotel] = useState<HotelAdminData | null>(null);
    const [workspaceTab, setWorkspaceTab] = useState<'overview' | 'users' | 'permissions' | 'features'>('overview');
    const [workspacePermissions, setWorkspacePermissions] = useState<Record<string, string[]>>({ OWNER: [], MANAGER: [], STAFF: [] });
    const [editedPlanFeatures, setEditedPlanFeatures] = useState<Record<string, Record<string, boolean>>>({});

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

    const { data: planFeatures = {}, isLoading: isLoadingPlanFeatures, refetch: refetchPlanFeatures } = useQuery<Record<string, Record<string, boolean>>>({
        queryKey: ['superadmin-plan-features'],
        queryFn: () => apiClient.get('/superadmin/plan-features'),
        enabled: !!user && user.role === 'SUPER_ADMIN'
    });

    const activeDetailHotel = detailHotel ? (hotels.find(h => h.id === detailHotel.id) || detailHotel) : null;

    useEffect(() => {
        if (planFeatures && Object.keys(planFeatures).length > 0) {
            setEditedPlanFeatures(planFeatures);
        }
    }, [planFeatures]);

    useEffect(() => {
        if (selectedWorkspaceHotel) {
            setWhatsappCredits(selectedWorkspaceHotel.subscription?.whatsapp_credits?.toString() || '1000');
            setSmsCredits(selectedWorkspaceHotel.subscription?.sms_credits?.toString() || '1000');
            setAiUsageLimit(selectedWorkspaceHotel.subscription?.ai_usage_limit?.toString() || '50000');
            setSubPlanName(selectedWorkspaceHotel.subscription?.plan || 'Basic');
            setSubStatus(selectedWorkspaceHotel.subscription?.status || 'active');
            setSubEndDate(selectedWorkspaceHotel.subscription?.end_date ? format(new Date(selectedWorkspaceHotel.subscription.end_date), 'yyyy-MM-dd') : '');
            setWorkspacePermissions(selectedWorkspaceHotel.role_permissions || { OWNER: [], MANAGER: [], STAFF: [] });
        }
    }, [selectedWorkspaceHotel]);

    useEffect(() => {
        if (selectedWorkspaceHotel && hotels.length > 0) {
            const updated = hotels.find(h => h.id === selectedWorkspaceHotel.id);
            if (updated) {
                setSelectedWorkspaceHotel(updated);
            }
        }
    }, [hotels]);

    const updateWorkspacePermissionsMutation = useMutation({
        mutationFn: ({ id, permissions }: { id: string, permissions: Record<string, string[]> }) =>
            apiClient.patch(`/superadmin/hotels/${id}/permissions`, permissions),
        onSuccess: () => {
            toast({ title: 'Permissions Matrix Saved', description: 'Role-based access controls updated successfully.' });
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
        onError: (err: any) => {
            toast({ title: 'Error', description: err.message || 'Failed to save permissions matrix.', variant: 'destructive' });
        }
    });


    const updatePlanFeaturesMutation = useMutation({
        mutationFn: (data: Record<string, Record<string, boolean>>) =>
            apiClient.post('/superadmin/plan-features', data),
        onSuccess: () => {
            toast({ title: 'Plan Features Matrix Updated', description: 'Global plan-to-feature matrix saved and active properties synced.' });
            queryClient.invalidateQueries({ queryKey: ['superadmin-plan-features'] });
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
        onError: (err: any) => {
            toast({ title: 'Error', description: err.message || 'Failed to update plan features matrix.', variant: 'destructive' });
        }
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
            'rate_shopper_enabled': 'feature_rate_shopper',
            'new_booking_enabled': 'feature_new_booking',
            'color_palette_enabled': 'feature_color_palette',
            'custom_logo_enabled': 'feature_custom_logo',
            'custom_widget_enabled': 'feature_custom_widget'
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
        <div className="min-h-screen bg-background font-inter selection:bg-primary/20">
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
                    
                    {/* Theme Toggle Switcher */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl text-muted-foreground hover:text-foreground dark:hover:text-slate-200 hover:bg-muted dark:hover:bg-slate-800 transition-all h-10 w-10 shrink-0"
                        onClick={toggleTheme}
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </Button>

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
                            <TabsTrigger value="plan-features" className="rounded-lg font-bold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-6 h-10 transition-all">
                                <Crown className="w-4 h-4 mr-2" /> Plan Features
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
                        {selectedWorkspaceHotel ? (
                            <div className="space-y-6">
                                {/* Workspace Header */}
                                <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/20 dark:bg-slate-900/40 p-6 rounded-2xl border border-border">
                                    <div className="flex items-center gap-4">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSelectedWorkspaceHotel(null)}
                                            className="rounded-xl border-border bg-background hover:bg-muted/50 w-10 h-10 shrink-0"
                                        >
                                            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                                        </Button>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-2xl font-black text-foreground tracking-tight">
                                                    {selectedWorkspaceHotel.name}
                                                </h2>
                                                <Badge className={`rounded-lg px-2.5 py-0.5 font-black text-[9px] uppercase tracking-widest border ${
                                                    selectedWorkspaceHotel.is_active 
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                                    : 'bg-red-50 text-red-650 border-red-150 dark:bg-red-950/40 dark:text-red-400'
                                                }`}>
                                                    {selectedWorkspaceHotel.is_active ? 'Active' : 'Locked'}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground font-mono mt-0.5">slug: {selectedWorkspaceHotel.slug}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 shadow-md transition-all flex items-center gap-2"
                                            onClick={() => impersonateMutation.mutate(selectedWorkspaceHotel.id)}
                                            disabled={impersonateMutation.isPending}
                                        >
                                            <UserCheck className="w-4 h-4" /> Impersonate Hotelier
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="rounded-xl border-border bg-background font-bold h-11 px-6 hover:bg-muted/30"
                                            onClick={() => setSelectedWorkspaceHotel(null)}
                                        >
                                            Exit Workspace
                                        </Button>
                                    </div>
                                </div>

                                {/* Workspace Sub-tabs Navigation */}
                                <div className="flex border-b border-border gap-2 overflow-x-auto">
                                    {[
                                        { id: 'overview', name: 'Overview & Subscription', icon: Sliders },
                                        { id: 'users', name: 'User Accounts', icon: Users },
                                        { id: 'permissions', name: 'Role Permissions Matrix', icon: Lock },
                                        { id: 'features', name: 'Feature Lock Controls', icon: SlidersHorizontal }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setWorkspaceTab(tab.id as any)}
                                            className={cn(
                                                "flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-sm transition-all focus:outline-none whitespace-nowrap",
                                                workspaceTab === tab.id
                                                    ? "border-indigo-600 text-indigo-600"
                                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <tab.icon className="w-4 h-4" />
                                            {tab.name}
                                        </button>
                                    ))}
                                </div>

                                {/* Workspace Sub-tabs Contents */}
                                {workspaceTab === 'overview' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        {/* Subscription Controls */}
                                        <Card className="border border-border rounded-2xl p-6 bg-background lg:col-span-2 space-y-6">
                                            <div>
                                                <h3 className="text-lg font-bold text-foreground">Billing & Plan Configuration</h3>
                                                <p className="text-xs text-muted-foreground font-medium mt-1">Configure plan tiers, cycle status, and billing expirations.</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Subscription Tier</label>
                                                    <Select value={subPlanName} onValueChange={setSubPlanName}>
                                                        <SelectTrigger className="h-12 rounded-xl border-border bg-muted/20 font-bold text-foreground">
                                                            <SelectValue placeholder="Select Plan" />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-border bg-background">
                                                            <SelectItem value="Free">Free / Trial Plan</SelectItem>
                                                            <SelectItem value="Basic">Basic Plan</SelectItem>
                                                            <SelectItem value="Premium">Premium Plan</SelectItem>
                                                            <SelectItem value="Enterprise">Enterprise Tier</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Status</label>
                                                    <Select value={subStatus} onValueChange={setSubStatus}>
                                                        <SelectTrigger className="h-12 rounded-xl border-border bg-muted/20 font-bold text-foreground">
                                                            <SelectValue placeholder="Select Status" />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-border bg-background">
                                                            <SelectItem value="active">Active</SelectItem>
                                                            <SelectItem value="trialing">Trialing</SelectItem>
                                                            <SelectItem value="grace_period">Grace Period</SelectItem>
                                                            <SelectItem value="inactive">Inactive / Cancelled</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2 md:col-span-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Subscription End Date</label>
                                                    <Input
                                                        type="date"
                                                        className="h-12 bg-muted/20 border-border rounded-xl font-bold text-foreground"
                                                        value={subEndDate}
                                                        onChange={(e) => setSubEndDate(e.target.value)}
                                                    />
                                                    <span className="text-[10px] text-muted-foreground font-medium block">Leave empty for infinite lifetime access.</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-end pt-2">
                                                <Button
                                                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 shadow-md transition-all"
                                                    disabled={updateSubscriptionMutation.isPending}
                                                    onClick={() => updateSubscriptionMutation.mutate({
                                                        id: selectedWorkspaceHotel.id,
                                                        data: {
                                                            plan_name: subPlanName,
                                                            status: subStatus,
                                                            end_date: subEndDate ? new Date(subEndDate).toISOString() : null
                                                        }
                                                    })}
                                                >
                                                    Save Subscription Plan
                                                </Button>
                                            </div>
                                        </Card>

                                        {/* Resource limits & Danger Zone */}
                                        <div className="space-y-6 lg:col-span-1">
                                            <Card className="border border-border rounded-2xl p-6 bg-background space-y-6">
                                                <div>
                                                    <h3 className="text-lg font-bold text-foreground">Resource Limits</h3>
                                                    <p className="text-xs text-muted-foreground font-medium mt-1">Configure communication credits & request caps.</p>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp Credits</label>
                                                        <Input type="number" value={whatsappCredits} onChange={(e) => setWhatsappCredits(e.target.value)} className="h-11 bg-muted/20 border-border rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-500" /> SMS Credits</label>
                                                        <Input type="number" value={smsCredits} onChange={(e) => setSmsCredits(e.target.value)} className="h-11 bg-muted/20 border-border rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><BrainCircuit className="w-3.5 h-3.5 text-indigo-500" /> AI Usage Limit</label>
                                                        <Input type="number" value={aiUsageLimit} onChange={(e) => setAiUsageLimit(e.target.value)} className="h-11 bg-muted/20 border-border rounded-xl font-bold" />
                                                    </div>
                                                </div>
                                                <Button
                                                    className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 transition-all"
                                                    disabled={updateQuotasMutation.isPending}
                                                    onClick={() => updateQuotasMutation.mutate({
                                                        id: selectedWorkspaceHotel.id,
                                                        data: {
                                                            whatsapp_credits: parseInt(whatsappCredits, 10) || 0,
                                                            sms_credits: parseInt(smsCredits, 10) || 0,
                                                            ai_usage_limit: parseInt(aiUsageLimit, 10) || 0
                                                        }
                                                    })}
                                                >
                                                    Update Quota Limits
                                                </Button>
                                            </Card>

                                            <Card className="border border-red-200 dark:border-red-950/40 rounded-2xl p-6 bg-red-50/20 space-y-6">
                                                <div>
                                                    <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Danger Zone</h3>
                                                    <p className="text-xs text-red-650 dark:text-red-550/80 font-medium mt-1">High-risk tenant removal and restrictions.</p>
                                                </div>
                                                <div className="space-y-3">
                                                    <Button
                                                        variant="outline"
                                                        className="w-full rounded-xl border-red-200 dark:border-red-950/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-650 dark:text-red-400 font-bold h-11 flex items-center gap-2"
                                                        onClick={() => toggleActive(selectedWorkspaceHotel.id, selectedWorkspaceHotel.is_active)}
                                                    >
                                                        {selectedWorkspaceHotel.is_active ? <XCircle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                                                        {selectedWorkspaceHotel.is_active ? 'Restrict Property Access' : 'Grant Property Access'}
                                                    </Button>
                                                    <Button
                                                        className="w-full rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold h-11 flex items-center gap-2"
                                                        onClick={() => {
                                                            if (confirm(`Are you absolutely sure you want to permanently delete hotel ${selectedWorkspaceHotel.name}? This will wipe everything including all employee logins and data, and is 100% irreversible.`)) {
                                                                deleteHotelMutation.mutate(selectedWorkspaceHotel.id);
                                                                setSelectedWorkspaceHotel(null);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" /> Wipe Hotel Data
                                                    </Button>
                                                </div>
                                            </Card>
                                        </div>
                                    </div>
                                )}

                                {workspaceTab === 'users' && (
                                    <Card className="border border-border rounded-2xl p-8 bg-background min-h-[400px] space-y-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-foreground">Hotel User Registry</h3>
                                            <p className="text-xs text-muted-foreground font-medium mt-1">Review and manage platform users associated with {selectedWorkspaceHotel.name}.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {users.filter(u => u.hotel_id === selectedWorkspaceHotel.id).length === 0 ? (
                                                <div className="col-span-full py-16 text-center text-muted-foreground italic font-medium">
                                                    No employee accounts registered under this property yet.
                                                </div>
                                            ) : (
                                                users.filter(u => u.hotel_id === selectedWorkspaceHotel.id).map((u: any) => (
                                                    <div key={u.id} className="p-5 rounded-xl border border-border bg-muted/15 flex flex-col justify-between group relative bg-background">
                                                        <div>
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center border border-border text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                                                    <UserIcon className="w-5 h-5" />
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Badge className={`rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider border border-border shadow-none ${
                                                                        u.role === 'OWNER' 
                                                                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-bold'
                                                                            : u.role === 'MANAGER'
                                                                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 font-bold'
                                                                            : 'bg-muted/40 text-muted-foreground border-border'
                                                                    }`}>
                                                                        {u.role}
                                                                    </Badge>
                                                                    <Badge className={`rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider border border-border shadow-none ${
                                                                        u.is_active 
                                                                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-bold' 
                                                                            : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 font-bold'
                                                                    }`}>
                                                                        {u.is_active ? 'Active' : 'Suspended'}
                                                                    </Badge>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="rounded-xl w-7 h-7 hover:bg-background hover:shadow-sm">
                                                                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-52 p-2 rounded-2xl shadow-2xl border border-border bg-background z-50">
                                                                            <DropdownMenuLabel className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-3 py-1.5">Employee Actions</DropdownMenuLabel>
                                                                            <DropdownMenuSeparator className="bg-muted/30" />
                                                                            
                                                                            <DropdownMenuLabel className="text-[8px] font-black text-muted-foreground uppercase tracking-wider px-3 py-1">Set Role</DropdownMenuLabel>
                                                                            {['OWNER', 'MANAGER', 'STAFF'].map((roleOpt) => (
                                                                                <DropdownMenuItem 
                                                                                    key={roleOpt} 
                                                                                    className={`rounded-xl py-2 cursor-pointer font-semibold text-xs ${u.role === roleOpt ? 'bg-indigo-50 text-indigo-750 font-bold' : 'text-foreground'}`}
                                                                                    onClick={() => updateRoleMutation.mutate({ id: u.id, role: roleOpt })}
                                                                                >
                                                                                    {roleOpt === 'OWNER' ? 'Owner / Admin' : roleOpt === 'MANAGER' ? 'Manager' : 'Staff'}
                                                                                </DropdownMenuItem>
                                                                            ))}
                                                                            
                                                                            <DropdownMenuSeparator className="bg-muted/30" />
                                                                            
                                                                            <DropdownMenuItem 
                                                                                className="rounded-xl py-2.5 cursor-pointer" 
                                                                                onClick={() => toggleUserStatusMutation.mutate({ id: u.id, is_active: !u.is_active })}
                                                                            >
                                                                                {u.is_active ? (
                                                                                    <>
                                                                                        <XCircle className="w-4 h-4 mr-2.5 text-amber-500" />
                                                                                        <span className="font-bold text-foreground">Suspend Login</span>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <UserCheck className="w-4 h-4 mr-2.5 text-emerald-600" />
                                                                                        <span className="font-bold text-foreground">Activate Login</span>
                                                                                    </>
                                                                                )}
                                                                            </DropdownMenuItem>
                                                                            
                                                                            <DropdownMenuSeparator className="bg-muted/30" />
                                                                            <DropdownMenuItem 
                                                                                className="rounded-xl py-2.5 cursor-pointer hover:bg-red-50 text-red-650" 
                                                                                onClick={() => {
                                                                                    if (confirm(`Delete employee user account ${u.email}?`)) {
                                                                                        deleteUserMutation.mutate(u.id);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <Trash2 className="w-4 h-4 mr-2.5 text-red-600" />
                                                                                <span className="font-bold">Purge User</span>
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="font-bold text-sm text-foreground truncate">{u.name || "Unnamed User"}</p>
                                                                <p className="text-[11px] text-muted-foreground truncate font-mono">{u.email}</p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                                                            <span>Created:</span>
                                                            <span>{u.created_at ? format(new Date(u.created_at), 'dd MMM yyyy') : 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </Card>
                                )}

                                {workspaceTab === 'permissions' && (
                                    <Card className="border border-border rounded-2xl bg-background overflow-hidden shadow-sm">
                                        <div className="p-6 border-b border-border bg-slate-50/40 flex flex-wrap items-center justify-between gap-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                                    <Lock className="w-5 h-5 text-indigo-600" /> Role-Based Access Configuration Matrix
                                                </h3>
                                                <p className="text-xs text-muted-foreground font-medium mt-1">Configure exactly which pages & dashboards each hotel role (Owner, Manager, Staff) is authorized to see in the app navigation menu.</p>
                                            </div>
                                            <Button
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 rounded-xl shadow-md transition-all flex items-center gap-2"
                                                disabled={updateWorkspacePermissionsMutation.isPending}
                                                onClick={() => updateWorkspacePermissionsMutation.mutate({
                                                    id: selectedWorkspaceHotel.id,
                                                    permissions: workspacePermissions
                                                })}
                                            >
                                                {updateWorkspacePermissionsMutation.isPending ? (
                                                    <>
                                                        <RefreshCw className="w-4 h-4 animate-spin" /> Saving Matrix...
                                                    </>
                                                ) : (
                                                    <>
                                                        <ShieldCheck className="w-4 h-4" /> Save Access Controls
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        <div className="p-6">
                                            <div className="overflow-x-auto border border-border rounded-xl">
                                                <Table>
                                                    <TableHeader className="bg-muted/30 border-b border-border">
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableHead className="w-[380px] text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 pl-6">
                                                                Sidebar Option / Dashboard Page
                                                            </TableHead>
                                                            {['OWNER', 'MANAGER', 'STAFF'].map(roleOpt => (
                                                                <TableHead key={roleOpt} className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-muted border border-border text-foreground">
                                                                        {roleOpt === 'OWNER' ? 'Owner / Admin' : roleOpt === 'MANAGER' ? 'Manager (GM)' : 'Basic Staff'}
                                                                    </span>
                                                                </TableHead>
                                                            ))}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {[
                                                            { path: '/dashboard', label: 'Dashboard Overview', desc: 'Main operations summary and key performance indicators.' },
                                                            { path: '/analytics', label: 'System Analytics', desc: 'Detailed occupancy, revenue charts, and forecasting.' },
                                                            { path: '/agent', label: 'AI Reservation Assistant', desc: 'Control panel for provisioning reservation automated agents.' },
                                                            { path: '/rooms', label: 'Rooms Management', desc: 'Create, update, and manage hotel room inventory.' },
                                                            { path: '/rates', label: 'Rate Plans & Packages', desc: 'Configure pricing rules, packages, and seasonal rate plans.' },
                                                            { path: '/rate-shopper', label: 'Rate Shopper Engine', desc: 'Monitor competitor pricing in real-time.' },
                                                            { path: '/availability', label: 'Calendar Grid', desc: 'Visual booking calendar with drag-and-drop features.' },
                                                            { path: '/bookings', label: 'Bookings List', desc: 'Complete database of all past, present, and upcoming stays.' },
                                                            { path: '/guests', label: 'Guest Profiles', desc: 'Review guest profiles, loyalty indices, and preferences.' },
                                                            { path: '/payments', label: 'Payments Ledger', desc: 'Check invoicing, transaction statuses, and charge records.' },
                                                            { path: '/amenities', label: 'Amenities & Inclusions', desc: 'Manage hotel amenities, dining, and other inclusions.' },
                                                            { path: '/addons', label: 'Add-ons & Services', desc: 'Add secondary items like spa vouchers or breakfast upgrades.' },
                                                            { path: '/channel-settings', label: 'Channel Manager', desc: 'Sync inventory rates to OTAs like Agoda and Expedia.' },
                                                            { path: '/integration', label: 'Integration Settings', desc: 'Generate embed code blocks and chatbot widgets.' },
                                                            { path: '/settings', label: 'Hotel Profile & SMTP Settings', desc: 'Primary property configurations and mailing parameters.' }
                                                        ].map((route) => (
                                                            <TableRow key={route.path} className="hover:bg-muted/5 transition-colors border-b border-border last:border-0">
                                                                <TableCell className="py-4 pl-6">
                                                                    <div className="space-y-0.5">
                                                                        <p className="font-bold text-sm text-foreground">{route.label}</p>
                                                                        <p className="text-[10px] text-muted-foreground font-medium leading-relaxed max-w-[320px]">
                                                                            {route.desc}
                                                                        </p>
                                                                    </div>
                                                                </TableCell>
                                                                {['OWNER', 'MANAGER', 'STAFF'].map(roleOpt => {
                                                                    const roleList = workspacePermissions[roleOpt] || [];
                                                                    const hasAccess = roleList.includes(route.path);
                                                                    return (
                                                                        <TableCell key={roleOpt} className="text-center">
                                                                            <div className="flex justify-center items-center">
                                                                                <Switch
                                                                                    checked={hasAccess}
                                                                                    onCheckedChange={(checked) => {
                                                                                        setWorkspacePermissions(prev => {
                                                                                            const oldList = prev[roleOpt] || [];
                                                                                            const newList = checked 
                                                                                                ? [...oldList, route.path]
                                                                                                : oldList.filter(p => p !== route.path);
                                                                                            return { ...prev, [roleOpt]: newList };
                                                                                        });
                                                                                    }}
                                                                                    className="data-[state=checked]:bg-indigo-600"
                                                                                />
                                                                            </div>
                                                                        </TableCell>
                                                                    );
                                                                })}
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </Card>
                                )}

                                {workspaceTab === 'features' && (
                                    <Card className="border border-border rounded-2xl p-8 bg-background shadow-sm space-y-6">
                                        <div className="flex flex-wrap items-center justify-between gap-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-foreground">Property Capability Matrix</h3>
                                                <p className="text-xs text-muted-foreground font-medium mt-1">Provision specific modular features for {selectedWorkspaceHotel.name}. Modifying these values overrides defaults.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {[
                                                { title: 'AI Assistant Enabled', desc: 'Core reservation AI agent and booking support chatbot.', key: 'ai_enabled', val: selectedWorkspaceHotel.feature_ai_agent },
                                                { title: 'Guest AI Agent & Bot Widgets', desc: 'Guest interaction bots for WhatsApp, web widget, and post-stay automation.', key: 'guest_bot_enabled', val: selectedWorkspaceHotel.feature_guest_bot },
                                                { title: 'Rate Shopper Engine', desc: 'Allows property operators to track competitor pricing dynamically.', key: 'rate_shopper_enabled', val: selectedWorkspaceHotel.feature_rate_shopper },
                                                { title: 'New Calendar Booking Button', desc: 'Ability to manually add reservations directly from the calendar layout.', key: 'new_booking_enabled', val: selectedWorkspaceHotel.feature_new_booking },
                                                { title: 'Color Palette Customizer', desc: 'Brand theme building and layout controls customizer.', key: 'color_palette_enabled', val: selectedWorkspaceHotel.feature_color_palette },
                                                { title: 'Custom Logo Branding', desc: 'Swap standard Staybooker logo files with property branding graphics.', key: 'custom_logo_enabled', val: selectedWorkspaceHotel.feature_custom_logo },
                                                { title: 'Widget Snippet Embeds', desc: 'JS embedding snippet generation codes for third-party landing pages.', key: 'custom_widget_enabled', val: selectedWorkspaceHotel.feature_custom_widget },
                                            ].map((feat) => (
                                                <div key={feat.key} className="flex items-center justify-between p-4 rounded-xl border border-border/80 hover:bg-muted/10 transition-colors">
                                                    <div className="space-y-0.5 max-w-[80%]">
                                                        <p className="text-sm font-bold text-foreground">{feat.title}</p>
                                                        <p className="text-[11px] text-muted-foreground leading-normal font-medium">{feat.desc}</p>
                                                    </div>
                                                    <Switch
                                                        checked={feat.val}
                                                        onCheckedChange={() => toggleFeature(selectedWorkspaceHotel.id, feat.key, feat.val)}
                                                        className="data-[state=checked]:bg-indigo-600 scale-105"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Advanced Filter Panel */}
                                <div className="p-6 border border-border bg-slate-50/40 rounded-2xl flex flex-wrap gap-4 items-end justify-between bg-background">
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

                                {/* Hotel Cards Grid */}
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center p-20 gap-3 border border-border bg-background rounded-2xl">
                                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm font-bold text-muted-foreground animate-pulse">Loading Properties Portfolio...</span>
                                    </div>
                                ) : filteredHotels.length === 0 ? (
                                    <div className="p-20 text-center text-muted-foreground font-bold italic border border-border bg-background rounded-2xl">
                                        No properties matched your search.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {filteredHotels.map((hotel) => {
                                            const activeFeatures = [
                                                hotel.feature_ai_agent && 'AI',
                                                hotel.feature_guest_bot && 'Bot',
                                                hotel.feature_rate_shopper && 'Rates',
                                                hotel.feature_new_booking && 'Bookings',
                                                hotel.feature_color_palette && 'Themes',
                                                hotel.feature_custom_logo && 'Logos',
                                                hotel.feature_custom_widget && 'Widgets'
                                            ].filter(Boolean);

                                            return (
                                                <motion.div
                                                    key={hotel.id}
                                                    whileHover={{ y: -5, scale: 1.01 }}
                                                    className="border border-border/80 shadow-sm hover:shadow-xl transition-all duration-300 rounded-2xl bg-background overflow-hidden p-6 flex flex-col justify-between h-[280px]"
                                                >
                                                    <div className="space-y-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-indigo-50/5 dark:bg-indigo-950/20 border border-indigo-50/20 dark:border-indigo-950/40 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                                                    <Building2 className="w-5 h-5" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <h4 
                                                                        className="font-bold text-sm text-foreground hover:text-indigo-600 cursor-pointer transition-colors truncate"
                                                                        onClick={() => setSelectedWorkspaceHotel(hotel)}
                                                                    >
                                                                        {hotel.name}
                                                                    </h4>
                                                                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-[150px]">slug: {hotel.slug}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col gap-1 items-end shrink-0">
                                                                <Badge className={`rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider border shadow-none font-bold ${
                                                                    hotel.subscription?.plan?.toLowerCase() === 'enterprise' ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/40 dark:text-purple-400' :
                                                                    hotel.subscription?.plan?.toLowerCase() === 'premium' ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400' :
                                                                    hotel.subscription?.plan?.toLowerCase() === 'basic' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400' :
                                                                    'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900/50 dark:text-slate-400'
                                                                }`}>
                                                                    {hotel.subscription?.plan || 'Free'}
                                                                </Badge>
                                                                <Badge className={`rounded-lg px-1.5 py-0.2 text-[7px] uppercase tracking-wider border shadow-none font-bold ${
                                                                    hotel.is_active 
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                                                    : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400'
                                                                }`}>
                                                                    {hotel.is_active ? 'Active' : 'Locked'}
                                                                </Badge>
                                                            </div>
                                                        </div>

                                                        <div className="p-3 rounded-xl border border-border bg-muted/10 dark:bg-slate-900/20 space-y-1">
                                                            <div className="flex justify-between text-[11px]">
                                                                <span className="text-muted-foreground font-medium">Owner:</span>
                                                                <span className="font-bold text-foreground truncate max-w-[160px]">{hotel.owner_name !== 'N/A' ? hotel.owner_name : hotel.owner_email.split('@')[0]}</span>
                                                            </div>
                                                            <div className="flex justify-between text-[11px]">
                                                                <span className="text-muted-foreground font-medium">Staff Users:</span>
                                                                <span className="font-mono font-bold text-foreground">{users.filter(u => u.hotel_id === hotel.id).length} accounts</span>
                                                            </div>
                                                            <div className="flex justify-between text-[11px]">
                                                                <span className="text-muted-foreground font-medium">Active Features:</span>
                                                                <span className="font-bold text-indigo-650 dark:text-indigo-400">{activeFeatures.length} enabled</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="flex-1 h-9 text-xs rounded-xl font-bold border-border"
                                                            onClick={() => impersonateMutation.mutate(hotel.id)}
                                                            disabled={impersonateMutation.isPending}
                                                        >
                                                            <UserCheck className="w-3.5 h-3.5 mr-1" /> Impersonate
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="flex-1 h-9 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                                            onClick={() => setSelectedWorkspaceHotel(hotel)}
                                                        >
                                                            <Settings className="w-3.5 h-3.5 mr-1" /> Manage Hotel
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="users" className="mt-0">
                        <Card className="border-border shadow-sm rounded-2xl p-8 bg-background min-h-[400px]">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-foreground tracking-tight">System User Governance</h3>
                                    <p className="text-sm text-muted-foreground font-medium mt-1">Review and manage platform administration levels.</p>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground focus-within:text-primary transition-colors" />
                                    <input
                                        placeholder="Filter by email address..."
                                        className="bg-muted/30 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm w-80 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
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
                                    <div key={u.id} className="p-6 rounded-2xl border border-border bg-muted/15 hover:border-primary/20 hover:bg-background hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-none transition-all group relative overflow-hidden flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center shadow-sm border border-border text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                                    <UserIcon className="w-6 h-6" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge className={`rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider border shadow-none ${
                                                        u.role === 'SUPER_ADMIN' 
                                                            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-bold' 
                                                            : u.role === 'OWNER'
                                                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-bold'
                                                            : u.role === 'MANAGER'
                                                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 font-bold'
                                                            : 'bg-muted/40 text-muted-foreground border-border'
                                                    }`}>
                                                        {u.role}
                                                    </Badge>
                                                    <Badge className={`rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider border shadow-none ${
                                                        u.is_active 
                                                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-bold' 
                                                            : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 font-bold'
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
                            <div className="p-5 border border-border/80 bg-muted/15 rounded-2xl flex flex-wrap gap-4 items-center justify-between mb-6">
                                <div className="flex flex-wrap gap-4 items-center flex-1">
                                    {/* Keyword Search */}
                                    <div className="relative flex-1 min-w-[280px]">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground focus-within:text-primary transition-colors" />
                                        <input
                                            placeholder="Search by operator email, action or description..."
                                            className="bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-medium"
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
                                        className="h-10 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/10 rounded-xl px-4 flex items-center gap-1.5 border border-primary/20"
                                    >
                                        <XCircle className="w-4 h-4" /> Clear Logs Filter
                                    </Button>
                                )}
                            </div>

                            <div className="overflow-x-auto border border-border rounded-2xl">
                                <Table>
                                    <TableHeader className="bg-muted/30 border-b border-border">
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
                                            <TableRow key={log.id} className="hover:bg-muted/15 transition-colors border-border">
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
                                                    <Badge className="rounded-lg px-2.5 py-1 font-black text-[9px] uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-sm">
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
                                     <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
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
                                                 className="py-2 px-3 border border-border rounded-xl text-left text-[10px] font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
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
                                             className="h-12 bg-muted/30 border-border rounded-xl font-medium focus:ring-2 focus:ring-primary/20"
                                             value={broadcastTitle}
                                             onChange={(e) => setBroadcastTitle(e.target.value)}
                                         />
                                     </div>

                                     <div>
                                         <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Announcement Message</label>
                                         <textarea
                                             placeholder="Provide complete maintenance windows or platform updates..."
                                             rows={4}
                                             className="w-full p-4 bg-muted/30 border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                                             value={broadcastMessage}
                                             onChange={(e) => setBroadcastMessage(e.target.value)}
                                         />
                                     </div>

                                     <div>
                                         <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Severity Classification</label>
                                         <div className="grid grid-cols-3 gap-3">
                                             {[
                                                 { label: 'Info', value: 'info', bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' },
                                                 { label: 'Warning', value: 'warning', bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
                                                 { label: 'Success', value: 'success', bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' }
                                             ].map((t) => (
                                                 <button
                                                     key={t.value}
                                                     type="button"
                                                     onClick={() => setBroadcastType(t.value)}
                                                     className={`py-3 px-4 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                                         broadcastType === t.value ? `${t.bg} shadow-md scale-105 ring-2 ring-primary/20` : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                                                     }`}
                                                 >
                                                     {t.value === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> : null}
                                                     {t.label}
                                                 </button>
                                             ))}
                                         </div>
                                     </div>

                                     {/* Real-time Banner Live Preview */}
                                     <div className="border border-dashed border-border rounded-xl p-4 bg-muted/15 space-y-2">
                                         <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block flex items-center gap-1.5">
                                             <Eye className="w-3.5 h-3.5 text-primary" /> Banner Live Preview
                                         </span>
                                         {broadcastTitle || broadcastMessage ? (
                                             <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                                                 broadcastType === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400' : broadcastType === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400'
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
                                         className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-bold h-12 rounded-xl shadow-lg shadow-primary/5 dark:shadow-none transition-all gap-2"
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
                                             <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                                             <span className="text-sm font-bold text-muted-foreground animate-pulse">Syncing Broadcast Channels...</span>
                                         </div>
                                     ) : broadcasts.length === 0 ? (
                                         <div className="h-64 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center p-8 bg-muted/15">
                                             <Radio className="w-12 h-12 text-muted-foreground/30 mb-3 animate-pulse" />
                                             <h5 className="text-base font-bold text-foreground">No Active Announcements</h5>
                                             <p className="text-xs text-muted-foreground font-medium max-w-sm mt-1">Create a broadcast banner using the control module to broadcast live alerts across the enterprise.</p>
                                         </div>
                                     ) : broadcasts.map((b) => (
                                         <div
                                             key={b.id}
                                             className={`p-6 rounded-2xl border flex items-start justify-between gap-6 transition-all shadow-sm hover:shadow-md ${
                                                 b.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20' : b.type === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-blue-500/5 border-blue-500/20'
                                             }`}
                                         >
                                             <div className="flex gap-4 items-start">
                                                 <div className={`p-3 rounded-2xl border ${
                                                     b.type === 'warning' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' : b.type === 'success' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                                                 }`}>
                                                     <Radio className="w-6 h-6 animate-pulse" />
                                                 </div>
                                                 <div className="space-y-1.5">
                                                     <div className="flex items-center gap-3">
                                                         <h4 className="text-base font-black text-foreground tracking-tight">{b.title}</h4>
                                                         <Badge className={`rounded-lg px-2.5 py-0.5 font-black text-[9px] uppercase tracking-wider ${
                                                             b.type === 'warning' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30' : b.type === 'success' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30'
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
                                                 className="rounded-xl hover:bg-background hover:text-destructive hover:shadow-sm transition-all text-muted-foreground self-center"
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
                                        <div className="w-12 h-12 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/20 shadow-sm">
                                            <Crown className="w-6 h-6" />
                                        </div>
                                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider">MRR Live</Badge>
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
                                        <div className="w-12 h-12 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center border border-purple-500/20 shadow-sm">
                                            <BrainCircuit className="w-6 h-6" />
                                        </div>
                                        <Badge className="bg-purple-500/10 text-purple-750 dark:text-purple-400 border border-purple-500/20 rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider">AI Suite</Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">AI Activation Status</span>
                                        <h2 className="text-3xl font-black text-foreground tracking-tight">
                                            {hotels.filter(h => h.feature_ai_agent).length} <span className="text-sm font-bold text-muted-foreground">Agents</span>
                                            <span className="mx-2 text-border">/</span>
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
                                        <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider">Subscriptions</Badge>
                                    </div>
                                    <div className="space-y-2.5 pt-1">
                                        {[
                                            { name: 'Enterprise ($199)', count: hotels.filter(h => h.subscription?.plan?.toLowerCase() === 'enterprise').length, color: 'bg-purple-600' },
                                            { name: 'Premium ($99)', count: hotels.filter(h => h.subscription?.plan?.toLowerCase() === 'premium').length, color: 'bg-blue-600' },
                                            { name: 'Basic ($49)', count: hotels.filter(h => h.subscription?.plan?.toLowerCase() === 'basic').length, color: 'bg-emerald-600' },
                                            { name: 'Free / Trial', count: hotels.filter(h => !h.subscription?.plan || h.subscription.plan.toLowerCase() === 'free' || h.subscription.plan.toLowerCase() === 'none').length, color: 'bg-muted-foreground/30' },
                                        ].map((tier, idx) => {
                                            const total = hotels.length || 1;
                                            const pct = Math.round((tier.count / total) * 100);
                                            return (
                                                <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between text-[10px] font-bold text-foreground">
                                                        <span>{tier.name}</span>
                                                        <span className="font-mono text-muted-foreground">{tier.count} ({pct}%)</span>
                                                    </div>
                                                    <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
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
                                                        <TableRow key={hotel.id} className="border-b border-border/40 hover:bg-muted/15 transition-colors">
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
                                                                        ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20 font-bold' 
                                                                        : 'bg-muted text-muted-foreground border-border'
                                                                    }`}>
                                                                        {isBotUnlocked ? 'Unlocked' : 'Locked'}
                                                                    </Badge>
                                                                    {isBotUnlocked && (
                                                                        <span className="text-xs font-mono font-bold text-foreground">{dashboardAiUsage} reqs</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge className={`rounded-lg px-2 py-0.5 text-[9px] uppercase tracking-wider border shadow-none ${
                                                                        isAgentUnlocked 
                                                                        ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 font-bold' 
                                                                        : 'bg-muted text-muted-foreground border-border'
                                                                    }`}>
                                                                        {isAgentUnlocked ? 'Unlocked' : 'Locked'}
                                                                    </Badge>
                                                                    {isAgentUnlocked && (
                                                                        <span className="text-xs font-mono font-bold text-foreground">{guestAiAgentUsage} reqs</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="w-[280px]">
                                                                <div className="space-y-1.5">
                                                                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                                                                        <span className="font-bold text-foreground">{totalUsage} requests used</span>
                                                                        <span>{limit} limit</span>
                                                                    </div>
                                                                    <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
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
                                                                    className="h-8 rounded-lg hover:bg-primary/10 border-border hover:border-primary/20 hover:text-primary font-bold transition-all text-xs"
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
                    
                    <TabsContent value="plan-features" className="mt-0">
                        <Card className="border-border shadow-sm overflow-hidden rounded-2xl bg-background">
                            <CardHeader className="border-b border-border bg-slate-50/40 p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                                            <Crown className="w-5 h-5 text-amber-500" /> Plan Features Allocation Matrix
                                        </CardTitle>
                                        <CardDescription className="text-xs text-muted-foreground font-medium mt-1">
                                            Define which features are unlocked by default for each subscription tier. Saving updates will instantly sync all active properties matching these plans.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        onClick={() => updatePlanFeaturesMutation.mutate(editedPlanFeatures)}
                                        disabled={updatePlanFeaturesMutation.isPending || Object.keys(editedPlanFeatures).length === 0}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all flex items-center gap-2"
                                    >
                                        {updatePlanFeaturesMutation.isPending ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" /> Saving Matrix...
                                            </>
                                        ) : (
                                            <>
                                                <ShieldCheck className="w-4 h-4" /> Save Configuration Matrix
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>

                            <div className="p-6">
                                {isLoadingPlanFeatures ? (
                                    <div className="flex flex-col items-center justify-center p-20 gap-4">
                                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                        <p className="text-xs font-semibold text-muted-foreground">Loading Matrix Configuration...</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border border-border rounded-xl">
                                        <Table>
                                            <TableHeader className="bg-muted/30 border-b border-border">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="w-[380px] text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 pl-6">
                                                        System Feature Controls
                                                    </TableHead>
                                                    {['Free', 'Basic', 'Premium', 'Enterprise'].map((plan) => (
                                                        <TableHead key={plan} className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={cn(
                                                                    "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                                                    plan === 'Enterprise' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400' :
                                                                    plan === 'Premium' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' :
                                                                    plan === 'Basic' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
                                                                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                                                )}>
                                                                    {plan} Plan
                                                                </span>
                                                            </div>
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {[
                                                    { key: 'feature_ai_agent', name: 'AI Reservation Agent', desc: 'Auto-pilot booking assistant & email responder.', icon: BrainCircuit, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/20' },
                                                    { key: 'feature_guest_bot', name: 'Guest Bot & Widgets', desc: 'Live chat widget and customer care automated flows.', icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/20' },
                                                    { key: 'feature_rate_shopper', name: 'Rate Shopper Engine', desc: 'Track competitors pricing updates in real-time.', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
                                                    { key: 'feature_new_booking', name: 'Manual Calendar Bookings', desc: 'Let hoteliers create reservations from calendar directly.', icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20' },
                                                    { key: 'feature_color_palette', name: 'Color Customizer Theme Builder', desc: 'Tailor brand styles, primary colors, and button radii.', icon: Sliders, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' },
                                                    { key: 'feature_custom_logo', name: 'Custom Logo Branding', desc: 'Swap default Staybooker logos with property branding.', icon: Sparkles, color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-950/20' },
                                                    { key: 'feature_custom_widget', name: 'Widget Custom Embedding', desc: 'Generate JS embedding snippet block for hotel websites.', icon: Globe, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950/20' }
                                                ].map((feat) => (
                                                    <TableRow key={feat.key} className="hover:bg-muted/5 transition-colors border-b border-border last:border-0">
                                                        <TableCell className="py-4 pl-6">
                                                            <div className="flex items-start gap-3">
                                                                <div className={cn("p-2.5 rounded-xl shrink-0 border border-border", feat.bg, feat.color)}>
                                                                    <feat.icon className="w-4 h-4" />
                                                                </div>
                                                                <div className="space-y-0.5">
                                                                    <p className="font-bold text-sm text-foreground">{feat.name}</p>
                                                                    <p className="text-[11px] text-muted-foreground font-medium leading-relaxed max-w-[280px]">
                                                                        {feat.desc}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        {['Free', 'Basic', 'Premium', 'Enterprise'].map((plan) => {
                                                            const isChecked = editedPlanFeatures[plan]?.[feat.key] || false;
                                                            return (
                                                                <TableCell key={plan} className="text-center">
                                                                    <div className="flex justify-center items-center">
                                                                        <Switch
                                                                            checked={isChecked}
                                                                            onCheckedChange={(checked) => {
                                                                                setEditedPlanFeatures(prev => ({
                                                                                    ...prev,
                                                                                    [plan]: {
                                                                                        ...prev[plan],
                                                                                        [feat.key]: checked
                                                                                    }
                                                                                }));
                                                                            }}
                                                                            className="data-[state=checked]:bg-indigo-600 scale-105"
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                            );
                                                        })}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Quotas & Credit Limits Modal */}
                <Dialog open={!!selectedQuotaHotel} onOpenChange={(open) => !open && setSelectedQuotaHotel(null)}>
                    <DialogContent className="max-w-md bg-background p-8 rounded-3xl border border-border shadow-2xl">
                        <DialogHeader className="space-y-2">
                            <div className="w-12 h-12 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center border border-purple-500/20 mb-2">
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
                                    className="h-12 bg-muted/30 border-border rounded-xl font-bold text-foreground focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 focus-visible:border-primary"
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
                                    className="h-12 bg-muted/30 border-border rounded-xl font-bold text-foreground focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 focus-visible:border-primary"
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
                                    className="h-12 bg-muted/30 border-border rounded-xl font-bold text-foreground focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 focus-visible:border-primary"
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
                                className="flex-1 rounded-xl h-12 bg-primary hover:bg-primary/95 text-primary-foreground font-bold shadow-lg shadow-primary/5 dark:shadow-none transition-all"
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
                                    {activeDetailHotel && (
                                        <>
                                            <div className="p-6 border-b border-border bg-muted/20 backdrop-blur-md flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-indigo-50/5 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-50/20 shadow-sm">
                                                        <Building2 className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <SheetTitle className="text-lg font-black text-foreground tracking-tight">{activeDetailHotel.name}</SheetTitle>
                                                        <SheetDescription className="text-xs font-mono text-indigo-600 font-bold mt-0.5">slug: {activeDetailHotel.slug}</SheetDescription>
                                                    </div>
                                                </div>
                                                <Badge className={`rounded-lg px-2.5 py-1 font-black text-[9px] uppercase tracking-widest border ${
                                                    activeDetailHotel.is_active 
                                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 shadow-sm font-bold' 
                                                    : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 font-bold'
                                                }`}>
                                                    {activeDetailHotel.is_active ? 'Active' : 'Locked'}
                                                </Badge>
                                            </div>

                                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                                {/* Owner Details */}
                                                <div className="space-y-3">
                                                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Ownership & Contact</h4>
                                                    <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-2">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">Owner Name:</span>
                                                            <span className="font-bold text-foreground">{activeDetailHotel.owner_name}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">Owner Email:</span>
                                                            <span className="font-mono text-foreground font-semibold">{activeDetailHotel.owner_email}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Subscription Details */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Subscription & Plan</h4>
                                                        <Button 
                                                            variant="link" 
                                                            className="text-xs text-indigo-600 font-bold p-0 h-auto"
                                                            onClick={() => {
                                                                setSelectedSubHotel(activeDetailHotel);
                                                                setSubPlanName(activeDetailHotel.subscription?.plan || 'Basic');
                                                                setSubStatus(activeDetailHotel.subscription?.status || 'active');
                                                                setSubEndDate(activeDetailHotel.subscription?.end_date ? format(new Date(activeDetailHotel.subscription.end_date), 'yyyy-MM-dd') : '');
                                                            }}
                                                        >
                                                            Modify Plan
                                                        </Button>
                                                    </div>
                                                    <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-3">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-muted-foreground font-medium">Current Plan:</span>
                                                            <Badge className="font-bold uppercase tracking-wider">
                                                                {activeDetailHotel.subscription?.plan || 'None'}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-muted-foreground font-medium">Status:</span>
                                                            <Badge variant="outline" className="font-bold uppercase tracking-wider text-[10px]">
                                                                {activeDetailHotel.subscription?.status || 'inactive'}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">End Date:</span>
                                                            <span className="font-semibold text-foreground">
                                                                {activeDetailHotel.subscription?.end_date 
                                                                    ? format(new Date(activeDetailHotel.subscription.end_date), 'dd MMMM yyyy') 
                                                                    : 'Lifetime'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Quotas & Credit Limits */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Resource Quotas</h4>
                                                        <Button 
                                                            variant="link" 
                                                            className="text-xs text-indigo-600 font-bold p-0 h-auto"
                                                            onClick={() => {
                                                                setSelectedQuotaHotel(activeDetailHotel);
                                                                setWhatsappCredits(activeDetailHotel.subscription?.whatsapp_credits?.toString() || '1000');
                                                                setSmsCredits(activeDetailHotel.subscription?.sms_credits?.toString() || '1000');
                                                                setAiUsageLimit(activeDetailHotel.subscription?.ai_usage_limit?.toString() || '50000');
                                                            }}
                                                        >
                                                            Adjust Limits
                                                        </Button>
                                                    </div>
                                                    <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-3">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">WhatsApp Credits:</span>
                                                            <span className="font-bold text-foreground font-mono">{activeDetailHotel.subscription?.whatsapp_credits ?? 0}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">SMS Credits:</span>
                                                            <span className="font-bold text-foreground font-mono">{activeDetailHotel.subscription?.sms_credits ?? 0}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">AI Usage Limit:</span>
                                                            <span className="font-bold text-foreground font-mono">{activeDetailHotel.subscription?.ai_usage_limit ?? 0}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Feature Controls (7 Toggles) */}
                                                <div className="space-y-4">
                                                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Feature Lock Controls</h4>
                                                    <div className="space-y-3">
                                                        {[
                                                            { title: 'AI Assistant', desc: 'Core reservation AI agent and booking support chatbot.', key: 'feature_ai_agent', val: activeDetailHotel.feature_ai_agent },
                                                            { title: 'Guest AI Agent', desc: 'Guest interaction bots for whatsapp, widget and post-stay followups.', key: 'feature_guest_bot', val: activeDetailHotel.feature_guest_bot },
                                                            { title: 'Rate Shopper', desc: 'Allows properties to track competitors pricing dynamically.', key: 'feature_rate_shopper', val: activeDetailHotel.feature_rate_shopper },
                                                            { title: 'New Booking Button', desc: 'Ability to manually add reservations directly from the calendar.', key: 'feature_new_booking', val: activeDetailHotel.feature_new_booking },
                                                            { title: 'Color Palette Customizer', desc: 'Design customization controls for custom theme builder.', key: 'feature_color_palette', val: activeDetailHotel.feature_color_palette },
                                                            { title: 'Custom Logo Uploader', desc: 'Allows hotels to brand the booking engine with their own logo.', key: 'feature_custom_logo', val: activeDetailHotel.feature_custom_logo },
                                                            { title: 'Custom Widget integration', desc: 'Script block access and embedding tags for external hotel websites.', key: 'feature_custom_widget', val: activeDetailHotel.feature_custom_widget },
                                                        ].map((feat) => (
                                                            <div key={feat.key} className="flex items-center justify-between p-3 rounded-xl border border-border/80 hover:bg-muted/10 transition-colors">
                                                                <div className="space-y-0.5 max-w-[80%]">
                                                                    <p className="text-sm font-bold text-foreground">{feat.title}</p>
                                                                    <p className="text-[10px] text-muted-foreground leading-normal font-medium">{feat.desc}</p>
                                                                </div>
                                                                <Switch
                                                                    checked={feat.val}
                                                                    onCheckedChange={() => toggleFeature(activeDetailHotel.id, feat.key, feat.val)}
                                                                    className="data-[state=checked]:bg-indigo-600"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6 border-t border-border bg-muted/10 flex gap-3">
                                                <Button
                                                    className="flex-1 rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                                    onClick={() => impersonateMutation.mutate(activeDetailHotel.id)}
                                                    disabled={impersonateMutation.isPending}
                                                >
                                                    <UserCheck className="w-4 h-4 mr-2" /> Impersonate Hotelier
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="rounded-xl h-11 border-border font-bold hover:bg-muted/30"
                                                    onClick={() => setDetailHotel(null)}
                                                >
                                                    Close Profile
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </SheetContent>
                            </Sheet>

                {/* Subscription Plan Modal */}
                <Dialog open={!!selectedSubHotel} onOpenChange={(open) => !open && setSelectedSubHotel(null)}>
                    <DialogContent className="max-w-md bg-background p-8 rounded-3xl border border-border shadow-2xl">
                        <DialogHeader className="space-y-2">
                            <div className="w-12 h-12 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/20 mb-2">
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
                                className="flex-1 rounded-xl h-12 bg-primary hover:bg-primary/95 text-primary-foreground font-bold shadow-lg shadow-primary/5 dark:shadow-none transition-all"
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
