import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Sparkles, Activity, Mail, Plus, Loader2 } from 'lucide-react';
import { Hotel } from '@/core/types/api';
import { useAuth } from '@/core/contexts/AuthContext';
import { apiClient } from '@/core/api/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface WhatsappTabProps {
    hotel?: Hotel | null;
}

export const WhatsappTab = ({ hotel: propHotel }: WhatsappTabProps) => {
    const { user, hotel: authHotel, setHotel } = useAuth();
    const hotel = propHotel || authHotel;
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    const [isAddCreditsOpen, setIsAddCreditsOpen] = useState(false);
    const [creditsToAdd, setCreditsToAdd] = useState('500');
    const [isUpdatingCredits, setIsUpdatingCredits] = useState(false);

    const handleAddCredits = async () => {
        const toAdd = parseInt(creditsToAdd, 10);
        if (isNaN(toAdd) || toAdd <= 0) {
            toast.error('Please enter a valid credit amount');
            return;
        }
        if (!hotel?.id) return;

        try {
            setIsUpdatingCredits(true);
            const currentCredits = (hotel?.settings as any)?.ai_whatsapp_credits ?? 0;
            const newTotalCredits = currentCredits + toAdd;

            await apiClient.put(`/superadmin/hotels/${hotel.id}/integrations`, {
                ai_whatsapp_credits: newTotalCredits
            });

            // Reload hotel profile to update context
            const updatedHotel = await apiClient.get<Hotel>('/hotels/me');
            setHotel(updatedHotel);

            toast.success(`Successfully added ${toAdd} credits!`);
            setIsAddCreditsOpen(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || error?.message || 'Failed to add credits');
        } finally {
            setIsUpdatingCredits(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Stats Card — read-only for hotelier */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-primary" />
                        WhatsApp Usage & Credits
                    </CardTitle>
                    <CardDescription>
                        View your WhatsApp messaging stats and credits. Contact Staybooker to configure WhatsApp or add more credits for your property.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Messages Sent */}
                        <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Activity className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">Messages Sent</p>
                                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                                    {(hotel?.settings as any)?.total_messages_sent || 0}
                                </p>
                            </div>
                        </div>

                        {/* Available Credits */}
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-emerald-900 dark:text-indigo-300">Available Credits</p>
                                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                                        {(hotel?.settings as any)?.ai_whatsapp_credits ?? 0}
                                    </p>
                                </div>
                            </div>
                            {isSuperAdmin ? (
                                <Dialog open={isAddCreditsOpen} onOpenChange={setIsAddCreditsOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                                            <Plus className="w-4 h-4" />
                                            Add Credits
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="rounded-3xl max-w-sm">
                                        <DialogHeader>
                                            <DialogTitle>Add WhatsApp Credits</DialogTitle>
                                            <DialogDescription>
                                                Directly add message credits to {hotel?.name || 'this property'}.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="credits" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Credits to Add</Label>
                                                <Input
                                                    id="credits"
                                                    type="number"
                                                    value={creditsToAdd}
                                                    onChange={(e) => setCreditsToAdd(e.target.value)}
                                                    placeholder="e.g. 500"
                                                    className="rounded-xl h-11"
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter className="flex gap-2">
                                            <Button variant="ghost" onClick={() => setIsAddCreditsOpen(false)} className="rounded-xl">Cancel</Button>
                                            <Button onClick={handleAddCredits} disabled={isUpdatingCredits} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                                                {isUpdatingCredits && <Loader2 className="w-4 h-4 animate-spin" />}
                                                Add Credits
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            ) : (
                                <Button
                                    variant="default"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                                    onClick={() => window.open('mailto:support@staybooker.ai?subject=Request%20More%20WhatsApp%20Credits', '_blank')}
                                >
                                    <Mail className="w-4 h-4" />
                                    Request Credits
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Active features — read-only badges */}
                    <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active AI Features</p>
                        <div className="flex flex-wrap gap-2">
                            {(hotel as any)?.feature_ai_agent && (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 border-green-200">
                                    ✓ WhatsApp AI Agent
                                </Badge>
                            )}
                            {(hotel as any)?.feature_guest_bot && (
                                <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200">
                                    ✓ Guest Chat AI
                                </Badge>
                            )}
                            {(hotel as any)?.feature_ai_assistant && (
                                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200">
                                    ✓ Hotelier AI Assistant
                                </Badge>
                            )}
                            {!(hotel as any)?.feature_ai_agent && !(hotel as any)?.feature_guest_bot && !(hotel as any)?.feature_ai_assistant && (
                                <p className="text-xs text-muted-foreground">No AI features enabled. Contact Staybooker to activate.</p>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">AI features are managed by Staybooker. Contact support@staybooker.ai to enable or change features.</p>
                    </div>
                </CardContent>
            </Card>

            {/* Webhook Info — visible only for super-admin / developers */}
            {isSuperAdmin && (
                <Card className="border-indigo-100 dark:border-indigo-950/40 bg-gradient-to-tr from-indigo-50/10 to-transparent">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            WhatsApp AI Booking Agent Setup
                        </CardTitle>
                        <CardDescription>
                            Configure WhatsApp webhooks so the AI agent can answer availability questions and share booking links with your guests.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        <p>
                            Log in to your <strong>Meta for Developers Console</strong>, go to your WhatsApp app setup, and configure Webhooks with the following fields:
                        </p>
                        <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg border space-y-2 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                            <div>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">Callback URL:</span>{' '}
                                {`${window.location.origin}/api/v1/integration/whatsapp/webhook`}
                            </div>
                            <div>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">Verify Token:</span>{' '}
                                whatsapp_agent_verify_token
                            </div>
                            <div>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">Subscription Field:</span>{' '}
                                messages
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Your Staybooker support team handles AI configuration. Contact support@staybooker.ai for assistance.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
