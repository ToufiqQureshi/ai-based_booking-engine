import { motion } from 'framer-motion';
import { Building2, UserCheck, Settings, ChevronUp, ChevronDown, BrainCircuit, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

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
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-border rounded-2xl overflow-hidden bg-background shadow-sm"
        >
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            <th
                                className="text-left py-3 pl-5 pr-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground select-none"
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
                            <th
                                className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground select-none hidden lg:table-cell"
                                onClick={() => toggleSort('users')}
                            >
                                Users <SortIcon col="users" />
                            </th>
                            <th className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden xl:table-cell">
                                Features
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
                                        i === sorted.length - 1 && "border-0"
                                    )}
                                >
                                    {/* Property */}
                                    <td className="py-3.5 pl-5 pr-3">
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

                                    {/* Users */}
                                    <td className="py-3.5 px-3 hidden lg:table-cell">
                                        <span className="text-xs font-bold text-foreground tabular-nums">{hotelUsers.length}</span>
                                        <span className="text-[10px] text-muted-foreground ml-1">accounts</span>
                                    </td>

                                    {/* Features */}
                                    <td className="py-3.5 px-3 hidden xl:table-cell">
                                        <div className="flex items-center gap-1.5">
                                            {hotel.feature_ai_agent && (
                                                <div title="AI Agent" className="w-5 h-5 rounded-md bg-purple-100 dark:bg-purple-950/30 text-purple-600 flex items-center justify-center">
                                                    <BrainCircuit className="w-3 h-3" />
                                                </div>
                                            )}
                                            {hotel.feature_guest_bot && (
                                                <div title="Guest Bot" className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center">
                                                    <Zap className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* Actions */}
                                    <td className="py-3.5 pl-3 pr-5">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-[11px] px-3 rounded-lg font-bold border-border hidden sm:flex"
                                                onClick={() => onImpersonate(hotel.id)}
                                                disabled={isImpersonating}
                                            >
                                                <UserCheck className="w-3 h-3 mr-1" /> Login As
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="h-7 text-[11px] px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                                onClick={() => onSelectHotel(hotel)}
                                            >
                                                <Settings className="w-3 h-3 mr-1" /> Manage
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="px-5 py-3 border-t border-border bg-muted/10 text-[10px] text-muted-foreground font-medium">
                Showing {sorted.length} of {hotels.length} properties
            </div>
        </motion.div>
    );
};
