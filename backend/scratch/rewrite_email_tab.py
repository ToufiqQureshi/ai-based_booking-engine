content = """import { useState } from 'react';
import { Save, Loader2, Globe, Palette, Upload, Image, Mail, MessageSquare, Shield, Lock, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';


export function EmailTab({ formData, handleUpdate, handleSave, isSaving, hotel }: any) {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const handleTestConnection = async () => {
    if (!testEmail) {
      toast({
        title: "Email Required",
        description: "Please enter an email address to send the test email to.",
        variant: "destructive"
      });
      return;
    }
    
    setIsTesting(true);
    try {
      // Create a payload of the current settings in the form
      const payload = { ...formData.settings };
      await apiClient.testEmailConnection(hotel.id, payload, testEmail);
      toast({
        title: "Test Successful!",
        description: "A test email has been sent successfully. Please check your inbox.",
      });
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test email. Please check your credentials.",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <>
          <TabsContent value="email" className="space-y-6 mt-0">
            {/* SENDER PROFILE & TEMPLATE */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Booking Notifications & Sender Profile
                </CardTitle>
                <CardDescription>
                  Configure your sender details, notification recipients, and email template.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="emailSenderName">Sender Name</Label>
                    <Input
                      id="emailSenderName"
                      placeholder="e.g. Grand Plaza Reservations"
                      value={formData.settings.email_sender_name || ''}
                      onChange={(e) => handleUpdate('settings', 'email_sender_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailReplyTo">Reply-To Email Address</Label>
                    <Input
                      id="emailReplyTo"
                      type="email"
                      placeholder="reservations@yourhotel.com"
                      value={formData.settings.email_reply_to || ''}
                      onChange={(e) => handleUpdate('settings', 'email_reply_to', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      If using the Free Tier (platform email), replies from guests will be sent to this address.
                    </p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="emailCcList">Hotel Notification CC List</Label>
                    <Input
                      id="emailCcList"
                      placeholder="manager@hotel.com, frontdesk@hotel.com"
                      value={formData.settings.email_cc_list || ''}
                      onChange={(e) => handleUpdate('settings', 'email_cc_list', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated list of emails that should receive new booking alerts.
                    </p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="emailTemplate">Custom Booking Template (HTML)</Label>
                    <Textarea
                      id="emailTemplate"
                      rows={6}
                      placeholder="<p>Dear [GUEST_NAME], Thanks for booking with [HOTEL_NAME]. Reference: [BOOKING_REFERENCE]</p>"
                      value={formData.settings.email_template || ''}
                      onChange={(e) => handleUpdate('settings', 'email_template', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Available Tags: [GUEST_NAME], [BOOKING_REFERENCE], [CHECK_IN], [CHECK_OUT], [TOTAL_AMOUNT]
                    </p>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Email Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* CUSTOM BREVO INTEGRATION */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-amber-500" />
                  Custom Brevo Integration <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full ml-2">Pro Feature</span>
                </CardTitle>
                <CardDescription>
                  Use your own Brevo (Sendinblue) account to send emails. You must have a verified sender domain in your Brevo account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="brevoApiKey">Brevo API Key</Label>
                    <Input
                      id="brevoApiKey"
                      type="password"
                      placeholder="xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={formData.settings.brevo_api_key || ''}
                      onChange={(e) => handleUpdate('settings', 'brevo_api_key', e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Brevo Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* CUSTOM SMTP INTEGRATION */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-indigo-500" />
                  Custom SMTP Server <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full ml-2">Pro Feature</span>
                </CardTitle>
                <CardDescription>
                  Configure your own SMTP server details (e.g. Gmail, Outlook, Hostinger) to send emails directly from your server.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="smtpHost">SMTP Host</Label>
                    <Input
                      id="smtpHost"
                      placeholder="smtp.gmail.com"
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
                      placeholder="reservations@yourdomain.com"
                      value={formData.settings.smtp_username || ''}
                      onChange={(e) => handleUpdate('settings', 'smtp_username', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPassword">SMTP Password / App Password</Label>
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
                
                <div className="mt-8 border-t pt-6">
                  <h4 className="text-sm font-medium mb-4">Test Your Configuration</h4>
                  <div className="flex gap-4 items-end">
                    <div className="space-y-2 flex-1 max-w-sm">
                      <Label htmlFor="testEmail">Send Test Email To:</Label>
                      <Input 
                        id="testEmail" 
                        placeholder="your-email@example.com" 
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleTestConnection} disabled={isTesting} variant="outline" className="gap-2">
                      {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Test Connection
                    </Button>
                    <div className="flex-1 text-right">
                      <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save SMTP Settings
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
    </>
  );
}
"""

with open('frontend/src/components/settings/EmailTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
