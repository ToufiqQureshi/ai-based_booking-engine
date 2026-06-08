import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiClient, ApiClientError } from '@/api/client';
import { Loader2, Plus, RefreshCw, Trash2, TrendingUp, TrendingDown, Minus, Sparkles, Activity, Clock, Square, AlertTriangle, WifiOff, KeyRound, X, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { RateTable } from '@/components/dashboard/RateTable';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

export default function RatesShopper() {
    const { hotel, user } = useAuth();
    const queryClient = useQueryClient();
    const [lastStatuses, setLastStatuses] = useState<Record<string, string>>({});
    // Tracks which (comp_id, date) pairs we've already toasted so we don't re-fire on re-renders
    const seenProgressRef = useRef<Record<string, Set<string>>>({});
    // Page-level error banner (persistent — not just a toast)
    const [pageError, setPageError] = useState<{ type: 'service' | 'network' | 'limit' | 'load'; title: string; message: string } | null>(null);
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem("rateShopperActiveTab") || "ALL");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newCompName, setNewCompName] = useState('');
    const [newCompUrl, setNewCompUrl] = useState('');
    const [newCompSource, setNewCompSource] = useState('MAKEMYTRIP');
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        localStorage.setItem("rateShopperActiveTab", activeTab);
    }, [activeTab]);

    // Competitors list — lightweight endpoint, polled every 5s while any scrape is running
    // so status badges and the Stop button reflect reality in near-real-time.
    const {
        data: competitorsData,
        isLoading: isCompLoading,
        isError: isCompError,
        error: compError,
    } = useQuery<any[]>({
        queryKey: ['competitors'],
        queryFn: () => apiClient.get('/competitors') as Promise<any[]>,
        staleTime: 0,
        gcTime: 1000 * 60 * 30,
        refetchInterval: 5000, // cheap endpoint — always poll so status stays live
    });
    const competitors: any[] = competitorsData ?? [];
    const isAnyRunning = competitors.some((c: any) => c.last_scrape_status === 'running');

    // Rates + analysis — polled every 5s while scraping so each committed day appears
    // in the table/chart immediately (backend commits per-day, not only at the end).
    // When no scrape is running the interval stops; a fresh fetch fires automatically
    // when isAnyRunning flips false (queryKey changes).
    const {
        data: ratesData,
        isLoading: isRatesLoading,
        isFetching: isRatesFetching,
        isError: isRatesError,
        error: ratesError,
    } = useQuery<any>({
        queryKey: ['ratesData', startDate, isAnyRunning],
        queryFn: async () => {
            const [rateRes, analysisRes] = await Promise.all([
                apiClient.get('/competitors/rates/comparison', { start_date: startDate }),
                apiClient.get('/competitors/analysis', { start_date: startDate, days: '7' }),
            ]);
            return {
                chartData: (rateRes as any).chart_data,
                tableData: (rateRes as any).table_data,
                chartCompetitorNames: (rateRes as any).competitors,
                marketAnalysis: analysisRes as any[],
            };
        },
        staleTime: 0,
        gcTime: 1000 * 60 * 60,
        refetchInterval: isAnyRunning ? 2000 : false,
    });

    const isLoading = isCompLoading || isRatesLoading;

    // Set a persistent page banner when initial data load fails
    useEffect(() => {
        if (isCompError && compError) {
            const err = compError as any;
            const status = err?.status;
            if (status === 503) {
                setPageError({ type: 'service', title: 'Rate Sync Service Unavailable', message: err.message || 'Decodo API is not configured. Contact your administrator.' });
            } else if (!navigator.onLine || err?.name === 'AbortError') {
                setPageError({ type: 'network', title: 'Network Error', message: 'Could not reach the server. Check your connection.' });
            } else {
                setPageError({ type: 'load', title: 'Failed to Load Competitors', message: err.message || 'Something went wrong loading your tracked channels.' });
            }
        }
    }, [isCompError, compError]);

    // Maps backend error reason codes to human-readable messages shown in the card
    const friendlyError = (raw: string | null | undefined): string => {
        if (!raw) return 'Unknown error occurred';
        if (raw.includes('decodo_not_configured') || raw.includes('not configured')) return 'Rate sync API key is not set up — contact your administrator.';
        if (raw.includes('decodo_613') || raw.includes('target_blocked')) return 'Blocked by OTA anti-bot protection. Try again in a few hours.';
        if (raw.includes('shield_blocked') || raw.includes('Access Denied')) return 'OTA security (Akamai) blocked the request. Try again later.';
        if (raw.includes('price_element_not_found')) return 'Could not find the price on the OTA page. The URL may be outdated — try re-adding the competitor.';
        if (raw.includes('price_parse_failed')) return 'Found the price element but could not read the value. OTA may have changed their layout.';
        if (raw.includes('empty_api_results')) return 'Scraper returned no data. The OTA page may have changed or the URL is invalid.';
        if (raw.includes('request_error')) return 'Network request to Decodo failed. This is usually temporary — try again.';
        if (raw.includes('API_status_')) {
            const code = raw.match(/API_status_(\d+)/)?.[1];
            return `Decodo returned HTTP ${code}. This is usually temporary — try again in a few minutes.`;
        }
        if (raw.includes('timed out') || raw.includes('timeout')) return 'Scrape timed out. The server may have restarted — click Refresh to retry.';
        if (raw.includes('Stopped by you')) return raw; // user-initiated, show as-is
        if (raw.includes('Successfully scraped')) return raw; // partial success, show as-is
        if (raw.includes('Internal system crash')) return 'An unexpected server error occurred. Please try again.';
        return raw;
    };

    const chartData = ratesData?.chartData ?? [];
    const tableData = ratesData?.tableData ?? [];
    const chartCompetitorNames = ratesData?.chartCompetitorNames ?? [];
    const marketAnalysis = ratesData?.marketAnalysis ?? [];

    const maxCompetitors: number = (hotel as any)?.max_competitors ?? 5;
    const isAtCompetitorLimit = competitors.length >= maxCompetitors;

    // OTA analytics usage — cost transparency. Each rate refresh consumes
    // metered analytics capacity, so the hotelier should be able to see
    // exactly how many rate checks have been used on their behalf.
    const { data: usageData } = useQuery<any>({
        queryKey: ['rateShopperUsage'],
        queryFn: () => apiClient.get('/competitors/usage'),
        enabled: !!hotel?.feature_rate_shopper,
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 60,
    });

    // Auto-sync schedule — the hotelier (not us) decides what local hour
    // the daily competitor rate refresh runs at.
    const { data: scheduleData } = useQuery<any>({
        queryKey: ['rateShopperSchedule'],
        queryFn: () => apiClient.get('/competitors/schedule'),
        enabled: !!hotel?.feature_rate_shopper,
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 60,
    });

    const [scheduleHour, setScheduleHour] = useState<string>('off');
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);
    const canManageSchedule = user?.role === 'OWNER' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';

    useEffect(() => {
        if (!scheduleData) return;
        setScheduleHour(
            scheduleData.scrape_hour === null || scheduleData.scrape_hour === undefined
                ? 'off'
                : String(scheduleData.scrape_hour)
        );
    }, [scheduleData]);

    const formatHour = (hour: number) => {
        const period = hour < 12 ? 'AM' : 'PM';
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        return `${displayHour}:00 ${period}`;
    };

    const handleScheduleChange = async (value: string) => {
        const previous = scheduleHour;
        setScheduleHour(value);
        setIsSavingSchedule(true);
        try {
            const scrape_hour = value === 'off' ? null : parseInt(value, 10);
            const updated = await apiClient.put<any>('/competitors/schedule', { scrape_hour });
            queryClient.setQueryData(['rateShopperSchedule'], updated);
            toast.success(
                scrape_hour === null
                    ? "Auto-sync turned off. You can still refresh competitors manually anytime."
                    : `Auto-sync scheduled for ${formatHour(scrape_hour)} (${updated?.timezone || 'your property timezone'}) every day.`
            );
        } catch (error: any) {
            console.error(error);
            setScheduleHour(previous);
            toast.error(error.message || "Failed to update auto-sync schedule");
        } finally {
            setIsSavingSchedule(false);
        }
    };

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
                // Refresh usage counter now that new requests were consumed
                queryClient.invalidateQueries({ queryKey: ['rateShopperUsage'] });
            }
        });
        
        const hasChanged = Object.keys(newStatuses).some(id => newStatuses[id] !== lastStatuses[id]);
        if (hasChanged || Object.keys(lastStatuses).length === 0) {
            setLastStatuses(newStatuses);
        }
    }, [competitors, lastStatuses]);

    // Poll per-day scraping progress for running competitors.
    // Every 2s we check /competitors/{id}/progress and fire a toast the moment
    // a new date+price lands — gives the hotelier live feedback instead of
    // waiting for the entire 7-day run to complete.
    useEffect(() => {
        if (!isAnyRunning) {
            seenProgressRef.current = {};
            return;
        }

        const runningComps = competitors.filter((c: any) => c.last_scrape_status === 'running');
        if (!runningComps.length) return;

        const intervalId = setInterval(async () => {
            for (const comp of runningComps) {
                try {
                    const progress = await apiClient.get(`/competitors/${comp.id}/progress`) as Array<{
                        date: string;
                        price: number;
                        is_sold_out: boolean;
                    }>;
                    if (!seenProgressRef.current[comp.id]) {
                        seenProgressRef.current[comp.id] = new Set();
                    }
                    for (const item of progress) {
                        if (!seenProgressRef.current[comp.id].has(item.date)) {
                            seenProgressRef.current[comp.id].add(item.date);
                            const dateLabel = new Date(item.date + 'T00:00:00').toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short'
                            });
                            if (item.is_sold_out) {
                                toast.warning(`${comp.name} · ${dateLabel} — Sold Out`, { duration: 4000 });
                            } else {
                                toast.success(
                                    `${comp.name} · ${dateLabel} — ₹${item.price.toLocaleString('en-IN')}`,
                                    { duration: 4000 }
                                );
                            }
                        }
                    }
                } catch {
                    // silent — progress endpoint is best-effort, don't spam errors
                }
            }
        }, 2000);

        return () => clearInterval(intervalId);
    }, [isAnyRunning, competitors]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartDate(e.target.value);
    };

    const [isAdding, setIsAdding] = useState(false);
    const handleAddCompetitor = async () => {
        if (isAdding || !newCompName || !newCompUrl) {
            toast.warning("Please enter both Name and URL");
            return;
        }
        if (!/^https?:\/\//i.test(newCompUrl.trim())) {
            toast.warning("OTA Booking URL must start with http:// or https://");
            return;
        }
        setIsAdding(true);
        try {
            await apiClient.post('/competitors', {
                name: newCompName,
                url: newCompUrl,
                source: newCompSource,
            });
            setIsAddOpen(false);
            setNewCompName('');
            setNewCompUrl('');
            toast.success("Competitor added successfully");
            queryClient.invalidateQueries({ queryKey: ['competitors'] });
        } catch (error: any) {
            console.error(error);
            const msg: string = error.message || "Failed to add competitor";
            if (msg.startsWith("COMPETITOR_LIMIT_REACHED:")) {
                const limit = msg.split(":")[1];
                toast.error(`Competitor limit reached (${limit}). Contact support@staybooker.ai to increase your limit.`);
            } else {
                toast.error(msg);
            }
        } finally {
            setIsAdding(false);
        }
    };

    const handleScrape = async (id: string) => {
        setPageError(null);
        toast.info("Scraping initiated on the server...");
        try {
            await apiClient.post(`/competitors/${id}/scrape`, {});
            toast.success("Server-side scraping started in the background. Rates will be updated shortly!");
            queryClient.invalidateQueries({ queryKey: ['competitors'] });
            queryClient.invalidateQueries({ queryKey: ['ratesData'] });
        } catch (error: any) {
            console.error(error);
            if (error instanceof ApiClientError) {
                if (error.status === 503) {
                    setPageError({
                        type: 'service',
                        title: 'Rate Sync Service Unavailable',
                        message: error.message || 'The Decodo scraping API is not configured or is down. Please contact your administrator to set up the API key.',
                    });
                } else if (error.status === 429) {
                    setPageError({
                        type: 'limit',
                        title: 'Cooldown in Progress',
                        message: error.message || 'Please wait a few minutes before refreshing this competitor again.',
                    });
                } else if (error.status === 409) {
                    toast.warning(error.message || 'A scrape is already running for this competitor.');
                } else if (error.status === 0 || error.name === 'TypeError') {
                    setPageError({
                        type: 'network',
                        title: 'Network Error',
                        message: 'Could not reach the server. Please check your internet connection and try again.',
                    });
                } else {
                    toast.error(error.message || 'Failed to initiate scraping');
                }
            } else if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
                setPageError({
                    type: 'network',
                    title: 'Request Timed Out',
                    message: 'The server took too long to respond. Please try again.',
                });
            } else {
                toast.error(error.message || 'Failed to initiate scraping');
            }
        }
    };

    const handleStopScrape = async (id: string) => {
        try {
            await apiClient.post(`/competitors/${id}/stop`, {});
            toast.success("Stopping… rates already fetched are saved.");
            queryClient.invalidateQueries({ queryKey: ['competitors'] });
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to stop the scrape");
        }
    };

    const handleDeleteCompetitor = async (id: string) => {
        if (!confirm("Are you sure you want to remove this competitor?")) return;
        try {
            await apiClient.delete(`/competitors/${id}`);
            toast.success("Competitor removed");
            queryClient.invalidateQueries({ queryKey: ['competitors'] });
            queryClient.invalidateQueries({ queryKey: ['ratesData'] });
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete competitor");
        }
    };

    const handleToggleSchedule = async (id: string, isScheduled: boolean) => {
        try {
            await apiClient.patch(`/competitors/${id}/schedule`, { is_scheduled: isScheduled });
            toast.success(isScheduled ? "Daily schedule enabled for this channel!" : "Daily schedule disabled.");
            queryClient.invalidateQueries({ queryKey: ['competitors'] });
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to update schedule status");
        }
    };

    // Colors for graph
    const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#d0ed57"];

    // Filter Data based on Active Tab
    const filteredCompetitors = competitors.filter(c => {
        if (activeTab === "ALL") return true;
        const isAgoda = c.source?.toUpperCase() === 'AGODA' || c.url?.toLowerCase().includes('agoda');
        const isMmt = c.source?.toUpperCase() === 'MAKEMYTRIP' || c.url?.toLowerCase().includes('makemytrip');
        if (activeTab === "AGODA") return isAgoda;
        if (activeTab === "MAKEMYTRIP") return isMmt;
        return true;
    });

    const filteredChartNames = chartCompetitorNames.filter(name => {
        if (activeTab === "ALL") return true;
        const comp = competitors.find(c => c.name === name);
        if (!comp) return true;
        const isAgoda = comp.source?.toUpperCase() === 'AGODA' || comp.url?.toLowerCase().includes('agoda');
        const isMmt = comp.source?.toUpperCase() === 'MAKEMYTRIP' || comp.url?.toLowerCase().includes('makemytrip');
        if (activeTab === "AGODA") return isAgoda;
        if (activeTab === "MAKEMYTRIP") return isMmt;
        return true;
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
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        {competitors.length}/{maxCompetitors} channels
                    </span>
                    {isAtCompetitorLimit ? (
                        <a
                            href="mailto:support@staybooker.ai?subject=Increase%20competitor%20limit"
                            className="inline-flex items-center gap-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-3 py-2 transition-colors"
                        >
                            <ShieldAlert className="h-4 w-4" /> Contact to Add More
                        </a>
                    ) : (
                        <Button onClick={() => setIsAddOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add OTA Channel
                        </Button>
                    )}
                </div>
            </div>

            {/* ── Page-level error banner ── */}
            {pageError && (
                <Alert
                    variant="destructive"
                    className={
                        pageError.type === 'limit'
                            ? 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 [&>svg]:text-amber-600'
                            : pageError.type === 'service'
                            ? 'border-red-400 bg-red-50 dark:bg-red-950'
                            : 'border-destructive/50 bg-destructive/5'
                    }
                >
                    {pageError.type === 'service' && <KeyRound className="h-4 w-4" />}
                    {pageError.type === 'network' && <WifiOff className="h-4 w-4" />}
                    {(pageError.type === 'load' || pageError.type === 'limit') && <AlertTriangle className="h-4 w-4" />}
                    <div className="flex items-start justify-between gap-4 w-full">
                        <div className="flex-1">
                            <AlertTitle>{pageError.title}</AlertTitle>
                            <AlertDescription className="mt-1">{pageError.message}</AlertDescription>
                        </div>
                        <button
                            onClick={() => setPageError(null)}
                            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5"
                            aria-label="Dismiss"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </Alert>
            )}

            {/* ── Competitors failed to load — full inline error state ── */}
            {isCompError && !competitors.length && (
                <Card className="border-destructive/40 bg-destructive/5">
                    <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                        <WifiOff className="h-10 w-10 text-destructive opacity-60" />
                        <p className="font-semibold text-destructive">Could not load tracked channels</p>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            {(compError as any)?.message || 'Failed to connect to the server. Please refresh the page.'}
                        </p>
                        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['competitors'] })}>
                            <RotateCcw className="h-4 w-4 mr-2" /> Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* OTA Analytics Usage & Auto-Sync Schedule */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            Staybooker OTA Analytics
                        </CardTitle>
                        <CardDescription>
                            Every rate refresh pulls live pricing from the OTAs through Staybooker's
                            analytics engine — each pull uses one rate check. Here's exactly what
                            you've used.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-8">
                            <div>
                                <p className="text-sm text-muted-foreground">Today</p>
                                <p className="text-2xl font-bold">{usageData?.today ?? 0}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Last 30 Days</p>
                                <p className="text-2xl font-bold">{usageData?.last_30_days ?? 0}</p>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                            Each "Refresh Rates" click checks ~7 days of pricing for one competitor —
                            roughly 7 requests.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            Daily Auto-Sync Schedule
                        </CardTitle>
                        <CardDescription>
                            Pick the hour — in your property's local time — we automatically refresh
                            every tracked competitor's rates each day. Choose "Off" to refresh manually only.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {canManageSchedule ? (
                            <>
                                <div className="flex items-center gap-3">
                                    <Select value={scheduleHour} onValueChange={handleScheduleChange} disabled={isSavingSchedule}>
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue placeholder="Select time" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="off">Off (manual only)</SelectItem>
                                            {Array.from({ length: 24 }, (_, h) => (
                                                <SelectItem key={h} value={String(h)}>{formatHour(h)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {isSavingSchedule && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                </div>
                                <p className="text-xs text-muted-foreground mt-3">
                                    Time shown is in your property's timezone ({scheduleData?.timezone || 'Asia/Kolkata'}).
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {scheduleData?.scrape_hour != null
                                    ? `Auto-sync runs daily at ${formatHour(scheduleData.scrape_hour)} (${scheduleData?.timezone || 'property timezone'}).`
                                    : "Auto-sync is currently off — rates are refreshed manually only."}
                                {" "}Only Owners and Managers can change this.
                            </p>
                        )}
                    </CardContent>
                </Card>
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
                        <div className="flex items-center justify-between">
                            <CardTitle>Price Comparison (Next 7 Days)</CardTitle>
                            {isRatesFetching && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Updating...
                                </span>
                            )}
                        </div>
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
                                <div className="mb-3 flex flex-col gap-2">
                                    {comp.last_scrape_status === 'running' && (
                                        <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 font-medium">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                                            Scraping rates headlessly… prices will appear below as each date completes.
                                        </div>
                                    )}
                                    {comp.last_scrape_status === 'failed' && (
                                        <Alert variant="destructive" className="py-2 px-3">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            <AlertTitle className="text-xs font-semibold">Scrape Failed</AlertTitle>
                                            <AlertDescription className="text-xs mt-0.5 leading-snug">
                                                {friendlyError(comp.last_scrape_error)}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    {comp.last_scrape_status === 'success' && comp.last_scrape_error && (
                                        // Partial success (some days failed) or stopped-by-user message
                                        <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                                            ⚠ {friendlyError(comp.last_scrape_error)}
                                        </div>
                                    )}
                                    {comp.last_scrape_status === 'success' && !comp.last_scrape_error && (
                                        <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-medium">
                                            ✅ Rates synced — {comp.last_scraped_at ? new Date(comp.last_scraped_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                        </div>
                                    )}
                                    {!comp.last_scrape_status && (
                                        <div className="text-xs text-muted-foreground">No data yet — click Refresh Rates to start.</div>
                                    )}
                                </div>

                                {/* Scheduler Configuration */}
                                <div className="flex items-center justify-between mb-4 bg-muted/30 p-2 rounded-lg border border-dashed border-muted">
                                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                        🕒 Daily Auto-refresh
                                    </span>
                                    <Button
                                        variant={comp.is_scheduled ? "default" : "outline"}
                                        size="sm"
                                        className="h-7 px-3 text-[10px]"
                                        disabled={comp.last_scrape_status === 'running'}
                                        onClick={() => handleToggleSchedule(comp.id, !comp.is_scheduled)}
                                    >
                                        {comp.is_scheduled ? "Enabled" : "Disabled"}
                                    </Button>
                                </div>

                                <div className="flex gap-2">
                                    {comp.last_scrape_status === 'running' ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                                            onClick={() => handleStopScrape(comp.id)}
                                        >
                                            <Square className="mr-2 h-4 w-4" />
                                            Stop (keep fetched)
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleScrape(comp.id)}
                                        >
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Refresh Rates
                                        </Button>
                                    )}
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
                                    <SelectItem value="AGODA" disabled>Agoda (Coming Soon)</SelectItem>
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
