import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, Copy } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChatWidget } from '@/guest_booking/components/public/ChatWidget';

interface ChatWidgetTabProps {
    hotel: any;
    activeHotelSlug: string;
    copyToClipboard: (text: string) => void;
}

export const ChatWidgetTab = ({ hotel, activeHotelSlug, copyToClipboard }: ChatWidgetTabProps) => {
    const slug = activeHotelSlug || hotel?.slug || 'your-hotel-slug';

    const htmlSnippet = `<div id="hotelier-chat-widget" data-hotel-slug="${slug}"></div>`;
    const jsSnippet = `<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${window.location.origin}/chat-loader.js';
    script.async = true;
    script.onload = function() {
      HotelierChat.init({
        hotelSlug: '${slug}',
        frontendUrl: '${window.location.origin}'
      });
    };
    document.head.appendChild(script);
  })();
</script>`;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Embed Chat Widget</CardTitle>
                    <CardDescription>Add a floating AI guest assistant bot to your website</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative">
                        {!hotel?.feature_guest_bot && (
                            <div className="absolute inset-0 z-10 backdrop-blur-sm bg-white/40 dark:bg-slate-950/40 rounded-xl flex flex-col items-center justify-center border border-dashed border-indigo-200 p-6 text-center">
                                <Lock className="w-6 h-6 text-indigo-600 mb-2" />
                                <span className="text-sm font-black">Guest Bot Locked</span>
                                <span className="text-xs text-slate-500 mt-1">Upgrade your plan to unlock the chat widget.</span>
                            </div>
                        )}
                        <div className="space-y-4">
                            <div>
                                <Label className="mb-2 block">HTML Code</Label>
                                <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs font-mono">{htmlSnippet}</pre>
                                <Button size="sm" variant="outline" className="mt-2" onClick={() => copyToClipboard(htmlSnippet)}>Copy HTML</Button>
                            </div>

                            <div>
                                <Label className="mb-2 block">JavaScript Code</Label>
                                <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs font-mono">{jsSnippet}</pre>
                                <Button size="sm" variant="outline" className="mt-2" onClick={() => copyToClipboard(jsSnippet)}>Copy JS</Button>
                            </div>

                            <Alert>
                                <AlertDescription className="text-xs">
                                    Add the JavaScript script tag before the closing &lt;/body&gt; tag on your website. Ensure AI configuration is set up in External Services.
                                </AlertDescription>
                            </Alert>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {hotel?.feature_guest_bot && (
                <div className="mt-8 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 h-[500px] relative shadow-sm">
                    <div className="absolute inset-0 flex items-center justify-center p-8 text-center flex-col z-10 pointer-events-none">
                        <h1 className="text-3xl font-bold text-slate-800 mb-2">Live Preview</h1>
                        <p className="text-slate-500 max-w-xs">This is a preview of the AI Concierge widget.</p>
                    </div>
                    <ChatWidget hotelSlug={slug} isStaticPreview={true} />
                </div>
            )}
        </div>
    );
};
