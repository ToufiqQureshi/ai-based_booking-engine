import { useState, useEffect } from 'react';
import { Save, Loader2, Globe, Palette, Upload, Image, Mail, MessageSquare, Shield, Lock, ShoppingBag, Eye, Clock, TrendingUp, Star, Plus, Trash2, Sparkles, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';

// ─── Social Proof settings (lives here in Branding, no new tab) ───
interface SocialProofBadge {
    label: string;
    icon: string;
}

interface SocialProofSettings {
    is_enabled: boolean;
    show_viewers_count: boolean;
    show_last_booked: boolean;
    show_popular_badge: boolean;
    show_review_summary: boolean;
    popular_badge_text: string;
    custom_badges: SocialProofBadge[];
}

const DEFAULT_BADGE_ICONS = ['🏆', '⭐', '🌿', '🏖️', '🍽️', '💼', '🎉', '🌟', '♻️', '🐾', '👨‍👩‍👧', '🍳', '🛎️', '🏊', '💆'];

function SocialProofEditor({ hotelId }: { hotelId: string }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState<SocialProofSettings>({
        is_enabled: false,
        show_viewers_count: true,
        show_last_booked: true,
        show_popular_badge: true,
        show_review_summary: true,
        popular_badge_text: 'Popular choice! {count} bookings this month',
        custom_badges: [],
    });
    const [newBadge, setNewBadge] = useState<{ label: string; icon: string }>({ label: '', icon: '🏆' });

    useEffect(() => {
        apiClient.get<SocialProofSettings>('/hotels/me/social-proof')
            .then(setSettings)
            .catch((err) => console.error('Failed to load social proof settings', err))
            .finally(() => setIsLoading(false));
    }, []);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const updated = await apiClient.put<SocialProofSettings>('/hotels/me/social-proof', settings);
            setSettings(updated);
            toast({ title: 'Social proof settings saved' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to save' });
        } finally {
            setIsSaving(false);
        }
    };

    const addBadge = () => {
        const trimmed = newBadge.label.trim();
        if (!trimmed) {
            toast({ variant: 'destructive', title: 'Badge text is required' });
            return;
        }
        if (settings.custom_badges.length >= 6) {
            toast({ variant: 'destructive', title: 'Maximum 6 custom badges allowed' });
            return;
        }
        setSettings(s => ({ ...s, custom_badges: [...s.custom_badges, { ...newBadge, label: trimmed }] }));
        setNewBadge({ label: '', icon: '🏆' });
    };

    const removeBadge = (idx: number) => {
        setSettings(s => ({ ...s, custom_badges: s.custom_badges.filter((_, i) => i !== idx) }));
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <Card className="mt-6 border-violet-100 shadow-sm">
            <CardHeader className="bg-violet-50/50 rounded-t-xl pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-violet-950">
                            <Sparkles className="w-5 h-5 text-violet-600" />
                            Social Proof Badges
                        </CardTitle>
                        <CardDescription className="text-violet-900/70 mt-1">
                            Show trust signals on your public booking page. Only verified data is shown.
                        </CardDescription>
                    </div>
                    <Switch
                        checked={settings.is_enabled}
                        onCheckedChange={(v) => setSettings(s => ({ ...s, is_enabled: v }))}
                    />
                </div>
            </CardHeader>
            <CardContent className={`space-y-6 pt-6 ${!settings.is_enabled ? 'opacity-60 pointer-events-none' : ''}`}>
                {/* Built-in badges */}
                <div>
                    <Label className="text-sm font-bold">Built-in Badges</Label>
                    <p className="text-xs text-muted-foreground mb-3">Real data only. Badges appear automatically when data is available.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <ToggleRow
                            icon={<Eye className="w-4 h-4 text-blue-500" />}
                            label="Live viewer count"
                            description='"12 people are viewing right now" — only when sessions are detected'
                            checked={settings.show_viewers_count}
                            onChange={(v) => setSettings(s => ({ ...s, show_viewers_count: v }))}
                        />
                        <ToggleRow
                            icon={<Clock className="w-4 h-4 text-orange-500" />}
                            label="Last booking time"
                            description='"Last booked 3 hours ago"'
                            checked={settings.show_last_booked}
                            onChange={(v) => setSettings(s => ({ ...s, show_last_booked: v }))}
                        />
                        <ToggleRow
                            icon={<TrendingUp className="w-4 h-4 text-purple-500" />}
                            label="Popular choice"
                            description='Highlight monthly booking count'
                            checked={settings.show_popular_badge}
                            onChange={(v) => setSettings(s => ({ ...s, show_popular_badge: v }))}
                        />
                        <ToggleRow
                            icon={<Star className="w-4 h-4 text-amber-500" />}
                            label="Review summary"
                            description='"4.8★ from 240 reviews" — only when reviews exist'
                            checked={settings.show_review_summary}
                            onChange={(v) => setSettings(s => ({ ...s, show_review_summary: v }))}
                        />
                    </div>
                </div>

                {/* Popular badge template */}
                {settings.show_popular_badge && (
                    <div className="space-y-2">
                        <Label className="text-sm font-bold">Popular badge text</Label>
                        <Input
                            value={settings.popular_badge_text}
                            onChange={(e) => setSettings(s => ({ ...s, popular_badge_text: e.target.value }))}
                            placeholder="Popular choice! {count} bookings this month"
                        />
                        <p className="text-xs text-muted-foreground">
                            Use <code className="bg-muted px-1 rounded">{'{count}'}</code> as placeholder for the booking count.
                        </p>
                    </div>
                )}

                {/* Custom badges */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label className="text-sm font-bold">Custom Badges</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">Add your own marketing claims. Max 6.</p>
                        </div>
                        <Badge variant="secondary" className="rounded-full">{settings.custom_badges.length}/6</Badge>
                    </div>
                    {settings.custom_badges.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {settings.custom_badges.map((b, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-sm">
                                    <span>{b.icon}</span>
                                    <span className="font-medium">{b.label}</span>
                                    <button type="button" onClick={() => removeBadge(i)} className="text-violet-700 hover:text-rose-600">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2 items-end">
                        <div className="space-y-1.5 flex-1">
                            <Label className="text-xs text-muted-foreground">Icon</Label>
                            <Select value={newBadge.icon} onValueChange={(v) => setNewBadge(p => ({ ...p, icon: v }))}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DEFAULT_BADGE_ICONS.map(ic => (
                                        <SelectItem key={ic} value={ic}>{ic}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5 flex-[2]">
                            <Label className="text-xs text-muted-foreground">Text</Label>
                            <Input
                                value={newBadge.label}
                                onChange={(e) => setNewBadge(p => ({ ...p, label: e.target.value }))}
                                placeholder="e.g. Family owned since 2015"
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBadge(); } }}
                            />
                        </div>
                        <Button type="button" onClick={addBadge} variant="outline" className="gap-1.5">
                            <Plus className="w-4 h-4" /> Add
                        </Button>
                    </div>
                </div>

                {/* Compliance note */}
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>
                        <strong>Compliance:</strong> All numbers are real and verified. We never show
                        invented data. "X people viewing" appears only when at least one session is
                        detected in the last 5 minutes.
                    </p>
                </div>

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Social Proof
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function ToggleRow({ icon, label, description, checked, onChange }: {
    icon: React.ReactNode;
    label: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-start justify-between p-3 rounded-xl border bg-muted/20">
            <div className="flex items-start gap-3">
                <div className="mt-0.5">{icon}</div>
                <div>
                    <p className="text-sm font-medium leading-tight">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );
}


export function BrandingTab({ formData, handleUpdate, handleSave, isSaving, setIsSaving, hotel, rooms = [] }: any) {
  const { toast } = useToast();
  return (
    <>
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

            <SocialProofEditor hotelId={hotel?.id} />
          </TabsContent>

          {/* Email Settings */}

    </>
  );
}
