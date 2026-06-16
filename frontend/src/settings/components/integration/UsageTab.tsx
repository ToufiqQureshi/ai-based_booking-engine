import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Sparkles, CreditCard, Activity, BrainCircuit } from 'lucide-react';
import { Hotel } from '@/core/types/api';

interface UsageTabProps {
    hotel?: Hotel | null;
}

export const UsageTab = ({ hotel }: UsageTabProps) => {
    const isAIActive = !!hotel?.feature_ai_agent;
    const messagesSent = hotel?.settings?.total_messages_sent || 0;
    const availableCredits = hotel?.settings?.ai_whatsapp_credits ?? 0;

    return (
        <div className="space-y-6">
            {/* Header / Summary Card */}
            <Card className="border-border bg-card">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-xl font-black flex items-center gap-2">
                                <Activity className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                WhatsApp & AI Usage
                            </CardTitle>
                            <CardDescription>
                                Monitor your messaging credits, AI usage, and agent status.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className="text-xs font-semibold text-muted-foreground">AI Agent:</span>
                            {isAIActive ? (
                                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200">
                                    Active
                                </Badge>
                            ) : (
                                <Badge variant="secondary">
                                    Disabled
                                </Badge>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Messages Sent */}
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-5 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/20 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-indigo-600/70 dark:text-indigo-400/70">Messages Sent</p>
                                <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                                    {messagesSent}
                                </p>
                            </div>
                        </div>

                        {/* Available Credits */}
                        <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-5 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/20 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <Sparkles className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70">Available Credits</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                                        {availableCredits}
                                    </p>
                                </div>
                            </div>
                            <Button 
                                variant="outline" 
                                className="border-emerald-200 dark:border-emerald-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl gap-2 font-bold shrink-0"
                                onClick={() => window.location.href = `mailto:billing@staybooker.ai?subject=Add%20Credits%20for%20${hotel?.name || 'Hotel'}`}
                            >
                                <CreditCard className="w-4 h-4" />
                                Add Credits
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* AI Info Card */}
            <Card className="border-border bg-card">
                <CardHeader>
                    <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                        <BrainCircuit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        AI Agent Features
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600 dark:text-slate-400 space-y-4">
                    <p className="leading-relaxed">
                        The WhatsApp AI Booking Agent automatically handles customer requests, check-in/check-out inquiries, room availability, and shares direct booking links.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <div className="border border-border/60 p-4 rounded-xl">
                            <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-1">💬 Instant Answers</h5>
                            <p className="text-xs text-muted-foreground">Responds instantly to guest queries 24/7 on WhatsApp.</p>
                        </div>
                        <div className="border border-border/60 p-4 rounded-xl">
                            <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-1">🏨 Direct Bookings</h5>
                            <p className="text-xs text-muted-foreground">Sends direct booking engine links when guests ask to reserve.</p>
                        </div>
                        <div className="border border-border/60 p-4 rounded-xl">
                            <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-1">🛠️ Managed Config</h5>
                            <p className="text-xs text-muted-foreground">Configuration is managed by the Staybooker team for optimal performance.</p>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground pt-4 border-t border-border/50">
                        Need assistance or want to update your AI responses? Contact us at <a href="mailto:support@staybooker.ai" className="text-indigo-600 hover:underline">support@staybooker.ai</a>.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};
