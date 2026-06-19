import type { ReactElement } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';

interface RevenueResponse {
    mrr: number;
    mrr_trend: { month: string; mrr: number; count: number }[];
}

const fmtINR = (val: number) => `₹${(val / 1000).toFixed(val >= 1000 ? 0 : 1)}k`;

export const SuperAdminCharts = () => {
    // Real platform revenue/growth trend (last 6 months) from the backend.
    const { data, isLoading } = useQuery<RevenueResponse>({
        queryKey: ['superadmin-revenue'],
        queryFn: () => apiClient.get('/superadmin/revenue'),
        staleTime: 1000 * 60 * 5,
    });

    const trend = data?.mrr_trend ?? [];
    const revenueData = trend.map(t => ({ name: t.month, revenue: t.mrr }));
    const propertiesData = trend.map(t => ({ name: t.month, properties: t.count }));

    const ChartShell = ({ children }: { children: ReactElement }) => (
        <div className="h-[250px] w-full">
            {isLoading ? (
                <div className="h-full flex items-center justify-center">
                    <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : trend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No revenue data yet
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
            )}
        </div>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-background border border-border rounded-2xl p-5 shadow-sm"
            >
                <div className="mb-4">
                    <h3 className="text-lg font-black text-foreground">Revenue Trend</h3>
                    <p className="text-xs text-muted-foreground">Monthly Recurring Revenue over last 6 months</p>
                </div>
                <ChartShell>
                    <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-muted/30" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: 'currentColor' }}
                            className="text-muted-foreground"
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: 'currentColor' }}
                            className="text-muted-foreground"
                            tickFormatter={fmtINR}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)' }}
                            itemStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                            formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'MRR']}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                </ChartShell>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="bg-background border border-border rounded-2xl p-5 shadow-sm"
            >
                <div className="mb-4">
                    <h3 className="text-lg font-black text-foreground">Properties Growth</h3>
                    <p className="text-xs text-muted-foreground">Active subscriptions over last 6 months</p>
                </div>
                <ChartShell>
                    <BarChart data={propertiesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={30}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-muted/30" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: 'currentColor' }}
                            className="text-muted-foreground"
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: 'currentColor' }}
                            className="text-muted-foreground"
                            allowDecimals={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)' }}
                            itemStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                            formatter={(value: number) => [value, 'Active subs']}
                        />
                        <Bar dataKey="properties" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ChartShell>
            </motion.div>
        </div>
    );
};
