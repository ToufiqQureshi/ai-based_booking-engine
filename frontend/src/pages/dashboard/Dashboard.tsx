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
import { PageShell } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';

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
  const { data: stats, isLoading: isStatsLoading, isError: isStatsError } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: () => apiClient.get<DashboardStats>('/dashboard/stats'),
    staleTime: 1000 * 60 * 2,
  });

  // 2. Fetch Recent Bookings
  const { data: recentBookings = [] } = useQuery<RecentBooking[]>({
    queryKey: ['recentBookings'],
    queryFn: () => apiClient.get<RecentBooking[]>('/dashboard/recent-bookings'),
    staleTime: 1000 * 60 * 1, // 1 minute — bookings change more often
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

  return (
    <PageShell
      title="Dashboard"
      subtitle={`Welcome back, ${user?.name?.split(' ')[0] || 'User'}. Here's what's happening today at ${hotel?.name || 'your property'}.`}
    >
      <div className="mt-1">
        <WelcomeCard message="Have a productive day managing your hotel! 👋" />
      </div>

      {/* Stats fetch error */}
      {isStatsError && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800 dark:text-red-400 font-semibold">Could not load dashboard stats</AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-500 text-sm">
            Check your network connection and refresh the page.
          </AlertDescription>
        </Alert>
      )}

      {/* AI Configuration Alert */}
      {aiNotConfigured && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-400 font-semibold">AI Assistant Inactive</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1 text-sm">
            <span>Configure your AI settings to activate the Guest Concierge on your website.</span>
            <Button variant="outline" size="sm" className="bg-background hover:bg-amber-100 text-amber-700 border-amber-200 h-8" asChild>
              <Link to="/settings/integration">Configure Now</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Arrivals */}
        <Card className="shadow-none border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Arrivals</CardTitle>
            <CalendarCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (
              <div className="h-9 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-3xl font-bold text-foreground">
                <AnimatedCounter value={stats?.today_arrivals || 0} />
              </div>
            )}
            <div className="flex items-center text-xs mt-1">
              {stats?.trends?.arrivals !== undefined && (
                <span className={cn(
                  "font-medium mr-1",
                  stats.trends.arrivals >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {stats.trends.arrivals >= 0 ? '+' : ''}{stats.trends.arrivals}%
                </span>
              )}
              <span className="text-muted-foreground">vs yesterday</span>
            </div>
          </CardContent>
        </Card>

        {/* Departures */}
        <Card className="shadow-none border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Departures</CardTitle>
            <CalendarX className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (
              <div className="h-9 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-3xl font-bold text-foreground">
                <AnimatedCounter value={stats?.today_departures || 0} />
              </div>
            )}
            <div className="flex items-center text-xs mt-1 text-muted-foreground">
              <span>{stats?.today_departures || 0} scheduled today</span>
            </div>
          </CardContent>
        </Card>

        {/* Occupancy */}
        <Card className="shadow-none border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Occupancy</CardTitle>
            <Bed className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (
              <div className="h-9 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-3xl font-bold text-foreground">
                <AnimatedCounter value={stats?.current_occupancy || 0} />
              </div>
            )}
            <div className="flex items-center text-xs mt-1 text-muted-foreground">
              <span>{stats?.current_occupancy || 0} rooms occupied</span>
            </div>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card className="shadow-none border-border bg-blue-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (
              <div className="h-9 w-24 bg-blue-100 animate-pulse rounded" />
            ) : (
              <div className="text-3xl font-bold text-blue-700">
                <AnimatedCounter
                  value={stats?.today_revenue || 0}
                  formatter={(val) => `₹${val.toLocaleString('en-IN')}`}
                />
              </div>
            )}
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
          <Card className="shadow-none border-border">
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
                <div className="text-center py-10 text-muted-foreground italic text-sm">
                  No bookings found
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold text-xs">
                          {booking.guest?.first_name?.[0]}{booking.guest?.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {booking.guest?.first_name} {booking.guest?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            #{booking.booking_number} • {booking.rooms?.[0]?.room_type_name || 'Room'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={cn(
                          "text-[10px] uppercase px-2 py-0 h-5",
                          booking.status === 'confirmed' ? 'text-green-600 bg-green-50 border-green-100' : 
                          booking.status === 'checked_in' ? 'text-blue-600 bg-blue-50 border-blue-100' : 
                          'text-muted-foreground bg-muted/30 border-border'
                        )}>
                          {booking.status}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">
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
          <Card className="shadow-none border-border bg-muted/30">
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
                    <span className="text-xs text-muted-foreground uppercase">Your Price</span>
                    <span className="text-xl font-bold text-foreground">₹{rateAnalysis.my_price}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground uppercase">Market Avg</span>
                    <span className="text-sm font-medium text-muted-foreground">₹{rateAnalysis.average_market_price}</span>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                      "{rateAnalysis.suggestion}"
                    </p>
                  </div>
                  <Button variant="link" className="p-0 h-auto text-blue-600 text-xs font-bold uppercase" asChild>
                    <Link to="/rate-shopper">View Competitors →</Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">No market data yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Required */}
          <Card className="shadow-none border-border border-l-4 border-l-blue-600">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action Needed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-bold text-foreground">
                  <AnimatedCounter value={stats?.pending_bookings || 0} />
                </div>
                <Badge className="bg-blue-600">Pending</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Confirm bookings to secure your revenue.</p>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 h-9 text-xs font-bold" asChild>
                <Link to="/bookings?status=pending">Review All</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

export default DashboardPage;
