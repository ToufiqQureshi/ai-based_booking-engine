/**
 * Presentational BI report body — KPI cards + charts. No data fetching, no
 * page chrome. Shared by:
 *   - HotelReport  (authenticated /reports page, inside the dashboard layout)
 *   - PublicReport (no-login /r/:token page, full-screen)
 * so the hotelier and the shared-link viewer see an identical report.
 */
import React, { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  TooltipProps
} from 'recharts';
import { Users, BedDouble, IndianRupee, TrendingUp } from 'lucide-react';

export interface ChannelSlice { channel: string; bookings: number; revenue: number; }
export interface ReportData {
  total_visitors: number;
  conversion_rate: number;
  revenue_total: number;
  total_bookings: number;
  rooms_booked: number;
  rev_par: number;
  occupancy_rate: number;
  avg_daily_rate: number;
  channel_mix: ChannelSlice[];
  chart_data: { date: string; revenue?: number; occupancy?: number }[];
  funnel_data: { stage: string; count: number }[];
  device_stats: { type: string; count: number }[];
  city_stats: { city: string; visitors: number; percentage: number }[];
}

export interface DashboardConfig {
  visibleKpis: string[]; // 'visitors', 'rooms', 'revenue', 'revpar'
  colorTheme: 'default' | 'ocean' | 'sunset' | 'forest';
  trendChartType: 'area' | 'bar';
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  visibleKpis: ['visitors', 'rooms', 'revenue', 'revpar'],
  colorTheme: 'default',
  trendChartType: 'area',
};

const THEMES = {
  default: ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'],
  ocean:   ['#0ea5e9', '#06b6d4', '#0284c7', '#38bdf8', '#0369a1', '#7dd3fc'],
  sunset:  ['#f97316', '#f43f5e', '#fb923c', '#fbbf24', '#ea580c', '#e11d48'],
  forest:  ['#10b981', '#84cc16', '#22c55e', '#a3e635', '#059669', '#4ade80'],
};

export const inr = (n: number) =>
  '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

// Premium Custom Tooltip
const PremiumTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900/95 border border-white/10 backdrop-blur-md p-3 rounded-xl shadow-xl text-white text-sm">
        {label && <div className="font-semibold mb-2 text-gray-300">{label}</div>}
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-3 mt-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="flex-1 text-gray-200">{entry.name}:</span>
            <span className="font-bold tabular-nums">
              {entry.name === 'Revenue' || entry.name?.toString().includes('Revenue') || entry.name === 'avg_daily_rate'
                ? inr(entry.value as number)
                : entry.name === 'Occupancy %'
                ? `${entry.value}%`
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string; colorClass?: string }> = ({
  icon, label, value, sub, colorClass = "text-indigo-600 bg-indigo-50"
}) => (
  <div className="relative overflow-hidden bg-gradient-to-br from-card to-gray-50/50 rounded-2xl border border-border/60 p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 group">
    <div className="flex items-center justify-between mb-4">
      <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div className={`p-2 rounded-xl transition-colors ${colorClass} group-hover:scale-110 duration-300`}>
        {icon}
      </div>
    </div>
    <div className="mt-1 text-3xl font-extrabold text-foreground tracking-tight">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-2 font-medium">{sub}</div>}
    
    {/* Subtle decorative glow */}
    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 blur-2xl rounded-full pointer-events-none" />
  </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-card/80 backdrop-blur-xl rounded-3xl border border-border/50 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
    <div className="flex items-center gap-2 mb-6">
      <div className="w-1.5 h-5 bg-indigo-500 rounded-full" />
      <h3 className="text-base font-bold text-foreground">{title}</h3>
    </div>
    {children}
  </div>
);

const ReportView: React.FC<{ data: ReportData, config?: DashboardConfig }> = ({ data: d, config = DEFAULT_DASHBOARD_CONFIG }) => {
  const cityChart = useMemo(
    () => (d.city_stats || []).slice(0, 8).map((c) => ({ name: c.city, visitors: c.visitors })),
    [d],
  );

  const colors = THEMES[config.colorTheme] || THEMES.default;
  const primaryColor = colors[0];
  const secondaryColor = colors[1];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      {/* KPI row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {config.visibleKpis.includes('visitors') && (
          <KpiCard icon={<Users className="w-5 h-5" />} label="Visitors" value={(d.total_visitors || 0).toLocaleString('en-IN')} sub={`${d.conversion_rate}% converted`} colorClass="text-blue-600 bg-blue-50" />
        )}
        {config.visibleKpis.includes('rooms') && (
          <KpiCard icon={<BedDouble className="w-5 h-5" />} label="Rooms Booked" value={(d.rooms_booked || 0).toLocaleString('en-IN')} sub={`${d.total_bookings} bookings`} colorClass="text-emerald-600 bg-emerald-50" />
        )}
        {config.visibleKpis.includes('revenue') && (
          <KpiCard icon={<IndianRupee className="w-5 h-5" />} label="Revenue" value={inr(d.revenue_total)} sub={`ADR ${inr(d.avg_daily_rate)}`} colorClass="text-amber-600 bg-amber-50" />
        )}
        {config.visibleKpis.includes('revpar') && (
          <KpiCard icon={<TrendingUp className="w-5 h-5" />} label="RevPAR" value={inr(d.rev_par)} sub={`${d.occupancy_rate}% occupancy`} colorClass="text-purple-600 bg-purple-50" />
        )}
      </section>

      {/* Revenue + occupancy trend */}
      <Panel title="Revenue & Occupancy Trend">
        <ResponsiveContainer width="100%" height={320}>
          {config.trendChartType === 'area' ? (
            <AreaChart data={d.chart_data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorOcc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={secondaryColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={30} dy={10} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} unit="%" />
              <Tooltip content={<PremiumTooltip />} />
              <Area yAxisId="left" type="monotone" dataKey="revenue" stroke={primaryColor} strokeWidth={3} fill="url(#colorRev)" name="Revenue" activeDot={{ r: 6, strokeWidth: 0, fill: primaryColor }} />
              <Area yAxisId="right" type="monotone" dataKey="occupancy" stroke={secondaryColor} strokeWidth={3} fill="url(#colorOcc)" name="Occupancy %" activeDot={{ r: 6, strokeWidth: 0, fill: secondaryColor }} />
            </AreaChart>
          ) : (
            <BarChart data={d.chart_data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={30} dy={10} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} unit="%" />
              <Tooltip content={<PremiumTooltip />} />
              <Bar yAxisId="left" dataKey="revenue" fill={primaryColor} name="Revenue" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="occupancy" fill={secondaryColor} name="Occupancy %" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </Panel>

      <section className="grid lg:grid-cols-2 gap-8">
        {/* Booking funnel */}
        <Panel title="Booking Funnel">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.funnel_data} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip cursor={{ fill: '#f8fafc' }} content={<PremiumTooltip />} />
              <Bar dataKey="count" fill={primaryColor} radius={[0, 8, 8, 0]} barSize={32}>
                {d.funnel_data?.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Channel mix (Direct / AI / OTA-future) */}
        <Panel title="Booking Channels">
          {(!d.channel_mix || d.channel_mix.length === 0) ? (
            <div className="flex items-center justify-center h-[280px]">
              <p className="text-sm text-muted-foreground bg-secondary/50 px-4 py-2 rounded-lg">No bookings in this period.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={d.channel_mix} dataKey="revenue" nameKey="channel" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} stroke="none" label={(e: any) => e.channel}>
                  {d.channel_mix.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip content={<PremiumTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </section>

      <section className="grid lg:grid-cols-2 gap-8">
        {/* Top cities */}
        <Panel title="Top Visitor Cities">
          {cityChart.length === 0 ? (
            <div className="flex items-center justify-center h-[280px]">
              <p className="text-sm text-muted-foreground bg-secondary/50 px-4 py-2 rounded-lg">No location data yet.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cityChart} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip cursor={{ fill: '#f8fafc' }} content={<PremiumTooltip />} />
                <Bar dataKey="visitors" fill={secondaryColor} radius={[0, 8, 8, 0]} barSize={24}>
                  {cityChart.map((_, i) => <Cell key={i} fill={colors[(i + 1) % colors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Devices */}
        <Panel title="Devices">
          {(!d.device_stats || d.device_stats.length === 0) ? (
             <div className="flex items-center justify-center h-[280px]">
              <p className="text-sm text-muted-foreground bg-secondary/50 px-4 py-2 rounded-lg">No visitor data yet.</p>
             </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={d.device_stats} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} stroke="none" label={(e: any) => e.type}>
                  {d.device_stats.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip content={<PremiumTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </section>
    </div>
  );
};

export default ReportView;
