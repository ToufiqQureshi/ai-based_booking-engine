/**
 * Public, no-login hotel analytics report.
 *
 * Rendered at /r/:token — the page a hotelier shares with anyone (investor,
 * owner, partner) who shouldn't have a Staybooker login. It fetches the public
 * report endpoint, which resolves the token to ONE hotel and returns aggregate
 * stats only (no guest PII). No auth context / apiClient here on purpose: the
 * page must work for an anonymous visitor.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, BedDouble, IndianRupee, TrendingUp, Percent, Activity, MapPin, Share2,
} from 'lucide-react';

interface ChannelSlice { channel: string; bookings: number; revenue: number; }
interface ReportData {
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
interface ReportEnvelope {
  hotel_name: string;
  days: number;
  generated_at: string;
  data: ReportData;
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

const inr = (n: number) =>
  '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string }> = ({
  icon, label, value, sub,
}) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
    <div className="flex items-center gap-2 text-slate-500 text-xs font-medium uppercase tracking-wide">
      {icon}{label}
    </div>
    <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
  </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
    <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
    {children}
  </div>
);

const PublicReport: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<ReportEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/public/report/${token}`);
        if (!alive) return;
        if (res.status === 404) { setError('This report link is invalid or has been revoked.'); return; }
        if (res.status === 410) { setError('This report link has expired.'); return; }
        if (!res.ok) { setError('Could not load this report. Please try again later.'); return; }
        setReport(await res.json());
      } catch {
        if (alive) setError('Could not load this report. Please check your connection.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const d = report?.data;
  const cityChart = useMemo(
    () => (d?.city_stats || []).slice(0, 8).map((c) => ({ name: c.city, visitors: c.visitors })),
    [d],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <Activity className="w-5 h-5 mr-2 animate-pulse" /> Loading report…
      </div>
    );
  }
  if (error || !d) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-6">
        <Share2 className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-slate-600 max-w-sm">{error || 'No data available.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{report?.hotel_name}</h1>
            <p className="text-xs text-slate-400">
              Performance report · last {report?.days} days ·
              {' '}generated {new Date(report!.generated_at).toLocaleString('en-IN')}
            </p>
          </div>
          <span className="text-xs text-slate-400">Powered by Staybooker</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* KPI row */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={<Users className="w-4 h-4" />} label="Visitors" value={d.total_visitors.toLocaleString('en-IN')} sub={`${d.conversion_rate}% converted`} />
          <KpiCard icon={<BedDouble className="w-4 h-4" />} label="Rooms Booked" value={d.rooms_booked.toLocaleString('en-IN')} sub={`${d.total_bookings} bookings`} />
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
            {d.channel_mix.length === 0 ? (
              <p className="text-sm text-slate-400 py-12 text-center">No bookings in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={d.channel_mix} dataKey="revenue" nameKey="channel" cx="50%" cy="50%" outerRadius={80} label={(e) => e.channel}>
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
              <p className="text-sm text-slate-400 py-12 text-center">No location data yet.</p>
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
            {d.device_stats.length === 0 ? (
              <p className="text-sm text-slate-400 py-12 text-center">No visitor data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={d.device_stats} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={(e) => e.type}>
                    {d.device_stats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </section>

        <footer className="flex items-center justify-center gap-1 text-xs text-slate-400 pt-2 pb-8">
          <MapPin className="w-3 h-3" /> Aggregate figures only — no guest personal data is shared.
        </footer>
      </main>
    </div>
  );
};

export default PublicReport;
