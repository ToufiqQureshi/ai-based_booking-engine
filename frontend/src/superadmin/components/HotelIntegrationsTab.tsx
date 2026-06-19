import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/core/hooks/use-toast';
import { apiClient } from '@/core/api/client';
import { Loader2, Save, Sparkles, MessageSquare, Mail, Server, Key, ShieldOff, ShieldCheck, AlertTriangle, Eye, EyeOff, RefreshCw, Database, Pause, CreditCard } from 'lucide-react';

interface HotelIntegrationsRead {
    hotel_id: string;
    hotel_name: string;
    ai_provider?: string;
    ai_model?: string;
    ai_base_url?: string;
    ai_max_tokens?: number | null;
    ai_api_key_preview?: string;
    has_ai_api_key: boolean;
    has_whatsapp_api_key: boolean;
    whatsapp_api_key_preview?: string;
    has_whatsapp_phone_id: boolean;
    has_whatsapp_business_id: boolean;
    whatsapp_phone_number_id?: string;
    whatsapp_business_account_id?: string;
    has_brevo_key: boolean;
    brevo_key_preview?: string;
    has_smtp_password: boolean;
    has_smtp_config: boolean;
    smtp_host?: string;
    smtp_from_email?: string;
    smtp_username?: string;
    smtp_port?: number;
    razorpay_key_id?: string;
    has_razorpay_secret: boolean;
    ai_whatsapp_credits: number;
    total_messages_sent: number;
    is_paused: boolean;
    pause_reason?: string;
    paused_at?: string;
}

interface HotelIntegrationsTabProps {
    hotel: any;
}

export function HotelIntegrationsTab({ hotel }: HotelIntegrationsTabProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [data, setData] = useState<HotelIntegrationsRead | null>(null);

    // Editable fields
    const [aiProvider, setAiProvider] = useState('');
    const [aiModel, setAiModel] = useState('');
    const [aiBaseUrl, setAiBaseUrl] = useState('');
    const [aiMaxTokens, setAiMaxTokens] = useState('');
    const [aiApiKey, setAiApiKey] = useState('');
    const [waApiKey, setWaApiKey] = useState('');
    const [waPhoneId, setWaPhoneId] = useState('');
    const [waBusinessId, setWaBusinessId] = useState('');
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState('');
    const [smtpUsername, setSmtpUsername] = useState('');
    const [smtpPassword, setSmtpPassword] = useState('');
    const [smtpFromEmail, setSmtpFromEmail] = useState('');
    const [razorpayKeyId, setRazorpayKeyId] = useState('');
    const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
    const [showRzpSecret, setShowRzpSecret] = useState(false);
    const [waCredits, setWaCredits] = useState('1000');

    // Show / hide password fields
    const [showAiKey, setShowAiKey] = useState(false);
    const [showWaKey, setShowWaKey] = useState(false);
    const [showSmtp, setShowSmtp] = useState(false);

    // Anti-autofill locks — fields start readOnly so browsers cannot inject saved passwords.
    // Unlock only when the admin explicitly clicks/focuses to type a new value.
    const [aiKeyLocked, setAiKeyLocked] = useState(true);
    const [waKeyLocked, setWaKeyLocked] = useState(true);
    const [smtpPassLocked, setSmtpPassLocked] = useState(true);
    const [rzpSecretLocked, setRzpSecretLocked] = useState(true);

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hotel.id]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const res = await apiClient.get<HotelIntegrationsRead>(`/superadmin/hotels/${hotel.id}/integrations`);
            setData(res);
            setAiProvider(res.ai_provider || '');
            setAiModel(res.ai_model || '');
            setAiBaseUrl(res.ai_base_url || '');
            setAiMaxTokens(res.ai_max_tokens ? String(res.ai_max_tokens) : '');
            setWaApiKey(''); // never populate the actual secret — admin must re-enter
            setAiKeyLocked(true);
            setWaKeyLocked(true);
            setSmtpPassLocked(true);
            setRzpSecretLocked(true);
            setWaPhoneId(res.whatsapp_phone_number_id || '');
            setWaBusinessId(res.whatsapp_business_account_id || '');
            setSmtpHost(res.smtp_host || '');
            setSmtpPort(res.smtp_port ? String(res.smtp_port) : '');
            setSmtpUsername(res.smtp_username || '');
            setSmtpPassword('');
            setSmtpFromEmail(res.smtp_from_email || '');
            setRazorpayKeyId(res.razorpay_key_id || '');
            setWaCredits(String(res.ai_whatsapp_credits || 1000));
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to load integrations' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const payload: any = {};
            // Only send fields that the admin actually changed
            // Empty strings mean "clear this field"
            if (aiProvider !== (data?.ai_provider || '')) payload.ai_provider = aiProvider;
            if (aiModel !== (data?.ai_model || '')) payload.ai_model = aiModel;
            if (aiBaseUrl !== (data?.ai_base_url || '')) payload.ai_base_url = aiBaseUrl;
            const parsedMaxTokens = aiMaxTokens ? parseInt(aiMaxTokens, 10) : null;
            const existingMaxTokens = data?.ai_max_tokens ?? null;
            if (parsedMaxTokens !== existingMaxTokens) payload.ai_max_tokens = parsedMaxTokens ?? 0;
            if (aiApiKey) payload.ai_api_key = aiApiKey;
            if (waApiKey) payload.whatsapp_api_key = waApiKey;
            if (waPhoneId !== (data?.whatsapp_phone_number_id || '')) payload.whatsapp_phone_number_id = waPhoneId;
            if (waBusinessId !== (data?.whatsapp_business_account_id || '')) payload.whatsapp_business_account_id = waBusinessId;
            if (smtpHost !== (data?.smtp_host || '')) payload.smtp_host = smtpHost;
            
            const parsedSmtpPort = smtpPort ? parseInt(smtpPort, 10) : null;
            const existingSmtpPort = data?.smtp_port ?? null;
            if (parsedSmtpPort !== existingSmtpPort) payload.smtp_port = parsedSmtpPort;

            if (smtpUsername !== (data?.smtp_username || '')) payload.smtp_username = smtpUsername;
            if (smtpPassword) payload.smtp_password = smtpPassword;
            if (smtpFromEmail !== (data?.smtp_from_email || '')) payload.smtp_from_email = smtpFromEmail;
            if (razorpayKeyId !== (data?.razorpay_key_id || '')) payload.razorpay_key_id = razorpayKeyId;
            if (razorpayKeySecret) payload.razorpay_key_secret = razorpayKeySecret;
            if (Number(waCredits) !== data?.ai_whatsapp_credits) payload.ai_whatsapp_credits = Number(waCredits);

            if (Object.keys(payload).length === 0) {
                toast({ title: 'No changes to save' });
                return;
            }
            const res = await apiClient.put<{ message: string; fields_updated: string[] }>(`/superadmin/hotels/${hotel.id}/integrations`, payload);
            toast({ title: 'Saved', description: res.message });
            // Clear and re-lock the secret fields after save
            setAiApiKey(''); setWaApiKey(''); setSmtpPassword(''); setRazorpayKeySecret('');
            setAiKeyLocked(true); setWaKeyLocked(true); setSmtpPassLocked(true); setRzpSecretLocked(true);
            loadData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save failed', description: error?.response?.data?.detail || error?.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRefreshSocialProof = async () => {
        try {
            setIsRefreshing(true);
            await apiClient.post(`/superadmin/social-proof/refresh?hotel_id=${hotel.id}`);
            toast({ title: 'Refreshed', description: 'Social proof cache updated.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Refresh failed', description: error?.message });
        } finally {
            setIsRefreshing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Status overview */}
            <Card className="border-border bg-card dark:border-white/10 dark:bg-slate-900/40 backdrop-blur-sm rounded-3xl shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                                <Server className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-foreground">Integration Status</CardTitle>
                                <CardDescription>Overview of all configured integrations for {data?.hotel_name}</CardDescription>
                            </div>
                        </div>
                        {data?.is_paused && (
                            <Badge variant="destructive" className="rounded-full">
                                <Pause className="w-3 h-3 mr-1" /> Paused
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatusPill label="AI" isOn={data?.has_ai_api_key} preview={data?.ai_api_key_preview} />
                        <StatusPill label="WhatsApp" isOn={data?.has_whatsapp_api_key} preview={data?.whatsapp_api_key_preview} />
                        <StatusPill label="Brevo" isOn={data?.has_brevo_key} preview={data?.brevo_key_preview} />
                        <StatusPill label="SMTP" isOn={data?.has_smtp_config} preview={undefined} />
                        <StatusPill label="Razorpay" isOn={!!data?.razorpay_key_id && data?.has_razorpay_secret} preview={undefined} />
                    </div>
                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Credits used: <strong className="text-foreground">{data?.total_messages_sent || 0}</strong></span>
                        <Separator orientation="vertical" className="h-3 bg-border dark:bg-slate-700" />
                        <span>Credits remaining: <strong className="text-foreground">{data?.ai_whatsapp_credits || 0}</strong></span>
                    </div>
                </CardContent>
            </Card>

            {/* AI Provider */}
            <Card className="border-border bg-card dark:border-white/10 dark:bg-slate-900/40 backdrop-blur-sm rounded-3xl shadow-sm">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-500" /> AI Provider</CardTitle>
                    <CardDescription>Groq, OpenAI, Anthropic, or any OpenAI-compatible endpoint.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2 flex-wrap mb-4">
                        <Button type="button" variant="outline" size="sm" onClick={() => { setAiProvider('groq'); setAiModel('llama-3.3-70b-versatile'); setAiBaseUrl('https://api.groq.com/openai/v1'); }} className="rounded-xl">
                            Auto-Config Groq
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setAiProvider('openai'); setAiModel('gpt-4o-mini'); setAiBaseUrl(''); }} className="rounded-xl">
                            OpenAI GPT-4o mini
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setAiProvider('gemini'); setAiModel('gemini-2.5-flash'); setAiBaseUrl(''); }} className="rounded-xl">
                            Gemini 2.5 Flash
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setAiProvider('deepseek'); setAiModel('deepseek-chat'); setAiBaseUrl('https://api.deepseek.com'); }} className="rounded-xl">
                            DeepSeek Chat
                        </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground/80">Provider</Label>
                            <Input value={aiProvider} onChange={e => setAiProvider(e.target.value)} placeholder="groq" className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground/80">Model</Label>
                            <Input value={aiModel} onChange={e => setAiModel(e.target.value)} placeholder="llama-3.1-70b-versatile" className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label className="text-xs font-bold text-foreground/80">Base URL (optional — for custom endpoints)</Label>
                            <Input value={aiBaseUrl} onChange={e => setAiBaseUrl(e.target.value)} placeholder="https://api.groq.com/openai/v1" className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground/80">Max Tokens</Label>
                            <Input
                                type="number"
                                min="128"
                                max="32768"
                                value={aiMaxTokens}
                                onChange={e => setAiMaxTokens(e.target.value)}
                                placeholder={`default (guest: 1024 / assistant: 2048)`}
                                className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11"
                            />
                            {aiMaxTokens && parseInt(aiMaxTokens, 10) < 1024 && (
                                <p className="text-[10px] text-amber-500 font-medium mt-1">
                                    ⚠️ Warning: Setting Max Tokens below 1024 may truncate detailed dashboard assistant responses (charts/tables).
                                </p>
                            )}
                            <p className="text-[10px] text-muted-foreground">Controls response length for all AI agents. Leave blank to use defaults.</p>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label className="text-xs font-bold text-foreground/80 flex items-center gap-2">
                                <Key className="w-3 h-3 text-muted-foreground" /> API Key
                                {data?.ai_api_key_preview && <span className="text-muted-foreground font-normal">current: {data.ai_api_key_preview}</span>}
                            </Label>
                            <div className="relative">
                                <Input type="text" style={showAiKey ? {} : { WebkitTextSecurity: 'disc' } as React.CSSProperties} readOnly={aiKeyLocked} onFocus={() => setAiKeyLocked(false)} onClick={() => setAiKeyLocked(false)} autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} placeholder={aiKeyLocked ? 'Click to enter a new key (leave blank to keep existing)' : 'Leave blank to keep existing'} className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11 pr-10" />
                                <button type="button" onClick={() => setShowAiKey(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    {showAiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* WhatsApp */}
            <Card className="border-border bg-card dark:border-white/10 dark:bg-slate-900/40 backdrop-blur-sm rounded-3xl shadow-sm">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2"><MessageSquare className="w-4 h-4 text-teal-500" /> WhatsApp / Meta</CardTitle>
                    <CardDescription>Required for the WhatsApp AI agent. Configure in Meta for Developers.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground/80">Phone Number ID</Label>
                            <Input value={waPhoneId} onChange={e => setWaPhoneId(e.target.value)} placeholder={data?.has_whatsapp_phone_id ? '(configured)' : ''} className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground/80">Business Account ID</Label>
                            <Input value={waBusinessId} onChange={e => setWaBusinessId(e.target.value)} placeholder={data?.has_whatsapp_business_id ? '(configured)' : ''} className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label className="text-xs font-bold text-foreground/80 flex items-center gap-2">
                                <Key className="w-3 h-3 text-muted-foreground" /> API Key (System User Token)
                                {data?.whatsapp_api_key_preview && <span className="text-muted-foreground font-normal">current: {data.whatsapp_api_key_preview}</span>}
                            </Label>
                            <div className="relative">
                                <Input type="text" style={showWaKey ? {} : { WebkitTextSecurity: 'disc' } as React.CSSProperties} readOnly={waKeyLocked} onFocus={() => setWaKeyLocked(false)} onClick={() => setWaKeyLocked(false)} autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" value={waApiKey} onChange={e => setWaApiKey(e.target.value)} placeholder={waKeyLocked ? 'Click to enter a new key (leave blank to keep existing)' : 'Leave blank to keep existing'} className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11 pr-10" />
                                <button type="button" onClick={() => setShowWaKey(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    {showWaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Email */}
            <Card className="border-border bg-card dark:border-white/10 dark:bg-slate-900/40 backdrop-blur-sm rounded-3xl shadow-sm">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2"><Mail className="w-4 h-4 text-amber-500" /> Email Provider</CardTitle>
                    <CardDescription>Brevo is the platform default. SMTP is the custom fallback for direct-send setups.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* SMTP */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground/80">SMTP Host</Label>
                            <Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground/80">Port</Label>
                            <Input type="number" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground/80">Username</Label>
                            <Input value={smtpUsername} onChange={e => setSmtpUsername(e.target.value)} placeholder={data?.has_smtp_config ? '(configured)' : ''} className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground/80">From Email</Label>
                            <Input type="email" value={smtpFromEmail} onChange={e => setSmtpFromEmail(e.target.value)} placeholder="reservations@hotel.com" className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label className="text-xs font-bold text-foreground/80">Password / App Password</Label>
                            <div className="relative">
                                <Input type="text" style={showSmtp ? {} : { WebkitTextSecurity: 'disc' } as React.CSSProperties} readOnly={smtpPassLocked} onFocus={() => setSmtpPassLocked(false)} onClick={() => setSmtpPassLocked(false)} autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} placeholder={smtpPassLocked ? 'Click to enter a new password (leave blank to keep existing)' : 'Leave blank to keep existing'} className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11 pr-10" />
                                <button type="button" onClick={() => setShowSmtp(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                    {showSmtp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Razorpay (per-hotel payment gateway) */}
            <Card className="border-border bg-card dark:border-white/10 dark:bg-slate-900/40 backdrop-blur-sm rounded-3xl shadow-sm">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-500" /> Razorpay (Payments)</CardTitle>
                    <CardDescription>Per-property Razorpay account. Payments settle directly into this hotel's account. Both fields are required for online payments to work.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground/80">Key ID</Label>
                            <Input value={razorpayKeyId} onChange={e => setRazorpayKeyId(e.target.value)} placeholder="rzp_live_xxxxxxxx" className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground/80 flex items-center gap-2">
                                Key Secret
                                {data?.has_razorpay_secret && <span className="text-emerald-500 inline-flex items-center gap-1 text-[10px]"><ShieldCheck className="w-3 h-3" /> configured</span>}
                            </Label>
                            <div className="relative">
                                <Input type="text" style={showRzpSecret ? {} : { WebkitTextSecurity: 'disc' } as React.CSSProperties} readOnly={rzpSecretLocked} onFocus={() => setRzpSecretLocked(false)} onClick={() => setRzpSecretLocked(false)} autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" value={razorpayKeySecret} onChange={e => setRazorpayKeySecret(e.target.value)} placeholder={rzpSecretLocked ? 'Click to enter key secret' : (data?.has_razorpay_secret ? 'Leave blank to keep existing' : 'Enter key secret')} className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11 pr-10" />
                                <button type="button" onClick={() => setShowRzpSecret(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                    {showRzpSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">The Key Secret is write-only — for security it is never sent back to the browser, only a "configured" indicator.</p>
                </CardContent>
            </Card>

            {/* Quotas */}
            <Card className="border-border bg-card dark:border-white/10 dark:bg-slate-900/40 backdrop-blur-sm rounded-3xl shadow-sm">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2"><Database className="w-4 h-4 text-emerald-500" /> Quotas</CardTitle>
                    <CardDescription>Pause/lock controls live in the Danger Zone tab to avoid two places editing the same state.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground/80">AI WhatsApp Credits (monthly)</Label>
                            <Input type="number" value={waCredits} onChange={e => setWaCredits(e.target.value)} className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 sticky bottom-0 bg-background/80 dark:bg-slate-950/80 backdrop-blur-md p-4 rounded-2xl border border-border dark:border-white/10 shadow-lg -mx-2">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleRefreshSocialProof}
                        disabled={isRefreshing}
                        className="rounded-xl border-border text-foreground hover:bg-muted"
                    >
                        {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Refresh Public Cache
                    </Button>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/25 h-12 px-6"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save All Integrations
                </Button>
            </div>
        </div>
    );
}

function StatusPill({ label, isOn, preview }: { label: string; isOn?: boolean; preview?: string }) {
    return (
        <div className={`p-3 rounded-2xl border ${isOn ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border bg-muted/40 dark:border-white/5 dark:bg-slate-900/40'}`}>
            <div className="flex items-center gap-2">
                {isOn ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> : <ShieldOff className="w-3.5 h-3.5 text-muted-foreground" />}
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/80">{label}</span>
            </div>
            <p className={`text-xs mt-1 font-medium ${isOn ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                {isOn ? (preview ? `set ${preview}` : 'configured') : 'not set'}
            </p>
        </div>
    );
}
