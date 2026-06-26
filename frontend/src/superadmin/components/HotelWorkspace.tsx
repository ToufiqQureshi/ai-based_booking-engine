import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import {
    ArrowLeft, UserCheck, Building2, Calendar, CreditCard,
    Zap, BrainCircuit, Shield, Globe, Palette, Image, LayoutTemplate,
    BarChart3, MessageSquare, XCircle, ShieldCheck, Trash2,
    AlertTriangle, Download, Users, RefreshCw, ServerCrash,
    CheckCircle2, Clock, Activity
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface HotelWorkspaceProps {
    hotel: any;
    onBack: () => void;
    users: any[];
    onImpersonate: () => void;
    isImpersonating: boolean;
}

// All Staybooker feature flags with labels and descriptions
const FEATURE_FLAGS = [
    { id: 'feature_ai_agent',       label: 'AI Agent',           desc: 'AI booking assistant on WhatsApp & chat',  icon: BrainCircuit, color: 'text-purple-600 bg-purple-50' },
    { id: 'feature_guest_bot',      label: 'Guest Bot',          desc: 'Automated guest messaging & responses',    icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
    { id: 'feature_ai_assistant',   label: 'AI Assistant',       desc: 'Dashboard AI assistant for hotel staff',   icon: BrainCircuit, color: 'text-indigo-600 bg-indigo-50' },
    { id: 'feature_new_booking',    label: 'Booking Engine',     desc: 'Public booking page & widget',             icon: Globe,        color: 'text-indigo-600 bg-indigo-50' },
    { id: 'feature_color_palette',  label: 'Color Palette',      desc: 'Custom brand colors on booking page',      icon: Palette,      color: 'text-pink-600 bg-pink-50' },
    { id: 'feature_custom_logo',    label: 'Custom Logo',        desc: 'Upload hotel logo on booking widget',      icon: Image,        color: 'text-amber-600 bg-amber-50' },
    { id: 'feature_custom_widget',  label: 'Custom Widget',      desc: 'Advanced widget layout customization',     icon: LayoutTemplate, color: 'text-cyan-600 bg-cyan-50' },
    { id: 'feature_google_ads',     label: 'Google Hotel Ads',   desc: 'Google Hotel Ads XML feed integration',    icon: Globe,        color: 'text-orange-600 bg-orange-50' },
];

const AVAILABLE_ROUTES = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/agent', label: 'AI Chat Agent' },
    { path: '/rooms', label: 'Rooms' },
    { path: '/rates', label: 'Rates' },
    { path: '/availability', label: 'Availability' },
    { path: '/bookings', label: 'Bookings' },
    { path: '/guests', label: 'Guests' },
    { path: '/payments', label: 'Payments' },
    { path: '/addons', label: 'Addons' },
    { path: '/amenities', label: 'Amenities' },
    { path: '/channel-settings', label: 'Channel Settings' },
    { path: '/integration', label: 'Integrations' },
    { path: '/settings', label: 'Settings' },
];

export const HotelWorkspace = ({ hotel, onBack, users, onImpersonate, isImpersonating }: HotelWorkspaceProps) => {
    const qc = useQueryClient();

    // Integrations State
    const [whatsappApiKey, setWhatsappApiKey] = useState(hotel.settings?.whatsapp_api_key || '');
    const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState(hotel.settings?.whatsapp_phone_number_id || '');
    const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState(hotel.settings?.whatsapp_business_account_id || '');
    const [brevoApiKey, setBrevoApiKey] = useState(hotel.settings?.brevo_api_key || '');

    // SMTP State
    const [smtpHost, setSmtpHost] = useState(hotel.settings?.smtp_host || '');
    const [smtpPort, setSmtpPort] = useState(hotel.settings?.smtp_port || '');
    const [smtpUsername, setSmtpUsername] = useState(hotel.settings?.smtp_username || '');
    const [smtpPassword, setSmtpPassword] = useState(hotel.settings?.smtp_password || '');
    const [smtpFromEmail, setSmtpFromEmail] = useState(hotel.settings?.smtp_from_email || '');

    const [aiProvider, setAiProvider] = useState(hotel.ai_provider || 'groq');
    const [aiApiKey, setAiApiKey] = useState(hotel.ai_api_key || '');
    const [aiModel, setAiModel] = useState(hotel.ai_model || 'llama-3.1-70b-versatile');
    const [aiBaseUrl, setAiBaseUrl] = useState(hotel.ai_base_url || '');
    const [aiMaxTokens, setAiMaxTokens] = useState(hotel.ai_max_tokens || '');

    // Sync state when hotel prop changes
    useEffect(() => {
        setWhatsappApiKey(hotel.settings?.whatsapp_api_key || '');
        setWhatsappPhoneNumberId(hotel.settings?.whatsapp_phone_number_id || '');
        setWhatsappBusinessAccountId(hotel.settings?.whatsapp_business_account_id || '');
        setBrevoApiKey(hotel.settings?.brevo_api_key || '');
        setSmtpHost(hotel.settings?.smtp_host || '');
        setSmtpPort(hotel.settings?.smtp_port || '');
        setSmtpUsername(hotel.settings?.smtp_username || '');
        setSmtpPassword(hotel.settings?.smtp_password || '');
        setSmtpFromEmail(hotel.settings?.smtp_from_email || '');
        setAiProvider(hotel.ai_provider || 'groq');
        setAiApiKey(hotel.ai_api_key || '');
        setAiModel(hotel.ai_model || 'llama-3.1-70b-versatile');
        setAiBaseUrl(hotel.ai_base_url || '');
        setAiMaxTokens(hotel.ai_max_tokens || '');
    }, [hotel]);

    const updateIntegrationMutation = useMutation({
        mutationFn: (data: any) => apiClient.patch(`/superadmin/hotels/${hotel.id}`, data),
        onSuccess: () => {
            toast.success('Integration settings updated successfully');
            qc.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
        onError: (err: any) => {
            // apiClient throws ApiClientError with a formatted `.message`.
            toast.error(err?.message || 'Failed to update integration settings');
        }
    });

    const handleSaveIntegrations = () => {
        // Secret keys are never sent back to the client (redacted server-side), so
        // a blank field ALWAYS means "keep what's stored" — there is no "clear"
        // control in this form. Send the KEEP sentinel for any blank secret so the
        // backend leaves the stored Vault/secret untouched; only overwrite when the
        // admin types a new value. This makes it impossible to accidentally blank a
        // configured SMTP password / Brevo key by opening the tab and re-saving.
        const KEEP = '__KEEP__';
        const secret = (val: string) => (val && val.trim() ? val.trim() : KEEP);

        const payload: any = {
            ai_provider: aiProvider,
            ai_api_key: secret(aiApiKey),
            ai_model: aiModel,
            ai_base_url: aiBaseUrl || null,
            ai_max_tokens: aiMaxTokens ? Number(aiMaxTokens) : null,
            settings: {
                whatsapp_phone_number_id: whatsappPhoneNumberId || null,
                whatsapp_business_account_id: whatsappBusinessAccountId || null,
                whatsapp_api_key: secret(whatsappApiKey),
                brevo_api_key: secret(brevoApiKey),
                smtp_host: smtpHost || null,
                smtp_port: smtpPort ? Number(smtpPort) : null,
                smtp_username: smtpUsername || null,
                smtp_password: secret(smtpPassword),
                smtp_from_email: smtpFromEmail || null,
            }
        };
        updateIntegrationMutation.mutate(payload);
    };

    // Small inline indicator so staff can SEE whether a secret is already stored
    // (the raw value is never returned for security). When available it shows a
    // masked preview (e.g. sk-b•••••8d6d) — industry-standard "last few chars"
    // pattern so the admin RECOGNISES the stored key without re-entering it.
    const SecretStatus = ({ isSet, hint }: { isSet: boolean; hint?: string | null }) => (
        <span className={cn(
            'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md',
            isSet ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-50 text-slate-500 border border-slate-200'
        )}>
            {isSet
                ? <><CheckCircle2 className="w-3 h-3" /> Configured{hint ? <code className="font-mono tracking-tight">{hint}</code> : null}</>
                : <>— Not set</>}
        </span>
    );

    // Permissions state
    const [permissions, setPermissions] = useState<Record<string, string[]>>(() => {
        return hotel.settings?.role_permissions || {
            OWNER: [
                "/dashboard", "/analytics", "/agent", "/rooms", "/rates",
                "/availability", "/bookings", "/guests", "/payments", "/addons", "/amenities",
                "/channel-settings", "/integration", "/settings",
            ],
            MANAGER: [
                "/dashboard", "/analytics", "/rooms", "/rates", "/amenities",
                "/availability", "/bookings", "/guests", "/payments", "/settings",
            ],
            STAFF: ["/availability", "/bookings", "/guests"],
        };
    });

    const updatePermissionsMutation = useMutation({
        mutationFn: (data: any) => apiClient.patch(`/superadmin/hotels/${hotel.id}/permissions`, data),
        onSuccess: () => {
            toast.success('Role permissions updated successfully');
            qc.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
        onError: () => toast.error('Failed to update role permissions'),
    });

    // Add User Dialog State & Mutation
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [addUserName, setAddUserName] = useState('');
    const [addUserEmail, setAddUserEmail] = useState('');
    const [addUserPassword, setAddUserPassword] = useState('');
    const [addUserRole, setAddUserRole] = useState('STAFF');

    const addUserMutation = useMutation({
        mutationFn: (data: any) => apiClient.post(`/superadmin/hotels/${hotel.id}/users`, data),
        onSuccess: () => {
            toast.success('Employee account created successfully');
            qc.invalidateQueries({ queryKey: ['superadmin-users'] });
            setIsAddUserOpen(false);
            setAddUserName('');
            setAddUserEmail('');
            setAddUserPassword('');
            setAddUserRole('STAFF');
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.detail || err?.message || 'Failed to create employee account');
        }
    });

    // Hotel health — the platform health endpoint was removed in the Super Admin
    // trim. UI reads health?.* defensively, so a null is safe.
    const health: any = null;

    // Hotel users
    const hotelUsers = users.filter((u: any) => u.hotel_id === hotel.id);

    // Mutations
    const toggleFeatureMutation = useMutation({
        mutationFn: ({ flag, value }: { flag: string; value: boolean }) =>
            apiClient.patch(`/superadmin/hotels/${hotel.id}`, { [flag]: value }),
        onMutate: async ({ flag, value }) => {
            // Cancel outgoing queries
            await qc.cancelQueries({ queryKey: ['superadmin-hotels'] });
            // Snapshot previous value
            const previousHotels = qc.getQueryData<any[]>(['superadmin-hotels']);
            // Optimistically update
            if (previousHotels) {
                qc.setQueryData<any[]>(
                    ['superadmin-hotels'],
                    previousHotels.map((h: any) =>
                        h.id === hotel.id ? { ...h, [flag]: value } : h
                    )
                );
            }
            return { previousHotels };
        },
        onError: (err, variables, context: any) => {
            if (context?.previousHotels) {
                qc.setQueryData(['superadmin-hotels'], context.previousHotels);
            }
            toast.error('Failed to update feature');
        },
        onSuccess: (_, { flag, value }) => {
            const f = FEATURE_FLAGS.find(f => f.id === flag);
            toast.success(`${f?.label ?? flag} ${value ? 'enabled' : 'disabled'}`);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
    });

    const pauseMutation = useMutation({
        mutationFn: (pause: boolean) => apiClient.patch(`/superadmin/hotels/${hotel.id}`, {
            is_paused: pause, pause_reason: pause ? 'Paused by superadmin' : null,
        }),
        onSuccess: (_, paused) => {
            toast.success(paused ? 'Property paused' : 'Property unpaused');
            qc.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed'),
    });

    const disableMutation = useMutation({
        mutationFn: (active: boolean) => apiClient.patch(`/superadmin/hotels/${hotel.id}`, { is_active: active }),
        onSuccess: (_, active) => {
            toast.success(active ? 'Hotel enabled' : 'Hotel locked');
            qc.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed'),
    });

    const deleteMutation = useMutation({
        mutationFn: () => apiClient.delete(`/superadmin/hotels/${hotel.id}`),
        onSuccess: () => { toast.success('Hotel permanently deleted'); qc.invalidateQueries({ queryKey: ['superadmin-hotels'] }); onBack(); },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to delete'),
    });

    const deleteUserMutation = useMutation({
        mutationFn: (userId: string) => apiClient.delete(`/superadmin/hotels/${hotel.id}/users/${userId}`),
        onSuccess: () => {
            toast.success('User deleted successfully');
            qc.invalidateQueries({ queryKey: ['superadmin-users'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to delete user'),
    });

    const healthStatus = health?.health_status ?? 'loading';
    const STATUS_COLOR: Record<string, string> = {
        healthy: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        dormant: 'text-amber-600 bg-amber-50 border-amber-200',
        incomplete: 'text-blue-600 bg-blue-50 border-blue-200',
        disabled: 'text-red-600 bg-red-50 border-red-200',
        paused: 'text-slate-600 bg-slate-50 border-slate-200',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-foreground">{hotel.name}</h1>
                            <p className="text-[11px] font-mono text-muted-foreground">{hotel.slug}</p>
                        </div>
                    </div>
                    <Badge className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border ml-2',
                        hotel.is_paused ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        hotel.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-red-50 text-red-700 border-red-200'
                    )}>
                        {hotel.is_paused ? 'Paused' : hotel.is_active ? 'Active' : 'Locked'}
                    </Badge>
                </div>

                <Button
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 gap-2 font-bold text-sm"
                    onClick={onImpersonate}
                    disabled={isImpersonating}
                >
                    <UserCheck className="w-4 h-4" /> Login as Owner
                </Button>
            </div>

            {/* Quick stats row */}
            {health && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: 'Health', value: healthStatus, badge: true, color: STATUS_COLOR[healthStatus] },
                        { label: 'Bookings (month)', value: health.bookings_this_month ?? 0 },
                        { label: 'Total Bookings', value: health.total_bookings ?? 0 },
                        { label: 'Onboarding', value: `${health.onboarding?.percentage ?? 0}%` },
                    ].map((s, i) => (
                        <div key={i} className="border border-border rounded-xl p-3 bg-background">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                            {s.badge ? (
                                <Badge className={cn('mt-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border', s.color ?? '')}>
                                    {s.value}
                                </Badge>
                            ) : (
                                <p className="text-xl font-black text-foreground tabular-nums mt-0.5">{s.value}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Main tabs */}
            <Tabs defaultValue="features" className="space-y-5">
                <TabsList className="rounded-xl bg-muted/50 p-1 flex-wrap h-auto gap-1">
                    <TabsTrigger value="features" className="rounded-lg text-xs font-bold">Features</TabsTrigger>
                    <TabsTrigger value="integrations" className="rounded-lg text-xs font-bold">Integrations</TabsTrigger>
                    <TabsTrigger value="permissions" className="rounded-lg text-xs font-bold">Permissions</TabsTrigger>
                    <TabsTrigger value="users" className="rounded-lg text-xs font-bold">Users</TabsTrigger>
                    <TabsTrigger value="danger" className="rounded-lg text-xs font-bold text-red-600 data-[state=active]:bg-red-600 data-[state=active]:text-white">Danger Zone</TabsTrigger>
                </TabsList>

                {/* ── PLAN & BILLING ── */}

                {/* ── FEATURES ── */}
                <TabsContent value="features" className="mt-0">
                    <div className="border border-border rounded-2xl p-5 bg-background space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-foreground">Feature Access Control</h3>
                            <p className="text-[10px] text-muted-foreground">Changes apply immediately</p>
                        </div>
                        <div className="space-y-1">
                        {FEATURE_FLAGS.map((f, i) => {
                            const Icon = f.icon;
                            const isOn = !!hotel[f.id];
                            return (
                                <div key={f.id} className={cn("flex items-center justify-between p-3 rounded-xl transition-colors", isOn ? 'bg-muted/30' : 'hover:bg-muted/20')}>
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", f.color)}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-foreground">{f.label}</p>
                                            <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={isOn}
                                        onCheckedChange={(val) => toggleFeatureMutation.mutate({ flag: f.id, value: val })}
                                        disabled={toggleFeatureMutation.isPending && toggleFeatureMutation.variables?.flag === f.id}
                                    />
                                </div>
                            );
                        })}
                        </div>
                    </div>
                </TabsContent>

                {/* ── INTEGRATIONS ── */}

                {/* ── PERMISSIONS ── */}
                <TabsContent value="permissions" className="mt-0">
                    <div className="border border-border rounded-2xl p-6 bg-background space-y-6">
                        <div>
                            <h3 className="text-sm font-black text-foreground">Granular Role-Based Permissions</h3>
                            <p className="text-xs text-muted-foreground mt-1">Configure which pages and sections are accessible by each user role within this hotel property.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {(['OWNER', 'MANAGER', 'STAFF'] as const).map((role) => {
                                const rolePerms = permissions[role] || [];
                                return (
                                    <div key={role} className="border border-border rounded-xl p-4 bg-muted/15 space-y-4">
                                        <div className="flex items-center justify-between pb-2 border-b border-border">
                                            <span className="text-xs font-black uppercase tracking-wider text-foreground">{role}</span>
                                            <span className="text-[10px] text-muted-foreground font-mono">{rolePerms.length} allowed</span>
                                        </div>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                            {AVAILABLE_ROUTES.map((route) => {
                                                const hasAccess = rolePerms.includes(route.path);
                                                return (
                                                    <label key={route.path} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-background/80 cursor-pointer text-xs font-semibold text-foreground">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-border text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                                            checked={hasAccess}
                                                            onChange={(e) => {
                                                                const checked = e.target.checked;
                                                                setPermissions(prev => {
                                                                    const current = prev[role] || [];
                                                                    const nextPerms = checked
                                                                        ? [...current, route.path]
                                                                        : current.filter(p => p !== route.path);
                                                                    return {
                                                                        ...prev,
                                                                        [role]: nextPerms
                                                                    };
                                                                });
                                                            }}
                                                        />
                                                        <span>{route.label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <Button
                            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11"
                            onClick={() => updatePermissionsMutation.mutate(permissions)}
                            disabled={updatePermissionsMutation.isPending}
                        >
                            {updatePermissionsMutation.isPending ? 'Saving Permissions…' : 'Save Role Permissions'}
                        </Button>
                    </div>
                </TabsContent>

                {/* ── USERS ── */}
                <TabsContent value="users" className="mt-0">
                    <div className="border border-border rounded-2xl bg-background overflow-hidden">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="text-sm font-black text-foreground">Hotel Users ({hotelUsers.length})</h3>
                            <Button
                                size="sm"
                                className="rounded-xl bg-indigo-600 hover:bg-indigo-750 text-white font-bold h-8 px-4"
                                onClick={() => setIsAddUserOpen(true)}
                            >
                                Add Employee
                            </Button>
                        </div>
                        {hotelUsers.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm font-medium">No users found for this hotel</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/20">
                                        <th className="text-left py-2.5 pl-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Name</th>
                                        <th className="text-left py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email</th>
                                        <th className="text-left py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Role</th>
                                        <th className="text-left py-2.5 pr-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                                        <th className="text-right py-2.5 pr-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hotelUsers.map((u: any, i: number) => (
                                        <tr key={u.id} className={cn("border-b border-border/60 hover:bg-muted/10", i === hotelUsers.length - 1 && "border-0")}>
                                            <td className="py-3 pl-4 font-semibold text-foreground">{u.name}</td>
                                            <td className="py-3 px-3 text-xs text-muted-foreground">{u.email}</td>
                                            <td className="py-3 px-3">
                                                <Badge className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border-border">
                                                    {u.role === 'SUPER_ADMIN' ? 'Super Admin' : u.role === 'OWNER' ? 'Owner' : u.role === 'MANAGER' ? 'Manager' : u.role === 'STAFF' ? 'Staff' : u.role}
                                                </Badge>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className={cn("w-1.5 h-1.5 rounded-full inline-block mr-1.5", u.is_active ? "bg-emerald-500" : "bg-red-500")} />
                                                <span className="text-xs">{u.is_active ? 'Active' : 'Inactive'}</span>
                                            </td>
                                            <td className="py-3 pr-4 text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-7 w-7 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/30" 
                                                    onClick={() => { if (window.confirm(`Remove ${u.name} from this hotel? Their account will not be deleted.`)) deleteUserMutation.mutate(u.id); }}
                                                    disabled={deleteUserMutation.isPending}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                        <DialogContent className="rounded-3xl border border-border bg-background shadow-2xl p-6 max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Add Employee Account</DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground font-medium mt-1">
                                    Create a new login credential directly registered under {hotel.name}.
                                </DialogDescription>
                            </DialogHeader>

                            <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
                                <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                                        Full Name
                                    </Label>
                                    <Input
                                        placeholder="John Doe"
                                        className="h-11 bg-muted/20 border-border rounded-xl font-medium text-foreground"
                                        value={addUserName}
                                        onChange={(e) => setAddUserName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                                        Email Address
                                    </Label>
                                    <Input
                                        type="email"
                                        placeholder="john@example.com"
                                        autoComplete="off"
                                        className="h-11 bg-muted/20 border-border rounded-xl font-medium text-foreground"
                                        value={addUserEmail}
                                        onChange={(e) => setAddUserEmail(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                                        Password
                                    </Label>
                                    <Input
                                        type="password"
                                        placeholder="Min 6 characters"
                                        autoComplete="new-password"
                                        className="h-11 bg-muted/20 border-border rounded-xl font-medium text-foreground"
                                        value={addUserPassword}
                                        onChange={(e) => setAddUserPassword(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                                        Role / Privilege Level
                                    </Label>
                                    <Select value={addUserRole} onValueChange={setAddUserRole}>
                                        <SelectTrigger className="h-11 rounded-xl border-border bg-muted/20 font-bold text-foreground">
                                            <SelectValue placeholder="Select Role" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-border bg-background">
                                            <SelectItem value="OWNER">Owner / General Manager</SelectItem>
                                            <SelectItem value="MANAGER">Manager / Department Head</SelectItem>
                                            <SelectItem value="STAFF">Basic Staff Member</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            </form>

                            <DialogFooter className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1 rounded-xl h-11 font-bold hover:bg-muted/30"
                                    onClick={() => setIsAddUserOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold h-11 px-6 rounded-xl flex-1 transition-all"
                                    disabled={addUserMutation.isPending}
                                    onClick={() => {
                                        if (!addUserEmail || !addUserName || !addUserPassword) {
                                            toast.error('Please fill in all employee fields.');
                                            return;
                                        }
                                        addUserMutation.mutate({
                                            email: addUserEmail,
                                            name: addUserName,
                                            password: addUserPassword,
                                            role: addUserRole
                                        });
                                    }}
                                >
                                    {addUserMutation.isPending ? 'Creating…' : 'Create Account'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </TabsContent>

                {/* ── INTEGRATIONS ── */}
                <TabsContent value="integrations" className="mt-0 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* WhatsApp Meta Integration */}
                        <div className="border border-border rounded-2xl p-6 bg-background space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-border">
                                <MessageSquare className="w-5 h-5 text-indigo-600" />
                                <h3 className="text-sm font-black text-foreground">WhatsApp Business API Settings</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label className="text-xs font-bold">Meta Temporary / Permanent Access Token</Label>
                                        <SecretStatus isSet={!!hotel.whatsapp_api_key_set} hint={hotel.settings?.whatsapp_api_key_hint} />
                                    </div>
                                    <Input
                                        type="password"
                                        placeholder={hotel.whatsapp_api_key_set ? '•••••• Configured — leave blank to keep' : 'EAAGz...'}
                                        value={whatsappApiKey}
                                        onChange={(e) => setWhatsappApiKey(e.target.value)}
                                        className="h-10 rounded-xl"
                                    />
                                    <p className="text-[10px] text-muted-foreground">Stored securely as `whatsapp_api_key` in hotel settings.</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold">WhatsApp Phone Number ID</Label>
                                    <Input
                                        placeholder="e.g. 102938475647382"
                                        value={whatsappPhoneNumberId}
                                        onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
                                        className="h-10 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold">WhatsApp Business Account ID</Label>
                                    <Input
                                        placeholder="e.g. 987654321098765"
                                        value={whatsappBusinessAccountId}
                                        onChange={(e) => setWhatsappBusinessAccountId(e.target.value)}
                                        className="h-10 rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* AI Engine Integration */}
                        <div className="border border-border rounded-2xl p-6 bg-background space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-border">
                                <BrainCircuit className="w-5 h-5 text-purple-600" />
                                <h3 className="text-sm font-black text-foreground">AI Booking Agent Config</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold">AI Provider</Label>
                                    <Select value={aiProvider} onValueChange={setAiProvider}>
                                        <SelectTrigger className="h-10 rounded-xl">
                                            <SelectValue placeholder="Select Provider" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="groq">Groq</SelectItem>
                                            <SelectItem value="openai">OpenAI</SelectItem>
                                            <SelectItem value="openrouter">OpenRouter</SelectItem>
                                            <SelectItem value="ollama">Ollama</SelectItem>
                                            <SelectItem value="deepseek">DeepSeek</SelectItem>
                                            <SelectItem value="anthropic">Anthropic</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold">AI Model Name</Label>
                                    <Input
                                        placeholder="e.g. llama-3.1-70b-versatile, gpt-4o"
                                        value={aiModel}
                                        onChange={(e) => setAiModel(e.target.value)}
                                        className="h-10 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label className="text-xs font-bold">AI API Key (Overrides platform key)</Label>
                                        <SecretStatus isSet={!!hotel.ai_api_key_set} hint={hotel.settings?.ai_api_key_hint} />
                                    </div>
                                    <Input
                                        type="password"
                                        placeholder={hotel.ai_api_key_set ? '•••••• Configured — leave blank to keep' : 'Leave empty to use platform default key'}
                                        value={aiApiKey}
                                        onChange={(e) => setAiApiKey(e.target.value)}
                                        className="h-10 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold">Custom API Base URL (Optional)</Label>
                                    <Input
                                        placeholder="e.g. https://api.openai.com/v1"
                                        value={aiBaseUrl}
                                        onChange={(e) => setAiBaseUrl(e.target.value)}
                                        className="h-10 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold">Max Tokens (Optional)</Label>
                                    <Input
                                        type="number"
                                        placeholder="e.g. 1000"
                                        value={aiMaxTokens}
                                        onChange={(e) => setAiMaxTokens(e.target.value)}
                                        className="h-10 rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Email Service Integration */}
                    <div className="border border-border rounded-2xl p-6 bg-background space-y-4 max-w-xl">
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                            <Zap className="w-5 h-5 text-amber-500" />
                            <h3 className="text-sm font-black text-foreground">Email Service (Brevo) Configuration</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <Label className="text-xs font-bold">Brevo API Key (Overrides platform key)</Label>
                                    <SecretStatus isSet={!!hotel.brevo_api_key_set} hint={hotel.settings?.brevo_api_key_hint} />
                                </div>
                                <Input
                                    type="password"
                                    placeholder={hotel.brevo_api_key_set ? '•••••• Configured — leave blank to keep' : 'xkeysib-...'}
                                    value={brevoApiKey}
                                    onChange={(e) => setBrevoApiKey(e.target.value)}
                                    className="h-10 rounded-xl"
                                />
                                <p className="text-[10px] text-muted-foreground">Stored securely as `brevo_api_key` in hotel settings. Leave empty to use platform default key.</p>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <div>
                                <h3 className="text-sm font-black text-foreground">Custom SMTP Configuration</h3>
                                <p className="text-xs text-muted-foreground">Configure custom SMTP instead of Brevo. If both are set, SMTP takes precedence.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">SMTP Host</Label>
                                    <Input
                                        placeholder="e.g. smtp.gmail.com"
                                        value={smtpHost}
                                        onChange={(e) => setSmtpHost(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">SMTP Port</Label>
                                    <Input
                                        placeholder="e.g. 587"
                                        value={smtpPort}
                                        onChange={(e) => setSmtpPort(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">SMTP Username</Label>
                                    <Input
                                        placeholder="Username"
                                        value={smtpUsername}
                                        onChange={(e) => setSmtpUsername(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label className="text-xs font-bold">SMTP Password</Label>
                                        <SecretStatus isSet={!!hotel.settings?.has_smtp_password} hint={hotel.settings?.smtp_password_hint} />
                                    </div>
                                    <Input
                                        type="password"
                                        placeholder={hotel.settings?.has_smtp_password ? '•••••• Configured — leave blank to keep' : 'Password'}
                                        value={smtpPassword}
                                        onChange={(e) => setSmtpPassword(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <Label className="text-xs font-bold">SMTP From Email</Label>
                                    <Input
                                        placeholder="e.g. reservations@hotel.com"
                                        value={smtpFromEmail}
                                        onChange={(e) => setSmtpFromEmail(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <Button
                            onClick={handleSaveIntegrations}
                            className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold h-11 px-8 rounded-xl transition-all"
                            disabled={updateIntegrationMutation.isPending}
                        >
                            {updateIntegrationMutation.isPending ? 'Saving Integrations…' : 'Save Integration Settings'}
                        </Button>
                    </div>
                </TabsContent>

                {/* ── EXPORTS ── */}

                {/* ── DANGER ZONE ── */}
                <TabsContent value="danger" className="mt-0">
                    <div className="border border-red-200 dark:border-red-900 rounded-2xl p-5 bg-red-50/30 dark:bg-red-950/10 space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-red-200 dark:border-red-900">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <h3 className="font-black text-red-700 dark:text-red-400">Danger Zone</h3>
                            <p className="text-xs text-muted-foreground ml-auto">These actions are immediate and may be irreversible</p>
                        </div>

                        {/* Pause */}
                        <div className="flex items-center justify-between p-4 bg-background border border-border rounded-xl">
                            <div>
                                <p className="font-bold text-sm text-foreground">{hotel.is_paused ? 'Unpause Property' : 'Pause Property'}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {hotel.is_paused
                                        ? 'Re-enable public booking access'
                                        : 'Stop public bookings. Owner can still login and manage.'}
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn("rounded-xl gap-1.5 font-bold",
                                    hotel.is_paused ? "text-emerald-600 border-emerald-300 hover:bg-emerald-50" :
                                    "text-amber-600 border-amber-300 hover:bg-amber-50"
                                )}
                                onClick={() => {
                                    if (!hotel.is_paused) {
                                        if (window.confirm("Are you sure you want to pause all online services for this hotel? Guests will be locked out.")) {
                                            pauseMutation.mutate(!hotel.is_paused);
                                        }
                                    } else {
                                        pauseMutation.mutate(!hotel.is_paused);
                                    }
                                }}
                                disabled={pauseMutation.isPending}
                            >
                                {hotel.is_paused
                                    ? <><CheckCircle2 className="w-3.5 h-3.5" /> Unpause</>
                                    : <><ServerCrash className="w-3.5 h-3.5" /> Pause</>}
                            </Button>
                        </div>

                        {/* Enable/Disable */}
                        <div className="flex items-center justify-between p-4 bg-background border border-border rounded-xl">
                            <div>
                                <p className="font-bold text-sm text-foreground">{hotel.is_active ? 'Lock Account' : 'Unlock Account'}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {hotel.is_active
                                        ? 'Block all logins for this hotel completely'
                                        : 'Allow hotel owner and staff to login again'}
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn("rounded-xl gap-1.5 font-bold",
                                    hotel.is_active ? "text-red-600 border-red-300 hover:bg-red-50" :
                                    "text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                )}
                                onClick={() => disableMutation.mutate(!hotel.is_active)}
                                disabled={disableMutation.isPending}
                            >
                                {hotel.is_active
                                    ? <><XCircle className="w-3.5 h-3.5" /> Lock</>
                                    : <><ShieldCheck className="w-3.5 h-3.5" /> Unlock</>}
                            </Button>
                        </div>

                        {/* Delete */}
                        <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl">
                            <div>
                                <p className="font-bold text-sm text-red-700 dark:text-red-400">Delete Property Permanently</p>
                                <p className="text-xs text-red-600/70 dark:text-red-500/70 mt-0.5">
                                    Removes hotel, all bookings, guests, and users. Cannot be undone.
                                </p>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="rounded-xl gap-1.5 font-bold bg-red-600 hover:bg-red-700"
                                onClick={() => {
                                    const code = Math.floor(1000 + Math.random() * 9000);
                                    const res = prompt(`Type ${code} to permanently delete "${hotel.name}"`);
                                    if (res === code.toString()) deleteMutation.mutate();
                                }}
                                disabled={deleteMutation.isPending}
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                            </Button>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </motion.div>
    );
};
