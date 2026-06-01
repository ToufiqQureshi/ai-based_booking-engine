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
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

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
            localStorage.setItem('superadmin_original_token', localStorage.getItem('token') || '');
            localStorage.setItem('token', data.access_token);
            window.location.href = '/';
        }
    });

    const wipeDataMutation = useMutation({
        mutationFn: () => apiClient.post(`/superadmin/hotels/${hotel.id}/wipe`, {}),
        onSuccess: () => {
            toast.success("Property data successfully wiped and reset");
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        }
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
                <SheetContent className="w-full sm:max-w-lg bg-background border-l border-border p-0 shadow-2xl flex flex-col h-full overflow-hidden">
                    <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50/5 text-indigo-600 rounded-xl flex items-center justify-center border shadow-sm">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <SheetTitle className="text-lg font-black">{hotel.name}</SheetTitle>
                                <SheetDescription className="text-xs font-mono text-indigo-600 font-bold mt-0.5">slug: {hotel.slug}</SheetDescription>
                            </div>
                        </div>
                        <Badge className={`rounded-lg px-2.5 py-1 font-black text-[9px] uppercase tracking-widest border ${
                            hotel.is_active ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700'
                        }`}>
                            {hotel.is_active ? 'Active' : 'Locked'}
                        </Badge>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <Tabs defaultValue="properties" className="w-full space-y-6">
                            <TabsList className="bg-muted w-full flex rounded-xl p-1">
                                <TabsTrigger value="properties" className="flex-1 rounded-lg text-[10px] font-bold">Properties</TabsTrigger>
                                <TabsTrigger value="integrations" className="flex-1 rounded-lg text-[10px] font-bold">Integrations</TabsTrigger>
                                <TabsTrigger value="danger" className="flex-1 rounded-lg text-[10px] font-bold text-red-600">Danger Zone</TabsTrigger>
                            </TabsList>

                            {/* PROPERTIES TAB */}
                            <TabsContent value="properties" className="space-y-6 mt-0">
                                <div className="p-5 border border-border rounded-2xl bg-muted/10 space-y-4">
                                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Subscription & Plan</h4>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Badge className="font-bold uppercase tracking-wider">{hotel.subscription?.plan || 'Free'}</Badge>
                                            <p className="text-xs text-muted-foreground mt-1">Status: {hotel.subscription?.status || 'inactive'}</p>
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => setIsSubModalOpen(true)}>Edit Plan</Button>
                                    </div>
                                </div>

                                <div className="p-5 border border-border rounded-2xl bg-muted/10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">App Quotas & Limits</h4>
                                        <Button size="sm" variant="outline" onClick={() => setIsQuotaModalOpen(true)}>Edit Quotas</Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground">WA Credits</p>
                                            <p className="font-bold font-mono text-sm">{hotel.subscription?.whatsapp_credits ?? 0}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground">AI Limit</p>
                                            <p className="font-bold font-mono text-sm">{hotel.subscription?.ai_usage_limit ?? 0}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5 border border-border rounded-2xl bg-muted/10 space-y-4">
                                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Feature Flags</h4>
                                    {[
                                        { id: 'feature_ai_agent', label: 'AI Assistant', desc: 'Enable AI booking assistant' },
                                        { id: 'feature_guest_bot', label: 'Guest Bot', desc: 'Enable automated guest messaging' },
                                        { id: 'feature_rate_shopper', label: 'Rate Shopper', desc: 'Enable competitor rate tracking' }
                                    ].map(feature => (
                                        <div key={feature.id} className="flex items-center justify-between">
                                            <div>
                                                <Label className="font-bold text-sm">{feature.label}</Label>
                                                <p className="text-[10px] text-muted-foreground">{feature.desc}</p>
                                            </div>
                                            <Switch
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
                            </TabsContent>

                            {/* INTEGRATIONS TAB */}
                            <TabsContent value="integrations" className="space-y-6 mt-0">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold flex items-center gap-2"><Key className="w-3 h-3"/> OpenAI API Key</Label>
                                        <Input type="password" value={openAiKey} onChange={e => setOpenAiKey(e.target.value)} placeholder="sk-..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold flex items-center gap-2"><MessageSquare className="w-3 h-3"/> WA Admin Phone</Label>
                                        <Input value={waAdminPhone} onChange={e => setWaAdminPhone(e.target.value)} placeholder="+1234567890" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold flex items-center gap-2"><Webhook className="w-3 h-3"/> Custom Webhook URL</Label>
                                        <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://..." />
                                    </div>
                                    <Button className="w-full font-bold" onClick={() => saveKeysMutation.mutate({ 
                                        openai_api_key: openAiKey, 
                                        whatsapp_admin_phone: waAdminPhone,
                                        webhook_url: webhookUrl 
                                    })}>
                                        Save Integration Keys
                                    </Button>
                                </div>
                            </TabsContent>

                            {/* DANGER ZONE TAB */}
                            <TabsContent value="danger" className="space-y-6 mt-0">
                                <div className="border border-red-200 bg-red-50/30 p-6 rounded-2xl space-y-6">
                                    <div className="flex items-center gap-3 text-red-600 mb-2">
                                        <AlertTriangle className="w-6 h-6" />
                                        <h3 className="font-black text-lg">Danger Zone</h3>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-sm">Account Status</p>
                                            <p className="text-xs text-muted-foreground max-w-[200px]">Lock out all users of this property.</p>
                                        </div>
                                        <Button 
                                            variant={hotel.is_active ? "destructive" : "default"}
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

                                    <div className="flex items-center justify-between pt-4 border-t border-red-100">
                                        <div>
                                            <p className="font-bold text-sm">Wipe Hotel Data</p>
                                            <p className="text-xs text-muted-foreground max-w-[200px]">Delete all reservations, guests, and logs.</p>
                                        </div>
                                        <Button 
                                            variant="outline" 
                                            className="text-red-600 border-red-200 hover:bg-red-50"
                                            onClick={() => {
                                                if(confirm(`Are you sure you want to WIPE all operational data for ${hotel.name}?`)) {
                                                    wipeDataMutation.mutate();
                                                }
                                            }}
                                            disabled={wipeDataMutation.isPending}
                                        >
                                            <ServerCrash className="w-4 h-4 mr-2" /> Wipe Data
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-red-100">
                                        <div>
                                            <p className="font-bold text-sm text-red-700">Delete Property</p>
                                            <p className="text-xs text-red-600/80 max-w-[200px]">Permanently remove this hotel and all its data.</p>
                                        </div>
                                        <Button 
                                            variant="destructive"
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

                    <div className="p-6 border-t border-border bg-background">
                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl text-sm"
                            onClick={() => impersonateMutation.mutate()}
                            disabled={impersonateMutation.isPending}
                        >
                            <UserCheck className="w-4 h-4 mr-2" />
                            Impersonate Hotel Admin
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
