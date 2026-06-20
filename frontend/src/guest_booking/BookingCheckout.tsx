import { useState, useEffect, useRef, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, User, Mail, Phone, Calendar, ShieldCheck, CreditCard, Sparkles, MapPin, Zap, Info, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/core/api/client';
import { AddOn, PublicRoomSearchResult } from '@/core/types/api';
import { cn } from '@/core/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { BookingStepper } from '@/guest_booking/components/public/BookingStepper';
import { LoyaltyRewardPopup, LoyaltyMilestonePopup } from '@/guest_booking/components/public/LoyaltyRewardPopup';
import { SocialProofWidget } from '@/guest_booking/components/public/SocialProofWidget';
import { BookingCheckoutContext } from './BookingCheckoutContext';
import { CheckoutGuestSection } from '@/guest_booking/components/public/checkout/CheckoutGuestSection';
import { CheckoutEnhanceStay } from '@/guest_booking/components/public/checkout/CheckoutEnhanceStay';
import { CheckoutPayment } from '@/guest_booking/components/public/checkout/CheckoutPayment';
import { CheckoutSummary } from '@/guest_booking/components/public/checkout/CheckoutSummary';


// Error Boundary to catch render crashes
class CheckoutErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Checkout Error Boundary:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 p-8">
                    <h2 className="text-2xl font-bold text-red-600">Something went wrong</h2>
                    <p className="text-slate-600 text-center max-w-md">{this.state.error?.message}</p>
                    <button onClick={() => window.history.back()} className="px-6 py-2 bg-blue-600 text-white rounded-lg">Go Back</button>
                </div>
            );
        }
        return this.props.children;
    }
}

interface BookingState {
    checkInDate: Date;
    checkOutDate: Date;
    guests: number;
    rooms: any[];
    totalRoomPrice: number;
    addons?: AddOn[];
    source?: string; // 'ai_agent' when the checkout was launched from an AI-concierge booking link
    claimedOffers?: string[];
}
interface CheckoutFormData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    specialRequests?: string;
    promoCode?: string;
}

function BookingCheckoutInner() {
    const { hotelSlug } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'online' | 'property'>('online');
    // Synchronous guard to prevent React batched-setState race when user double-clicks Pay.
    const submitInFlightRef = useRef(false);
    // Stable idempotency key for this checkout attempt. Regenerated only after a successful or
    // permanently-failed submission. Backend uses this to dedupe duplicate POSTs.
    const idempotencyKeyRef = useRef<string>(
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? crypto.randomUUID()
            : `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );

    const { register, setValue, watch, handleSubmit, formState } = useForm<CheckoutFormData>();

    const [state, setState] = useState<BookingState | null>(null);
    const [hotel, setHotel] = useState<any>(null);
    const [isInitializing, setIsInitializing] = useState(true);

    // Promo state - MUST be before any early returns (React hooks rules)
    const [promoCode, setPromoCode] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [promoMessage, setPromoMessage] = useState('');
    const [isValidating, setIsValidating] = useState(false);

    // Loyalty points state
    const [pointsBalance, setPointsBalance] = useState(0);
    const [redeemPointsActive, setRedeemPointsActive] = useState(false);
    const [redeemPointsAmount, setRedeemPointsAmount] = useState(0);

    // Loyalty state — reward popup (coupon unlocked)
    const [loyaltyData, setLoyaltyData] = useState<{
        isOpen: boolean;
        message: string;
        couponCode: string;
        discountText: string;
    }>({ isOpen: false, message: '', couponCode: '', discountText: '' });

    // Loyalty state — milestone nudge popup
    const [milestoneData, setMilestoneData] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        rewardDescription: string;
        bookingsCompleted: number;
        bookingsToReward: number;
        milestoneTotal: number;
    }>({ isOpen: false, title: '', message: '', rewardDescription: '', bookingsCompleted: 0, bookingsToReward: 0, milestoneTotal: 5 });

    const [hasCheckedLoyalty, setHasCheckedLoyalty] = useState(false);
    const [allAddons, setAllAddons] = useState<AddOn[]>([]);

    // Date change states
    const [isChangingDates, setIsChangingDates] = useState(false);
    const [newCheckIn, setNewCheckIn] = useState('');
    const [newCheckOut, setNewCheckOut] = useState('');
    const [isUpdatingDates, setIsUpdatingDates] = useState(false);

    const handleOpenDateChange = () => {
        if (!state) return;
        setNewCheckIn(format(new Date(state.checkInDate), 'yyyy-MM-dd'));
        setNewCheckOut(format(new Date(state.checkOutDate), 'yyyy-MM-dd'));
        setIsChangingDates(true);
    };

    const handleUpdateDates = async () => {
        if (!newCheckIn || !newCheckOut || !state) return;
        
        if (new Date(newCheckOut) <= new Date(newCheckIn)) {
            toast({
                variant: 'destructive',
                title: 'Invalid Dates',
                description: 'Check-out date must be after Check-in date.',
            });
            return;
        }

        setIsUpdatingDates(true);
        try {
            const queryGuests = state.guests || '1';
            const query = new URLSearchParams({
                check_in: newCheckIn,
                check_out: newCheckOut,
                guests: queryGuests.toString(),
                adults: (state.guests || 2).toString(),
                rooms: '1'
            }).toString();

            const roomsData = await apiClient.get<PublicRoomSearchResult[]>(`/public/hotels/${hotelSlug}/rooms?${query}`);
            
            const selectedRoomId = state.rooms[0]?.id;
            const selectedRatePlanId = state.rooms[0]?.rate_plan_id;
            
            const matchedRoom = roomsData.find(r => r.id === selectedRoomId);
            if (!matchedRoom) {
                toast({
                    variant: 'destructive',
                    title: 'Room Unavailable',
                    description: 'This room type is not available for the newly selected dates.',
                });
                return;
            }

            const matchedRate = (matchedRoom.rate_options || []).find(o => o.id === selectedRatePlanId) 
                || matchedRoom.rate_options?.[0];

            if (!matchedRate) {
                toast({
                    variant: 'destructive',
                    title: 'Rate Option Unavailable',
                    description: 'No matching pricing options are available for the new dates.',
                });
                return;
            }

            setState(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    checkInDate: new Date(newCheckIn),
                    checkOutDate: new Date(newCheckOut),
                    rooms: [{
                        ...prev.rooms[0],
                        price_per_night: matchedRate.price_per_night,
                        total_price: matchedRate.total_price,
                        rate_plan_id: matchedRate.id,
                        rate_plan_name: matchedRate.name
                    }],
                    totalRoomPrice: matchedRate.total_price
                };
            });

            toast({
                title: 'Dates Updated',
                description: `Successfully shifted stay dates to ${format(new Date(newCheckIn), 'MMM dd')} - ${format(new Date(newCheckOut), 'MMM dd')}.`,
            });
            setIsChangingDates(false);

        } catch (error) {
            console.error('Failed to update stay dates:', error);
            toast({
                variant: 'destructive',
                title: 'Search Failed',
                description: 'Failed to check availability for the new dates. Please try again.',
            });
        } finally {
            setIsUpdatingDates(false);
        }
    };


    useEffect(() => {
        if (hotelSlug) {
            apiClient.get<AddOn[]>(`/public/hotels/${hotelSlug}/addons`)
                .then(res => setAllAddons(res.filter(a => a.is_active !== false)))
                .catch(console.error);
        }
    }, [hotelSlug]);

    const handleToggleAddon = (addon: AddOn) => {
        setState(prev => {
            if (!prev) return null;
            const currentAddons = prev.addons || [];
            const exists = currentAddons.some(a => a.id === addon.id);
            let updatedAddons;
            if (exists) {
                updatedAddons = currentAddons.filter(a => a.id !== addon.id);
            } else {
                updatedAddons = [...currentAddons, addon];
            }
            return {
                ...prev,
                addons: updatedAddons
            };
        });
    };

    const emailValue = watch('email');

    useEffect(() => {
        if (emailValue && !hasCheckedLoyalty && state) {
            handleEmailBlur();
        }
    }, [emailValue, state, hasCheckedLoyalty]);

    // Auto-set paymentMethod when hotel setting loads
    useEffect(() => {
        if (!hotel) return;
        const mode = hotel?.settings?.payment_mode || 'both';
        if (mode === 'online_only') setPaymentMethod('online');
        else if (mode === 'property_only') setPaymentMethod('property');
        // 'both' -> keep current state (default 'online')
    }, [hotel]);

    useEffect(() => {
        if (hotelSlug) {
            apiClient.get(`/public/hotels/${hotelSlug}`)
                .then(res => setHotel(res))
                .catch(console.error);
        }
    }, [hotelSlug]);

    useEffect(() => {
        if (location.state) {
            setState(location.state as BookingState);
        } else {
            // Check for AI-initiated booking in session storage
            const pending = sessionStorage.getItem('pending_booking_state');
            if (pending) {
                try {
                    const parsed = JSON.parse(pending);
                    setState(parsed);

                    // Pre-fill guest info if available
                    if (parsed.guest_prefill) {
                        if (parsed.guest_prefill.firstName) setValue('firstName', parsed.guest_prefill.firstName);
                        if (parsed.guest_prefill.lastName) setValue('lastName', parsed.guest_prefill.lastName);
                        if (parsed.guest_prefill.email) setValue('email', parsed.guest_prefill.email);
                        if (parsed.guest_prefill.phone) setValue('phone', parsed.guest_prefill.phone);
                    }

                    // Clean up after loading
                    sessionStorage.removeItem('pending_booking_state');
                } catch (e) {
                    console.error("Failed to parse pending booking state");
                }
            } else {
                // Fallback: restore checkout state from sessionStorage (e.g. back-navigation from payment page)
                const checkoutKey = `checkout_state:${hotelSlug}`;
                const savedCheckout = sessionStorage.getItem(checkoutKey);
                if (savedCheckout) {
                    try {
                        const parsed = JSON.parse(savedCheckout);
                        const CACHE_TTL = 5 * 60 * 1000;
                        if (parsed._savedAt && Date.now() - parsed._savedAt < CACHE_TTL) {
                            setState(parsed.state);
                        } else {
                            sessionStorage.removeItem(checkoutKey);
                        }
                    } catch {
                        sessionStorage.removeItem(`checkout_state:${hotelSlug}`);
                    }
                }
            }
        }
        setIsInitializing(false);
    }, [location.state, setValue, hotelSlug]);

    // Persist checkout state to sessionStorage so back-navigation from payment page works
    useEffect(() => {
        if (state && hotelSlug) {
            try {
                sessionStorage.setItem(`checkout_state:${hotelSlug}`, JSON.stringify({
                    state,
                    _savedAt: Date.now()
                }));
            } catch {
                // sessionStorage full — silently ignore
            }
        }
    }, [state, hotelSlug]);

    // Check loyalty when email is entered
    const handleEmailBlur = async () => {
        if (!emailValue || !state || hasCheckedLoyalty) return;

        try {
            const hotelId = state.rooms[0]?.hotel_id || hotelSlug;
            const response = await apiClient.post<any>('/public/loyalty-check', {
                email: emailValue,
                hotel_id: hotelId,
            });

            setHasCheckedLoyalty(true);

            if (response.points_balance) {
                setPointsBalance(response.points_balance);
                setRedeemPointsAmount(response.points_balance);
            }

            if (response.coupon_code) {
                // Reward unlocked
                setLoyaltyData({
                    isOpen: true,
                    message: response.message,
                    couponCode: response.coupon_code,
                    discountText: response.discount_text || '',
                });
            } else if (response.show_milestone_popup) {
                // Nudge: almost at milestone
                setMilestoneData({
                    isOpen: true,
                    title: response.milestone_popup_title || "You're Almost There!",
                    message: response.milestone_popup_message || '',
                    rewardDescription: response.reward_description || '',
                    bookingsCompleted: response.bookings_completed || 0,
                    bookingsToReward: response.bookings_to_reward || 1,
                    milestoneTotal: (response.bookings_completed || 0) + (response.bookings_to_reward || 1),
                });
            }
        } catch (error) {
            console.error('Loyalty check failed', error);
        }
    };

    const applyLoyaltyCoupon = async () => {
        setPromoCode(loyaltyData.couponCode);
        setLoyaltyData(prev => ({ ...prev, isOpen: false }));
        
        // Wait a bit then apply
        setTimeout(() => {
            handleApplyPromo(loyaltyData.couponCode);
        }, 100);
    };

    // Null-safe derived values — computed before any early return so useMemo below
    // is always called (Rules of Hooks). The early return guard comes after useMemo.
    const room = state?.rooms?.[0] ?? null;
    const nights = state?.checkOutDate && state?.checkInDate
        ? (new Date(state.checkOutDate).getTime() - new Date(state.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
        : 0;

    const onSubmit = async (data: CheckoutFormData) => {
        // Synchronous guard: prevents double-submit even before React re-renders the disabled button.
        if (submitInFlightRef.current) return;
        submitInFlightRef.current = true;

        // Validate Razorpay configuration BEFORE creating any booking.
        // Previously fell back to a test key which silently routed prod payments to the dev account.
        if (paymentMethod === 'online' && !hotel?.settings?.razorpay_key_id) {
            submitInFlightRef.current = false;
            toast({
                variant: 'destructive',
                title: 'Payment Not Configured',
                description: 'Online payment is not set up for this property. Please choose "Pay at Property" or contact the hotel.',
            });
            return;
        }

        try {
            setIsSubmitting(true);

            const bookingPayload = {
                check_in: state.checkInDate,
                check_out: state.checkOutDate,
                guest: {
                    first_name: data.firstName,
                    last_name: data.lastName,
                    email: data.email,
                    phone: data.phone,
                    nationality: 'IN',
                    id_type: 'passport',
                    id_number: 'PENDING'
                },
                rooms: state.rooms.map((room: any) => ({
                    room_type_id: room.id,
                    room_type_name: room.name,
                    price_per_night: room.price_per_night || room.rate_options?.[0]?.price_per_night,
                    total_price: room.total_price || room.rate_options?.[0]?.total_price,
                    guests: state.guests,
                    rate_plan_id: room.rate_plan_id || room.rate_options?.[0]?.id,
                    rate_plan_name: room.rate_plan_name || room.rate_options?.[0]?.name
                })),
                addons: state.addons ? state.addons.map(a => ({
                    id: a.id,
                    name: a.name,
                    price: a.price
                })) : [],
                promo_code: appliedPromo || undefined,
                special_requests: data.specialRequests,
                payment_method: paymentMethod === 'property' ? 'pay_at_property' : 'online',
                source: state.source === 'ai_agent' ? 'ai_agent' : undefined,
                idempotency_key: idempotencyKeyRef.current,
                redeem_points: redeemPointsActive ? redeemPointsAmount : undefined,
                claimed_offer_ids: state.claimedOffers || [],
            };

            // Fetch a short-lived anti-automation token to send with the booking.
            // Best-effort: if it fails we still submit (server enforcement is gated).
            let bookingToken = '';
            try {
                const tk = await apiClient.get<{ token: string }>('/public/booking-token');
                bookingToken = tk?.token || '';
            } catch { /* ignore — token is defence in depth, not required client-side */ }

            // First create the booking
            const response = await apiClient.post('/public/bookings', bookingPayload, {
                headers: {
                    'Idempotency-Key': idempotencyKeyRef.current,
                    ...(bookingToken ? { 'X-Booking-Token': bookingToken } : {}),
                },
            }) as any;
            const bookingId = response.id as string;

            if (paymentMethod === 'online') {
                // Load Razorpay Script
                const loadRazorpayScript = (): Promise<boolean> => {
                    return new Promise((resolve) => {
                        if ((window as any).Razorpay) { resolve(true); return; } // Already loaded
                        const script = document.createElement('script');
                        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                        script.onload = () => resolve(true);
                        script.onerror = () => resolve(false);
                        document.body.appendChild(script);
                    });
                };

                const sdkLoaded = await loadRazorpayScript();
                if (!sdkLoaded) {
                    toast({ variant: 'destructive', title: 'Connection Error', description: 'Failed to load Razorpay SDK. Please check your internet connection.' });
                    setIsSubmitting(false);
                    submitInFlightRef.current = false;
                    return;
                }

                // Create Razorpay Order on backend (idempotent on receipt = bookingId)
                let orderData: any;
                try {
                    orderData = await apiClient.post('/public/razorpay/create-order', {
                        amount: finalTotal,
                        receipt: bookingId,
                    }, {
                        headers: { 'Idempotency-Key': `order_${bookingId}` },
                    });
                } catch (orderErr: any) {
                    // 503 = this property's Razorpay isn't configured (no global
                    // fallback by design). Tell the guest clearly rather than
                    // leaving them on a broken payment popup.
                    const notConfigured = orderErr?.status === 503 || orderErr?.message?.toLowerCase?.().includes('configured');
                    toast({
                        variant: 'destructive',
                        title: notConfigured ? 'Online Payment Unavailable' : 'Payment Setup Failed',
                        description: notConfigured
                            ? 'This property has not enabled online payment yet. Please choose "Pay at Property" or contact the hotel directly to complete your booking.'
                            : 'Could not initiate payment. Please try again, or choose "Pay at Property".',
                    });
                    setIsSubmitting(false);
                    submitInFlightRef.current = false;
                    return;
                }

                // Open Razorpay Checkout Popup
                const options = {
                    // No fallback test key — validated above.
                    key: hotel!.settings.razorpay_key_id as string,
                    amount: orderData.amount as number,
                    currency: orderData.currency as string,
                    name: hotel?.name || 'Hotel Booking',
                    description: `Booking ${response.booking_number}`,
                    order_id: orderData.id as string,
                    handler: async function (paymentResponse: any) {
                        try {
                            await apiClient.post('/public/razorpay/verify', {
                                razorpay_order_id: paymentResponse.razorpay_order_id,
                                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                                razorpay_signature: paymentResponse.razorpay_signature,
                                booking_id: bookingId
                            });
                            try { sessionStorage.removeItem(`checkout_state:${hotelSlug}`); } catch { /* ignore */ }
                            // Reset idempotency key for any future booking from same browser session.
                            idempotencyKeyRef.current = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
                                ? crypto.randomUUID()
                                : `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                            navigate(`/book/${hotelSlug}/confirmation`, { state: { booking: response, paymentId: paymentResponse.razorpay_payment_id } });
                        } catch (verifyErr) {
                            console.error('Payment verify failed:', verifyErr);
                            // NOTE: Backend webhook (razorpay/webhook) will also reconcile this.
                            // Show user that payment was captured but verification is pending.
                            toast({
                                variant: 'destructive',
                                title: 'Payment Verification Pending',
                                description: `Payment ID ${paymentResponse.razorpay_payment_id}. Your booking will be confirmed automatically; you'll receive a confirmation email shortly.`,
                            });
                            // Still navigate to confirmation - server-side webhook will finalize.
                            navigate(`/book/${hotelSlug}/confirmation`, {
                                state: { booking: response, paymentId: paymentResponse.razorpay_payment_id, pendingVerification: true },
                            });
                        } finally {
                            setIsSubmitting(false);
                            submitInFlightRef.current = false;
                        }
                    },
                    modal: {
                        ondismiss: function () {
                            setIsSubmitting(false);
                            submitInFlightRef.current = false;
                        }
                    },
                    prefill: {
                        name: `${data.firstName} ${data.lastName}`,
                        email: data.email,
                        contact: data.phone
                    },
                    theme: { color: themeColor }
                };

                const paymentObject = new (window as any).Razorpay(options);
                paymentObject.open();

            } else {
                // Pay at Property — booking already created, just confirm
                try { sessionStorage.removeItem(`checkout_state:${hotelSlug}`); } catch { /* ignore */ }
                idempotencyKeyRef.current = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
                    ? crypto.randomUUID()
                    : `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                navigate(`/book/${hotelSlug}/confirmation`, { state: { booking: response } });
            }

        } catch (error: any) {
            console.error('Booking failed:', error);
            // ApiClientError stores the backend detail in .message and status in .status
            const detail = error?.message || '';
            const status = error?.status ?? error?.response?.status;
            let title = "Booking Failed";
            let description = "Something went wrong. Please try again.";

            if (status === 409) {
                const d = detail.toLowerCase();
                if (d.includes('price') || d.includes('updated') || d.includes('inr')) {
                    title = "Price Has Changed";
                    description = detail || "The room price was updated. Please go back and check the new rate before booking.";
                } else if (d.includes('available') || d.includes('no longer') || d.includes('inventory')) {
                    title = "Room No Longer Available";
                    description = "This room was just booked by someone else. Please go back and choose another option.";
                } else if (d.includes('progress') || d.includes('duplicate')) {
                    title = "Already Processing";
                    description = "A booking attempt is already in progress. Please wait a moment and try again.";
                } else {
                    title = "Booking Conflict";
                    description = detail || "Please go back and try again.";
                }
            } else if (status === 400) {
                title = "Invalid Details";
                description = detail || "Please check your booking details and try again.";
            } else if (status === 500) {
                title = "Server Error";
                description = detail.includes('razorpay') || detail.includes('payment')
                    ? "Payment gateway error. Please try 'Pay at Property' or contact the hotel."
                    : "Our booking system encountered an issue. Please try again in a moment.";
            } else if (error?.name === 'AbortError' || detail.includes('timeout') || detail.includes('aborted')) {
                title = "Connection Timeout";
                description = "Request timed out. Please check your internet connection and try again.";
            }

            toast({
                variant: "destructive",
                title,
                description,
            });
            submitInFlightRef.current = false;
        } finally {
            // Only reset isSubmitting here for the non-Razorpay path or error path.
            // The Razorpay handler/ondismiss reset it themselves.
            if (paymentMethod !== 'online') {
                setIsSubmitting(false);
            }
        }
    };

    const formatCurrency = (amount: number | undefined | null) => {
        if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    const settings = hotel?.settings;
    const taxName = settings?.tax_name || 'GST';
    const roomTaxRate = Number(settings?.room_tax_rate) || 0;
    const roomTaxType = settings?.room_tax_type || 'exclusive';
    const roomTaxCalculationMethod = settings?.room_tax_calculation_method || 'flat';
    const roomTaxSlabs = settings?.room_tax_slabs || [];

    // Payment mode from hotel settings: 'online_only' | 'property_only' | 'both'
    const hotelPaymentMode: string = settings?.payment_mode || 'both';
    const addonTaxRate = Number(settings?.addon_tax_rate) || 0;
    const addonTaxType = settings?.addon_tax_type || 'exclusive';

    const addonsTotal = state?.addons?.reduce((sum, a) => sum + a.price, 0) || 0;
    const grandTotal = (state?.totalRoomPrice ?? 0) + addonsTotal;

    const getRoomTaxRate = (price: number) => {
        if (roomTaxCalculationMethod === 'flat') {
            return roomTaxRate;
        }
        const slab = roomTaxSlabs.find(s => 
            price >= s.from && (s.to === 0 || s.to === null || price <= s.to)
        );
        if (slab) return slab.rate;
        if (price < 1000) return 0;
        if (price < 7500) return 12;
        return 18;
    };

    // Calculate room subtotal & room tax room-by-room
    let roomSubtotal = 0;
    let roomTaxAmount = 0;
    let appliedRoomTaxRate = 0;
    if (state?.rooms && state.rooms.length > 0) {
        state.rooms.forEach((room: any) => {
            const r_rate = getRoomTaxRate(room.price_per_night);
            appliedRoomTaxRate = r_rate;
            const r_total = room.total_price || 0;
            if (roomTaxType === 'inclusive') {
                const r_sub = r_total / (1 + (r_rate / 100));
                roomSubtotal += r_sub;
                roomTaxAmount += (r_total - r_sub);
            } else {
                roomSubtotal += r_total;
                roomTaxAmount += r_total * (r_rate / 100);
            }
        });
    } else {
        const totalRoomPrice = state?.totalRoomPrice ?? 0;
        if (roomTaxType === 'inclusive') {
            roomSubtotal = totalRoomPrice / (1 + (roomTaxRate / 100));
            roomTaxAmount = totalRoomPrice - roomSubtotal;
        } else {
            roomSubtotal = totalRoomPrice;
            roomTaxAmount = totalRoomPrice * (roomTaxRate / 100);
        }
    }

    // Addon subtotal & tax
    let addonSubtotal = addonsTotal;
    let addonTaxAmount = 0;
    if (addonTaxType === 'inclusive') {
        addonSubtotal = addonsTotal / (1 + (addonTaxRate / 100));
        addonTaxAmount = addonsTotal - addonSubtotal;
    } else {
        addonTaxAmount = addonsTotal * (addonTaxRate / 100);
    }

    const subtotalAmount = roomSubtotal + addonSubtotal;
    const taxAmount = roomTaxAmount + addonTaxAmount;
    const totalBeforeDiscount = (roomTaxType === 'exclusive' ? (state?.totalRoomPrice ?? 0) + roomTaxAmount : (state?.totalRoomPrice ?? 0)) +
                                (addonTaxType === 'exclusive' ? addonsTotal + addonTaxAmount : addonsTotal);
    const pointsDiscount = redeemPointsActive ? Math.min(redeemPointsAmount, totalBeforeDiscount - discountAmount) : 0;
    const finalTotal = totalBeforeDiscount - discountAmount - pointsDiscount;

    const handleApplyPromo = async (codeToApply?: string) => {
        const code = codeToApply || promoCode;
        if (!code) return;
        
        setIsValidating(true);
        setPromoMessage('');
        try {
            const res = await apiClient.post<{ valid: boolean, discount: number, message: string }>('/promos/validate', {
                code: code,
                hotel_id: room?.hotel_id,
                booking_amount: totalBeforeDiscount
            });

            if (res.valid) {
                setAppliedPromo(code);
                setDiscountAmount(res.discount);
                setPromoMessage(res.message);
                if (codeToApply) setPromoCode(codeToApply);
            } else {
                setPromoMessage(res.message);
                setDiscountAmount(0);
                setAppliedPromo(null);
            }
        } catch (error) {
            setPromoMessage('Failed to validate coupon');
        } finally {
            setIsValidating(false);
        }
    };

    const getNormalizedColor = (col?: string | null) => {
        return col || '#d11026';
    };
    const themeColor = getNormalizedColor(hotel?.primary_color);

    const ctx = useMemo(() => ({
        hotelSlug: hotelSlug as string, hotel, room, state, setState, register, formState, getNormalizedColor, themeColor, handleEmailBlur, allAddons, currentAddons: state?.addons || [], handleToggleAddon, formatCurrency, roomTaxType, addonTaxType, subtotalAmount, taxAmount, taxName, promoCode, setPromoCode, promoMessage, handleApplyPromo, isValidating, discountAmount, finalTotal, isSubmitting, paymentMethod, setPaymentMethod, handleCheckout: onSubmit, handleSubmit, nights, hotelPaymentMode, roomsTotal: subtotalAmount - (state?.addons ? state.addons.reduce((sum: number, a: any) => sum + a.price, 0) : 0), addonsTotal: state?.addons ? state.addons.reduce((sum: number, a: any) => sum + a.price, 0) : 0,
        appliedRoomTaxRate, roomTaxCalculationMethod, roomTaxAmount, addonTaxRate, addonTaxAmount, appliedPromo, setAppliedPromo, setDiscountAmount,
        pointsBalance, setPointsBalance, redeemPointsActive, setRedeemPointsActive, redeemPointsAmount, setRedeemPointsAmount,
        handleOpenDateChange
    }), [
        hotelSlug, hotel, room, state, register, formState, themeColor, allAddons,
        roomTaxType, addonTaxType, subtotalAmount, taxAmount, taxName,
        promoCode, promoMessage, isValidating, discountAmount, finalTotal,
        isSubmitting, paymentMethod, nights, hotelPaymentMode,
        appliedRoomTaxRate, roomTaxCalculationMethod, roomTaxAmount,
        addonTaxRate, addonTaxAmount, appliedPromo,
        pointsBalance, redeemPointsActive, redeemPointsAmount,
        handleOpenDateChange
    ]);


    // Early return AFTER all hooks — guards the render below when state isn't loaded yet
    if (isInitializing) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                <p className="text-slate-500 font-medium">Loading your booking details...</p>
            </div>
        );
    }

    if (!state || !state.rooms || state.rooms.length === 0 || !state.checkInDate || !state.checkOutDate) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6">
                <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center">
                    <Calendar className="w-10 h-10 text-slate-300" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Session Expired</h2>
                <p className="text-slate-500">Please start your search again to find the best rates.</p>
                <Button onClick={() => navigate(`/book/${hotelSlug}/rooms`)} size="lg" className="rounded-full px-8">Back to Search</Button>
            </div>
        );
    }

    return (
        <BookingCheckoutContext.Provider value={ctx}>
        <div className="min-h-screen bg-slate-50 pb-20 selection:bg-primary/10">
            {/* Stepper Header */}
            <BookingStepper currentStep={4} primaryColor={themeColor} />

            <div className="max-w-6xl mx-auto px-4 mt-8">
                <div className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider mb-3 border border-blue-100">
                            <Zap className="w-3 h-3 fill-blue-600" /> AI-Powered Booking Engine
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Secure Your Stay</h1>
                        <p className="text-slate-500 font-medium">Complete your reservation in just a few steps.</p>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-4 px-6 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Guaranteed</p>
                            <p className="text-sm font-bold text-slate-900">Secure Checkout</p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-12 lg:grid-cols-[1fr,420px]">
                    {/* Left Column: Form */}
                    <div className="space-y-8 animate-enter">
                        
                        <SocialProofWidget />

                        <CheckoutGuestSection />
                        <CheckoutEnhanceStay />
                        {/* Payment Section */}
                        <div className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-xl shadow-slate-200/40">
                            {/* Header */}
                            <div className="px-8 md:px-10 pt-8 md:pt-10 pb-6 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Payment</h2>
                                    <p className="text-sm font-medium" style={{ color: themeColor }}>
                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse align-middle" />
                                        Powered by Razorpay • 256-bit SSL Encrypted
                                    </p>
                                </div>
                            </div>

                            {/* Payment Options */}
                            <div className="px-8 md:px-10 pb-8 md:pb-10 space-y-3">

                                {/* --- ONLINE ONLY: Just a clean info block, no choice --- */}
                                {hotelPaymentMode === 'online_only' && (
                                    <div className="flex items-start gap-4 p-5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/40">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <CreditCard className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-black text-slate-900">Secure Online Payment</h3>
                                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-widest">Required</span>
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium">Complete your booking with a secure online payment via Credit/Debit Card, UPI, or Net Banking.</p>
                                            <div className="flex items-center gap-2 mt-3">
                                                <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-4 opacity-50" />
                                                <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-5 opacity-50" />
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">+ UPI, NetBanking</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* --- PROPERTY ONLY: Just a clean info block, no choice --- */}
                                {hotelPaymentMode === 'property_only' && (
                                    <div className="flex items-start gap-4 p-5 rounded-2xl border-2 border-slate-200 bg-slate-50/50">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <CreditCard className="w-5 h-5 text-slate-500" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-black text-slate-900">Pay at Property</h3>
                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-widest">No Charge Today</span>
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium">Your booking is guaranteed. Full payment is collected directly at the hotel during check-in or check-out.</p>
                                        </div>
                                    </div>
                                )}

                                {/* --- BOTH: Guest chooses --- */}
                                {hotelPaymentMode === 'both' && (
                                    <>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Choose how you'd like to pay</p>

                                        {/* Pay Now Option */}
                                        <label
                                            htmlFor="pay-online"
                                            className={cn(
                                                "flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200",
                                                paymentMethod === 'online'
                                                    ? "border-emerald-500 bg-emerald-50/40 shadow-sm shadow-emerald-100"
                                                    : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50"
                                            )}
                                        >
                                            <div className="flex items-center pt-0.5">
                                                <input
                                                    id="pay-online"
                                                    type="radio"
                                                    name="paymentMethod"
                                                    value="online"
                                                    checked={paymentMethod === 'online'}
                                                    onChange={() => setPaymentMethod('online')}
                                                    className="w-4 h-4 accent-emerald-600"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-black text-slate-900">Pay Now (Online)</h3>
                                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-widest">Instant Confirm</span>
                                                </div>
                                                <p className="text-sm text-slate-500 font-medium">Pay securely via Credit/Debit Card, UPI, or Net Banking. Booking confirmed instantly.</p>
                                                <div className="flex items-center gap-2 mt-2.5">
                                                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className={cn("h-3.5 transition-opacity", paymentMethod === 'online' ? 'opacity-70' : 'opacity-30')} />
                                                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className={cn("h-5 transition-opacity", paymentMethod === 'online' ? 'opacity-70' : 'opacity-30')} />
                                                    <span className={cn("text-[10px] font-bold uppercase tracking-wider transition-colors", paymentMethod === 'online' ? 'text-slate-400' : 'text-slate-300')}>+ UPI, NetBanking</span>
                                                </div>
                                            </div>
                                        </label>

                                        {/* Pay at Property Option */}
                                        <label
                                            htmlFor="pay-property"
                                            className={cn(
                                                "flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200",
                                                paymentMethod === 'property'
                                                    ? "border-slate-400 bg-slate-50/60 shadow-sm"
                                                    : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50"
                                            )}
                                        >
                                            <div className="flex items-center pt-0.5">
                                                <input
                                                    id="pay-property"
                                                    type="radio"
                                                    name="paymentMethod"
                                                    value="property"
                                                    checked={paymentMethod === 'property'}
                                                    onChange={() => setPaymentMethod('property')}
                                                    className="w-4 h-4 accent-slate-600"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-black text-slate-900">Pay at Property</h3>
                                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-widest">No Charge Today</span>
                                                </div>
                                                <p className="text-sm text-slate-500 font-medium">No charges today. Your booking is guaranteed and payment is collected at the hotel.</p>
                                            </div>
                                        </label>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <CheckoutSummary />
                </div>
            </div>

            {/* Loyalty Reward Popup — coupon unlocked */}
            <LoyaltyRewardPopup
                isOpen={loyaltyData.isOpen}
                onClose={() => setLoyaltyData(prev => ({ ...prev, isOpen: false }))}
                message={loyaltyData.message}
                couponCode={loyaltyData.couponCode}
                discountText={loyaltyData.discountText}
                onApply={applyLoyaltyCoupon}
            />

            {/* Loyalty Milestone Nudge Popup — almost there */}
            <LoyaltyMilestonePopup
                isOpen={milestoneData.isOpen}
                onClose={() => setMilestoneData(prev => ({ ...prev, isOpen: false }))}
                title={milestoneData.title}
                message={milestoneData.message}
                rewardDescription={milestoneData.rewardDescription}
                bookingsCompleted={milestoneData.bookingsCompleted}
                bookingsToReward={milestoneData.bookingsToReward}
                milestoneTotal={milestoneData.milestoneTotal}
                onContinue={() => setMilestoneData(prev => ({ ...prev, isOpen: false }))}
            />

            {/* Date Change Modal */}
            {isChangingDates && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-slate-100 shadow-2xl space-y-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Modify Stay Dates</h3>
                            <p className="text-xs text-slate-500 font-medium mt-1">Changing dates will check current room availability and update your reservation pricing.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label htmlFor="newCheckIn" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">New Check-in</Label>
                                <Input
                                    id="newCheckIn"
                                    type="date"
                                    value={newCheckIn}
                                    onChange={(e) => setNewCheckIn(e.target.value)}
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="newCheckOut" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">New Check-out</Label>
                                <Input
                                    id="newCheckOut"
                                    type="date"
                                    value={newCheckOut}
                                    onChange={(e) => setNewCheckOut(e.target.value)}
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="flex-1 h-12 rounded-xl font-bold text-sm"
                                onClick={() => setIsChangingDates(false)}
                                disabled={isUpdatingDates}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 h-12 rounded-xl font-bold text-sm text-white"
                                style={{ backgroundColor: themeColor }}
                                onClick={handleUpdateDates}
                                disabled={isUpdatingDates || !newCheckIn || !newCheckOut}
                            >
                                {isUpdatingDates ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Dates'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </BookingCheckoutContext.Provider>
    );
}

export default function BookingCheckout() {
    return (
        <CheckoutErrorBoundary>
            <BookingCheckoutInner />
        </CheckoutErrorBoundary>
    );
}
