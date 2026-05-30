import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, MessageCircle, Sparkles, Loader2, Save } from 'lucide-react';

interface IntegrationSettings {
    widget_enabled: boolean;
    widget_primary_color: string;
    widget_background_color: string;
    allowed_domains: string;
    webhook_url?: string;
    ai_provider?: string;
    ai_api_key?: string;
    ai_model?: string;
    ai_base_url?: string;
}

interface ExternalServicesTabProps {
    settings: IntegrationSettings | null;
    isDirty: boolean;
    isSavingSettings: boolean;
    testingAI: boolean;
    onUpdateSettings: (updates: Partial<IntegrationSettings>) => void;
    onSaveSettings: () => Promise<void>;
    onTestAI: () => Promise<void>;
}

export const ExternalServicesTab = ({
    settings,
    isDirty,
    isSavingSettings,
    testingAI,
    onUpdateSettings,
    onSaveSettings,
    onTestAI
}: ExternalServicesTabProps) => {
    if (!settings) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>Manage domain restrictions, webhooks, and AI configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-4">
                    <div>
                        <Label>Allowed Domains</Label>
                        <Input
                            placeholder="example.com, myhotel.com (comma-separated)"
                            value={settings.allowed_domains}
                            onChange={(e) => onUpdateSettings({ allowed_domains: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Leave empty to allow all domains (not recommended for production)
                        </p>
                    </div>

                    <div>
                        <Label>Webhook URL (Optional)</Label>
                        <Input
                            placeholder="https://your-site.com/webhook"
                            value={settings.webhook_url || ''}
                            onChange={(e) => onUpdateSettings({ webhook_url: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Receive real-time notifications for bookings
                        </p>
                    </div>
                </div>

                <div className="border-t pt-6 mt-4">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-primary" />
                        AI Agent Configuration
                    </h4>

                    <div className="grid gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl mb-2">
                            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-400 flex items-center gap-2 mb-1">
                                <Sparkles className="h-4 w-4" /> Recommended Setup
                            </h4>
                            <p className="text-[11px] text-blue-700/80 dark:text-blue-400/80 leading-relaxed">
                                Use <strong>Meta Llama 3.3 70B</strong> on Groq for best performance.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] bg-background"
                                    onClick={() => onUpdateSettings({
                                        ai_provider: 'groq',
                                        ai_model: 'llama-3.3-70b-versatile',
                                        ai_base_url: 'https://api.groq.com/openai/v1'
                                    })}
                                >
                                    Auto-Config Groq
                                </Button>
                            </div>
                        </div>

                        <div>
                            <Label>AI Provider</Label>
                            <select
                                className="w-full mt-1 border border-input bg-background px-3 py-2 text-sm rounded-md"
                                value={settings.ai_provider || 'groq'}
                                onChange={(e) => onUpdateSettings({ ai_provider: e.target.value })}
                            >
                                <option value="groq">Groq Cloud (Fastest)</option>
                                <option value="openai">OpenAI (Premium)</option>
                                <option value="deepseek">DeepSeek (Cost Effective)</option>
                            </select>
                        </div>

                        <div>
                            <Label>Custom API Key</Label>
                            <Input
                                type="password"
                                placeholder="Paste your key here"
                                value={settings.ai_api_key || ''}
                                onChange={(e) => onUpdateSettings({ ai_api_key: e.target.value })}
                            />
                        </div>

                        <div>
                            <Label>AI Model ID</Label>
                            <Input
                                placeholder="e.g. llama-3.3-70b-versatile"
                                value={settings.ai_model || ''}
                                onChange={(e) => onUpdateSettings({ ai_model: e.target.value })}
                            />
                        </div>

                        <div className="pt-2">
                            <Button
                                className="w-full gap-2"
                                variant="secondary"
                                onClick={onTestAI}
                                disabled={testingAI || !settings.ai_api_key}
                            >
                                {testingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                {testingAI ? 'Testing...' : 'Test AI Connection'}
                            </Button>
                        </div>

                        <div className="flex justify-end gap-2 pt-6 border-t border-border/50 mt-4">
                            {isDirty && <span className="text-xs text-amber-500 flex items-center mr-2 font-medium">⚠️ Unsaved changes</span>}
                            <Button onClick={onSaveSettings} disabled={isSavingSettings || !isDirty} className="gap-2">
                                {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save System Settings
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
