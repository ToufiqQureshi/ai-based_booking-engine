import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, UserCheck, ShieldCheck, Lock, Sliders, Users, SlidersHorizontal, MessageSquare, Zap, BrainCircuit, Trash2, XCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface HotelWorkspaceProps {
    hotel: any;
    onBack: () => void;
    users: any[];
}

export const HotelWorkspace = ({ hotel, onBack, users }: HotelWorkspaceProps) => {
    const [tab, setTab] = useState<'overview' | 'users' | 'permissions' | 'features' | 'google_ads'>('overview');
    const queryClient = useQueryClient();

    // Quota states
    const [waCredits, setWaCredits] = useState(hotel.subscription?.whatsapp_credits?.toString() || '1000');
    const [aiLimit, setAiLimit] = useState(hotel.subscription?.ai_usage_limit?.toString() || '50000');

    // Google Ads states
    const [hcId, setHcId] = useState(hotel.integration_settings?.google_hotel_center_id || '');
    const [adsId, setAdsId] = useState(hotel.integration_settings?.google_ads_account_id || '');

    // Sub states
    const [plan, setPlan] = useState(hotel.subscription?.plan || 'Basic');
    const [status, setStatus] = useState(hotel.subscription?.status || 'active');

    const updateSubMutation = useMutation({
        mutationFn: (data: any) => apiClient.post(`/superadmin/hotels/${hotel.id}/subscription`, data),
        onSuccess: () => {
            toast.success("Subscription updated");
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        }
    });

    const updateQuotasMutation = useMutation({
        mutationFn: (data: any) => apiClient.patch(`/superadmin/hotels/${hotel.id}/quotas`, data),
        onSuccess: () => {
            toast.success("Quotas updated");
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-muted/20 p-6 rounded-2xl border">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={onBack} className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
                    <div>
                        <h2 className="text-2xl font-black">{hotel.name}</h2>
                        <p className="text-xs text-muted-foreground font-mono">{hotel.slug}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 font-bold" onClick={() => impersonateMutation.mutate()} disabled={impersonateMutation.isPending}>
                        <UserCheck className="w-4 h-4 mr-2" /> Impersonate
                    </Button>
                </div>
            </div>

            <div className="flex border-b gap-2 overflow-x-auto">
                {['overview', 'users', 'permissions', 'features', 'google_ads'].map(t => (
                    <button key={t} onClick={() => setTab(t as any)} className={`px-6 py-3 border-b-2 font-bold text-sm capitalize transition-all ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                        {t.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader><CardTitle>Subscription Control</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Plan Tier</Label>
                                    <Select value={plan} onValueChange={setPlan}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Free">Free</SelectItem>
                                            <SelectItem value="Basic">Basic</SelectItem>
                                            <SelectItem value="Premium">Premium</SelectItem>
                                            <SelectItem value="Enterprise">Enterprise</SelectItem>
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
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button className="w-full" onClick={() => updateSubMutation.mutate({ plan_name: plan, status })} disabled={updateSubMutation.isPending}>Save Subscription</Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Quotas</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>WA Credits</Label>
                                <Input type="number" value={waCredits} onChange={e => setWaCredits(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>AI Limit</Label>
                                <Input type="number" value={aiLimit} onChange={e => setAiLimit(e.target.value)} />
                            </div>
                            <Button className="w-full" variant="outline" onClick={() => updateQuotasMutation.mutate({ whatsapp_credits: parseInt(waCredits), ai_usage_limit: parseInt(aiLimit) })} disabled={updateQuotasMutation.isPending}>Update Limits</Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {tab === 'google_ads' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Google Hotel Ads Integration</CardTitle>
                            <CardDescription>Manage the property's connection to Google Hotel Center and Ads.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-muted/20 border rounded-2xl">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-bold">Enable GHA Feature</Label>
                                    <p className="text-xs text-muted-foreground">Allows the hotel to configure Google Ads in their settings.</p>
                                </div>
                                <Switch
                                    checked={hotel.feature_google_ads}
                                    onCheckedChange={(checked) => {
                                        apiClient.patch(`/superadmin/hotels/${hotel.id}`, { feature_google_ads: checked })
                                            .then(() => {
                                                toast.success(`Google Ads feature ${checked ? 'enabled' : 'disabled'}`);
                                                queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
                                            });
                                    }}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Google Hotel Center ID</Label>
                                    <Input
                                        placeholder="e.g. 123456"
                                        value={hcId}
                                        onChange={(e) => setHcId(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Google Ads Account ID</Label>
                                    <Input
                                        placeholder="e.g. 987-654-3210"
                                        value={adsId}
                                        onChange={(e) => setAdsId(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Button
                                className="w-full"
                                variant="outline"
                                onClick={() => {
                                    apiClient.put('/integration/settings', {
                                        google_hotel_center_id: hcId,
                                        google_ads_account_id: adsId
                                    }, { headers: { 'X-Impersonate-Hotel-ID': hotel.id } }) // This assumes superadmin can update via impersonation or specific endpoint
                                    .then(() => toast.success("Google IDs updated"))
                                    .catch(() => {
                                        // Fallback to superadmin specific update if needed
                                        apiClient.patch(`/superadmin/hotels/${hotel.id}`, {
                                            integration_settings: {
                                                ...hotel.integration_settings,
                                                google_hotel_center_id: hcId,
                                                google_ads_account_id: adsId
                                            }
                                        }).then(() => toast.success("Google IDs updated via SuperAdmin"));
                                    });
                                }}
                            >
                                Save Google Integration IDs
                            </Button>

                            <div className="p-4 border rounded-2xl space-y-3">
                                <h4 className="text-sm font-bold">Sync Status</h4>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Last ARI Sync:</span>
                                    <span className="font-mono">
                                        {hotel.integration_settings?.google_ads_last_ari_sync
                                            ? format(new Date(hotel.integration_settings.google_ads_last_ari_sync), 'MMM d, yyyy HH:mm')
                                            : 'Never'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Integration Health:</span>
                                    <Badge variant={hotel.integration_settings?.google_ads_status === 'active' ? 'default' : 'secondary'}>
                                        {hotel.integration_settings?.google_ads_status || 'inactive'}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Technical Links</CardTitle>
                            <CardDescription>Endpoints for Google verification.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Hotel List XML</Label>
                                <div className="p-2 bg-muted/50 rounded-lg text-[10px] font-mono break-all border">
                                    /api/v1/google/feed/hotels.xml
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Landing Pages (POS) XML</Label>
                                <div className="p-2 bg-muted/50 rounded-lg text-[10px] font-mono break-all border">
                                    /api/v1/google/feed/pos.xml
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">ARI Pull Endpoint</Label>
                                <div className="p-2 bg-muted/50 rounded-lg text-[10px] font-mono break-all border">
                                    /api/v1/google/feed/ari.xml?hotel_id={hotel.id}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full text-xs font-bold"
                                onClick={() => {
                                    apiClient.post(`/google/sync/push?hotel_id=${hotel.id}`)
                                        .then(() => toast.success("Push notification sent to Google"));
                                }}
                            >
                                <Zap className="w-3.5 h-3.5 mr-2" /> Force Push Sync
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {tab === 'users' && (
                <Card>
                    <CardHeader><CardTitle>User Accounts</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {users.filter(u => u.hotel_id === hotel.id).map(u => (
                                <div key={u.id} className="p-4 border rounded-xl flex justify-between items-center">
                                    <div>
                                        <p className="font-bold">{u.name}</p>
                                        <p className="text-xs text-muted-foreground">{u.email} • {u.role}</p>
                                    </div>
                                    <Badge variant={u.is_active ? 'default' : 'destructive'}>{u.is_active ? 'Active' : 'Suspended'}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
