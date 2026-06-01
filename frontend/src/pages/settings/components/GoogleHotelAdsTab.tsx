import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { TabsContent } from '@/components/ui/tabs';
import { Copy, Save, Loader2, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Hotel } from '@/types/api';
import { apiClient } from '@/api/client';
import { useEffect, useState } from 'react';

interface GoogleHotelAdsTabProps {
  hotel: Hotel;
}

export function GoogleHotelAdsTab({ hotel }: GoogleHotelAdsTabProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    // Fetch integration settings to get google_hotel_ads status
    apiClient.get('/integration/settings')
      .then(res => setSettings(res))
      .catch(console.error);
  }, []);

  const handleUpdate = (field: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await apiClient.put('/integration/settings', {
        google_hotel_ads_enabled: settings?.google_hotel_ads_enabled,
        google_hotel_center_id: settings?.google_hotel_center_id
      });
      toast({ title: 'Settings saved', description: 'Google Hotel Ads settings updated.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  if (!settings) return null;

  const baseUrl = window.location.origin.replace('app.', 'api.'); // Rough approximation, should use config in real app
  const hotelListUrl = `${baseUrl}/api/v1/google-hotel-ads/hotels.xml`;
  const pricingUrl = `${baseUrl}/api/v1/google-hotel-ads/pricing`;
  const deepLinkUrl = `${window.location.origin}/book/${hotel.slug}?checkin=(CHECKIN_DATE)&checkout=(CHECKOUT_DATE)&guests=(GUESTS)`;

  return (
    <TabsContent value="google-hotel-ads" className="space-y-6 mt-0">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            Google Hotel Ads Integration
          </CardTitle>
          <CardDescription>
            Connect your property to Google Hotel Ads to show real-time prices on Google Search and Maps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <Label className="text-base">Enable Google Hotel Ads</Label>
              <p className="text-sm text-muted-foreground">Turn on XML feeds for Google Hotel Center</p>
            </div>
            <Switch 
              checked={settings.google_hotel_ads_enabled || false}
              onCheckedChange={(c) => handleUpdate('google_hotel_ads_enabled', c)}
            />
          </div>

          {settings.google_hotel_ads_enabled && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Google Hotel Center Account ID</Label>
                <Input 
                  placeholder="e.g. 123456789" 
                  value={settings.google_hotel_center_id || ''}
                  onChange={(e) => handleUpdate('google_hotel_center_id', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">The ID of your Google Hotel Center account.</p>
              </div>

              <div className="space-y-4 mt-6 bg-muted/30 p-4 rounded-lg border">
                <h4 className="font-medium">Integration URLs</h4>
                <p className="text-sm text-muted-foreground">Provide these URLs to Google Hotel Center for data synchronization.</p>
                
                <div className="space-y-2">
                  <Label>Hotel List Feed URL (XML)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={hotelListUrl} className="bg-muted" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(hotelListUrl)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Pricing & Availability Endpoint (Pull)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={pricingUrl} className="bg-muted" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(pricingUrl)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Deep Link Template (Landing Page)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={deepLinkUrl} className="bg-muted" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(deepLinkUrl)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
