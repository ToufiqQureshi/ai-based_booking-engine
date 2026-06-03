import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { Loader2, Save, Sparkles, MessageSquare, Mail, Server, Key, ShieldOff, ShieldCheck, AlertTriangle, Eye, EyeOff, RefreshCw, Database, Pause, Play } from 'lucide-react';

interface HotelIntegrationsRead {
    hotel_id: string;
    hotel_name: string;
    ai_provider?: string;
    ai_model?: string;
    ai_base_url?: string;
    ai_api_key_preview?: string;
    has_ai_api_key: boolean;
    has_whatsapp_api_key: boolean;
    whatsapp_api_key_preview?: string;
    has_whatsapp_phone_id: boolean;
    has_whatsapp_business_id: boolean;
    has_brevo_key: boolean;
    brevo_key_preview?: string;
    has_smtp_password: boolean;
    has_smtp_config: boolean;
    smtp_host?: string;
    smtp_from_email?: string;
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
    const [aiApiKey, setAiApiKey] = useState('');
    const [waApiKey, setWaApiKey] = useState('');
    const [waPhoneId, setWaPhoneId] = useState('');
    const [waBusinessId, setWaBusinessId] = useState('');
    const [brevoKey, setBrevoKey] = useState('');
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState('');
    const [smtpUsername, setSmtpUsername] = useState('');
    const [smtpPassword, setSmtpPassword] = useState('');
    const [smtpFromEmail, setSmtpFromEmail] = useState('');
    const [waCredits, setWaCredits] = useState('1000');
    const [isPaused, setIsPaused] = useState(false);
    const [pauseReason, setPauseReason] = useState('');

    // Show / hide password fields
    const [showAiKey, setShowAiKey] = useState(false);
    const [showWaKey, setShowWaKey] = useState(false);
    const [showBrevo, setShowBrevo] = useState(false);
    const [showSmtp, setShowSmtp] = useState(false);

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
            setWaApiKey(''); // never populate the actual secret — admin must re-enter
            setWaPhoneId('');
            setWaBusinessId('');
            setBrevoKey('');
            setSmtpHost(res.smtp_host || '');
            setSmtpPort('');
            setSmtpUsername('');
            setSmtpPassword('');
            setSmtpFromEmail(res.smtp_from_email || '');
            setWaCredits(String(res.ai_whatsapp_credits || 1000));
            setIsPaused(res.is_paused || false);
            setPauseReason(res.pause_reason || '');
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
            // Only send fields that the admin actually changed (non-empty)
            // Empty strings mean "clear this field"
            if (aiProvider !== (data?.ai_provider || '')) payload.ai_provider = aiProvider;
            if (aiModel !== (data?.ai_model || '')) payload.ai_model = aiModel;
            if (aiBaseUrl !== (data?.ai_base_url || '')) payload.ai_base_url = aiBaseUrl;
            if (aiApiKey) payload.ai_api_key = aiApiKey;
            if (waApiKey) payload.whatsapp_api_key = waApiKey;
            if (waPhoneId) payload.whatsapp_phone_number_id = waPhoneId;
            if (waBusinessId) payload.whatsapp_business_account_id = waBusinessId;
            if (brevoKey) payload.brevo_api_key = brevoKey;
            if (smtpHost !== (data?.smtp_host || '')) payload.smtp_host = smtpHost;
            if (smtpPort) payload.smtp_port = parseInt(smtpPort, 10);
            if (smtpUsername) payload.smtp_username = smtpUsername;
            if (smtpPassword) payload.smtp_password = smtpPassword;
            if (smtpFromEmail !== (data?.smtp_from_email || '')) payload.smtp_from_email = smtpFromEmail;
            if (Number(waCredits) !== data?.ai_whatsapp_credits) payload.ai_whatsapp_credits = Number(waCredits);
            if (isPaused !== data?.is_paused) {
                payload.is_paused = isPaused;
                payload.pause_reason = isPaused ? (pauseReason || 'Paused by super-admin') : '';
            } else if (pauseReason !== (data?.pause_reason || '')) {
                payload.pause_reason = pauseReason;
            }

            if (Object.keys(payload).length === 0) {
                toast({ title: 'No changes to save' });
                return;
            }
            const res = await apiClient.put<{ message: string; fields_updated: string[] }>(`/superadmin/hotels/${hotel.id}/integrations`, payload);
            toast({ title: 'Saved', description: res.message });
            // Clear the password fields after save so they don't sit in memory
            setAiApiKey(''); setWaApiKey(''); setBrevoKey(''); setSmtpPassword('');
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
                        {isPaused && (
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
                        <div className="space-y-2 md:col-span-2">
                            <Label className="text-xs font-bold text-foreground/80 flex items-center gap-2">
                                <Key className="w-3 h-3 text-muted-foreground" /> API Key
                                {data?.ai_api_key_preview && <span className="text-muted-foreground font-normal">current: {data.ai_api_key_preview}</span>}
                            </Label>
                            <div className="relative">
                                <Input type={showAiKey ? 'text' : 'password'} value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} placeholder="Leave blank to keep existing" className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11 pr-10" />
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
                                <Input type={showWaKey ? 'text' : 'password'} value={waApiKey} onChange={e => setWaApiKey(e.target.value)} placeholder="Leave blank to keep existing" className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11 pr-10" />
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
                    <CardDescription>Brevo is the recommended option. SMTP is the fallback for direct-send setups.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Brevo */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-foreground/80 flex items-center gap-2">
                            Brevo API Key
                            {data?.brevo_key_preview && <span className="text-muted-foreground font-normal">current: {data.brevo_key_preview}</span>}
                        </Label>
                        <div className="relative">
                            <Input type={showBrevo ? 'text' : 'password'} value={brevoKey} onChange={e => setBrevoKey(e.target.value)} placeholder="xkeysib-..." className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11 pr-10" />
                            <button type="button" onClick={() => setShowBrevo(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                {showBrevo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <Separator className="bg-border dark:bg-white/5" />
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
                                <Input type={showSmtp ? 'text' : 'password'} value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} placeholder="Leave blank to keep existing" className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11 pr-10" />
                                <button type="button" onClick={() => setShowSmtp(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                    {showSmtp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quotas & Pause */}
            <Card className="border-border bg-card dark:border-white/10 dark:bg-slate-900/40 backdrop-blur-sm rounded-3xl shadow-sm">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2"><Database className="w-4 h-4 text-emerald-500" /> Quotas & Operational State</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground/80">AI WhatsApp Credits (monthly)</Label>
                            <Input type="number" value={waCredits} onChange={e => setWaCredits(e.target.value)} className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11" />
                        </div>
                    </div>
                    <Separator className="bg-border dark:bg-white/5" />
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                           <div>
                                <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                                    {isPaused ? <Pause className="w-4 h-4 text-rose-500" /> : <Play className="w-4 h-4 text-emerald-500" />}
                                    Hotel Pause State
                                </Label>
                                <p className="text-xs text-muted-foreground mt-1">When paused, the public booking page shows "temporarily unavailable" but the hotelier can still log in.</p>
                            </div>
                            <Switch checked={isPaused} onCheckedChange={setIsPaused} />
                        </div>
                        {isPaused && (
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-foreground/80">Pause reason (shown on public page)</Label>
                                <Input value={pauseReason} onChange={e => setPauseReason(e.target.value)} placeholder="Temporarily unavailable" className="bg-background border-border text-foreground dark:bg-slate-950/50 dark:border-white/10 dark:text-white rounded-xl h-11" />
                            </div>
                        )}
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
