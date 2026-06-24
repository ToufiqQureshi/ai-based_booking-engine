import { motion, AnimatePresence } from 'framer-motion';
import { Building2, UserCheck, ChevronUp, ChevronDown, BrainCircuit, Zap, CheckSquare, Square, X, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Hotel {
    id: string;
    name: string;
    slug: string;
    owner_name: string;
    owner_email: string;
    is_active: boolean;
    is_paused?: boolean;
    feature_ai_agent?: boolean;
    feature_guest_bot?: boolean;
    subscription: any;
}

interface HotelsTabProps {
    hotels: Hotel[];
    users: any[];
    onSelectHotel: (hotel: Hotel) => void;
    onImpersonate: (id: string) => void;
    isImpersonating: boolean;
}

type SortKey = 'name' | 'plan' | 'status' | 'users';

const PLAN_COLORS: Record<string, string> = {
    enterprise: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    premium:    'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    basic:      'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    free:       'bg-muted text-muted-foreground border-border',
};

export const HotelsTab = ({ hotels, users, onSelectHotel, onImpersonate, isImpersonating }: HotelsTabProps) => {
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortAsc, setSortAsc] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState('');
    const qc = useQueryClient();

    const bulkMutation = useMutation({
        mutationFn: (payload: any) => apiClient.post('/superadmin/hotels/bulk', payload),
        onSuccess: (res: any) => {
            toast.success(`Bulk action applied to ${res.processed} hotels`);
            if (res.failed > 0) toast.error(`${res.failed} hotels failed`);
            setSelected(new Set());
            setBulkAction('');
            qc.invalidateQueries({ queryKey: ['superadmin-hotels'] });
        },
        onError: () => toast.error('Bulk action failed'),
    });

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const toggleAll = () => {
        setSelected(prev => prev.size === hotels.length ? new Set() : new Set(hotels.map(h => h.id)));
    };

    const applyBulk = () => {
        if (!bulkAction || selected.size === 0) return;
        if (!confirm(`Apply "${bulkAction}" to ${selected.size} hotel(s)?`)) return;
        bulkMutation.mutate({ hotel_ids: Array.from(selected), action: bulkAction });
    };

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(a => !a);
        else { setSortKey(key); setSortAsc(true); }
    };

    const sorted = [...hotels].sort((a, b) => {
        let va: any, vb: any;
        if (sortKey === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
        else if (sortKey === 'plan') { va = a.subscription?.plan ?? ''; vb = b.subscription?.plan ?? ''; }
        else if (sortKey === 'status') { va = a.is_active ? 0 : 1; vb = b.is_active ? 0 : 1; }
        else { va = users.filter(u => u.hotel_id === a.id).length; vb = users.filter(u => u.hotel_id === b.id).length; }
        return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

    const SortIcon = ({ col }: { col: SortKey }) =>
        sortKey === col
            ? (sortAsc ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />)
            : null;

    if (!hotels.length) return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Building2 className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-semibold">No properties found</p>
        </div>
    );

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">

        {/* Bulk action bar */}
        <AnimatePresence>
            {selected.size > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl"
                >
                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{selected.size} selected</span>
                    <Select value={bulkAction} onValueChange={setBulkAction}>
                        <SelectTrigger className="w-44 h-8 text-xs rounded-lg">
                            <SelectValue placeholder="Choose action…" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="enable">✅ Enable All</SelectItem>
                            <SelectItem value="disable">🔒 Disable All</SelectItem>
                            <SelectItem value="pause">⏸ Pause All</SelectItem>
                            <SelectItem value="unpause">▶️ Unpause All</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button size="sm" className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold" onClick={applyBulk} disabled={!bulkAction || bulkMutation.isPending}>
                        Apply
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => setSelected(new Set())}>
                        <X className="w-3.5 h-3.5" />
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>

        <div className="border border-border rounded-2xl overflow-hidden bg-background shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            <th className="w-10 pl-4 py-3">
                                <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                                    {selected.size === hotels.length
                                        ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                                        : <Square className="w-4 h-4" />}
                                </button>
                            </th>
                            <th
                                className="text-left py-3 pr-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground select-none"
                                onClick={() => toggleSort('name')}
                            >
                                Property <SortIcon col="name" />
                            </th>
                            <th
                                className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground select-none hidden md:table-cell"
                                onClick={() => toggleSort('plan')}
                            >
                                Plan <SortIcon col="plan" />
                            </th>
                            <th
                                className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground select-none"
                                onClick={() => toggleSort('status')}
                            >
                                Status <SortIcon col="status" />
                            </th>
                            <th className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                                Users
                            </th>
                            <th className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden xl:table-cell">
                                Insight
                            </th>
                            <th className="text-right py-3 pl-3 pr-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((hotel, i) => {
                            const hotelUsers = users.filter(u => u.hotel_id === hotel.id);
                            const plan = hotel.subscription?.plan?.toLowerCase() ?? 'free';
                            const planColor = PLAN_COLORS[plan] ?? PLAN_COLORS.free;

                            return (
                                <tr
                                    key={hotel.id}
                                    className={cn(
                                        "border-b border-border/60 hover:bg-muted/20 transition-colors group",
                                        selected.has(hotel.id) && "bg-indigo-50/50 dark:bg-indigo-950/10",
                                        i === sorted.length - 1 && "border-0"
                                    )}
                                >
                                    {/* Checkbox */}
                                    <td className="pl-4 py-3.5 w-10">
                                        <button onClick={() => toggleSelect(hotel.id)} className="text-muted-foreground hover:text-indigo-600">
                                            {selected.has(hotel.id)
                                                ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                                                : <Square className="w-4 h-4" />}
                                        </button>
                                    </td>
                                    {/* Property */}
                                    <td className="py-3.5 pr-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 text-indigo-600 flex items-center justify-center shrink-0">
                                                <Building2 className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <button
                                                    onClick={() => onSelectHotel(hotel)}
                                                    className="font-bold text-foreground hover:text-indigo-600 transition-colors text-sm truncate block max-w-[180px]"
                                                >
                                                    {hotel.name}
                                                </button>
                                                <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
                                                    {hotel.owner_email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Plan */}
                                    <td className="py-3.5 px-3 hidden md:table-cell">
                                        <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border", planColor)}>
                                            {hotel.subscription?.plan ?? 'Free'}
                                        </Badge>
                                    </td>

                                    {/* Status */}
                                    <td className="py-3.5 px-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                hotel.is_paused ? "bg-amber-500" :
                                                hotel.is_active ? "bg-emerald-500" : "bg-red-500"
                                            )} />
                                            <span className="text-xs font-semibold text-foreground">
                                                {hotel.is_paused ? 'Paused' : hotel.is_active ? 'Active' : 'Locked'}
                                            </span>
                                        </div>
                                    </td>

                                    {/* User count (real) */}
                                    <td className="py-3.5 px-3 hidden lg:table-cell">
                                        <span className="text-xs font-semibold text-foreground tabular-nums">
                                            {hotelUsers.length} {hotelUsers.length === 1 ? 'user' : 'users'}
                                        </span>
                                    </td>

                                    {/* Insights — derived from real account state only */}
                                    <td className="py-3.5 px-3 hidden xl:table-cell">
                                        <div className="flex flex-col gap-1.5 items-start">
                                            {!hotel.is_active && (
                                                <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Suspended</Badge>
                                            )}
                                            {hotel.is_paused && (
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-200 text-amber-700 bg-amber-50">Paused</Badge>
                                            )}
                                            {hotel.is_active && (plan === 'free' || plan === 'none') && (
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-indigo-200 text-indigo-700 bg-indigo-50">Upsell opportunity</Badge>
                                            )}
                                            {hotel.is_active && !hotel.is_paused && plan !== 'free' && plan !== 'none' && (
                                                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Healthy
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Actions */}
                                    <td className="py-3.5 pl-3 pr-5">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-[11px] px-3 rounded-lg font-bold border-border"
                                                onClick={() => onImpersonate(hotel.id)}
                                                disabled={isImpersonating}
                                            >
                                                <UserCheck className="w-3 h-3 mr-1" /> Login As
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="px-5 py-3 border-t border-border bg-muted/10 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-medium">
                    Showing {sorted.length} of {hotels.length} properties
                </span>
                <button
                    onClick={() => {
                        const headers = ['Name', 'Owner Email', 'Slug', 'Status', 'Plan', 'Users'];
                        const rows = hotels.map(h => [
                            h.name,
                            h.owner_email,
                            h.slug || '',
                            h.is_paused ? 'Paused' : h.is_active ? 'Active' : 'Locked',
                            h.subscription?.plan ?? 'None',
                            users.filter((u: any) => u.hotel_id === h.id).length,
                        ]);
                        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'all-hotels.csv'; a.click();
                        URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-indigo-600 transition-colors"
                >
                    <Download className="w-3 h-3" /> Export CSV
                </button>
            </div>
        </div>
        </motion.div>
    );
};
