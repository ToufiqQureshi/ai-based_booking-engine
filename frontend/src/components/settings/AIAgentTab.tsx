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

  const handleUpdate = (field: string, value: string) => {
    setAiSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // 1. Update Integration Settings
      await apiClient.put('/integration/settings', {
        ...aiSettings
      });
      
      // 2. Update Hotel Feature Flag
      const updatedHotel = await apiClient.patch<Hotel>('/hotels/me', {
        feature_ai_agent: isAIEnabled
      });
      
      setHotel(updatedHotel);
      
      toast({
        title: 'AI Settings Saved',
        description: 'Your chatbot brain has been configured successfully!',
      });
    } catch (error: any) {
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
                onCheckedChange={setIsAIEnabled}
              />
              <Label className="font-semibold">{isAIEnabled ? "Active" : "Disabled"}</Label>
            </div>
          </div>
        </CardHeader>
        
        {isAIEnabled && (
          <CardContent className="space-y-6 pt-0 mt-4 border-t">
            <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-lg flex items-start gap-3 mt-4 text-sm text-indigo-800 dark:text-indigo-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">How this works</p>
                <p>The AI Agent uses an LLM (Large Language Model) to understand guest intent. You must provide an API key for your chosen provider. <strong>We recommend Groq for instant responses.</strong></p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>AI Provider</Label>
                <Select value={aiSettings.ai_provider} onValueChange={(v) => handleUpdate('ai_provider', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="groq">Groq (Recommended - Extremely Fast)</SelectItem>
                    <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>AI Model</Label>
                <Input
                  placeholder={aiSettings.ai_provider === 'groq' ? "llama-3.1-70b-versatile" : "gpt-4o-mini"}
                  value={aiSettings.ai_model}
                  onChange={(e) => handleUpdate('ai_model', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Example: llama-3.1-70b-versatile, gpt-4o-mini</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="sk-..."
                value={aiSettings.ai_api_key}
                onChange={(e) => handleUpdate('ai_api_key', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Your secret API key from the provider dashboard.</p>
            </div>

            <div className="space-y-2">
              <Label>Base URL (Optional)</Label>
              <Input
                placeholder="https://api.openai.com/v1"
                value={aiSettings.ai_base_url}
                onChange={(e) => handleUpdate('ai_base_url', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Only required if you are using a custom proxy or Azure OpenAI.</p>
            </div>
            
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save AI Configuration
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
