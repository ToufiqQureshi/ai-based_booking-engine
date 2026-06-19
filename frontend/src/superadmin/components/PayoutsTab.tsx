import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Banknote, CheckCircle2, XCircle, Clock, Plus, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { format } from 'date-fns';

const STATUS_STYLES: Record<string, string> = {
    paid:       'bg-emerald-100 text-emerald-700 border-emerald-200',
    scheduled:  'bg-blue-100 text-blue-700 border-blue-200',
    processing: 'bg-amber-100 text-amber-700 border-amber-200',
    failed:     'bg-red-100 text-red-700 border-red-200',
    cancelled:  'bg-muted text-muted-foreground border-border',
    on_hold:    'bg-orange-100 text-orange-700 border-orange-200',
};

const formatINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export function PayoutsTab({ hotels = [] }: { hotels?: any[] }) {
    const qc = useQueryClient();
    const [showGenerate, setShowGenerate] = useState(false);
    const [genForm, setGenForm] = useState({ hotel_id: '', period_start: '', period_end: '', adjustments: 0, notes: '' });
    const [paidPayoutId, setPaidPayoutId] = useState<string | null>(null);
    const [paidRef, setPaidRef] = useState('');
    const [showBanks, setShowBanks] = useState(false);
    const [bankForm, setBankForm] = useState<any>({});
    const [bankHotelFilter, setBankHotelFilter] = useState('');

    const { data: summary } = useQuery<any>({
        queryKey: ['payouts-summary'],
        queryFn: () => apiClient.get('/superadmin/payouts/summary'),
    });
    const { data: payouts = [], refetch } = useQuery<any[]>({
        queryKey: ['payouts'],
        queryFn: () => apiClient.get('/superadmin/payouts'),
    });
    const { data: banks = [] } = useQuery<any[]>({
        queryKey: ['bank-accounts', bankHotelFilter],
        queryFn: () => apiClient.get('/superadmin/payouts/bank-accounts' + (bankHotelFilter ? `?hotel_id=${bankHotelFilter}` : '')),
    });

    const generateMutation = useMutation({
        mutationFn: () => apiClient.post('/superadmin/payouts/generate', genForm),
        onSuccess: () => {
            toast.success('Payout generated');
            setShowGenerate(false);
            setGenForm({ hotel_id: '', period_start: '', period_end: '', adjustments: 0, notes: '' });
            qc.invalidateQueries({ queryKey: ['payouts'] });
            qc.invalidateQueries({ queryKey: ['payouts-summary'] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed'),
    });

    const markPaidMutation = useMutation({
        mutationFn: () => apiClient.post(`/superadmin/payouts/${paidPayoutId}/mark-paid`, { reference_number: paidRef }),
        onSuccess: () => {
            toast.success('Marked as paid');
            setPaidPayoutId(null);
            setPaidRef('');
            qc.invalidateQueries({ queryKey: ['payouts'] });
            qc.invalidateQueries({ queryKey: ['payouts-summary'] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.detail || e?.message || 'Failed to mark payout as paid'),
    });

    const cancelMutation = useMutation({
        mutationFn: (id: string) => apiClient.post(`/superadmin/payouts/${id}/cancel`, {}),
        onSuccess: () => {
            toast.success('Payout cancelled');
            qc.invalidateQueries({ queryKey: ['payouts'] });
            qc.invalidateQueries({ queryKey: ['payouts-summary'] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.detail || e?.message || 'Failed to cancel payout'),
    });

    const upsertBankMutation = useMutation({
        mutationFn: (data: any) => apiClient.post('/superadmin/payouts/bank-accounts', data),
        onSuccess: () => {
            toast.success('Bank account saved');
            setBankForm({});
            qc.invalidateQueries({ queryKey: ['bank-accounts'] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.detail || e?.message || 'Failed to save bank account'),
    });

    const verifyBankMutation = useMutation({
        mutationFn: (b: any) => apiClient.post(`/superadmin/payouts/bank-accounts/${b.id}/verify`, { is_verified: !b.is_verified }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bank-accounts'] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.detail || e?.message || 'Failed to update bank verification'),
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-foreground">Payouts & Banking</h2>
                    <p className="text-sm text-muted-foreground">Disburse hotelier earnings, manage bank accounts</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-xl gap-1.5 h-9">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </Button>
                    <Button size="sm" onClick={() => setShowGenerate(true)} className="rounded-xl gap-1.5 h-9 bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-3.5 h-3.5" /> New Payout
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                    { icon: CheckCircle2, label: 'Paid Out', value: summary?.paid_total, color: 'text-emerald-600 bg-emerald-50' },
                    { icon: Clock,        label: 'Pending',  value: summary?.pending_total, color: 'text-amber-600 bg-amber-50' },
                    { icon: XCircle,      label: 'Failed',   value: summary?.failed_total, color: 'text-red-600 bg-red-50' },
                ].map(s => (
                    <div key={s.label} className="p-4 rounded-2xl border border-border bg-background">
                        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-2', s.color)}>
                            <s.icon className="w-4 h-4" />
                        </div>
                        <p className="text-2xl font-black text-foreground">{formatINR(s.value || 0)}</p>
                        <p className="text-xs text-muted-foreground font-semibold">{s.label}</p>
                    </div>
                ))}
            </div>

            <Tabs defaultValue="payouts">
                <TabsList className="bg-muted/30">
                    <TabsTrigger value="payouts" className="text-xs font-bold"><Banknote className="w-3.5 h-3.5 mr-1.5" /> Payouts</TabsTrigger>
                    <TabsTrigger value="banks" className="text-xs font-bold"><ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Bank Accounts</TabsTrigger>
                </TabsList>

                <TabsContent value="payouts" className="mt-4">
                    <div className="border border-border rounded-2xl overflow-hidden bg-background">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/10">
                                    <th className="text-left py-2 pl-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hotel</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Period</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Net Amount</th>
                                    <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                                    <th className="text-right py-2 pr-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payouts.length === 0 ? (
                                    <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No payouts yet</td></tr>
                                ) : payouts.map((p: any) => {
                                    const hotel = hotels.find((h: any) => h.id === p.hotel_id);
                                    return (
                                        <tr key={p.id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                                            <td className="py-3 pl-5">
                                                <p className="font-bold text-foreground text-sm">{hotel?.name || p.hotel_id?.slice(0, 8)}</p>
                                                {p.reference_number && <p className="text-[10px] font-mono text-muted-foreground">UTR: {p.reference_number}</p>}
                                            </td>
                                            <td className="py-3 px-3 text-xs text-muted-foreground">
                                                {p.period_start && format(new Date(p.period_start), 'dd MMM')} → {p.period_end && format(new Date(p.period_end), 'dd MMM')}
                                            </td>
                                            <td className="py-3 px-3 font-mono font-bold text-foreground">{formatINR(p.net_amount)}</td>
                                            <td className="py-3 px-3">
                                                <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border", STATUS_STYLES[p.status])}>
                                                    {p.status}
                                                </Badge>
                                            </td>
                                            <td className="py-3 pr-5 text-right">
                                                {p.status === 'scheduled' || p.status === 'processing' ? (
                                                    <>
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600"
                                                            onClick={() => setPaidPayoutId(p.id)}>
                                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Paid
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600"
                                                            onClick={() => { if (confirm('Cancel this payout?')) cancelMutation.mutate(p.id); }}>
                                                            <XCircle className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {p.paid_at && format(new Date(p.paid_at), 'dd MMM HH:mm')}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </TabsContent>

                <TabsContent value="banks" className="mt-4 space-y-4">
                    <div className="flex items-center gap-2">
                        <Select value={bankHotelFilter || 'all'} onValueChange={(v) => setBankHotelFilter(v === 'all' ? '' : v)}>
                            <SelectTrigger className="w-72"><SelectValue placeholder="Filter by hotel" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All hotels</SelectItem>
                                {hotels.map((h: any) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setBankForm({ hotel_id: bankHotelFilter || (hotels[0]?.id) })}>
                            <Plus className="w-3.5 h-3.5" /> Add Account
                        </Button>
                    </div>

                    <div className="border border-border rounded-2xl overflow-hidden bg-background">
                        {banks.length === 0 ? (
                            <p className="py-12 text-center text-muted-foreground text-sm">No bank accounts added yet</p>
                        ) : (
                            <div className="divide-y divide-border">
                                {banks.map((b: any) => {
                                    const hotel = hotels.find((h: any) => h.id === b.hotel_id);
                                    return (
                                        <div key={b.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
                                                <Banknote className="w-4 h-4 text-indigo-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-foreground">{b.account_holder_name}</p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {hotel?.name || 'Unknown'} · ****{b.account_number?.slice(-4)} · {b.ifsc_code}
                                                </p>
                                            </div>
                                            <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border",
                                                b.is_verified ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200')}>
                                                {b.is_verified ? 'Verified' : 'Unverified'}
                                            </Badge>
                                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => verifyBankMutation.mutate(b)}>
                                                {b.is_verified ? 'Unverify' : 'Verify'}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Generate Payout Dialog */}
            <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Generate Payout</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Hotel *</Label>
                            <Select value={genForm.hotel_id} onValueChange={(v) => setGenForm({ ...genForm, hotel_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Select hotel" /></SelectTrigger>
                                <SelectContent>
                                    {hotels.map((h: any) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Period Start *</Label>
                                <Input type="date" value={genForm.period_start} onChange={e => setGenForm({ ...genForm, period_start: e.target.value })} />
                            </div>
                            <div>
                                <Label className="text-xs">Period End *</Label>
                                <Input type="date" value={genForm.period_end} onChange={e => setGenForm({ ...genForm, period_end: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs">Adjustments (₹, refunds/chargebacks)</Label>
                            <Input type="number" value={genForm.adjustments} onChange={e => setGenForm({ ...genForm, adjustments: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                            <Label className="text-xs">Notes</Label>
                            <Input value={genForm.notes} onChange={e => setGenForm({ ...genForm, notes: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowGenerate(false)}>Cancel</Button>
                        <Button onClick={() => generateMutation.mutate()} disabled={!genForm.hotel_id || !genForm.period_start || !genForm.period_end} className="bg-indigo-600 hover:bg-indigo-700">Generate</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Mark Paid Dialog */}
            <Dialog open={!!paidPayoutId} onOpenChange={(o) => !o && setPaidPayoutId(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Mark Payout as Paid</DialogTitle></DialogHeader>
                    <div>
                        <Label className="text-xs">Bank Reference / UTR Number</Label>
                        <Input value={paidRef} onChange={e => setPaidRef(e.target.value)} placeholder="UTR12345XYZ" />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setPaidPayoutId(null)}>Cancel</Button>
                        <Button onClick={() => markPaidMutation.mutate()} className="bg-emerald-600 hover:bg-emerald-700">Confirm Paid</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bank Editor */}
            <Dialog open={!!bankForm.hotel_id} onOpenChange={(o) => !o && setBankForm({})}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{bankForm.id ? 'Edit' : 'Add'} Bank Account</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Account Holder Name *</Label>
                            <Input value={bankForm.account_holder_name || ''} onChange={e => setBankForm({ ...bankForm, account_holder_name: e.target.value })} />
                        </div>
                        <div>
                            <Label className="text-xs">Account Number *</Label>
                            <Input value={bankForm.account_number || ''} onChange={e => setBankForm({ ...bankForm, account_number: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">IFSC *</Label>
                                <Input value={bankForm.ifsc_code || ''} onChange={e => setBankForm({ ...bankForm, ifsc_code: e.target.value.toUpperCase() })} />
                            </div>
                            <div>
                                <Label className="text-xs">Bank Name</Label>
                                <Input value={bankForm.bank_name || ''} onChange={e => setBankForm({ ...bankForm, bank_name: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs">UPI ID</Label>
                            <Input value={bankForm.upi_id || ''} onChange={e => setBankForm({ ...bankForm, upi_id: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setBankForm({})}>Cancel</Button>
                        <Button onClick={() => upsertBankMutation.mutate(bankForm)} className="bg-indigo-600 hover:bg-indigo-700">Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
