import React, { useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { apiClient as api } from '../api/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, Clock, MousePointerClick, 
  Globe, TrendingUp, Layout,
  DollarSign, PieChart as PieIcon, Calendar, Download,
  Activity, ArrowUpRight, ArrowDownRight, Zap, MessageCircle, Bed
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, Variants } from 'framer-motion';

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
}

interface LiveEvent {
  id: string;
  type: 'booking' | 'view' | 'search' | 'checkout';
  message: string;
  timestamp: string;
  amount?: number;
}

const COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6'];

export const AnalyticsDashboard: React.FC = () => {
  const [cachedData, setCachedData] = useState<Record<number, AnalyticsData>>({});
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [activeUsers, setActiveUsers] = useState<number>(0);

  useEffect(() => {
    const fetchAnalytics = async (daysCount: number, isSilent = false) => {
      if (cachedData[daysCount]) {
        if (!isSilent) setData(cachedData[daysCount]);
        return;
      }

      if (!isSilent) {
        if (data) setSwitching(true);
        else setLoading(true);
      }

      try {
        const result = await api.get<AnalyticsData>(`/analytics/dashboard?days=${daysCount}`);
        setCachedData(prev => ({ ...prev, [daysCount]: result }));
        if (days === daysCount) setData(result);
      } catch (err: any) {
        console.error(`Failed to load analytics for ${daysCount} days`, err);
        if (!isSilent) setError(err.message || "Failed to load analytics data.");
      } finally {
        if (!isSilent) {
          setLoading(false);
          setSwitching(false);
        }
      }
    };

    fetchAnalytics(days);

    const otherDays = days === 30 ? 7 : 30;
    if (!cachedData[otherDays]) {
      fetchAnalytics(otherDays, true);
    }

    const fetchLiveStats = async () => {
      try {
        const [activeRes, feedRes] = await Promise.all([
          api.get<{ active_visitors: number }>('/analytics/live/active'),
          api.get<any[]>('/analytics/live/feed')
        ]);
        
        setActiveUsers(activeRes.active_visitors);
        
        const mappedEvents: LiveEvent[] = feedRes.map(e => ({
          id: Math.random().toString(),
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
    const interval = setInterval(fetchLiveStats, 10000); 

    return () => clearInterval(interval);
  }, [days]);

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      'page_view': 'Visits',
      'search': 'Searches',
      'room_view': 'Room Views',
      'booking_complete': 'Bookings'
    };
    return labels[stage] || stage;
  };

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ["Metric", "Value"],
      ["Total Visitors", data.total_visitors],
      ["Total Conversions", data.total_conversions],
      ["Conversion Rate (%)", data.conversion_rate],
      ["Total Revenue (INR)", data.revenue_total],
      ["AI Assisted Revenue", data.ai_revenue],
      ["Total Leads Generated", data.total_leads],
      ["Direct Commission Saved", data.commission_saved]
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics_export_${days}d.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Analytics exported successfully");
  };

  const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  
  const itemVariant: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  if (loading) return <div className="h-screen w-full flex justify-center items-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>;
  if (error) return <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl m-8 border border-red-100 font-medium">Error: {error}</div>;
  if (!data) return <div className="p-8 text-center text-gray-500">No data received from server.</div>;

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#f8fafc]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Analytics & Reports</h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Actionable insights to drive your direct revenue and hotel performance</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-white/60 backdrop-blur-md text-emerald-700 px-4 py-2 rounded-full border border-emerald-200/50 shadow-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-bold tracking-wide">{activeUsers} Live Visitors</span>
          </div>
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setDays(7)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${days === 7 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              7 Days
            </button>
            <button 
              onClick={() => setDays(30)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${days === 30 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              30 Days
            </button>
            <button 
              onClick={() => setDays(90)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${days === 90 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              90 Days
            </button>
          </div>
          <Button variant="outline" className="gap-2 border-slate-300 shadow-sm hover:bg-slate-50 font-bold" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Export Data
          </Button>
        </div>
      </motion.div>

      {/* Hero Stats */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div variants={itemVariant}>
          <StatCard 
            title="Total Revenue" 
            value={`₹${(data.revenue_total || 0).toLocaleString()}`} 
            icon={<DollarSign className="w-6 h-6 text-white" />}
            color="bg-gradient-to-br from-emerald-400 to-emerald-600"
            description="Gross earnings this period"
            trend={`${days} days summary`}
          />
        </motion.div>
        <motion.div variants={itemVariant}>
          <StatCard 
            title="Total Bookings" 
            value={`${data.total_conversions || 0}`} 
            icon={<Calendar className="w-6 h-6 text-white" />}
            color="bg-gradient-to-br from-indigo-400 to-indigo-600"
            description="Confirmed bookings"
            trend={`From ${data.total_visitors || 0} visitors`}
          />
        </motion.div>
        <motion.div variants={itemVariant}>
          <StatCard 
            title="Conversion Rate" 
            value={`${data.conversion_rate || 0}%`} 
            icon={<Zap className="w-6 h-6 text-white" />}
            color="bg-gradient-to-br from-amber-400 to-orange-500"
            description="Look-to-book ratio"
          />
        </motion.div>
        <motion.div variants={itemVariant}>
          <StatCard 
            title="Average Daily Rate (ADR)" 
            value={`₹${(data.avg_daily_rate || 0).toLocaleString()}`} 
            icon={<TrendingUp className="w-6 h-6 text-white" />}
            color="bg-gradient-to-br from-blue-400 to-blue-600"
            description="Average income per paid occupied room"
          />
        </motion.div>
      </motion.div>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="bg-white/60 backdrop-blur-md p-1 border border-slate-200/60 shadow-sm rounded-xl inline-flex w-full overflow-x-auto justify-start md:w-auto">
          <TabsTrigger value="overview" className="rounded-lg font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white px-6">Overview</TabsTrigger>
          <TabsTrigger value="revenue" className="rounded-lg font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white px-6">Revenue & Rooms</TabsTrigger>
          <TabsTrigger value="traffic" className="rounded-lg font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white px-6">Traffic & Audience</TabsTrigger>
          <TabsTrigger value="ai" className="rounded-lg font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white px-6">AI Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 focus:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Revenue & Visitor Correlation</h2>
                  <p className="text-sm text-slate-500 font-medium">Comparing traffic vs generated direct revenue</p>
                </div>
              </div>
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chart_data || []}>
                    <defs>
                      <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                    <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                    <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={10} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                      cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area yAxisId="left" type="monotone" name="Visitors" dataKey="visitors" stroke="#8b5cf6" strokeWidth={4} fillOpacity={1} fill="url(#colorVisitors)" />
                    <Area yAxisId="right" type="monotone" name="Revenue (₹)" dataKey="revenue" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-slate-900">Direct Booking Funnel</h2>
                <Layout className="w-5 h-5 text-slate-400" />
              </div>
              <div className="space-y-6">
                {data.funnel_data?.map((stage, idx) => {
                  const totalVisits = data.funnel_data?.[0]?.count || 1;
                  const percentage = Math.round((stage.count / totalVisits) * 100);
                  return (
                    <div key={stage.stage} className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-slate-700">{getStageLabel(stage.stage)}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-extrabold text-slate-900">{stage.count}</span>
                          <span className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase w-12 text-center">{percentage}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 1, delay: idx * 0.1 }}
                          className={`h-full rounded-full ${
                            idx === 0 ? 'bg-slate-800' : 
                            idx === 1 ? 'bg-indigo-500' : 
                            idx === 2 ? 'bg-blue-500' : 'bg-emerald-500'
                          }`}
                        ></motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Dropoffs Insight */}
              {data.funnel_dropoffs && data.funnel_dropoffs.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">Critical Drop-offs</h3>
                  <div className="space-y-3">
                    {data.funnel_dropoffs.map((drop) => (
                      <div key={drop.stage} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 font-medium">After {getStageLabel(drop.stage)}</span>
                        <span className={`font-bold px-2 py-1 rounded-lg ${drop.drop_percentage > 50 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                          -{drop.drop_percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6 focus:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
               <Bed className="w-10 h-10 text-indigo-500 mb-4" />
               <p className="text-sm font-bold text-slate-500 uppercase">RevPAR</p>
               <h3 className="text-3xl font-black text-slate-900 mt-2">₹{(data.rev_par || 0).toLocaleString()}</h3>
               <p className="text-xs text-slate-400 mt-2 font-medium">Revenue Per Available Room</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
               <PieIcon className="w-10 h-10 text-emerald-500 mb-4" />
               <p className="text-sm font-bold text-slate-500 uppercase">Avg Occupancy</p>
               <h3 className="text-3xl font-black text-slate-900 mt-2">{data.occupancy_rate || 0}%</h3>
               <p className="text-xs text-slate-400 mt-2 font-medium">Rooms booked vs total</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
               <TrendingUp className="w-10 h-10 text-blue-500 mb-4" />
               <p className="text-sm font-bold text-slate-500 uppercase">OTA Commissions Saved</p>
               <h3 className="text-3xl font-black text-slate-900 mt-2">₹{(data.commission_saved || 0).toLocaleString()}</h3>
               <p className="text-xs text-emerald-500 mt-2 font-bold bg-emerald-50 px-3 py-1 rounded-full">Direct Booking Power</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
               {data.pickup_stats?.trend === 'up' ? <ArrowUpRight className="w-10 h-10 text-emerald-500 mb-4" /> : <ArrowDownRight className="w-10 h-10 text-red-500 mb-4" />}
               <p className="text-sm font-bold text-slate-500 uppercase">Daily Pace</p>
               <div className="flex items-center gap-3 mt-2">
                 <h3 className="text-3xl font-black text-slate-900">{data.pickup_stats?.today || 0}</h3>
                 <span className="text-sm text-slate-400 font-bold">vs {data.pickup_stats?.yesterday || 0}</span>
               </div>
               <p className="text-xs text-slate-400 mt-2 font-medium">Bookings today vs yesterday</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex items-center justify-between mb-6">
                 <h2 className="text-xl font-bold text-slate-900">Revenue Mix by Room Type</h2>
               </div>
               <div className="h-[300px] w-full flex items-center justify-center">
                  {data.revenue_by_room_type && data.revenue_by_room_type.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.revenue_by_room_type}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={6}
                          dataKey="value"
                          stroke="none"
                        >
                          {data.revenue_by_room_type.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => `₹${value.toLocaleString()}`}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-slate-400 font-medium">Not enough revenue data to show mix.</div>
                  )}
               </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6">
                 <h2 className="text-xl font-bold text-slate-900">7-Day Occupancy Forecast</h2>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.occupancy_forecast}>
                    <defs>
                      <linearGradient id="colorOcc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} dx={-10} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                      formatter={(value) => [`${value}%`, 'Predicted Occupancy']}
                      cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area type="monotone" dataKey="occupancy" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorOcc)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="traffic" className="space-y-6 focus:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-6">
                   <h2 className="text-xl font-bold text-slate-900">Booking Window</h2>
                   <p className="text-sm text-slate-500 font-medium">Lead time for bookings</p>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.booking_window_data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="window" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                      <Tooltip 
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="count" name="Bookings" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             </div>

             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-6">
                   <h2 className="text-xl font-bold text-slate-900">Geographical Origin</h2>
                   <Globe className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="space-y-5">
                  {data?.geo_stats && data.geo_stats.length > 0 ? data.geo_stats.map((item) => (
                    <div key={item.country} className="flex items-center justify-between">
                      <div className="flex items-center gap-4 w-1/3">
                        <div className="w-10 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                          {item.code}
                        </div>
                        <span className="text-sm font-bold text-slate-900">{item.country}</span>
                      </div>
                      <div className="w-1/2 px-4">
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${item.percentage}%` }}></div>
                        </div>
                      </div>
                      <div className="w-1/6 text-right">
                        <span className="text-sm font-black text-slate-900">{item.visitors}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-12 text-slate-400 font-medium">No geographical traffic data recorded yet.</div>
                  )}
                </div>
             </div>
          </div>
          
          {/* Traffic Heatmap */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Traffic Heatmap</h2>
                <p className="text-sm text-slate-500 font-medium">Identify the busiest hours to target promotions</p>
              </div>
              <Clock className="w-6 h-6 text-slate-400" />
            </div>
            <div className="overflow-x-auto pb-4">
              <div className="min-w-[800px]">
                <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(24, minmax(0, 1fr))', gap: '6px' }}>
                  <div className="h-6"></div>
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="text-[10px] text-center font-bold text-slate-400">
                      {h}
                    </div>
                  ))}

                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, dIdx) => (
                    <React.Fragment key={day}>
                      <div className="text-xs font-bold text-slate-600 flex items-center pr-2">
                        {day}
                      </div>
                      {Array.from({ length: 24 }).map((_, hIdx) => {
                        const cell = data.traffic_heatmap?.find(
                          (item) => item.weekday === dIdx && item.hour === hIdx
                        );
                        const count = cell?.visitors || 0;
                        const maxCount = Math.max(...(data.traffic_heatmap?.map(c => c.visitors) || [1]), 1);
                        const opacity = count > 0 ? 0.2 + (count / maxCount) * 0.8 : 0.05;
                        const bgColor = count > 0 ? `rgba(99, 102, 241, ${opacity})` : '#f8fafc';
                        
                        return (
                          <div 
                            key={hIdx}
                            title={`${day} @ ${hIdx}:00 -> ${count} visitors`}
                            style={{ backgroundColor: bgColor }}
                            className="h-8 rounded-md border border-slate-200/50 transition-all hover:scale-110 hover:shadow-md cursor-pointer"
                          />
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6 focus:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-2xl shadow-xl text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-10">
                 <Bot className="w-32 h-32 text-white" />
               </div>
               <div className="relative z-10">
                 <h2 className="text-2xl font-bold mb-2">AI Agent Efficiency</h2>
                 <p className="text-slate-300 text-sm font-medium mb-10">How your AI booking assistant is performing</p>
                 
                 <div className="mb-10 text-center bg-white/10 rounded-2xl p-6 backdrop-blur-md border border-white/20">
                    <span className="text-6xl font-black">{data.ai_resolution_rate}%</span>
                    <span className="block text-sm font-bold text-slate-300 uppercase tracking-widest mt-2">Chat to Booking Rate</span>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                     <p className="text-xs font-bold text-slate-400 uppercase">Total Leads</p>
                     <p className="text-2xl font-black mt-1">{data.total_leads || 0}</p>
                   </div>
                   <div className="p-4 bg-amber-500/20 rounded-xl border border-amber-500/30">
                     <p className="text-xs font-bold text-amber-200 uppercase">AI Bookings</p>
                     <p className="text-2xl font-black text-amber-400 mt-1">{data.ai_assisted_bookings || 0}</p>
                   </div>
                 </div>
               </div>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Top Guest Inquiries</h2>
                  <p className="text-sm text-slate-500 font-medium">What guests are asking the AI most frequently</p>
                </div>
                <MessageCircle className="w-6 h-6 text-indigo-500" />
              </div>
              
              <div className="flex-1 flex flex-wrap content-start gap-4">
                {data.popular_questions && data.popular_questions.length > 0 ? data.popular_questions.map((q, idx) => (
                  <div 
                    key={idx}
                    className="px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-900 transition-all cursor-default"
                  >
                    <span className="text-base font-bold text-slate-700">{q.text}</span>
                    <span className="text-xs font-black px-2 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg shadow-sm">
                      {q.value}
                    </span>
                  </div>
                )) : (
                  <div className="w-full flex-1 flex items-center justify-center text-slate-400 font-medium italic">
                    AI hasn't collected enough inquiries yet to form patterns.
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Bot = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
);

const StatCard: React.FC<{ 
  title: string; 
  value: string; 
  icon: React.ReactNode;
  trend?: string;
  color: string;
  description: string;
}> = ({ title, value, icon, trend, color, description }) => (
  <div className={`${color} p-6 rounded-2xl shadow-lg relative overflow-hidden group text-white h-full flex flex-col justify-between`}>
    <div className="absolute -right-6 -top-6 p-4 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 w-32 h-32">
      {icon}
    </div>
    <div className="relative z-10 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-white/80 uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-4xl font-black tracking-tight">{value}</h3>
      </div>
      <div className="mt-6 flex flex-col gap-1">
        <p className="text-sm font-medium text-white/90">{description}</p>
        {trend && <p className="text-xs font-bold text-white/70 bg-black/10 inline-table px-3 py-1.5 rounded-lg w-max mt-2">{trend}</p>}
      </div>
    </div>
  </div>
);

export default AnalyticsDashboard;
