import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Copy, Building2, ExternalLink, Globe, Lock, Code2, Info, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { apiClient } from '@/core/api/client';

interface ChainWidgetTabProps {
    chainSlug: string;
    chainName: string;
    isChainOwner: boolean;
    primaryColor?: string;
}

interface ChainWidgetSettings {
    primary_color: string;
    widget_layout: string;
    widget_bg_color: string;
    widget_theme: string;
    widget_show_price: boolean;
    widget_show_loyalty: boolean;
    widget_show_property_count: boolean;
}

// Same style system as the single-hotel booking widget so the brand widget
// matches the property widgets pixel-for-pixel.
const CHAIN_WIDGET_STYLES = [
    { id: 'modern', name: 'Modern', desc: 'Standard sleek search bar' },
    { id: 'minimal', name: 'Minimal', desc: 'Clean, transparent background' },
    { id: 'classic', name: 'Classic', desc: 'Larger, boxed layout' },
    { id: 'floating', name: 'Floating', desc: 'Sticks to the bottom of the screen' },
    { id: 'far', name: 'Compact', desc: 'Ultra-slim rate badge' },
    { id: 'ota', name: 'OTA Style', desc: 'Like MakeMyTrip & Agoda' },
    { id: 'glassmorphism', name: 'Glassmorphism', desc: 'Sleek frosted glass effect' },
];

const DEFAULT_CHAIN_SETTINGS: ChainWidgetSettings = {
    primary_color: '#4f46e5',
    widget_layout: 'modern',
    widget_bg_color: '#FFFFFF',
    widget_theme: 'light',
    widget_show_price: true,
    widget_show_loyalty: true,
    widget_show_property_count: true,
};

export const ChainWidgetTab = ({
    chainSlug,
    chainName,
    isChainOwner,
    primaryColor = '#4f46e5',
}: ChainWidgetTabProps) => {
    const [previewHeight, setPreviewHeight] = useState(180);
    const [activeCodeTab, setActiveCodeTab] = useState<'iframe' | 'script'>('iframe');

    // ── Chain widget appearance + features ──────────────────────────────────
    const [cfg, setCfg] = useState<ChainWidgetSettings>({ ...DEFAULT_CHAIN_SETTINGS, primary_color: primaryColor });
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isChainOwner) return;
        apiClient.get<ChainWidgetSettings>('/chain/widget-settings')
            .then(data => setCfg({ ...DEFAULT_CHAIN_SETTINGS, ...data }))
            .catch(() => {});
    }, [isChainOwner]);

    const updateCfg = (patch: Partial<ChainWidgetSettings>) => {
        setCfg(prev => ({ ...prev, ...patch }));
        setIsDirty(true);
    };

    const saveCfg = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const data = await apiClient.put<ChainWidgetSettings>('/chain/widget-settings', cfg);
            setCfg({ ...DEFAULT_CHAIN_SETTINGS, ...data });
            setIsDirty(false);
            toast.success('Chain widget settings saved');
        } catch {
            toast.error('Failed to save chain widget settings');
        } finally {
            setIsSaving(false);
        }
    };

    // Use the live (edited) colour for embed snippets + preview so the hotelier
    // sees their changes before they even save.
    const effectiveColor = cfg.primary_color || primaryColor;

    const origin = window.location.origin
        .replace('//app.', '//')
        .replace('//superadmin.', '//');

    const widgetUrl = `${origin}/book/chain/${chainSlug}/widget`;

    // ── Embed code options ────────────────────────────────────────────────
    const iframeCode = `<!-- StayBooker Chain Widget -->
<div id="sb-chain-widget-container" style="width:100%;overflow:hidden;">
  <iframe
    id="sb-chain-widget"
    src="${widgetUrl}"
    style="width:100%;border:none;display:block;"
    height="130"
    scrolling="no"
    title="${chainName} Booking Widget"
  ></iframe>
</div>
<script>
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'RESIZE_SEARCH_WIDGET') {
      document.getElementById('sb-chain-widget').height = e.data.height;
    }
  });
</script>`;

    const scriptCode = `<!-- StayBooker Chain Widget (Script Loader) -->
<div id="sb-chain-widget-root"></div>
<script>
  (function() {
    var s = document.createElement('script');
    s.src = '${origin}/widget-loader.js';
    s.setAttribute('data-chain', '${chainSlug}');
    s.setAttribute('data-type', 'chain');
    s.setAttribute('data-color', '${effectiveColor}');
    s.async = true;
    document.head.appendChild(s);
  })();
</script>`;

    const copyCode = (code: string, label: string) => {
        navigator.clipboard.writeText(code);
        toast.success(`${label} copied to clipboard!`);
    };

    // Listen for iframe resize
    useEffect(() => {
        const handleResize = (e: MessageEvent) => {
            if (e.data?.type === 'RESIZE_SEARCH_WIDGET' && e.data.height) {
                setPreviewHeight(Math.max(130, e.data.height));
            }
        };
        window.addEventListener('message', handleResize);
        return () => window.removeEventListener('message', handleResize);
    }, []);

    return (
        <div className="space-y-5">

            {/* Header info card */}
            <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-transparent dark:border-indigo-900/30 dark:from-indigo-950/20">
                <CardContent className="p-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center shrink-0 mt-0.5">
                        <Building2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-sm text-foreground">Chain Widget</p>
                            <Badge variant="outline" className="text-[10px] font-semibold text-indigo-600 border-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0">
                                Multi-Property
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Ek widget embed karo apni brand website pe — guest kisi bhi property ka naam ya city type karke search kar sakta hai. Search pe directly us hotel ke booking page pe redirect hoga.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {!isChainOwner ? (
                /* Locked state for non-chain users */
                <Card>
                    <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-1">
                            <Lock className="w-7 h-7 text-slate-400" />
                        </div>
                        <p className="font-bold text-foreground">Chain Account Required</p>
                        <p className="text-sm text-muted-foreground max-w-xs">
                            Chain widget sirf multi-property brands ke liye available hai. Contact support to set up your brand group.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Direct link */}
                    <Card>
                        <CardHeader className="border-b px-6 py-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Globe className="w-4 h-4 text-indigo-500" />
                                Direct Booking Link
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Yeh link share karo — koi bhi directly chain booking page pe ja sakta hai
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-5">
                            <div className="flex gap-2">
                                <Input value={widgetUrl} readOnly className="font-mono text-xs" />
                                <Button
                                    variant="outline"
                                    className="shrink-0 gap-1.5"
                                    onClick={() => copyCode(widgetUrl, 'Link')}
                                >
                                    <Copy className="w-3.5 h-3.5" /> Copy
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    onClick={() => window.open(widgetUrl, '_blank')}
                                    title="Open in new tab"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Widget Appearance & Brand Features */}
                    <Card>
                        <CardHeader className="border-b px-6 py-4">
                            <CardTitle className="text-sm font-bold">Widget Appearance & Brand Features</CardTitle>
                            <CardDescription className="text-xs">
                                Apne brand widget ka look aur features customize karo — bilkul property widget jaisa
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-5 space-y-6">
                            {/* Colours */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm">Primary Color</Label>
                                    <Input
                                        type="color"
                                        value={cfg.primary_color}
                                        onChange={(e) => updateCfg({ primary_color: e.target.value })}
                                        className="h-10 p-1 mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-sm">Background Color</Label>
                                    <Input
                                        type="color"
                                        value={cfg.widget_bg_color}
                                        onChange={(e) => updateCfg({ widget_bg_color: e.target.value })}
                                        className="h-10 p-1 mt-1"
                                    />
                                </div>
                            </div>

                            {/* Calendar theme */}
                            <div>
                                <Label className="text-sm">Calendar Theme</Label>
                                <select
                                    className="w-full mt-1 border border-input bg-background px-3 py-2 text-sm rounded-md"
                                    value={cfg.widget_theme}
                                    onChange={(e) => updateCfg({ widget_theme: e.target.value })}
                                >
                                    <option value="light">Light</option>
                                    <option value="dark">Dark</option>
                                    <option value="theme">Matching Background</option>
                                </select>
                            </div>

                            {/* Style & Layout */}
                            <div className="space-y-3">
                                <Label className="text-sm font-semibold block">Widget Style & Layout</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {CHAIN_WIDGET_STYLES.map(style => (
                                        <label
                                            key={style.id}
                                            className={cn(
                                                "flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all",
                                                cfg.widget_layout === style.id
                                                    ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30"
                                                    : "border-border bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="chain_widget_layout"
                                                value={style.id}
                                                checked={cfg.widget_layout === style.id}
                                                onChange={(e) => updateCfg({ widget_layout: e.target.value })}
                                                className="sr-only"
                                            />
                                            <span className="font-semibold text-sm">{style.name}</span>
                                            <span className="text-xs text-muted-foreground mt-1">{style.desc}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Brand features — tuned for large multi-property groups */}
                            <div className="space-y-3 pt-2 border-t">
                                <Label className="text-sm font-semibold block">Brand Features</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="flex items-center justify-between p-4 border rounded-xl bg-white dark:bg-slate-950">
                                        <div className="pr-3">
                                            <Label className="text-sm font-semibold">Show Starting Price</Label>
                                            <p className="text-xs text-slate-500">Display the selected property&apos;s &ldquo;from&rdquo; rate in the picker</p>
                                        </div>
                                        <Switch
                                            checked={cfg.widget_show_price}
                                            onCheckedChange={(v) => updateCfg({ widget_show_price: v })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-4 border rounded-xl bg-white dark:bg-slate-950">
                                        <div className="pr-3">
                                            <Label className="text-sm font-semibold">Loyalty Badge</Label>
                                            <p className="text-xs text-slate-500">&ldquo;Members save more&rdquo; brand badge to push direct sign-ups</p>
                                        </div>
                                        <Switch
                                            checked={cfg.widget_show_loyalty}
                                            onCheckedChange={(v) => updateCfg({ widget_show_loyalty: v })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-4 border rounded-xl bg-white dark:bg-slate-950">
                                        <div className="pr-3">
                                            <Label className="text-sm font-semibold">Property Count Badge</Label>
                                            <p className="text-xs text-slate-500">&ldquo;X properties across Y cities&rdquo; social proof for big chains</p>
                                        </div>
                                        <Switch
                                            checked={cfg.widget_show_property_count}
                                            onCheckedChange={(v) => updateCfg({ widget_show_property_count: v })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t">
                                {isDirty && <span className="text-xs text-amber-500 flex items-center mr-2 font-medium">⚠️ Unsaved changes</span>}
                                <Button onClick={saveCfg} disabled={isSaving || !isDirty} className="gap-2">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save Chain Widget
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Embed code */}
                    <Card>
                        <CardHeader className="border-b px-6 py-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Code2 className="w-4 h-4 text-indigo-500" />
                                Embed Code
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Apni hotel brand website pe paste karo — widget automatically resize ho jaata hai
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">

                            {/* Code type tabs */}
                            <div className="flex bg-muted rounded-lg p-1 gap-1 w-fit">
                                {(['iframe', 'script'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveCodeTab(tab)}
                                        className={cn(
                                            'px-4 py-1.5 text-xs font-semibold rounded-md transition-all capitalize',
                                            activeCodeTab === tab
                                                ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {tab === 'iframe' ? 'iFrame (Recommended)' : 'Script Loader'}
                                    </button>
                                ))}
                            </div>

                            <div className="relative">
                                <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-64">
                                    {activeCodeTab === 'iframe' ? iframeCode : scriptCode}
                                </pre>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="absolute top-3 right-3 gap-1.5 bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
                                    onClick={() => copyCode(
                                        activeCodeTab === 'iframe' ? iframeCode : scriptCode,
                                        activeCodeTab === 'iframe' ? 'iFrame code' : 'Script code'
                                    )}
                                >
                                    <Copy className="w-3 h-3" /> Copy
                                </Button>
                            </div>

                            {activeCodeTab === 'iframe' && (
                                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-xs text-amber-800 dark:text-amber-400">
                                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>
                                        <strong>Recommended:</strong> iFrame method sabse simple hai. JavaScript snippet auto-resize handle karta hai jab calendar/guest picker open hota hai.
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Live Preview */}
                    <Card>
                        <CardHeader className="border-b px-6 py-4">
                            <CardTitle className="text-sm font-bold">Live Preview</CardTitle>
                            <CardDescription className="text-xs">
                                Exactly aisa dikhega website pe embedded hone ke baad
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-5">
                            <div className="p-4 bg-slate-900 rounded-xl flex items-start justify-center overflow-hidden">
                                <iframe
                                    src={`${widgetUrl}?preview_primary_color=${encodeURIComponent(effectiveColor)}&preview_layout=${cfg.widget_layout}&preview_bg_color=${encodeURIComponent(cfg.widget_bg_color)}&preview_theme=${cfg.widget_theme}&preview_show_price=${cfg.widget_show_price}&preview_show_loyalty=${cfg.widget_show_loyalty}&preview_show_count=${cfg.widget_show_property_count}`}
                                    className="w-full max-w-4xl border-0"
                                    style={{ height: `${previewHeight}px` }}
                                    title="Chain Widget Preview"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
};
