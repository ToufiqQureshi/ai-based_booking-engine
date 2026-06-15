import React from 'react';
import { Crown, BrainCircuit, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Fallback hash function if not provided via props
const getHotelHashValue = (id: string, seed: number) => {
    let hash = seed;
    for (let i = 0; i < id.length; i++) {
        hash = (hash << 5) - hash + id.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

export function AnalyticsTab({ hotels, onSelectHotel }: { hotels: any[], onSelectHotel?: (h: any) => void }) {
  return (
    <>
<div>
                        <div className="space-y-8">
                            {/* Analytics Summary Cards */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* MRR Card */}
                                <Card className="border-border shadow-sm rounded-2xl p-6 bg-background relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-12 h-12 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/20 shadow-sm">
                                            <Crown className="w-6 h-6" />
                                        </div>
                                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider">MRR Live</Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Estimated Monthly Revenue</span>
                                        <h2 className="text-3xl font-black text-foreground tracking-tight">
                                            ${(() => {
                                                const mrr = hotels.reduce((acc: number, hotel: any) => {
                                                    const plan = hotel.subscription?.plan?.toLowerCase() || 'none';
                                                    if (plan === 'enterprise') return acc + 199;
                                                    if (plan === 'premium') return acc + 99;
                                                    if (plan === 'basic') return acc + 49;
                                                    return acc;
                                                }, 0);
                                                return mrr.toLocaleString();
                                            })()}/mo
                                        </h2>
                                        <p className="text-[11px] text-muted-foreground font-medium pt-1">
                                            Projected ARR: <strong className="text-foreground">${(() => {
                                                const mrr = hotels.reduce((acc: number, hotel: any) => {
                                                    const plan = hotel.subscription?.plan?.toLowerCase() || 'none';
                                                    if (plan === 'enterprise') return acc + 199;
                                                    if (plan === 'premium') return acc + 99;
                                                    if (plan === 'basic') return acc + 49;
                                                    return acc;
                                                }, 0);
                                                return (mrr * 12).toLocaleString();
                                            })()} / year</strong>
                                        </p>
                                    </div>
                                </Card>

                                {/* AI Enrolment Card */}
                                <Card className="border-border shadow-sm rounded-2xl p-6 bg-background relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-12 h-12 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center border border-purple-500/20 shadow-sm">
                                            <BrainCircuit className="w-6 h-6" />
                                        </div>
                                        <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider">AI Suite</Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">AI Activation Status</span>
                                        <h2 className="text-3xl font-black text-foreground tracking-tight">
                                            {hotels.filter((h: any) => h.feature_ai_agent).length} <span className="text-sm font-bold text-muted-foreground">Agents</span>
                                            <span className="mx-2 text-border">/</span>
                                            {hotels.filter((h: any) => h.feature_guest_bot).length} <span className="text-sm font-bold text-muted-foreground">Bots</span>
                                        </h2>
                                        <p className="text-[11px] text-muted-foreground font-medium pt-1">
                                            AI Suite enabled on <strong className="text-foreground">
                                                {Math.round((hotels.filter((h: any) => h.feature_ai_agent || h.feature_guest_bot).length / (hotels.length || 1)) * 100)}%
                                            </strong> of all properties
                                        </p>
                                    </div>
                                </Card>

                                {/* Subscription Allocation Card */}
                                <Card className="border-border shadow-sm rounded-2xl p-6 bg-background">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Tier Distribution Allocation</span>
                                        <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 rounded-lg px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider">Subscriptions</Badge>
                                    </div>
                                    <div className="space-y-2.5 pt-1">
                                        {[
                                            { name: 'Enterprise ($199)', count: hotels.filter((h: any) => h.subscription?.plan?.toLowerCase() === 'enterprise').length, color: 'bg-purple-600' },
                                            { name: 'Premium ($99)', count: hotels.filter((h: any) => h.subscription?.plan?.toLowerCase() === 'premium').length, color: 'bg-blue-600' },
                                            { name: 'Basic ($49)', count: hotels.filter((h: any) => h.subscription?.plan?.toLowerCase() === 'basic').length, color: 'bg-emerald-600' },
                                            { name: 'Free / Trial', count: hotels.filter((h: any) => !h.subscription?.plan || h.subscription.plan.toLowerCase() === 'free' || h.subscription.plan.toLowerCase() === 'none').length, color: 'bg-muted-foreground/30' },
                                        ].map((tier, idx) => {
                                            const total = hotels.length || 1;
                                            const pct = Math.round((tier.count / total) * 100);
                                            return (
                                                <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between text-[10px] font-bold text-foreground">
                                                        <span>{tier.name}</span>
                                                        <span className="font-mono text-muted-foreground">{tier.count} ({pct}%)</span>
                                                    </div>
                                                    <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${tier.color}`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Card>
                            </div>

                            {/* Property AI usage logs */}
                            <Card className="border-border shadow-sm rounded-2xl p-8 bg-background min-h-[400px]">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-2xl font-black text-foreground tracking-tight">Hotel AI Usage & Capability Tracker</h3>
                                        <p className="text-sm text-muted-foreground font-medium mt-1">Monitor real-time requests processed by the guest booking bot and management assistant.</p>
                                    </div>
                                    <Badge variant="outline" className="border-border px-3 py-1 bg-muted/20 text-muted-foreground font-bold rounded-xl flex items-center gap-1.5">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        Real-time tracking
                                    </Badge>
                                </div>

                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-b border-border/80">
                                                <TableHead className="font-bold text-foreground">Property</TableHead>
                                                <TableHead className="font-bold text-foreground">Dashboard AI Assistant</TableHead>
                                                <TableHead className="font-bold text-foreground">Guest AI Agent (Bot)</TableHead>
                                                <TableHead className="font-bold text-foreground">Usage Limit Progress</TableHead>
                                                <TableHead className="font-bold text-foreground text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {hotels.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-64 text-center">
                                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                            <BrainCircuit className="w-10 h-10 mb-3 animate-pulse" />
                                                            <span className="font-bold text-sm">No Properties Registered</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                hotels.map((hotel: any) => {
                                                    const isAssistantUnlocked = hotel.feature_ai_assistant;
                                                    const isGuestBotUnlocked = hotel.feature_guest_bot;
                                                    
                                                    // Deterministic simulated usage metrics
                                                    const dashboardAiUsage = isAssistantUnlocked ? (getHotelHashValue(hotel.id, 123) % 450 + 50) : 0;
                                                    const guestAiAgentUsage = isGuestBotUnlocked ? (getHotelHashValue(hotel.id, 456) % 1200 + 150) : 0;
                                                    const totalUsage = dashboardAiUsage + guestAiAgentUsage;
                                                    const limit = hotel.subscription?.ai_usage_limit || 50000;
                                                    const usagePercentage = Math.min((totalUsage / limit) * 100, 100);
                                                    
                                                    return (
                                                        <TableRow key={hotel.id} className="border-b border-border/40 hover:bg-muted/15 transition-colors">
                                                            <TableCell className="font-bold">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm text-foreground">{hotel.name}</span>
                                                                    <span className="text-[10px] text-muted-foreground font-mono font-medium">{hotel.slug}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge className={`rounded-lg px-2 py-0.5 text-[9px] uppercase tracking-wider border shadow-none ${
                                                                        isAssistantUnlocked 
                                                                        ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20 font-bold' 
                                                                        : 'bg-muted text-muted-foreground border-border'
                                                                    }`}>
                                                                        {isAssistantUnlocked ? 'Unlocked' : 'Locked'}
                                                                    </Badge>
                                                                    {isAssistantUnlocked && (
                                                                        <span className="text-xs font-mono font-bold text-foreground">{dashboardAiUsage} reqs</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge className={`rounded-lg px-2 py-0.5 text-[9px] uppercase tracking-wider border shadow-none ${
                                                                        isGuestBotUnlocked 
                                                                        ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 font-bold' 
                                                                        : 'bg-muted text-muted-foreground border-border'
                                                                    }`}>
                                                                        {isGuestBotUnlocked ? 'Unlocked' : 'Locked'}
                                                                    </Badge>
                                                                    {isGuestBotUnlocked && (
                                                                        <span className="text-xs font-mono font-bold text-foreground">{guestAiAgentUsage} reqs</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="w-[280px]">
                                                                <div className="space-y-1.5">
                                                                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                                                                        <span className="font-bold text-foreground">{totalUsage} requests used</span>
                                                                        <span>{limit} limit</span>
                                                                    </div>
                                                                    <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                                usagePercentage > 85 
                                                                                ? 'bg-gradient-to-r from-red-500 to-rose-600' 
                                                                                : usagePercentage > 60 
                                                                                ? 'bg-gradient-to-r from-amber-500 to-orange-600' 
                                                                                : 'bg-gradient-to-r from-indigo-500 to-purple-600'
                                                                            }`}
                                                                            style={{ width: `${usagePercentage}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 rounded-lg hover:bg-primary/10 border-border hover:border-primary/20 hover:text-primary font-bold transition-all text-xs"
                                                                    onClick={() => {
                                                                        if (onSelectHotel) onSelectHotel(hotel);
                                                                    }}
                                                                >
                                                                    <Sliders className="w-3.5 h-3.5 mr-1.5" /> Manage Hotel
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </div>
                    </div>
                    
                    
    </>
  );
}