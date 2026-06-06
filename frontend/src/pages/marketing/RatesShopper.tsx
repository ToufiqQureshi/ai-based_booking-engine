import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiClient, tokenStorage } from '@/api/client';
import { Loader2, Plus, RefreshCw, Trash2, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RateTable } from '@/components/dashboard/RateTable';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

export default function RatesShopper() {
    const { hotel } = useAuth();
    const queryClient = useQueryClient();
    const [lastStatuses, setLastStatuses] = useState<Record<string, string>>({});
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem("rateShopperActiveTab") || "ALL");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newCompName, setNewCompName] = useState('');
    const [newCompUrl, setNewCompUrl] = useState('');
    const [newCompSource, setNewCompSource] = useState('MAKEMYTRIP');
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        localStorage.setItem("rateShopperActiveTab", activeTab);
    }, [activeTab]);

    // Single useQuery replacing 3 separate useEffect fetches — React Query handles
    // caching, deduplication, and background refresh automatically
    const { data: rateShopperData, isLoading, error, isError, refetch: refetchAll } = useQuery<any>({
        queryKey: ['rateShopperData', startDate],
        queryFn: async () => {
            const [compRes, rateRes, analysisRes] = await Promise.all([
                apiClient.get('/competitors'),
                apiClient.get('/competitors/rates/comparison', { start_date: startDate }),
                apiClient.get('/competitors/analysis', { start_date: startDate, days: '7' }),
            ]);
            return {
                competitors: compRes as any[],
                chartData: (rateRes as any).chart_data,
                tableData: (rateRes as any).table_data,
                chartCompetitorNames: (rateRes as any).competitors,
                marketAnalysis: analysisRes as any[],
            };
        },
        staleTime: 1000 * 60 * 60, // 1 hour — competitor data doesn't change minute-to-minute
        gcTime: 1000 * 60 * 120,
    });

    useEffect(() => {
        if (isError) {
            toast.error("Failed to load rate shopper data");
        }
    }, [isError]);

    const competitors = rateShopperData?.competitors ?? [];
    const chartData = rateShopperData?.chartData ?? [];
    const tableData = rateShopperData?.tableData ?? [];
    const chartCompetitorNames = rateShopperData?.chartCompetitorNames ?? [];
    const marketAnalysis = rateShopperData?.marketAnalysis ?? [];

    const fetchData = useCallback(() => refetchAll(), [refetchAll]);

    useEffect(() => {
        // Real-time listener for scraping updates
        const onScrapeComplete = () => refetchAll();
        window.addEventListener("SCRAPE_COMPLETE" as any, onScrapeComplete);
        return () => window.removeEventListener("SCRAPE_COMPLETE" as any, onScrapeComplete);
    }, [refetchAll]);

    // Auto-poll if any competitor is currently in 'running' state
    useEffect(() => {
        const isAnyRunning = competitors.some((c: any) => c.last_scrape_status === 'running');
        if (!isAnyRunning) return;

        const interval = setInterval(() => {
            fetchData();
        }, 5000); // Poll every 5 seconds to show data dynamically as it is scraped

        return () => clearInterval(interval);
    }, [competitors, fetchData]);

    // Handle toast notifications based on background status transitions
    useEffect(() => {
        if (!competitors.length) return;
        
        const newStatuses: Record<string, string> = {};
        competitors.forEach((comp: any) => {
            newStatuses[comp.id] = comp.last_scrape_status;
            
            const prevStatus = lastStatuses[comp.id];
            if (comp.last_scrape_status === 'failed' && prevStatus !== 'failed') {
                toast.error(`Error scraping ${comp.name}: ${comp.last_scrape_error || 'Unknown error'}`);
            } else if (comp.last_scrape_status === 'success' && prevStatus === 'running') {
                toast.success(`Successfully updated rates for ${comp.name}!`);
            }
        });
        
        const hasChanged = Object.keys(newStatuses).some(id => newStatuses[id] !== lastStatuses[id]);
        if (hasChanged || Object.keys(lastStatuses).length === 0) {
            setLastStatuses(newStatuses);
        }
    }, [competitors, lastStatuses]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartDate(e.target.value);
    };

    const [isAdding, setIsAdding] = useState(false);
    const handleAddCompetitor = async () => {
        if (isAdding || !newCompName || !newCompUrl) {
            toast.warning("Please enter both Name and URL");
            return;
        }
        setIsAdding(true);
        try {
            await apiClient.post('/competitors', {
                name: newCompName,
                url: newCompUrl,
                source: newCompSource,
                hotel_id: "placeholder"
            });
            setIsAddOpen(false);
            setNewCompName('');
            setNewCompUrl('');
            toast.success("Competitor added successfully");
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to add competitor");
        } finally {
            setIsAdding(false);
        }
    };

    const handleScrape = async (id: string) => {
        toast.info("Scraping initiated on the server...");
        try {
            await apiClient.post(`/competitors/${id}/scrape`, {});
            toast.success("Server-side scraping started in the background. Rates will be updated shortly!");
            fetchData(); // Refetch to show running state immediately
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to initiate scraping");
        }
    };

    const handleDeleteCompetitor = async (id: string) => {
        if (!confirm("Are you sure you want to remove this competitor?")) return;
        try {
            await apiClient.delete(`/competitors/${id}`);
            toast.success("Competitor removed");
            refetchAll(); // Refresh all data via React Query
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete competitor");
        }
    };

    // Colors for graph
    const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#d0ed57"];

    // Filter Data based on Active Tab
    const filteredCompetitors = competitors.filter(c => {
        if (activeTab === "ALL") return true;
        const isAgoda = c.source?.toUpperCase() === 'AGODA' || c.url?.toLowerCase().includes('agoda');
        return activeTab === "AGODA" ? isAgoda : !isAgoda;
    });

    const filteredChartNames = chartCompetitorNames.filter(name => {
        // Find competitor object by name (approximate match or exact)
        const comp = competitors.find(c => c.name === name);
        if (!comp) return true;
        const isAgoda = comp.source?.toUpperCase() === 'AGODA' || comp.url?.toLowerCase().includes('agoda');
        return activeTab === "AGODA" ? isAgoda : !isAgoda;
    });

    // Get today's analysis
    const todayAnalysis = marketAnalysis.length > 0 ? marketAnalysis[0] : null;

    if (hotel && !hotel.feature_rate_shopper) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center p-4 text-center">
                <div className="p-6 bg-muted rounded-full mb-6">
                    <ShieldAlert className="h-16 w-16 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-black text-foreground mb-2">Feature Locked</h2>
                <p className="text-muted-foreground mb-8 max-w-md font-medium">
                    Rate Shopper (v2.0 AI) is not included in your current plan. 
                    Please contact support or your account manager to enable real-time competitor tracking.
                </p>
                <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 px-8 py-6 text-lg font-bold">
                    Upgrade Now
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-4 md:p-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Rate Parity Tracker <span className="text-xs font-normal text-muted-foreground ml-2">(v2.0 AI)</span></h1>
                    <p className="text-muted-foreground">AI-Powered Rate Parity & Channel Intelligence.</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Add OTA Channel
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="ALL">All Platforms</TabsTrigger>
                    <TabsTrigger value="MAKEMYTRIP">MakeMyTrip</TabsTrigger>
                    <TabsTrigger value="AGODA">Agoda</TabsTrigger>
                </TabsList>

                {/* AI INSIGHTS CARD */}
                {todayAnalysis && (
                    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-950 border-blue-200 dark:border-slate-800">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-400">
                                <Sparkles className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                                AI Market Insight (Today)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">My Rate</p>
                                    <p className="text-2xl font-bold">₹{todayAnalysis.my_price}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Market Average</p>
                                    <p className="text-2xl font-bold">₹{todayAnalysis.average_market_price}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Position</p>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={
                                            todayAnalysis.market_position === 'Premium' ? 'default' :
                                                todayAnalysis.market_position === 'Budget' ? 'secondary' : 'outline'
                                        }>
                                            {todayAnalysis.market_position}
                                        </Badge>
                                        {todayAnalysis.market_position === 'Premium' && <TrendingUp className="h-4 w-4 text-red-500" />}
                                        {todayAnalysis.market_position === 'Budget' && <TrendingDown className="h-4 w-4 text-green-500" />}
                                        {todayAnalysis.market_position === 'Average' && <Minus className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                </div>
                                <div className="md:col-span-1">
                                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Recommendation</p>
                                    <p className="text-sm text-foreground italic mt-1">
                                        "{todayAnalysis.suggestion}"
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Main Chart Card */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Price Comparison (Next 7 Days)</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[400px] w-full">
                            {isLoading ? (
                                <div className="flex h-full items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis
                                            dataKey="date"
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
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                                            labelStyle={{ color: 'var(--foreground)' }}
                                        />
                                        <Legend />

                                        {/* My Hotel Line */}
                                        <Line
                                            type="monotone"
                                            dataKey="My Hotel"
                                            stroke="hsl(var(--primary))"
                                            strokeWidth={3}
                                            activeDot={{ r: 8 }}
                                        />

                                        {/* Competitor Lines */}
                                        {filteredChartNames.map((name, index) => (
                                            <Line
                                                key={name}
                                                type="monotone"
                                                dataKey={name}
                                                stroke={colors[index % colors.length]}
                                                strokeWidth={2}
                                                connectNulls={true}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground">
                                    No rate data available. Add an OTA channel to start tracking.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Detailed Table Card */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Detailed Rate Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RateTable data={tableData} competitors={filteredChartNames} />
                    </CardContent>
                </Card>

                {/* Competitors List */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredCompetitors.map(comp => (
                        <Card key={comp.id}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {comp.name}
                                </CardTitle>
                                <Badge variant={comp.source === 'AGODA' ? 'destructive' : 'secondary'}>{comp.source}</Badge>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground mb-4 truncate" title={comp.url}>
                                    {comp.url}
                                </div>
                                
                                {/* Status Information */}
                                <div className="text-xs mb-4 flex flex-col gap-1">
                                    {comp.last_scrape_status === 'running' && (
                                        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Scraping rates headlessly...
                                        </div>
                                    )}
                                    {comp.last_scrape_status === 'failed' && (
                                        <div className="text-destructive font-medium flex flex-col gap-0.5">
                                            <span className="flex items-center gap-1">❌ Scrape failed</span>
                                            <span className="text-[10px] text-muted-foreground break-all" title={comp.last_scrape_error}>
                                                {comp.last_scrape_error && comp.last_scrape_error.length > 60 
                                                    ? `${comp.last_scrape_error.substring(0, 60)}...` 
                                                    : comp.last_scrape_error}
                                            </span>
                                        </div>
                                    )}
                                    {comp.last_scrape_status === 'success' && (
                                        <div className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                            ✅ Rates synced (last: {comp.last_scraped_at ? new Date(comp.last_scraped_at).toLocaleTimeString() : 'Just now'})
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        disabled={comp.last_scrape_status === 'running'}
                                        onClick={() => handleScrape(comp.id)}
                                    >
                                        {comp.last_scrape_status === 'running' ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                        )}
                                        {comp.last_scrape_status === 'running' ? "Syncing..." : "Refresh Rates"}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={comp.last_scrape_status === 'running'}
                                        onClick={() => handleDeleteCompetitor(comp.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </Tabs>

            {/* Add Channel Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Track New OTA Channel</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="c-name">Hotel Name on OTA</Label>
                            <Input id="c-name" value={newCompName} onChange={e => setNewCompName(e.target.value)} placeholder="e.g. Hotel Taj" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="c-url">OTA Booking URL</Label>
                            <Input id="c-url" value={newCompUrl} onChange={e => setNewCompUrl(e.target.value)} placeholder="https://makemytrip.com/..." />
                        </div>
                        <div className="grid gap-2">
                            <Label>Source Platform</Label>
                            <Select value={newCompSource} onValueChange={setNewCompSource}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select source" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MAKEMYTRIP">MakeMyTrip (Real-Time)</SelectItem>
                                    <SelectItem value="BOOKING" disabled>Booking.com (Coming Soon)</SelectItem>
                                    <SelectItem value="AGODA">Agoda (Real-Time)</SelectItem>
                                    <SelectItem value="EXPEDIA" disabled>Expedia (Coming Soon)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddCompetitor} disabled={isAdding}>
                            {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Start Tracking
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
