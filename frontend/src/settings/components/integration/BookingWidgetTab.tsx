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
                        {/* WIDGET STYLES */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Paintbrush className="w-4 h-4 text-primary" />
                                <h3 className="font-semibold text-lg">1. Choose Widget Style</h3>
                            </div>
                            
                            <RadioGroup 
                                value={layout} 
                                onValueChange={(val) => onUpdateSettings?.({ widget_layout: val })}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                            >
                                {WIDGET_STYLES.map(style => (
                                    <div key={style.id} className="relative">
                                        <RadioGroupItem value={style.id} id={`style-${style.id}`} className="peer sr-only" />
                                        <Label
                                            htmlFor={`style-${style.id}`}
                                            className="flex flex-col p-4 border-2 rounded-xl cursor-pointer bg-white hover:bg-slate-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all"
                                        >
                                            <span className="font-semibold">{style.name}</span>
                                            <span className="text-xs text-slate-500 mt-1">{style.desc}</span>
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>

                        {/* CUSTOM CODE BUILDER */}
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="custom-code" className="border rounded-xl px-4">
                                <AccordionTrigger className="hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Code2 className="w-4 h-4 text-primary" />
                                        <span className="font-semibold">Advanced: Custom CSS</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2 pb-4">
                                    <Alert className="bg-amber-50 text-amber-900 border-amber-200">
                                        <AlertDescription>
                                            <strong>Widget Rules & Limitations:</strong>
                                            <ul className="list-disc pl-5 mt-2 space-y-1 text-xs">
                                                <li>You may inject custom CSS to alter fonts, colors, and border-radii.</li>
                                                <li>Custom JavaScript execution is strictly prohibited for PCI-DSS payment compliance.</li>
                                                <li>Do NOT attempt to override iframe positioning with <code>!important</code>.</li>
                                                <li>Host page z-index issues should be fixed on your website's header, not by forcing the widget behind elements.</li>
                                            </ul>
                                        </AlertDescription>
                                    </Alert>
                                    <div className="space-y-2">
                                        <Label>Custom CSS</Label>
                                        <Textarea 
                                            placeholder="/* e.g. .calendar-container { border-radius: 0px !important; } */"
                                            className="font-mono text-xs h-32"
                                            value={settings?.widget_custom_css || ''}
                                            onChange={(e) => onUpdateSettings?.({ widget_custom_css: e.target.value })}
                                        />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        {/* EMBED SNIPPET */}
                        {widgetCode && (
                            <div className="space-y-4 pt-4 border-t">
                                <h3 className="font-semibold text-lg">2. Copy Embed Code</h3>
                                <div>
                                    <Label className="mb-2 block text-slate-500">HTML Container</Label>
                                    <pre className="p-4 bg-slate-900 text-slate-50 rounded-lg overflow-x-auto text-xs font-mono border">
                                        {htmlCode}
                                    </pre>
                                    <Button size="sm" variant="secondary" className="mt-2" onClick={() => copyToClipboard(htmlCode || '')}>Copy HTML</Button>
                                </div>

                                <div>
                                    <Label className="mb-2 block text-slate-500">JavaScript Loader (High Performance)</Label>
                                    <pre className="p-4 bg-slate-900 text-slate-50 rounded-lg overflow-x-auto text-xs font-mono border">
                                        {widgetCode.javascript_code}
                                    </pre>
                                    <Button size="sm" variant="secondary" className="mt-2" onClick={() => copyToClipboard(widgetCode.javascript_code)}>Copy JS</Button>
                                </div>
                            </div>
                        )}
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
