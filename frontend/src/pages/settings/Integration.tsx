import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Key, Globe, Search, MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageShell } from '@/components/layout/PageShell';
import { useParams, useNavigate } from 'react-router-dom';
import { ApiKeysTab } from '@/components/integration/ApiKeysTab';
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
    google_sheet_url?: string;
    widget_layout?: string;
    widget_custom_css?: string;
    widget_custom_js?: string;
    widget_theme?: string;
    widget_min_nights?: number;
    widget_advance_purchase_days?: number;
}

interface WidgetCode {
    html_code: string;
    javascript_code: string;
    instructions: string;
}

const IntegrationPage = () => {
    const { hotel, user } = useAuth();
    const { tab } = useParams<{ tab?: string }>();
    const navigate = useNavigate();
    
    const activeTab = tab || 'widget';

    const [settings, setSettings] = useState<IntegrationSettings | null>(null);
    const [activeHotelSlug, setActiveHotelSlug] = useState<string>('');
    const [properties, setProperties] = useState<any[]>([]);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [widgetCode, setWidgetCode] = useState<WidgetCode | null>(null);
    
    const [loadingWidget, setLoadingWidget] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [loadingKeys, setLoadingKeys] = useState(false);

    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    
    // Chain info — populated only if user belongs to a chain
    const [chainSlug, setChainSlug] = useState<string>('');
    const [chainName, setChainName] = useState<string>('');

    // Fetch chain info once on mount
    useEffect(() => {
        if (user?.chain_id) {
            apiClient.get<{ slug: string; name: string }>('/chain/info')
                .then(info => {
                    if (info?.slug) setChainSlug(info.slug);
                    if (info?.name) setChainName(info.name);
                })
                .catch(() => {});
        }
    }, [user?.chain_id]);

    // Lazy load data based on the active tab
    useEffect(() => {
        if (activeTab === 'widget' || activeTab === 'search-widget') {
            loadWidgetData();
        }
        if (activeTab === 'search-widget' || activeTab === 'chat-widget' || activeTab === 'settings') {
            loadSettingsData();
        }
        if (activeTab === 'api-keys') {
            if (apiKeys.length === 0) {
                loadKeysData();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const loadWidgetData = async () => {
        if (properties.length > 0 && widgetCode) return;
        setLoadingWidget(true);
        try {
            const [propertiesRes, widgetRes] = await Promise.all([
                apiClient.get<any[]>('/properties').catch(() => []),
                apiClient.get<WidgetCode>('/integration/widget-code').catch(() => null),
            ]);
            setProperties(propertiesRes);
            const currentProp = propertiesRes.find((p: any) => p.is_current) || propertiesRes[0];
            if (currentProp) setActiveHotelSlug(currentProp.slug);

            if (widgetRes) {
                const currentOrigin = window.location.origin;
                const urlRegex = /(http:\/\/localhost:8080|https:\/\/app\.gadget4me\.in|https:\/\/api\.hotelierhub\.com|https:\/\/book\.hotelierhub\.com)/g;
                widgetRes.html_code = widgetRes.html_code?.replace(urlRegex, currentOrigin);
                widgetRes.javascript_code = widgetRes.javascript_code?.replace(urlRegex, currentOrigin);
                widgetRes.instructions = widgetRes.instructions?.replace(urlRegex, currentOrigin);
                setWidgetCode(widgetRes);
            }
        } catch (error) {
            console.error('Error fetching widget integration data:', error);
            toast.error('Failed to load widget integration details');
        } finally {
            setLoadingWidget(false);
        }
    };

    const loadSettingsData = async () => {
        if (settings) return;
        setLoadingSettings(true);
        try {
            const settingsData = await apiClient.get<IntegrationSettings>('/integration/settings');
            setSettings(settingsData);
        } catch (error) {
            console.error('Error fetching settings:', error);
            toast.error('Failed to load integration settings');
        } finally {
            setLoadingSettings(false);
        }
    };

    const loadKeysData = async () => {
        setLoadingKeys(true);
        try {
            const keysData = await apiClient.get<ApiKey[]>('/integration/api-keys').catch(() => []);
            setApiKeys(keysData);
        } catch (error) {
            console.error('Error fetching API keys:', error);
            toast.error('Failed to load API keys');
        } finally {
            setLoadingKeys(false);
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
            loadKeysData();
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
            loadKeysData();
            toast.success('API key deleted');
        } catch (error) {
            toast.error('Failed to delete API key');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    return (
        <PageShell
            title="Integration"
            subtitle="Connect your hotel website and manage API access"
        >
            <Tabs value={activeTab} onValueChange={(val) => navigate(`/integration/${val}`)} className="space-y-6">
                {/* On phones the 5 tabs overflow the viewport. Allow horizontal
                    scroll and left-align so no tab (API Keys / External Services)
                    gets clipped and unreachable. */}
                <TabsList className="bg-muted/50 p-1 w-full max-w-full justify-start overflow-x-auto">
                    <TabsTrigger value="widget" className="gap-2"><Code className="w-4 h-4" />Full Page Link</TabsTrigger>
                    <TabsTrigger value="search-widget" className="gap-2"><Search className="w-4 h-4" />Search Widget</TabsTrigger>
                    <TabsTrigger value="chat-widget" className="gap-2"><MessageCircle className="w-4 h-4" />Chat Widget</TabsTrigger>
                    <TabsTrigger value="api-keys" className="gap-2"><Key className="w-4 h-4" />API Keys</TabsTrigger>
                    {isSuperAdmin && <TabsTrigger value="settings" className="gap-2"><Globe className="w-4 h-4" />External Services</TabsTrigger>}
                </TabsList>

                <TabsContent value="widget" className="mt-0">
                    {loadingWidget ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <BookingWidgetTab widgetCode={widgetCode} hotel={hotel} activeHotelSlug={activeHotelSlug} copyToClipboard={copyToClipboard} />
                    )}
                </TabsContent>

                <TabsContent value="api-keys" className="mt-0">
                    {loadingKeys ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <ApiKeysTab apiKeys={apiKeys} onCreateKey={createAPIKey} onDeleteKey={deleteAPIKey} copyToClipboard={copyToClipboard} />
                    )}
                </TabsContent>

                <TabsContent value="search-widget" className="mt-0">
                    {loadingWidget ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <SearchWidgetTab
                            settings={settings}
                            hotel={hotel}
                            activeHotelSlug={activeHotelSlug}
                            isDirty={isDirty}
                            isSavingSettings={isSavingSettings}
                            onUpdateSettings={updateSettings}
                            onSaveSettings={handleSaveSettings}
                            widgetCode={widgetCode}
                            copyToClipboard={copyToClipboard}
                            chainSlug={chainSlug || undefined}
                            chainName={chainName || undefined}
                        />
                    )}
                </TabsContent>

                <TabsContent value="chat-widget" className="mt-0">
                    {loadingSettings ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <ChatWidgetTab hotel={hotel} activeHotelSlug={activeHotelSlug} copyToClipboard={copyToClipboard} />
                    )}
                </TabsContent>

                {isSuperAdmin && (
                    <TabsContent value="settings" className="mt-0">
                        {loadingSettings ? (
                            <div className="flex items-center justify-center h-48">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <ExternalServicesTab settings={settings} isDirty={isDirty} isSavingSettings={isSavingSettings} onUpdateSettings={updateSettings} onSaveSettings={handleSaveSettings} />
                        )}
                    </TabsContent>
                )}

            </Tabs>
        </PageShell>
    );
};

export default IntegrationPage;
