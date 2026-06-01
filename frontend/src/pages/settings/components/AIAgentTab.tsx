import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { Loader2, Sparkles, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Hotel } from '@/types/api';

interface AIAgentTabProps {
  hotel: Hotel;
  setHotel: (hotel: Hotel) => void;
}

/**
 * AI Agent tab — HOTELIER-FACING.
 *
 * Multi-tenant security: this tab is intentionally limited to the
 * feature on/off toggle. The actual AI provider credentials
 * (api_key, base_url, model) are configured by the super-admin in
 * their dashboard and never appear here. Hoteliers see a single
 * "configured by platform admin" status indicator.
 */
export function AIAgentTab({ hotel, setHotel }: AIAgentTabProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isAIEnabled, setIsAIEnabled] = useState(hotel.feature_ai_agent || false);
  const [hasAIKey, setHasAIKey] = useState(!!(hotel as any).has_ai_key);
  const [aiProvider, setAiProvider] = useState((hotel as any).ai_provider || '');
  const [aiModel, setAiModel] = useState((hotel as any).ai_model || '');

  useEffect(() => {
    // Re-sync from latest hotel prop
    setIsAIEnabled(hotel.feature_ai_agent || false);
    setHasAIKey(!!(hotel as any).has_ai_key);
    setAiProvider((hotel as any).ai_provider || '');
    setAiModel((hotel as any).ai_model || '');
    setIsLoading(false);
  }, [hotel]);

  const handleToggle = async (enabled: boolean) => {
    setIsAIEnabled(enabled);
    try {
      setIsSaving(true);
      const updatedHotel = await apiClient.patch<Hotel>('/hotels/me', {
        feature_ai_agent: enabled
      });
      setHotel(updatedHotel);
      toast({
        title: enabled ? 'AI Agent Enabled' : 'AI Agent Disabled',
        description: enabled ? 'Your AI Agent is now active.' : 'Your AI Agent has been turned off.',
      });
    } catch (error: any) {
      setIsAIEnabled(!enabled);
      toast({
        variant: 'destructive',
        title: 'Error saving settings',
        description: error?.response?.data?.detail || 'Something went wrong.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                WhatsApp AI Agent
              </CardTitle>
              <CardDescription>
                Enable the AI agent to automatically chat with guests, answer questions, and generate booking links via WhatsApp.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={isAIEnabled}
                onCheckedChange={handleToggle}
                disabled={isSaving}
              />
              <Label className="font-semibold flex items-center gap-2">
                {isAIEnabled ? "Active" : "Disabled"}
                {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </Label>
            </div>
          </div>
        </CardHeader>

        {isAIEnabled && (
          <CardContent className="space-y-6 pt-0 mt-4 border-t">
            {hasAIKey ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-lg flex items-start gap-3 mt-4 text-sm text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-1">AI Provider Configured</p>
                  <p>
                    Your AI agent is connected to <strong>{aiProvider || 'the platform default provider'}</strong>
                    {aiModel ? <> using <code className="bg-emerald-100 dark:bg-emerald-900/50 px-1 rounded">{aiModel}</code></> : null}.
                    Provider credentials are securely managed by your platform admin.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg flex items-start gap-3 mt-4 text-sm text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-1">Provider not configured yet</p>
                  <p>
                    You've enabled the AI Agent, but no AI provider credentials have been
                    configured for this property. Your platform admin can set this up — once
                    configured, this widget will go live.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Why you don't see API keys here</p>
                <p>
                  AI provider credentials are shared across all hotels on your platform
                  subscription and are managed centrally for security. To request a change,
                  contact your platform admin.
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
