import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Lock } from 'lucide-react';

interface IntegrationSettings {
    widget_enabled: boolean;
    widget_primary_color: string;
    widget_background_color: string;
    allowed_domains: string;
    webhook_url?: string;
}

interface ExternalServicesTabProps {
    settings: IntegrationSettings | null;
    isDirty: boolean;
    isSavingSettings: boolean;
    onUpdateSettings: (updates: Partial<IntegrationSettings>) => void;
    onSaveSettings: () => Promise<void>;
}

export const ExternalServicesTab = ({
    settings,
    isDirty,
    isSavingSettings,
    onUpdateSettings,
    onSaveSettings,
}: ExternalServicesTabProps) => {
    if (!settings) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>Manage domain restrictions and webhooks</CardDescription>
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
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border">
                        <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-foreground">AI Configuration — Platform Managed</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                AI provider, model, API key, and token limits are configured by your platform admin. Contact support if you need changes.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
                    {isDirty && <span className="text-xs text-amber-500 flex items-center mr-2 font-medium">⚠️ Unsaved changes</span>}
                    <Button onClick={onSaveSettings} disabled={isSavingSettings || !isDirty} className="gap-2">
                        {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Settings
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
