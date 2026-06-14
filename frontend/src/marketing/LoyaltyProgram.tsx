import { useState, useEffect } from 'react';
import {
    Gift, Users, TrendingUp, Save, Loader2, Star, Trophy,
    Sparkles, CheckCircle2, Crown, Zap, ToggleLeft, ToggleRight,
    IndianRupee, Percent, BedDouble, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { PageShell } from '@/components/layout/PageShell';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface LoyaltyProgram {
    id: string;
    hotel_id: string;
    is_active: boolean;
    program_name: string;
    description: string | null;
    milestone_bookings: number;
    reward_type: 'percentage' | 'fixed_amount' | 'free_night';
    reward_value: number;
    reward_description: string | null;
    popup_title: string;
    popup_message: string;
}

interface GuestLoyaltySummary {
    guest_email: string;
    total_completed_bookings: number;
    total_rooms_booked: number;
    total_spend: number;
    rewards_earned: number;
    last_booking_at: string | null;
    bookings_to_next_reward: number;
    reward_progress_pct: number;
}

interface StayOffer {
    id: string;
    room_type_id: string | null;
    is_active: boolean;
    title: string;
    min_nights: number;
    reward_type: 'percentage' | 'fixed_amount' | 'free_night';
    reward_value: number;
    nudge_title: string;
    nudge_message: string;
}

interface RoomLite {
    id: string;
    name: string;
}

const BLANK_OFFER = {
    room_type_id: '' as string,        // '' = all rooms
    is_active: true,
    title: 'Stay Longer, Save More',
    min_nights: 5,
    reward_type: 'percentage' as 'percentage' | 'fixed_amount' | 'free_night',
    reward_value: 15,
    nudge_title: 'Stay a little longer!',
    nudge_message: 'Stay {remaining} more night(s) and unlock {reward}!',
};

const REWARD_TYPE_OPTIONS = [
    { value: 'percentage', label: 'Percentage Discount', icon: Percent, desc: 'e.g. 10% off booking' },
    { value: 'fixed_amount', label: 'Fixed Amount Off', icon: IndianRupee, desc: 'e.g. ₹500 off' },
    { value: 'free_night', label: 'Free Night', icon: BedDouble, desc: 'Complimentary night stay' },
];

export default function LoyaltyProgramPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'setup' | 'offers' | 'points' | 'guests'>('setup');
    const [program, setProgram] = useState<LoyaltyProgram | null>(null);
    const [guests, setGuests] = useState<GuestLoyaltySummary[]>([]);
    const [guestsLoading, setGuestsLoading] = useState(false);

    // Stay offers (room-specific, night-threshold)
    const [offers, setOffers] = useState<StayOffer[]>([]);
    const [rooms, setRooms] = useState<RoomLite[]>([]);
    const [offersLoading, setOffersLoading] = useState(false);
    const [offerForm, setOfferForm] = useState({ ...BLANK_OFFER });
    const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
    const [savingOffer, setSavingOffer] = useState(false);

    // Points wallet config
    const [pointsForm, setPointsForm] = useState({
        points_enabled: false,
        points_per_currency: 0.1,
        point_value: 1,
    });
    const [savingPoints, setSavingPoints] = useState(false);

    // form state mirrors program
    const [form, setForm] = useState({
        is_active: false,
        program_name: 'Loyalty Program',
        description: '',
        milestone_bookings: 5,
        reward_type: 'percentage' as 'percentage' | 'fixed_amount' | 'free_night',
        reward_value: 10,
        reward_description: '',
        popup_title: "You're Almost There!",
        popup_message: 'Book {remaining} more room(s) and unlock your reward!',
    });

    useEffect(() => {
        fetchProgram();
    }, []);

    useEffect(() => {
        if (activeTab === 'guests') fetchGuests();
        if (activeTab === 'offers') { fetchOffers(); fetchRooms(); }
    }, [activeTab]);

    async function fetchProgram() {
        try {
            const data = await apiClient.get<LoyaltyProgram>('/loyalty/program');
            setProgram(data);
            setForm({
                is_active: data.is_active,
                program_name: data.program_name,
                description: data.description || '',
                milestone_bookings: data.milestone_bookings,
                reward_type: data.reward_type as any,
                reward_value: data.reward_value,
                reward_description: data.reward_description || '',
                popup_title: data.popup_title,
                popup_message: data.popup_message,
            });
            setPointsForm({
                points_enabled: (data as any).points_enabled ?? false,
                points_per_currency: (data as any).points_per_currency ?? 0.1,
                point_value: (data as any).point_value ?? 1,
            });
        } catch {
            toast({ title: 'Failed to load loyalty program', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }

    async function fetchOffers() {
        setOffersLoading(true);
        try {
            const data = await apiClient.get<StayOffer[]>('/loyalty/offers');
            setOffers(data);
        } catch {
            // silently fail
        } finally {
            setOffersLoading(false);
        }
    }

    async function fetchRooms() {
        try {
            const data = await apiClient.get<RoomLite[]>('/rooms');
            setRooms(data.map(r => ({ id: r.id, name: r.name })));
        } catch {
            // rooms optional — offers can still be hotel-wide
        }
    }

    function editOffer(o: StayOffer) {
        setEditingOfferId(o.id);
        setOfferForm({
            room_type_id: o.room_type_id || '',
            is_active: o.is_active,
            title: o.title,
            min_nights: o.min_nights,
            reward_type: o.reward_type,
            reward_value: o.reward_value,
            nudge_title: o.nudge_title,
            nudge_message: o.nudge_message,
        });
    }

    function resetOfferForm() {
        setEditingOfferId(null);
        setOfferForm({ ...BLANK_OFFER });
    }

    async function saveOffer() {
        setSavingOffer(true);
        try {
            const payload = {
                ...offerForm,
                room_type_id: offerForm.room_type_id || null,
            };
            if (editingOfferId) {
                await apiClient.put(`/loyalty/offers/${editingOfferId}`, payload);
            } else {
                await apiClient.post('/loyalty/offers', payload);
            }
            toast({ title: editingOfferId ? 'Offer updated' : 'Offer created' });
            resetOfferForm();
            fetchOffers();
        } catch {
            toast({ title: 'Failed to save offer', variant: 'destructive' });
        } finally {
            setSavingOffer(false);
        }
    }

    async function deleteOffer(id: string) {
        try {
            await apiClient.delete(`/loyalty/offers/${id}`);
            if (editingOfferId === id) resetOfferForm();
            fetchOffers();
        } catch {
            toast({ title: 'Failed to delete offer', variant: 'destructive' });
        }
    }

    async function savePoints() {
        setSavingPoints(true);
        try {
            await apiClient.put('/loyalty/points-config', pointsForm);
            toast({ title: 'Points settings saved!' });
        } catch {
            toast({ title: 'Failed to save points settings', variant: 'destructive' });
        } finally {
            setSavingPoints(false);
        }
    }

    async function fetchGuests() {
        setGuestsLoading(true);
        try {
            const data = await apiClient.get<GuestLoyaltySummary[]>('/loyalty/guests');
            setGuests(data);
        } catch {
            // silently fail
        } finally {
            setGuestsLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        try {
            const updated = await apiClient.put<LoyaltyProgram>('/loyalty/program', form);
            setProgram(updated);
            toast({ title: 'Loyalty program saved!', description: 'Changes are live for new bookings.' });
        } catch {
            toast({ title: 'Failed to save', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    }

    function set(field: string, value: any) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    const rewardLabel = () => {
        if (form.reward_type === 'percentage') return `${form.reward_value}% off`;
        if (form.reward_type === 'fixed_amount') return `₹${form.reward_value} off`;
        return '1 Free Night';
    };

    if (loading) {
        return (
            <PageShell title="Loyalty Program">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell
            title="Loyalty Program"
            description="Reward your returning guests and drive repeat bookings"
        >
            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('setup')}
                        className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            activeTab === 'setup'
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                    >
                        <span className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> Program Setup
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('offers')}
                        className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            activeTab === 'offers'
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                    >
                        <span className="flex items-center gap-2">
                            <BedDouble className="w-4 h-4" /> Stay Offers
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('points')}
                        className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            activeTab === 'points'
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                    >
                        <span className="flex items-center gap-2">
                            <Star className="w-4 h-4" /> Points
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('guests')}
                        className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            activeTab === 'guests'
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                    >
                        <span className="flex items-center gap-2">
                            <Users className="w-4 h-4" /> Loyal Guests
                        </span>
                    </button>
                </div>

                {activeTab === 'setup' && (
                    <Button onClick={handleSave} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </Button>
                )}
            </div>

            {/* ── SETUP TAB ── */}
            {activeTab === 'setup' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* Left: Configuration */}
                    <div className="xl:col-span-2 space-y-5">

                        {/* Enable/Disable Card */}
                        <Card className="border-2 border-dashed border-primary/20 bg-primary/5 dark:bg-primary/10">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-base">
                                            {form.is_active ? '✅ Program is Active' : '⏸ Program is Paused'}
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-0.5">
                                            {form.is_active
                                                ? 'Guests see loyalty rewards during checkout'
                                                : 'Enable to start rewarding returning guests'}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={form.is_active}
                                        onCheckedChange={v => set('is_active', v)}
                                        className="scale-125"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Basic Info */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Crown className="w-4 h-4 text-amber-500" /> Program Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="prog-name">Program Name</Label>
                                    <Input
                                        id="prog-name"
                                        value={form.program_name}
                                        onChange={e => set('program_name', e.target.value)}
                                        placeholder="e.g. Royal Rewards, Gold Club"
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="prog-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
                                    <Textarea
                                        id="prog-desc"
                                        value={form.description}
                                        onChange={e => set('description', e.target.value)}
                                        placeholder="Briefly describe your loyalty program to guests..."
                                        className="mt-1 resize-none"
                                        rows={2}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Milestone & Reward */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Trophy className="w-4 h-4 text-primary" /> Milestone & Reward
                                </CardTitle>
                                <CardDescription>
                                    After how many completed bookings does the guest earn a reward?
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div>
                                    <Label>Bookings required for reward</Label>
                                    <div className="flex items-center gap-3 mt-2">
                                        {[3, 5, 7, 10].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => set('milestone_bookings', n)}
                                                className={cn(
                                                    'w-14 h-12 rounded-xl border-2 text-sm font-bold transition-all',
                                                    form.milestone_bookings === n
                                                        ? 'border-primary bg-primary text-white shadow-md scale-105'
                                                        : 'border-border bg-background hover:border-primary/40'
                                                )}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                        <Input
                                            type="number"
                                            min={1}
                                            max={50}
                                            value={form.milestone_bookings}
                                            onChange={e => set('milestone_bookings', parseInt(e.target.value) || 5)}
                                            className="w-20 text-center font-bold"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label>Reward Type</Label>
                                    <div className="grid grid-cols-3 gap-3 mt-2">
                                        {REWARD_TYPE_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => set('reward_type', opt.value)}
                                                className={cn(
                                                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center',
                                                    form.reward_type === opt.value
                                                        ? 'border-primary bg-primary/5 text-primary'
                                                        : 'border-border hover:border-primary/30'
                                                )}
                                            >
                                                <opt.icon className="w-5 h-5" />
                                                <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                                                <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {form.reward_type !== 'free_night' && (
                                    <div>
                                        <Label htmlFor="reward-val">
                                            Reward Value ({form.reward_type === 'percentage' ? '%' : '₹'})
                                        </Label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-muted-foreground font-semibold">
                                                {form.reward_type === 'percentage' ? '' : '₹'}
                                            </span>
                                            <Input
                                                id="reward-val"
                                                type="number"
                                                min={1}
                                                value={form.reward_value}
                                                onChange={e => set('reward_value', parseFloat(e.target.value) || 0)}
                                                className="w-32"
                                            />
                                            {form.reward_type === 'percentage' && (
                                                <span className="text-muted-foreground">%</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="reward-desc">Reward Label <span className="text-muted-foreground">(shown to guest)</span></Label>
                                    <Input
                                        id="reward-desc"
                                        value={form.reward_description}
                                        onChange={e => set('reward_description', e.target.value)}
                                        placeholder={`e.g. "${rewardLabel()} on your next stay!"`}
                                        className="mt-1"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Popup Message */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-yellow-500" /> Milestone Popup
                                </CardTitle>
                                <CardDescription>
                                    When a guest is 1 booking away from a reward, show them this popup to nudge them.
                                    Use <code className="bg-muted px-1 rounded text-xs">{'{remaining}'}</code> to insert the number of bookings left.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="popup-title">Popup Title</Label>
                                    <Input
                                        id="popup-title"
                                        value={form.popup_title}
                                        onChange={e => set('popup_title', e.target.value)}
                                        placeholder="You're Almost There!"
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="popup-msg">Popup Message</Label>
                                    <Textarea
                                        id="popup-msg"
                                        value={form.popup_message}
                                        onChange={e => set('popup_message', e.target.value)}
                                        placeholder="Book {remaining} more room(s) and unlock your reward!"
                                        className="mt-1 resize-none"
                                        rows={2}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Live Preview */}
                    <div className="space-y-5">
                        <Card className="sticky top-6">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">
                                    Live Preview
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">

                                {/* Milestone progress preview */}
                                <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-4 border border-primary/20">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Trophy className="w-5 h-5 text-primary" />
                                        <span className="font-bold text-sm">{form.program_name}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Guest progress toward reward:
                                    </p>
                                    <div className="w-full bg-primary/10 rounded-full h-2 mb-2">
                                        <div
                                            className="h-2 bg-primary rounded-full transition-all"
                                            style={{ width: `${Math.min(100, ((form.milestone_bookings - 1) / form.milestone_bookings) * 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-right text-muted-foreground">
                                        {form.milestone_bookings - 1}/{form.milestone_bookings} bookings
                                    </p>
                                </div>

                                {/* Popup preview */}
                                <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
                                    <div className="bg-gradient-to-r from-primary/20 to-primary/5 px-4 pt-4 pb-3 text-center">
                                        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-2">
                                            <Gift className="w-6 h-6 text-white" />
                                        </div>
                                        <p className="font-black text-sm">
                                            {form.popup_title || "You're Almost There!"}
                                        </p>
                                    </div>
                                    <div className="p-4 text-center">
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                                            {form.popup_message.replace('{remaining}', '1') || 'Book 1 more room and unlock your reward!'}
                                        </p>
                                        <div className="bg-primary/10 rounded-xl px-3 py-2 mb-3">
                                            <p className="text-[10px] font-bold text-primary/60 uppercase tracking-wider">Reward</p>
                                            <p className="text-sm font-black text-primary">
                                                {form.reward_description || rewardLabel()}
                                            </p>
                                        </div>
                                        <div className="w-full bg-primary text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1">
                                            Book Now <ChevronRight className="w-3 h-3" />
                                        </div>
                                    </div>
                                </div>

                                {/* Reward popup preview */}
                                <div className="rounded-2xl border border-green-200 bg-green-50 dark:bg-green-950/20 p-4 text-center">
                                    <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-1">
                                        Reward Unlocked! 🎉
                                    </p>
                                    <p className="text-[11px] text-green-600 dark:text-green-500">
                                        After {form.milestone_bookings} bookings, guest gets: <strong>{form.reward_description || rewardLabel()}</strong>
                                    </p>
                                </div>

                                <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save Program
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* ── STAY OFFERS TAB ── */}
            {activeTab === 'offers' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Offer editor */}
                    <div className="xl:col-span-1 space-y-5">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <BedDouble className="w-4 h-4 text-primary" />
                                    {editingOfferId ? 'Edit Offer' : 'New Stay Offer'}
                                </CardTitle>
                                <CardDescription>
                                    "Stay N nights, get a reward." Leave room as <strong>All Rooms</strong> for a
                                    hotel-wide offer, or pick a room for a room-specific one.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label>Applies to</Label>
                                    <Select
                                        value={offerForm.room_type_id || 'all'}
                                        onValueChange={v => setOfferForm(f => ({ ...f, room_type_id: v === 'all' ? '' : v }))}
                                    >
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Rooms (hotel-wide)</SelectItem>
                                            {rooms.map(r => (
                                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="offer-title">Offer Title</Label>
                                    <Input
                                        id="offer-title"
                                        value={offerForm.title}
                                        onChange={e => setOfferForm(f => ({ ...f, title: e.target.value }))}
                                        className="mt-1"
                                    />
                                </div>

                                <div>
                                    <Label>Minimum nights to unlock</Label>
                                    <Input
                                        type="number" min={1} max={60}
                                        value={offerForm.min_nights}
                                        onChange={e => setOfferForm(f => ({ ...f, min_nights: parseInt(e.target.value) || 1 }))}
                                        className="mt-1 w-28 font-bold text-center"
                                    />
                                </div>

                                <div>
                                    <Label>Reward Type</Label>
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                        {REWARD_TYPE_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setOfferForm(f => ({ ...f, reward_type: opt.value as any }))}
                                                className={cn(
                                                    'flex flex-col items-center gap-1 p-2 rounded-lg border-2 text-center transition-all',
                                                    offerForm.reward_type === opt.value
                                                        ? 'border-primary bg-primary/5 text-primary'
                                                        : 'border-border hover:border-primary/30'
                                                )}
                                            >
                                                <opt.icon className="w-4 h-4" />
                                                <span className="text-[10px] font-semibold leading-tight">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {offerForm.reward_type !== 'free_night' && (
                                    <div>
                                        <Label>Reward Value ({offerForm.reward_type === 'percentage' ? '%' : '₹'})</Label>
                                        <Input
                                            type="number" min={1}
                                            value={offerForm.reward_value}
                                            onChange={e => setOfferForm(f => ({ ...f, reward_value: parseFloat(e.target.value) || 0 }))}
                                            className="mt-1 w-32"
                                        />
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="nudge-title">Nudge Popup Title</Label>
                                    <Input
                                        id="nudge-title"
                                        value={offerForm.nudge_title}
                                        onChange={e => setOfferForm(f => ({ ...f, nudge_title: e.target.value }))}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="nudge-msg">Nudge Message</Label>
                                    <Textarea
                                        id="nudge-msg"
                                        value={offerForm.nudge_message}
                                        onChange={e => setOfferForm(f => ({ ...f, nudge_message: e.target.value }))}
                                        className="mt-1 resize-none"
                                        rows={2}
                                    />
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        Use <code className="bg-muted px-1 rounded">{'{remaining}'}</code> for nights left
                                        and <code className="bg-muted px-1 rounded">{'{reward}'}</code> for the reward label.
                                    </p>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={offerForm.is_active}
                                            onCheckedChange={v => setOfferForm(f => ({ ...f, is_active: v }))}
                                        />
                                        <span className="text-sm">{offerForm.is_active ? 'Active' : 'Paused'}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {editingOfferId && (
                                            <Button variant="outline" size="sm" onClick={resetOfferForm}>Cancel</Button>
                                        )}
                                        <Button size="sm" onClick={saveOffer} disabled={savingOffer} className="gap-1">
                                            {savingOffer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            {editingOfferId ? 'Update' : 'Create'}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Offer list */}
                    <div className="xl:col-span-2">
                        {offersLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : offers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center">
                                <BedDouble className="w-12 h-12 text-muted-foreground/40 mb-4" />
                                <p className="text-muted-foreground font-medium">No stay offers yet</p>
                                <p className="text-sm text-muted-foreground/60 mt-1">
                                    Create one on the left — e.g. "Stay 5 nights, get 20% off".
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {offers.map(o => {
                                    const roomName = o.room_type_id
                                        ? (rooms.find(r => r.id === o.room_type_id)?.name || 'Specific room')
                                        : 'All Rooms';
                                    const rewardText = o.reward_type === 'free_night'
                                        ? '1 Free Night'
                                        : o.reward_type === 'percentage'
                                            ? `${o.reward_value}% off`
                                            : `₹${o.reward_value} off`;
                                    return (
                                        <Card key={o.id} className="hover:shadow-md transition-shadow">
                                            <CardContent className="p-4 flex items-center justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold text-sm truncate">{o.title}</p>
                                                        {o.is_active
                                                            ? <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>
                                                            : <Badge variant="outline">Paused</Badge>}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Stay <strong>{o.min_nights}</strong> nights →{' '}
                                                        <strong className="text-primary">{rewardText}</strong> · {roomName}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <Button variant="outline" size="sm" onClick={() => editOffer(o)}>Edit</Button>
                                                    <Button variant="outline" size="sm" onClick={() => deleteOffer(o.id)}
                                                        className="text-red-600 hover:text-red-700">Delete</Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── POINTS TAB ── */}
            {activeTab === 'points' && (
                <div className="max-w-2xl space-y-5">
                    <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-base">
                                    {pointsForm.points_enabled ? '✅ Points Wallet Active' : '⏸ Points Wallet Off'}
                                </p>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Guests earn points on every stay and redeem them for money off future bookings.
                                </p>
                            </div>
                            <Switch
                                checked={pointsForm.points_enabled}
                                onCheckedChange={v => setPointsForm(f => ({ ...f, points_enabled: v }))}
                                className="scale-125"
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Star className="w-4 h-4 text-amber-500" /> Earn & Redeem Rates
                            </CardTitle>
                            <CardDescription>You decide how points are earned and what each point is worth.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div>
                                <Label>Points earned per ₹1 spent</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Input
                                        type="number" min={0} step={0.01}
                                        value={pointsForm.points_per_currency}
                                        onChange={e => setPointsForm(f => ({ ...f, points_per_currency: parseFloat(e.target.value) || 0 }))}
                                        className="w-32"
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        points / ₹1 (e.g. 0.1 → ₹1000 stay = 100 points)
                                    </span>
                                </div>
                            </div>
                            <div>
                                <Label>Value of 1 point on redemption</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-muted-foreground">₹</span>
                                    <Input
                                        type="number" min={0} step={0.01}
                                        value={pointsForm.point_value}
                                        onChange={e => setPointsForm(f => ({ ...f, point_value: parseFloat(e.target.value) || 0 }))}
                                        className="w-32"
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        per point (e.g. ₹1 → 100 points = ₹100 off)
                                    </span>
                                </div>
                            </div>

                            <div className="bg-muted/50 rounded-xl p-4 text-sm">
                                <p className="font-semibold mb-1">Example</p>
                                <p className="text-muted-foreground">
                                    A ₹{(1000).toLocaleString()} booking earns{' '}
                                    <strong>{Math.round(1000 * pointsForm.points_per_currency)}</strong> points, worth{' '}
                                    <strong>₹{Math.round(1000 * pointsForm.points_per_currency * pointsForm.point_value)}</strong> on the next stay.
                                </p>
                            </div>

                            <Button onClick={savePoints} disabled={savingPoints} className="gap-2">
                                {savingPoints ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Points Settings
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── GUESTS TAB ── */}
            {activeTab === 'guests' && (
                <div>
                    {guestsLoading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : guests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <Users className="w-12 h-12 text-muted-foreground/40 mb-4" />
                            <p className="text-muted-foreground font-medium">No loyal guests yet</p>
                            <p className="text-sm text-muted-foreground/60 mt-1">
                                Guest loyalty data appears here after bookings are completed
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {guests.map(g => (
                                <Card key={g.guest_email} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                                    <span className="text-primary font-bold text-sm">
                                                        {g.guest_email[0].toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-sm truncate">{g.guest_email}</p>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        <span className="text-xs text-muted-foreground">
                                                            {g.total_completed_bookings} stays
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            ₹{g.total_spend.toLocaleString()} spent
                                                        </span>
                                                        {g.last_booking_at && (
                                                            <span className="text-xs text-muted-foreground">
                                                                Last: {format(new Date(g.last_booking_at), 'dd MMM yyyy')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 shrink-0">
                                                {/* Progress bar */}
                                                <div className="hidden sm:block w-32">
                                                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                                        <span>Progress</span>
                                                        <span>{g.reward_progress_pct}%</span>
                                                    </div>
                                                    <div className="w-full bg-muted rounded-full h-1.5">
                                                        <div
                                                            className={cn(
                                                                'h-1.5 rounded-full',
                                                                g.reward_progress_pct >= 100 ? 'bg-green-500' : 'bg-primary'
                                                            )}
                                                            style={{ width: `${g.reward_progress_pct}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {g.rewards_earned > 0 && (
                                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
                                                        <Trophy className="w-3 h-3" />
                                                        {g.rewards_earned} earned
                                                    </Badge>
                                                )}

                                                {g.bookings_to_next_reward === 0 ? (
                                                    <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                                                        <CheckCircle2 className="w-3 h-3" /> Reward Ready
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="gap-1 text-xs">
                                                        <Star className="w-3 h-3" />
                                                        {g.bookings_to_next_reward} to go
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </PageShell>
    );
}
