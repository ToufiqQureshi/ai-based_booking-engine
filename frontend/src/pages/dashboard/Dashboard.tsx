// Dashboard Home Page - Clean & Professional Design
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarX,
  CreditCard,
  Users,
  Bed,
  TrendingUp,
  Loader2,
  ExternalLink,
  MoreHorizontal,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

export function DashboardPage() {
  const { hotel, user } = useAuth();

  // 1. Fetch Stats
  const { data: stats, isLoading: isStatsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: () => apiClient.get<DashboardStats>('/dashboard/stats'),
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  // 2. Fetch Recent Bookings
  const { data: recentBookings = [] } = useQuery<RecentBooking[]>({
    queryKey: ['recentBookings'],
    queryFn: () => apiClient.get<RecentBooking[]>('/dashboard/recent-bookings'),
    staleTime: 60000,
    refetchOnWindowFocus: false
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
    staleTime: 300000,
    refetchOnWindowFocus: false
  });
  
  // 4. Fetch Integration Settings
  const { data: integration } = useQuery<any>({
    queryKey: ['integrationSettings'],
    queryFn: () => apiClient.get<any>('/integration/settings'),
    staleTime: 600000,
    refetchOnWindowFocus: false
  });

  const aiNotConfigured = !integration?.ai_api_key || !integration?.ai_model;

  if (isStatsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          <span className="text-slate-500 font-medium text-sm">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Welcome back, {user?.name?.split(' ')[0] || 'User'}. Here's what's happening today at {hotel?.name || 'your property'}.
        </p>

        <div className="mt-4">
          <WelcomeCard message="Have a productive day managing your hotel! 👋" />
        </div>

        {/* AI Configuration Alert */}
        {aiNotConfigured && (
          <Alert className="mt-4 border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 font-semibold">AI Assistant Inactive</AlertTitle>
            <AlertDescription className="text-amber-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1 text-sm">
              <span>Configure your AI settings to activate the Guest Concierge on your website.</span>
              <Button variant="outline" size="sm" className="bg-white hover:bg-amber-100 text-amber-700 border-amber-200 h-8" asChild>
                <Link to="/settings/integration">Configure Now</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Arrivals */}
        <Card className="shadow-none border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Arrivals</CardTitle>
            <CalendarCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              <AnimatedCounter value={stats?.today_arrivals || 0} />
            </div>
            <div className="flex items-center text-xs mt-1">
              {stats?.trends?.arrivals !== undefined && (
                <span className={cn(
                  "font-medium mr-1",
                  stats.trends.arrivals >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {stats.trends.arrivals >= 0 ? '+' : ''}{stats.trends.arrivals}%
                </span>
              )}
              <span className="text-slate-400">vs yesterday</span>
            </div>
          </CardContent>
        </Card>

        {/* Departures */}
        <Card className="shadow-none border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Departures</CardTitle>
            <CalendarX className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              <AnimatedCounter value={stats?.today_departures || 0} />
            </div>
            <div className="flex items-center text-xs mt-1 text-slate-400">
              <span>{stats?.today_departures || 0} scheduled today</span>
            </div>
          </CardContent>
        </Card>

        {/* Occupancy */}
        <Card className="shadow-none border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Occupancy</CardTitle>
            <Bed className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              <AnimatedCounter value={stats?.current_occupancy || 0} />
            </div>
            <div className="flex items-center text-xs mt-1 text-slate-400">
              <span>{stats?.current_occupancy || 0} rooms occupied</span>
            </div>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card className="shadow-none border-slate-200 bg-blue-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">
              <AnimatedCounter
                value={stats?.today_revenue || 0}
                formatter={(val) => `₹${val.toLocaleString('en-IN')}`}
              />
            </div>
            <div className="flex items-center text-xs mt-1 text-blue-600/70">
              <span>Today's total earnings</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Bookings */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-none border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
              <div>
                <CardTitle className="text-base font-bold">Recent Bookings</CardTitle>
                <CardDescription className="text-xs">Latest guest activity</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild className="h-8">
                <Link to="/bookings">View All</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {recentBookings.length === 0 ? (
                <div className="text-center py-10 text-slate-400 italic text-sm">
                  No bookings found
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-semibold text-xs">
                          {booking.guest?.first_name?.[0]}{booking.guest?.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {booking.guest?.first_name} {booking.guest?.last_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            #{booking.booking_number} • {booking.rooms?.[0]?.room_type_name || 'Room'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={cn(
                          "text-[10px] uppercase px-2 py-0 h-5",
                          booking.status === 'confirmed' ? 'text-green-600 bg-green-50 border-green-100' : 
                          booking.status === 'checked_in' ? 'text-blue-600 bg-blue-50 border-blue-100' : 
                          'text-slate-500 bg-slate-50 border-slate-100'
                        )}>
                          {booking.status}
                        </Badge>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {booking.check_in}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Rate Analysis */}
          <Card className="shadow-none border-slate-200 bg-slate-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Market Insight
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rateAnalysis ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 uppercase">Your Price</span>
                    <span className="text-xl font-bold text-slate-900">₹{rateAnalysis.my_price}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 uppercase">Market Avg</span>
                    <span className="text-sm font-medium text-slate-600">₹{rateAnalysis.average_market_price}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "{rateAnalysis.suggestion}"
                    </p>
                  </div>
                  <Button variant="link" className="p-0 h-auto text-blue-600 text-xs font-bold uppercase" asChild>
                    <Link to="/rate-shopper">View Competitors →</Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-slate-500">No market data yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Required */}
          <Card className="shadow-none border-slate-200 border-l-4 border-l-blue-600">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Action Needed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-bold text-slate-900">
                  <AnimatedCounter value={stats?.pending_bookings || 0} />
                </div>
                <Badge className="bg-blue-600">Pending</Badge>
              </div>
              <p className="text-xs text-slate-500 mb-4">Confirm bookings to secure your revenue.</p>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 h-9 text-xs font-bold" asChild>
                <Link to="/bookings?status=pending">Review All</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
