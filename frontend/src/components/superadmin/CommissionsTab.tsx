import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Percent, DollarSign, Plus, Trash2, TrendingUp, Edit, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLAN_OPTIONS = ['Free', 'Basic', 'Premium', 'Enterprise'];

const formatINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export function CommissionsTab({ hotels = [] }: { hotels?: any[] }) {
    const qc = useQueryClient();
    const [editing, setEditing] = useState<any | null>(null);

    const { data: rules = [], refetch } = useQuery<any[]>({
        queryKey: ['commission-rules'],
        queryFn: () => apiClient.get('/superadmin/commissions/rules'),
    });
    const { data: summary } = useQuery<any>({
        queryKey: ['commission-summary'],
        queryFn: () => apiClient.get('/superadmin/commissions/summary'),
    });

    const upsertMutation = useMutation({
        mutationFn: (data: any) => apiClient.post('/superadmin/commissions/rules', data),
        onSuccess: () => {
            toast.success('Rule saved');
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['commission-rules'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/superadmin/commissions/rules/${id}`),
        onSuccess: () => {
            toast.success('Rule deleted');
            qc.invalidateQueries({ queryKey: ['commission-rules'] });
        },
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-foreground">Commission Management</h2>
                    <p className="text-sm text-muted-foreground">Platform commission %, fixed fees, per-plan & per-hotel overrides</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-xl gap-1.5 h-9">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </Button>
                    <Button size="sm" onClick={() => setEditing({})} className="rounded-xl gap-1.5 h-9 bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-3.5 h-3.5" /> New Rule
                    </Button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                    { icon: TrendingUp, label: 'Total Platform Take', value: summary?.total_take, color: 'text-indigo-600 bg-indigo-50' },
                    { icon: DollarSign, label: 'Paid Out', value: summary?.paid, color: 'text-emerald-600 bg-emerald-50' },
                    { icon: Percent, label: 'Pending Accrued', value: summary?.pending, color: 'text-amber-600 bg-amber-50' },
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

            {/* Rules Table */}
            <div className="border border-border rounded-2xl overflow-hidden bg-background">
                <div className="px-5 py-3 border-b border-border bg-muted/30">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Commission Rules</p>
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/10">
                            <th className="text-left py-2 pl-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Scope</th>
                            <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Commission %</th>
                            <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fixed Fee</th>
                            <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">GST %</th>
                            <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                            <th className="text-right py-2 pr-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rules.length === 0 ? (
                            <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No commission rules yet. Add one to get started.</td></tr>
                        ) : rules.map((r: any) => {
                            const hotel = r.hotel_id ? hotels.find((h: any) => h.id === r.hotel_id) : null;
                            return (
                                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                                    <td className="py-3 pl-5">
                                        <p className="font-bold text-foreground text-sm">
                                            {r.hotel_id ? (hotel?.name || 'Hotel override') : `Plan: ${r.plan_name || 'Default'}`}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">{r.hotel_id ? 'Per-hotel override' : 'Platform default'}</p>
                                    </td>
                                    <td className="py-3 px-3 font-mono font-bold text-foreground">{r.commission_percent}%</td>
                                    <td className="py-3 px-3 font-mono">{formatINR(r.fixed_fee)}</td>
                                    <td className="py-3 px-3 font-mono">{r.gst_on_commission}%</td>
                                    <td className="py-3 px-3">
                                        <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border",
                                            r.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground')}>
                                            {r.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </td>
                                    <td className="py-3 pr-5 text-right">
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(r)}><Edit className="w-3.5 h-3.5" /></Button>
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600"
                                            onClick={() => { if (confirm('Delete this rule?')) deleteMutation.mutate(r.id); }}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Top hotels by take */}
            {summary?.top_hotels?.length > 0 && (
                <div className="border border-border rounded-2xl overflow-hidden bg-background">
                    <div className="px-5 py-3 border-b border-border bg-muted/30">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Top Hotels by Platform Take</p>
                    </div>
                    <div className="divide-y divide-border">
                        {summary.top_hotels.map((h: any) => (
                            <div key={h.hotel_id} className="px-5 py-3 flex items-center justify-between text-sm">
                                <div>
                                    <p className="font-bold text-foreground">{h.hotel_name}</p>
                                    <p className="text-[10px] text-muted-foreground">{h.bookings} bookings</p>
                                </div>
                                <p className="font-mono font-black text-indigo-600">{formatINR(h.platform_take)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Editor Dialog */}
            <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing?.id ? 'Edit Commission Rule' : 'New Commission Rule'}</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <div className="space-y-3">
                            <div>
                                <Label className="text-xs">Apply to</Label>
                                <Select
                                    value={editing.hotel_id ? `hotel:${editing.hotel_id}` : (editing.plan_name ? `plan:${editing.plan_name}` : 'plan:Basic')}
                                    onValueChange={(v) => {
                                        if (v.startsWith('plan:')) {
                                            setEditing({ ...editing, plan_name: v.split(':')[1], hotel_id: null });
                                        } else {
                                            setEditing({ ...editing, hotel_id: v.split(':')[1], plan_name: null });
                                        }
                                    }}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <div className="px-2 py-1 text-[10px] font-black uppercase text-muted-foreground">Plan defaults</div>
                                        {PLAN_OPTIONS.map(p => <SelectItem key={p} value={`plan:${p}`}>Plan: {p}</SelectItem>)}
                                        <div className="px-2 py-1 mt-1 text-[10px] font-black uppercase text-muted-foreground">Hotel override</div>
                                        {hotels.map((h: any) => <SelectItem key={h.id} value={`hotel:${h.id}`}>Hotel: {h.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <Label className="text-xs">Commission %</Label>
                                    <Input type="number" step="0.1" value={editing.commission_percent ?? 10}
                                        onChange={e => setEditing({ ...editing, commission_percent: parseFloat(e.target.value) })} />
                                </div>
                                <div>
                                    <Label className="text-xs">Fixed Fee (₹)</Label>
                                    <Input type="number" step="1" value={editing.fixed_fee ?? 0}
                                        onChange={e => setEditing({ ...editing, fixed_fee: parseFloat(e.target.value) })} />
                                </div>
                                <div>
                                    <Label className="text-xs">GST %</Label>
                                    <Input type="number" step="0.1" value={editing.gst_on_commission ?? 18}
                                        onChange={e => setEditing({ ...editing, gst_on_commission: parseFloat(e.target.value) })} />
                                </div>
                            </div>
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
