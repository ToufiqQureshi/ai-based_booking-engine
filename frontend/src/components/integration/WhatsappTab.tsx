import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MessageCircle, Sparkles, Loader2, Save } from 'lucide-react';

interface WhatsappConfig {
    whatsapp_api_key: string;
    whatsapp_phone_number_id: string;
    whatsapp_business_account_id: string;
}

interface WhatsappTabProps {
    config: WhatsappConfig;
    isAIEnabled: boolean;
    isSavingAI: boolean;
    isSavingWhatsapp: boolean;
    isWhatsappDirty: boolean;
    onUpdateConfig: (updates: Partial<WhatsappConfig>) => void;
    onSaveWhatsapp: () => Promise<void>;
    onToggleAI: (enabled: boolean) => Promise<void>;
    onTestWhatsapp: () => Promise<void>;
    testingWhatsapp: boolean;
    hotelHasKey: boolean;
}

export const WhatsappTab = ({
    config,
    isAIEnabled,
    isSavingAI,
    isSavingWhatsapp,
    isWhatsappDirty,
    onUpdateConfig,
    onSaveWhatsapp,
    onToggleAI,
    onTestWhatsapp,
    testingWhatsapp,
    hotelHasKey
}: WhatsappTabProps) => {
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
                                Provide Meta WhatsApp Cloud API credentials to dispatch instant guest confirmations and reservation followups.
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
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-1">
                        <div className="space-y-2">
                            <Label htmlFor="whatsappApiKey">WhatsApp API Key / Access Token</Label>
                            <Input
                                id="whatsappApiKey"
                                type="password"
                                placeholder="EAAGz..."
                                value={config.whatsapp_api_key}
                                onChange={(e) => onUpdateConfig({ whatsapp_api_key: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="whatsappPhoneNumberId">Phone Number ID</Label>
                                <Input
                                    id="whatsappPhoneNumberId"
                                    placeholder="1098485747..."
                                    value={config.whatsapp_phone_number_id}
                                    onChange={(e) => onUpdateConfig({ whatsapp_phone_number_id: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="whatsappBusinessAccountId">WhatsApp Business Account ID</Label>
                                <Input
                                    id="whatsappBusinessAccountId"
                                    placeholder="948475839..."
                                    value={config.whatsapp_business_account_id}
                                    onChange={(e) => onUpdateConfig({ whatsapp_business_account_id: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t border-border/50 gap-2">
                        <Button
                            variant="secondary"
                            onClick={onTestWhatsapp}
                            disabled={testingWhatsapp || !hotelHasKey}
                            className="gap-2"
                        >
                            {testingWhatsapp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            Test Connection
                        </Button>
                        <div className="flex-1"></div>
                        {isWhatsappDirty && (
                            <span className="text-xs text-amber-500 flex items-center mr-2 font-medium">
                                ⚠️ Unsaved changes
                            </span>
                        )}
                        <Button onClick={onSaveWhatsapp} disabled={isSavingWhatsapp || !isWhatsappDirty} className="gap-2">
                            {isSavingWhatsapp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save WhatsApp Settings
                        </Button>
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
                        💡 Make sure you also configure the AI Provider credentials under the <strong>External Services</strong> tab to activate the chatbot brain.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};
