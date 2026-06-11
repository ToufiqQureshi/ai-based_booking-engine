import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVisibilityInterval } from '@/hooks/useVisibilityInterval';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { apiClient as api } from '../api/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, Clock, MousePointerClick, 
  Globe, TrendingUp, TrendingDown, Layout,
  DollarSign, PieChart as PieIcon, Calendar, Download,
  Activity, ArrowUpRight, ArrowDownRight, Zap, MessageCircle, Bed,
  Smartphone, Monitor, Tablet, RefreshCw, AlertCircle, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface AnalyticsData {
  total_visitors: number;
  total_conversions: number;
  conversion_rate: number;
  device_stats: { type: string; count: number }[];
  chart_data: { date: string; visitors: number; revenue?: number; occupancy?: number; cancellations?: number }[];
  funnel_data: { stage: string; count: number }[];
  revenue_total: number;
  avg_daily_rate: number;
  rev_par: number;
  occupancy_rate: number;
  geo_stats?: { country: string; code: string; visitors: number; percentage: number; trend?: string }[];
  most_booked_rooms?: { id: string; name: string; count: number }[];
  least_booked_rooms?: { id: string; name: string; count: number }[];
  funnel_dropoffs?: { stage: string; drop_percentage: number }[];
  promo_stats?: { code: string; bookings: number }[];
  traffic_heatmap?: { weekday: number; hour: number; visitors: number }[];
  commission_saved?: number;
  ai_resolution_rate?: number;
  ai_revenue?: number;
  ai_assisted_bookings?: number;
  popular_questions?: { text: string; value: number }[];
  total_leads?: number;
  revenue_by_room_type?: { name: string; value: number }[];
  booking_window_data?: { window: string; count: number }[];
  occupancy_forecast?: { date: string; occupancy: number }[];
  pickup_stats?: { today: number; yesterday: number; trend: 'up' | 'down' };
  cancellations_count?: number;
  cancellation_rate?: number;
  lost_revenue?: number;
  cancellation_fees_collected?: number;
}

interface LiveEvent {
  id: string;
  type: 'booking' | 'view' | 'search' | 'checkout';
  message: string;
  timestamp: string;
  amount?: number;
}

interface AgentUsageInfo {
  label: string;
  today_tokens: number;
  daily_limit: number;
  pct_of_limit_used_today: number | null;
  messages_today: number;
  unique_users_today: number;
  estimated_conversations_today: number;
  daily_history: Record<string, number>;
}

interface AIUsageData {
  data_available: boolean;
  agents: {
    hotelier: AgentUsageInfo;
    guest: AgentUsageInfo;
    whatsapp: AgentUsageInfo;
  };
}

const CHART_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6'];

const FUNNEL_COLORS = ['#1e293b', '#4f46e5', '#0ea5e9', '#10b981'];

const formatSeconds = (s: number) => {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

const countryFlag = (code: string): string => {
  if (!code || code.length < 2) return '🌐';
  const flagChars = [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  );
  return flagChars.join('');
};

const getStageLabel = (stage: string) => {
  const labels: Record<string, string> = {
    'page_view': 'Page Visits',
    'search': 'Date Searches',
    'room_view': 'Room Views',
    'booking_complete': 'Bookings',
    'checkout': 'Checkout'
  };
  return labels[stage] || stage;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const KPICard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  accent?: string;
}> = ({ label, value, sub, icon, trend, accent = 'text-indigo-600' }) => (
  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-all duration-200">
    <div className="flex items-start justify-between">
      <div className="p-2 bg-muted border border-border rounded-xl text-muted-foreground">
        {icon}
      </div>
      {trend !== undefined && (
        <span className={`text-xs font-semibold px-2 py-1 rounded-lg flex items-center gap-1 ${
          trend.value >= 0
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {trend.value >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trend.value)}%
        </span>
      )}
    </div>
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <h3 className={`text-2xl font-black ${accent}`}>{value}</h3>
      {sub && <p className="text-xs text-muted-foreground font-medium mt-0.5">{sub}</p>}
    </div>
  </div>
);

const SectionCard: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }> = 
  ({ title, subtitle, icon, children, className = '' }) => (
  <div className={`bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-shadow duration-200 ${className}`}>
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground font-medium mt-0.5">{subtitle}</p>}
      </div>
      {icon && <div className="text-muted-foreground">{icon}</div>}
    </div>
    {children}
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
    <AlertCircle className="w-8 h-8 opacity-30" />
    <p className="text-sm font-medium">{message}</p>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white text-xs font-semibold rounded-xl px-4 py-3 shadow-xl">
        <p className="text-muted-foreground mb-2">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' && p.name?.includes('₹') ? `₹${p.value.toLocaleString()}` : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const AnalyticsDashboard: React.FC = () => {
  const [days, setDays] = useState(30);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [activeUsers, setActiveUsers] = useState<number>(0);

  const { tab: activeTab = 'overview' } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  // 1. KPI stats (always load on mount, depends on `days`)
  const {
    data: kpis,
    isLoading: isKpisLoading,
    isFetching: isKpisFetching,
    error: kpisError,
  } = useQuery<any>({
    queryKey: ['analyticsKpis', days],
    queryFn: () => api.get<any>(`/analytics/dashboard/kpis?days=${days}`),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  // 2. Tab-specific queries (lazy loaded using `enabled`)
  const { data: overviewData, isLoading: isOverviewLoading, error: overviewError } = useQuery<any>({
    queryKey: ['analyticsOverview', days],
    queryFn: () => api.get<any>(`/analytics/dashboard/overview?days=${days}`),
    enabled: activeTab === 'overview',
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  const { data: revenueData, isLoading: isRevenueLoading, error: revenueError } = useQuery<any>({
    queryKey: ['analyticsRevenue', days],
    queryFn: () => api.get<any>(`/analytics/dashboard/revenue?days=${days}`),
    enabled: activeTab === 'revenue',
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  const { data: trafficData, isLoading: isTrafficLoading, error: trafficError } = useQuery<any>({
    queryKey: ['analyticsTraffic', days],
    queryFn: () => api.get<any>(`/analytics/dashboard/traffic?days=${days}`),
    enabled: activeTab === 'traffic',
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  const { data: aiData, isLoading: isAiLoading, error: aiError } = useQuery<any>({
    queryKey: ['analyticsAi', days],
    queryFn: () => api.get<any>(`/analytics/dashboard/ai?days=${days}`),
    enabled: activeTab === 'ai',
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  const { data: cancellationsData, isLoading: isCancellationsLoading, error: cancellationsError } = useQuery<any>({
    queryKey: ['analyticsCancellations', days],
    queryFn: () => api.get<any>(`/analytics/dashboard/cancellations?days=${days}`),
    enabled: activeTab === 'cancellations',
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  // AI token usage — loads only when AI tab is active, 5-min stale (changes per conversation)
  const { data: aiUsageData } = useQuery<AIUsageData>({
    queryKey: ['agentUsage'],
    queryFn: () => api.get<AIUsageData>('/agent/usage?days=7'),
    enabled: activeTab === 'ai',
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });

  // Get active query error if any
  const error = kpisError ? (kpisError as any).message || 'Failed to load KPIs.' :
                (activeTab === 'overview' && overviewError) ? (overviewError as any).message || 'Failed to load overview.' :
                (activeTab === 'revenue' && revenueError) ? (revenueError as any).message || 'Failed to load revenue.' :
                (activeTab === 'traffic' && trafficError) ? (trafficError as any).message || 'Failed to load traffic.' :
                (activeTab === 'ai' && aiError) ? (aiError as any).message || 'Failed to load AI performance.' :
                (activeTab === 'cancellations' && cancellationsError) ? (cancellationsError as any).message || 'Failed to load cancellations.' :
                null;

  // Live stats polling — visibility-aware, pauses when tab is hidden
  const fetchLiveStats = useCallback(async () => {
    try {
      const [activeRes, feedRes] = await Promise.all([
        api.get<{ active_visitors: number }>('/analytics/live/active'),
        api.get<any[]>('/analytics/live/feed'),
      ]);
      setActiveUsers(activeRes.active_visitors);
      setLiveEvents(feedRes.map(e => ({
        id: Math.random().toString(),
        type: (e.event === 'booking_complete' ? 'booking' : e.event === 'search' ? 'search' : 'view') as LiveEvent['type'],
        message: e.event === 'booking_complete' ? '🎉 New Booking Confirmed' :
                 e.event === 'search' ? '🔍 Searching availability' :
                 e.event === 'room_view' ? '👁 Viewing room details' : '📄 New page visit',
        timestamp: new Date(e.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        amount: e.metadata ? (() => { try { return JSON.parse(e.metadata).total_amount; } catch { return undefined; } })() : undefined,
      })));
    } catch (err) {
      console.error('Live feed poll failed', err);
    }
  }, []);

  useEffect(() => { fetchLiveStats(); }, []);
  useVisibilityInterval(fetchLiveStats, 30000);

  const handleExport = () => {
    toast.promise(
      api.get<AnalyticsData>(`/analytics/dashboard?days=${days}`).then(fullData => {
        const rows = [
          ['Metric', 'Value'],
          ['Total Visitors', fullData.total_visitors],
          ['Total Bookings (Conversions)', fullData.total_conversions],
          ['Conversion Rate (%)', fullData.conversion_rate],
          ['Total Revenue (INR)', fullData.revenue_total],
          ['Avg Daily Rate (ADR)', fullData.avg_daily_rate],
          ['RevPAR', fullData.rev_par],
          ['Occupancy Rate (%)', fullData.occupancy_rate],
          ['AI Assisted Revenue', fullData.ai_revenue ?? 0],
          ['Total AI Leads', fullData.total_leads ?? 0],
          ['Commission Saved', fullData.commission_saved ?? 0],
          ['Total Cancellations', fullData.cancellations_count ?? 0],
          ['Cancellation Rate (%)', fullData.cancellation_rate ?? 0],
          ['Lost Revenue (INR)', fullData.lost_revenue ?? 0],
          ['Cancellation Fees Collected (INR)', fullData.cancellation_fees_collected ?? 0],
        ];
        const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csvContent));
        link.setAttribute('download', `analytics_${days}d.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }),
      {
        loading: 'Preparing CSV export...',
        success: 'Analytics exported successfully',
        error: 'Failed to export analytics',
      }
    );
  };

  const handleDaysChange = (d: number) => {
    setDays(d);
  };

  const TabLoading = () => (
    <div className="flex flex-col justify-center items-center py-20 gap-3">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest animate-pulse">Fetching Tab Details...</p>
    </div>
  );

  const deviceData = useMemo(() => {
    return (overviewData?.device_stats || []).map((d: any) => ({
      ...d,
      name: d.type.charAt(0).toUpperCase() + d.type.slice(1)
    }));
  }, [overviewData]);

  if (isKpisLoading) return (
    <div className="h-screen w-full flex flex-col justify-center items-center gap-4">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-medium text-muted-foreground">Loading dashboard…</p>
    </div>
  );

  if (error && !kpis) return (
    <div className="m-8 p-6 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-4">
      <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
      <div>
        <p className="font-bold text-red-700">Failed to load analytics</p>
        <p className="text-sm text-red-500 mt-1">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Analytics & Reports</h1>
            <p className="text-sm text-muted-foreground font-medium mt-0.5">
              Performance data for the last <span className="text-indigo-600 font-bold">{days} days</span>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Live badge */}
            <div className="flex items-center gap-2 bg-background border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {activeUsers} Live
            </div>

            {/* Day filter */}
            <div className="flex items-center gap-0.5 bg-muted border border-border rounded-xl p-0.5">
              {[7, 30, 90].map(d => (
                <button
                  key={d}
                  onClick={() => handleDaysChange(d)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    days === d
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>

            {/* Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-background border border-border text-foreground rounded-xl text-xs font-bold hover:bg-muted shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </motion.div>

        {/* ── KPI Bar ───────────────────────────────────────────────────── */}
        {isKpisFetching ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-muted border border-border rounded-2xl p-5 h-28 animate-pulse" />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ staggerChildren: 0.08 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          >
            <KPICard
              label="Total Revenue"
              value={`₹${(kpis?.revenue_total || 0).toLocaleString('en-IN')}`}
              sub={`ADR: ₹${(kpis?.avg_daily_rate || 0).toLocaleString('en-IN')}`}
              icon={<DollarSign className="w-4 h-4" />}
              accent="text-indigo-700"
            />
            <KPICard
              label="Total Bookings"
              value={`${kpis?.total_conversions || 0}`}
              sub={`From ${kpis?.total_visitors || 0} visitors`}
              icon={<Calendar className="w-4 h-4" />}
              accent="text-foreground"
            />
            <KPICard
              label="Conversion Rate"
              value={`${kpis?.conversion_rate || 0}%`}
              sub="Look-to-book ratio"
              icon={<Zap className="w-4 h-4" />}
              accent={kpis?.conversion_rate > 2 ? 'text-emerald-600' : 'text-amber-600'}
            />
            <KPICard
              label="Occupancy Rate"
              value={`${kpis?.occupancy_rate || 0}%`}
              sub={`RevPAR: ₹${(kpis?.rev_par || 0).toLocaleString('en-IN')}`}
              icon={<Bed className="w-4 h-4" />}
              accent="text-foreground"
            />
          </motion.div>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={(val) => navigate(`/analytics/${val}`)} className="space-y-6">
          <TabsList className="bg-muted border border-border p-0.5 rounded-xl inline-flex gap-0.5">
            {[
              { value: 'overview', label: 'Overview' },
              { value: 'revenue', label: 'Revenue & Rooms' },
              { value: 'traffic', label: 'Traffic' },
              { value: 'ai', label: 'AI Performance' },
              { value: 'cancellations', label: 'Cancellations' },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="px-5 py-2 text-xs font-bold rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-muted-foreground transition-all"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4 focus:outline-none">
            {isOverviewLoading || !overviewData ? (
              <TabLoading />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                
                {/* Revenue + Visitor Chart */}
                <SectionCard
                  title="Revenue & Visitor Trend"
                  subtitle="Daily traffic vs direct revenue"
                  className="xl:col-span-2"
                >
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={overviewData.chart_data || []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gVisitors" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                        <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dx={-4} />
                        <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dx={4} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Area yAxisId="left" type="monotone" name="Visitors" dataKey="visitors" stroke="#6366f1" strokeWidth={2.5} fill="url(#gVisitors)" dot={false} />
                        <Area yAxisId="right" type="monotone" name="Revenue (₹)" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#gRevenue)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <span className="w-3 h-0.5 rounded-full bg-indigo-500 inline-block" /> Visitors
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <span className="w-3 h-0.5 rounded-full bg-emerald-500 inline-block" /> Revenue
                    </div>
                  </div>
                </SectionCard>

                {/* Booking Funnel */}
                <SectionCard title="Booking Funnel" subtitle="Direct booking conversion path" icon={<Layout className="w-4 h-4" />}>
                  {overviewData.funnel_data && overviewData.funnel_data.length > 0 ? (
                    <div className="space-y-5">
                      {overviewData.funnel_data.map((stage: any, idx: number) => {
                        const top = overviewData.funnel_data?.[0]?.count || 1;
                        const pct = Math.round((stage.count / top) * 100);
                        return (
                          <div key={stage.stage}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-muted-foreground">{getStageLabel(stage.stage)}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-foreground">{stage.count.toLocaleString()}</span>
                                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{pct}%</span>
                              </div>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, delay: idx * 0.1 }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: FUNNEL_COLORS[idx] }}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {overviewData.funnel_dropoffs && overviewData.funnel_dropoffs.length > 0 && (
                        <div className="pt-4 border-t border-border">
                          <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest mb-3">Drop-off Points</p>
                          <div className="space-y-2">
                            {overviewData.funnel_dropoffs.map((d: any) => (
                              <div key={d.stage} className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground font-medium">After {getStageLabel(d.stage)}</span>
                                <span className={`font-bold px-2 py-0.5 rounded-lg ${d.drop_percentage > 50 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                  -{d.drop_percentage}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : <EmptyState message="No funnel data available yet." />}
                </SectionCard>
              </div>
            )}

            {/* Live Feed + Devices side by side */}
            {!(isOverviewLoading || !overviewData) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">

                {/* Live Activity Feed */}
                <SectionCard title="Live Activity Feed" subtitle="Real-time visitor events on your site" icon={<Activity className="w-4 h-4" />}>
                  {liveEvents.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {liveEvents.map((ev) => (
                        <motion.div
                          key={ev.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between py-2.5 py-3 bg-muted rounded-xl border border-border text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              ev.type === 'booking' ? 'bg-emerald-500' :
                              ev.type === 'search' ? 'bg-blue-500' : 'bg-slate-400'
                            }`} />
                            <span className="font-semibold text-foreground">{ev.message}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {ev.amount && <span className="font-black text-emerald-600">₹{ev.amount.toLocaleString()}</span>}
                            <span className="text-muted-foreground font-medium">{ev.timestamp}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No live events in the last few minutes." />
                  )}
                </SectionCard>

                {/* Device Breakdown */}
                <SectionCard title="Device Breakdown" subtitle="What devices your visitors use" icon={<Monitor className="w-4 h-4" />}>
                  {deviceData.length > 0 ? (
                    <div className="flex items-center gap-6">
                      <div className="w-36 h-36 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={deviceData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} stroke="none">
                              {deviceData.map((_, idx) => (
                                <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number, n: string) => [v, n]} contentStyle={{ borderRadius: '12px', fontSize: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-3 flex-1">
                        {deviceData.map((d: any, idx: number) => {
                          const total = deviceData.reduce((a, b) => a + b.count, 0) || 1;
                          const pct = Math.round((d.count / total) * 100);
                          const DevIcon = d.type === 'mobile' ? Smartphone : d.type === 'tablet' ? Tablet : Monitor;
                          return (
                            <div key={d.type} className="flex items-center gap-3">
                              <DevIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                  <span className="text-xs font-bold text-muted-foreground">{d.name}</span>
                                  <span className="text-xs font-black text-foreground">{pct}%</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-1.5">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : <EmptyState message="No device data recorded yet." />}
                </SectionCard>
              </div>
            )}
          </TabsContent>

          {/* ── REVENUE & ROOMS TAB ───────────────────────────────────── */}
          <TabsContent value="revenue" className="space-y-4 focus:outline-none">
            {isRevenueLoading || !revenueData ? (
              <TabLoading />
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard label="RevPAR" value={`₹${(revenueData.rev_par || 0).toLocaleString('en-IN')}`} sub="Revenue per available room" icon={<Bed className="w-4 h-4" />} />
                  <KPICard label="Avg Occupancy" value={`${revenueData.occupancy_rate || 0}%`} sub="Rooms booked vs total capacity" icon={<PieIcon className="w-4 h-4" />} accent={revenueData.occupancy_rate > 60 ? 'text-emerald-600' : 'text-amber-600'} />
                  <KPICard label="Commission Saved" value={`₹${(revenueData.commission_saved || 0).toLocaleString('en-IN')}`} sub="vs 15% OTA commission" icon={<TrendingUp className="w-4 h-4" />} accent="text-emerald-600" />
                  <KPICard
                    label="Daily Pace"
                    value={`${revenueData.pickup_stats?.today || 0} bookings`}
                    sub={`Yesterday: ${revenueData.pickup_stats?.yesterday || 0}`}
                    icon={revenueData.pickup_stats?.trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    accent={revenueData.pickup_stats?.trend === 'up' ? 'text-emerald-600' : 'text-red-500'}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Revenue by Room Type */}
                  <SectionCard title="Revenue Mix by Room Type" subtitle="Which room types are earning most" icon={<PieIcon className="w-4 h-4" />}>
                    <div className="h-64 w-full flex items-center justify-center">
                      {revenueData.revenue_by_room_type && revenueData.revenue_by_room_type.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={revenueData.revenue_by_room_type} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={4} dataKey="value" stroke="none">
                              {revenueData.revenue_by_room_type.map((_: any, idx: number) => (
                                <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : <EmptyState message="Not enough booking data to show revenue mix." />}
                    </div>
                  </SectionCard>

                  {/* 7-Day Occupancy Forecast */}
                  <SectionCard title="7-Day Occupancy Forecast" subtitle="Predicted occupancy for upcoming week" icon={<Calendar className="w-4 h-4" />}>
                    <div className="h-64 w-full">
                      {revenueData.occupancy_forecast && revenueData.occupancy_forecast.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={revenueData.occupancy_forecast} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="gOcc" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} dx={-4} domain={[0, 100]} />
                            <Tooltip formatter={(v: any) => [`${v}%`, 'Predicted Occupancy']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px' }} cursor={{ stroke: '#e2e8f0', strokeWidth: 1, strokeDasharray: '4 4' }} />
                            <Area type="monotone" dataKey="occupancy" stroke="#6366f1" strokeWidth={2.5} fill="url(#gOcc)" dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : <EmptyState message="No forecast data available." />}
                    </div>
                  </SectionCard>
                </div>

                {/* Most & Least Booked Rooms */}
                {(revenueData.most_booked_rooms?.length || 0) > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <SectionCard title="Most Booked Rooms" subtitle="Top performing room types this period" icon={<TrendingUp className="w-4 h-4" />}>
                      <div className="space-y-3">
                        {revenueData.most_booked_rooms?.slice(0, 5).map((r: any, idx: number) => (
                          <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black text-slate-300 w-4">#{idx + 1}</span>
                              <span className="text-sm font-semibold text-foreground">{r.name || 'Room'}</span>
                            </div>
                            <span className="text-sm font-black text-indigo-600">{r.count} bookings</span>
                          </div>
                        ))}
                      </div>
                    </SectionCard>

                    {revenueData.promo_stats && revenueData.promo_stats.length > 0 && (
                      <SectionCard title="Promo Code Performance" subtitle="Which coupon codes are being used" icon={<Zap className="w-4 h-4" />}>
                        <div className="space-y-3">
                          {revenueData.promo_stats.map((p: any) => (
                            <div key={p.code} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                              <span className="text-sm font-bold text-foreground font-mono bg-muted px-2 py-0.5 rounded-md">{p.code}</span>
                              <span className="text-sm font-black text-indigo-600">{p.bookings} used</span>
                            </div>
                          ))}
                        </div>
                      </SectionCard>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── TRAFFIC TAB ───────────────────────────────────────────── */}
          <TabsContent value="traffic" className="space-y-4 focus:outline-none">
            {isTrafficLoading || !trafficData ? (
              <TabLoading />
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Booking Window */}
                  <SectionCard title="Booking Lead Time" subtitle="How far in advance guests book" icon={<Clock className="w-4 h-4" />}>
                    <div className="h-64 w-full">
                      {trafficData.booking_window_data && trafficData.booking_window_data.some((b: any) => b.count > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={trafficData.booking_window_data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="window" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dx={-4} />
                            <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                            <Bar dataKey="count" name="Bookings" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={56} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <EmptyState message="No booking window data yet. Needs at least a few bookings." />}
                    </div>
                  </SectionCard>

                  {/* Geo Stats */}
                  <SectionCard title="Visitor Origins" subtitle="Where your guests are coming from" icon={<Globe className="w-4 h-4" />}>
                    {trafficData.geo_stats && trafficData.geo_stats.length > 0 ? (
                      <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                        {trafficData.geo_stats.map((item: any) => (
                          <div key={item.country} className="flex items-center gap-3">
                            <span className="text-xl leading-none w-8 text-center shrink-0">{countryFlag(item.code)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between mb-1.5">
                                <span className="text-xs font-bold text-foreground truncate">{item.country}</span>
                                <span className="text-xs font-black text-foreground ml-2 shrink-0">{item.visitors}</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${item.percentage}%` }} />
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground w-8 text-right shrink-0">{item.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    ) : <EmptyState message="No geographic data recorded yet. Needs real visitor traffic." />}
                  </SectionCard>
                </div>

                {/* Traffic Heatmap */}
                <SectionCard
                  title="Traffic Heatmap"
                  subtitle={`Aggregated visitor traffic by weekday & hour — last ${days} days (hover a cell for exact count)`}
                  icon={<Clock className="w-4 h-4" />}
                >
                  <div className="overflow-x-auto">
                    <div className="min-w-[700px]">
                      {/* Hour labels with AM/PM markers */}
                      <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(24, minmax(0, 1fr))', gap: '3px' }}>
                        <div className="text-[9px] font-bold text-muted-foreground flex items-end pb-1">Day</div>
                        {Array.from({ length: 24 }).map((_, h) => (
                          <div key={h} className="text-[9px] text-center font-bold text-muted-foreground pb-1">
                            {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                          </div>
                        ))}
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dIdx) => {
                          const maxVal = Math.max(...(trafficData.traffic_heatmap?.map((c: any) => c.visitors) || [1]), 1);
                          return (
                            <React.Fragment key={day}>
                              <div className="text-[10px] font-bold text-muted-foreground flex items-center">{day}</div>
                              {Array.from({ length: 24 }).map((_, hIdx) => {
                                const cell = trafficData.traffic_heatmap?.find((i: any) => i.weekday === dIdx && i.hour === hIdx);
                                const count = cell?.visitors || 0;
                                const intensity = count > 0 ? 0.15 + (count / maxVal) * 0.85 : 0;
                                const hourLabel = hIdx === 0 ? '12 AM' : hIdx < 12 ? `${hIdx} AM` : hIdx === 12 ? '12 PM' : `${hIdx - 12} PM`;
                                return (
                                  <div
                                    key={hIdx}
                                    title={`${day} ${hourLabel} — ${count} visitor${count !== 1 ? 's' : ''}`}
                                    style={{
                                      backgroundColor: count > 0 ? `rgba(99, 102, 241, ${intensity})` : 'hsl(var(--muted))',
                                      border: '1px solid hsl(var(--border))'
                                    }}
                                    className="h-7 rounded-md cursor-pointer hover:scale-110 hover:shadow-md transition-transform"
                                  />
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {/* Legend + note */}
                      <div className="flex items-center justify-between mt-4 gap-4 flex-wrap">
                        <p className="text-[10px] text-muted-foreground italic">
                          Each cell = total visitors for that weekday & hour, combined across the last {days} days
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted-foreground font-medium">Low</span>
                          {[0.15, 0.35, 0.55, 0.75, 1].map(v => (
                            <div key={v} className="w-5 h-3 rounded-sm" style={{ backgroundColor: `rgba(99, 102, 241, ${v})` }} />
                          ))}
                          <span className="text-[10px] text-muted-foreground font-medium">High</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </>
            )}
          </TabsContent>

          {/* ── AI PERFORMANCE TAB ────────────────────────────────────── */}
          <TabsContent value="ai" className="space-y-4 focus:outline-none">
            {isAiLoading || !aiData ? (
              <TabLoading />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* AI Metrics */}
                <div className="space-y-4">
                  <div className="bg-slate-900 rounded-2xl p-6 text-white">
                    <div className="flex items-center gap-2 mb-4">
                      <BotIcon className="w-5 h-5 text-indigo-400" />
                      <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">AI Agent</h2>
                    </div>
                    <div className="text-center py-4">
                      <span className="text-5xl font-black text-white">{aiData.ai_resolution_rate ?? 0}%</span>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-2">Chat → Booking Rate</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-background/5 rounded-xl p-3 border border-white/10">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Leads</p>
                        <p className="text-xl font-black text-white mt-1">{aiData.total_leads || 0}</p>
                      </div>
                      <div className="bg-indigo-600/30 rounded-xl p-3 border border-indigo-500/30">
                        <p className="text-[10px] font-bold text-indigo-300 uppercase">AI Bookings</p>
                        <p className="text-xl font-black text-indigo-400 mt-1">{aiData.ai_assisted_bookings || 0}</p>
                      </div>
                      <div className="bg-emerald-600/20 rounded-xl p-3 border border-emerald-500/20 col-span-2">
                        <p className="text-[10px] font-bold text-emerald-300 uppercase">AI Revenue Generated</p>
                        <p className="text-xl font-black text-emerald-400 mt-1">₹{(aiData.ai_revenue || 0).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Most Enquired Rooms */}
                <SectionCard
                  title="Most Enquired Rooms"
                  subtitle="Which rooms guests ask the AI about most"
                  icon={<Bed className="w-4 h-4" />}
                  className="lg:col-span-2"
                >
                  {aiData.popular_questions && aiData.popular_questions.length > 0 ? (
                    <div className="space-y-3">
                      {aiData.popular_questions.map((q: any, idx: number) => {
                        const max = aiData.popular_questions?.[0]?.value || 1;
                        const pct = Math.round((q.value / max) * 100);
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-300 w-4 shrink-0">#{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between mb-1">
                                <span className="text-xs font-bold text-foreground truncate pr-2">{q.text}</span>
                                <span className="text-xs font-black text-indigo-600 shrink-0">{q.value} leads</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState message="No AI leads yet. Enquiries appear here when guests chat via AI Concierge." />
                  )}
                </SectionCard>
              </div>
            )}

            {/* AI Agent Token Usage — only shown when AI data + Redis both available */}
            {!isAiLoading && aiData && aiUsageData?.data_available && (
                <SectionCard
                  title="AI Agent Usage Today"
                  subtitle="Token budget per guest-facing agent — resets midnight UTC · ~800 tokens = 1 conversation"
                  icon={<MessageCircle className="w-4 h-4" />}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {([
                      { key: 'guest' as const, color: '#10b981' },
                      { key: 'whatsapp' as const, color: '#f59e0b' },
                    ] as const).map(({ key, color }) => {
                      const info = aiUsageData.agents[key];
                      const pct = info.pct_of_limit_used_today ?? 0;
                      const remaining = Math.max(0, info.daily_limit - info.today_tokens);
                      const barColor = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#10b981';
                      const badgeCls = pct > 90
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : pct > 70
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
                      const chartData = Object.entries(info.daily_history)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([date, tokens]) => ({ day: date.slice(5), tokens }));
                      return (
                        <div key={key} className="bg-muted/30 rounded-2xl border border-border p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-sm font-bold text-foreground">{info.label}</span>
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${badgeCls}`}>
                              {pct}% used
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div>
                            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                              <span>{info.today_tokens.toLocaleString()} tokens used</span>
                              <span>{remaining.toLocaleString()} remaining</span>
                            </div>
                            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
                              />
                            </div>
                          </div>

                          {/* Real interaction counts today */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-background rounded-xl p-3 border border-border text-center">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Guests Today</p>
                              <p className="text-2xl font-black text-foreground mt-1">{info.unique_users_today}</p>
                            </div>
                            <div className="bg-background rounded-xl p-3 border border-border text-center">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Messages</p>
                              <p className="text-2xl font-black text-foreground mt-1">{info.messages_today}</p>
                            </div>
                            <div className="bg-background rounded-xl p-3 border border-border text-center">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Limit</p>
                              <p className="text-2xl font-black text-foreground mt-1">{(info.daily_limit / 1000).toFixed(0)}k</p>
                              <p className="text-[10px] text-muted-foreground">tokens</p>
                            </div>
                          </div>

                          {/* 7-day sparkline */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Last 7 days</p>
                            <ResponsiveContainer width="100%" height={56}>
                              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <XAxis dataKey="day" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                  formatter={(v: number) => [v.toLocaleString(), 'tokens']}
                                  contentStyle={{ borderRadius: '8px', fontSize: 11, border: 'none' }}
                                />
                                <Bar dataKey="tokens" fill={color} radius={[2, 2, 0, 0]} opacity={0.85} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
            )}
          </TabsContent>

          {/* ── CANCELLATIONS TAB ────────────────────────────────────── */}
          <TabsContent value="cancellations" className="space-y-4 focus:outline-none">
            {isCancellationsLoading || !cancellationsData ? (
              <TabLoading />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard
                    label="Total Cancellations"
                    value={`${cancellationsData.cancellations_count || 0}`}
                    sub="Cancelled reservations"
                    icon={<XCircle className="w-4 h-4 text-red-500" />}
                    accent="text-red-600"
                  />
                  <KPICard
                    label="Cancellation Rate"
                    value={`${cancellationsData.cancellation_rate || 0}%`}
                    sub="Of total bookings this period"
                    icon={<AlertCircle className="w-4 h-4 text-amber-500" />}
                    accent={cancellationsData.cancellation_rate && cancellationsData.cancellation_rate > 15 ? 'text-red-500' : 'text-amber-500'}
                  />
                  <KPICard
                    label="Lost Revenue"
                    value={`₹${(cancellationsData.lost_revenue || 0).toLocaleString('en-IN')}`}
                    sub="From cancelled stays"
                    icon={<TrendingDown className="w-4 h-4 text-red-500" />}
                    accent="text-red-600"
                  />
                  <KPICard
                    label="Cancellation Fees Retained"
                    value={`₹${(cancellationsData.cancellation_fees_collected || 0).toLocaleString('en-IN')}`}
                    sub="Late cancellation penalties"
                    icon={<DollarSign className="w-4 h-4 text-emerald-500" />}
                    accent="text-emerald-600"
                  />
                </div>

                {/* Cancellation Trend Chart */}
                {cancellationsData.chart_data && cancellationsData.chart_data.some((d: any) => (d.cancellations || 0) > 0) && (
                  <SectionCard title="Cancellation Trend" subtitle={`Daily cancellations over the last ${days} days`} icon={<XCircle className="w-4 h-4 text-red-400" />}>
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cancellationsData.chart_data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dx={-4} allowDecimals={false} />
                          <Tooltip
                            cursor={{ fill: 'hsl(var(--muted))' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                          />
                          <Bar dataKey="cancellations" name="Cancellations" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </SectionCard>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <SectionCard title="Reduce Cancellations" subtitle="Recommended actions based on your current rate" icon={<Zap className="w-4 h-4 text-indigo-500" />}>
                    <div className="space-y-3">
                      <div className={`p-4 rounded-xl border ${(cancellationsData.cancellation_rate || 0) > 15 ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800' : 'bg-muted/40 border-border'}`}>
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">1. Promote Non-Refundable Rates</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Your cancellation rate is <strong className={(cancellationsData.cancellation_rate || 0) > 15 ? 'text-red-600' : 'text-amber-600'}>{cancellationsData.cancellation_rate || 0}%</strong>
                          {(cancellationsData.cancellation_rate || 0) > 15 ? ' — above healthy threshold of 15%.' : '.'} Offering a 5–10% discount on non-refundable rates can lock in revenue early.
                        </p>
                      </div>
                      <div className="p-4 bg-muted/40 rounded-xl border border-border">
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">2. Tighten Cancellation Window</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Shift your standard free-cancellation window from 24 hours to 48–72 hours before arrival. This gives more time to resell rooms and reduces last-minute revenue loss.
                        </p>
                      </div>
                      <div className="p-4 bg-muted/40 rounded-xl border border-border">
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">3. Require Advance Deposit</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          For weekend and peak bookings, collect a token advance during booking to reduce speculative holds and no-shows.
                        </p>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="Revenue Impact Summary" subtitle="Cancellation financial breakdown" icon={<DollarSign className="w-4 h-4 text-emerald-500" />}>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-3 border-b border-dashed border-border">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Gross Lost Revenue</p>
                          <p className="text-xs text-muted-foreground">Total value of all cancelled bookings</p>
                        </div>
                        <span className="font-black text-red-600 text-base">₹{(cancellationsData.lost_revenue || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-dashed border-border">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Fees Retained</p>
                          <p className="text-xs text-muted-foreground">Late cancellation penalties collected</p>
                        </div>
                        <span className="font-black text-emerald-600 text-base">₹{(cancellationsData.cancellation_fees_collected || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between items-center py-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Net Lost Revenue</p>
                          <p className="text-xs text-muted-foreground">After deducting fees retained</p>
                        </div>
                        <span className="font-black text-slate-700 dark:text-slate-300 text-base">
                          ₹{Math.max(0, (cancellationsData.lost_revenue || 0) - (cancellationsData.cancellation_fees_collected || 0)).toLocaleString('en-IN')}
                        </span>
                      </div>
                      {(cancellationsData.cancellation_rate || 0) > 15 && (
                        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl">
                          <p className="text-xs font-bold text-red-700 dark:text-red-400">
                            ⚠ High cancellation rate detected. Implementing non-refundable rates could recover up to ₹{Math.round((cancellationsData.lost_revenue || 0) * 0.4).toLocaleString('en-IN')} in revenue.
                          </p>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Inline SVG Bot icon
const BotIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/>
    <path d="M2 14h2"/><path d="M20 14h2"/>
    <path d="M15 13v2"/><path d="M9 13v2"/>
  </svg>
);

export default AnalyticsDashboard;
