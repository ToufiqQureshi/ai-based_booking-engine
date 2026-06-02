import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MessageCircle, Sparkles, CreditCard, Activity } from 'lucide-react';
import { User, Hotel } from '@/types/api';

interface WhatsappTabProps {
    isAIEnabled: boolean;
    isSavingAI: boolean;
    onToggleAI: (enabled: boolean) => Promise<void>;
    user?: User | null;
    hotel?: Hotel | null;
}

export const WhatsappTab = ({
    isAIEnabled,
    isSavingAI,
    onToggleAI,
    user,
    hotel
}: WhatsappTabProps) => {
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <MessageCircle className="h-5 w-5 text-primary" />
                                WhatsApp Business API Configuration
                            </CardTitle>
                            <CardDescription>
                                {isSuperAdmin
                                    ? 'Provide Meta WhatsApp Cloud API credentials to dispatch instant guest confirmations and reservation followups.'
                                    : 'View your WhatsApp messaging stats and credits. Contact Staybooker support to configure or enable WhatsApp for your property.'}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="font-semibold text-sm">{isAIEnabled ? "AI Agent Active" : "AI Agent Disabled"}</Label>
                            <Switch
                                checked={isAIEnabled}
                                onCheckedChange={onToggleAI}
                                disabled={isSavingAI}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Stats Section for Everyone */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Activity className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">Messages Sent</p>
                                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                                    {hotel?.settings?.total_messages_sent || 0}
                                </p>
                            </div>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300">Available Credits</p>
                                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                                        {hotel?.settings?.ai_whatsapp_credits ?? 0}
                                    </p>
                                </div>
                            </div>
                            <Button 
                                variant="default" 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                                onClick={() => window.location.href = 'mailto:billing@staybooker.ai?subject=Add%20Staybooker%20Credits'}
                            >
                                <CreditCard className="w-4 h-4" />
                                Add Credit
                            </Button>
                        </div>
                    </div>


                </CardContent>
            </Card>

            <Card className="border-indigo-100 dark:border-indigo-950/40 bg-gradient-to-tr from-indigo-50/10 to-transparent">
                <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        Enable WhatsApp AI Booking Agent
                    </CardTitle>
                    <CardDescription>
                        Setup WhatsApp webhooks to let the AI agent answer availability questions and share booking links directly with guests.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    <p>
                        To let guests talk with the AI agent and book rooms, log in to your <strong>Meta for Developers Console</strong>, go to your WhatsApp app setup, and configure Webhooks with the following fields:
                    </p>
                    <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg border space-y-2 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                        <div>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">Callback URL:</span>{" "}
                            {`${window.location.origin}/api/v1/integration/whatsapp/webhook`}
                        </div>
                        <div>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">Verify Token:</span>{" "}
                            whatsapp_agent_verify_token
                        </div>
                        <div>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">Subscription Field:</span>{" "}
                            messages
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        Your Staybooker support team handles AI configuration. Contact support@staybooker.ai for assistance.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};
