import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/api/client';
import { Loader2, Users, Building, Activity, ShieldAlert, CheckCircle, XCircle, Plus, Calendar, Sparkles, TrendingUp, Zap, ArrowUpRight, ShieldCheck, Globe } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from '@/lib/utils';

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [hotels, setHotels] = useState<any[]>([]);
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
    const [selectedHotelId, setSelectedHotelId] = useState('');
    const [subFormData, setSubFormData] = useState({
        plan_name: 'Pro',
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: 2500
    });
    const { toast } = useToast();

    const loadData = async () => {
        try {
            const [statsRes, usersRes, hotelsRes, subsRes] = await Promise.all([
                apiClient.get('/admin/stats'),
                apiClient.get('/admin/users'),
                apiClient.get('/admin/hotels'),
                apiClient.get('/admin/subscriptions')
            ]);
            setStats(statsRes);
            setUsers(usersRes as any[]);
            setHotels(hotelsRes as any[]);
            setSubscriptions(subsRes as any[]);
        } catch (error) {
            console.error("Admin Load Failed", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleHotelUpdate = async (hotelId: string, field: string, value: boolean) => {
        try {
            await apiClient.patch(`/admin/hotels/${hotelId}`, { [field]: value });
            setHotels(prev => prev.map(h => h.id === hotelId ? { ...h, [field]: value } : h));
            toast({
                title: "Protocol Updated",
                description: "Security and feature flags synchronized successfully."
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Update Failed",
                description: "Encountered a restriction while modifying hotel parameters."
            });
        }
    };

    const handleCreateSub = async () => {
        if (!selectedHotelId) {
            toast({ variant: "destructive", title: "Target Missing", description: "Specify a hotel entity to initialize subscription." });
            return;
        }
        try {
            await apiClient.post('/admin/subscriptions', {
                hotel_id: selectedHotelId,
                ...subFormData,
                end_date: new Date(subFormData.end_date).toISOString()
            });
            toast({ title: "License Issued", description: "Premium access period has been successfully extended." });
            setIsSubDialogOpen(false);
            loadData();
        } catch (error) {
            toast({ variant: "destructive", title: "Deployment Error", description: "Failed to finalize the subscription protocol." });
        }
    };

    const getHotelName = (id: string) => hotels.find(h => h.id === id)?.name || id;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen space-y-4 bg-indigo-950">
                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse" />
                    <Loader2 className="h-12 w-12 animate-spin text-indigo-400 relative" />
                </div>
                <span className="text-indigo-200/40 text-xs font-black uppercase tracking-[0.2em]">Synchronizing Master Node...</span>
            </div>
        );
    }

    if (!stats) return <div className="p-8 text-rose-500 font-black">Access Denied. Elevated Privileges Required.</div>;

    const scrapeData = [
        { name: 'Agoda', value: stats.scraping.sources.Agoda },
        { name: 'MMT', value: stats.scraping.sources.MakeMyTrip },
        { name: 'Direct', value: stats.hotels.total * 5 }, // Placeholder for direct
    ];

    return (
        <div className="p-6 sm:p-10 space-y-10 bg-indigo-50/30 min-h-screen pb-20">
            {/* Super Admin Hero Header */}
            <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-indigo-950 via-slate-950 to-violet-950 p-8 sm:p-12 shadow-2xl">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-violet-600/20 rounded-full blur-[100px]" />
                
                <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            System Authority: Elevated
                        </div>
                        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-white">
                            Global Command <span className="text-indigo-400">Center</span>
                        </h1>
                        <p className="text-indigo-200/50 max-w-2xl text-base font-medium leading-relaxed">
                            Orchestrating <span className="text-white">{stats.hotels.total}</span> enterprise hotel entities across global markets. 
                            Monitoring real-time scraping clusters and subscription lifecycles.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="flex flex-col items-end px-6 py-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Infrastructure Health</span>
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-2xl font-black text-white tracking-tighter uppercase">{stats.system_status}</span>
                            </div>
                        </div>
                        <Button 
                            className="h-16 px-10 rounded-[24px] bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_20px_40px_rgba(99,102,241,0.3)] font-black uppercase tracking-widest text-xs flex gap-3 group transition-all active:scale-95"
                            onClick={() => setIsSubDialogOpen(true)}
                        >
                            <Plus className="h-5 w-5" />
                            Issue License
                        </Button>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-8">
                <div className="sticky top-6 z-40 flex justify-center">
                    <TabsList className="h-16 p-2 bg-white/60 backdrop-blur-2xl border border-indigo-100/50 rounded-[24px] shadow-xl">
                        <TabsTrigger value="overview" className="rounded-2xl px-8 font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">Overview</TabsTrigger>
                        <TabsTrigger value="hotels" className="rounded-2xl px-8 font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">Hotels</TabsTrigger>
                        <TabsTrigger value="subscriptions" className="rounded-2xl px-8 font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">Subscriptions</TabsTrigger>
                        <TabsTrigger value="users" className="rounded-2xl px-8 font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">Security</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="space-y-8 animate-enter">
                    {/* High-Impact Stats Grid */}
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="rounded-[32px] border-none bg-white/70 backdrop-blur-xl shadow-[0_20px_50px_rgba(79,70,229,0.08)] overflow-hidden relative group">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Users className="h-20 w-20 text-indigo-600" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Total Hoteliers</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-black text-indigo-950 tracking-tighter mb-1">{stats.users.total}</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    {stats.users.active_now} currently operational
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[32px] border-none bg-white/70 backdrop-blur-xl shadow-[0_20px_50px_rgba(79,70,229,0.08)] overflow-hidden relative group">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Building className="h-20 w-20 text-violet-600" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400">Mapped Entities</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-black text-indigo-950 tracking-tighter mb-1">{stats.hotels.total}</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-indigo-500">
                                    <TrendingUp className="w-3 h-3" />
                                    {stats.hotels.subscribed} active revenue streams
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[32px] border-none bg-white/70 backdrop-blur-xl shadow-[0_20px_50px_rgba(79,70,229,0.08)] overflow-hidden relative group">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Zap className="h-20 w-20 text-amber-600" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Scraping Velocity</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-black text-indigo-950 tracking-tighter mb-1">{stats.scraping.total_rates_24h}</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                                    <Activity className="w-3 h-3" />
                                    Health Index: {stats.scraping.health}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-8 md:grid-cols-2">
                        {/* Intelligence Charts */}
                        <Card className="rounded-[40px] border-none bg-white/80 backdrop-blur-xl shadow-xl p-6">
                            <CardHeader className="px-0 pt-0 pb-6">
                                <CardTitle className="text-lg font-black text-indigo-950 tracking-tight flex items-center gap-3">
                                    <Globe className="w-5 h-5 text-indigo-500" />
                                    Market Source Distribution
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[350px] p-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={scrapeData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#4f46e5" stopOpacity={1} />
                                                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.8} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 'bold', fontSize: 12 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 'bold', fontSize: 12 }} />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                        />
                                        <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={60}>
                                            {scrapeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill="url(#barGradient)" />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[40px] border-none bg-white/80 backdrop-blur-xl shadow-xl p-6 overflow-hidden">
                             <div className="absolute top-0 right-0 p-8">
                                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                    <TrendingUp className="h-6 w-6 text-emerald-600" />
                                </div>
                             </div>
                             <CardHeader className="px-0 pt-0 pb-6">
                                <CardTitle className="text-lg font-black text-indigo-950 tracking-tight">System Performance</CardTitle>
                             </CardHeader>
                             <CardContent className="h-[300px] p-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={[{v: 40}, {v: 70}, {v: 45}, {v: 90}, {v: 65}, {v: 85}]} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={4} fill="url(#areaGradient)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                             </CardContent>
                             <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100/50">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Optimized Response</span>
                                    <span className="text-xs font-bold text-emerald-600">99.9% Uptime</span>
                                </div>
                             </div>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="hotels" className="animate-enter">
                    <Card className="rounded-[40px] border-none bg-white/80 backdrop-blur-xl shadow-xl overflow-hidden">
                        <CardHeader className="p-8 border-b border-indigo-50">
                            <CardTitle className="text-2xl font-black text-indigo-950 tracking-tight">Master Hotel Registry</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-indigo-50 px-8">
                                        <TableHead className="pl-8 py-6 text-[10px] font-black uppercase tracking-widest text-indigo-400">Entity Details</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-indigo-400">System Status</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Market Intel</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Neural Engine</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Guest Logic</TableHead>
                                        <TableHead className="pr-8 text-[10px] font-black uppercase tracking-widest text-indigo-400">Administration</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {hotels.map(h => (
                                        <TableRow key={h.id} className="group hover:bg-indigo-50/30 transition-colors border-indigo-50">
                                            <TableCell className="pl-8 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-black text-indigo-950 tracking-tight">{h.name}</span>
                                                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-tighter bg-indigo-50/50 px-2 py-0.5 rounded-md w-fit">{h.slug}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={h.is_active}
                                                    onCheckedChange={(c) => handleHotelUpdate(h.id, 'is_active', c)}
                                                    className="data-[state=checked]:bg-emerald-500"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={h.feature_rate_shopper}
                                                    onCheckedChange={(c) => handleHotelUpdate(h.id, 'feature_rate_shopper', c)}
                                                    className="data-[state=checked]:bg-indigo-600"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={h.feature_ai_agent}
                                                    onCheckedChange={(c) => handleHotelUpdate(h.id, 'feature_ai_agent', c)}
                                                    className="data-[state=checked]:bg-violet-600"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={h.feature_guest_bot}
                                                    onCheckedChange={(c) => handleHotelUpdate(h.id, 'feature_guest_bot', c)}
                                                    className="data-[state=checked]:bg-amber-500"
                                                />
                                            </TableCell>
                                            <TableCell className="pr-8">
                                                <Button size="sm" variant="outline" className="rounded-xl border-indigo-100 text-indigo-600 font-bold hover:bg-indigo-600 hover:text-white transition-all gap-2" onClick={() => {
                                                    setSelectedHotelId(h.id);
                                                    setIsSubDialogOpen(true);
                                                }}>
                                                    <Calendar className="h-4 w-4" />
                                                    Renew License
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="subscriptions" className="animate-enter">
                    <Card className="rounded-[40px] border-none bg-white/80 backdrop-blur-xl shadow-xl overflow-hidden">
                        <CardHeader className="p-8 border-b border-indigo-50 flex flex-row items-center justify-between">
                            <CardTitle className="text-2xl font-black text-indigo-950 tracking-tight">Financial Protocol History</CardTitle>
                            <Button size="sm" className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 h-10 px-6 font-bold shadow-lg shadow-indigo-500/20" onClick={() => setIsSubDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" /> Manual Deployment
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-indigo-50 px-8">
                                        <TableHead className="pl-8 py-6 text-[10px] font-black uppercase tracking-widest text-indigo-400">Beneficiary Hotel</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Plan Tier</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Activation State</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Expiration Node</TableHead>
                                        <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest text-indigo-400">Transaction Value</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {subscriptions.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-indigo-300 font-bold">No financial protocols detected.</TableCell></TableRow>
                                    ) : subscriptions.map(s => (
                                        <TableRow key={s.id} className="group hover:bg-indigo-50/30 transition-colors border-indigo-50">
                                            <TableCell className="pl-8 py-6 font-black text-indigo-950">{getHotelName(s.hotel_id)}</TableCell>
                                            <TableCell>
                                                <Badge className={cn(
                                                    "rounded-lg px-3 py-1 font-black text-[10px] uppercase tracking-widest shadow-sm",
                                                    s.plan_name === 'Enterprise' ? "bg-indigo-600 text-white" : "bg-white text-indigo-600 border border-indigo-100"
                                                )}>
                                                    {s.plan_name}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                                    s.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                )}>
                                                    <div className={cn("w-1 h-1 rounded-full", s.status === 'active' ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                                                    {s.status}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-indigo-900 font-bold text-xs">{new Date(s.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</TableCell>
                                            <TableCell className="pr-8 text-right font-black text-indigo-600">{s.currency} {s.amount.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="users" className="animate-enter">
                    <Card className="rounded-[40px] border-none bg-white/80 backdrop-blur-xl shadow-xl overflow-hidden">
                        <CardHeader className="p-8 border-b border-indigo-50">
                            <CardTitle className="text-2xl font-black text-indigo-950 tracking-tight">Access Control & Security</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-indigo-50 px-8">
                                        <TableHead className="pl-8 py-6 text-[10px] font-black uppercase tracking-widest text-indigo-400">Authenticated Identity</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Permission Role</TableHead>
                                        <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest text-indigo-400">Security Clearance</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map(u => (
                                        <TableRow key={u.id} className="group hover:bg-indigo-50/30 transition-colors border-indigo-50">
                                            <TableCell className="pl-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-2xl bg-indigo-100 flex items-center justify-center font-black text-indigo-600">
                                                        {u.email[0].toUpperCase()}
                                                    </div>
                                                    <span className="font-bold text-indigo-950">{u.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="rounded-lg bg-indigo-50 text-indigo-600 border-none font-bold text-[10px] uppercase tracking-widest px-3 py-1">
                                                    {u.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="pr-8 text-right">
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                                    u.is_active ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                )}>
                                                    <div className={cn("w-1.5 h-1.5 rounded-full", u.is_active ? "bg-emerald-500" : "bg-rose-500")} />
                                                    {u.is_active ? "Verified" : "Restricted"}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isSubDialogOpen} onOpenChange={setIsSubDialogOpen}>
                <DialogContent className="rounded-[40px] border-none bg-white/95 backdrop-blur-2xl shadow-2xl p-0 overflow-hidden max-w-md">
                    <div className="bg-indigo-600 p-8 text-white">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black tracking-tight">License Management</DialogTitle>
                            <DialogDescription className="text-indigo-100 font-medium opacity-80">
                                Deploy or renew a premium hospitality license protocol.
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    
                    <div className="p-8 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Target Entity</Label>
                            <Select value={selectedHotelId} onValueChange={setSelectedHotelId}>
                                <SelectTrigger className="h-12 rounded-2xl border-indigo-100 bg-indigo-50/30 font-bold text-indigo-950">
                                    <SelectValue placeholder="Select Deployment Node" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    {hotels.map(h => (
                                        <SelectItem key={h.id} value={h.id} className="font-bold">{h.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Plan Tier</Label>
                                <Select value={subFormData.plan_name} onValueChange={(v) => setSubFormData({ ...subFormData, plan_name: v })}>
                                    <SelectTrigger className="h-12 rounded-2xl border-indigo-100 bg-indigo-50/30 font-bold text-indigo-950">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        <SelectItem value="Basic" className="font-bold">Basic</SelectItem>
                                        <SelectItem value="Pro" className="font-bold">Pro</SelectItem>
                                        <SelectItem value="Enterprise" className="font-bold text-indigo-600">Enterprise</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Expiry Node</Label>
                                <Input type="date" className="h-12 rounded-2xl border-indigo-100 bg-indigo-50/30 font-bold text-indigo-950" value={subFormData.end_date} onChange={(e) => setSubFormData({ ...subFormData, end_date: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Transaction Value (INR)</Label>
                            <div className="relative">
                                <Input type="number" className="h-12 rounded-2xl border-indigo-100 bg-indigo-50/30 font-black text-indigo-600 pl-10" value={subFormData.amount} onChange={(e) => setSubFormData({ ...subFormData, amount: Number(e.target.value) })} />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-indigo-300 text-xs">₹</span>
                            </div>
                        </div>
                    </div>
                    
                    <DialogFooter className="p-8 bg-indigo-50/50 flex gap-3">
                        <Button variant="ghost" className="rounded-2xl font-bold text-indigo-400" onClick={() => setIsSubDialogOpen(false)}>Abort</Button>
                        <Button className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 h-12 px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-500/20" onClick={handleCreateSub}>Finalize Protocol</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
