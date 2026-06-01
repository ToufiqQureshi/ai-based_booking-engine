import { useState } from 'react';
import { Save, Loader2, Mail, Send, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';


/**
 * Email settings — HOTELIER-FACING.
 *
 * Multi-tenant security: this tab is intentionally limited to display
 * and template concerns. All provider credentials (SMTP password,
 * Brevo API key, SMTP host/port/username) are configured by the
 * super-admin in their dashboard and are NOT shown here. Sending
 * credentials would be a credential leak — any hotelier who leaves
 * the platform would have to rotate every shared SMTP/Brevo key.
 *
 * Hoteliers control: sender display name, reply-to, CC list, custom
 * booking email template, signature.
 */
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
            await apiClient.post(`/hotels/${hotel.id}/test-email-connection`, {
                settings: formData.settings,
                test_email: testEmail
            });
            toast({
                title: "Test Successful!",
                description: "A test email has been sent successfully. Please check your inbox.",
            });
        } catch (error: any) {
            toast({
                title: "Test Failed",
                description: error.message || "Failed to send test email. Please contact your platform admin to verify provider credentials.",
                variant: "destructive"
            });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <TabsContent value="email" className="space-y-6 mt-0">
            {/* SENDER PROFILE & TEMPLATE */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-primary" />
                        Sender Profile & Email Template
                    </CardTitle>
                    <CardDescription>
                        Configure how your booking emails look to guests. Provider credentials are
                        managed by your platform admin.
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
                                If using the platform email service, replies from guests will be sent to this address.
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
                                Available tags: [GUEST_NAME], [BOOKING_REFERENCE], [CHECK_IN], [CHECK_OUT], [TOTAL_AMOUNT]
                            </p>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="emailSignature">Email Signature</Label>
                            <Textarea
                                id="emailSignature"
                                rows={3}
                                placeholder="Best regards, The Team at [HOTEL_NAME]"
                                value={formData.settings.email_signature || ''}
                                onChange={(e) => handleUpdate('settings', 'email_signature', e.target.value)}
                            />
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

            {/* TEST CONNECTION */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5 text-primary" />
                        Test Your Configuration
                    </CardTitle>
                    <CardDescription>
                        Send a test email to verify everything is wired up correctly. The actual SMTP
                        or Brevo provider is configured by your platform admin.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 items-end">
                        <div className="space-y-2 flex-1 max-w-sm">
                            <Label htmlFor="testEmail">Send Test Email To</Label>
                            <Input
                                id="testEmail"
                                type="email"
                                placeholder="your-email@example.com"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleTestConnection} disabled={isTesting} variant="outline" className="gap-2">
                            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Send Test Email
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* PROVIDER STATUS — read-only */}
            <Card className="border-emerald-100 bg-emerald-50/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-emerald-950">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                        Email Provider Status
                    </CardTitle>
                    <CardDescription>
                        For security reasons, email provider credentials (SMTP, Brevo) are managed
                        centrally by your platform admin. Contact them if you need changes.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <ProviderStatus
                            label="Brevo"
                            isOn={!!formData.settings?.has_brevo_key}
                        />
                        <ProviderStatus
                            label="SMTP"
                            isOn={!!formData.settings?.has_smtp_config}
                        />
                        <ProviderStatus
                            label="Custom SMTP Password"
                            isOn={!!formData.settings?.has_smtp_password}
                        />
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}

function ProviderStatus({ label, isOn }: { label: string; isOn: boolean }) {
    return (
        <div className={`p-3 rounded-xl border ${isOn ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</p>
            <p className={`text-sm mt-1 font-medium ${isOn ? 'text-emerald-700' : 'text-slate-500'}`}>
                {isOn ? '✓ Configured' : '— Not set'}
            </p>
        </div>
    );
}
