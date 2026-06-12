import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Info,
  CheckCircle,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  Globe
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageShell } from '@/components/layout/PageShell';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';

interface RateShopperRecord {
  "Hotel Name": string;
  "Date": string;
  "Status": string;
  "Room Type": string;
  "EP (Base)": string;
  "EP (Total)": string;
  "CP (Base)": string;
  "CP (Total)": string;
  "MAP (Base)": string;
  "MAP (Total)": string;
  "AP (Base)": string;
  "AP (Total)": string;
}

export interface Competitor {
  id: string;
  name: string;
  url: string;
  last_scrape_status: string;
  last_scrape_error: string | null;
  last_scraped_at: string | null;
  scrape_started_at: string | null;
}

export default function RateShopper() {
  const [selectedHotel, setSelectedHotel] = useState<string>('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompUrl, setNewCompUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Fetch competitor list
  const { data: competitors = [], refetch: refetchCompetitors } = useQuery<Competitor[]>({
    queryKey: ['competitors'],
    queryFn: () => apiClient.get<Competitor[]>('/competitors'),
    staleTime: 1000 * 60 * 2,
  });
  
  // Fetch competitor rates from database
  const { data = [], isLoading, isError, refetch, isRefetching } = useQuery<RateShopperRecord[]>({
    queryKey: ['rateShopperMatrix'],
    queryFn: () => apiClient.get<RateShopperRecord[]>('/dashboard/rate-shopper'),
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  // Poll status while any competitor scrape is 'Running'
  const hasRunningScrape = competitors.some(c => c.last_scrape_status === 'Running');
  useQuery({
    queryKey: ['competitorsPolling'],
    queryFn: async () => {
      const res = await apiClient.get<Competitor[]>('/competitors');
      refetchCompetitors();
      refetch();
      return res;
    },
    enabled: hasRunningScrape,
    refetchInterval: 3000, // Poll every 3 seconds
  });

  const handleManualScrape = async () => {
    toast.promise(
      apiClient.post('/competitors/scrape', {}).then(() => {
        setTimeout(refetchCompetitors, 500);
      }),
      {
        loading: 'Triggering competitor rate refresh...',
        success: 'Scraper task launched successfully in background!',
        error: (err: any) => err.response?.data?.detail || 'Failed to initiate scraper refresh.'
      }
    );
  };

  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName || !newCompUrl) return;
    setIsAdding(true);
    try {
      await apiClient.post('/competitors', { name: newCompName, url: newCompUrl });
      toast.success('Competitor added successfully!');
      setNewCompName('');
      setNewCompUrl('');
      setShowAddForm(false);
      refetchCompetitors();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add competitor.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCompetitor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this competitor?')) return;
    try {
      await apiClient.delete(`/competitors/${id}`);
      toast.success('Competitor deleted successfully!');
      refetchCompetitors();
      refetch();
    } catch (err) {
      toast.error('Failed to delete competitor.');
    }
  };

  // Get unique hotels and dates for filtering
  const hotelsList = ['All', ...Array.from(new Set(data.map(r => r["Hotel Name"] || '').filter(Boolean)))];
  const datesList = Array.from(new Set(data.map(r => r["Date"] || '').filter(Boolean))).sort();

  // Filter data based on selection
  const filteredData = data.filter(r => selectedHotel === 'All' || r["Hotel Name"] === selectedHotel);

  // Group by Date for better grid visualization
  const groupedByDate: Record<string, RateShopperRecord[]> = {};
  filteredData.forEach(record => {
    const d = record["Date"];
    if (!groupedByDate[d]) groupedByDate[d] = [];
    groupedByDate[d].push(record);
  });

  // Calculate Quick Stats
  const totalCompetitorsCount = Math.max(0, hotelsList.length - 1);
  const availableDatesCount = datesList.length;
  
  const soldOutCount = data.filter(r => r["Status"] === 'Sold Out').length;
  
  const allBasePrices = data
    .flatMap(r => [r["EP (Base)"], r["CP (Base)"], r["MAP (Base)"], r["AP (Base)"]])
    .map(p => parseFloat(p))
    .filter(p => !isNaN(p) && p > 0);
  const lowestRate = allBasePrices.length > 0 ? Math.min(...allBasePrices) : 0;

  return (
    <PageShell
      title="Competitor Rate Shopper"
      subtitle="Real-time room rates and packages comparison across direct competitors."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetch(); refetchCompetitors(); }} disabled={isLoading || isRefetching} className="h-9">
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh View
          </Button>
          <Button size="sm" onClick={handleManualScrape} disabled={hasRunningScrape} className="h-9 bg-indigo-600 hover:bg-indigo-700">
            <Sparkles className="w-4 h-4 mr-2" />
            {hasRunningScrape ? 'Scraping Live...' : 'Scrape MMT Now'}
          </Button>
        </div>
      }
    >
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-2">
        <Card className="shadow-sm border-border bg-gradient-to-br from-indigo-50/20 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Competitors Tracked</CardTitle>
            <Building2 className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{totalCompetitorsCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">MMT details pages scanned</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Lowest Comp Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-green-600">
              {lowestRate > 0 ? `₹${lowestRate.toLocaleString('en-IN')}` : 'N/A'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Starting competitor base price</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Dates Monitored</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{availableDatesCount} Days</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Sequential daily price checks</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border border-l-4 border-l-red-500 bg-red-50/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase">Sold Out Blocks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-red-600">{soldOutCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Dates with complete sold out state</p>
          </CardContent>
        </Card>
      </div>

      {/* Competitor Management Panel */}
      <Card className="mt-6 border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Manage Competitor Hotels
            </CardTitle>
            <CardDescription className="text-xs">
              Add up to 5 hotels from MakeMyTrip to track rates.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            {showAddForm ? 'Cancel' : 'Add Competitor'}
          </Button>
        </CardHeader>
        
        {showAddForm && (
          <CardContent className="border-t pt-4">
            <form onSubmit={handleAddCompetitor} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="comp-name" className="text-xs font-semibold">Hotel Name</Label>
                  <Input
                    id="comp-name"
                    value={newCompName}
                    onChange={e => setNewCompName(e.target.value)}
                    placeholder="e.g. Fariyas Resort"
                    required
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="comp-url" className="text-xs font-semibold">MakeMyTrip Details URL</Label>
                  <Input
                    id="comp-url"
                    value={newCompUrl}
                    onChange={e => setNewCompUrl(e.target.value)}
                    placeholder="Paste the MakeMyTrip hotel details link..."
                    required
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <Button type="submit" size="sm" disabled={isAdding} className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8">
                {isAdding ? 'Adding...' : 'Save Competitor'}
              </Button>
            </form>
          </CardContent>
        )}

        <CardContent className="p-0 border-t">
          {competitors.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No competitor hotels added yet. Click &ldquo;Add Competitor&rdquo; to start tracking.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-bold w-1/3">Hotel Name</TableHead>
                  <TableHead className="text-xs font-bold">Scraping Status</TableHead>
                  <TableHead className="text-xs font-bold">Last Scraped At</TableHead>
                  <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map(comp => (
                  <TableRow key={comp.id}>
                    <TableCell className="font-semibold text-xs py-3.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{comp.name}</span>
                        <a href={comp.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline inline-flex items-center">
                          <Globe className="w-3 h-3 ml-1" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      {comp.last_scrape_status === 'Running' ? (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                          <span className="text-xs font-bold text-indigo-600">Scraping Live...</span>
                        </div>
                      ) : comp.last_scrape_status === 'Completed' ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] font-bold">
                          Completed
                        </Badge>
                      ) : comp.last_scrape_status === 'Failed' ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-100 text-[10px] font-bold" title={comp.last_scrape_error || 'Unknown error'}>
                          Failed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-100 text-[10px] font-bold">
                          Pending First Scrape
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-3.5">
                      {comp.last_scraped_at ? new Date(comp.last_scraped_at).toLocaleString('en-IN') : 'Never'}
                    </TableCell>
                    <TableCell className="text-right py-3.5 pr-4">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                        onClick={() => handleDeleteCompetitor(comp.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Filter & Controls Panel */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-background dark:bg-slate-900 border rounded-2xl shadow-sm mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase mr-2">Filter Competitor:</span>
          {hotelsList.map(hotelName => (
            <Button
              key={hotelName}
              size="sm"
              variant={selectedHotel === hotelName ? 'default' : 'outline'}
              onClick={() => setSelectedHotel(hotelName)}
              className={`h-8 rounded-lg text-xs font-bold ${selectedHotel === hotelName ? 'bg-indigo-600 text-white' : ''}`}
            >
              {hotelName === 'All' ? 'All Hotels' : hotelName}
            </Button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Rates</AlertTitle>
          <AlertDescription>
            Could not fetch competitor rates from the API. Please ensure the matrix file exists.
          </AlertDescription>
        </Alert>
      )}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="space-y-4 mt-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="animate-pulse shadow-sm">
              <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-t-xl" />
              <div className="p-4 space-y-3">
                <div className="h-6 bg-slate-50 dark:bg-slate-800/50 rounded w-1/3" />
                <div className="h-24 bg-slate-50 dark:bg-slate-800/50 rounded" />
              </div>
            </Card>
          ))}
        </div>
      ) : Object.keys(groupedByDate).length === 0 ? (
        <Card className="mt-6 text-center p-12 border-dashed border-2">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-bounce" />
          <CardTitle className="text-lg font-bold">No Rate Data Found</CardTitle>
          <CardDescription className="max-w-md mx-auto mt-2 text-sm">
            Competitor rate shoppings haven't been completed yet. Click on <strong>Scrape MMT Now</strong> to launch the crawler.
          </CardDescription>
        </Card>
      ) : (
        /* Daily Rate Cards list */
        <div className="space-y-6 mt-6">
          {Object.entries(groupedByDate).map(([dateStr, records]) => (
            <motion.div
              key={dateStr}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="shadow-sm overflow-hidden border-border">
                {/* Date Header banner */}
                <div className="bg-slate-50 dark:bg-slate-900 border-b px-5 py-3.5 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 rounded-lg">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-foreground">{dateStr}</h4>
                      <p className="text-[10px] text-muted-foreground">Competitor room tariffs for this date</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-100">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    Scraped Clean
                  </Badge>
                </div>

                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/50 dark:bg-slate-900/20">
                      <TableRow>
                        <TableHead className="font-bold text-xs">Hotel Name</TableHead>
                        <TableHead className="font-bold text-xs">Room Type</TableHead>
                        <TableHead className="font-bold text-xs text-center">EP (Room Only)</TableHead>
                        <TableHead className="font-bold text-xs text-center">CP (Breakfast)</TableHead>
                        <TableHead className="font-bold text-xs text-center">MAP (Half Board)</TableHead>
                        <TableHead className="font-bold text-xs text-center">AP (All Meals)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r, idx) => {
                        const isSoldOut = r["Status"] === 'Sold Out';
                        
                        return (
                          <TableRow key={idx} className="hover:bg-muted/10">
                            <TableCell className="font-semibold text-xs py-3.5">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                {r["Hotel Name"]}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-xs text-muted-foreground">
                              {isSoldOut ? (
                                <span className="text-red-500 font-bold flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Sold Out
                                </span>
                              ) : (
                                r["Room Type"] || 'Standard Room'
                              )}
                            </TableCell>

                            {/* EP rate cell */}
                            <TableCell className="text-center">
                              {renderPriceCell(r["EP (Base)"], r["EP (Total)"], isSoldOut)}
                            </TableCell>

                            {/* CP rate cell */}
                            <TableCell className="text-center">
                              {renderPriceCell(r["CP (Base)"], r["CP (Total)"], isSoldOut)}
                            </TableCell>

                            {/* MAP rate cell */}
                            <TableCell className="text-center">
                              {renderPriceCell(r["MAP (Base)"], r["MAP (Total)"], isSoldOut)}
                            </TableCell>

                            {/* AP rate cell */}
                            <TableCell className="text-center">
                              {renderPriceCell(r["AP (Base)"], r["AP (Total)"], isSoldOut)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </PageShell>
  );
}

// Helpers
function renderPriceCell(base: string, total: string, isSoldOut: boolean) {
  if (isSoldOut) {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 text-[10px]">
        Missed
      </Badge>
    );
  }
  
  if (!base || base === '-') {
    return <span className="text-muted-foreground/30 text-xs">-</span>;
  }

  const bVal = parseFloat(base);
  const tVal = parseFloat(total);
  const tax = tVal - bVal;

  return (
    <div className="inline-flex flex-col items-center">
      <span className="text-xs font-black text-foreground">
        ₹{bVal.toLocaleString('en-IN')}
      </span>
      {tax > 0 && (
        <span className="text-[9px] text-muted-foreground">
          +₹{tax.toLocaleString('en-IN')} tax
        </span>
      )}
    </div>
  );
}
