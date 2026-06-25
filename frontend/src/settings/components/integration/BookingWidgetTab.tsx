import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
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

                {hotel?.feature_custom_widget && settings && onUpdateSettings && (
                    <>
                        <div className="border-t my-6" />
                        
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-900">Booking Engine Features</h3>
                            
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-sm font-semibold">Promo Code</Label>
                                    <p className="text-xs text-slate-500">Allow guests to enter promo codes</p>
                                </div>
                                <Switch
                                    checked={settings.widget_show_promo !== false}
                                    onCheckedChange={(checked) => onUpdateSettings({ widget_show_promo: checked })}
                                />
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-sm font-semibold">Packages Tab</Label>
                                    <p className="text-xs text-slate-500">Show Rooms / Packages selection</p>
                                </div>
                                <Switch
                                    checked={settings.widget_show_packages !== false}
                                    onCheckedChange={(checked) => onUpdateSettings({ widget_show_packages: checked })}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-sm font-semibold">Flexible Dates</Label>
                                    <p className="text-xs text-slate-500">Show flexible dates checkbox</p>
                                </div>
                                <Switch
                                    checked={settings.widget_show_flexible_dates !== false}
                                    onCheckedChange={(checked) => onUpdateSettings({ widget_show_flexible_dates: checked })}
                                />
                            </div>

                            <div className="pt-4 space-y-2">
                                <div>
                                    <Label className="text-sm font-semibold">Advanced: Custom CSS</Label>
                                    <p className="text-xs text-slate-500 mb-2">Inject your own CSS directly into the booking engine page</p>
                                </div>
                                <Textarea 
                                    className="font-mono text-xs h-32" 
                                    placeholder="/* Add your custom CSS here */&#10;.custom-button { background: #000; }"
                                    value={(settings as any).widget_custom_css || ''}
                                    onChange={(e) => onUpdateSettings({ widget_custom_css: e.target.value } as any)}
                                />
                            </div>
                        </div>
                    </>
                )}

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

