import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Key, Globe, Search, MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageShell } from '@/components/layout/PageShell';
import { ApiKeysTab } from '@/components/integration/ApiKeysTab';
import { WhatsappTab } from '@/components/integration/WhatsappTab';
import { ExternalServicesTab } from '@/components/integration/ExternalServicesTab';
import { BookingWidgetTab } from '@/components/integration/BookingWidgetTab';
import { ChatWidgetTab } from '@/components/integration/ChatWidgetTab';
import { SearchWidgetTab } from '@/components/integration/SearchWidgetTab';

interface ApiKey {
    id: string;
    name: string;
    key_prefix: string;
    is_active: boolean;
    request_count: number;
    created_at: string;
}

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
    google_sheet_url?: string;
    widget_layout?: string;
    widget_custom_css?: string;
    widget_custom_js?: string;
    widget_theme?: string;
}

interface WidgetCode {
    html_code: string;
    javascript_code: string;
    instructions: string;
}

const IntegrationPage = () => {
    const { hotel, setHotel, user } = useAuth();
    const [settings, setSettings] = useState<IntegrationSettings | null>(null);
    const [isAIEnabled, setIsAIEnabled] = useState(hotel?.feature_ai_agent || false);
    const [isSavingAI, setIsSavingAI] = useState(false);
    const [activeHotelSlug, setActiveHotelSlug] = useState<string>('');
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [widgetCode, setWidgetCode] = useState<WidgetCode | null>(null);
    const [loading, setLoading] = useState(true);
    const [testingAI, setTestingAI] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [properties, settingsData, keysData, widgetData] = await Promise.all([
                apiClient.get<any[]>('/properties').catch(() => []),
                apiClient.get<IntegrationSettings>('/integration/settings'),
                apiClient.get<ApiKey[]>('/integration/api-keys').catch(() => []),
                apiClient.get<WidgetCode>('/integration/widget-code').catch(() => null),
            ]);

            const currentProp = properties.find((p: any) => p.is_current) || properties[0];
            if (currentProp) setActiveHotelSlug(currentProp.slug);

            setSettings(settingsData);
            setApiKeys(keysData);

            if (widgetData) {
                const currentOrigin = window.location.origin;
                const urlRegex = /(http:\/\/localhost:8080|https:\/\/app\.gadget4me\.in|https:\/\/api\.hotelierhub\.com|https:\/\/book\.hotelierhub\.com)/g;
                widgetData.html_code = widgetData.html_code?.replace(urlRegex, currentOrigin);
                widgetData.javascript_code = widgetData.javascript_code?.replace(urlRegex, currentOrigin);
                widgetData.instructions = widgetData.instructions?.replace(urlRegex, currentOrigin);
                setWidgetCode(widgetData);
            }

            setLoading(false);
        } catch (error) {
            console.error('Error fetching integration data:', error);
            toast.error('Failed to load integration settings');
            setLoading(false);
        }
    };

    const updateSettings = (updates: Partial<IntegrationSettings>) => {
        if (settings) {
            setSettings({ ...settings, ...updates });
            setIsDirty(true);
        }
    };

    const handleSaveSettings = async () => {
        if (!settings || isSavingSettings) return;
        setIsSavingSettings(true);
        try {
            const data = await apiClient.put<IntegrationSettings>('/integration/settings', settings);
            setSettings(data);
            setIsDirty(false);
            toast.success('Integration settings saved successfully');
        } catch (error) {
            toast.error('Failed to save integration settings');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleToggleAI = async (enabled: boolean) => {
        if (isSavingAI) return;
        setIsAIEnabled(enabled);
        try {
            setIsSavingAI(true);
            const updatedHotel = await apiClient.patch<any>('/hotels/me', {
                feature_ai_agent: enabled
            });
            setHotel(updatedHotel);
            toast.success(enabled ? 'WhatsApp AI Agent is now active!' : 'WhatsApp AI Agent disabled.');
        } catch (error) {
            setIsAIEnabled(!enabled);
            toast.error('Failed to change AI Agent status.');
        } finally {
            setIsSavingAI(false);
        }
    };

    const testAI = async () => {
        if (testingAI) return;
        setTestingAI(true);
        try {
            const res = await apiClient.post<any>('/integration/test-ai');
            if (res.status === 'success') {
                toast.success(res.message);
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error('Test failed. Check your API key and network.');
        } finally {
            setTestingAI(false);
        }
    };

    const createAPIKey = async (name: string) => {
        try {
            const data = await apiClient.post<any>('/integration/api-keys', { name });
            fetchData();
            toast.success('API key created successfully');
            return data;
        } catch (error) {
            toast.error('Failed to create API key');
        }
    };

    const deleteAPIKey = async (keyId: string) => {
        if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
            return;
        }
        try {
            await apiClient.delete(`/integration/api-keys/${keyId}`);
            fetchData();
            toast.success('API key deleted');
        } catch (error) {
            toast.error('Failed to delete API key');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    if (loading) {
        return <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>;
    }

    return (
        <PageShell
            title="Integration"
            subtitle="Connect your hotel website and manage API access"
        >
            <Tabs defaultValue="widget" className="space-y-6">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="widget" className="gap-2"><Code className="w-4 h-4" />Full Page Link</TabsTrigger>
                    <TabsTrigger value="search-widget" className="gap-2"><Search className="w-4 h-4" />Search Widget</TabsTrigger>
                    <TabsTrigger value="chat-widget" className="gap-2"><MessageCircle className="w-4 h-4" />Chat Widget</TabsTrigger>
                    <TabsTrigger value="api-keys" className="gap-2"><Key className="w-4 h-4" />API Keys</TabsTrigger>
                    <TabsTrigger value="settings" className="gap-2"><Globe className="w-4 h-4" />External Services</TabsTrigger>
                    <TabsTrigger value="whatsapp" className="gap-2"><MessageCircle className="w-4 h-4" />WhatsApp</TabsTrigger>
                </TabsList>

                <TabsContent value="widget">
                    <BookingWidgetTab widgetCode={widgetCode} hotel={hotel} activeHotelSlug={activeHotelSlug} copyToClipboard={copyToClipboard} />
                </TabsContent>

                <TabsContent value="api-keys">
                    <ApiKeysTab apiKeys={apiKeys} onCreateKey={createAPIKey} onDeleteKey={deleteAPIKey} copyToClipboard={copyToClipboard} />
                </TabsContent>

                <TabsContent value="search-widget">
                    <SearchWidgetTab settings={settings} hotel={hotel} activeHotelSlug={activeHotelSlug} isDirty={isDirty} isSavingSettings={isSavingSettings} onUpdateSettings={updateSettings} onSaveSettings={handleSaveSettings} />
                </TabsContent>

                <TabsContent value="chat-widget">
                    <ChatWidgetTab hotel={hotel} activeHotelSlug={activeHotelSlug} copyToClipboard={copyToClipboard} />
                </TabsContent>

                <TabsContent value="settings">
                    <ExternalServicesTab settings={settings} user={user} isDirty={isDirty} isSavingSettings={isSavingSettings} testingAI={testingAI} onUpdateSettings={updateSettings} onSaveSettings={handleSaveSettings} onTestAI={testAI} />
                </TabsContent>

                <TabsContent value="whatsapp">
                    <WhatsappTab user={user} isAIEnabled={isAIEnabled} isSavingAI={isSavingAI} onToggleAI={handleToggleAI} hotel={hotel} />
                </TabsContent>
            </Tabs>
        </PageShell>
    );
};

export default IntegrationPage;
