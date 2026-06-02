import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, Crown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PLAN_COLORS: Record<string, string> = {
    Enterprise: '#f59e0b',
    Premium:    '#8b5cf6',
    Basic:      '#3b82f6',
    Free:       '#64748b',
};

const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` :
    n >= 1000   ? `₹${(n / 1000).toFixed(1)}K` :
    `₹${n.toLocaleString('en-IN')}`;

export function RevenueTab() {
    const { data, isLoading } = useQuery<any>({
        queryKey: ['superadmin-revenue'],
        queryFn: () => apiClient.get('/superadmin/revenue'),
        staleTime: 1000 * 60 * 15,
    });

    if (isLoading) return (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading revenue data…</div>
    );

    const d = data ?? {};
    const trend = (curr: number, prev: number) =>
        prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);
    const signupTrend = trend(d.new_this_month, d.new_prev_month);
    const churnTrend  = trend(d.churned_this_month, d.churned_prev_month);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-black text-foreground">Revenue & Growth</h2>
                <p className="text-sm text-muted-foreground">Subscription revenue, churn, and plan distribution</p>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'MRR', value: fmt(d.mrr ?? 0), sub: 'Monthly Recurring Revenue', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'ARR', value: fmt(d.arr ?? 0), sub: 'Annual Run Rate', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Active Subs', value: d.active_subscriptions ?? 0, sub: `${d.new_this_month ?? 0} new this month`, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Churn Rate', value: `${d.churn_rate ?? 0}%`, sub: `${d.churned_this_month ?? 0} cancelled this month`, icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50' },
                ].map((s, i) => (
                    <Card key={i} className="border-border shadow-sm rounded-2xl">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`${s.bg} ${s.color} p-2.5 rounded-xl`}>
                                    <s.icon className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</span>
                            </div>
                            <p className="text-2xl font-black text-foreground">{s.value}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* MRR Trend chart */}
                <div className="lg:col-span-2 border border-border rounded-2xl bg-background p-5">
                    <p className="text-sm font-black text-foreground mb-4">MRR Trend (6 months)</p>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={d.mrr_trend ?? []}>
                            <defs>
                                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                            <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v: any) => fmt(v)} />
                            <Area type="monotone" dataKey="mrr" stroke="#6366f1" fill="url(#mrrGrad)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Plan distribution */}
                <div className="border border-border rounded-2xl bg-background p-5">
                    <p className="text-sm font-black text-foreground mb-4">Plan Distribution</p>
                    {(d.plan_distribution ?? []).length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={140}>
                                <PieChart>
                                    <Pie data={d.plan_distribution} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                                        {(d.plan_distribution ?? []).map((p: any) => (
                                            <Cell key={p.plan} fill={PLAN_COLORS[p.plan] ?? '#64748b'} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-2 mt-2">
                                {(d.plan_distribution ?? []).map((p: any) => (
                                    <div key={p.plan} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: PLAN_COLORS[p.plan] ?? '#64748b' }} />
                                            <span className="font-semibold">{p.plan}</span>
                                        </div>
                                        <span className="font-bold text-foreground">{p.count} · {fmt(p.monthly_value)}/mo</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No active subscriptions</p>
                    )}
                </div>
            </div>

            {/* Expiring soon */}
            {(d.expiring_soon ?? []).length > 0 && (
                <div className="border border-amber-200 dark:border-amber-800 rounded-2xl bg-amber-50 dark:bg-amber-950/20 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <p className="text-sm font-black text-amber-800 dark:text-amber-400">
                            {d.expiring_soon.length} subscription(s) expiring in 7 days
                        </p>
                    </div>
                    <div className="space-y-2">
                        {d.expiring_soon.map((s: any) => (
                            <div key={s.hotel_id} className="flex items-center justify-between text-xs bg-background rounded-xl px-4 py-2.5 border border-border">
                                <span className="font-semibold text-foreground">{s.hotel_id}</span>
                                <div className="flex items-center gap-3">
                                    <Badge className="text-[9px] bg-amber-100 text-amber-800 border-amber-200">{s.plan}</Badge>
                                    <span className="text-muted-foreground">{s.days_left}d left</span>
                                    <span className="font-mono text-muted-foreground">{s.end_date}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
