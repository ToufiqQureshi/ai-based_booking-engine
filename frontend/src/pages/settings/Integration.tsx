import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Key, Globe, Search, MessageCircle, Loader2, BarChart3 } from 'lucide-react';
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
import { UsageTab } from '@/components/integration/UsageTab';

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
    const { hotel, user } = useAuth();
    const [settings, setSettings] = useState<IntegrationSettings | null>(null);
    const [activeHotelSlug, setActiveHotelSlug] = useState<string>('');
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [widgetCode, setWidgetCode] = useState<WidgetCode | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    // Chain info — populated only if user belongs to a chain
    const [chainSlug, setChainSlug] = useState<string>('');
    const [chainName, setChainName] = useState<string>('');

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

            // Fetch chain info if user is part of a chain (non-blocking)
            if (user?.chain_id) {
                apiClient.get<{ slug: string; name: string }>('/chain/info')
                    .then(info => {
                        if (info?.slug) setChainSlug(info.slug);
                        if (info?.name) setChainName(info.name);
                    })
                    .catch(() => {}); // Chain info is non-critical
            }

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

        const isSuperAdmin = user?.role === 'SUPER_ADMIN';

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
                    <TabsTrigger value="whatsapp" className="gap-2"><MessageCircle className="w-4 h-4" />WhatsApp</TabsTrigger>
                    {isSuperAdmin && <TabsTrigger value="settings" className="gap-2"><Globe className="w-4 h-4" />External Services</TabsTrigger>}
                    {!isSuperAdmin && <TabsTrigger value="usage" className="gap-2"><BarChart3 className="w-4 h-4" />Usage</TabsTrigger>}
                </TabsList>

                <TabsContent value="widget">
                    <BookingWidgetTab widgetCode={widgetCode} hotel={hotel} activeHotelSlug={activeHotelSlug} copyToClipboard={copyToClipboard} />
                </TabsContent>

                <TabsContent value="api-keys">
                    <ApiKeysTab apiKeys={apiKeys} onCreateKey={createAPIKey} onDeleteKey={deleteAPIKey} copyToClipboard={copyToClipboard} />
                </TabsContent>

                <TabsContent value="search-widget">
                    <SearchWidgetTab
                        settings={settings}
                        hotel={hotel}
                        activeHotelSlug={activeHotelSlug}
                        isDirty={isDirty}
                        isSavingSettings={isSavingSettings}
                        onUpdateSettings={updateSettings}
                        onSaveSettings={handleSaveSettings}
                        chainSlug={chainSlug || undefined}
                        chainName={chainName || undefined}
                    />
                </TabsContent>

                <TabsContent value="chat-widget">
                    <ChatWidgetTab hotel={hotel} activeHotelSlug={activeHotelSlug} copyToClipboard={copyToClipboard} />
                </TabsContent>

                {isSuperAdmin && (
                    <TabsContent value="settings">
                        <ExternalServicesTab settings={settings} isDirty={isDirty} isSavingSettings={isSavingSettings} onUpdateSettings={updateSettings} onSaveSettings={handleSaveSettings} />
                    </TabsContent>
                )}

                <TabsContent value="whatsapp">
                    <WhatsappTab hotel={hotel} />
                </TabsContent>

                {!isSuperAdmin && (
                    <TabsContent value="usage">
                        <UsageTab hotel={hotel} />
                    </TabsContent>
                )}
            </Tabs>
        </PageShell>
    );
};

export default IntegrationPage;
