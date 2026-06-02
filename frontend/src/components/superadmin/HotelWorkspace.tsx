import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { 
    UserCheck, ShieldCheck, Key, Webhook, Zap, Trash2, XCircle, 
    MessageSquare, AlertTriangle, Building2, Calendar, CreditCard,
    ServerCrash, Activity
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, tokenStorage } from '@/api/client';
import { toast } from 'sonner';
import { HotelIntegrationsTab } from './HotelIntegrationsTab';

// Storage key for the super-admin's own token (saved while impersonating a hotel admin).
const SUPERADMIN_ORIGINAL_TOKENS_KEY = 'superadmin_original_tokens';

interface HotelWorkspaceProps {
    hotel: any;
    onBack: () => void;
    users: any[];
}

export const HotelWorkspace = ({ hotel, onBack, users }: HotelWorkspaceProps) => {
    const queryClient = useQueryClient();
    const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);

    // Quota states
    const [waCredits, setWaCredits] = useState(hotel.subscription?.whatsapp_credits?.toString() || '1000');
    const [smsCredits, setSmsCredits] = useState(hotel.subscription?.sms_credits?.toString() || '1000');
    const [aiLimit, setAiLimit] = useState(hotel.subscription?.ai_usage_limit?.toString() || '50000');

    // Sub states
    const [plan, setPlan] = useState(hotel.subscription?.plan || 'Basic');
    const [status, setStatus] = useState(hotel.subscription?.status || 'active');
    
    // API Keys & Webhooks
    const [waAdminPhone, setWaAdminPhone] = useState(hotel.integration_settings?.whatsapp_admin_phone || '');
    const [openAiKey, setOpenAiKey] = useState(hotel.integration_settings?.openai_api_key || '');
    const [webhookUrl, setWebhookUrl] = useState(hotel.integration_settings?.webhook_url || '');

    const updateSubMutation = useMutation({
        mutationFn: (data: any) => apiClient.post(`/superadmin/hotels/${hotel.id}/subscription`, data),
        onSuccess: () => {
            toast.success("Subscription updated");
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
            setIsSubModalOpen(false);
        }
    });

    const updateQuotasMutation = useMutation({
        mutationFn: (data: any) => apiClient.patch(`/superadmin/hotels/${hotel.id}/quotas`, data),
        onSuccess: () => {
            toast.success("Quotas updated");
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
            setIsQuotaModalOpen(false);
        }
    });

    const saveKeysMutation = useMutation({
        mutationFn: (data: any) => apiClient.patch(`/superadmin/hotels/${hotel.id}`, { integration_settings: { ...hotel.integration_settings, ...data } }),
        onSuccess: () => {
            toast.success("Settings updated successfully");
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        }
    });

    const impersonateMutation = useMutation({
        mutationFn: () => apiClient.post(`/superadmin/impersonate/${hotel.id}`, {}),
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

    // Wipe = pause the hotel (soft disable). Full deletion is a separate action below.
    const wipeDataMutation = useMutation({
        mutationFn: () => apiClient.patch(`/superadmin/hotels/${hotel.id}`, {
            is_paused: true,
            pause_reason: 'Manual data pause by super admin',
        }),
        onSuccess: () => {
            toast.success("Property paused — bookings & public access disabled");
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
        onError: () => toast.error("Failed to pause property"),
    });

    const deletePropertyMutation = useMutation({
        mutationFn: () => apiClient.delete(`/superadmin/hotels/${hotel.id}`),
        onSuccess: () => {
            toast.success("Property permanently deleted");
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
            onBack();
        }
    });

    return (
        <>
            <Sheet open={true} onOpenChange={(open) => !open && onBack()}>
                <SheetContent className="w-full sm:max-w-lg bg-slate-950/80 backdrop-blur-xl border-l border-white/10 p-0 shadow-2xl flex flex-col h-full overflow-hidden text-slate-50">
                    <div className="p-8 border-b border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                                <SheetTitle className="text-xl font-black text-white">{hotel.name}</SheetTitle>
                                <SheetDescription className="text-xs font-mono text-indigo-300 mt-1">slug: {hotel.slug}</SheetDescription>
                            </div>
                        </div>
                        <Badge className={`rounded-xl px-3 py-1.5 font-black text-[10px] uppercase tracking-widest border ${
                            hotel.is_active ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}>
                            {hotel.is_active ? 'Active' : 'Locked'}
                        </Badge>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <Tabs defaultValue="properties" className="w-full space-y-8">
                            <TabsList className="bg-slate-900/50 backdrop-blur-md border border-white/5 w-full flex rounded-2xl p-1.5 shadow-inner">
                                <TabsTrigger value="properties" className="flex-1 rounded-xl text-[11px] font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">Properties</TabsTrigger>
                                <TabsTrigger value="integrations" className="flex-1 rounded-xl text-[11px] font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">Integrations</TabsTrigger>
                                <TabsTrigger value="danger" className="flex-1 rounded-xl text-[11px] font-bold data-[state=active]:bg-rose-600 data-[state=active]:text-white transition-all">Danger Zone</TabsTrigger>
                            </TabsList>

                            {/* PROPERTIES TAB */}
                            <TabsContent value="properties" className="space-y-6 mt-0">
                                <div className="p-6 border border-white/10 rounded-3xl bg-slate-900/40 backdrop-blur-sm space-y-4 shadow-lg">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Subscription & Plan</h4>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Badge className="font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border-indigo-500/30">{hotel.subscription?.plan || 'Free'}</Badge>
                                            <p className="text-xs text-slate-400 mt-2">Status: <span className="text-slate-200">{hotel.subscription?.status || 'inactive'}</span></p>
                                        </div>
                                        <Button size="sm" variant="outline" className="border-white/20 hover:bg-white/10 hover:text-white transition-all rounded-xl" onClick={() => setIsSubModalOpen(true)}>Edit Plan</Button>
                                    </div>
                                </div>

                                <div className="p-6 border border-white/10 rounded-3xl bg-slate-900/40 backdrop-blur-sm space-y-6 shadow-lg">
                                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">App Quotas & Limits</h4>
                                        <Button size="sm" variant="outline" className="border-white/20 hover:bg-white/10 hover:text-white transition-all rounded-xl" onClick={() => setIsQuotaModalOpen(true)}>Edit Quotas</Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2 bg-slate-950/50 p-4 rounded-2xl border border-white/5">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">WA Credits</p>
                                            <p className="font-black font-mono text-xl text-teal-300">{hotel.subscription?.whatsapp_credits ?? 0}</p>
                                        </div>
                                        <div className="space-y-2 bg-slate-950/50 p-4 rounded-2xl border border-white/5">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">AI Limit</p>
                                            <p className="font-black font-mono text-xl text-violet-300">{hotel.subscription?.ai_usage_limit ?? 0}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 border border-white/10 rounded-3xl bg-slate-900/40 backdrop-blur-sm space-y-6 shadow-lg">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-white/10 pb-4">Feature Flags</h4>
                                    <div className="space-y-6">
                                        {[
                                            { id: 'feature_ai_agent', label: 'AI Assistant', desc: 'Enable AI booking assistant' },
                                            { id: 'feature_guest_bot', label: 'Guest Bot', desc: 'Enable automated guest messaging' },
                                            { id: 'feature_rate_shopper', label: 'Rate Shopper', desc: 'Enable competitor rate tracking' }
                                        ].map(feature => (
                                            <div key={feature.id} className="flex items-center justify-between">
                                                <div>
                                                    <Label className="font-bold text-sm text-slate-200">{feature.label}</Label>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">{feature.desc}</p>
                                                </div>
                                                <Switch
                                                    className="data-[state=checked]:bg-teal-500"
                                                    checked={hotel[feature.id]}
                                                    onCheckedChange={(checked) => {
                                                        apiClient.patch(`/superadmin/hotels/${hotel.id}`, { [feature.id]: checked })
                                                            .then(() => {
                                                                toast.success(`${feature.label} updated`);
                                                                queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
                                                            });
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* INTEGRATIONS TAB */}
                            <TabsContent value="integrations" className="space-y-6 mt-0">
                                <HotelIntegrationsTab hotel={hotel} />
                            </TabsContent>

                            {/* DANGER ZONE TAB */}
                            <TabsContent value="danger" className="space-y-6 mt-0">
                                <div className="border border-rose-500/20 bg-rose-500/5 backdrop-blur-sm p-6 rounded-3xl space-y-6 shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]">
                                    <div className="flex items-center gap-3 text-rose-400 mb-2 border-b border-rose-500/10 pb-4">
                                        <AlertTriangle className="w-6 h-6" />
                                        <h3 className="font-black text-lg">Danger Zone</h3>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-sm text-slate-200">Account Status</p>
                                            <p className="text-xs text-slate-400 max-w-[200px] mt-1">Lock out all users of this property.</p>
                                        </div>
                                        <Button 
                                            variant={hotel.is_active ? "destructive" : "default"}
                                            className="rounded-xl shadow-lg"
                                            onClick={() => {
                                                apiClient.patch(`/superadmin/hotels/${hotel.id}`, { is_active: !hotel.is_active })
                                                    .then(() => {
                                                        toast.success(`Hotel account ${!hotel.is_active ? 'enabled' : 'disabled'}`);
                                                        queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
                                                    });
                                            }}
                                        >
                                            {hotel.is_active ? <XCircle className="w-4 h-4 mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                                            {hotel.is_active ? 'Disable' : 'Enable'}
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-rose-500/10">
                                        <div>
                                            <p className="font-bold text-sm text-slate-200">Pause Property</p>
                                            <p className="text-xs text-slate-400 max-w-[200px] mt-1">Disable public booking access. Owner can still log in.</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-300 rounded-xl"
                                            onClick={() => {
                                                if (confirm(`Pause ${hotel.name}? Public booking will be disabled.`)) {
                                                    wipeDataMutation.mutate();
                                                }
                                            }}
                                            disabled={wipeDataMutation.isPending}
                                        >
                                            <ServerCrash className="w-4 h-4 mr-2" /> Pause Property
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-rose-500/10">
                                        <div>
                                            <p className="font-bold text-sm text-rose-500">Delete Property</p>
                                            <p className="text-xs text-rose-500/70 max-w-[200px] mt-1">Permanently remove this hotel and all its data.</p>
                                        </div>
                                        <Button 
                                            variant="destructive"
                                            className="rounded-xl bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/25"
                                            onClick={() => {
                                                const code = Math.floor(1000 + Math.random() * 9000);
                                                const res = prompt(`Type ${code} to permanently delete ${hotel.name}`);
                                                if (res === code.toString()) {
                                                    deletePropertyMutation.mutate();
                                                }
                                            }}
                                            disabled={deletePropertyMutation.isPending}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    <div className="p-6 border-t border-white/10 bg-slate-950/80 backdrop-blur-md">
                        <Button
                            className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-black h-14 rounded-2xl text-sm shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-all"
                            onClick={() => impersonateMutation.mutate()}
                            disabled={impersonateMutation.isPending}
                        >
                            <UserCheck className="w-5 h-5 mr-3" />
                            IMPERSONATE HOTEL ADMIN
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Quota Modal */}
            <Dialog open={isQuotaModalOpen} onOpenChange={setIsQuotaModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adjust App Quotas</DialogTitle>
                        <DialogDescription>Modify the resource limits for this property.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>WhatsApp Credits</Label>
                            <Input type="number" value={waCredits} onChange={e => setWaCredits(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>SMS Credits</Label>
                            <Input type="number" value={smsCredits} onChange={e => setSmsCredits(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>AI Usage Limit</Label>
                            <Input type="number" value={aiLimit} onChange={e => setAiLimit(e.target.value)} />
                        </div>
                        <Button className="w-full" onClick={() => updateQuotasMutation.mutate({ whatsapp_credits: parseInt(waCredits), sms_credits: parseInt(smsCredits), ai_usage_limit: parseInt(aiLimit) })} disabled={updateQuotasMutation.isPending}>
                            Save Quotas
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Subscription Modal */}
            <Dialog open={isSubModalOpen} onOpenChange={setIsSubModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Modify Subscription Plan</DialogTitle>
                        <DialogDescription>Alter current billing plan for {hotel.name}.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Subscription Tier</Label>
                            <Select value={plan} onValueChange={setPlan}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Free">Free / Trial Plan</SelectItem>
                                    <SelectItem value="Basic">Basic Plan</SelectItem>
                                    <SelectItem value="Premium">Premium Plan</SelectItem>
                                    <SelectItem value="Enterprise">Enterprise Tier</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button className="w-full" onClick={() => updateSubMutation.mutate({ plan_name: plan, status })} disabled={updateSubMutation.isPending}>
                            Save Subscription Settings
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
