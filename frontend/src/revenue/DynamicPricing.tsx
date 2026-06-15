import { useState, useEffect } from 'react';
import {
    Zap, Save, Loader2, Plus, Trash2, Pencil, X,
    TrendingUp, Calendar, Clock, Gauge, BedDouble,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { PageShell } from '@/components/layout/PageShell';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type RuleType = 'occupancy' | 'day_of_week' | 'lead_time' | 'seasonal';
type AdjType = 'percentage' | 'fixed_amount';

interface PricingRule {
    id: string;
    name: string;
    rule_type: RuleType;
    room_type_id: string | null;
    is_active: boolean;
    adjustment_type: AdjType;
    adjustment_value: number;
    priority: number;
    occupancy_min: number | null;
    occupancy_max: number | null;
    days_of_week: number[];
    lead_time_min: number | null;
    lead_time_max: number | null;
    date_from: string | null;
    date_to: string | null;
    min_price: number | null;
    max_price: number | null;
}

interface RoomLite { id: string; name: string; }

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const RULE_META: Record<RuleType, { label: string; icon: any; hint: string }> = {
    occupancy: { label: 'Occupancy based', icon: Gauge, hint: 'Raise price as rooms fill up' },
    day_of_week: { label: 'Day of week', icon: Calendar, hint: 'Weekend / weekday pricing' },
    lead_time: { label: 'Lead time', icon: Clock, hint: 'Early-bird or last-minute pricing' },
    seasonal: { label: 'Seasonal', icon: TrendingUp, hint: 'Festival / peak season window' },
};

const BLANK: Partial<PricingRule> = {
    name: '',
    rule_type: 'occupancy',
    room_type_id: '',
    is_active: true,
    adjustment_type: 'percentage',
    adjustment_value: 10,
    priority: 0,
    occupancy_min: 80,
    days_of_week: [5, 6],
    lead_time_max: 3,
    date_from: null,
    date_to: null,
    min_price: null,
    max_price: null,
};

export default function DynamicPricing() {
    const { toast } = useToast();
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [rooms, setRooms] = useState<RoomLite[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState<Partial<PricingRule> | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const [r, rm] = await Promise.all([
                apiClient.get<PricingRule[]>('/revenue/pricing-rules'),
                apiClient.get<RoomLite[]>('/rooms').catch(() => []),
            ]);
            setRules(r);
            setRooms(rm.map((x: any) => ({ id: x.id, name: x.name })));
        } catch {
            toast({ title: 'Failed to load pricing rules', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const save = async () => {
        if (!editing) return;
        setSaving(true);
        try {
            const payload = { ...editing, room_type_id: editing.room_type_id || null };
            if (editing.id) {
                await apiClient.put(`/revenue/pricing-rules/${editing.id}`, payload);
            } else {
                await apiClient.post('/revenue/pricing-rules', payload);
            }
            toast({ title: 'Pricing rule saved' });
            setEditing(null);
            await load();
        } catch (e: any) {
            toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: string) => {
        try {
            await apiClient.delete(`/revenue/pricing-rules/${id}`);
            toast({ title: 'Rule deleted' });
            await load();
        } catch {
            toast({ title: 'Delete failed', variant: 'destructive' });
        }
    };

    const toggleActive = async (rule: PricingRule) => {
        try {
            await apiClient.put(`/revenue/pricing-rules/${rule.id}`, { is_active: !rule.is_active });
            await load();
        } catch {
            toast({ title: 'Update failed', variant: 'destructive' });
        }
    };

    const conditionLabel = (r: PricingRule): string => {
        if (r.rule_type === 'occupancy') return `When occupancy ≥ ${r.occupancy_min ?? 0}%`;
        if (r.rule_type === 'day_of_week') return (r.days_of_week || []).map((d) => WEEKDAYS[d]).join(', ') || 'No days';
        if (r.rule_type === 'lead_time') {
            if (r.lead_time_min != null) return `Booked ${r.lead_time_min}+ days ahead`;
            return `Within ${r.lead_time_max ?? 0} days of arrival`;
        }
        if (r.rule_type === 'seasonal') return `${r.date_from || '?'} → ${r.date_to || '?'}`;
        return '';
    };

    const adjLabel = (r: PricingRule) => {
        const sign = r.adjustment_value >= 0 ? '+' : '';
        return r.adjustment_type === 'percentage'
            ? `${sign}${r.adjustment_value}%`
            : `${sign}₹${r.adjustment_value}`;
    };

    return (
        <PageShell
            title="Dynamic Pricing"
            description="You set the rules — prices move automatically to fill rooms and lift revenue."
            actions={
                !editing && (
                    <Button onClick={() => setEditing({ ...BLANK })}>
                        <Plus className="h-4 w-4 mr-1" /> New Rule
                    </Button>
                )
            }
        >
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : editing ? (
                <RuleForm
                    rule={editing}
                    rooms={rooms}
                    saving={saving}
                    onChange={setEditing}
                    onCancel={() => setEditing(null)}
                    onSave={save}
                />
            ) : rules.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                        <Zap className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        <p className="font-medium">No pricing rules yet</p>
                        <p className="text-sm">Create a rule to start moving prices with demand.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {rules.map((r) => {
                        const Meta = RULE_META[r.rule_type];
                        const Icon = Meta?.icon || Zap;
                        const room = rooms.find((x) => x.id === r.room_type_id);
                        return (
                            <Card key={r.id} className={cn(!r.is_active && 'opacity-60')}>
                                <CardContent className="flex items-center gap-4 py-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold truncate">{r.name || Meta?.label}</span>
                                            <Badge variant="secondary">{Meta?.label}</Badge>
                                            <Badge variant="outline">
                                                {room ? room.name : 'All rooms'}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{conditionLabel(r)}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={cn(
                                            'text-lg font-bold',
                                            r.adjustment_value >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                        )}>{adjLabel(r)}</span>
                                    </div>
                                    <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                                    <Button variant="ghost" size="icon" onClick={() => setEditing({ ...r, room_type_id: r.room_type_id || '' })}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                                        <Trash2 className="h-4 w-4 text-rose-500" />
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </PageShell>
    );
}

function RuleForm({
    rule, rooms, saving, onChange, onCancel, onSave,
}: {
    rule: Partial<PricingRule>;
    rooms: RoomLite[];
    saving: boolean;
    onChange: (r: Partial<PricingRule>) => void;
    onCancel: () => void;
    onSave: () => void;
}) {
    const set = (patch: Partial<PricingRule>) => onChange({ ...rule, ...patch });
    const rt = (rule.rule_type || 'occupancy') as RuleType;

    const toggleDay = (d: number) => {
        const days = new Set(rule.days_of_week || []);
        days.has(d) ? days.delete(d) : days.add(d);
        set({ days_of_week: Array.from(days).sort() });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    {rule.id ? 'Edit rule' : 'New pricing rule'}
                    <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
                </CardTitle>
                <CardDescription>{RULE_META[rt]?.hint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <Label>Rule name</Label>
                        <Input value={rule.name || ''} onChange={(e) => set({ name: e.target.value })}
                            placeholder="e.g. Weekend surge" />
                    </div>
                    <div>
                        <Label>Applies to</Label>
                        <Select value={rule.room_type_id || 'all'}
                            onValueChange={(v) => set({ room_type_id: v === 'all' ? '' : v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All rooms</SelectItem>
                                {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div>
                    <Label>Rule type</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                        {(Object.keys(RULE_META) as RuleType[]).map((k) => {
                            const M = RULE_META[k];
                            const Icon = M.icon;
                            const active = rt === k;
                            return (
                                <button key={k} type="button" onClick={() => set({ rule_type: k })}
                                    className={cn(
                                        'flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-all',
                                        active ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700'
                                            : 'border-border hover:bg-muted/40'
                                    )}>
                                    <Icon className="h-4 w-4" />
                                    {M.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Condition fields per type */}
                {rt === 'occupancy' && (
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <Label>Fire when occupancy ≥ (%)</Label>
                            <Input type="number" value={rule.occupancy_min ?? ''}
                                onChange={(e) => set({ occupancy_min: e.target.value === '' ? null : Number(e.target.value) })} />
                        </div>
                    </div>
                )}

                {rt === 'day_of_week' && (
                    <div>
                        <Label>Days</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {WEEKDAYS.map((d, i) => (
                                <button key={d} type="button" onClick={() => toggleDay(i)}
                                    className={cn(
                                        'h-9 w-12 rounded-lg border text-sm font-medium transition-all',
                                        (rule.days_of_week || []).includes(i)
                                            ? 'border-indigo-500 bg-indigo-500 text-white'
                                            : 'border-border hover:bg-muted/40'
                                    )}>{d}</button>
                            ))}
                        </div>
                    </div>
                )}

                {rt === 'lead_time' && (
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <Label>Min days ahead (early-bird)</Label>
                            <Input type="number" value={rule.lead_time_min ?? ''}
                                onChange={(e) => set({ lead_time_min: e.target.value === '' ? null : Number(e.target.value) })} />
                        </div>
                        <div>
                            <Label>Max days ahead (last-minute)</Label>
                            <Input type="number" value={rule.lead_time_max ?? ''}
                                onChange={(e) => set({ lead_time_max: e.target.value === '' ? null : Number(e.target.value) })} />
                        </div>
                    </div>
                )}

                {rt === 'seasonal' && (
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <Label>From</Label>
                            <Input type="date" value={rule.date_from || ''}
                                onChange={(e) => set({ date_from: e.target.value || null })} />
                        </div>
                        <div>
                            <Label>To</Label>
                            <Input type="date" value={rule.date_to || ''}
                                onChange={(e) => set({ date_to: e.target.value || null })} />
                        </div>
                    </div>
                )}

                {/* Adjustment */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <Label>Price change</Label>
                        <div className="flex gap-2">
                            <Input type="number" value={rule.adjustment_value ?? 0}
                                onChange={(e) => set({ adjustment_value: Number(e.target.value) })} />
                            <Select value={rule.adjustment_type || 'percentage'}
                                onValueChange={(v) => set({ adjustment_type: v as AdjType })}>
                                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percentage">%</SelectItem>
                                    <SelectItem value="fixed_amount">₹</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Use a negative value for a discount (e.g. -20% for last-minute).
                        </p>
                    </div>
                    <div>
                        <Label>Priority (lower runs first)</Label>
                        <Input type="number" value={rule.priority ?? 0}
                            onChange={(e) => set({ priority: Number(e.target.value) })} />
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <Label>Min price floor (₹, optional)</Label>
                        <Input type="number" value={rule.min_price ?? ''}
                            onChange={(e) => set({ min_price: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    <div>
                        <Label>Max price ceiling (₹, optional)</Label>
                        <Input type="number" value={rule.max_price ?? ''}
                            onChange={(e) => set({ max_price: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                    <label className="flex items-center gap-2 text-sm">
                        <Switch checked={rule.is_active ?? true}
                            onCheckedChange={(v) => set({ is_active: v })} />
                        Active
                    </label>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onCancel}>Cancel</Button>
                        <Button onClick={onSave} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                            Save rule
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
