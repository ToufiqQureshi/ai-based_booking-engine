// Settings Page - Real API Integration
import { useState } from 'react';
import { Building2, Users, Bell, Key, Palette, Globe, Save, Loader2, Tag, Upload, Image, ShoppingBag, Lock, Mail, MessageSquare } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { Hotel } from '@/types/api';

import { useEffect } from 'react';
import { PromoManager } from '@/components/settings/PromoManager';
import { PropertyGallery } from '@/components/settings/PropertyGallery';

function TeamList() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await apiClient.get<any[]>('/users');
        setUsers(data);
      } catch (error) {
        console.error('Failed to fetch team:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading team...</div>;

  return (
    <div className="space-y-4">
      {users.map(u => (
        <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {u.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium">{u.name}</p>
              <p className="text-sm text-muted-foreground">{u.email}</p>
            </div>
          </div>
          <div className="text-sm font-medium text-primary">{u.role}</div>
        </div>
      ))}
      <Button variant="outline" className="w-full gap-2" onClick={() => {
        // Simple alert for now as full invite flow needs email server
        alert("Invite Feature: In a production app, this would open a form to send an invite email. For now, you can register new users via the Signup page.");
      }}>
        <Users className="h-4 w-4" />
        Invite Team Member
      </Button>
    </div>
  );
}

export function SettingsPage() {
  const { hotel, user, setHotel } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    if (hotel?.slug) {
      apiClient.get<any[]>(`/public/hotels/${hotel.slug}/rooms`)
        .then(res => setRooms(res || []))
        .catch(() => {});
    }
  }, [hotel?.slug]);

  const [formData, setFormData] = useState({
    name: hotel?.name || '',
    slug: hotel?.slug || '',
    star_rating: hotel?.star_rating || 3,
    description: hotel?.description || '',
    address: {
      street: hotel?.address?.street || '',
      city: hotel?.address?.city || ''
    },
    contact: {
      phone: hotel?.contact?.phone || '',
      email: hotel?.contact?.email || ''
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
      payment_policy: hotel?.settings?.payment_policy || '',
      child_policy: hotel?.settings?.child_policy || '',
      privacy_policy: hotel?.settings?.privacy_policy || '',
      important_info: hotel?.settings?.important_info || '',
      multi_room_cart: hotel?.settings?.multi_room_cart !== false,
      featured_room_type_id: hotel?.settings?.featured_room_type_id || '',
      smtp_host: hotel?.settings?.smtp_host || '',
      smtp_port: hotel?.settings?.smtp_port || '',
      smtp_username: hotel?.settings?.smtp_username || '',
      smtp_password: hotel?.settings?.smtp_password || '',
      smtp_from_email: hotel?.settings?.smtp_from_email || '',
      whatsapp_api_key: hotel?.settings?.whatsapp_api_key || '',
      whatsapp_phone_number_id: hotel?.settings?.whatsapp_phone_number_id || '',
      whatsapp_business_account_id: hotel?.settings?.whatsapp_business_account_id || '',
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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your hotel profile and preferences
        </p>
      </div>

      <Tabs defaultValue="hotel" orientation="vertical" className="flex flex-col md:flex-row gap-6">
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
            <span className="font-medium">Email Settings</span>
          </TabsTrigger>
          <TabsTrigger 
            value="whatsapp" 
            className="flex justify-start gap-3 px-4 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="font-medium">WhatsApp Settings</span>
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
        </TabsList>

        <div className="flex-1">
          {/* Hotel Settings */}
          <TabsContent value="hotel" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Hotel Profile</CardTitle>
                <CardDescription>
                  Basic information about your property
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="hotelName">Hotel Name</Label>
                    <Input
                      id="hotelName"
                      value={formData.name}
                      onChange={(e) => handleUpdate('root', 'name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="starRating">Star Rating</Label>
                    <Select
                      value={String(formData.star_rating)}
                      onValueChange={(val) => handleUpdate('root', 'star_rating', val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Star</SelectItem>
                        <SelectItem value="2">2 Stars</SelectItem>
                        <SelectItem value="3">3 Stars</SelectItem>
                        <SelectItem value="4">4 Stars</SelectItem>
                        <SelectItem value="5">5 Stars</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t mt-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="hotelSlug" className="font-semibold text-foreground dark:text-slate-200">Custom Booking Link (URL Slug)</Label>
                    <span className="text-[10px] text-violet-700 bg-violet-100 dark:bg-violet-950 dark:text-violet-300 px-2.5 py-0.5 rounded-full font-bold tracking-wide uppercase border border-violet-200 dark:border-violet-800">
                      White-label Link
                    </span>
                  </div>
                  <div className="flex rounded-xl shadow-sm border border-input focus-within:ring-2 focus-within:ring-violet-600 focus-within:border-violet-600 overflow-hidden transition-all bg-background">
                    <span className="px-4 bg-muted dark:bg-slate-900 text-muted-foreground flex items-center text-xs font-mono border-r select-none">
                      {window.location.host}/book/
                    </span>
                    <Input
                      id="hotelSlug"
                      className="border-0 shadow-none focus-visible:ring-0 rounded-none font-mono text-sm px-3 flex-1 font-semibold text-violet-600 dark:text-violet-400"
                      placeholder="grand-plaza"
                      value={formData.slug}
                      onChange={(e) => handleUpdate('root', 'slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    />
                    <span className="px-4 bg-muted dark:bg-slate-900 text-muted-foreground flex items-center text-xs font-mono border-l select-none">
                      /rooms
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Customize your direct booking URL matching your hotel's actual branding (e.g. <code className="font-bold text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950 px-1 py-0.5 rounded">grand-plaza</code> or <code className="font-bold text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950 px-1 py-0.5 rounded">lagoona-resort</code>). Only lowercase letters, numbers, and hyphens allowed.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t mt-4">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleUpdate('root', 'description', e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Location & Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      value={formData.address.street}
                      onChange={(e) => handleUpdate('address', 'street', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.address.city}
                      onChange={(e) => handleUpdate('address', 'city', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.contact.phone}
                      onChange={(e) => handleUpdate('contact', 'phone', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.contact.email}
                      onChange={(e) => handleUpdate('contact', 'email', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Operational Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="checkIn">Check-in Time</Label>
                    <Input
                      id="checkIn"
                      type="time"
                      value={formData.settings.check_in_time}
                      onChange={(e) => handleUpdate('settings', 'check_in_time', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="checkOut">Check-out Time</Label>
                    <Input
                      id="checkOut"
                      type="time"
                      value={formData.settings.check_out_time}
                      onChange={(e) => handleUpdate('settings', 'check_out_time', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.settings.currency}
                      onValueChange={(val) => handleUpdate('settings', 'currency', val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={formData.settings.timezone}
                      onValueChange={(val) => handleUpdate('settings', 'timezone', val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                        <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Settings */}
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

          {/* Notifications Settings */}
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

          {/* Promotions Settings */}
          <TabsContent value="promos" className="space-y-6 mt-0">
            <PromoManager />
          </TabsContent>

          {/* Branding Settings */}
          <TabsContent value="branding" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Booking Engine Branding</CardTitle>
                <CardDescription>
                  Customize how your booking engine looks to guests
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="primaryColor"
                        type="color"
                        className="w-12 h-10 p-1 cursor-pointer"
                        value={formData.settings.primary_color || '#7C3AED'}
                        onChange={(e) => handleUpdate('settings', 'primary_color', e.target.value)}
                      />
                      <Input
                        value={formData.settings.primary_color || '#7C3AED'}
                        onChange={(e) => handleUpdate('settings', 'primary_color', e.target.value)}
                        placeholder="#7C3AED"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This color will be used for buttons and highlights on your booking page.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logoUpload">Hotel Logo</Label>
                    <div className="relative">
                      {!hotel.feature_custom_logo && (
                        <div className="absolute inset-0 z-10 backdrop-blur-sm bg-white/40 dark:bg-slate-950/40 rounded-xl flex flex-col items-center justify-center border border-dashed border-indigo-200 p-2 text-center">
                          <Lock className="w-5 h-5 text-indigo-600 mb-1 animate-bounce" />
                          <span className="text-xs font-black text-slate-900 dark:text-white">Custom Logo Locked</span>
                          <span className="text-[9px] text-slate-500 max-w-[200px] mt-0.5 leading-normal">Upgrade your plan to customize the logo displayed to guests.</span>
                        </div>
                      )}
                      <div className="flex gap-4 items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="relative"
                              disabled={isSaving || !hotel.feature_custom_logo}
                            >
                              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                              Upload New Logo
                              {hotel.feature_custom_logo && (
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    try {
                                      setIsSaving(true);
                                      const formData = new FormData();
                                      formData.append('file', file);

                                      const response = await apiClient.post<{ url: string }>('/upload', formData);
                                      handleUpdate('settings', 'logo_url', response.url);

                                      toast({
                                        title: "Logo Uploaded",
                                        description: "Don't forget to click Save Branding to apply changes.",
                                      });
                                    } catch (error) {
                                      toast({
                                        variant: "destructive",
                                        title: "Upload Failed",
                                        description: "Could not upload logo. Try a smaller file.",
                                      });
                                    } finally {
                                      setIsSaving(false);
                                    }
                                  }}
                                />
                              )}
                            </Button>
                            {formData.settings.logo_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive h-8"
                                disabled={!hotel.feature_custom_logo}
                                onClick={() => handleUpdate('settings', 'logo_url', '')}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Recommended size: 200x200px. formats: PNG, JPG.
                          </p>
                        </div>

                        <div className="h-20 w-20 border rounded-lg bg-muted/30 flex items-center justify-center overflow-hidden relative">
                          {formData.settings.logo_url ? (
                            <img
                              src={formData.settings.logo_url}
                              alt="Logo Preview"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground text-center px-1">No Logo</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-4">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Branding
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6 border-indigo-100 shadow-sm">
              <CardHeader className="bg-indigo-50/50 rounded-t-xl pb-4">
                <CardTitle className="flex items-center gap-2 text-indigo-950">
                  <ShoppingBag className="w-5 h-5 text-indigo-600" />
                  STAAH Multi-Room & Starting Price Engine
                </CardTitle>
                <CardDescription className="text-indigo-900/70">
                  Enable OTA-like multi-room cart selection and configure starting rate highlight on the public booking engine.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
                  <div className="space-y-0.5">
                    <Label className="text-base font-bold text-foreground">Multi-Room Cart Bar</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow guests to select and combine multiple room types (e.g. Deluxe + Executive) in a persistent floating cart.
                    </p>
                  </div>
                  <Switch
                    checked={formData.settings.multi_room_cart !== false}
                    onCheckedChange={(checked) => handleUpdate('settings', 'multi_room_cart', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="featuredRoom" className="text-foreground font-bold">Featured Category for Starting Price Display</Label>
                  <Select
                    value={formData.settings.featured_room_type_id || ''}
                    onValueChange={(val) => handleUpdate('settings', 'featured_room_type_id', val)}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Select room category to highlight..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lowest">Dynamic Lowest Price (Automatic)</SelectItem>
                      {rooms.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name} - ({r.base_price ? `₹${r.base_price}/night` : 'Custom Rates'})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    If set, the public booking calendar and top header will highlight starting prices from this specific room category. Otherwise, it defaults to the lowest available rate.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Booking Engine Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Settings */}
          <TabsContent value="email" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  SMTP Email Configuration
                </CardTitle>
                <CardDescription>
                  Configure SMTP server details to send system notification and confirmation emails using your own domain.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="smtpHost">SMTP Host</Label>
                    <Input
                      id="smtpHost"
                      placeholder="smtp.mailgun.org"
                      value={formData.settings.smtp_host || ''}
                      onChange={(e) => handleUpdate('settings', 'smtp_host', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPort">SMTP Port</Label>
                    <Input
                      id="smtpPort"
                      placeholder="587"
                      value={formData.settings.smtp_port || ''}
                      onChange={(e) => handleUpdate('settings', 'smtp_port', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpUsername">SMTP Username</Label>
                    <Input
                      id="smtpUsername"
                      placeholder="postmaster@yourdomain.com"
                      value={formData.settings.smtp_username || ''}
                      onChange={(e) => handleUpdate('settings', 'smtp_username', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPassword">SMTP Password</Label>
                    <Input
                      id="smtpPassword"
                      type="password"
                      placeholder="••••••••••••••••"
                      value={formData.settings.smtp_password || ''}
                      onChange={(e) => handleUpdate('settings', 'smtp_password', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="smtpFromEmail">Sender Email Address (From)</Label>
                    <Input
                      id="smtpFromEmail"
                      type="email"
                      placeholder="reservations@yourhotel.com"
                      value={formData.settings.smtp_from_email || ''}
                      onChange={(e) => handleUpdate('settings', 'smtp_from_email', e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Email Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WhatsApp Settings */}
          <TabsContent value="whatsapp" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  WhatsApp Business API Configuration
                </CardTitle>
                <CardDescription>
                  Provide Meta WhatsApp Cloud API credentials to dispatch instant guest confirmations and reservation followups.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="whatsappApiKey">WhatsApp API Key / Access Token</Label>
                    <Input
                      id="whatsappApiKey"
                      type="password"
                      placeholder="EAAGz..."
                      value={formData.settings.whatsapp_api_key || ''}
                      onChange={(e) => handleUpdate('settings', 'whatsapp_api_key', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="whatsappPhoneNumberId">Phone Number ID</Label>
                      <Input
                        id="whatsappPhoneNumberId"
                        placeholder="1098485747..."
                        value={formData.settings.whatsapp_phone_number_id || ''}
                        onChange={(e) => handleUpdate('settings', 'whatsapp_phone_number_id', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsappBusinessAccountId">WhatsApp Business Account ID</Label>
                      <Input
                        id="whatsappBusinessAccountId"
                        placeholder="948475839..."
                        value={formData.settings.whatsapp_business_account_id || ''}
                        onChange={(e) => handleUpdate('settings', 'whatsapp_business_account_id', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save WhatsApp Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="policies" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Hotel Policies</CardTitle>
                <CardDescription>
                  Define your hotel's rules and terms for guests
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="cancellation_policy">Cancellation Policy</Label>
                    <Textarea
                      id="cancellation_policy"
                      placeholder="e.g. Free cancellation up to 24 hours before arrival..."
                      value={formData.settings.cancellation_policy}
                      onChange={(e) => handleUpdate('settings', 'cancellation_policy', e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cancellation_mode">Cancellation Mode</Label>
                    <Select
                      value={formData.settings.cancellation_mode || 'instant'}
                      onValueChange={(val) => handleUpdate('settings', 'cancellation_mode', val)}
                    >
                      <SelectTrigger id="cancellation_mode" className="w-full">
                        <SelectValue placeholder="Select cancellation mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instant">Instant Self-Cancellation (Guests cancel immediately)</SelectItem>
                        <SelectItem value="request">Approval-Based Request (Requires manager approval)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose whether guest cancellation requests are processed automatically/instantly or require manual approval in the bookings table first.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="payment_policy">Payment Policy</Label>
                    <Textarea
                      id="payment_policy"
                      placeholder="e.g. 50% deposit required at booking..."
                      value={formData.settings.payment_policy}
                      onChange={(e) => handleUpdate('settings', 'payment_policy', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="child_policy">Child & Extra Bed Policy</Label>
                    <Textarea
                      id="child_policy"
                      placeholder="e.g. Children under 5 stay for free..."
                      value={formData.settings.child_policy}
                      onChange={(e) => handleUpdate('settings', 'child_policy', e.target.value)}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="privacy_policy">Privacy Policy</Label>
                    <Textarea
                      id="privacy_policy"
                      placeholder="How you handle guest data..."
                      value={formData.settings.privacy_policy}
                      onChange={(e) => handleUpdate('settings', 'privacy_policy', e.target.value)}
                      className="min-h-[150px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="important_info">Important Information</Label>
                    <Textarea
                      id="important_info"
                      placeholder="e.g. Construction nearby, parking rules..."
                      value={formData.settings.important_info}
                      onChange={(e) => handleUpdate('settings', 'important_info', e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Policies
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Property Gallery */}
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
        </div>
      </Tabs>
    </div>
  );
}

export default SettingsPage;
