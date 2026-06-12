import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PremiumLockNotice } from '@/components/integration/PremiumLockNotice';

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

                {/* Embed code is a premium feature. Show a clear, intentional
                    upgrade panel when it's not enabled — never a blurred overlay
                    over the real code (which read as a broken/glitchy page). The
                    Direct Booking Link above always works on every plan. */}
                {!hotel?.feature_custom_widget ? (
                    <PremiumLockNotice
                        title="One-click embed code is a Pro feature"
                        description="Your Direct Booking Link above works on every plan. Upgrade to drop the full booking widget straight into your website with copy-paste HTML & JavaScript."
                        bullets={[
                            'Copy-paste HTML & JavaScript snippet',
                            'Search bar embedded on your own site',
                            'Brand colours, themes & layouts',
                        ]}
                    />
                ) : widgetCode ? (
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
                ) : null}
            </CardContent>
        </Card>
    );
};
