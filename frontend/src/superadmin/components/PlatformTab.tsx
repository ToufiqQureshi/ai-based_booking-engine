import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Key, Globe, Mail, Crown, FileText, Plus, Trash2, Copy, RefreshCw, ShieldCheck } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { format } from 'date-fns';

const formatINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export function PlatformTab({ hotels = [], admins = [] }: { hotels?: any[]; admins?: any[] }) {
    const qc = useQueryClient();
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-foreground">Platform Settings</h2>
                <p className="text-sm text-muted-foreground">API keys, custom domains, email templates, admin sub-roles, invoices</p>
            </div>
            <Tabs defaultValue="api-keys">
                <TabsList className="bg-muted/30">
                    <TabsTrigger value="api-keys" className="text-xs font-bold"><Key className="w-3.5 h-3.5 mr-1.5" /> API Keys</TabsTrigger>
                    <TabsTrigger value="domains" className="text-xs font-bold"><Globe className="w-3.5 h-3.5 mr-1.5" /> Domains</TabsTrigger>
                    <TabsTrigger value="templates" className="text-xs font-bold"><Mail className="w-3.5 h-3.5 mr-1.5" /> Email Templates</TabsTrigger>
                    <TabsTrigger value="roles" className="text-xs font-bold"><Crown className="w-3.5 h-3.5 mr-1.5" /> Admin Roles</TabsTrigger>
                    <TabsTrigger value="invoices" className="text-xs font-bold"><FileText className="w-3.5 h-3.5 mr-1.5" /> Invoices</TabsTrigger>
                </TabsList>

                <TabsContent value="api-keys" className="mt-4"><ApiKeysSection hotels={hotels} /></TabsContent>
                <TabsContent value="domains" className="mt-4"><DomainsSection hotels={hotels} /></TabsContent>
                <TabsContent value="templates" className="mt-4"><TemplatesSection hotels={hotels} /></TabsContent>
                <TabsContent value="roles" className="mt-4"><RolesSection admins={admins} /></TabsContent>
                <TabsContent value="invoices" className="mt-4"><InvoicesSection hotels={hotels} /></TabsContent>
            </Tabs>
        </div>
    );
}

// ──────────────── API Keys ────────────────

function ApiKeysSection({ hotels }: { hotels: any[] }) {
    const qc = useQueryClient();
    const [showNew, setShowNew] = useState(false);
    const [form, setForm] = useState({ hotel_id: '', label: '', scopes: 'read', expires_in_days: '' });
    const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);

    const { data: keys = [], refetch } = useQuery<any[]>({
        queryKey: ['api-keys'],
        queryFn: () => apiClient.get('/superadmin/api-keys'),
    });

    const createMutation = useMutation({
        mutationFn: () => apiClient.post('/superadmin/api-keys', {
            ...form, scopes: form.scopes.split(',').map(s => s.trim()),
            expires_in_days: form.expires_in_days ? parseInt(form.expires_in_days) : undefined
        }),
        onSuccess: (data: any) => {
            toast.success('API key created');
            setNewKeyRaw(data.raw_key);
            setShowNew(false);
            setForm({ hotel_id: '', label: '', scopes: 'read', expires_in_days: '' });
            qc.invalidateQueries({ queryKey: ['api-keys'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to create API key'),
    });

    const revokeMutation = useMutation({
        mutationFn: (id: string) => apiClient.post(`/superadmin/api-keys/${id}/revoke`, { reason: 'Manual revoke' }),
        onSuccess: () => { toast.success('Key revoked'); qc.invalidateQueries({ queryKey: ['api-keys'] }); },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to revoke key'),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{keys.length} key(s) issued</p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
                    <Button size="sm" onClick={() => setShowNew(true)} className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-3.5 h-3.5" /> New Key</Button>
                </div>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-background">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-muted/10">
                        <th className="text-left py-2 pl-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Label / Hotel</th>
                        <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prefix</th>
                        <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Scopes</th>
                        <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                        <th className="text-right py-2 pr-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</th>
                    </tr></thead>
                    <tbody>
                        {keys.length === 0 ? (
                            <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">No API keys yet</td></tr>
                        ) : keys.map((k: any) => {
                            const hotel = hotels.find((h: any) => h.id === k.hotel_id);
                            return (
                                <tr key={k.id} className="border-b border-border/60 hover:bg-muted/20">
                                    <td className="py-3 pl-5"><p className="font-bold text-sm">{k.label}</p><p className="text-[10px] text-muted-foreground">{hotel?.name || k.hotel_id?.slice(0, 8)}</p></td>
                                    <td className="py-3 px-3 font-mono text-xs">{k.key_prefix}…</td>
                                    <td className="py-3 px-3 text-xs">{(k.scopes || []).join(', ')}</td>
                                    <td className="py-3 px-3">
                                        <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border",
                                            k.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground')}>
                                            {k.is_active ? 'Active' : 'Revoked'}
                                        </Badge>
                                    </td>
                                    <td className="py-3 pr-5 text-right">
                                        {k.is_active && (
                                            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => { if (confirm('Revoke this API key?')) revokeMutation.mutate(k.id); }}>
                                                Revoke
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Dialog open={showNew} onOpenChange={setShowNew}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>New API Key</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Hotel *</Label>
                            <Select value={form.hotel_id} onValueChange={(v) => setForm({ ...form, hotel_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Select hotel" /></SelectTrigger>
                                <SelectContent>{hotels.map((h: any) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div><Label className="text-xs">Label *</Label><Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Production server" /></div>
                        <div><Label className="text-xs">Scopes (comma-separated)</Label><Input value={form.scopes} onChange={e => setForm({ ...form, scopes: e.target.value })} placeholder="read, bookings:write" /></div>
                        <div><Label className="text-xs">Expires in (days, optional)</Label><Input type="number" value={form.expires_in_days} onChange={e => setForm({ ...form, expires_in_days: e.target.value })} placeholder="90" /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
                        <Button onClick={() => createMutation.mutate()} disabled={!form.hotel_id || !form.label} className="bg-indigo-600 hover:bg-indigo-700">Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!newKeyRaw} onOpenChange={(o) => !o && setNewKeyRaw(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle className="text-amber-600">⚠ Save this key now</DialogTitle></DialogHeader>
                    <p className="text-xs text-muted-foreground">This is the only time the full key is shown. Copy it now.</p>
                    <div className="bg-muted p-3 rounded-xl font-mono text-xs break-all">{newKeyRaw}</div>
                    <DialogFooter>
                        <Button onClick={() => { navigator.clipboard.writeText(newKeyRaw || ''); toast.success('Copied to clipboard'); }} className="gap-1.5">
                            <Copy className="w-3.5 h-3.5" /> Copy
                        </Button>
                        <Button variant="ghost" onClick={() => setNewKeyRaw(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ──────────────── Domains ────────────────

function DomainsSection({ hotels }: { hotels: any[] }) {
    const qc = useQueryClient();
    const [showNew, setShowNew] = useState(false);
    const [form, setForm] = useState({ hotel_id: '', domain: '' });
    const [openDns, setOpenDns] = useState<any | null>(null);

    const { data: domains = [], refetch } = useQuery<any[]>({
        queryKey: ['domains'],
        queryFn: () => apiClient.get('/superadmin/domains'),
    });

    const createMutation = useMutation({
        mutationFn: () => apiClient.post('/superadmin/domains', form),
        onSuccess: (data: any) => {
            toast.success('Domain mapped — share DNS records with hotelier');
            setShowNew(false);
            setForm({ hotel_id: '', domain: '' });
            setOpenDns(data);
            qc.invalidateQueries({ queryKey: ['domains'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to map domain'),
    });
    const verifyMutation = useMutation({
        mutationFn: (id: string) => apiClient.post(`/superadmin/domains/${id}/verify`, {}),
        onSuccess: () => { toast.success('Domain verified'); qc.invalidateQueries({ queryKey: ['domains'] }); },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Domain verification failed'),
    });
    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/superadmin/domains/${id}`),
        onSuccess: () => { toast.success('Domain removed'); qc.invalidateQueries({ queryKey: ['domains'] }); },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to remove domain'),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{domains.length} domain(s) mapped</p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
                    <Button size="sm" onClick={() => setShowNew(true)} className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-3.5 h-3.5" /> Map Domain</Button>
                </div>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-background">
                {domains.length === 0 ? (
                    <p className="py-10 text-center text-muted-foreground text-sm">No custom domains yet</p>
                ) : (
                    <div className="divide-y divide-border">
                        {domains.map((d: any) => {
                            const hotel = hotels.find((h: any) => h.id === d.hotel_id);
                            return (
                                <div key={d.id} className="px-5 py-3 flex items-center gap-3">
                                    <Globe className="w-4 h-4 text-indigo-600" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-foreground text-sm">{d.domain}</p>
                                        <p className="text-[10px] text-muted-foreground">{hotel?.name || d.hotel_id}</p>
                                    </div>
                                    <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border",
                                        d.is_verified ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200')}>
                                        {d.is_verified ? 'Verified' : 'Pending DNS'}
                                    </Badge>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpenDns(d)}>DNS</Button>
                                    {!d.is_verified && (
                                        <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600" onClick={() => verifyMutation.mutate(d.id)}>Verify</Button>
                                    )}
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => { if (confirm('Remove this domain?')) deleteMutation.mutate(d.id); }}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <Dialog open={showNew} onOpenChange={setShowNew}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Map Custom Domain</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Hotel *</Label>
                            <Select value={form.hotel_id} onValueChange={(v) => setForm({ ...form, hotel_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Select hotel" /></SelectTrigger>
                                <SelectContent>{hotels.map((h: any) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div><Label className="text-xs">Domain *</Label><Input value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="book.example.com" /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
                        <Button onClick={() => createMutation.mutate()} disabled={!form.hotel_id || !form.domain} className="bg-indigo-600 hover:bg-indigo-700">Map</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!openDns} onOpenChange={(o) => !o && setOpenDns(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>DNS Records · {openDns?.domain}</DialogTitle></DialogHeader>
                    <p className="text-xs text-muted-foreground">Ask the hotelier to add these to their DNS provider, then verify.</p>
                    <div className="space-y-2">
                        {(openDns?.dns_records || []).map((r: any, i: number) => (
                            <div key={i} className="p-3 rounded-xl border border-border bg-muted/20 text-xs">
                                <div className="grid grid-cols-[80px_1fr] gap-2">
                                    <span className="text-muted-foreground">Type</span><span className="font-mono font-bold">{r.type}</span>
                                    <span className="text-muted-foreground">Host</span><span className="font-mono">{r.host}</span>
                                    <span className="text-muted-foreground">Value</span><span className="font-mono break-all">{r.value}</span>
                                    <span className="text-muted-foreground">Purpose</span><span>{r.purpose}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ──────────────── Templates ────────────────

const TEMPLATE_KEYS = [
    'booking_confirmation', 'booking_cancellation', 'payment_receipt', 'welcome',
    'password_reset', 'subscription_expiry', 'payout_paid', 'invoice_issued',
];

function TemplatesSection({ hotels }: { hotels: any[] }) {
    const qc = useQueryClient();
    const [editing, setEditing] = useState<any | null>(null);

    const { data: templates = [], refetch } = useQuery<any[]>({
        queryKey: ['email-templates'],
        queryFn: () => apiClient.get('/superadmin/email-templates'),
    });

    const upsertMutation = useMutation({
        mutationFn: (data: any) => apiClient.post('/superadmin/email-templates', data),
        onSuccess: () => { toast.success('Template saved'); setEditing(null); qc.invalidateQueries({ queryKey: ['email-templates'] }); },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to save template'),
    });
    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/superadmin/email-templates/${id}`),
        onSuccess: () => { toast.success('Template deleted'); qc.invalidateQueries({ queryKey: ['email-templates'] }); },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to delete template'),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{templates.length} template(s)</p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
                    <Button size="sm" onClick={() => setEditing({ channel: 'email', is_active: true, is_default: true })} className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-3.5 h-3.5" /> New Template</Button>
                </div>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-background">
                {templates.length === 0 ? (
                    <p className="py-10 text-center text-muted-foreground text-sm">No templates yet</p>
                ) : (
                    <div className="divide-y divide-border">
                        {templates.map((t: any) => {
                            const hotel = t.hotel_id ? hotels.find((h: any) => h.id === t.hotel_id) : null;
                            return (
                                <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                                    <Mail className="w-4 h-4 text-indigo-600" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-foreground text-sm">{t.name} <span className="text-[10px] text-muted-foreground font-normal">· {t.template_key}</span></p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {hotel ? `Hotel: ${hotel.name}` : 'Platform default'} · {t.channel}
                                        </p>
                                    </div>
                                    <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border",
                                        t.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground')}>
                                        {t.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(t)}>Edit</Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => { if (confirm('Delete this template?')) deleteMutation.mutate(t.id); }}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{editing?.id ? 'Edit' : 'New'} Email Template</DialogTitle></DialogHeader>
                    {editing && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">Template Key *</Label>
                                    <Select value={editing.template_key || ''} onValueChange={(v) => setEditing({ ...editing, template_key: v })}>
                                        <SelectTrigger><SelectValue placeholder="Pick a key" /></SelectTrigger>
                                        <SelectContent>{TEMPLATE_KEYS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs">Channel</Label>
                                    <Select value={editing.channel || 'email'} onValueChange={(v) => setEditing({ ...editing, channel: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="email">Email</SelectItem>
                                            <SelectItem value="sms">SMS</SelectItem>
                                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div><Label className="text-xs">Display Name *</Label><Input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
                            <div>
                                <Label className="text-xs">Scope</Label>
                                <Select value={editing.hotel_id || 'platform'} onValueChange={(v) => setEditing({ ...editing, hotel_id: v === 'platform' ? null : v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="platform">Platform default (all hotels)</SelectItem>
                                        {hotels.map((h: any) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            {editing.channel === 'email' && (
                                <div><Label className="text-xs">Subject</Label><Input value={editing.subject || ''} onChange={e => setEditing({ ...editing, subject: e.target.value })} placeholder="Booking confirmed - {{booking_id}}" /></div>
                            )}
                            <div><Label className="text-xs">Body (text)</Label><Textarea rows={4} value={editing.body_text || ''} onChange={e => setEditing({ ...editing, body_text: e.target.value })} placeholder="Hi {{guest_name}}, your booking..." /></div>
                            <div><Label className="text-xs">Body (HTML, optional)</Label><Textarea rows={5} value={editing.body_html || ''} onChange={e => setEditing({ ...editing, body_html: e.target.value })} placeholder="<p>Hi {{guest_name}}...</p>" /></div>
                            <div className="flex items-center justify-between pt-2 border-t border-border">
                                <Label className="text-xs">Active</Label>
                                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button onClick={() => upsertMutation.mutate(editing)} className="bg-indigo-600 hover:bg-indigo-700">Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ──────────────── Sub-Roles ────────────────

function RolesSection({ admins }: { admins: any[] }) {
    const qc = useQueryClient();
    const [editing, setEditing] = useState<any | null>(null);

    const { data: roles = [], refetch } = useQuery<any[]>({
        queryKey: ['admin-roles'],
        queryFn: () => apiClient.get('/superadmin/admin-roles'),
    });
    const { data: tiers = [] } = useQuery<any[]>({
        queryKey: ['admin-role-tiers'],
        queryFn: () => apiClient.get('/superadmin/admin-roles/tiers'),
    });

    const upsertMutation = useMutation({
        mutationFn: (data: any) => apiClient.post('/superadmin/admin-roles', data),
        onSuccess: () => { toast.success('Role saved'); setEditing(null); qc.invalidateQueries({ queryKey: ['admin-roles'] }); },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to save role'),
    });
    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/superadmin/admin-roles/${id}`),
        onSuccess: () => { toast.success('Role removed'); qc.invalidateQueries({ queryKey: ['admin-roles'] }); },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to remove role'),
    });

    const superAdmins = admins.filter(a => a.role === 'SUPER_ADMIN');
    const unassigned = superAdmins.filter(a => !roles.find((r: any) => r.user_id === a.id));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{roles.length} sub-role assignment(s)</p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
                    <Button size="sm" onClick={() => setEditing({ role_tier: 'support' })} className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-3.5 h-3.5" /> Assign Role</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {tiers.map((t: any) => (
                    <div key={t.tier} className="p-3 rounded-2xl border border-border bg-background">
                        <Crown className="w-4 h-4 text-indigo-600 mb-1.5" />
                        <p className="font-black text-sm capitalize">{t.tier}</p>
                        <p className="text-[10px] text-muted-foreground">{t.permissions.length} permission(s)</p>
                    </div>
                ))}
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-background">
                {roles.length === 0 ? (
                    <p className="py-10 text-center text-muted-foreground text-sm">No sub-roles yet. All super admins have full access.</p>
                ) : (
                    <div className="divide-y divide-border">
                        {roles.map((r: any) => (
                            <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-foreground text-sm">{r.user_email}</p>
                                    <p className="text-[10px] text-muted-foreground">{(r.permissions || []).length} permissions</p>
                                </div>
                                <Badge className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border bg-indigo-100 text-indigo-700 border-indigo-200">
                                    {r.role_tier}
                                </Badge>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(r)}>Edit</Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => { if (confirm('Remove this sub-role?')) deleteMutation.mutate(r.id); }}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editing?.id ? 'Edit' : 'Assign'} Sub-Role</DialogTitle></DialogHeader>
                    {editing && (
                        <div className="space-y-3">
                            {!editing.id && (
                                <div>
                                    <Label className="text-xs">Super Admin *</Label>
                                    <Select value={editing.user_id || ''} onValueChange={(v) => setEditing({ ...editing, user_id: v })}>
                                        <SelectTrigger><SelectValue placeholder="Pick a super admin" /></SelectTrigger>
                                        <SelectContent>{unassigned.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div>
                                <Label className="text-xs">Tier *</Label>
                                <Select value={editing.role_tier} onValueChange={(v) => setEditing({ ...editing, role_tier: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{tiers.map((t: any) => <SelectItem key={t.tier} value={t.tier}>{t.tier}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Default permissions for this tier will be applied. You can later customize per user.
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button onClick={() => upsertMutation.mutate(editing)} disabled={!editing?.user_id} className="bg-indigo-600 hover:bg-indigo-700">Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ──────────────── Invoices (bulk) ────────────────

function InvoicesSection({ hotels }: { hotels: any[] }) {
    const qc = useQueryClient();
    const [showBulk, setShowBulk] = useState(false);
    const [bulkForm, setBulkForm] = useState({ plan_name: '', period_start: '', period_end: '', gst_rate: 18 });

    const { data: invoices = [], refetch } = useQuery<any[]>({
        queryKey: ['platform-invoices'],
        queryFn: () => apiClient.get('/superadmin/invoices'),
    });

    const bulkMutation = useMutation({
        mutationFn: () => apiClient.post('/superadmin/invoices/bulk-generate', {
            ...bulkForm,
            plan_name: bulkForm.plan_name || undefined,
        }),
        onSuccess: (data: any) => {
            toast.success(`Generated ${data.created} invoice(s)`);
            setShowBulk(false);
            qc.invalidateQueries({ queryKey: ['platform-invoices'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to generate invoices'),
    });

    const paidMutation = useMutation({
        mutationFn: (id: string) => apiClient.post(`/superadmin/invoices/${id}/mark-paid`, {}),
        onSuccess: () => { toast.success('Invoice marked paid'); qc.invalidateQueries({ queryKey: ['platform-invoices'] }); },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to mark invoice paid'),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{invoices.length} invoice(s)</p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
                    <Button size="sm" onClick={() => setShowBulk(true)} className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-3.5 h-3.5" /> Bulk Generate</Button>
                </div>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-background">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-muted/10">
                        <th className="text-left py-2 pl-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Invoice #</th>
                        <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hotel</th>
                        <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount</th>
                        <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                        <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Issued</th>
                        <th className="text-right py-2 pr-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</th>
                    </tr></thead>
                    <tbody>
                        {invoices.length === 0 ? (
                            <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">No invoices yet</td></tr>
                        ) : invoices.map((inv: any) => {
                            const hotel = hotels.find((h: any) => h.id === inv.hotel_id);
                            return (
                                <tr key={inv.id} className="border-b border-border/60 hover:bg-muted/20">
                                    <td className="py-3 pl-5 font-mono text-xs font-bold">{inv.invoice_number}</td>
                                    <td className="py-3 px-3 text-xs">{hotel?.name || inv.hotel_id?.slice(0, 8)}</td>
                                    <td className="py-3 px-3 font-mono font-bold">{formatINR(inv.total_amount)}</td>
                                    <td className="py-3 px-3">
                                        <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border",
                                            inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                            inv.status === 'overdue' ? 'bg-red-100 text-red-700 border-red-200' :
                                            'bg-amber-100 text-amber-700 border-amber-200')}>
                                            {inv.status}
                                        </Badge>
                                    </td>
                                    <td className="py-3 px-3 text-xs text-muted-foreground">{inv.issue_date && format(new Date(inv.issue_date), 'dd MMM')}</td>
                                    <td className="py-3 pr-5 text-right">
                                        {inv.status !== 'paid' && (
                                            <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600" onClick={() => paidMutation.mutate(inv.id)}>Mark Paid</Button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Dialog open={showBulk} onOpenChange={setShowBulk}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Bulk Generate Subscription Invoices</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Plan Filter (optional)</Label>
                            <Select value={bulkForm.plan_name || 'all'} onValueChange={(v) => setBulkForm({ ...bulkForm, plan_name: v === 'all' ? '' : v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All active plans</SelectItem>
                                    <SelectItem value="Basic">Basic</SelectItem>
                                    <SelectItem value="Premium">Premium</SelectItem>
                                    <SelectItem value="Enterprise">Enterprise</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label className="text-xs">Period Start *</Label><Input type="date" value={bulkForm.period_start} onChange={e => setBulkForm({ ...bulkForm, period_start: e.target.value })} /></div>
                            <div><Label className="text-xs">Period End *</Label><Input type="date" value={bulkForm.period_end} onChange={e => setBulkForm({ ...bulkForm, period_end: e.target.value })} /></div>
                        </div>
                        <div><Label className="text-xs">GST Rate %</Label><Input type="number" value={bulkForm.gst_rate} onChange={e => setBulkForm({ ...bulkForm, gst_rate: parseFloat(e.target.value) })} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowBulk(false)}>Cancel</Button>
                        <Button onClick={() => bulkMutation.mutate()} disabled={!bulkForm.period_start || !bulkForm.period_end} className="bg-indigo-600 hover:bg-indigo-700">Generate</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
