// Reports Page - Real API Integration
import { useState, useEffect } from 'react';
import { Download, Calendar, TrendingUp, Users, Bed, IndianRupee, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { format, isValid } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient, ApiClientError } from '@/api/client';
import { PageShell } from '@/components/layout/PageShell';

interface DashboardStats {
  summary: {
    totalRevenue: number;
    totalBookings: number;
    occupancyRate: number;
    netProfit: number;
  };
  revenueChart: { date: string; revenue: number; bookings: number }[];
  occupancyChart: { date: string; occupancy: number }[];
}

export function ReportsPage() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [days, setDays] = useState('30');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      // Fix: Passed params directly as object with string values to match apiClient signature and fixing type issue
      const data = await apiClient.get<DashboardStats>('/reports/dashboard', { days });
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);

      // Fix: Improved error handling
      let title = 'Error';
      let description = 'Failed to load report data.';

      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          title = 'Session Expired';
          description = 'Please login again.';
        } else if (error.status === 422) {
          title = 'Invalid Request';
          description = 'Could not process the request parameters.';
        } else if (error.status >= 500) {
          title = 'Server Error';
          description = 'Something went wrong on the server.';
        }
      }

      toast({
        variant: 'destructive',
        title,
        description,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [days]);

  const handleExport = async () => {
    if (!stats) return;

    try {
      setIsExporting(true);

      // Fix: Client-side CSV generation instead of fake delay
      // Preparing CSV content
      const headers = ['Date', 'Revenue', 'Bookings', 'Occupancy'];
      const rows = stats.revenueChart.map(r => {
        // Find matching occupancy
        const occ = stats.occupancyChart.find(o => o.date === r.date)?.occupancy ?? 0;
        return [
          r.date,
          r.revenue,
          r.bookings,
          occ
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `reports_${days}days_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: "The report has been successfully exported to CSV.",
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: "Export Failed",
        description: "Could not export data.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Fix: Improved loading UX - show loader when loading regardless of stats to prevent stale data
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading reports...</span>
      </div>
    );
  }

  // Helper for safe date formatting
  const safeFormatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return isValid(date) ? format(date, 'MMM dd') : 'Invalid Date';
  };

  // Fix: Safe access to chart arrays with fallback to empty array
  // Format chart data dates safely
  const revenueChartData = (stats?.revenueChart || []).map(d => ({
    ...d,
    displayDate: safeFormatDate(d.date)
  }));

  const occupancyChartData = (stats?.occupancyChart || []).map(d => ({
    ...d,
    displayDate: safeFormatDate(d.date)
  }));

  return (
    <PageShell
      title="Reports"
      subtitle="Analytics and performance insights"
      actions={
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[160px] h-9">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2 h-9 text-sm" onClick={handleExport} disabled={isExporting || !stats}>
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
        </div>
      }
    >

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Occupancy</CardTitle>
            <Bed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {/* Fix: Use nullish coalescing operator for safe falsy handling */}
            <div className="text-2xl font-bold">{stats?.summary.occupancyRate ?? 0}%</div>
            <p className="text-xs text-muted-foreground">For selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.summary.totalRevenue ?? 0)}</div>
            <p className="text-xs text-muted-foreground">For selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.summary.totalBookings ?? 0}</div>
            <p className="text-xs text-muted-foreground">Confirmed bookings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit (Est.)</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.summary.netProfit ?? 0)}</div>
            <p className="text-xs text-muted-foreground">~70% margin</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Intelligence Section */}
      <Card className="border-blue-100 bg-blue-50/30 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <TrendingUp className="w-24 h-24 text-blue-600" />
        </div>
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
             <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
             <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Performance Intelligence</span>
          </div>
          <CardTitle className="text-xl flex items-center gap-2">
            Executive Summary & Recommendations
          </CardTitle>
          <CardDescription>Generated based on your last {days} days of performance data</CardDescription>
        </CardHeader>
        <CardContent>
          {stats && stats.summary.totalBookings > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
                <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" /> Revenue Flow
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your total revenue for this period is {formatCurrency(stats.summary.totalRevenue)}. 
                  Average daily performance is steady.
                </p>
              </div>
              <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
                <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" /> Booking Volume
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  With {stats.summary.totalBookings} confirmed bookings, your occupancy is at {stats.summary.occupancyRate}%.
                </p>
              </div>
              <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
                <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                  <Bed className="w-4 h-4 text-purple-500" /> Profitability
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Estimated net profit stands at {formatCurrency(stats.summary.netProfit)}. 
                  Your gross margins are healthy.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center bg-muted/30 rounded-xl border border-dashed border-border">
              <p className="text-sm text-slate-500">Not enough data to generate performance insights yet.</p>
              <p className="text-xs text-slate-400 mt-1">AI recommendations will appear after your first few bookings.</p>
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-2" disabled={!stats || stats.summary.totalBookings === 0}>
              Request Deep AI Analysis
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports Tabs */}
      <Tabs defaultValue="occupancy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
        </TabsList>

        <TabsContent value="occupancy">
          <Card>
            <CardHeader>
              <CardTitle>Occupancy Report</CardTitle>
              <CardDescription>Daily occupancy rates over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={occupancyChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="displayDate"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="occupancy"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Report</CardTitle>
              <CardDescription>Daily revenue over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="displayDate"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `₹${value}`}
                    />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings">
          <Card>
            <CardHeader>
              <CardTitle>Booking Trends</CardTitle>
              <CardDescription>Daily new bookings over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {/* Fix: Reusing revenueData safely containing bookings */}
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="displayDate"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip />
                    <Bar dataKey="bookings" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

export default ReportsPage;
