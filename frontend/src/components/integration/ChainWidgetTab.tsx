import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, Building2, ExternalLink, Globe, Lock, Code2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ChainWidgetTabProps {
    chainSlug: string;
    chainName: string;
    isChainOwner: boolean;
    primaryColor?: string;
}

export const ChainWidgetTab = ({
    chainSlug,
    chainName,
    isChainOwner,
    primaryColor = '#4f46e5',
}: ChainWidgetTabProps) => {
    const [previewHeight, setPreviewHeight] = useState(180);
    const [activeCodeTab, setActiveCodeTab] = useState<'iframe' | 'script'>('iframe');

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
    s.setAttribute('data-color', '${primaryColor}');
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
                                    src={`${widgetUrl}?preview_primary_color=${encodeURIComponent(primaryColor)}`}
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
