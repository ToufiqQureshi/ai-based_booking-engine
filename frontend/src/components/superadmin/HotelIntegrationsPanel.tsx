import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Sparkles, Loader2, Save, CreditCard, CheckCircle2, XCircle } from 'lucide-react';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

interface HotelIntegrationsData {
    hotel_id: string;
    hotel_name: string;
    has_whatsapp_api_key: boolean;
    whatsapp_api_key_preview?: string;
    has_whatsapp_phone_id: boolean;
    has_whatsapp_business_id: boolean;
    has_ai_api_key: boolean;
    ai_api_key_preview?: string;
    ai_provider?: string;
    ai_model?: string;
    ai_base_url?: string;
    ai_max_tokens?: number | null;
    ai_whatsapp_credits: number;
    total_messages_sent: number;
    is_paused: boolean;
}

interface Props {
    hotelId: string;
    hotelName: string;
    onClose?: () => void;
}

export function HotelIntegrationsPanel({ hotelId, hotelName, onClose }: Props) {
    const [data, setData] = useState<HotelIntegrationsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        whatsapp_api_key: '',
        whatsapp_phone_number_id: '',
        whatsapp_business_account_id: '',
        ai_provider: 'groq',
        ai_model: 'llama-3.3-70b-versatile',
        ai_api_key: '',
        ai_base_url: 'https://api.groq.com/openai/v1',
        ai_max_tokens: '' as string,
        credit_topup: 0,
    });

    useEffect(() => {
        loadData();
    }, [hotelId]);

    const loadData = async () => {
        try {
            const res = await apiClient.get<HotelIntegrationsData>(`/superadmin/hotels/${hotelId}/integrations`);
            setData(res);
            setForm(prev => ({
                ...prev,
                ai_provider: res.ai_provider || 'groq',
                ai_model: res.ai_model || 'llama-3.3-70b-versatile',
                ai_base_url: res.ai_base_url || 'https://api.groq.com/openai/v1',
                ai_max_tokens: res.ai_max_tokens ? String(res.ai_max_tokens) : '',
            }));
        } catch (e) {
            toast.error('Failed to load integration data');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: any = {};
            if (form.whatsapp_api_key) payload.whatsapp_api_key = form.whatsapp_api_key;
            if (form.whatsapp_phone_number_id) payload.whatsapp_phone_number_id = form.whatsapp_phone_number_id;
            if (form.whatsapp_business_account_id) payload.whatsapp_business_account_id = form.whatsapp_business_account_id;
            if (form.ai_api_key) payload.ai_api_key = form.ai_api_key;
            if (form.ai_provider) payload.ai_provider = form.ai_provider;
            if (form.ai_model) payload.ai_model = form.ai_model;
            if (form.ai_base_url) payload.ai_base_url = form.ai_base_url;
            if (form.ai_max_tokens) payload.ai_max_tokens = parseInt(form.ai_max_tokens, 10);
            if (form.credit_topup > 0) {
                payload.ai_whatsapp_credits = (data?.ai_whatsapp_credits || 0) + form.credit_topup;
            }
            await apiClient.put(`/superadmin/hotels/${hotelId}/integrations`, payload);
            toast.success('Integration settings saved');
            await loadData();
            setForm(prev => ({ ...prev, whatsapp_api_key: '', whatsapp_phone_number_id: '', whatsapp_business_account_id: '', ai_api_key: '', credit_topup: 0 }));
        } catch (e) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-6 flex items-center gap-2"><Loader2 className="animate-spin h-4 w-4" /> Loading...</div>;

    return (
        <div className="space-y-6 p-1">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold">{hotelName}</h2>
                    <p className="text-sm text-muted-foreground">Configure integrations for this property</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={data?.is_paused ? 'destructive' : 'default'}>
                        {data?.is_paused ? 'Paused' : 'Active'}
                    </Badge>
                </div>
            </div>

            {/* Status Overview */}
            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: 'WhatsApp', active: data?.has_whatsapp_api_key && data?.has_whatsapp_phone_id },
                    { label: 'AI Agent', active: data?.has_ai_api_key },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                        {item.active ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-slate-300" />}
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{item.active ? 'Configured' : 'Not set'}</span>
                    </div>
                ))}
            </div>

            {/* Usage Stats */}
            <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg border text-center">
                    <p className="text-2xl font-bold">{data?.ai_whatsapp_credits ?? 0}</p>
                    <p className="text-muted-foreground">Credits</p>
                </div>
                <div className="p-3 rounded-lg border text-center">
                    <p className="text-2xl font-bold">{data?.total_messages_sent ?? 0}</p>
                    <p className="text-muted-foreground">Messages Sent</p>
                </div>
            </div>

            {/* WhatsApp Config */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" /> WhatsApp Configuration
                    </CardTitle>
                    {data?.has_whatsapp_api_key && <CardDescription className="text-xs">Current key: {data.whatsapp_api_key_preview}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <Label className="text-xs">Access Token (leave blank to keep existing)</Label>
                        <Input type="password" placeholder="EAAGz..." autoComplete="new-password" value={form.whatsapp_api_key} onChange={e => setForm(p => ({ ...p, whatsapp_api_key: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Phone Number ID</Label>
                            <Input placeholder="1098485..." value={form.whatsapp_phone_number_id} onChange={e => setForm(p => ({ ...p, whatsapp_phone_number_id: e.target.value }))} />
                        </div>
                        <div>
                            <Label className="text-xs">Business Account ID</Label>
                            <Input placeholder="948475..." value={form.whatsapp_business_account_id} onChange={e => setForm(p => ({ ...p, whatsapp_business_account_id: e.target.value }))} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* AI Config */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> AI Configuration
                    </CardTitle>
                    {data?.has_ai_api_key && <CardDescription className="text-xs">Current key: {data.ai_api_key_preview}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, ai_provider: 'groq', ai_model: 'llama-3.3-70b-versatile', ai_base_url: 'https://api.groq.com/openai/v1' }))}>
                            Auto-Config Groq
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, ai_provider: 'openai', ai_model: 'gpt-4o-mini', ai_base_url: '' }))}>
                            OpenAI GPT-4o mini
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Provider</Label>
                            <Input value={form.ai_provider} onChange={e => setForm(p => ({ ...p, ai_provider: e.target.value }))} />
                        </div>
                        <div>
                            <Label className="text-xs">Model</Label>
                            <Input value={form.ai_model} onChange={e => setForm(p => ({ ...p, ai_model: e.target.value }))} />
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs">API Key (leave blank to keep existing)</Label>
                        <Input type="password" placeholder="sk-..." autoComplete="new-password" value={form.ai_api_key} onChange={e => setForm(p => ({ ...p, ai_api_key: e.target.value }))} />
                    </div>
                    <div>
                        <Label className="text-xs">Base URL</Label>
                        <Input placeholder="https://api.groq.com/openai/v1" value={form.ai_base_url} onChange={e => setForm(p => ({ ...p, ai_base_url: e.target.value }))} />
                    </div>
                    <div>
                        <Label className="text-xs">Max Tokens (optional)</Label>
                        <Input type="number" min="128" max="32768" placeholder="default: 1024 guest / 2048 assistant" value={form.ai_max_tokens} onChange={e => setForm(p => ({ ...p, ai_max_tokens: e.target.value }))} />
                    </div>
                </CardContent>
            </Card>

            {/* Credit Top-up */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> Add WhatsApp Credits
                    </CardTitle>
                    <CardDescription className="text-xs">Current balance: {data?.ai_whatsapp_credits ?? 0} credits</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input type="number" min="0" placeholder="e.g. 500" value={form.credit_topup || ''} onChange={e => setForm(p => ({ ...p, credit_topup: parseInt(e.target.value) || 0 }))} className="w-40" />
                        <div className="flex gap-1">
                            {[100, 500, 1000].map(n => (
                                <Button key={n} variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, credit_topup: n }))}>+{n}</Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pt-2">
                {onClose && <Button variant="outline" onClick={onClose}>Cancel</Button>}
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save All Changes
                </Button>
            </div>
        </div>
    );
}
