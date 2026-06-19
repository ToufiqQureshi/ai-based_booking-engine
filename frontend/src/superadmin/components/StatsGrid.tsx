import { motion } from 'framer-motion';
import { Building2, Users, BrainCircuit, Activity } from 'lucide-react';

interface StatsProps {
    hotelsCount: number;
    usersCount: number;
    aiCount: number;
    activeCount?: number; // hotels with active subscription
    mrr?: number;
    gbv?: number;
    conversionRate?: number;
}

export const StatsGrid = ({ hotelsCount, usersCount, aiCount, activeCount, mrr = 12500, gbv = 1450000, conversionRate = 3.2 }: StatsProps) => {
    const activeHotels = activeCount ?? hotelsCount;
    const aiPct = hotelsCount > 0 ? Math.round((aiCount / hotelsCount) * 100) : 0;

    const stats = [
        {
            label: 'Total MRR',
            value: `$${mrr.toLocaleString()}`,
            sub: '+12% from last month',
            icon: Activity, // You can change icon later if needed, but Activity is good for revenue
            color: 'text-emerald-600',
            bg: 'bg-emerald-50 dark:bg-emerald-950/30',
            border: 'border-emerald-100 dark:border-emerald-900/40',
            gradient: 'from-emerald-500/8 via-transparent to-transparent',
        },
        {
            label: 'Gross Booking Val',
            value: `$${(gbv / 1000).toFixed(1)}k`,
            sub: 'Processed 30 days',
            icon: Building2,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50 dark:bg-indigo-950/30',
            border: 'border-indigo-100 dark:border-indigo-900/40',
            gradient: 'from-indigo-500/8 via-transparent to-transparent',
        },
        {
            label: 'Global Conversion',
            value: `${conversionRate}%`,
            sub: 'Search to Booking',
            icon: BrainCircuit,
            color: 'text-purple-600',
            bg: 'bg-purple-50 dark:bg-purple-950/30',
            border: 'border-purple-100 dark:border-purple-900/40',
            gradient: 'from-purple-500/8 via-transparent to-transparent',
        },
        {
            label: 'Active Properties',
            value: activeHotels,
            sub: `Out of ${hotelsCount} total`,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50 dark:bg-blue-950/30',
            border: 'border-blue-100 dark:border-blue-900/40',
            gradient: 'from-blue-500/8 via-transparent to-transparent',
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.07 }}
                    className={`group relative border ${stat.border} shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl bg-background overflow-hidden p-5`}
                >
                    <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                    <div className="flex items-start justify-between mb-3 relative z-10">
                        <div className={`${stat.bg} ${stat.color} p-2.5 rounded-xl border ${stat.border}`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right leading-tight max-w-[80px]">
                            {stat.label}
                        </span>
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-2xl font-black text-foreground tabular-nums">{stat.value}</h3>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{stat.sub}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
