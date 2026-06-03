import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/api/client";
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/contexts/AuthContext';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
    role: 'human' | 'ai';
    content: string;
}

interface ChatResponse {
    response: string;
}

interface ChartYKey {
    key: string;
    label: string;
    color: string;
}

interface ChartSpec {
    type: 'line' | 'bar' | 'pie';
    title: string;
    data: Record<string, any>[];
    xKey: string;
    yKeys: ChartYKey[];
}

interface ParsedMessage {
    text: string;
    charts: ChartSpec[];
}

// ─── Chart colours ───────────────────────────────────────────────────────────

const PIE_COLORS = ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#14B8A6', '#F97316'];

// ─── Parse [CHART_DATA]...[/CHART_DATA] blocks out of an AI response ─────────

function parseMessage(raw: string): ParsedMessage {
    const regex = /\[CHART_DATA\]\n([\s\S]*?)\n\[\/CHART_DATA\]/g;
    const charts: ChartSpec[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(raw)) !== null) {
        try {
            charts.push(JSON.parse(match[1]) as ChartSpec);
        } catch {
            // malformed JSON — skip silently
        }
    }

    const text = raw.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();
    return { text, charts };
}

// ─── ChartRenderer ────────────────────────────────────────────────────────────

const rupeeFormatter = (v: number) =>
    v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`;

const ChartRenderer = ({ chart }: { chart: ChartSpec }) => {
    const firstKey = chart.yKeys?.[0];

    if (chart.type === 'line') {
        return (
            <div className="mt-3 bg-background border rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">{chart.title}</p>
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chart.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey={chart.xKey} tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={rupeeFormatter} width={48} />
                        <Tooltip formatter={(val: number) => [`₹${Number(val).toLocaleString('en-IN')}`, '']} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {chart.yKeys.map(yk => (
                            <Line
                                key={yk.key}
                                type="monotone"
                                dataKey={yk.key}
                                stroke={yk.color}
                                strokeWidth={2}
                                dot={false}
                                name={yk.label}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        );
    }

    if (chart.type === 'bar') {
        return (
            <div className="mt-3 bg-background border rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">{chart.title}</p>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chart.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey={chart.xKey} tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={rupeeFormatter} width={48} />
                        <Tooltip formatter={(val: number) => [`₹${Number(val).toLocaleString('en-IN')}`, '']} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {chart.yKeys.map(yk => (
                            <Bar key={yk.key} dataKey={yk.key} fill={yk.color} name={yk.label} radius={[4, 4, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    }

    if (chart.type === 'pie' && firstKey) {
        return (
            <div className="mt-3 bg-background border rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">{chart.title}</p>
                <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                        <Pie
                            data={chart.data}
                            dataKey={firstKey.key}
                            nameKey={chart.xKey}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                        >
                            {chart.data.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    }

    return null;
};

// ─── Quick-ask groups ─────────────────────────────────────────────────────────

const QUICK_ASKS = [
    { group: "Operations", items: [
        { label: "⚠️ Smart Alerts", prompt: "Check smart alerts — what needs my immediate attention?" },
        { label: "📋 Pending Bookings", prompt: "Show me all pending bookings waiting for confirmation" },
        { label: "🛬 Today's Arrivals", prompt: "Who is checking in today?" },
        { label: "🛫 Today's Departures", prompt: "Who is checking out today?" },
    ]},
    { group: "Revenue & Analytics", items: [
        { label: "📈 Revenue Trend", prompt: "Show me revenue trend chart for last 30 days" },
        { label: "🏨 Occupancy Trend", prompt: "Show occupancy percentage trend for last 30 days" },
        { label: "💹 RevPAR & KPIs", prompt: "Give me RevPAR, ADR, and occupancy KPIs for this month" },
        { label: "🔮 Revenue Forecast", prompt: "Forecast revenue for the next 30 days" },
    ]},
    { group: "Guests & Rooms", items: [
        { label: "🏆 VIP Guests", prompt: "Show me top 10 VIP guests by total spend" },
        { label: "💡 Upsell Opportunities", prompt: "Which guests can I upsell to a higher room?" },
        { label: "🛏️ Room Performance", prompt: "Show room performance chart — which rooms earn most?" },
        { label: "🔄 Booking Sources", prompt: "Breakdown of bookings by source — OTA vs direct" },
    ]},
];

// ─── Main Component ───────────────────────────────────────────────────────────

const AgentPage = () => {
    const { hotel } = useAuth();
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: 'Namaste! Main Staybooker AI hun. Main aapki hotel growth aur operations mein kaise madad kar sakta hun?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;
        const userMessage = text.trim();
        setInput('');

        const newMessages: Message[] = [...messages, { role: 'human', content: userMessage }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            const data = await apiClient.post<ChatResponse>('/agent/chat', {
                message: userMessage,
                history: newMessages.map(m => [m.role, m.content]),
            });
            setMessages(prev => [...prev, { role: 'ai', content: data.response }]);
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Something went wrong.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
    };

    if (hotel && !hotel.feature_ai_agent) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center p-4 text-center">
                <div className="p-6 bg-muted rounded-full mb-6">
                    <ShieldAlert className="h-16 w-16 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-black text-foreground mb-2">Feature Locked</h2>
                <p className="text-muted-foreground mb-8 max-w-md font-medium">
                    AI Assistant is not included in your current plan.
                    Please contact support or your account manager to enable this feature.
                </p>
                <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 px-8 py-6 text-lg font-bold">
                    Upgrade Now
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 h-[calc(100vh-4rem)] flex flex-col">
            <Card className="flex-1 flex flex-col shadow-lg border-2 overflow-hidden">
                {/* Header */}
                <CardHeader className="border-b bg-muted/20 shrink-0">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-primary">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                                <Bot size={22} />
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                Hotelier AI Assistant
                                <span className="inline-flex items-center gap-1 text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 px-2 py-0.5 rounded-full">
                                    <Sparkles size={11} /> Advanced
                                </span>
                            </CardTitle>
                            <CardDescription>
                                Revenue trends, forecasts, VIP guests, upsell, alerts — ask anything.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                    <ScrollArea className="flex-1 p-4">
                        <div className="flex flex-col gap-4">

                            {/* Messages */}
                            {messages.map((msg, index) => {
                                const parsed = msg.role === 'ai' ? parseMessage(msg.content) : null;
                                return (
                                    <div key={index} className={`flex ${msg.role === 'human' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`flex gap-3 max-w-[85%] ${msg.role === 'human' ? 'flex-row-reverse' : 'flex-row'}`}>
                                            <Avatar className="h-8 w-8 mt-1 shrink-0">
                                                {msg.role === 'human' ? (
                                                    <AvatarFallback className="bg-slate-200 dark:bg-slate-700"><User size={16} /></AvatarFallback>
                                                ) : (
                                                    <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={16} /></AvatarFallback>
                                                )}
                                            </Avatar>
                                            <div className={`p-3 rounded-xl text-sm ${msg.role === 'human'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted border'
                                            }`}>
                                                {msg.role === 'human' ? (
                                                    <span>{msg.content}</span>
                                                ) : (
                                                    <>
                                                        <div className="prose dark:prose-invert max-w-none text-sm break-words">
                                                            <ReactMarkdown
                                                                components={{
                                                                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                                    ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2" {...props} />,
                                                                    ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2" {...props} />,
                                                                    strong: ({ node, ...props }) => <strong className="font-bold text-foreground" {...props} />,
                                                                    h3: ({ node, ...props }) => <h3 className="font-bold text-base mt-2 mb-1" {...props} />,
                                                                }}
                                                            >
                                                                {parsed!.text}
                                                            </ReactMarkdown>
                                                        </div>
                                                        {parsed!.charts.map((chart, ci) => (
                                                            <ChartRenderer key={ci} chart={chart} />
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Quick-ask buttons — shown only on welcome screen */}
                            {messages.length === 1 && (
                                <div className="ml-11 mt-2 space-y-3 max-w-[85%]">
                                    {QUICK_ASKS.map(group => (
                                        <div key={group.group}>
                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                                                {group.group}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {group.items.map(item => (
                                                    <button
                                                        key={item.label}
                                                        onClick={() => sendMessage(item.prompt)}
                                                        disabled={isLoading}
                                                        className="text-xs bg-muted/30 hover:bg-muted border border-border text-foreground px-3 py-1.5 rounded-full transition disabled:opacity-50"
                                                    >
                                                        {item.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Loading indicator */}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="flex gap-3 max-w-[85%]">
                                        <Avatar className="h-8 w-8 mt-1 shrink-0">
                                            <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={16} /></AvatarFallback>
                                        </Avatar>
                                        <div className="bg-muted border p-3 rounded-xl flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-xs text-muted-foreground">Thinking…</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={scrollRef} />
                        </div>
                    </ScrollArea>

                    {/* Input bar */}
                    <div className="p-4 border-t bg-background shrink-0">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Ask anything — revenue trend, VIP guests, forecast, upsell…"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                className="flex-1"
                            />
                            <Button onClick={() => sendMessage(input)} disabled={isLoading || !input.trim()}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AgentPage;
