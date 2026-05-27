import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, User, Mail, Phone, Calendar, ShieldCheck, CreditCard, Sparkles, MapPin, Zap, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/api/client';
import { AddOn } from '@/types/api';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { BookingStepper } from '@/components/public/BookingStepper';
import { LoyaltyRewardPopup } from '@/components/public/LoyaltyRewardPopup';
import { SocialProofWidget } from '@/components/public/SocialProofWidget';

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

    const { register, setValue, watch, handleSubmit, formState: { errors } } = useForm<CheckoutFormData>();

    const [state, setState] = useState<BookingState | null>(null);
    const [hotel, setHotel] = useState<any>(null);

    // Promo state - MUST be before any early returns (React hooks rules)
    const [promoCode, setPromoCode] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [promoMessage, setPromoMessage] = useState('');
    const [isValidating, setIsValidating] = useState(false);

    // Loyalty AI state
    const [loyaltyData, setLoyaltyData] = useState<{
        isOpen: boolean;
        message: string;
        couponCode: string;
        discountText: string;
    }>({
        isOpen: false,
        message: '',
        couponCode: '',
        discountText: ''
    });
    const [hasCheckedLoyalty, setHasCheckedLoyalty] = useState(false);

    const emailValue = watch('email');

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
            // Get hotel ID from first room
            const hotelId = state.rooms[0]?.hotel_id || hotelSlug;
            
            const response = await apiClient.post<any>('/public/loyalty-check', {
                email: emailValue,
                hotel_id: hotelId
            });

            if (response.is_repeat_guest) {
                setLoyaltyData({
                    isOpen: true,
                    message: response.message,
                    couponCode: response.coupon_code,
                    discountText: response.discount_text
                });
                setHasCheckedLoyalty(true);
            }
        } catch (error) {
            console.error("Loyalty check failed", error);
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
        )
    }

    const room = state.rooms[0];
    const nights = (new Date(state.checkOutDate).getTime() - new Date(state.checkInDate).getTime()) / (1000 * 60 * 60 * 24);

    const onSubmit = async (data: CheckoutFormData) => {
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
                special_requests: data.specialRequests
            };

            // First create the booking
            const response = await apiClient.post('/public/bookings', bookingPayload) as any;
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
                    return;
                }

                // Create Razorpay Order on backend
                const orderData = await apiClient.post('/public/razorpay/create-order', {
                    amount: finalTotal,
                    receipt: bookingId
                }) as any;

                // Open Razorpay Checkout Popup
                const options = {
                    key: 'rzp_test_SuHDIa6RIMTJhm',
                    amount: orderData.amount as number,
                    currency: orderData.currency as string,
                    name: hotel?.name || 'Hotel Booking',
                    description: `Booking ${response.booking_number}`,
                    order_id: orderData.id as string,
                    handler: async function (paymentResponse: any) {
                        try {
                            setIsSubmitting(true);
                            await apiClient.post('/public/razorpay/verify', {
                                razorpay_order_id: paymentResponse.razorpay_order_id,
                                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                                razorpay_signature: paymentResponse.razorpay_signature,
                                booking_id: bookingId
                            });
                            try { sessionStorage.removeItem(`checkout_state:${hotelSlug}`); } catch { /* ignore */ }
                            navigate(`/book/${hotelSlug}/confirmation`, { state: { booking: response } });
                        } catch {
                            setIsSubmitting(false);
                            toast({ variant: 'destructive', title: 'Payment Verification Failed', description: 'Your payment was received but could not be verified. Please contact support with your payment ID.' });
                        }
                    },
                    modal: {
                        ondismiss: function () {
                            setIsSubmitting(false);
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
                navigate(`/book/${hotelSlug}/confirmation`, { state: { booking: response } });
            }

        } catch (error) {
            console.error('Booking failed:', error);
            toast({
                variant: "destructive",
                title: "Booking Failed",
                description: "Something went wrong. Please try again.",
            });
        } finally {
            setIsSubmitting(false);
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

    const addonsTotal = state.addons?.reduce((sum, a) => sum + a.price, 0) || 0;
    const grandTotal = state.totalRoomPrice + addonsTotal;

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
    if (state.rooms && state.rooms.length > 0) {
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
        if (roomTaxType === 'inclusive') {
            roomSubtotal = state.totalRoomPrice / (1 + (roomTaxRate / 100));
            roomTaxAmount = state.totalRoomPrice - roomSubtotal;
        } else {
            roomSubtotal = state.totalRoomPrice;
            roomTaxAmount = state.totalRoomPrice * (roomTaxRate / 100);
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
    const totalBeforeDiscount = (roomTaxType === 'exclusive' ? state.totalRoomPrice + roomTaxAmount : state.totalRoomPrice) + 
                                (addonTaxType === 'exclusive' ? addonsTotal + addonTaxAmount : addonsTotal);
    const finalTotal = totalBeforeDiscount - discountAmount;

    const handleApplyPromo = async (codeToApply?: string) => {
        const code = codeToApply || promoCode;
        if (!code) return;
        
        setIsValidating(true);
        setPromoMessage('');
        try {
            const res = await apiClient.post<{ valid: boolean, discount: number, message: string }>('/promos/validate', {
                code: code,
                hotel_id: room.hotel_id,
                booking_amount: grandTotal
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
        return col || '#7c3aed';
    };
    const themeColor = getNormalizedColor(hotel?.primary_color);

    return (
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

                        {/* Guest Section */}
                        <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                <User className="w-32 h-32" />
                            </div>

                            <div className="flex items-center gap-4 mb-10">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary rotate-3">
                                    <User className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Guest Information</h2>
                                    <p className="text-sm text-slate-500 font-medium">Please enter the details of the primary guest.</p>
                                </div>
                            </div>

                            <form id="booking-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <Label htmlFor="firstName" className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black ml-1">First Name</Label>
                                        <Input
                                            id="firstName"
                                            placeholder="e.g. John"
                                            className="h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:border-primary focus:bg-white transition-all text-lg font-medium"
                                            {...register('firstName', { required: 'First name is required' })}
                                        />
                                        {errors.firstName && <span className="text-xs text-red-500 font-bold ml-1">{errors.firstName.message}</span>}
                                    </div>
                                    <div className="space-y-3">
                                        <Label htmlFor="lastName" className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black ml-1">Last Name</Label>
                                        <Input
                                            id="lastName"
                                            placeholder="e.g. Doe"
                                            className="h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:border-primary focus:bg-white transition-all text-lg font-medium"
                                            {...register('lastName', { required: 'Last name is required' })}
                                        />
                                        {errors.lastName && <span className="text-xs text-red-500 font-bold ml-1">{errors.lastName.message}</span>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <Label htmlFor="email" className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black ml-1">Email Address</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-6 top-5 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="email"
                                                type="email"
                                                className="pl-14 h-14 pr-6 rounded-2xl bg-slate-50 border-transparent focus:border-primary focus:bg-white transition-all text-lg font-medium"
                                                placeholder="john@example.com"
                                                {...register('email', {
                                                    required: 'Email is required',
                                                    pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' }
                                                })}
                                                onBlur={handleEmailBlur}
                                            />
                                        </div>
                                        {errors.email && <span className="text-xs text-red-500 font-bold ml-1">{errors.email.message}</span>}
                                    </div>

                                    <div className="space-y-3">
                                        <Label htmlFor="phone" className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black ml-1">Phone Number</Label>
                                        <div className="relative">
                                            <Phone className="absolute left-6 top-5 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="phone"
                                                type="tel"
                                                className="pl-14 h-14 pr-6 rounded-2xl bg-slate-50 border-transparent focus:border-primary focus:bg-white transition-all text-lg font-medium"
                                                placeholder="+91 98765 43210"
                                                {...register('phone', { required: 'Phone is required' })}
                                            />
                                        </div>
                                        {errors.phone && <span className="text-xs text-red-500 font-bold ml-1">{errors.phone.message}</span>}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label htmlFor="requests" className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black ml-1">Special Requests</Label>
                                    <Textarea
                                        id="requests"
                                        placeholder="Any specific preferences? (Optional)"
                                        className="min-h-[120px] p-6 rounded-2xl bg-slate-50 border-transparent focus:border-primary focus:bg-white transition-all resize-none text-lg"
                                        {...register('specialRequests')}
                                    />
                                </div>
                            </form>
                        </div>

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
                    {/* Right Column: Summary */}
                    <div className="lg:sticky lg:top-8 h-fit animate-enter" style={{ animationDelay: '0.1s' }}>
                        <div className="bg-white rounded-[3rem] overflow-hidden shadow-2xl shadow-slate-300/50 border border-slate-100">
                            {/* Room Image Header */}
                            <div className="h-56 relative bg-slate-200">
                                {room.photos && room.photos.length > 0 ? (
                                    <img src={room.photos[0].url} alt="Room" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">
                                        <MapPin className="w-12 h-12 opacity-20" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute bottom-6 left-8 right-8 text-white">
                                    <h3 className="font-black text-2xl mb-1 tracking-tight">
                                        {state.rooms.length > 1 ? `${state.rooms.length} Rooms Selected` : room.name}
                                    </h3>
                                    <p className="text-xs text-white/90 font-medium mb-3 line-clamp-1">
                                        {state.rooms.map(r => r.name || r.room_type_name).join(' • ')}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {state.rooms.map((r, idx) => (
                                            <Badge key={idx} className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border-0 font-bold px-3 py-1 rounded-full text-[11px]">
                                                {r.rate_plan_name || r.rate_options?.[0]?.name || 'Standard Rate'}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 md:p-10 space-y-8">
                                {/* Date Timeline */}
                                <div className="grid grid-cols-2 gap-4 relative">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-slate-50 rounded-full border border-slate-100 flex items-center justify-center z-10 hidden md:flex">
                                        <ArrowRight className="w-4 h-4 text-slate-300" />
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Check-in</p>
                                        <p className="font-bold text-slate-900">{format(new Date(state.checkInDate), 'MMM dd')}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase">2:00 PM</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Check-out</p>
                                        <p className="font-bold text-slate-900">{format(new Date(state.checkOutDate), 'MMM dd')}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase">11:00 AM</p>
                                    </div>
                                </div>

                                <Separator className="bg-slate-100" />

                                {/* Price Breakdown */}
                                <div className="space-y-4">
                                    <div className="space-y-3 pb-2 border-b border-dashed border-slate-100">
                                        {state.rooms.map((r: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-start text-sm">
                                                <div>
                                                    <span className="text-slate-800 font-bold block">{r.name || r.room_type_name}</span>
                                                    <span className="text-xs text-slate-400 font-medium">{r.rate_plan_name || r.rate_options?.[0]?.name || 'Standard Rate'} • ({nights} {nights === 1 ? 'night' : 'nights'})</span>
                                                </div>
                                                <span className="font-bold text-slate-900">{formatCurrency(r.total_price || (r.rate_options?.[0]?.total_price))}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {state.addons && state.addons.length > 0 && (
                                        <div className="space-y-3 pt-2">
                                            {state.addons.map((addon, index) => (
                                                <div key={index} className="flex justify-between items-center text-sm">
                                                    <span className="flex items-center text-slate-500 font-medium"><Sparkles className="w-3.5 h-3.5 mr-2 text-primary" /> {addon.name}</span>
                                                    <span className="font-bold text-slate-900">{formatCurrency(addon.price)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="space-y-2.5 pt-3 border-t border-dashed border-slate-100">
                                        <div className="flex justify-between items-center text-xs text-slate-400 font-black uppercase tracking-widest ml-1">
                                            <span>Tax Breakdown ({taxName})</span>
                                            <span>{roomTaxType === 'exclusive' || (addonsTotal > 0 && addonTaxType === 'exclusive') ? 'Extra' : 'Included'}</span>
                                        </div>
                                        <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60 space-y-2 text-xs">
                                            <div className="flex justify-between items-center text-slate-600 font-medium">
                                                <span>Room {taxName} ({appliedRoomTaxRate}%{roomTaxCalculationMethod === 'slab' ? ' slab' : ''} · {roomTaxType})</span>
                                                <span className="font-bold text-slate-900">
                                                    {roomTaxType === 'inclusive' ? `Included (${formatCurrency(roomTaxAmount)})` : formatCurrency(roomTaxAmount)}
                                                </span>
                                            </div>
                                            {addonsTotal > 0 && addonTaxRate > 0 && (
                                                <div className="flex justify-between items-center text-slate-600 font-medium">
                                                    <span>Experiences & Activities {taxName} ({addonTaxRate}%)</span>
                                                    <span className="font-bold text-slate-900">
                                                        {addonTaxType === 'inclusive' ? `Included (${formatCurrency(addonTaxAmount)})` : formatCurrency(addonTaxAmount)}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center text-emerald-600 font-bold pt-1.5 border-t border-slate-200">
                                                <span>Total Taxes</span>
                                                <span>{formatCurrency(taxAmount)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                {/* Coupon Section */}
                                <div className="pt-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <Label htmlFor="promoCode" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Promo Code</Label>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            id="promoCode"
                                            placeholder="ENTER CODE"
                                            value={promoCode}
                                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                            disabled={!!appliedPromo}
                                            className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white font-bold tracking-widest text-center"
                                        />
                                        {appliedPromo ? (
                                            <Button type="button" variant="outline" size="lg" className="rounded-xl px-6 font-bold" onClick={() => {
                                                setAppliedPromo(null);
                                                setDiscountAmount(0);
                                                setPromoCode('');
                                            }}>
                                                Clear
                                            </Button>
                                        ) : (
                                            <Button type="button" size="lg" className="rounded-xl px-8 font-bold text-white" style={{ backgroundColor: themeColor }} onClick={() => handleApplyPromo()} disabled={isValidating || !promoCode}>
                                                {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                                            </Button>
                                        )}
                                    </div>
                                    {promoMessage && (
                                        <div className={cn("mt-3 p-3 rounded-xl text-xs font-bold flex items-center gap-2", appliedPromo ? "bg-green-50 text-green-600 border border-green-100" : "bg-red-50 text-red-500 border border-red-100")}>
                                            <Info className="w-3.5 h-3.5" /> {promoMessage}
                                        </div>
                                    )}
                                </div>

                                {/* Total */}
                                <div className="pt-8 border-t border-slate-100">
                                    <div className="space-y-2 mb-6">
                                        <div className="flex justify-between items-center text-slate-400 font-bold">
                                            <span className="text-xs uppercase tracking-widest">Base Subtotal</span>
                                            <span className="text-sm">{formatCurrency(subtotalAmount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-400 font-bold">
                                            <span className="text-xs uppercase tracking-widest">Taxes</span>
                                            <span className="text-sm">
                                                {roomTaxType === 'exclusive' || (addonsTotal > 0 && addonTaxType === 'exclusive') 
                                                    ? `+ ${formatCurrency(taxAmount)}` 
                                                    : `Incl. ${formatCurrency(taxAmount)}`}
                                            </span>
                                        </div>
                                        {appliedPromo && (
                                            <div className="flex justify-between items-center text-green-600 font-bold animate-in fade-in slide-in-from-top-1">
                                                <span className="text-xs uppercase tracking-widest">Loyalty Reward</span>
                                                <span className="text-sm">-{formatCurrency(discountAmount)}</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-xs font-black text-slate-900 uppercase tracking-widest mb-1">Total to Pay</span>
                                        <div className="text-right">
                                            <span className="text-4xl font-black text-slate-900 tracking-tighter block">{formatCurrency(finalTotal)}</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-right text-slate-400 font-bold uppercase tracking-tighter">
                                        {roomTaxType === 'exclusive' || (addonsTotal > 0 && addonTaxType === 'exclusive')
                                            ? `Exclusive of Taxes (added above)`
                                            : 'Inclusive of all taxes & fees'}
                                    </p>
                                </div>

                                {/* Submit Button */}
                                <Button
                                    className="w-full h-16 text-xl font-black rounded-2xl shadow-2xl text-white hover:-translate-y-1 active:translate-y-0 transition-all uppercase tracking-tight"
                                    style={{ backgroundColor: themeColor }}
                                    type="submit"
                                    form="booking-form"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-3 h-6 w-6 animate-spin" /> Confirming...
                                        </>
                                    ) : (
                                        <>
                                            Finish Booking <ArrowRight className="ml-3 h-6 w-6" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className="text-center mt-10">
                            <div className="flex items-center justify-center gap-4 mb-4">
                                <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                                    <span className="text-xs font-bold text-slate-600 uppercase">256-Bit SSL Secured</span>
                                </div>
                                <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-2.5 opacity-50" />
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-4 opacity-50" />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 max-w-xs mx-auto font-bold uppercase tracking-widest leading-relaxed">
                                By proceeding, you agree to our <a href="#" className="text-primary hover:underline">Terms</a> & <a href="#" className="text-primary hover:underline">Privacy Policy</a>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Loyalty Reward Popup */}
            <LoyaltyRewardPopup 
                isOpen={loyaltyData.isOpen}
                onClose={() => setLoyaltyData(prev => ({ ...prev, isOpen: false }))}
                message={loyaltyData.message}
                couponCode={loyaltyData.couponCode}
                discountText={loyaltyData.discountText}
                onApply={applyLoyaltyCoupon}
            />
        </div>
    );
}

export default function BookingCheckout() {
    return (
        <CheckoutErrorBoundary>
            <BookingCheckoutInner />
        </CheckoutErrorBoundary>
    );
}
