import { motion } from 'framer-motion';
import { Building2, Users, BrainCircuit, ShieldCheck } from 'lucide-react';

interface StatsProps {
    hotelsCount: number;
    usersCount: number;
    aiCount: number;
}

export const StatsGrid = ({ hotelsCount, usersCount, aiCount }: StatsProps) => {
    const stats = [
        {
            label: 'Total Hotels',
            value: hotelsCount,
            trend: '+12%',
            icon: Building2,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
            gradient: 'from-indigo-500/10 via-transparent to-transparent'
        },
        {
            label: 'Active Users',
            value: usersCount,
            trend: '+5%',
            icon: Users,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            gradient: 'from-emerald-500/10 via-transparent to-transparent'
        },
        {
            label: 'AI Features Active',
            value: aiCount,
            trend: 'Trending',
            icon: BrainCircuit,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
            gradient: 'from-purple-500/10 via-transparent to-transparent'
        },
        {
            label: 'System Health',
            value: '99.9%',
            trend: 'Operational',
            icon: ShieldCheck,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            gradient: 'from-blue-500/10 via-transparent to-transparent'
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    whileHover={{ y: -5, scale: 1.02 }}
                    className="group relative border border-border/80 shadow-sm hover:shadow-xl transition-all duration-300 rounded-2xl bg-background overflow-hidden p-6 cursor-pointer"
                >
                    <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className={`${stat.bg} ${stat.color} p-3.5 rounded-2xl transition-all duration-300 group-hover:scale-110 shadow-sm`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                    </div>
                    <div className="flex items-end justify-between relative z-10">
                        <h3 className="text-3xl font-black text-foreground tabular-nums tracking-tight">{stat.value}</h3>
                        <span className="text-[10px] font-black px-2.5 py-1 bg-muted rounded-xl text-muted-foreground transition-all duration-300 group-hover:bg-indigo-50 group-hover:text-indigo-600">{stat.trend}</span>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
