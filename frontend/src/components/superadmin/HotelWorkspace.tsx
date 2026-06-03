import { useState } from 'react';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, tokenStorage } from '@/api/client';
import { toast } from 'sonner';
import { HotelIntegrationsTab } from './HotelIntegrationsTab';
import { cn } from '@/lib/utils';

const SUPERADMIN_ORIGINAL_TOKENS_KEY = 'superadmin_original_tokens';

interface HotelWorkspaceProps {
    hotel: any;
    onBack: () => void;
    users: any[];
}

// All Staybooker feature flags with labels and descriptions
const FEATURE_FLAGS = [
    { id: 'feature_ai_agent',       label: 'AI Agent',           desc: 'AI booking assistant on WhatsApp & chat',  icon: BrainCircuit, color: 'text-purple-600 bg-purple-50' },
    { id: 'feature_guest_bot',      label: 'Guest Bot',          desc: 'Automated guest messaging & responses',    icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
    { id: 'feature_rate_shopper',   label: 'Rate Shopper',       desc: 'Competitor rate tracking & analysis',      icon: BarChart3,    color: 'text-emerald-600 bg-emerald-50' },
    { id: 'feature_new_booking',    label: 'Booking Engine',     desc: 'Public booking page & widget',             icon: Globe,        color: 'text-indigo-600 bg-indigo-50' },
    { id: 'feature_color_palette',  label: 'Color Palette',      desc: 'Custom brand colors on booking page',      icon: Palette,      color: 'text-pink-600 bg-pink-50' },
    { id: 'feature_custom_logo',    label: 'Custom Logo',        desc: 'Upload hotel logo on booking widget',      icon: Image,        color: 'text-amber-600 bg-amber-50' },
    { id: 'feature_custom_widget',  label: 'Custom Widget',      desc: 'Advanced widget layout customization',     icon: LayoutTemplate, color: 'text-cyan-600 bg-cyan-50' },
    { id: 'feature_google_ads',     label: 'Google Hotel Ads',   desc: 'Google Hotel Ads XML feed integration',    icon: Globe,        color: 'text-orange-600 bg-orange-50' },
];

export const HotelWorkspace = ({ hotel, onBack, users }: HotelWorkspaceProps) => {
    const qc = useQueryClient();

    // Subscription form state
    const [plan, setPlan] = useState(hotel.subscription?.plan || 'Free');
    const [subStatus, setSubStatus] = useState(hotel.subscription?.status || 'inactive');
    const [endDate, setEndDate] = useState(
        hotel.subscription?.end_date ? hotel.subscription.end_date.split('T')[0] : ''
    );

    // Quotas form state
    const [waCredits, setWaCredits] = useState(hotel.subscription?.whatsapp_credits?.toString() || '1000');
    const [smsCredits, setSmsCredits] = useState(hotel.subscription?.sms_credits?.toString() || '1000');
    const [aiLimit, setAiLimit] = useState(hotel.subscription?.ai_usage_limit?.toString() || '50000');

    // Hotel health
    const { data: health } = useQuery<any>({
        queryKey: ['hotel-health', hotel.id],
        queryFn: () => apiClient.get(`/superadmin/health/${hotel.id}`),
        staleTime: 1000 * 60 * 5,
    });

    // Hotel users
    const hotelUsers = users.filter((u: any) => u.hotel_id === hotel.id);

    // Mutations
    const updateSubMutation = useMutation({
        mutationFn: (data: any) => apiClient.post(`/superadmin/hotels/${hotel.id}/subscription`, data),
        onSuccess: () => { toast.success('Subscription updated'); qc.invalidateQueries({ queryKey: ['superadmin-hotels'] }); },
        onError: () => toast.error('Failed to update subscription'),
    });

    const updateQuotasMutation = useMutation({
        mutationFn: (data: any) => apiClient.patch(`/superadmin/hotels/${hotel.id}/quotas`, data),
        onSuccess: () => { toast.success('Quotas updated'); qc.invalidateQueries({ queryKey: ['superadmin-hotels'] }); },
        onError: () => toast.error('Failed to update quotas'),
    });

    const toggleFeatureMutation = useMutation({
        mutationFn: ({ flag, value }: { flag: string; value: boolean }) =>
            apiClient.patch(`/superadmin/hotels/${hotel.id}`, { [flag]: value }),
        onSuccess: (_, { flag, value }) => {
            const f = FEATURE_FLAGS.find(f => f.id === flag);
            toast.success(`${f?.label ?? flag} ${value ? 'enabled' : 'disabled'}`);
            qc.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
        onError: () => toast.error('Failed to update feature'),
    });

    const impersonateMutation = useMutation({
        mutationFn: () => apiClient.post(`/superadmin/impersonate/${hotel.id}`, {}),
        onSuccess: (data: any) => {
            if (!data?.access_token) { toast.error('No token returned'); return; }
            try {
                const orig = tokenStorage.getAccessToken();
                if (!orig) { toast.error('Missing superadmin session'); return; }
                localStorage.setItem(SUPERADMIN_ORIGINAL_TOKENS_KEY, JSON.stringify({ access_token: orig, refresh_token: tokenStorage.getRefreshToken() ?? '' }));
                tokenStorage.setTokens({ access_token: data.access_token, refresh_token: data.refresh_token ?? '', token_type: 'Bearer', expires_in: 3600 });
                window.location.href = '/';
            } catch { tokenStorage.clearTokens(); localStorage.removeItem(SUPERADMIN_ORIGINAL_TOKENS_KEY); toast.error('Impersonation failed'); }
        },
        onError: (e: any) => toast.error(e?.message ?? 'Impersonation failed'),
    });

    const pauseMutation = useMutation({
        mutationFn: (pause: boolean) => apiClient.patch(`/superadmin/hotels/${hotel.id}`, {
            is_paused: pause, pause_reason: pause ? 'Paused by superadmin' : null,
        }),
        onSuccess: (_, paused) => {
            toast.success(paused ? 'Property paused' : 'Property unpaused');
            qc.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
        onError: () => toast.error('Failed'),
    });

    const disableMutation = useMutation({
        mutationFn: (active: boolean) => apiClient.patch(`/superadmin/hotels/${hotel.id}`, { is_active: active }),
        onSuccess: (_, active) => {
            toast.success(active ? 'Hotel enabled' : 'Hotel locked');
            qc.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
        onError: () => toast.error('Failed'),
    });

    const deleteMutation = useMutation({
        mutationFn: () => apiClient.delete(`/superadmin/hotels/${hotel.id}`),
        onSuccess: () => { toast.success('Hotel permanently deleted'); qc.invalidateQueries({ queryKey: ['superadmin-hotels'] }); onBack(); },
        onError: () => toast.error('Failed to delete'),
    });

    const handleExport = async (type: string, label: string) => {
        try {
            await apiClient.download(`/superadmin/hotels/${hotel.id}/export/${type}`, `${hotel.slug}-${type}.csv`);
            toast.success(`${label} exported`);
        } catch {
            toast.error(`Failed to export ${label.toLowerCase()}`);
        }
    };

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
                    onClick={() => impersonateMutation.mutate()}
                    disabled={impersonateMutation.isPending}
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
            <Tabs defaultValue="plan" className="space-y-5">
                <TabsList className="rounded-xl bg-muted/50 p-1 flex-wrap h-auto gap-1">
                    <TabsTrigger value="plan" className="rounded-lg text-xs font-bold">Plan & Billing</TabsTrigger>
                    <TabsTrigger value="features" className="rounded-lg text-xs font-bold">Features</TabsTrigger>
                    <TabsTrigger value="integrations" className="rounded-lg text-xs font-bold">Integrations</TabsTrigger>
                    <TabsTrigger value="users" className="rounded-lg text-xs font-bold">Users</TabsTrigger>
                    <TabsTrigger value="exports" className="rounded-lg text-xs font-bold">Exports</TabsTrigger>
                    <TabsTrigger value="danger" className="rounded-lg text-xs font-bold text-red-600 data-[state=active]:bg-red-600 data-[state=active]:text-white">Danger Zone</TabsTrigger>
                </TabsList>

                {/* ── PLAN & BILLING ── */}
                <TabsContent value="plan" className="mt-0 space-y-5">
                    <div className="border border-border rounded-2xl p-5 bg-background space-y-5">
                        <h3 className="text-sm font-black text-foreground">Subscription Plan</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs font-bold">Plan Tier</Label>
                                <Select value={plan} onValueChange={setPlan}>
                                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Free">Free / Trial</SelectItem>
                                        <SelectItem value="Basic">Basic</SelectItem>
                                        <SelectItem value="Premium">Premium</SelectItem>
                                        <SelectItem value="Enterprise">Enterprise</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs font-bold">Status</Label>
                                <Select value={subStatus} onValueChange={setSubStatus}>
                                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs font-bold">Expiry Date</Label>
                            <Input type="date" className="mt-1 rounded-xl" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                        <Button
                            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                            onClick={() => updateSubMutation.mutate({ plan_name: plan, status: subStatus, end_date: endDate || null })}
                            disabled={updateSubMutation.isPending}
                        >
                            {updateSubMutation.isPending ? 'Saving…' : 'Save Subscription'}
                        </Button>
                    </div>

                    <div className="border border-border rounded-2xl p-5 bg-background space-y-4">
                        <h3 className="text-sm font-black text-foreground">App Quotas & Limits</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label className="text-xs font-bold">WhatsApp Credits</Label>
                                <Input type="number" className="mt-1 rounded-xl" value={waCredits} onChange={e => setWaCredits(e.target.value)} />
                            </div>
                            <div>
                                <Label className="text-xs font-bold">SMS Credits</Label>
                                <Input type="number" className="mt-1 rounded-xl" value={smsCredits} onChange={e => setSmsCredits(e.target.value)} />
                            </div>
                            <div>
                                <Label className="text-xs font-bold">AI Token Limit</Label>
                                <Input type="number" className="mt-1 rounded-xl" value={aiLimit} onChange={e => setAiLimit(e.target.value)} />
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full rounded-xl font-bold"
                            onClick={() => updateQuotasMutation.mutate({ whatsapp_credits: +waCredits, sms_credits: +smsCredits, ai_usage_limit: +aiLimit })}
                            disabled={updateQuotasMutation.isPending}
                        >
                            {updateQuotasMutation.isPending ? 'Saving…' : 'Update Quotas'}
                        </Button>
                    </div>
                </TabsContent>

                {/* ── FEATURES ── */}
                <TabsContent value="features" className="mt-0">
                    <div className="border border-border rounded-2xl p-5 bg-background space-y-1">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-foreground">Feature Access Control</h3>
                            <p className="text-[10px] text-muted-foreground">Changes apply immediately</p>
                        </div>
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
                                        disabled={toggleFeatureMutation.isPending}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </TabsContent>

                {/* ── INTEGRATIONS ── */}
                <TabsContent value="integrations" className="mt-0">
                    <HotelIntegrationsTab hotel={hotel} />
                </TabsContent>

                {/* ── USERS ── */}
                <TabsContent value="users" className="mt-0">
                    <div className="border border-border rounded-2xl bg-background overflow-hidden">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="text-sm font-black text-foreground">Hotel Users ({hotelUsers.length})</h3>
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {hotelUsers.map((u: any, i: number) => (
                                        <tr key={u.id} className={cn("border-b border-border/60 hover:bg-muted/10", i === hotelUsers.length - 1 && "border-0")}>
                                            <td className="py-3 pl-4 font-semibold text-foreground">{u.name}</td>
                                            <td className="py-3 px-3 text-xs text-muted-foreground">{u.email}</td>
                                            <td className="py-3 px-3">
                                                <Badge className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border-border">
                                                    {u.role}
                                                </Badge>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className={cn("w-1.5 h-1.5 rounded-full inline-block mr-1.5", u.is_active ? "bg-emerald-500" : "bg-red-500")} />
                                                <span className="text-xs">{u.is_active ? 'Active' : 'Inactive'}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </TabsContent>

                {/* ── EXPORTS ── */}
                <TabsContent value="exports" className="mt-0">
                    <div className="border border-border rounded-2xl p-5 bg-background space-y-3">
                        <h3 className="text-sm font-black text-foreground mb-4">Export Hotel Data (CSV)</h3>
                        {[
                            { label: 'Bookings', desc: 'All bookings with guest info, dates, amounts', type: 'bookings' },
                            { label: 'Guest List', desc: 'All guests with contact details', type: 'guests' },
                            { label: 'Payment Records', desc: 'All payment transactions', type: 'payments' },
                        ].map(e => (
                            <div key={e.type} className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/20 transition-colors">
                                <div>
                                    <p className="font-bold text-sm text-foreground">{e.label}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{e.desc}</p>
                                </div>
                                <Button
                                    variant="outline" size="sm"
                                    className="rounded-xl gap-1.5 font-semibold h-8"
                                    onClick={() => handleExport(e.type, e.label)}
                                >
                                    <Download className="w-3.5 h-3.5" /> Download
                                </Button>
                            </div>
                        ))}
                    </div>
                </TabsContent>

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
                                onClick={() => pauseMutation.mutate(!hotel.is_paused)}
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
