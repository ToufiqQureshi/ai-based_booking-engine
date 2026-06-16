import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Trash2, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';

export function CacheTab({ hotels }: { hotels: any[] }) {
    const qc = useQueryClient();
    const [flushConfirm, setFlushConfirm] = useState(false);

    const { data: stats, isLoading, refetch } = useQuery<any>({
        queryKey: ['cache-stats'],
        queryFn: () => apiClient.get('/superadmin/cache/stats'),
        staleTime: 1000 * 30,
    });

    const clearHotelMutation = useMutation({
        mutationFn: (hotelId: string) => apiClient.delete(`/superadmin/cache/hotel/${hotelId}`),
        onSuccess: (_, hotelId) => {
            const h = hotels.find(h => h.id === hotelId);
            toast.success(`Cache cleared for ${h?.name ?? hotelId}`);
            refetch();
        },
        onError: () => toast.error('Failed to clear cache'),
    });

    const flushAllMutation = useMutation({
        mutationFn: () => apiClient.delete('/superadmin/cache/all'),
        onSuccess: () => {
            toast.success('All caches flushed successfully');
            setFlushConfirm(false);
            qc.clear();
            refetch();
        },
        onError: () => toast.error('Failed to flush cache'),
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-foreground">Cache Management</h2>
                    <p className="text-sm text-muted-foreground">Redis stats and per-hotel cache control</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 font-semibold h-9" onClick={() => refetch()}>
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
            </div>

            {/* Redis stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Mode', value: stats?.mode ?? '—' },
                    { label: 'Memory Used', value: stats?.used_memory_human ?? '—' },
                    { label: 'Total Keys', value: stats?.total_keys ?? 0 },
                    { label: 'Redis Version', value: stats?.redis_version ?? '—' },
                ].map((s, i) => (
                    <div key={i} className="border border-border rounded-xl p-4 bg-background">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                        <p className="text-lg font-black text-foreground mt-1">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Status indicator */}
            <div className={cn(
                "flex items-center gap-3 p-4 rounded-xl border",
                stats?.redis_connected
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                    : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
            )}>
                {stats?.redis_connected
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    : <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                }
                <p className="text-sm font-semibold">
                    {stats?.redis_connected
                        ? 'Redis connected — full caching active'
                        : 'Redis unavailable — using in-memory fallback (not shared across workers)'}
                </p>
            </div>

            {/* Per-hotel cache */}
            <div>
                <p className="text-sm font-black text-foreground mb-3">Clear Cache Per Property</p>
                <div className="border border-border rounded-2xl overflow-hidden bg-background">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left py-3 pl-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Property</th>
                                <th className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">Slug</th>
                                <th className="text-right py-3 pr-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hotels.map((h, i) => (
                                <tr key={h.id} className={cn("border-b border-border/60 hover:bg-muted/20 transition-colors", i === hotels.length - 1 && "border-0")}>
                                    <td className="py-3 pl-5 font-semibold text-foreground">{h.name}</td>
                                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground hidden md:table-cell">{h.slug}</td>
                                    <td className="py-3 pr-5 text-right">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs rounded-lg gap-1.5"
                                            onClick={() => clearHotelMutation.mutate(h.id)}
                                            disabled={clearHotelMutation.isPending}
                                        >
                                            <Trash2 className="w-3 h-3" /> Clear
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Danger zone: flush all */}
            <div className="border border-red-200 dark:border-red-900 rounded-2xl p-5 bg-red-50/50 dark:bg-red-950/10">
                <p className="font-black text-sm text-red-700 dark:text-red-400 mb-1">Danger Zone</p>
                <p className="text-xs text-muted-foreground mb-4">Flush ALL cache keys from Redis. All users will experience slower responses for ~60 seconds while caches rebuild.</p>
                {!flushConfirm ? (
                    <Button variant="outline" size="sm" className="rounded-xl border-red-300 text-red-600 hover:bg-red-100 gap-1.5" onClick={() => setFlushConfirm(true)}>
                        <Database className="w-3.5 h-3.5" /> Flush All Caches
                    </Button>
                ) : (
                    <div className="flex items-center gap-3">
                        <p className="text-xs font-bold text-red-700">Are you sure?</p>
                        <Button size="sm" className="rounded-lg bg-red-600 hover:bg-red-700 text-white gap-1" onClick={() => flushAllMutation.mutate()} disabled={flushAllMutation.isPending}>
                            Yes, Flush All
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setFlushConfirm(false)}>Cancel</Button>
                    </div>
                )}
            </div>
        </div>
    );
}
