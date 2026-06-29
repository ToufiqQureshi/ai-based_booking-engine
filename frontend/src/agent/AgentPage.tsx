import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, ShieldAlert, Sparkles, BarChart3, RefreshCw, WifiOff, Menu, MessageSquarePlus, MessageSquare, Trash2, Pencil, Check, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/core/api/client";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/core/contexts/AuthContext';
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
    session_id: string;
}

interface ChatSession {
    session_id: string;
    session_name: string;
    created_at: number;
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

interface AgentUsageInfo {
    label: string;
    today_tokens: number;
    daily_limit: number;
    pct_of_limit_used_today: number | null;
    messages_today: number;
    unique_users_today: number;
    estimated_conversations_today: number;
    period_total_tokens: number;
    daily_history: Record<string, number>;
}

interface AIUsageData {
    hotel_id: string;
    period_days: number;
    data_available: boolean;
    agents: {
        hotelier: AgentUsageInfo;
        guest: AgentUsageInfo;
        whatsapp: AgentUsageInfo;
    };
}

// ─── Chart colours ───────────────────────────────────────────────────────────

const PIE_COLORS = ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#14B8A6', '#F97316'];
const AGENT_COLORS = { hotelier: '#7C3AED', guest: '#10B981', whatsapp: '#F59E0B' };

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

// ─── AgentUsageCard ───────────────────────────────────────────────────────────

const AgentUsageCard = ({
    agentKey,
    info,
}: {
    agentKey: keyof typeof AGENT_COLORS;
    info: AgentUsageInfo;
}) => {
    const pct = info.pct_of_limit_used_today ?? 0;
    const barColor =
        pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-emerald-500';
    const textColor =
        pct > 90 ? 'text-red-600 dark:text-red-400' : pct > 70 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

    const chartData = Object.entries(info.daily_history)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, tokens]) => ({ day: date.slice(5), tokens }));

    return (
        <Card className="border-2">
            <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: AGENT_COLORS[agentKey] }}
                    />
                    {info.label}
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
                {/* Token progress */}
                <div>
                    <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Today's usage</span>
                        <span className="font-semibold tabular-nums">
                            {info.today_tokens.toLocaleString()} / {info.daily_limit.toLocaleString()}
                        </span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs mt-1.5">
                        <span className={`font-semibold ${textColor}`}>
                            {info.pct_of_limit_used_today !== null ? `${pct}% used` : '—'}
                        </span>
                    </div>
                </div>

                {/* Real interaction counts today */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/40 border rounded-xl p-2.5 text-center">
                        <p className="text-lg font-black text-foreground leading-none">{info.unique_users_today}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {agentKey === 'hotelier' ? 'staff today' : 'people today'}
                        </p>
                    </div>
                    <div className="bg-muted/40 border rounded-xl p-2.5 text-center">
                        <p className="text-lg font-black text-foreground leading-none">{info.messages_today}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">messages today</p>
                    </div>
                </div>

                {/* 7-day sparkline */}
                <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                        Last 7 days
                    </p>
                    <ResponsiveContainer width="100%" height={72}>
                        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            <XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                formatter={(v: number) => [v.toLocaleString(), 'tokens']}
                                contentStyle={{ fontSize: 11 }}
                            />
                            <Bar
                                dataKey="tokens"
                                fill={AGENT_COLORS[agentKey]}
                                radius={[2, 2, 0, 0]}
                                opacity={0.85}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 7-day total */}
                <div className="text-xs text-muted-foreground pt-2 border-t">
                    7-day total:{' '}
                    <span className="font-semibold text-foreground">
                        {info.period_total_tokens.toLocaleString()} tokens
                    </span>
                </div>
            </CardContent>
        </Card>
    );
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
/**
 * AgentPage Component
 * 
 * ARCHITECTURE OVERVIEW & RULES (GEMINI.md compliance):
 * 1. **ChatGPT-style UI & Sessions**: Manages a list of past `sessions` in the sidebar. 
 *    Memory isolation is achieved by maintaining an `activeSessionId` instead of a local history dump.
 * 2. **Never trust the client**: The frontend does not dictate role or hotel limits; it purely forwards 
 *    the text input. Backend API endpoints enforce quota limits and AI logic.
 * 3. **API Integration**: Connects to the backend via `/agent/chat` (POST) and `/agent/sessions` (GET). 
 *    React state manages optimistic UI updates during slow network conditions.
 * 4. **No Secrets**: Tokens, LLM keys, and API routing logic remain fully contained in the FastAPI backend.
 */
const AgentPage = () => {
    const { hotel } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as 'chat' | 'usage') || 'chat';
    const setActiveTab = (tab: string) => setSearchParams({ tab });
    
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: 'Hello! I am Staybooker AI. How can I help you with your hotel operations and growth today?' }
    ]);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSessionLoading, setIsSessionLoading] = useState(false);
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const fetchSessions = useCallback(async () => {
        try {
            const data = await apiClient.get<ChatSession[]>('/agent/sessions');
            setSessions(data);
        } catch {
            // silent fail
        }
    }, []);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    const loadSession = async (sessionId: string) => {
        if (sessionId === activeSessionId) return;
        setActiveSessionId(sessionId);
        setMessages([]);
        setIsSessionLoading(true);
        try {
            const data = await apiClient.get<{messages: Message[]}>(`/agent/sessions/${sessionId}`);
            if (data.messages && data.messages.length > 0) {
                setMessages(data.messages);
            } else {
                setMessages([{ role: 'ai', content: 'Hello! I am Staybooker AI. How can I help you with your hotel operations and growth today?' }]);
            }
            if (window.innerWidth < 1024) setIsSidebarOpen(false);
        } catch {
            toast({ title: "Error", description: "Could not load chat history", variant: "destructive" });
        } finally {
            setIsSessionLoading(false);
        }
    };

    const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await apiClient.delete(`/agent/sessions/${sessionId}`);
            setSessions(prev => prev.filter(s => s.session_id !== sessionId));
            if (activeSessionId === sessionId) clearChat();
        } catch {
            toast({ title: "Error", description: "Could not delete chat", variant: "destructive" });
        }
    };

    const startRename = (s: ChatSession, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingSessionId(s.session_id);
        setEditingName(s.session_name);
    };

    const submitRename = async (sessionId: string) => {
        const name = editingName.trim();
        if (!name) { setEditingSessionId(null); return; }
        try {
            await apiClient.patch(`/agent/sessions/${sessionId}/rename`, { session_name: name });
            setSessions(prev => prev.map(s => s.session_id === sessionId ? { ...s, session_name: name } : s));
        } catch {
            toast({ title: "Error", description: "Could not rename chat", variant: "destructive" });
        } finally {
            setEditingSessionId(null);
        }
    };

    const clearChat = () => {
        setMessages([{ role: 'ai', content: 'Hello! I am Staybooker AI. How can I help you with your hotel operations and growth today?' }]);
        setActiveSessionId(null);
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
    };
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [activeToolName, setActiveToolName] = useState('');
    const [usageData, setUsageData] = useState<AIUsageData | null>(null);
    const [usageLoading, setUsageLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchUsage = useCallback(async () => {
        setUsageLoading(true);
        try {
            const data = await apiClient.get<AIUsageData>('/agent/usage?days=7');
            setUsageData(data);
        } catch {
            toast({ title: "Could not load usage data", variant: "destructive" });
        } finally {
            setUsageLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (activeTab === 'usage' && !usageData) {
            fetchUsage();
        }
    }, [activeTab, usageData, fetchUsage]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;
        const userMessage = text.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'human', content: userMessage }]);
        setIsLoading(true);
        setStreamingText('');
        setActiveToolName('');

        try {
            const { API_BASE_URL, tokenStorage } = await import('@/core/api/client');
            const token = tokenStorage.getAccessToken();
            const res = await fetch(`${API_BASE_URL}/agent/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ message: userMessage, session_id: activeSessionId }),
            });

            if (!res.ok || !res.body) {
                throw new Error(`Server error ${res.status}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';
            let doneSessionId = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const evt = JSON.parse(line.slice(6));
                        if (evt.type === 'tool') {
                            setActiveToolName(evt.name || 'tool');
                        } else if (evt.type === 'content') {
                            accumulated += evt.delta;
                            setStreamingText(accumulated);
                            setActiveToolName('');
                        } else if (evt.type === 'done') {
                            doneSessionId = evt.session_id;
                        } else if (evt.type === 'error') {
                            throw new Error(evt.message);
                        }
                    } catch (parseErr: any) {
                        if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
                    }
                }
            }

            // Commit streamed text as a proper message
            if (accumulated) {
                setMessages(prev => [...prev, { role: 'ai', content: accumulated }]);
            }
            if (doneSessionId && doneSessionId !== activeSessionId) {
                setActiveSessionId(doneSessionId);
                fetchSessions();
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Something went wrong.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
            setStreamingText('');
            setActiveToolName('');
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
        <div className="container mx-auto p-4 h-[calc(100vh-4rem)] flex gap-4">
            {/* Sidebar */}
            {isSidebarOpen && (
                <Card className="w-64 flex-shrink-0 flex flex-col shadow-lg border-0 bg-muted/20 overflow-hidden hidden md:flex">
                    <div className="p-3 border-b">
                        <Button onClick={clearChat} className="w-full justify-start gap-2" variant="outline">
                            <MessageSquarePlus size={16} />
                            New Chat
                        </Button>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                            {sessions.map(s => (
                                <div
                                    key={s.session_id}
                                    onClick={() => editingSessionId !== s.session_id && loadSession(s.session_id)}
                                    className={`group flex items-center gap-1 w-full rounded-md px-2 h-9 cursor-pointer text-sm transition-colors
                                        ${activeSessionId === s.session_id
                                            ? 'bg-secondary text-secondary-foreground'
                                            : 'hover:bg-muted text-foreground'
                                        }`}
                                >
                                    <MessageSquare size={14} className="opacity-50 shrink-0" />
                                    {editingSessionId === s.session_id ? (
                                        <input
                                            autoFocus
                                            className="flex-1 bg-transparent outline-none text-sm min-w-0"
                                            value={editingName}
                                            onChange={e => setEditingName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') submitRename(s.session_id);
                                                if (e.key === 'Escape') setEditingSessionId(null);
                                            }}
                                            onClick={e => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className="flex-1 truncate">{s.session_name}</span>
                                    )}
                                    {editingSessionId === s.session_id ? (
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <button onClick={e => { e.stopPropagation(); submitRename(s.session_id); }} className="p-0.5 hover:text-green-500"><Check size={13} /></button>
                                            <button onClick={e => { e.stopPropagation(); setEditingSessionId(null); }} className="p-0.5 hover:text-red-500"><X size={13} /></button>
                                        </div>
                                    ) : (
                                        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                                            <button onClick={e => startRename(s, e)} className="p-0.5 opacity-60 hover:opacity-100 hover:text-primary" title="Rename"><Pencil size={12} /></button>
                                            <button onClick={e => deleteSession(s.session_id, e)} className="p-0.5 opacity-60 hover:opacity-100 hover:text-red-500" title="Delete"><Trash2 size={12} /></button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {sessions.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center p-4">No past chats found.</p>
                            )}
                        </div>
                    </ScrollArea>
                </Card>
            )}

            {/* Main Chat Area */}
            <Card className="flex-1 flex flex-col shadow-2xl border-0 overflow-hidden bg-gradient-to-br from-background to-muted/30">
                {/* Header */}
                <CardHeader className="border-b bg-background/80 backdrop-blur-md shrink-0 sticky top-0 z-10 py-3">
                    <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="shrink-0 h-9 w-9 -ml-2 hidden md:flex text-muted-foreground hover:text-foreground">
                                <Menu size={20} />
                            </Button>
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

                        {/* Tab switcher */}
                        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 shrink-0">
                            <button
                                onClick={() => setActiveTab('chat')}
                                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all ${
                                    activeTab === 'chat'
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Bot size={13} />
                                Chat
                            </button>
                            <button
                                onClick={() => setActiveTab('usage')}
                                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all ${
                                    activeTab === 'usage'
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <BarChart3 size={13} />
                                Usage
                            </button>
                        </div>
                        <Button variant="ghost" size="icon" onClick={clearChat} title="Clear Chat" className="h-8 w-8 rounded-full ml-1 text-muted-foreground hover:text-foreground">
                            <RefreshCw size={14} />
                        </Button>
                    </div>
                </CardHeader>

                {/* ── Chat Tab ─────────────────────────────────────────────── */}
                {activeTab === 'chat' && (
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
                                                                    remarkPlugins={[remarkGfm]}
                                                                    components={{
                                                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                                                        ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                                                                        ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                                                                        strong: ({ node, ...props }) => <strong className="font-bold text-foreground" {...props} />,
                                                                        h3: ({ node, ...props }) => <h3 className="font-bold text-base mt-3 mb-2" {...props} />,
                                                                        table: ({ node, ...props }) => <div className="overflow-x-auto my-4"><table className="w-full border-collapse border border-border text-left text-sm rounded-lg overflow-hidden" {...props} /></div>,
                                                                        th: ({ node, ...props }) => <th className="bg-muted px-4 py-2 font-semibold border border-border" {...props} />,
                                                                        td: ({ node, ...props }) => <td className="px-4 py-2 border border-border" {...props} />,
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

                                {/* Live streaming bubble */}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="flex gap-3 max-w-[85%]">
                                            <Avatar className="h-8 w-8 mt-1 shrink-0">
                                                <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={16} /></AvatarFallback>
                                            </Avatar>
                                            <div className="bg-muted border p-3 rounded-xl text-sm text-foreground whitespace-pre-wrap min-w-[120px]">
                                                {streamingText ? (
                                                    <>
                                                        {streamingText}
                                                        <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle animate-pulse" />
                                                    </>
                                                ) : activeToolName ? (
                                                    <span className="flex items-center gap-2 text-muted-foreground text-xs">
                                                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                                                        Fetching data…
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-2 text-muted-foreground text-xs">
                                                        <span className="flex gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                                                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                                                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                                                        </span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Session history loading indicator */}
                                {isSessionLoading && (
                                    <div className="flex justify-center py-6">
                                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Loading chat…</span>
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
                )}

                {/* ── Usage Tab ────────────────────────────────────────────── */}
                {activeTab === 'usage' && (
                    <CardContent className="flex-1 p-0 overflow-hidden">
                        <ScrollArea className="h-full p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-semibold text-base">AI Usage — Today &amp; Last 7 Days</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Tokens are consumed every time a guest or you talks to an AI agent.
                                        ~800 tokens ≈ 1 conversation.
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={fetchUsage}
                                    disabled={usageLoading}
                                    className="shrink-0"
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${usageLoading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </Button>
                            </div>

                            {usageLoading && !usageData && (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            )}

                            {usageData && !usageData.data_available && (
                                <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4 text-sm">
                                    <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span className="text-amber-800 dark:text-amber-300">
                                        Usage tracking is temporarily unavailable (Redis offline). Data will appear once the cache layer reconnects.
                                    </span>
                                </div>
                            )}

                            {usageData && (() => {
                                const cards: Array<{ key: keyof typeof AGENT_COLORS; info: AgentUsageInfo }> = [];
                                if (hotel?.feature_ai_assistant !== false) cards.push({ key: 'hotelier', info: usageData.agents.hotelier });
                                if (hotel?.feature_guest_bot) cards.push({ key: 'guest', info: usageData.agents.guest });
                                if (hotel?.feature_ai_agent) cards.push({ key: 'whatsapp', info: usageData.agents.whatsapp });
                                if (cards.length === 0) cards.push({ key: 'hotelier', info: usageData.agents.hotelier });
                                const cols = cards.length === 1 ? 'grid-cols-1 max-w-sm' : cards.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-2xl' : 'grid-cols-1 md:grid-cols-3';
                                return (
                                    <div className={`grid ${cols} gap-4`}>
                                        {cards.map(c => <AgentUsageCard key={c.key} agentKey={c.key} info={c.info} />)}
                                    </div>
                                );
                            })()}

                            {/* Explanation */}
                            {usageData && (
                                <div className="mt-5 bg-muted/40 rounded-xl p-4 text-xs text-muted-foreground space-y-1.5 border">
                                    <p className="font-semibold text-foreground text-sm mb-2">How does AI billing work?</p>
                                    <p>• <strong>Daily limits</strong> are set per-agent by your account plan. When 100% is reached, that agent pauses for the day and resets at midnight UTC.</p>
                                    <p>• <strong>Hotelier Dashboard AI</strong> — only you use this. Limit is typically lower.</p>
                                    <p>• <strong>Guest Chat &amp; WhatsApp</strong> — all your guests share this pool. Limits are higher to handle multiple simultaneous guests.</p>
                                    <p>• Need higher limits? Contact support to adjust your per-agent daily quotas.</p>
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                )}
            </Card>
        </div>
    );
};

export default AgentPage;
