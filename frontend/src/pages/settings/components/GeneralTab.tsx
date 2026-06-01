import { Save, Loader2, Globe, Palette, Upload, Image, Mail, MessageSquare, Shield, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';


export function GeneralTab({ formData, handleUpdate, handleSave, isSaving, hotel }: any) {
  const { toast } = useToast();
  return (
    <>
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
                      {window.location.host.replace('app.', '').replace('superadmin.', '')}/book/
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
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      value={formData.address.street || ''}
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
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.address.state || ''}
                      onChange={(e) => handleUpdate('address', 'state', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.address.country}
                      onChange={(e) => handleUpdate('address', 'country', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input
                      id="postal_code"
                      value={formData.address.postal_code || ''}
                      onChange={(e) => handleUpdate('address', 'postal_code', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2 md:col-span-2 mt-4">
                    <h4 className="text-sm font-semibold text-slate-800">Contact & Business Details</h4>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.contact.phone || ''}
                      onChange={(e) => handleUpdate('contact', 'phone', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.contact.email || ''}
                      onChange={(e) => handleUpdate('contact', 'email', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={formData.contact.website || ''}
                      onChange={(e) => handleUpdate('contact', 'website', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gst_number">GST / Business Number</Label>
                    <Input
                      id="gst_number"
                      placeholder="e.g. 27AAACH2059P1Z9"
                      value={formData.settings.gst_number || ''}
                      onChange={(e) => handleUpdate('settings', 'gst_number', e.target.value)}
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

    </>
  );
}
