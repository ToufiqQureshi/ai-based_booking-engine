import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Building2 } from 'lucide-react';
import { cn } from '@/core/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    healthy:    { label: 'Healthy',    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200', icon: CheckCircle2 },
    dormant:    { label: 'Dormant',    color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200',   icon: Clock },
    incomplete: { label: 'Incomplete', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200',        icon: AlertTriangle },
    disabled:   { label: 'Disabled',   color: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border-red-200',              icon: XCircle },
    paused:     { label: 'Paused',     color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200',       icon: XCircle },
};

export function HealthTab({ onSelectHotel }: { onSelectHotel?: (h: any) => void }) {
    const { data, isLoading, refetch, isFetching } = useQuery<any>({
        queryKey: ['superadmin-health'],
        queryFn: () => apiClient.get('/superadmin/health'),
        staleTime: 1000 * 60 * 5,
    });

    const summary = data?.summary ?? {};
    const hotels = data?.hotels ?? [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-foreground">Platform Health</h2>
                    <p className="text-sm text-muted-foreground">Onboarding status, dormant properties, subscription alerts</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 font-semibold h-9" onClick={() => refetch()}>
                    <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} /> Refresh
                </Button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                    { label: 'Total', value: summary.total ?? 0, color: 'text-foreground' },
                    { label: 'Healthy', value: summary.healthy ?? 0, color: 'text-emerald-600' },
                    { label: 'Dormant', value: summary.dormant ?? 0, color: 'text-amber-600' },
                    { label: 'Incomplete', value: summary.incomplete ?? 0, color: 'text-blue-600' },
                    { label: 'Disabled', value: summary.disabled ?? 0, color: 'text-red-600' },
                ].map((s, i) => (
                    <div key={i} className="border border-border rounded-xl p-4 bg-background">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                        <p className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Hotel health table */}
            <div className="border border-border rounded-2xl overflow-hidden bg-background">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            <th className="text-left py-3 pl-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Property</th>
                            <th className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                            <th className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">Bookings / Month</th>
                            <th className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Last Booking</th>
                            <th className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden xl:table-cell">Onboarding</th>
                            <th className="text-right py-3 pr-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Plan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Loading health data…</td></tr>
                        ) : hotels.map((h: any, i: number) => {
                            const cfg = STATUS_CONFIG[h.health_status] ?? STATUS_CONFIG.incomplete;
                            const Icon = cfg.icon;
                            return (
                                <tr key={h.hotel_id} className={cn("border-b border-border/60 hover:bg-muted/20 transition-colors", i === hotels.length - 1 && "border-0")}>
                                    <td className="py-3 pl-5">
                                        <button
                                            onClick={() => onSelectHotel?.({ id: h.hotel_id, name: h.hotel_name, slug: h.slug })}
                                            className="font-bold text-sm text-foreground hover:text-indigo-600 transition-colors"
                                        >
                                            {h.hotel_name}
                                        </button>
                                        <p className="text-[10px] font-mono text-muted-foreground">{h.slug}</p>
                                    </td>
                                    <td className="py-3 px-3">
                                        <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border gap-1", cfg.color)}>
                                            <Icon className="w-2.5 h-2.5" /> {cfg.label}
                                        </Badge>
                                    </td>
                                    <td className="py-3 px-3 hidden md:table-cell">
                                        <span className="font-bold tabular-nums">{h.bookings_this_month}</span>
                                        <span className="text-[10px] text-muted-foreground ml-1">/ {h.total_bookings} total</span>
                                    </td>
                                    <td className="py-3 px-3 hidden lg:table-cell text-xs text-muted-foreground">
                                        {h.days_since_booking != null
                                            ? `${h.days_since_booking}d ago`
                                            : 'Never'}
                                    </td>
                                    <td className="py-3 px-3 hidden xl:table-cell">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 rounded-full transition-all"
                                                    style={{ width: `${h.onboarding?.percentage ?? 0}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-bold">
                                                {h.onboarding?.percentage ?? 0}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3 pr-5 text-right">
                                        <span className="text-xs font-bold text-foreground">{h.subscription_plan ?? 'Free'}</span>
                                        {h.subscription_end_date && (
                                            <p className="text-[10px] text-muted-foreground">
                                                exp {new Date(h.subscription_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                            </p>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
