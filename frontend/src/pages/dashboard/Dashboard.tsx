// Dashboard Home Page - Real API Integration
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarX,
  CreditCard,
  Users,
  Bed,
  TrendingUp,
  Sparkles,
  Loader2,
  ExternalLink,
  MoreHorizontal
} from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/api/client';
import { DashboardStats } from '@/types/api';
import { WelcomeCard } from '@/components/dashboard/WelcomeCard';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnimatedCounter } from '@/components/ui/animated-counter';

interface RecentBooking {
  id: string;
  booking_number: string;
  guest: {
    first_name: string;
    last_name: string;
  };
  rooms: Array<{ room_type_name: string }>;
  check_in: string;
  status: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
};

export function DashboardPage() {
  const { hotel, user } = useAuth();

  // 1. Fetch Stats
  const { data: stats, isLoading: isStatsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: () => apiClient.get<DashboardStats>('/dashboard/stats'),
    staleTime: 60000, // 1 minute stale time (no spamming requests)
    refetchOnWindowFocus: true
  });

  // 2. Fetch Recent Bookings
  const { data: recentBookings = [] } = useQuery<RecentBooking[]>({
    queryKey: ['recentBookings'],
    queryFn: () => apiClient.get<RecentBooking[]>('/dashboard/recent-bookings'),
    staleTime: 60000,
    refetchOnWindowFocus: true
  });

  // 3. Fetch AI Analysis Summary
  const { data: rateAnalysis = null } = useQuery<any | null>({
    queryKey: ['competitorAnalysis'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any[]>('/competitors/analysis', { days: '1' });
        return res.length > 0 ? res[0] : null;
      } catch {
        return null;
      }
    },
    staleTime: 300000, // 5 mins
    refetchOnWindowFocus: false
  });

  const isLoading = isStatsLoading;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: "reverse"
          }}
          className="flex flex-col items-center gap-2"
        >
          <Loader2 className="h-8 w-8 text-primary" />
          <span className="text-muted-foreground font-medium">Dashboard Loading...</span>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name?.split(' ')[0] || 'User'}. Here's what's happening at {hotel?.name || 'your hotel'}.
        </p>

        {/* Welcome Message with Hover Lift */}
        <motion.div
          className="mt-4"
          whileHover={{ scale: 1.01 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <WelcomeCard message="Today is a great day to manage your hotel! 🚀" />
        </motion.div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Today's Arrivals */}
        <motion.div variants={itemVariants} whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Arrivals</CardTitle>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <CalendarCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <AnimatedCounter value={stats?.today_arrivals || 0} />
              </div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                {stats?.trends?.arrivals !== undefined && (
                  <>
                    <span className={`flex items-center mr-1 font-medium px-1.5 py-0.5 rounded-md ${
                      stats.trends.arrivals >= 0 ? 'text-green-600 bg-green-100 dark:bg-green-900/30' : 'text-red-600 bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {stats.trends.arrivals >= 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                      {Math.abs(stats.trends.arrivals)}%
                    </span>
                    <span>vs yesterday</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's Departures */}
        <motion.div variants={itemVariants} whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Departures</CardTitle>
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                <CalendarX className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <AnimatedCounter value={stats?.today_departures || 0} />
              </div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <span className="text-slate-500 flex items-center mr-1 font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                   {stats?.today_departures || 0}
                </span>
                <span>scheduled check-outs</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Occupancy Rate */}
        <motion.div variants={itemVariants} whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Occupancy</CardTitle>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <Bed className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <AnimatedCounter value={stats?.current_occupancy || 0} />
              </div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                {stats?.trends?.occupancy !== undefined && (
                   <>
                    <span className={`flex items-center mr-1 font-medium px-1.5 py-0.5 rounded-md ${
                      stats.trends.occupancy >= 0 ? 'text-green-600 bg-green-100 dark:bg-green-900/30' : 'text-red-600 bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {stats.trends.occupancy >= 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                      {Math.abs(stats.trends.occupancy)}%
                    </span>
                    <span>vs yesterday</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's Revenue */}
        <motion.div variants={itemVariants} whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }}>
          <Card className="border-green-200 dark:border-green-900 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Today's Revenue</CardTitle>
              <div className="p-2 bg-green-200 dark:bg-green-900 rounded-full">
                <CreditCard className="h-4 w-4 text-green-700 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                <AnimatedCounter
                  value={stats?.today_revenue || 0}
                  formatter={(val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)}
                />
              </div>
              <div className="flex items-center text-xs text-green-600/80 dark:text-green-400/80 mt-1">
                {stats?.trends?.revenue !== undefined && (
                  <>
                    <span className="flex items-center mr-1 font-bold">
                      {stats.trends.revenue >= 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                      {Math.abs(stats.trends.revenue)}%
                    </span>
                    <span>growth today</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">

        {/* LEFT COLUMN (Main Stats & Tables) - Spans 4/7 */}
        <div className="space-y-6 lg:col-span-4">

          {/* Market Rate Analysis - Made Wider */}
          <motion.div variants={itemVariants} whileHover={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 300 }}>
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900 overflow-hidden">
              <CardHeader className="pb-2 border-b border-blue-100 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-900/10">
                <CardTitle className="text-base font-semibold text-blue-700 dark:text-blue-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Market Rate Analysis
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50" asChild>
                    <Link to="/rate-shopper">Full Report <ExternalLink className="ml-1 h-3 w-3" /></Link>
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {rateAnalysis ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Rate</p>
                      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        ₹{rateAnalysis.my_price}
                      </div>
                      <Badge variant={
                        rateAnalysis.market_position === 'Premium' ? 'default' :
                          rateAnalysis.market_position === 'Budget' ? 'secondary' : 'outline'
                      } className="mt-1">
                        {rateAnalysis.market_position} Position
                      </Badge>
                    </div>
                    <div className="space-y-1 text-right border-l pl-4 dark:border-slate-800">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Market Avg</p>
                      <div className="text-2xl font-semibold text-slate-600 dark:text-slate-400">
                        ₹{rateAnalysis.average_market_price}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 max-w-[150px] ml-auto leading-tight">
                        {rateAnalysis.suggestion}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <div className="bg-blue-100 dark:bg-blue-900/50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200">No market data available</p>
                    <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
                      Connect to OTA channels to start tracking competitor rates automatically.
                    </p>
                    <Button size="sm" asChild>
                      <Link to="/rate-shopper">Setup Rate Shopper</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Bookings List */}
          <motion.div variants={itemVariants}>
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-md">
                    <CalendarCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Recent Bookings</CardTitle>
                    <CardDescription className="text-xs">Latest activity at your property</CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/bookings">View All</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {recentBookings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No bookings yet</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {recentBookings.map((booking, index) => (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                            {booking.guest?.first_name?.[0]}{booking.guest?.last_name?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                              {booking.guest?.first_name} {booking.guest?.last_name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>#{booking.booking_number}</span>
                              <span>•</span>
                              <span>{booking.rooms?.[0]?.room_type_name || 'Room'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${booking.status === 'confirmed'
                              ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400'
                              : booking.status === 'checked_in'
                                ? 'bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-900/20 dark:text-blue-400'
                                : 'bg-yellow-50 text-yellow-800 ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400'
                              }`}
                          >
                            {booking.status}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">
                            {booking.check_in}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

        </div>

        {/* RIGHT COLUMN (Sidebar Widgets) - Spans 3/7 */}
        <div className="space-y-6 lg:col-span-3">

          {/* Property Status */}
          <motion.div variants={itemVariants} whileHover={{ y: -2 }}>
            <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Property Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">Active</div>
                  <span className="relative flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                  <p className="text-sm text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Accepting new bookings normally.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4" asChild>
                  <Link to="/settings">Manage Availability</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pending Bookings */}
          <motion.div variants={itemVariants} whileHover={{ y: -2 }}>
            <Card className="border-l-4 border-l-yellow-400">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Action Required</CardTitle>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100">
                    Pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-bold text-slate-900 dark:text-white">
                    <AnimatedCounter value={stats?.pending_bookings || 0} />
                  </span>
                  <span className="text-sm text-muted-foreground">bookings</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Guests are waiting for your confirmation.
                </p>
                <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white" size="sm" asChild>
                  <Link to="/bookings?status=pending">Review Pending</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Actionable AI Insights Feature */}
          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-950 border border-indigo-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-indigo-400"></div>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700">
                    <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">AI Smart Insights</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                      {rateAnalysis?.suggestion ||
                        "Based on your recent activity, your pricing strategy is optimal. Connect more OTAs to get real-time market positioning insights."}
                    </p>

                    <div className="space-y-2">
                      <Button variant="outline" size="sm" className="w-full justify-start text-xs font-medium hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors" asChild>
                        <Link to="/agent" state={{ prompt: "Analyze my revenue trend for the past week and suggest improvements" }}>
                          <TrendingUp className="h-3.5 w-3.5 mr-2" />
                          Analyze Revenue Trend
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start text-xs font-medium hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors" asChild>
                        <Link to="/agent" state={{ prompt: "What is my current market positioning against competitors?" }}>
                          <Users className="h-3.5 w-3.5 mr-2" />
                          Check Market Position
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </div>
      </div>
    </motion.div>
  );
}

export default DashboardPage;
