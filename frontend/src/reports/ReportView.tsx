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

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

export const inr = (n: number) =>
  '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string }> = ({
  icon, label, value, sub,
}) => (
  <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
    <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
      {icon}{label}
    </div>
    <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
  </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
    <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
    {children}
  </div>
);

const ReportView: React.FC<{ data: ReportData }> = ({ data: d }) => {
  const cityChart = useMemo(
    () => (d.city_stats || []).slice(0, 8).map((c) => ({ name: c.city, visitors: c.visitors })),
    [d],
  );

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Users className="w-4 h-4" />} label="Visitors" value={(d.total_visitors || 0).toLocaleString('en-IN')} sub={`${d.conversion_rate}% converted`} />
        <KpiCard icon={<BedDouble className="w-4 h-4" />} label="Rooms Booked" value={(d.rooms_booked || 0).toLocaleString('en-IN')} sub={`${d.total_bookings} bookings`} />
        <KpiCard icon={<IndianRupee className="w-4 h-4" />} label="Revenue" value={inr(d.revenue_total)} sub={`ADR ${inr(d.avg_daily_rate)}`} />
        <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="RevPAR" value={inr(d.rev_par)} sub={`${d.occupancy_rate}% occupancy`} />
      </section>

      {/* Revenue + occupancy trend */}
      <Panel title="Revenue & Occupancy Trend">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={d.chart_data}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
            <Tooltip />
            <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#rev)" name="Revenue" />
            <Area yAxisId="right" type="monotone" dataKey="occupancy" stroke="#22c55e" fillOpacity={0} name="Occupancy %" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <section className="grid md:grid-cols-2 gap-6">
        {/* Booking funnel */}
        <Panel title="Booking Funnel">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.funnel_data} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Channel mix (Direct / AI / OTA-future) */}
        <Panel title="Booking Channels">
          {(!d.channel_mix || d.channel_mix.length === 0) ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No bookings in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={d.channel_mix} dataKey="revenue" nameKey="channel" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.channel}>
                  {d.channel_mix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => inr(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        {/* Top cities — what the hotelier targets for local marketing */}
        <Panel title="Top Visitor Cities">
          {cityChart.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No location data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cityChart} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="visitors" fill="#06b6d4" radius={[0, 4, 4, 0]}>
                  {cityChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Devices */}
        <Panel title="Devices">
          {(!d.device_stats || d.device_stats.length === 0) ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No visitor data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={d.device_stats} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={(e: any) => e.type}>
                  {d.device_stats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </section>
    </div>
  );
};

export default ReportView;
