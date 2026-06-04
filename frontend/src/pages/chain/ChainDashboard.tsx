import React, { useState } from 'react';
import {
  Building2, IndianRupee, TrendingUp, BookOpen, Loader2,
  ArrowLeftRight, Activity, Trophy, AlertTriangle, Users,
  Sparkles, ArrowUpRight, ArrowDownRight, Crown, Calendar,
  ChevronRight, Download, BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/PageShell';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { apiClient } from '@/api/client';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, AreaChart, Area,
} from 'recharts';
import { format } from 'date-fns';

interface HotelRevenueItem {
  hotel_id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  revenue: number;
  bookings_count: number;
  occupancy_rate: number;
  adr: number;
  total_rooms: number;
  room_nights_sold: number;
}

interface RecentBookingItem {
  id: string;
  hotel_id: string;
  hotel_name: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  status: string;
}

interface ChainAnalytics {
  period: string;
  total_properties: number;
  total_revenue: number;
  average_occupancy: number;
  total_bookings: number;
  total_guests: number;
  revenue_change_pct: number;
  bookings_change_pct: number;
  revenue_by_hotel: HotelRevenueItem[];
  recent_bookings: RecentBookingItem[];
  top_performer: HotelRevenueItem | null;
  needs_attention: HotelRevenueItem | null;
}

interface TopGuest {
  guest_id: string;
  name: string;
  email: string;
  total_bookings: number;
  total_spend: number;
  hotels_count: number;
  last_booking: string | null;
}

interface ChainGuests {
  total_guests: number;
  cross_property_guests: number;
  cross_property_pct: number;
  top_guests: TopGuest[];
}

const PERIODS = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '365d', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
];

export function ChainDashboard() {
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [period, setPeriod] = useState('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'guests'>('overview');

  const { data, isLoading, error } = useQuery<ChainAnalytics>({
    queryKey: ['chainAnalytics', period],
    queryFn: () => apiClient.get<ChainAnalytics>(`/chain/analytics?period=${period}`),
    staleTime: 1000 * 60 * 5,
  });

  const { data: guestsData, isLoading: guestsLoading } = useQuery<ChainGuests>({
    queryKey: ['chainGuests'],
    queryFn: () => apiClient.get<ChainGuests>('/chain/guests'),
    enabled: activeTab === 'guests',
    staleTime: 1000 * 60 * 10,
  });

  const handleSwitch = async (hotelId: string) => {
    try {
      setSwitchingId(hotelId);
      await apiClient.post(`/properties/switch/${hotelId}`, {});
      window.location.href = '/dashboard';
    } catch {
      setSwitchingId(null);
    }
  };

  const exportCSV = () => {
    if (!data?.revenue_by_hotel) return;
    const rows = [
      ['Hotel', 'Slug', 'Bookings', 'Revenue', 'Occupancy %', 'ADR', 'Total Rooms'],
      ...data.revenue_by_hotel.map(h => [
        h.name, h.slug, h.bookings_count, h.revenue, h.occupancy_rate, h.adr, h.total_rooms,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chain-analytics-${period}-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <span className="text-muted-foreground font-medium text-sm">
            Loading Brand Console…
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <PageShell title="Brand Console" subtitle="Multi-Property Portfolio">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 mt-6">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-400">
              Failed to load brand data
            </CardTitle>
            <CardDescription className="text-red-700 dark:text-red-500">
              Verify your account has a brand/chain relationship configured.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageShell>
    );
  }

  const {
    total_properties, total_revenue, average_occupancy, total_bookings,
    total_guests, revenue_change_pct, bookings_change_pct,
    revenue_by_hotel = [], recent_bookings = [], top_performer, needs_attention,
  } = data;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-background/95 dark:bg-slate-900/95 border border-border px-3 py-2 rounded-lg shadow-xl backdrop-blur-md text-xs">
          <p className="font-bold mb-1">{label}</p>
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
      subtitle="Multi-property portfolio governance & analytics"
    >
      {/* ── Tabs + Period Filter ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <BarChart3 className="w-4 h-4" /> Overview
          </button>
          <button
            onClick={() => setActiveTab('guests')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
              activeTab === 'guests'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <Users className="w-4 h-4" /> Guest Insights
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'overview' && (
            <>
              <div className="flex bg-muted rounded-lg p-1 gap-1">
                {PERIODS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                      period === p.value
                        ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-5">

          {/* KPI Grid */}
          <motion.div variants={itemVariants} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label="Total Revenue"
              value={total_revenue}
              formatter={v => `₹${v.toLocaleString('en-IN')}`}
              icon={IndianRupee}
              color="indigo"
              changePct={period !== 'all' ? revenue_change_pct : undefined}
            />
            <KpiCard
              label="Occupancy"
              value={average_occupancy}
              formatter={v => `${v}%`}
              icon={Activity}
              color="emerald"
              progress={average_occupancy}
            />
            <KpiCard
              label="Bookings"
              value={total_bookings}
              icon={BookOpen}
              color="blue"
              changePct={period !== 'all' ? bookings_change_pct : undefined}
            />
            <KpiCard
              label="Unique Guests"
              value={total_guests}
              icon={Users}
              color="amber"
            />
            <KpiCard
              label="Properties"
              value={total_properties}
              icon={Building2}
              color="violet"
            />
          </motion.div>

          {/* Highlight Cards: Top Performer + Needs Attention */}
          {(top_performer || needs_attention) && (
            <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2">
              {top_performer && (
                <Card className="relative overflow-hidden border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/20">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-300/10 rounded-full blur-3xl" />
                  <CardContent className="p-5 relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Top Performer</p>
                          <p className="font-bold text-base">{top_performer.name}</p>
                        </div>
                      </div>
                      <Crown className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Revenue</p>
                        <p className="font-bold">₹{top_performer.revenue.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Occupancy</p>
                        <p className="font-bold">{top_performer.occupancy_rate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">ADR</p>
                        <p className="font-bold">₹{top_performer.adr.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {needs_attention && needs_attention.hotel_id !== top_performer?.hotel_id && (
                <Card className="relative overflow-hidden border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-transparent dark:from-amber-950/20">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-300/10 rounded-full blur-3xl" />
                  <CardContent className="p-5 relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Needs Attention</p>
                          <p className="font-bold text-base">{needs_attention.name}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleSwitch(needs_attention.hotel_id)} className="gap-1 h-7 text-xs">
                        Manage <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Revenue</p>
                        <p className="font-bold">₹{needs_attention.revenue.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Occupancy</p>
                        <p className="font-bold text-amber-600">{needs_attention.occupancy_rate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Bookings</p>
                        <p className="font-bold">{needs_attention.bookings_count}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {/* Charts */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="border-b px-6 py-4">
                <CardTitle className="text-base font-bold">Portfolio Comparison</CardTitle>
                <CardDescription className="text-xs">Side-by-side performance across properties</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs defaultValue="revenue">
                  <TabsList className="bg-muted p-1 rounded-lg mb-6">
                    <TabsTrigger value="revenue" className="text-xs">Revenue (₹)</TabsTrigger>
                    <TabsTrigger value="occupancy" className="text-xs">Occupancy (%)</TabsTrigger>
                    <TabsTrigger value="adr" className="text-xs">ADR (₹)</TabsTrigger>
                  </TabsList>

                  <TabsContent value="revenue">
                    <ChartContainer data={revenue_by_hotel} dataKey="revenue" type="bar" tooltip={CustomTooltip} color="#4f46e5" />
                  </TabsContent>
                  <TabsContent value="occupancy">
                    <ChartContainer data={revenue_by_hotel} dataKey="occupancy_rate" type="area" tooltip={CustomTooltip} color="#10b981" yMax={100} />
                  </TabsContent>
                  <TabsContent value="adr">
                    <ChartContainer data={revenue_by_hotel} dataKey="adr" type="bar" tooltip={CustomTooltip} color="#f59e0b" />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>

          {/* Property Table + Recent Bookings */}
          <div className="grid gap-5 lg:grid-cols-3">
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <Card>
                <CardHeader className="border-b px-6 py-4">
                  <CardTitle className="text-base font-bold">Property Matrix</CardTitle>
                  <CardDescription className="text-xs">Switch to manage any property directly</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs font-semibold py-3">Hotel</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Bookings</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Occupancy</TableHead>
                        <TableHead className="text-xs font-semibold text-right">ADR</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Revenue</TableHead>
                        <TableHead className="text-xs font-semibold text-center"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenue_by_hotel.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm italic">
                            No hotels assigned to this brand yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        revenue_by_hotel.map(h => (
                          <TableRow key={h.hotel_id} className="hover:bg-muted/20">
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center shrink-0 overflow-hidden">
                                  {h.logo_url ? (
                                    <img src={h.logo_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <Building2 className="w-4 h-4 text-indigo-600" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm truncate">{h.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{h.total_rooms} rooms · {h.room_nights_sold} nights sold</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm font-semibold">{h.bookings_count}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Badge variant="outline" className={cn(
                                  'px-2 py-0 h-5 text-[10px] font-semibold',
                                  h.occupancy_rate >= 70 ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                                    : h.occupancy_rate >= 40 ? 'text-amber-700 bg-amber-50 border-amber-100'
                                    : 'text-red-700 bg-red-50 border-red-100'
                                )}>
                                  {h.occupancy_rate}%
                                </Badge>
                                <div className="w-14 bg-slate-100 dark:bg-slate-800 h-1 rounded-full">
                                  <div
                                    className={cn(
                                      'h-full rounded-full',
                                      h.occupancy_rate >= 70 ? 'bg-emerald-500'
                                        : h.occupancy_rate >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                    )}
                                    style={{ width: `${Math.min(100, h.occupancy_rate)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold">
                              ₹{h.adr.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-right text-sm font-bold">
                              ₹{h.revenue.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={switchingId !== null}
                                onClick={() => handleSwitch(h.hotel_id)}
                                className="h-7 text-xs px-2.5 gap-1 hover:bg-indigo-50 hover:text-indigo-600"
                              >
                                {switchingId === h.hotel_id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <ArrowLeftRight className="h-3 w-3" />}
                                Switch
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="h-full flex flex-col">
                <CardHeader className="border-b px-6 py-4">
                  <CardTitle className="text-base font-bold">Recent Bookings</CardTitle>
                  <CardDescription className="text-xs">Latest activity across all properties</CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-1 divide-y divide-border overflow-y-auto max-h-[480px]">
                  {recent_bookings.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground italic text-xs">No recent activity</div>
                  ) : (
                    recent_bookings.map(b => (
                      <div key={b.id} className="p-4 hover:bg-muted/20 flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm">{b.guest_name}</span>
                          <Badge variant="outline" className={cn(
                            'px-1.5 py-0 h-4 text-[9px] uppercase font-semibold',
                            b.status === 'confirmed' ? 'text-green-600 bg-green-50 border-green-100'
                              : b.status === 'checked_in' ? 'text-blue-600 bg-blue-50 border-blue-100'
                              : 'text-muted-foreground bg-muted/40'
                          )}>
                            {b.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span className="font-semibold text-indigo-600">{b.hotel_name}</span>
                          <span>₹{b.total_amount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground pt-0.5">
                          <span>In: {b.check_in}</span>
                          <span>Out: {b.check_out}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* ── GUEST INSIGHTS TAB ── */}
      {activeTab === 'guests' && (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-5">
          {guestsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : !guestsData ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No guest data yet</CardContent></Card>
          ) : (
            <>
              <motion.div variants={itemVariants} className="grid gap-3 sm:grid-cols-3">
                <KpiCard label="Total Guests" value={guestsData.total_guests} icon={Users} color="indigo" />
                <KpiCard label="Cross-Property Guests" value={guestsData.cross_property_guests} icon={Sparkles} color="emerald" subtitle="Stayed at 2+ hotels" />
                <KpiCard label="Cross-Property Rate" value={guestsData.cross_property_pct} formatter={v => `${v}%`} icon={Activity} color="amber" progress={guestsData.cross_property_pct} />
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader className="border-b px-6 py-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-500" /> Top Guests Across Portfolio
                    </CardTitle>
                    <CardDescription className="text-xs">Highest spenders across all your properties</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs font-semibold">Guest</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Stays</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Hotels Visited</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Total Spend</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Last Booking</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {guestsData.top_guests.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm italic">
                              No guest data yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          guestsData.top_guests.map((g, idx) => (
                            <TableRow key={g.guest_id} className="hover:bg-muted/20">
                              <TableCell className="py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0',
                                    idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-orange-400' : 'bg-indigo-400'
                                  )}>
                                    {idx + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm">{g.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{g.email}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-sm font-semibold">{g.total_bookings}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-[10px] font-semibold gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {g.hotels_count}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm font-bold text-emerald-600">
                                ₹{g.total_spend.toLocaleString('en-IN')}
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                {g.last_booking ? format(new Date(g.last_booking), 'dd MMM yyyy') : '-'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
        </motion.div>
      )}
    </PageShell>
  );
}

// ── KPI Card Component ────────────────────────────────────────────────────────
interface KpiProps {
  label: string;
  value: number;
  formatter?: (v: number) => string;
  icon: any;
  color: 'indigo' | 'emerald' | 'blue' | 'amber' | 'violet';
  changePct?: number;
  progress?: number;
  subtitle?: string;
}

const COLOR_MAP = {
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-600 dark:text-indigo-400', accent: 'from-indigo-50/20' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-600 dark:text-emerald-400', accent: 'from-emerald-50/20' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-950/60', text: 'text-blue-600 dark:text-blue-400', accent: 'from-blue-50/20' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-600 dark:text-amber-400', accent: 'from-amber-50/20' },
  violet: { bg: 'bg-violet-100 dark:bg-violet-950/60', text: 'text-violet-600 dark:text-violet-400', accent: 'from-violet-50/20' },
};

function KpiCard({ label, value, formatter, icon: Icon, color, changePct, progress, subtitle }: KpiProps) {
  const c = COLOR_MAP[color];
  const isPositive = (changePct ?? 0) >= 0;
  return (
    <Card className={cn('shadow-sm bg-gradient-to-br to-transparent hover:shadow-md transition-all', c.accent)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', c.bg, c.text)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-extrabold tracking-tight">
          <AnimatedCounter value={value} formatter={formatter} />
        </div>
        {changePct !== undefined && (
          <p className={cn('text-[11px] font-semibold mt-1 flex items-center gap-1', isPositive ? 'text-green-600' : 'text-red-600')}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(changePct)}% vs prev period
          </p>
        )}
        {progress !== undefined && (
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className={cn('h-full rounded-full', c.text.replace('text-', 'bg-'))}
              style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        )}
        {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ── Chart Container ────────────────────────────────────────────────────────────
function ChartContainer({ data, dataKey, type, tooltip: TooltipComp, color, yMax }: any) {
  if (data.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground italic text-sm">No data available</div>;
  }
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
            <defs>
              <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.8} />
                <stop offset="100%" stopColor={color} stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
            <XAxis dataKey="name" className="text-[10px]" tickLine={false} axisLine={false} dy={10} />
            <YAxis className="text-[10px]" tickLine={false} axisLine={false}
              tickFormatter={(v) => `₹${v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v}`}
            />
            <Tooltip content={<TooltipComp />} cursor={{ fill: 'rgba(79,70,229,0.05)' }} />
            <Bar name="Revenue" dataKey={dataKey} fill={`url(#grad-${color})`} radius={[6, 6, 0, 0]} maxBarSize={45} />
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
            <defs>
              <linearGradient id={`area-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
            <XAxis dataKey="name" className="text-[10px]" tickLine={false} axisLine={false} dy={10} />
            <YAxis className="text-[10px]" tickLine={false} axisLine={false}
              tickFormatter={(v) => `${v}%`} domain={yMax ? [0, yMax] : undefined}
            />
            <Tooltip content={<TooltipComp />} />
            <Area name="Occupancy %" type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fillOpacity={1} fill={`url(#area-${color})`} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default ChainDashboard;
