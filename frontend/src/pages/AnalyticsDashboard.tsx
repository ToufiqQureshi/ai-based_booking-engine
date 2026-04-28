import React, { useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { apiClient as api } from '../api/client';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, Users, Clock, MousePointerClick, 
  Smartphone, Monitor, Globe, 
  TrendingUp, TrendingDown, Layout,
  DollarSign, PieChart as PieIcon, Calendar, Download,
  Activity, ArrowUpRight, ArrowDownRight, Zap
} from 'lucide-react';

interface AnalyticsData {
  total_visitors: number;
  avg_time_spent_seconds: number;
  total_conversions: number;
  conversion_rate: number;
  device_stats: { type: string; count: number }[];
  top_rooms: { id: string; name?: string; views: number }[];
  chart_data: { date: string; visitors: number; revenue?: number; occupancy?: number }[];
  funnel_data: { stage: string; count: number }[];
  revenue_total: number;
  avg_daily_rate: number;
  rev_par: number;
  occupancy_rate: number;
  geo_stats?: { country: string; code: string; visitors: number; percentage: number; trend: string }[];
}

interface LiveEvent {
  id: string;
  type: 'booking' | 'view' | 'search' | 'checkout';
  message: string;
  timestamp: string;
  amount?: number;
}

const COLORS = ['#0ea5e9', '#6366f1', '#f59e0b', '#10b981'];

export const AnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [activeUsers, setActiveUsers] = useState(Math.floor(Math.random() * 10) + 1);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const result = await api.get<AnalyticsData>(`/analytics/dashboard?days=${days}`);
        setData(result);
      } catch (err: any) {
        console.error("Failed to load analytics", err);
        setError(err.message || "Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();

    // Real Live Feed Polling
    const fetchLiveStats = async () => {
      try {
        const [activeRes, feedRes] = await Promise.all([
          api.get<{ active_visitors: number }>('/analytics/live/active'),
          api.get<any[]>('/analytics/live/feed')
        ]);
        
        setActiveUsers(activeRes.active_visitors);
        
        // Map backend feed to frontend interface
        const mappedEvents: LiveEvent[] = feedRes.map(e => ({
          id: Math.random().toString(), // We could use timestamp+type as ID if backend doesn't provide one
          type: e.event as LiveEvent['type'],
          message: e.event === 'booking_complete' ? 'New Booking Confirmed' : 
                   e.event === 'search' ? 'Searching for rooms' : 
                   e.event === 'room_view' ? 'Viewing Room details' : 'New page visit',
          timestamp: new Date(e.time).toLocaleTimeString(),
          amount: e.metadata?.total_amount
        }));
        
        setLiveEvents(mappedEvents);
      } catch (err) {
        console.error("Live feed poll failed", err);
      }
    };

    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [days]);

  const formatTime = (seconds: number) => {
    const s = seconds || 0;
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}m ${secs}s`;
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      'page_view': 'Visits',
      'search': 'Searches',
      'room_view': 'Room Views',
      'booking_complete': 'Bookings'
    };
    return labels[stage] || stage;
  };

  if (loading) return <div className="p-8 flex justify-center items-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  if (error) return <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl m-8 border border-red-100">Error: {error}</div>;
  if (!data) return <div className="p-8 text-center text-gray-500">No data received from server.</div>;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">Real-time insights from your booking widget</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full border border-emerald-100 animate-pulse">
            <Activity className="w-4 h-4" />
            <span className="text-sm font-semibold">{activeUsers} Live Visitors</span>
          </div>
          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
            <button 
              onClick={() => setDays(7)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${days === 7 ? 'bg-blue-50 text-blue-700 border-blue-100' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              7D
            </button>
            <button 
              onClick={() => setDays(30)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${days === 30 ? 'bg-blue-50 text-blue-700 border-blue-100' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              30D
            </button>
          </div>
          <Button variant="outline" size="sm" className="gap-2 border-slate-200">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Revenue" 
          value={`₹${(data.revenue_total || 0).toLocaleString()}`} 
          icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
          trend="+18.5%"
          trendUp={true}
          description="Gross earnings this period"
        />
        <StatCard 
          title="Conversion Rate" 
          value={`${data.conversion_rate || 0}%`} 
          icon={<Zap className="w-6 h-6 text-yellow-600" />}
          trend="+2.4%"
          trendUp={true}
          description="Look-to-book ratio"
        />
        <StatCard 
          title="ADR" 
          value={`₹${(data.avg_daily_rate || 0).toLocaleString()}`} 
          icon={<ArrowUpRight className="w-6 h-6 text-blue-600" />}
          trend="+₹450"
          trendUp={true}
          description="Average Daily Rate"
        />
        <StatCard 
          title="Occupancy" 
          value={`${data.occupancy_rate || 0}%`} 
          icon={<Calendar className="w-6 h-6 text-purple-600" />}
          trend="+5%"
          trendUp={true}
          description="Rooms booked vs total"
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Visitors Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Revenue & Traffic</h2>
              <p className="text-xs text-gray-500">Performance correlation over time</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                Visitors
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Revenue
              </div>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chart_data || []}>
                <defs>
                  <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area yAxisId="left" type="monotone" dataKey="visitors" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVisitors)" />
                <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Feed Component */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4">
             <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Live Event Stream
          </h2>
          <div className="space-y-6">
            {liveEvents.length > 0 ? liveEvents.map((event) => (
              <div key={event.id} className="flex gap-4 group animate-in slide-in-from-right duration-500">
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                  event.type === 'booking' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 
                  event.type === 'search' ? 'bg-blue-400' : 'bg-slate-500'
                }`} />
                <div className="space-y-1">
                  <p className={`text-sm ${event.type === 'booking' ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                    {event.message}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    <span>{event.timestamp}</span>
                    {event.amount && <span className="bg-emerald-500/10 text-emerald-500 px-1.5 rounded">₹{event.amount}</span>}
                  </div>
                </div>
              </div>
            )) : (
              <div className="py-20 text-center text-slate-500">
                Monitoring incoming events...
              </div>
            )}
          </div>
          <div className="mt-8 pt-6 border-t border-slate-800">
            <Button variant="ghost" size="sm" className="w-full text-slate-400 hover:text-white hover:bg-slate-800 gap-2">
              View Full History <ArrowUpRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Booking Funnel */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Conversion Funnel</h2>
            <PieIcon className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-6">
            {data.funnel_data?.map((stage, idx) => {
              const totalVisits = data.funnel_data?.[0]?.count || 1;
              const percentage = Math.round((stage.count / totalVisits) * 100);
              return (
                <div key={stage.stage} className="relative group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">{getStageLabel(stage.stage)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{stage.count}</span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{percentage}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        idx === 0 ? 'bg-slate-900' : 
                        idx === 1 ? 'bg-blue-600' : 
                        idx === 2 ? 'bg-indigo-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Rooms Performance */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Best Performing Rooms</h2>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="space-y-2">
            {data.top_rooms && data.top_rooms.length > 0 ? data.top_rooms.map((room, idx) => (
              <div key={room.id} className="flex items-center justify-between p-4 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50/50 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{room.name || `Room ID: ${room.id}`}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {room.views} views
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-600">+12%</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Conversion</p>
                </div>
              </div>
            )) : (
              <div className="text-center py-12 text-gray-400">No performance data</div>
            )}
          </div>
        </div>
      </div>

      {/* Geo Location Breakdown */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Geographical Traffic</h2>
            <p className="text-xs text-gray-500">Top 5 regions by visitor volume</p>
          </div>
          <Globe className="w-5 h-5 text-blue-500" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {data?.geo_stats && data.geo_stats.length > 0 ? data.geo_stats.map((item) => (
            <div key={item.country} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:bg-blue-600 hover:border-blue-700 transition-all duration-300">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400">
                  {item.code}
                </div>
                <span className="text-sm font-bold text-slate-900 group-hover:text-white">{item.country}</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-end gap-2">
                  <span className="text-xl font-black text-slate-900 group-hover:text-white">{item.visitors}</span>
                  <span className={`text-[10px] font-bold mb-1 ${item.trend.startsWith('+') ? 'text-emerald-600 group-hover:text-emerald-300' : 'text-red-500 group-hover:text-red-300'}`}>
                    {item.trend}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1 mt-2">
                  <div className="bg-blue-600 group-hover:bg-white h-full rounded-full" style={{ width: `${item.percentage}%` }}></div>
                </div>
              </div>
            </div>
          )) : (
            <div className="col-span-full text-center py-12 text-gray-400">
              No geographical traffic data recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ 
  title: string; 
  value: string; 
  icon: React.ReactNode;
  trend: string;
  trendUp: boolean;
  description: string;
}> = ({ title, value, icon, trend, trendUp, description }) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-150 transition-transform duration-700">
      {icon}
    </div>
    <div className="flex items-start justify-between relative z-10">
      <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-slate-900 group-hover:text-white transition-colors duration-500">
        {icon}
      </div>
      <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${trendUp ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
        {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {trend}
      </div>
    </div>
    <div className="mt-6 relative z-10">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      <h3 className="text-3xl font-black text-slate-900 mt-1 tracking-tight">{value}</h3>
      <p className="text-xs text-slate-500 mt-2 font-medium">{description}</p>
    </div>
  </div>
);

export default AnalyticsDashboard;
