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
  geo_stats?: { country: string; code: string; visitors: number; percentage: number; trend?: string }[];
  
  // Advanced metrics
  most_booked_rooms?: { id: string; name: string; count: number }[];
  least_booked_rooms?: { id: string; name: string; count: number }[];
  funnel_dropoffs?: { stage: string; drop_percentage: number }[];
  promo_stats?: { code: string; bookings: number }[];
  traffic_heatmap?: { weekday: number; hour: number; visitors: number }[];
  commission_saved?: number;
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
  const [activeUsers, setActiveUsers] = useState<number>(0);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard 
          title="Total Revenue" 
          value={`₹${(data.revenue_total || 0).toLocaleString()}`} 
          icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
          description="Gross earnings this period"
        />
        <StatCard 
          title="Direct Saver" 
          value={`₹${(data.commission_saved || 0).toLocaleString()}`} 
          icon={<MousePointerClick className="w-6 h-6 text-indigo-600" />}
          description="Commission saved vs OTAs"
        />
        <StatCard 
          title="Conversion" 
          value={`${data.conversion_rate || 0}%`} 
          icon={<Zap className="w-6 h-6 text-yellow-600" />}
          description="Look-to-book ratio"
        />
        <StatCard 
          title="ADR" 
          value={`₹${(data.avg_daily_rate || 0).toLocaleString()}`} 
          icon={<ArrowUpRight className="w-6 h-6 text-blue-600" />}
          description="Average Daily Rate"
        />
        <StatCard 
          title="Occupancy" 
          value={`${data.occupancy_rate || 0}%`} 
          icon={<Calendar className="w-6 h-6 text-purple-600" />}
          description="Rooms booked vs total"
        />
      </div>

      {/* Main Charts Row */}
      <div className="w-full bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
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
                  <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Performance</p>
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

      {/* ADVANCED HOTELIER KPI SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Most & Least Booked Rooms */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Room Booking Popularity</h2>
            <Layout className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-emerald-500" /> Most Booked
              </h3>
              <div className="space-y-2">
                {data.most_booked_rooms && data.most_booked_rooms.some(r => r.count > 0) ? (
                  data.most_booked_rooms.filter(r => r.count > 0).map((room) => (
                    <div key={room.id} className="p-3 bg-emerald-50/50 border border-emerald-100/50 rounded-xl flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{room.name}</span>
                      <span className="bg-emerald-500 text-white text-xs font-black px-2 py-1 rounded-lg">{room.count} stays</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No bookings recorded.</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                <ArrowDownRight className="w-4 h-4 text-red-500" /> Least Booked
              </h3>
              <div className="space-y-2">
                {data.least_booked_rooms && data.least_booked_rooms.length > 0 ? (
                  data.least_booked_rooms.map((room) => (
                    <div key={room.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-600 truncate max-w-[150px]">{room.name}</span>
                      <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-lg">{room.count} stays</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No room types configured.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Promo Code & Drop-offs Section */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Promo Code Utilization</h2>
              <MousePointerClick className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {data.promo_stats && data.promo_stats.length > 0 ? (
                data.promo_stats.map((promo) => (
                  <div key={promo.code} className="p-3 bg-indigo-50/50 border border-indigo-100/50 rounded-xl flex justify-between items-center">
                    <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200">{promo.code}</span>
                    <span className="text-xs font-bold text-indigo-900">{promo.bookings} uses</span>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                  No promo codes have been used in this period.
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Customer Funnel Drop-off Rate</h3>
            <div className="space-y-3">
              {data.funnel_dropoffs && data.funnel_dropoffs.length > 0 ? (
                data.funnel_dropoffs.map((drop) => (
                  <div key={drop.stage} className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-medium">Drop-off from {getStageLabel(drop.stage)}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${drop.drop_percentage > 50 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                      {drop.drop_percentage}%
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">Not enough conversions.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Traffic Heatmap */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Traffic Peaks Heatmap</h2>
            <p className="text-xs text-gray-500">Find the busiest hours to launch promotions</p>
          </div>
          <Clock className="w-5 h-5 text-gray-400" />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[750px] p-2 bg-slate-50 rounded-xl border border-slate-100">
            <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(24, minmax(0, 1fr))', gap: '4px' }}>
              {/* Header row for hours */}
              <div className="h-6"></div>
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="text-[9px] text-center font-bold text-slate-400 flex items-center justify-center">
                  {h}
                </div>
              ))}

              {/* Rows for weekdays */}
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, dIdx) => (
                <React.Fragment key={day}>
                  <div className="text-xs font-bold text-slate-500 flex items-center pr-2">
                    {day}
                  </div>
                  {Array.from({ length: 24 }).map((_, hIdx) => {
                    const cell = data.traffic_heatmap?.find(
                      (item) => item.weekday === dIdx && item.hour === hIdx
                    );
                    const count = cell?.visitors || 0;
                    const maxCount = Math.max(...(data.traffic_heatmap?.map(c => c.visitors) || [1]), 1);
                    const opacity = count > 0 ? 0.2 + (count / maxCount) * 0.8 : 0.05;
                    const bgColor = count > 0 ? `rgba(59, 130, 246, ${opacity})` : '#ffffff';
                    
                    return (
                      <div 
                        key={hIdx} 
                        title={`${day} @ ${hIdx}:00 -> ${count} visitors`}
                        style={{ backgroundColor: bgColor }}
                        className="h-7 rounded border border-slate-100/50 transition-all hover:scale-110 hover:shadow-sm cursor-pointer"
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ 
  title: string; 
  value: string; 
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
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
      {trend && (
        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${trendUp ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
          {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      )}
    </div>
    <div className="mt-6 relative z-10">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      <h3 className="text-3xl font-black text-slate-900 mt-1 tracking-tight">{value}</h3>
      <p className="text-xs text-slate-500 mt-2 font-medium">{description}</p>
    </div>
  </div>
);

export default AnalyticsDashboard;
