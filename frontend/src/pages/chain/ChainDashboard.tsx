import React from 'react';
import {
  Building2,
  IndianRupee,
  TrendingUp,
  BookOpen,
  Loader2,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Activity,
  Layers,
  ArrowLeftRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { PageShell } from '@/components/layout/PageShell';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { apiClient } from '@/api/client';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  Cell
} from 'recharts';

interface HotelRevenueItem {
  hotel_id: string;
  name: string;
  slug: string;
  revenue: number;
  bookings_count: number;
  occupancy_rate: number;
}

interface RecentBookingItem {
  id: string;
  hotel_name: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  status: string;
}

interface ChainAnalytics {
  total_properties: number;
  total_revenue: number;
  average_occupancy: number;
  total_bookings: number;
  revenue_by_hotel: HotelRevenueItem[];
  recent_bookings: RecentBookingItem[];
}

export function ChainDashboard() {
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);

  const { data: chainData, isLoading, error } = useQuery<ChainAnalytics>({
    queryKey: ['chainAnalytics'],
    queryFn: () => apiClient.get<ChainAnalytics>('/chain/analytics'),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const handleSwitchProperty = async (hotelId: string) => {
    try {
      setSwitchingId(hotelId);
      await apiClient.post(`/properties/switch/${hotelId}`, {});
      window.location.href = '/dashboard';
    } catch (err) {
      console.error("Failed to switch property:", err);
      setSwitchingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <span className="text-muted-foreground font-medium text-sm">Loading Brand Console Insights…</span>
        </div>
      </div>
    );
  }

  if (error || !chainData) {
    return (
      <PageShell
        title="Brand Console"
        subtitle="Multi-Property Portfolio Governance"
      >
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 mt-6">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-400 font-bold">Failed to load brand data</CardTitle>
            <CardDescription className="text-red-700 dark:text-red-500">
              Please verify that your user account has a brand/chain relationship configured, or contact support.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageShell>
    );
  }

  const {
    total_properties,
    total_revenue,
    average_occupancy,
    total_bookings,
    revenue_by_hotel = [],
    recent_bookings = []
  } = chainData;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  // Recharts customized tooltip styling
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 dark:bg-slate-900/95 border border-border px-3 py-2 rounded-lg shadow-xl backdrop-blur-md text-xs">
          <p className="font-bold text-foreground mb-1">{label}</p>
          {payload.map((pld: any) => (
            <p key={pld.name} className="font-medium" style={{ color: pld.color }}>
              {pld.name}: {pld.name === 'Revenue' ? `₹${pld.value.toLocaleString('en-IN')}` : `${pld.value}%`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <PageShell
      title="Brand Console"
      subtitle="Aggregated analytics, real-time comparisons and cross-property management."
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* KPI Summary Grid */}
        <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Revenue */}
          <Card className="shadow-sm border-border bg-gradient-to-br from-indigo-50/20 to-transparent dark:from-indigo-950/10 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Consolidated Revenue
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <IndianRupee className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                <AnimatedCounter
                  value={total_revenue}
                  formatter={(val) => `₹${val.toLocaleString('en-IN')}`}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span>Across all active properties</span>
              </p>
            </CardContent>
          </Card>

          {/* Occupancy */}
          <Card className="shadow-sm border-border bg-gradient-to-br from-emerald-50/20 to-transparent dark:from-emerald-950/10 hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Portfolio Occupancy
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Activity className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                <AnimatedCounter
                  value={average_occupancy}
                  formatter={(val) => `${val}%`}
                />
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, average_occupancy)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Bookings */}
          <Card className="shadow-sm border-border bg-gradient-to-br from-blue-50/20 to-transparent dark:from-blue-950/10 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Portfolio Bookings
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <BookOpen className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                <AnimatedCounter value={total_bookings} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                <span>Successful check-ins & stays</span>
              </p>
            </CardContent>
          </Card>

          {/* Properties */}
          <Card className="shadow-sm border-border bg-gradient-to-br from-violet-50/20 to-transparent dark:from-violet-950/10 hover:shadow-md hover:border-violet-200 dark:hover:border-violet-800 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Registered Hotels
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-950/60 flex items-center justify-center text-violet-600 dark:text-violet-400">
                <Building2 className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                <AnimatedCounter value={total_properties} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                <span>Brand group hotels active</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts and Data Visualizations */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-sm border-border overflow-hidden">
            <CardHeader className="border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold">Portfolio Comparisons</CardTitle>
                <CardDescription className="text-xs">Compare performance statistics side-by-side</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs defaultValue="revenue" className="w-full">
                <div className="flex justify-between items-center mb-6">
                  <TabsList className="bg-muted p-1 rounded-lg">
                    <TabsTrigger value="revenue" className="text-xs font-medium">Revenue Comparison (₹)</TabsTrigger>
                    <TabsTrigger value="occupancy" className="text-xs font-medium">Occupancy Rate (%)</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="revenue" className="outline-none">
                  {revenue_by_hotel.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground italic text-sm">No data available</div>
                  ) : (
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={revenue_by_hotel}
                          margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                        >
                          <defs>
                            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.8} />
                              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.2} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                          <XAxis
                            dataKey="name"
                            className="text-[10px] text-muted-foreground"
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                          />
                          <YAxis
                            className="text-[10px] text-muted-foreground"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `₹${value >= 100000 ? (value / 100000).toFixed(1) + 'L' : value}`}
                          />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} />
                          <Bar
                            name="Revenue"
                            dataKey="revenue"
                            fill="url(#revenueGradient)"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={45}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="occupancy" className="outline-none">
                  {revenue_by_hotel.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground italic text-sm">No data available</div>
                  ) : (
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={revenue_by_hotel}
                          margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                        >
                          <defs>
                            <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                          <XAxis
                            dataKey="name"
                            className="text-[10px] text-muted-foreground"
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                          />
                          <YAxis
                            className="text-[10px] text-muted-foreground"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}%`}
                            domain={[0, 100]}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Area
                            name="Occupancy %"
                            type="monotone"
                            dataKey="occupancy_rate"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#occupancyGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>

        {/* Compare Properties Grid & Recent Bookings */}
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Properties comparison table */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <Card className="shadow-sm border-border h-full">
              <CardHeader className="border-b px-6 py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Property Comparison Matrix</CardTitle>
                  <CardDescription className="text-xs">Direct governance and active management switcher</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold text-xs py-3">Hotel Name</TableHead>
                      <TableHead className="font-semibold text-xs text-center">Bookings</TableHead>
                      <TableHead className="font-semibold text-xs text-center">Occupancy Rate</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Revenue</TableHead>
                      <TableHead className="font-semibold text-xs text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenue_by_hotel.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm italic">
                          No hotels assigned to this brand yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      revenue_by_hotel.map((h) => {
                        const isSwitching = switchingId === h.hotel_id;
                        return (
                          <TableRow key={h.hotel_id} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="font-medium text-sm py-4">
                              <div className="flex flex-col">
                                <span className="text-foreground font-semibold">{h.name}</span>
                                <span className="text-[10px] text-muted-foreground">{h.slug}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm font-semibold">{h.bookings_count}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "px-2 py-0 h-5 font-semibold text-[10px]",
                                    h.occupancy_rate >= 80
                                      ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                                      : h.occupancy_rate >= 50
                                      ? "text-amber-700 bg-amber-50 border-amber-100"
                                      : "text-red-700 bg-red-50 border-red-100"
                                  )}
                                >
                                  {h.occupancy_rate}%
                                </Badge>
                                <div className="w-16 bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      h.occupancy_rate >= 80 ? "bg-emerald-500" : h.occupancy_rate >= 50 ? "bg-amber-500" : "bg-red-500"
                                    )}
                                    style={{ width: `${Math.min(100, h.occupancy_rate)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm font-bold text-slate-800 dark:text-slate-200">
                              ₹{h.revenue.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={switchingId !== null}
                                onClick={() => handleSwitchProperty(h.hotel_id)}
                                className="h-8 text-xs font-semibold px-3 gap-1.5 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40"
                              >
                                {isSwitching ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                                ) : (
                                  <ArrowLeftRight className="h-3 w-3" />
                                )}
                                <span>Switch</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Portfolio Bookings */}
          <motion.div variants={itemVariants} className="space-y-6">
            <Card className="shadow-sm border-border h-full flex flex-col">
              <CardHeader className="border-b px-6 py-4">
                <CardTitle className="text-base font-bold">Recent Portfolio Bookings</CardTitle>
                <CardDescription className="text-xs">Latest stays booked across the portfolio</CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 divide-y divide-border overflow-y-auto max-h-[480px]">
                {recent_bookings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground italic text-xs">No recent booking activity</div>
                ) : (
                  recent_bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="p-4 hover:bg-muted/20 transition-colors flex flex-col gap-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-sm">{booking.guest_name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-1.5 py-0 h-4.5 text-[9px] uppercase font-semibold",
                            booking.status === 'confirmed'
                              ? 'text-green-600 bg-green-50 border-green-100'
                              : booking.status === 'checked_in'
                              ? 'text-blue-600 bg-blue-50 border-blue-100'
                              : 'text-muted-foreground bg-muted/40 border-border'
                          )}
                        >
                          {booking.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{booking.hotel_name}</span>
                        <span>₹{booking.total_amount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                        <span>Check-in: {booking.check_in}</span>
                        <span>Check-out: {booking.check_out}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </PageShell>
  );
}

export default ChainDashboard;
