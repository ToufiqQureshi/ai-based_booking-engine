import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, Save, Building2, Hotel, Code } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChainWidgetTab } from '@/components/integration/ChainWidgetTab';
import { PremiumLockNotice } from '@/components/integration/PremiumLockNotice';

interface IntegrationSettings {
    widget_enabled: boolean;
    widget_primary_color: string;
    widget_background_color: string;
    widget_layout?: string;
    widget_theme?: string;
}

interface WidgetCode {
    html_code: string;
    javascript_code: string;
    instructions: string;
}

interface SearchWidgetTabProps {
    settings: IntegrationSettings | null;
    hotel: any;
    activeHotelSlug: string;
    isDirty: boolean;
    isSavingSettings: boolean;
    onUpdateSettings: (updates: Partial<IntegrationSettings>) => void;
    onSaveSettings: () => Promise<void>;
    // Embed code (search-bar widget) — shown right under the live preview so the
    // hotelier customises, previews AND copies the snippet in one place.
    widgetCode?: WidgetCode | null;
    copyToClipboard: (text: string) => void;
    // Chain props — only provided when user belongs to a chain
    chainSlug?: string;
    chainName?: string;
}

export const SearchWidgetTab = ({
    settings,
    hotel,
    activeHotelSlug,
    isDirty,
    isSavingSettings,
    onUpdateSettings,
    onSaveSettings,
    widgetCode,
    copyToClipboard,
    chainSlug,
    chainName,
}: SearchWidgetTabProps) => {
    const [previewHeight, setPreviewHeight] = useState(160);
    const isChainUser = !!chainSlug;
    const [widgetMode, setWidgetMode] = useState<'single' | 'chain'>('single');

    useEffect(() => {
        const handleResize = (event: MessageEvent) => {
            if (event.data && event.data.type === 'RESIZE_SEARCH_WIDGET') {
                if (event.data.height) setPreviewHeight(event.data.height);
            }
        };
        window.addEventListener('message', handleResize);
        return () => window.removeEventListener('message', handleResize);
    }, []);

    if (!settings) return null;

    const layouts = [
        { id: 'modern', name: 'Modern Row', desc: 'Side-by-side inputs' },
        { id: 'classic', name: 'Classic Stacked', desc: 'Vertical form' },
        { id: 'minimal', name: 'Minimal Bar', desc: 'Clean underline' },
        { id: 'premium', name: 'Premium Capsule', desc: 'Rounded floating' },
    ];

    return (
        <div className="space-y-4">
            {/* ── Widget Type Selector (only shown to chain users) ────────── */}
            {isChainUser && (
                <Card>
                    <CardHeader className="border-b px-6 py-4">
                        <CardTitle className="text-sm font-bold">Widget Type</CardTitle>
                        <CardDescription className="text-xs">
                            Choose which widget to embed on your website
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                onClick={() => setWidgetMode('single')}
                                className={cn(
                                    'flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                                    widgetMode === 'single'
                                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30'
                                        : 'border-border hover:border-indigo-200'
                                )}
                            >
                                <div className={cn(
                                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                                    widgetMode === 'single' ? 'bg-indigo-100 dark:bg-indigo-900/60' : 'bg-muted'
                                )}>
                                    <Hotel className={cn('w-4 h-4', widgetMode === 'single' ? 'text-indigo-600' : 'text-muted-foreground')} />
                                </div>
                                <div>
                                    <p className={cn('font-bold text-sm', widgetMode === 'single' ? 'text-indigo-700 dark:text-indigo-400' : 'text-foreground')}>
                                        Single Hotel Widget
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                        Current hotel ki rooms directly dikhao. Best for individual property website.
                                    </p>
                                    {widgetMode === 'single' && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 mt-2">
                                            <CheckCircle2 className="w-3 h-3" /> Selected
                                        </span>
                                    )}
                                </div>
                            </button>

                            <button
                                onClick={() => setWidgetMode('chain')}
                                className={cn(
                                    'flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                                    widgetMode === 'chain'
                                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30'
                                        : 'border-border hover:border-indigo-200'
                                )}
                            >
                                <div className={cn(
                                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                                    widgetMode === 'chain' ? 'bg-indigo-100 dark:bg-indigo-900/60' : 'bg-muted'
                                )}>
                                    <Building2 className={cn('w-4 h-4', widgetMode === 'chain' ? 'text-indigo-600' : 'text-muted-foreground')} />
                                </div>
                                <div>
                                    <p className={cn('font-bold text-sm', widgetMode === 'chain' ? 'text-indigo-700 dark:text-indigo-400' : 'text-foreground')}>
                                        Chain Widget
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                        Guest koi bhi property select kare — ek widget se sab hotels. Best for brand website.
                                    </p>
                                    {widgetMode === 'chain' && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 mt-2">
                                            <CheckCircle2 className="w-3 h-3" /> Selected
                                        </span>
                                    )}
                                </div>
                            </button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Chain Widget Tab Content ─────────────────────────────── */}
            {widgetMode === 'chain' && isChainUser ? (
                <ChainWidgetTab
                    chainSlug={chainSlug!}
                    chainName={chainName || 'Your Brand'}
                    isChainOwner
                    primaryColor={settings?.widget_primary_color}
                />
            ) : (
        <Card>
            <CardHeader>
                <CardTitle>Widget Appearance</CardTitle>
                <CardDescription>Customize your booking widget settings and colors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <Label>Enable Widget</Label>
                        <p className="text-sm text-muted-foreground">Allow bookings through embedded widget</p>
                    </div>
                    <Switch
                        checked={settings.widget_enabled}
                        onCheckedChange={(checked) => onUpdateSettings({ widget_enabled: checked })}
                    />
                </div>

                <div className="space-y-6">
                    {/* Editing colours/theme/layout is premium. Show a clear,
                        intentional notice instead of a blurred overlay — and keep
                        the live preview below ALWAYS visible so every hotelier can
                        see what their widget looks like (and what they'd unlock). */}
                    {!hotel?.feature_color_palette && (
                        <PremiumLockNotice
                            title="Custom colours, themes & layouts"
                            description="Make the booking widget match your brand. The live preview below always shows your widget — upgrade to edit colours, calendar theme and layout."
                        />
                    )}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Primary Color</Label>
                                <Input
                                    type="color"
                                    value={settings.widget_primary_color}
                                    onChange={(e) => onUpdateSettings({ widget_primary_color: e.target.value })}
                                    className="h-10 p-1"
                                    disabled={!hotel?.feature_color_palette}
                                />
                            </div>
                            <div>
                                <Label>Background Color</Label>
                                <Input
                                    type="color"
                                    value={settings.widget_background_color || '#ffffff'}
                                    onChange={(e) => onUpdateSettings({ widget_background_color: e.target.value })}
                                    className="h-10 p-1"
                                    disabled={!hotel?.feature_color_palette}
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Calendar Theme</Label>
                            <select
                                className="w-full mt-1 border border-input bg-background px-3 py-2 text-sm rounded-md"
                                value={settings.widget_theme || 'light'}
                                onChange={(e) => onUpdateSettings({ widget_theme: e.target.value })}
                                disabled={!hotel?.feature_color_palette}
                            >
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                                <option value="theme">Matching Background</option>
                            </select>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm font-semibold">Select Design</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {layouts.map((layout) => (
                                    <div
                                        key={layout.id}
                                        className={`relative border-2 rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-all ${settings.widget_layout === layout.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                                        onClick={() => hotel?.feature_color_palette && onUpdateSettings({ widget_layout: layout.id })}
                                    >
                                        {settings.widget_layout === layout.id && <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                                        <div className="h-8 bg-muted rounded mb-2" />
                                        <div className="text-center">
                                            <span className="font-semibold text-xs block">{layout.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{layout.desc}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-6 border-t">
                            <Label className="text-sm font-semibold mb-4 block">Live Preview</Label>
                            <div className="p-4 bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden min-h-[200px]">
                                <iframe
                                    src={`${window.location.origin}/book/${activeHotelSlug || 'demo'}/widget?preview_layout=${settings.widget_layout || ''}&preview_primary_color=${encodeURIComponent(settings.widget_primary_color || '')}&preview_bg_color=${encodeURIComponent(settings.widget_background_color || '')}&preview_theme=${settings.widget_theme || 'light'}`}
                                    className="w-full max-w-4xl border-0"
                                    style={{ height: `${previewHeight}px` }}
                                    title="Widget Preview"
                                />
                            </div>
                        </div>

                        {/* Embed code lives right here — same tab where the hotelier
                            customised and previewed, so there's no hunting across
                            tabs for "where's my code?". Premium-gated on
                            feature_custom_widget: not entitled → clear upgrade
                            notice (never a blurred overlay). */}
                        <div className="pt-6 border-t space-y-4">
                            <div>
                                <Label className="text-sm font-semibold flex items-center gap-2">
                                    <Code className="w-4 h-4" /> Embed Code
                                </Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Paste this into your website&apos;s HTML to show the search bar above.
                                </p>
                            </div>

                            {!hotel?.feature_custom_widget ? (
                                <PremiumLockNotice
                                    title="One-click embed code is a Pro feature"
                                    description="Upgrade to drop the search widget straight into your own website with a copy-paste HTML & JavaScript snippet. Your customisation above is saved either way."
                                    bullets={[
                                        'Copy-paste HTML & JavaScript snippet',
                                        'Search bar embedded on your own site',
                                        'Calendar opens in place — no redirect',
                                    ]}
                                />
                            ) : widgetCode ? (
                                <div className="space-y-4">
                                    <div>
                                        <Label className="mb-2 block text-xs">HTML</Label>
                                        <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs font-mono">
                                            {widgetCode.html_code}
                                        </pre>
                                        <Button size="sm" variant="outline" className="mt-2" onClick={() => copyToClipboard(widgetCode.html_code)}>Copy HTML</Button>
                                    </div>
                                    <div>
                                        <Label className="mb-2 block text-xs">JavaScript</Label>
                                        <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs font-mono">
                                            {widgetCode.javascript_code}
                                        </pre>
                                        <Button size="sm" variant="outline" className="mt-2" onClick={() => copyToClipboard(widgetCode.javascript_code)}>Copy JS</Button>
                                    </div>
                                    {widgetCode.instructions && (
                                        <Alert>
                                            <AlertDescription>
                                                <pre className="whitespace-pre-wrap text-xs font-sans">{widgetCode.instructions}</pre>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">Loading embed code…</p>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            {isDirty && <span className="text-xs text-amber-500 flex items-center mr-2 font-medium">⚠️ Unsaved changes</span>}
                            <Button onClick={onSaveSettings} disabled={isSavingSettings || !isDirty} className="gap-2">
                                {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Widget Settings
                            </Button>
                        </div>
                </div>
            </CardContent>
        </Card>
            )}
        </div>
    );
};
