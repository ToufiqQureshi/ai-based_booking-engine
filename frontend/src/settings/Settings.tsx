// Settings Page - Real API Integration
import { useState } from 'react';
import { Building2, Users, Bell, Key, Palette, Globe, Save, Loader2, Tag, Upload, Image, ShoppingBag, Lock, Mail, MessageSquare, Sparkles, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { Hotel } from '@/types/api';

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PromoManager } from './components/PromoManager';
import { PropertyGallery } from './components/PropertyGallery';

import { GeneralTab } from './components/GeneralTab';
import { BrandingTab } from './components/BrandingTab';
import { EmailTab } from './components/EmailTab';
import { PoliciesTab } from './components/PoliciesTab';
import { TeamList } from './components/TeamList';
import { PageShell } from '@/components/layout/PageShell';
import { AIAgentTab } from './components/AIAgentTab';
import { GoogleHotelAdsTab } from './components/GoogleHotelAdsTab';

export function SettingsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const activeTab = tab || 'hotel';

  const { hotel, user, setHotel } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    if (activeTab === 'branding' && hotel?.slug && rooms.length === 0) {
      setLoadingRooms(true);
      apiClient.get<any[]>(`/public/hotels/${hotel.slug}/rooms`)
        .then(res => setRooms(res || []))
        .catch(() => {})
        .finally(() => setLoadingRooms(false));
    }
  }, [activeTab, hotel?.slug, rooms.length]);

  const [formData, setFormData] = useState({
    name: hotel?.name || '',
    slug: hotel?.slug || '',
    star_rating: hotel?.star_rating || 3,
    description: hotel?.description || '',
    address: {
      street: hotel?.address?.street || '',
      city: hotel?.address?.city || '',
      state: hotel?.address?.state || '',
      country: hotel?.address?.country || '',
      postal_code: hotel?.address?.postal_code || ''
    },
    contact: {
      phone: hotel?.contact?.phone || '',
      email: hotel?.contact?.email || '',
      website: hotel?.contact?.website || ''
    },
    settings: {
      check_in_time: hotel?.settings?.check_in_time || '14:00',
      check_out_time: hotel?.settings?.check_out_time || '11:00',
      currency: hotel?.settings?.currency || 'INR',
      timezone: hotel?.settings?.timezone || 'Asia/Kolkata',
      primary_color: hotel?.primary_color || '#7C3AED',
      logo_url: hotel?.logo_url || '',
      notify_new_booking: hotel?.settings?.notify_new_booking !== false,
      notify_cancellation: hotel?.settings?.notify_cancellation !== false,
      cancellation_policy: hotel?.settings?.cancellation_policy || '',
      cancellation_mode: hotel?.settings?.cancellation_mode || 'instant',
      payment_mode: hotel?.settings?.payment_mode || 'both',
      payment_policy: hotel?.settings?.payment_policy || '',
      child_policy: hotel?.settings?.child_policy || '',
      privacy_policy: hotel?.settings?.privacy_policy || '',
      terms_conditions: hotel?.settings?.terms_conditions || '',
      important_info: hotel?.settings?.important_info || '',
      gst_number: hotel?.settings?.gst_number || '',
      multi_room_cart: hotel?.settings?.multi_room_cart !== false,
      featured_room_type_id: hotel?.settings?.featured_room_type_id || '',
      smtp_host: hotel?.settings?.smtp_host || '',
      smtp_port: hotel?.settings?.smtp_port || '',
      smtp_username: hotel?.settings?.smtp_username || '',
      smtp_password: hotel?.settings?.smtp_password || '',
      smtp_from_email: hotel?.settings?.smtp_from_email || '',
      email_sender_name: hotel?.settings?.email_sender_name || '',
      email_sender_address: hotel?.settings?.email_sender_address || '',
      email_cc_list: hotel?.settings?.email_cc_list || '',
      email_signature: hotel?.settings?.email_signature || '',
      whatsapp_api_key: hotel?.settings?.whatsapp_api_key || '',
      whatsapp_phone_number_id: hotel?.settings?.whatsapp_phone_number_id || '',
      whatsapp_business_account_id: hotel?.settings?.whatsapp_business_account_id || '',
      whatsapp_template_booking_confirmed: hotel?.settings?.whatsapp_template_booking_confirmed || '',
      whatsapp_template_booking_cancelled: hotel?.settings?.whatsapp_template_booking_cancelled || '',
    },
    photos: hotel?.photos || []
  });

  const handleUpdate = (section: string, field: string, value: any) => {
    setFormData(prev => {
      if (section === 'root') {
        return { ...prev, [field]: value };
      }
      if (section === 'address') {
        return { ...prev, address: { ...prev.address, [field]: value } };
      }
      if (section === 'contact') {
        return { ...prev, contact: { ...prev.contact, [field]: value } };
      }
      if (section === 'settings') {
        return { ...prev, settings: { ...prev.settings, [field]: value } };
      }
      return prev;
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updatedHotel = await apiClient.patch<Hotel>('/hotels/me', {
        name: formData.name,
        slug: formData.slug || undefined,
        star_rating: Number(formData.star_rating),
        description: formData.description,
        address: formData.address,
        contact: formData.contact,
        settings: formData.settings,
        photos: formData.photos,
        // Map back from settings state to top level fields
        logo_url: formData.settings.logo_url,
        primary_color: formData.settings.primary_color
      });
      setHotel(updatedHotel);
      toast({
        title: 'Settings saved',
        description: 'Your hotel profile has been updated successfully.',
      });
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to save settings. URL slug might already be taken.';
      toast({
        variant: 'destructive',
        title: 'Error saving settings',
        description: errorMsg,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!hotel) return null;

  return (
    <PageShell
      title="Settings"
      subtitle="Manage your hotel profile and preferences"
    >

      <Tabs value={activeTab} onValueChange={(val) => navigate('/settings/' + val)} orientation="vertical" className="flex flex-col md:flex-row gap-6">
        <TabsList className="flex flex-row md:flex-col h-auto md:w-64 justify-start items-stretch gap-1 bg-muted/30 p-2 rounded-xl border">
          <TabsTrigger 
            value="hotel" 
            className="flex justify-start gap-3 px-4 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
          >
            <Building2 className="h-4 w-4" />
            <span className="font-medium">Hotel Profile</span>
          </TabsTrigger>
          <TabsTrigger 
            value="team" 
            className="flex justify-start gap-3 px-4 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
          >
            <Users className="h-4 w-4" />
            <span className="font-medium">Team Members</span>
          </TabsTrigger>
          <TabsTrigger 
            value="notifications" 
            className="flex justify-start gap-3 px-4 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
          >
            <Bell className="h-4 w-4" />
            <span className="font-medium">Notifications</span>
          </TabsTrigger>
          <TabsTrigger 
            value="promos" 
            className="flex justify-start gap-3 px-4 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
          >
            <Tag className="h-4 w-4" />
            <span className="font-medium">Promotions</span>
          </TabsTrigger>
          <TabsTrigger 
            value="branding" 
            className="flex justify-start gap-3 px-4 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
          >
            <Palette className="h-4 w-4" />
            <span className="font-medium">Branding</span>
          </TabsTrigger>
          <TabsTrigger 
            value="email" 
            className="flex justify-start gap-3 px-4 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
          >
            <Mail className="h-4 w-4" />
            <span className="font-medium">Email & WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger 
            value="policies" 
            className="flex justify-start gap-3 px-4 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
          >
            <Key className="h-4 w-4" />
            <span className="font-medium">Policies & Privacy</span>
          </TabsTrigger>
          <TabsTrigger 
            value="gallery" 
            className="flex justify-start gap-3 px-4 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
          >
            <Image className="h-4 w-4" />
            <span className="font-medium">Property Gallery</span>
          </TabsTrigger>
          <TabsTrigger 
            value="google-hotel-ads" 
            className="flex justify-start gap-3 px-4 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
          >
            <Globe className="h-4 w-4" />
            <span className="font-medium">Google Hotel Ads</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1">
          {/* Hotel Settings */}
          {activeTab === 'hotel' && (
            <GeneralTab formData={formData} handleUpdate={handleUpdate} handleSave={handleSave} isSaving={isSaving} hotel={hotel} />
          )}

          {/* Team Settings */}
          {activeTab === 'team' && (
            <TabsContent value="team" className="space-y-6 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    Manage who has access to this dashboard
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <TeamList />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <TabsContent value="notifications" className="space-y-6 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Email Notifications</CardTitle>
                  <CardDescription>
                    Choose what emails you want to receive
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { id: 'notify_new_booking', label: 'New Booking', description: 'Get notified when a new booking is made' },
                    { id: 'notify_cancellation', label: 'Cancellations', description: 'Get notified when a booking is cancelled' },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <Switch
                        checked={formData.settings[item.id] !== false}
                        onCheckedChange={(checked) => handleUpdate('settings', item.id, checked)}
                      />
                    </div>
                  ))}
                  <div className="flex justify-end mt-4">
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Preferences
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Promotions Settings */}
          {activeTab === 'promos' && (
            <TabsContent value="promos" className="space-y-6 mt-0">
              <PromoManager />
            </TabsContent>
          )}

          {/* Branding Settings */}
          {activeTab === 'branding' && (
            loadingRooms ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <BrandingTab formData={formData} handleUpdate={handleUpdate} handleSave={handleSave} isSaving={isSaving} setIsSaving={setIsSaving} hotel={hotel} rooms={rooms} />
            )
          )}

          {/* Email Settings */}
          {activeTab === 'email' && (
            <EmailTab formData={formData} handleUpdate={handleUpdate} handleSave={handleSave} isSaving={isSaving} hotel={hotel} />
          )}

          {/* Policies & Privacy */}
          {activeTab === 'policies' && (
            <PoliciesTab formData={formData} handleUpdate={handleUpdate} handleSave={handleSave} isSaving={isSaving} hotel={hotel} />
          )}

          {/* Gallery */}
          {activeTab === 'gallery' && (
            <TabsContent value="gallery" className="space-y-6 mt-0">
              <PropertyGallery 
                photos={formData.photos} 
                onChange={(photos) => setFormData(prev => ({ ...prev, photos }))}
                onSave={async (photos) => {
                  try {
                    const updatedHotel = await apiClient.patch<Hotel>('/hotels/me', {
                      photos: photos
                    });
                    setHotel(updatedHotel);
                    toast({
                      title: 'Gallery saved',
                      description: 'Property photos have been updated.',
                    });
                  } catch (error) {
                    toast({
                      variant: 'destructive',
                      title: 'Error',
                      description: 'Failed to save gallery.',
                    });
                    throw error;
                  }
                }}
              />
            </TabsContent>
          )}

          {/* Google Hotel Ads Settings */}
          {activeTab === 'google-hotel-ads' && (
            <GoogleHotelAdsTab hotel={hotel} />
          )}
        </div>
      </Tabs>
    </PageShell>
  );
}

export default SettingsPage;
