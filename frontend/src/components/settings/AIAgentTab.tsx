import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { Loader2, Save, Sparkles, AlertCircle } from 'lucide-react';
import { Hotel } from '@/types/api';

interface AIAgentTabProps {
  hotel: Hotel;
  setHotel: (hotel: Hotel) => void;
}

export function AIAgentTab({ hotel, setHotel }: AIAgentTabProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // AI Feature Flag (from Hotel model)
  const [isAIEnabled, setIsAIEnabled] = useState(hotel.feature_ai_agent || false);
  
  // AI Integration Settings
  const [aiSettings, setAiSettings] = useState({
    ai_provider: 'groq',
    ai_api_key: '',
    ai_model: 'llama-3.1-70b-versatile',
    ai_base_url: ''
  });

  useEffect(() => {
    // Fetch IntegrationSettings
    apiClient.get('/integration/settings')
      .then((res: any) => {
        setAiSettings({
          ai_provider: res.ai_provider || 'groq',
          ai_api_key: res.ai_api_key || '',
          ai_model: res.ai_model || 'llama-3.1-70b-versatile',
          ai_base_url: res.ai_base_url || ''
        });
      })
      .catch((err) => {
        console.error("Failed to fetch integration settings", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

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
      // Revert on failure
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
            <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-lg flex items-start gap-3 mt-4 text-sm text-indigo-800 dark:text-indigo-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Configuration Required</p>
                <p>
                  To make the AI Agent work, you must configure your AI Provider (like Groq or OpenAI) and provide an API key. 
                </p>
                <div className="mt-3">
                  <a 
                    href="/integration" 
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
                  >
                    Go to External Services &gt;
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
