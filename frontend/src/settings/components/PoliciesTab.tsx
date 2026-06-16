import { Save, Loader2, Globe, Palette, Upload, Image, Mail, MessageSquare, Shield, Lock } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/core/hooks/use-toast';
import { apiClient } from '@/core/api/client';


export function PoliciesTab({ formData, handleUpdate, handleSave, isSaving, hotel }: any) {
  const { toast } = useToast();
  return (
    <>
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
                    <Label htmlFor="payment_mode">Online Payment Mode</Label>
                    <Select
                      value={formData.settings.payment_mode || 'both'}
                      onValueChange={(val) => handleUpdate('settings', 'payment_mode', val)}
                    >
                      <SelectTrigger id="payment_mode" className="w-full">
                        <SelectValue placeholder="Select payment mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online_only">Pay Now Only (Razorpay online payment required)</SelectItem>
                        <SelectItem value="property_only">Pay at Property Only (No online payment)</SelectItem>
                        <SelectItem value="both">Both Options (Guest can choose)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Control how guests can pay on the public booking page. "Both" lets guests choose between paying online now or at the property.
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

    </>
  );
}
