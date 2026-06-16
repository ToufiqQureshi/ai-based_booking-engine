import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PremiumLockNotice } from '@/settings/components/integration/PremiumLockNotice';
import { Loader2, Code2, Paintbrush, Save } from 'lucide-react';

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
    settings?: any;
    isDirty?: boolean;
    isSavingSettings?: boolean;
    onUpdateSettings?: (updates: any) => void;
    onSaveSettings?: () => void;
}

const WIDGET_STYLES = [
    { id: 'modern', name: 'Modern', desc: 'Standard sleek search bar' },
    { id: 'minimal', name: 'Minimal', desc: 'Clean, transparent background' },
    { id: 'classic', name: 'Classic', desc: 'Larger, boxed layout' },
    { id: 'floating', name: 'Floating', desc: 'Sticks to the bottom of the screen' },
    { id: 'far', name: 'Compact', desc: 'Ultra-slim rate badge' },
    { id: 'ota', name: 'OTA Style', desc: 'Like MakeMyTrip & Agoda' },
];

export const BookingWidgetTab = ({ 
    widgetCode, 
    hotel, 
    activeHotelSlug, 
    copyToClipboard,
    settings,
    isDirty,
    isSavingSettings,
    onUpdateSettings,
    onSaveSettings
}: BookingWidgetTabProps) => {

    const layout = settings?.widget_layout || 'modern';
    
    // Dynamically update the snippet based on local unsaved selection
    const htmlCode = widgetCode?.html_code?.replace(/data-widget-layout="[^"]*"/, `data-widget-layout="${layout}"`);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Embed Booking Widget</CardTitle>
                <CardDescription>Add this code to your website to enable direct bookings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

                {!hotel?.feature_custom_widget ? (
                    <PremiumLockNotice
                        title="One-click embed code is a Pro feature"
                        description="Your Direct Booking Link above works on every plan. Upgrade to drop the full booking widget straight into your website with copy-paste HTML & JavaScript."
                        bullets={[
                            'Copy-paste HTML & JavaScript snippet',
                            'Search bar embedded on your own site',
                            '5 professional widget styles',
                            'Custom CSS injection'
                        ]}
                    />
                ) : (
                    <div className="space-y-8">
                        <Alert className="bg-blue-50 text-blue-900 border-blue-200">
                            <AlertDescription>
                                This tab provides a direct URL to your booking engine. If you want to embed the Search Widget directly into your website (like MakeMyTrip), please go to the <strong>Search Widget</strong> tab.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}
            </CardContent>
            
            {hotel?.feature_custom_widget && (
                <CardFooter className="bg-slate-50 border-t p-6 flex justify-between items-center rounded-b-xl">
                    <p className="text-sm text-slate-500">Don't forget to save your style and CSS changes.</p>
                    <Button onClick={onSaveSettings} disabled={!isDirty || isSavingSettings}>
                        {isSavingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Settings
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
};
