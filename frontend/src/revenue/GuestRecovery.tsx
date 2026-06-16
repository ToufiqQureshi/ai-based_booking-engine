import { useState, useEffect } from 'react';
import {
    Send, Loader2, MailWarning, RefreshCw, CheckCircle2, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/core/hooks/use-toast';
import { apiClient } from '@/core/api/client';
import { PageShell } from '@/components/layout/PageShell';
import { format } from 'date-fns';

interface AbandonedBooking {
    id: string;
    booking_number: string;
    check_in: string;
    check_out: string;
    total_amount: number;
    created_at: string;
    recovery_sent_at: string | null;
}

export default function GuestRecovery() {
    const { toast } = useToast();
    const [enabled, setEnabled] = useState(false);
    const [rows, setRows] = useState<AbandonedBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [s, list] = await Promise.all([
                apiClient.get<{ recovery_enabled: boolean }>('/revenue/recovery/settings'),
                apiClient.get<AbandonedBooking[]>('/revenue/recovery/abandoned'),
            ]);
            setEnabled(s.recovery_enabled);
            setRows(list);
        } catch {
            toast({ title: 'Failed to load recovery data', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const toggle = async (v: boolean) => {
        setEnabled(v);
        try {
            await apiClient.put('/revenue/recovery/settings', { recovery_enabled: v });
            toast({ title: v ? 'Recovery turned on' : 'Recovery turned off' });
        } catch {
            setEnabled(!v);
            toast({ title: 'Update failed', variant: 'destructive' });
        }
    };

    const runNow = async () => {
        setRunning(true);
        try {
            const res = await apiClient.post<{ nudged: number; scanned: number }>('/revenue/recovery/run');
            toast({ title: `Sent ${res.nudged} reminder(s)`, description: `Scanned ${res.scanned} abandoned booking(s).` });
            await load();
        } catch (e: any) {
            toast({ title: 'Run failed', description: e?.message, variant: 'destructive' });
        } finally {
            setRunning(false);
        }
    };

    const pending = rows.filter((r) => !r.recovery_sent_at).length;

    return (
        <PageShell
            title="Guest Recovery"
            description="Win back guests who picked a room but didn't pay — with an automatic WhatsApp + email nudge."
            actions={
                <Button onClick={runNow} disabled={running}>
                    {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                    Send reminders now
                </Button>
            }
        >
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
                <div className="space-y-5">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MailWarning className="h-5 w-5 text-indigo-600" /> Automatic recovery
                            </CardTitle>
                            <CardDescription>
                                When on, guests with an unpaid booking get a friendly WhatsApp message and email
                                ~30 minutes after they leave, with a link to finish. Each guest is messaged only once.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                                {enabled ? 'Recovery is active' : 'Recovery is off'}
                            </span>
                            <Switch checked={enabled} onCheckedChange={toggle} />
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <StatCard label="Abandoned (72h)" value={rows.length} icon={MailWarning} />
                        <StatCard label="Awaiting nudge" value={pending} icon={Clock} />
                        <StatCard label="Already nudged" value={rows.length - pending} icon={CheckCircle2} />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between text-base">
                                Abandoned bookings
                                <Button variant="ghost" size="sm" onClick={load}>
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {rows.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-8 text-center">
                                    No abandoned bookings in the last 72 hours. 🎉
                                </p>
                            ) : (
                                <div className="divide-y">
                                    {rows.map((r) => (
                                        <div key={r.id} className="flex items-center gap-4 py-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{r.booking_number}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {r.check_in} → {r.check_out} · {format(new Date(r.created_at), 'dd MMM, HH:mm')}
                                                </p>
                                            </div>
                                            <span className="font-semibold">₹{r.total_amount?.toLocaleString()}</span>
                                            {r.recovery_sent_at ? (
                                                <Badge variant="secondary" className="gap-1">
                                                    <CheckCircle2 className="h-3 w-3" /> Nudged
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="gap-1">
                                                    <Clock className="h-3 w-3" /> Pending
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </PageShell>
    );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
    return (
        <Card>
            <CardContent className="flex items-center gap-3 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-xl font-bold leading-none">{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
            </CardContent>
        </Card>
    );
}
