import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, LogOut, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const ROLE_COLORS: Record<string, string> = {
    SUPER_ADMIN: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border-red-200',
    OWNER:       'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200',
    MANAGER:     'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200',
    STAFF:       'bg-muted text-muted-foreground border-border',
};

export function SessionsTab() {
    const { data, isLoading, refetch, isFetching } = useQuery<any>({
        queryKey: ['superadmin-sessions'],
        queryFn: () => apiClient.get('/superadmin/sessions'),
        staleTime: 1000 * 30,
        refetchInterval: 60000, // refresh every 60s
    });

    const revokeMutation = useMutation({
        mutationFn: (userId: string) => apiClient.delete(`/superadmin/sessions/${userId}`),
        onSuccess: (res: any) => {
            toast.success(`${res.sessions_revoked} session(s) revoked`);
            refetch();
        },
        onError: () => toast.error('Failed to revoke sessions'),
    });

    const sessions = data?.sessions ?? [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-foreground">Active Sessions</h2>
                    <p className="text-sm text-muted-foreground">
                        {data?.total ?? 0} active session(s) · auto-refreshes every 60s
                    </p>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 font-semibold h-9" onClick={() => refetch()}>
                    <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} /> Refresh
                </Button>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-background">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            <th className="text-left py-3 pl-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">User</th>
                            <th className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Role</th>
                            <th className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">Last Seen</th>
                            <th className="text-right py-3 pr-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">Loading sessions…</td></tr>
                        ) : sessions.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-16 text-center">
                                    <Shield className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                                    <p className="text-sm text-muted-foreground font-medium">No active sessions tracked yet</p>
                                    <p className="text-xs text-muted-foreground">Sessions appear here as users make API calls</p>
                                </td>
                            </tr>
                        ) : sessions.map((s: any, i: number) => (
                            <tr key={`${s.user_id}-${i}`} className={cn("border-b border-border/60 hover:bg-muted/20 transition-colors", i === sessions.length - 1 && "border-0")}>
                                <td className="py-3 pl-5">
                                    <p className="font-bold text-foreground text-sm">{s.email}</p>
                                    <p className="text-[10px] font-mono text-muted-foreground">{s.user_id?.slice(0, 8)}…</p>
                                </td>
                                <td className="py-3 px-3">
                                    <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border", ROLE_COLORS[s.role] ?? ROLE_COLORS.STAFF)}>
                                        {s.role}
                                    </Badge>
                                </td>
                                <td className="py-3 px-3 hidden md:table-cell text-xs text-muted-foreground">
                                    {s.last_seen
                                        ? formatDistanceToNow(new Date(s.last_seen), { addSuffix: true })
                                        : '—'}
                                </td>
                                <td className="py-3 pr-5 text-right">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs rounded-lg text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                                        onClick={() => {
                                            if (confirm(`Force-logout all sessions for ${s.email}?`)) {
                                                revokeMutation.mutate(s.user_id);
                                            }
                                        }}
                                        disabled={revokeMutation.isPending}
                                    >
                                        <LogOut className="w-3 h-3" /> Force Logout
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-muted-foreground">
                Sessions are tracked in Redis and expire after 7 days of inactivity. Force-logout revokes all tokens immediately.
            </p>
        </div>
    );
}
