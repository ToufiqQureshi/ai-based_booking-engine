import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, AlertCircle, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WidgetCode {
    html_code: string;
    javascript_code: string;
    instructions: string;
}

interface BookingWidgetTabProps {
    widgetCode: WidgetCode | null;
    hotel: any;
    activeHotelSlug: string;
    copyToClipboard: (text: string) => void;
}

export const BookingWidgetTab = ({ widgetCode, hotel, activeHotelSlug, copyToClipboard }: BookingWidgetTabProps) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Embed Booking Widget</CardTitle>
                <CardDescription>Add this code to your website to enable direct bookings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Direct Booking Link</Label>
                    <div className="flex gap-2">
                        <Input
                            value={`${window.location.origin.replace('//app.', '//').replace('//superadmin.', '//')}/book/${activeHotelSlug || 'my-grand-hotel'}/rooms`}
                            readOnly
                        />
                        <Button
                            variant="outline"
                            onClick={() => copyToClipboard(`${window.location.origin.replace('//app.', '//').replace('//superadmin.', '//')}/book/${activeHotelSlug || 'my-grand-hotel'}/rooms`)}
                        >
                            Copy
                        </Button>
                    </div>
                </div>

                <div className="border-t my-4" />

                {widgetCode && (
                    <div className="relative">
                        {!hotel?.feature_custom_widget && (
                            <div className="absolute inset-0 z-10 backdrop-blur-sm bg-white/40 dark:bg-slate-950/40 rounded-xl flex flex-col items-center justify-center border border-dashed border-indigo-200 p-6 text-center">
                                <Lock className="w-6 h-6 text-indigo-600 mb-2" />
                                <span className="text-sm font-black">Custom Widget Integration Locked</span>
                                <span className="text-xs text-slate-500 mt-1">Upgrade your plan to unlock integration codes.</span>
                            </div>
                        )}
                        <div className="space-y-4">
                            <div>
                                <Label className="mb-2 block">HTML Code</Label>
                                <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs font-mono">
                                    {widgetCode.html_code}
                                </pre>
                                <Button size="sm" variant="outline" className="mt-2" onClick={() => copyToClipboard(widgetCode.html_code)}>Copy HTML</Button>
                            </div>

                            <div>
                                <Label className="mb-2 block">JavaScript Code</Label>
                                <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs font-mono">
                                    {widgetCode.javascript_code}
                                </pre>
                                <Button size="sm" variant="outline" className="mt-2" onClick={() => copyToClipboard(widgetCode.javascript_code)}>Copy JS</Button>
                            </div>

                            <Alert>
                                <AlertDescription>
                                    <pre className="whitespace-pre-wrap text-xs font-sans">{widgetCode.instructions}</pre>
                                </AlertDescription>
                            </Alert>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
