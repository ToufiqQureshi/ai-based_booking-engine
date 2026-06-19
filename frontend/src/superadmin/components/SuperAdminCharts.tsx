import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';

const revenueData = [
  { name: 'Jan', revenue: 4000 },
  { name: 'Feb', revenue: 5500 },
  { name: 'Mar', revenue: 7000 },
  { name: 'Apr', revenue: 6800 },
  { name: 'May', revenue: 9500 },
  { name: 'Jun', revenue: 12500 },
];

const propertiesData = [
  { name: 'Jan', properties: 1 },
  { name: 'Feb', properties: 2 },
  { name: 'Mar', properties: 3 },
  { name: 'Apr', properties: 4 },
  { name: 'May', properties: 6 },
  { name: 'Jun', properties: 7 },
];

export const SuperAdminCharts = () => {
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
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
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
                                tickFormatter={(val) => `$${val/1000}k`}
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)' }}
                                itemStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                                formatter={(value: number) => [`$${value}`, 'Revenue']}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="bg-background border border-border rounded-2xl p-5 shadow-sm"
            >
                <div className="mb-4">
                    <h3 className="text-lg font-black text-foreground">Properties Growth</h3>
                    <p className="text-xs text-muted-foreground">Active properties onboarded over last 6 months</p>
                </div>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
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
                            />
                            <Tooltip 
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)' }}
                                itemStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                                formatter={(value: number) => [value, 'Properties']}
                            />
                            <Bar dataKey="properties" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>
        </div>
    );
};
