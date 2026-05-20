import React, { useState, useEffect } from 'react';
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
    const [competitors, setCompetitors] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [tableData, setTableData] = useState<any[]>([]);
    const [chartCompetitorNames, setChartCompetitorNames] = useState<string[]>([]);
    const [marketAnalysis, setMarketAnalysis] = useState<any[]>([]); // New State
    const [isLoading, setIsLoading] = useState(true);
    const [isScraping, setIsScraping] = useState(false);
    const [forceRefreshMap, setForceRefreshMap] = useState<Record<string, boolean>>({});
    // Initialize from localStorage or default to "ALL"
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem("rateShopperActiveTab") || "ALL");

    // Persist tab change
    useEffect(() => {
        localStorage.setItem("rateShopperActiveTab", activeTab);
    }, [activeTab]);

    // Add Dialog State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newCompName, setNewCompName] = useState('');
    const [newCompUrl, setNewCompUrl] = useState('');
    const [newCompSource, setNewCompSource] = useState('MAKEMYTRIP'); // Default to active platform

    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [compRes, rateRes, analysisRes] = await Promise.all([
                apiClient.get('/competitors'),
                apiClient.get('/competitors/rates/comparison', { start_date: startDate }),
                apiClient.get('/competitors/analysis', { start_date: startDate, days: '7' }) // Fetch Analysis
            ]);
            setCompetitors(compRes as any[]);
            setChartData((rateRes as any).chart_data);
            setTableData((rateRes as any).table_data);
            setChartCompetitorNames((rateRes as any).competitors);
            setMarketAnalysis(analysisRes as any[]);
        } catch (error) {
            console.error("Failed to fetch rate shopper data", error);
            toast.error("Failed to load data");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Real-time listener for extension updates
        const onScrapeComplete = () => {
            console.log("Scrape complete detected, refreshing UI...");
            fetchData();
        };

        window.addEventListener("SCRAPE_COMPLETE" as any, onScrapeComplete);
        return () => window.removeEventListener("SCRAPE_COMPLETE" as any, onScrapeComplete);
    }, [startDate]); // Refetch when date changes

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartDate(e.target.value);
    };

    const handleAddCompetitor = async () => {
        if (!newCompName || !newCompUrl) {
            toast.warning("Please enter both Name and URL");
            return;
        }
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
        }
    };

    const handleScrape = async (id: string, force: boolean = false) => {
        setIsScraping(true);
        try {
            // Find competitor details
            const comp = competitors.find(c => c.id === id);
            if (!comp) return;

            // Generate 7 Days of Scrape Jobs
            const scrapeJobs: any[] = [];

            for (let i = 0; i < 7; i++) {
                // Calculate Check-In (Start Date + i)
                const checkInDate = new Date();
                checkInDate.setDate(checkInDate.getDate() + i);

                // Calculate Check-Out (Check-In + 1)
                const checkOutDate = new Date(checkInDate);
                checkOutDate.setDate(checkOutDate.getDate() + 1);

                // Construct URL based on Source
                try {
                    let normalizedUrl = comp.url;
                    if (normalizedUrl && !normalizedUrl.startsWith('http')) {
                        normalizedUrl = 'https://' + normalizedUrl;
                    }
                    const urlObj = new URL(normalizedUrl);

                    // Clear params
                    ['checkin', 'checkIn', 'checkout', 'checkOut', 'los', 'rooms', 'adults', 'children', 'childs'].forEach(key => {
                        urlObj.searchParams.delete(key);
                    });

                    // Robust Source Detection
                    const isAgoda = comp.source?.toUpperCase() === 'AGODA' || normalizedUrl?.toLowerCase().includes('agoda');

                    if (isAgoda) {
                        const checkInIso = checkInDate.toISOString().split('T')[0];
                        urlObj.searchParams.set('checkIn', checkInIso);
                        urlObj.searchParams.set('los', '1');
                        urlObj.searchParams.set('rooms', '1');
                        urlObj.searchParams.set('adults', '1');
                    } else {
                        const checkInStr = String(checkInDate.getMonth() + 1).padStart(2, '0') + String(checkInDate.getDate()).padStart(2, '0') + checkInDate.getFullYear();
                        const checkOutStr = String(checkOutDate.getMonth() + 1).padStart(2, '0') + String(checkOutDate.getDate()).padStart(2, '0') + checkOutDate.getFullYear();
                        urlObj.searchParams.set('checkin', checkInStr);
                        urlObj.searchParams.set('checkout', checkOutStr);
                    }

                    scrapeJobs.push({
                        id: comp.id,
                        name: `${comp.name} (Day ${i + 1}) [${isAgoda ? 'Agoda' : 'MMT'}]`,
                        url: urlObj.toString().replace(/\+/g, '%20')
                    });
                } catch (e) {
                    console.error("Invalid URL:", comp.url, e);
                    toast.error(`Invalid URL format for ${comp.name}`);
                }
            }

            // --- Freshness Check (Postgres Based) ---
            const formatForBackend = (job: any) => {
                try {
                    const u = new URL(job.url);
                    let d = u.searchParams.get("checkIn"); // Agoda
                    if (!d) {
                        const mmt = u.searchParams.get("checkin"); // 01252026
                        if (mmt && mmt.length === 8) d = `${mmt.substring(4, 8)}-${mmt.substring(0, 2)}-${mmt.substring(2, 4)}`;
                    }
                    return { competitor_id: job.id, check_in_date: d };
                } catch (e) { return { competitor_id: job.id, check_in_date: null }; }
            };

            const checkList = scrapeJobs.map(formatForBackend).filter(x => x.check_in_date);

            let jobsToDispatch = scrapeJobs;

            if (!force) {
                toast.info("Checking Database Freshness...");
                try {
                    const res = await apiClient.post('/competitors/check_freshness', checkList) as any;
                    const neededJobs = res.jobs_to_scrape; // FIXED: no .data
                    const cachedCount = res.cached_count; // FIXED: no .data

                    if (cachedCount > 0) {
                        toast.success(`Found ${cachedCount} valid rates in DB!`);
                        setTimeout(() => fetchData(), 500);
                    }

                    if (neededJobs.length === 0) {
                        toast.success("Current rates are fresh (last 24h). Click again to force re-scrape.");
                        setForceRefreshMap(prev => ({ ...prev, [id]: true }));
                        setIsScraping(false);
                        return;
                    }

                    // Reset force if we found jobs to scrape
                    setForceRefreshMap(prev => ({ ...prev, [id]: false }));

                    // Filter Scrape Jobs if API success
                    jobsToDispatch = scrapeJobs.filter(job => {
                        const info = formatForBackend(job);
                        return neededJobs.some((n: any) => n.competitor_id === info.competitor_id && n.check_in_date === info.check_in_date);
                    });

                } catch (err) {
                    console.warn("Freshness check failed, proceeding with full scrape:", err);
                    toast.error("Freshness check failed. Starting full scrape.");
                }
            } else {
                toast.info("Force Scrape Initialized (Bypassing Freshness Check)");
            }

            if (jobsToDispatch.length > 0) {
                const onPing = () => {
                    toast.success("Extension is Active!");
                    window.removeEventListener("PING_PONG" as any, onPing);
                };
                const onAck = () => {
                    toast.success(`Extension acknowledged ${jobsToDispatch.length} jobs`);
                    window.removeEventListener("SCRAPE_ACK" as any, onAck);
                    window.removeEventListener("SCRAPE_ERROR" as any, onError);
                };
                const onError = (e: any) => {
                    toast.error(`Extension error: ${e.detail?.error || 'Unknown Error'}`);
                    setIsScraping(false);
                    window.removeEventListener("SCRAPE_ACK" as any, onAck);
                    window.removeEventListener("SCRAPE_ERROR" as any, onError);
                    window.removeEventListener("PING_PONG" as any, onPing);
                };

                window.addEventListener("PING_PONG" as any, onPing);
                window.addEventListener("SCRAPE_ACK" as any, onAck);
                window.addEventListener("SCRAPE_ERROR" as any, onError);

                // Ping extension before sending heavy payload
                window.dispatchEvent(new CustomEvent("EXTENSION_PING"));

                setTimeout(() => {
                    const event = new CustomEvent("INITIATE_SCRAPE", {
                        detail: {
                            jobs: jobsToDispatch,
                            token: tokenStorage.getAccessToken()
                        }
                    });
                    window.dispatchEvent(event);
                }, 300); // 300ms to allow ping to settle

                toast.info(`Scraping ${jobsToDispatch.length} fresh rates...`);

                // Fail-safe cleanup for scraping state
                let timeLeft = 60;
                const timer = setInterval(() => {
                    timeLeft -= 5;
                    if (timeLeft <= 0) {
                        clearInterval(timer);
                        fetchData();
                        setIsScraping(false);
                        toast.success("Scraping period complete.");
                    }
                }, 5000);
            } else {
                setIsScraping(false);
            }

        } catch (error) {
            console.error(error);
            setIsScraping(false);
            toast.error("Failed to initiate scraping");
        }
    };

    const handleDeleteCompetitor = async (id: string) => {
        if (!confirm("Are you sure you want to remove this competitor?")) return;
        try {
            await apiClient.delete(`/competitors/${id}`);
            toast.success("Competitor removed");
            setCompetitors(prev => prev.filter(c => c.id !== id));
            fetchData(); // Refresh all data to clear from table/chart
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
                    <h1 className="text-2xl font-bold tracking-tight">Competitor Rate Shopper <span className="text-xs font-normal text-muted-foreground ml-2">(v2.0 AI)</span></h1>
                    <p className="text-muted-foreground">AI-Powered Market Analysis & Rate Intelligence.</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Competitor
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
                    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-blue-800">
                                <Sparkles className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                                AI Market Insight (Today)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-sm text-blue-600 font-medium">My Rate</p>
                                    <p className="text-2xl font-bold">₹{todayAnalysis.my_price}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-blue-600 font-medium">Market Average</p>
                                    <p className="text-2xl font-bold">₹{todayAnalysis.average_market_price}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-blue-600 font-medium">Position</p>
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
                                    <p className="text-sm text-blue-600 font-medium">Recommendation</p>
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
                                    No rate data available. Add a competitor to start tracking.
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
                                <div className="flex gap-2">
                                    <Button
                                        variant={forceRefreshMap[comp.id] ? "secondary" : "outline"}
                                        size="sm"
                                        className="flex-1"
                                        disabled={isScraping}
                                        onClick={() => handleScrape(comp.id, forceRefreshMap[comp.id])}
                                    >
                                        {isScraping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                        {forceRefreshMap[comp.id] ? "Force Scrape" : "Refresh Rates"}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={isScraping}
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

            {/* Add Competitor Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Track New Competitor</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="c-name">Competitor Name</Label>
                            <Input id="c-name" value={newCompName} onChange={e => setNewCompName(e.target.value)} placeholder="e.g. Hotel Taj" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="c-url">Booking URL</Label>
                            <Input id="c-url" value={newCompUrl} onChange={e => setNewCompUrl(e.target.value)} placeholder="https://booking.com/..." />
                        </div>
                        <div className="grid gap-2">
                            <Label>Source</Label>
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
                        <Button onClick={handleAddCompetitor}>Add Competitor</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
