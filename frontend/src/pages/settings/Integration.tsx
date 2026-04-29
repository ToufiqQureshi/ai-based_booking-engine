import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, Key, Code, Webhook, Globe, Plus, Trash2, Eye, EyeOff, Search, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';

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
}

interface WidgetCode {
    html_code: string;
    javascript_code: string;
    instructions: string;
}

interface CreatedKey {
    secret_key: string;
}

import { useAuth } from '@/contexts/AuthContext';

const IntegrationPage = () => {
    const { hotel } = useAuth();
    const [settings, setSettings] = useState<IntegrationSettings | null>(null);
    const [activeHotelSlug, setActiveHotelSlug] = useState<string>('');
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [widgetCode, setWidgetCode] = useState<WidgetCode | null>(null);
    const [loading, setLoading] = useState(true);
    const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
    const [previewHeight, setPreviewHeight] = useState(160);

    // Mobile Menu State
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Preview Resizing Logic
    useEffect(() => {
        const handleResize = (event: MessageEvent) => {
            if (event.data && event.data.type === 'RESIZE_SEARCH_WIDGET') {
                if (event.data.height) {
                    setPreviewHeight(event.data.height);
                }
            }
        };
        window.addEventListener('message', handleResize);
        return () => window.removeEventListener('message', handleResize);
    }, []);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch current hotel slug via properties
            let slug = '';
            try {
                const properties = await apiClient.get<any[]>('/properties');
                const currentProp = properties.find(p => p.is_current) || properties[0];
                if (currentProp) {
                    slug = currentProp.slug;
                    setActiveHotelSlug(currentProp.slug);
                }
            } catch (err) {
                console.error("Failed to fetch properties fallback", err);
            }

            // Fetch integration settings
            const settingsData = await apiClient.get<IntegrationSettings>('/integration/settings');
            setSettings(settingsData);

            // Fetch API keys
            const keysData = await apiClient.get<ApiKey[]>('/integration/api-keys');
            setApiKeys(keysData);

            // Fetch widget code
            const widgetData = await apiClient.get<WidgetCode>('/integration/widget-code');

            // FRONTEND PATCH: Ensure URLs are correct even if backend is stale
            if (widgetData) {
                const currentOrigin = window.location.origin;
                // Replace localhost OR hardcoded domains with current origin
                // This ensures if you are on "hotelier.com", the code says "hotelier.com"

                // Regex to catch localhost:8080 (http/https) and app.gadget4me.in
                const urlRegex = /(http:\/\/localhost:8080|https:\/\/app\.gadget4me\.in|https:\/\/api\.hotelierhub\.com|https:\/\/book\.hotelierhub\.com)/g;

                widgetData.html_code = widgetData.html_code.replace(urlRegex, currentOrigin);
                widgetData.javascript_code = widgetData.javascript_code.replace(urlRegex, currentOrigin);
                widgetData.instructions = widgetData.instructions.replace(urlRegex, currentOrigin);

                // Replace placeholder slug with actual if available
                const finalSlug = slug || hotel?.slug;
                if (finalSlug) {
                    const slugRegex = /my-grand-hotel/g;
                    widgetData.html_code = widgetData.html_code.replace(slugRegex, finalSlug);
                    widgetData.javascript_code = widgetData.javascript_code.replace(slugRegex, finalSlug);
                    widgetData.instructions = widgetData.instructions.replace(slugRegex, finalSlug);
                }
            }

            setWidgetCode(widgetData);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching integration data:', error);
            toast.error('Failed to load integration settings');
            setLoading(false);
        }
    };

    const updateSettings = async (updates: Partial<IntegrationSettings>) => {
        try {
            const data = await apiClient.put<IntegrationSettings>('/integration/settings', updates);
            setSettings(data);
            toast.success('Settings updated successfully');
        } catch (error) {
            toast.error('Failed to update settings');
        }
    };

    const createAPIKey = async () => {
        if (!newKeyName.trim()) {
            toast.error('Please enter a key name');
            return;
        }

        try {
            const data = await apiClient.post<CreatedKey>('/integration/api-keys', { name: newKeyName });
            setCreatedKey(data);
            setNewKeyName('');
            fetchData();
            toast.success('API key created successfully');
        } catch (error) {
            toast.error('Failed to create API key');
        }
    };

    const deleteAPIKey = async (keyId) => {
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

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    if (loading) {
        return <div className="flex items-center justify-center h-96">Loading...</div>;
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Integration</h1>
                <p className="text-muted-foreground">Connect your hotel website and manage API access</p>
            </div>

            <Tabs defaultValue="widget" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="widget" className="flex items-center gap-2">
                        <Code className="w-4 h-4" />
                        Full Page Link
                    </TabsTrigger>
                    <TabsTrigger value="search-widget" className="flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Search Widget
                    </TabsTrigger>
                    <TabsTrigger value="chat-widget" className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        Chat Widget
                    </TabsTrigger>
                    <TabsTrigger value="api-keys" className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        API Keys
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Settings
                    </TabsTrigger>
                </TabsList>

                {/* Widget Tab */}
                <TabsContent value="widget" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Embed Booking Widget</CardTitle>
                            <CardDescription>
                                Add this code to your website to enable direct bookings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Direct Booking Link</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={`${window.location.origin}/book/${activeHotelSlug || 'my-grand-hotel'}/rooms`}
                                        readOnly
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={() => copyToClipboard(`${window.location.origin}/book/${activeHotelSlug || 'my-grand-hotel'}/rooms`)}
                                    >
                                        Copy
                                    </Button>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Share this link directly with guests or link it to a "Book Now" button on your site.
                                </p>
                            </div>

                            <div className="border-t my-4" />

                            {widgetCode && (
                                <>
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <Label>HTML Code</Label>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => copyToClipboard(widgetCode.html_code)}
                                            >
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                        </div>
                                        <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                                            {widgetCode.html_code}
                                        </pre>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <Label>JavaScript Code</Label>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => copyToClipboard(widgetCode.javascript_code)}
                                            >
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                        </div>
                                        <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                                            {widgetCode.javascript_code}
                                        </pre>
                                    </div>

                                    <Alert>
                                        <AlertDescription>
                                            <div className="prose prose-sm max-w-none">
                                                <pre className="whitespace-pre-wrap text-xs">{widgetCode.instructions}</pre>
                                            </div>
                                        </AlertDescription>
                                    </Alert>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* API Keys Tab */}
                <TabsContent value="api-keys" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>API Keys</CardTitle>
                                    <CardDescription>
                                        Manage API keys for external integrations
                                    </CardDescription>
                                </div>
                                <Button onClick={() => setShowNewKeyDialog(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create API Key
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {createdKey && (
                                <Alert className="mb-4 border-green-500 bg-green-50">
                                    <AlertDescription>
                                        <div className="space-y-2">
                                            <p className="font-semibold">⚠️ Save this key now! It won't be shown again.</p>
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 p-2 bg-white rounded border">
                                                    {createdKey.secret_key}
                                                </code>
                                                <Button
                                                    size="sm"
                                                    onClick={() => copyToClipboard(createdKey.secret_key)}
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setCreatedKey(null)}
                                            >
                                                I've saved it
                                            </Button>
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {showNewKeyDialog && (
                                <div className="mb-4 p-4 border rounded-lg space-y-4">
                                    <div>
                                        <Label>Key Name</Label>
                                        <Input
                                            placeholder="e.g., Main Website, Mobile App"
                                            value={newKeyName}
                                            onChange={(e) => setNewKeyName(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={createAPIKey}>Create</Button>
                                        <Button variant="outline" onClick={() => setShowNewKeyDialog(false)}>
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                {apiKeys.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-8">
                                        No API keys yet. Create one to get started.
                                    </p>
                                ) : (
                                    apiKeys.map((key) => (
                                        <div
                                            key={key.id}
                                            className="flex items-center justify-between p-4 border rounded-lg"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium">{key.name}</p>
                                                    <Badge variant={key.is_active ? 'default' : 'secondary'}>
                                                        {key.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground font-mono">
                                                    {key.key_prefix}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Created: {new Date(key.created_at).toLocaleDateString()} •
                                                    Used: {key.request_count} times
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteAPIKey(key.id)}
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Search Widget Tab */}
                <TabsContent value="search-widget" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Embed Search Bar</CardTitle>
                            <CardDescription>
                                Add a booking bar to your website. We recommend the JavaScript method for best experience.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Preview */}
                            <div className="space-y-2">
                                <Label>Preview</Label>
                                <div className="p-8 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center transition-all duration-300">
                                    <iframe
                                        src={`${window.location.origin}/book/${activeHotelSlug || 'demo'}/widget`}
                                        className="w-full max-w-4xl border-0 rounded-none overflow-visible shadow-none transition-all duration-300"
                                        style={{ height: `${previewHeight}px` }}
                                        title="Booking Widget Preview"
                                    />
                                </div>
                            </div>

                            <div className="border-t my-4" />

                            {/* Smart Embed Code */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label>Embed Code (Copy & Paste)</Label>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copyToClipboard(`<div style="height: 120px; position: relative; z-index: 9999;">
    <iframe 
        id="hotelier-search-widget"
        src="${window.location.origin}/book/${activeHotelSlug || 'demo'}/widget" 
        style="width: 100%; height: 600px; border: none; position: absolute; top: 0; left: 0; overflow: visible;" 
        scrolling="no" 
        title="Book Now">
    </iframe>
</div>`)}
                                    >
                                        <Copy className="w-4 h-4 mr-2" />
                                        Copy Code
                                    </Button>
                                </div>
                                <pre className="p-4 bg-slate-900 text-slate-50 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed text-wrap break-all">
                                    {`<div style="height: 120px; position: relative; z-index: 9999;">
    <iframe 
        id="hotelier-search-widget"
        src="${window.location.origin}/book/${activeHotelSlug || 'demo'}/widget" 
        style="width: 100%; height: 600px; border: none; position: absolute; top: 0; left: 0; overflow: visible;" 
        scrolling="no" 
        title="Book Now">
    </iframe>
</div>`}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Chat Widget Tab */}
                <TabsContent value="chat-widget" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Embed Chat Widget</CardTitle>
                            <CardDescription>
                                Add the AI Concierge to your website.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Preview</Label>
                                <div className="p-8 bg-slate-50 rounded-xl border border-slate-100 h-64 flex items-center justify-center relative overflow-hidden">
                                    <div className="absolute bottom-4 right-4 bg-white p-2 rounded-full shadow-lg border border-purple-100 flex items-center gap-2">
                                        <img src="/webmerito-icon.png" alt="Chat" className="w-8 h-8" />
                                        <span className="font-bold text-sm text-purple-600">I m saaraa ai !</span>
                                    </div>
                                    <p className="text-muted-foreground text-sm">Widget appears at bottom-right</p>
                                </div>
                            </div>

                            <div className="border-t my-4" />

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label>Script Code (Add before &lt;/body&gt;)</Label>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copyToClipboard(`<script src="${window.location.origin}/widget-v3.js"></script><script>HotelierWidget.init({hotelSlug: '${activeHotelSlug || 'demo'}', frontendUrl: '${window.location.origin}'});</script>`)}
                                    >
                                        <Copy className="w-4 h-4 mr-2" />
                                        Copy Code
                                    </Button>
                                </div>
                                <pre className="p-4 bg-slate-900 text-slate-50 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed text-wrap break-all">
                                    {`<script src="${window.location.origin}/widget-v3.js"></script>
<script>
  HotelierWidget.init({
    hotelSlug: '${activeHotelSlug || 'demo'}',
    frontendUrl: '${window.location.origin}'
  });
</script>`}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Widget Settings</CardTitle>
                            <CardDescription>Customize your booking widget appearance</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {settings && (
                                <>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label>Enable Widget</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Allow bookings through embedded widget
                                            </p>
                                        </div>
                                        <Switch
                                            checked={settings.widget_enabled}
                                            onCheckedChange={(checked) =>
                                                updateSettings({ widget_enabled: checked })
                                            }
                                        />
                                    </div>

                                    <div>
                                        <Label>Primary Color</Label>
                                        <Input
                                            type="color"
                                            value={settings.widget_primary_color}
                                            onChange={(e) =>
                                                updateSettings({ widget_primary_color: e.target.value })
                                            }
                                        />
                                    </div>

                                    <div>
                                        <Label>Widget Background Color</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                value={settings.widget_background_color || '#ffffff'}
                                                onChange={(e) =>
                                                    updateSettings({ widget_background_color: e.target.value })
                                                }
                                                className="w-12 p-1 px-1 h-10"
                                            />
                                            <Input
                                                type="text"
                                                value={settings.widget_background_color || '#ffffff'}
                                                onChange={(e) =>
                                                    updateSettings({ widget_background_color: e.target.value })
                                                }
                                                placeholder="#ffffff"
                                            />
                                        </div>
                                    </div>



                                    <div>
                                        <Label>Allowed Domains</Label>
                                        <Input
                                            placeholder="example.com, myhotel.com (comma-separated)"
                                            value={settings.allowed_domains}
                                            onChange={(e) =>
                                                updateSettings({ allowed_domains: e.target.value })
                                            }
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
                                            onChange={(e) =>
                                                updateSettings({ webhook_url: e.target.value })
                                            }
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Receive real-time notifications for bookings
                                        </p>
                                    </div>

                                    <div className="border-t pt-4 mt-4">
                                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                            <MessageCircle className="w-4 h-4 text-primary" />
                                            AI Agent Configuration
                                        </h4>
                                        
                                        <div className="grid gap-4">
                                            <div>
                                                <Label>AI Provider</Label>
                                                <select
                                                    className="w-full mt-1 border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-md"
                                                    value={settings.ai_provider || 'groq'}
                                                    onChange={(e) =>
                                                        updateSettings({ ai_provider: e.target.value })
                                                    }
                                                >
                                                    <option value="groq">Groq (Default)</option>
                                                    <option value="deepseek">DeepSeek</option>
                                                    <option value="openai">OpenAI</option>
                                                </select>
                                            </div>

                                            <div>
                                                <Label>Custom API Key (Optional)</Label>
                                                <Input
                                                    type="password"
                                                    placeholder="Provide your own provider API Key"
                                                    value={settings.ai_api_key || ''}
                                                    onChange={(e) =>
                                                        updateSettings({ ai_api_key: e.target.value })
                                                    }
                                                />
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Leave empty to use platform defaults.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div >
    );
};

export default IntegrationPage;
