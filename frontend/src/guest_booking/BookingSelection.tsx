import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ChevronLeft, ChevronRight, Check, ShoppingBag, X, ArrowRight, Sparkles, Hotel as HotelIcon, MapPin } from 'lucide-react';
import { motion, AnimatePresence, type HTMLMotionProps } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

// framer-motion v12 has stricter types — typed wrappers fix IDE errors without affecting runtime
const MotionImg = motion.img as React.FC<HTMLMotionProps<'img'> & { src?: string; alt?: string }>;
const MotionDiv = motion.div as React.FC<HTMLMotionProps<'div'> & { children?: React.ReactNode }>;
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import { apiClient, API_BASE_URL } from '@/api/client';
import { cn } from '@/lib/utils';
import { PublicRoomSearchResult, RateOption, AddOn, Hotel } from '@/types/api';
import { RoomDetailModal } from '@/components/public/RoomDetailModal';
import { BookingStepper } from '@/components/public/BookingStepper';
import { SocialProofWidget } from '@/components/public/SocialProofWidget';
import { ChatWidget } from '@/components/public/ChatWidget';
import { format, addDays, differenceInDays } from 'date-fns';
import { getImageUrl } from '@/lib/utils';
import { ICONS } from '@/lib/amenityIcons';
import { LoyaltyRewardPopup, LoyaltyMilestonePopup, StayOfferPopup } from '@/components/public/LoyaltyRewardPopup';

// Extracted Booking Sub-Components
import { RoomSearchHeader } from '@/components/public/booking/RoomSearchHeader';
import { RoomFiltersSort } from '@/components/public/booking/RoomFiltersSort';
import { RoomCard, PackageCard } from '@/components/public/booking/RoomCard';
import { BookingCartSheet } from '@/components/public/booking/BookingCartSheet';
import { RateSelectDialog } from '@/components/public/booking/RateSelectDialog';

interface CartItem {
    id: string;
    room: PublicRoomSearchResult;
    ratePlan: RateOption;
    addons: AddOn[];
    adults: number;
    children: number;
}

export default function BookingSelection() {
    const { hotelSlug } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [rooms, setRooms] = useState<PublicRoomSearchResult[]>([]);
    const [addons, setAddons] = useState<AddOn[]>([]);
    const [hotel, setHotel] = useState<Hotel | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    // Tracks a failure of the critical rooms/hotel fetch so the guest sees a
    // retry affordance instead of a silent blank page.
    const [loadError, setLoadError] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<PublicRoomSearchResult | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRateInfo, setSelectedRateInfo] = useState<RateOption | null>(null);
    const [isRateModalOpen, setIsRateModalOpen] = useState(false);
    const [recommendations, setRecommendations] = useState<any[]>([]);

    // Addon Sheet State
    const [isAddonSheetOpen, setIsAddonSheetOpen] = useState(false);
    const [selectedRatePlan, setSelectedRatePlan] = useState<RateOption | null>(null);
    const [selectedAddons, setSelectedAddons] = useState<AddOn[]>([]);
    const [pendingRoom, setPendingRoom] = useState<PublicRoomSearchResult | null>(null);

    // Cart State (STAAH Multi-Room Booking)
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);

    // Search State
    const [checkInDate, setCheckInDate] = useState<Date | undefined>(undefined);
    const [checkOutDate, setCheckOutDate] = useState<Date | undefined>(undefined);
    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);
    const [promoCode, setPromoCode] = useState('');
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isGuestOpen, setIsGuestOpen] = useState(false);
    const [flexibleDates, setFlexibleDates] = useState(false);
    const [roomsCount, setRoomsCount] = useState(1);
    const [isMobile, setIsMobile] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Loyalty checking states
    const [loyaltyEmail, setLoyaltyEmail] = useState('');
    const [isLoyaltyChecked, setIsLoyaltyChecked] = useState(false);
    const [loyaltyBalance, setLoyaltyBalance] = useState(0);
    const [loyaltyMessage, setLoyaltyMessage] = useState('');
    const [loyaltyChecking, setLoyaltyChecking] = useState(false);

    // Loyalty popups states
    const [loyaltyData, setLoyaltyData] = useState<{
        isOpen: boolean;
        message: string;
        couponCode: string;
        discountText: string;
    }>({
        isOpen: false,
        message: '',
        couponCode: '',
        discountText: '',
    });

    const [milestoneData, setMilestoneData] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        rewardDescription: string;
        bookingsCompleted: number;
        bookingsToReward: number;
        milestoneTotal: number;
    }>({
        isOpen: false,
        title: '',
        message: '',
        rewardDescription: '',
        bookingsCompleted: 0,
        bookingsToReward: 0,
        milestoneTotal: 0,
    });

    // Stay-offer nudge (night-threshold upsell) — drives guests to extend their stay.
    const [stayOffer, setStayOffer] = useState<{
        isOpen: boolean;
        title: string;
        nudgeTitle: string;
        nudgeMessage: string;
        rewardLabel: string;
        currentNights: number;
        minNights: number;
    }>({
        isOpen: false, title: '', nudgeTitle: '', nudgeMessage: '',
        rewardLabel: '', currentNights: 0, minNights: 0,
    });
    // Remember the night-counts we've already nudged on, so we don't re-spam.
    const stayOfferShownRef = useRef<Set<number>>(new Set());

    const applyLoyaltyCoupon = (couponCode: string) => {
        setPromoCode(couponCode);
        setLoyaltyData(prev => ({ ...prev, isOpen: false }));
        if (!hotelSlug || !checkInDate || !checkOutDate) return;
        const totalGuests = adults + children;
        const params = new URLSearchParams({
            check_in: format(checkInDate, 'yyyy-MM-dd'),
            check_out: format(checkOutDate, 'yyyy-MM-dd'),
            guests: totalGuests.toString(),
            adults: adults.toString(),
            children: children.toString(),
            rooms: roomsCount.toString(),
            promo_code: couponCode
        });
        navigate(`/book/${hotelSlug}/rooms?${params.toString()}`);
    };

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    useEffect(() => {
        const saved = sessionStorage.getItem('loyalty_checked_guest');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setLoyaltyEmail(parsed.email);
                setIsLoyaltyChecked(true);
                setLoyaltyBalance(parsed.points_balance);
                setLoyaltyMessage(parsed.message);
            } catch (_) {}
        }
    }, []);

    // Stay-offer nudge: whenever the hotel + dates are known, ask the backend if
    // extending the stay would unlock a reward, and nudge the guest if so.
    useEffect(() => {
        const hid = hotel?.id;
        if (!hid || !checkInDate || !checkOutDate) return;
        const nights = differenceInDays(checkOutDate, checkInDate);
        if (nights <= 0) return;
        // Only nudge once per distinct night-count to avoid spamming on re-render.
        if (stayOfferShownRef.current.has(nights)) return;

        let cancelled = false;
        (async () => {
            try {
                const res = await apiClient.post<any>('/public/loyalty-offers', {
                    hotel_id: hid,
                    nights,
                });
                if (cancelled) return;
                if (res?.has_offer && !res.unlocked && (res.nights_remaining || 0) > 0) {
                    stayOfferShownRef.current.add(nights);
                    setStayOffer({
                        isOpen: true,
                        title: res.title || 'Stay Offer',
                        nudgeTitle: res.nudge_title || 'Stay a little longer!',
                        nudgeMessage: res.nudge_message || '',
                        rewardLabel: res.reward_label || '',
                        currentNights: res.current_nights || nights,
                        minNights: res.min_nights || nights,
                    });
                }
            } catch (_) {
                // Loyalty is best-effort — never block the booking flow.
            }
        })();
        return () => { cancelled = true; };
    }, [hotel?.id, checkInDate, checkOutDate]);

    const handleCheckLoyalty = async () => {
        if (!loyaltyEmail) return;
        setLoyaltyChecking(true);
        try {
            const response = await apiClient.post<any>('/public/loyalty-check', {
                email: loyaltyEmail,
                hotel_id: hotel?.id || hotelSlug,
            });
            setIsLoyaltyChecked(true);
            if (response.points_balance) {
                setLoyaltyBalance(response.points_balance);
            }
            if (response.message) {
                setLoyaltyMessage(response.message);
            }

            // Trigger popups based on response
            if (response.coupon_code) {
                setLoyaltyData({
                    isOpen: true,
                    message: response.message,
                    couponCode: response.coupon_code,
                    discountText: response.discount_text || '',
                });
            } else if (response.show_milestone_popup) {
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

            sessionStorage.setItem('loyalty_checked_guest', JSON.stringify({
                email: loyaltyEmail,
                points_balance: response.points_balance || 0,
                coupon_code: response.coupon_code || null,
                message: response.message || ''
            }));
        } catch (error) {
            console.error('Failed to check loyalty:', error);
        } finally {
            setLoyaltyChecking(false);
        }
    };

    // Filters
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 20000]);
    const [selectedMealPlans, setSelectedMealPlans] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'recommended'>('recommended');
    const [searchType, setSearchType] = useState<'room' | 'package'>('room');

    // Filtered rooms logic
    const filteredRooms = rooms
        .filter(room => {
            const displayRates = (room.rate_options || []).filter(o => {
                if ((searchType as string) === 'package') return !!o.is_package;
                return !o.is_package;
            });
            if (displayRates.length === 0) return false;

            const minPrice = Math.min(...displayRates.map(o => o.total_price || 0));
            const matchesPrice = minPrice <= priceRange[1] || priceRange[1] === 0 || priceRange[1] >= 20000;
            const matchesMeal = selectedMealPlans.length === 0 || displayRates.some(o => selectedMealPlans.includes(o.meal_plan_code || ''));
            return matchesPrice && matchesMeal;
        })
        .sort((a, b) => {
            const getMinPrice = (r: any) => {
                const rates = (r.rate_options || []).filter(o => {
                    if ((searchType as string) === 'package') return !!o.is_package;
                    return !o.is_package;
                });
                return rates.length > 0 ? Math.min(...rates.map((o: any) => o.total_price || 0)) : 0;
            };
            return sortBy === 'price_asc' ? getMinPrice(a) - getMinPrice(b) : getMinPrice(b) - getMinPrice(a);
        });

    // Carousel State
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Auto-slide effect for hero banner
    useEffect(() => {
        if (!hotel?.photos || hotel.photos.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentImageIndex(prev => (prev + 1) % hotel.photos.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [hotel?.photos]);

    const today = new Date();
    const tomorrow = addDays(today, 1);

    const formatCurrency = (amount: number | undefined | null) => {
        if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
        const currencyCode = hotel?.settings?.currency || 'INR';
        const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            maximumFractionDigits: 0
        }).format(amount);
    };

    // Extract params and init state
    // Support both standard and Google Hotel Ads parameters
    const checkIn = searchParams.get('check_in') || searchParams.get('checkin') || format(today, 'yyyy-MM-dd');
    const checkOut = searchParams.get('check_out') || searchParams.get('checkout') || format(tomorrow, 'yyyy-MM-dd');
    const paramGuests = searchParams.get('guests');
    const paramAdults = searchParams.get('adults') || searchParams.get('ad');
    const paramChildren = searchParams.get('children') || searchParams.get('ch');
    const paramRooms = searchParams.get('rooms');
    const urlPromo = searchParams.get('promo_code');

    useEffect(() => {
        const state = location.state as any;
        if (checkIn) setCheckInDate(new Date(checkIn));
        else if (state?.checkInDate) setCheckInDate(new Date(state.checkInDate));

        if (checkOut) setCheckOutDate(new Date(checkOut));
        else if (state?.checkOutDate) setCheckOutDate(new Date(state.checkOutDate));

        if (paramRooms) setRoomsCount(parseInt(paramRooms));
        if (paramAdults) setAdults(parseInt(paramAdults));
        else if (paramGuests && !paramAdults) setAdults(parseInt(paramGuests));

        if (paramChildren) setChildren(parseInt(paramChildren));
        if (urlPromo) setPromoCode(urlPromo);
    }, [checkIn, checkOut, paramGuests, paramAdults, paramChildren, paramRooms, urlPromo, location.state]);

    const handleSearch = () => {
        if (!hotelSlug || !checkInDate || !checkOutDate) return;
        const totalGuests = adults + children;
        const params = new URLSearchParams({
            check_in: format(checkInDate, 'yyyy-MM-dd'),
            check_out: format(checkOutDate, 'yyyy-MM-dd'),
            guests: totalGuests.toString(),
            adults: adults.toString(),
            children: children.toString(),
            rooms: roomsCount.toString(),
            promo_code: promoCode
        });
        navigate(`/book/${hotelSlug}/rooms?${params.toString()}`);
    };

    // Which room_type_ids are currently refreshing their rates (shimmer state)
    const [refreshingRoomIds, setRefreshingRoomIds] = useState<Set<string>>(new Set());
    // Increment to tell RoomSearchHeader calendar to re-fetch month data
    const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);

    // Ref to the current fetchData so SSE can trigger a refresh without stale closures
    const fetchDataRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!hotelSlug || !checkIn || !checkOut) {
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                setLoadError(false);
                // Clear any cached checkout state if we are starting a fresh search
                sessionStorage.removeItem(`checkout_state:${hotelSlug}`);
                const queryGuests = paramGuests || (adults + children).toString() || '1';
                const normalizedCheckIn = checkIn.replace(/\s+/g, '-');
                const normalizedCheckOut = checkOut.replace(/\s+/g, '-');

                const query = new URLSearchParams({
                    check_in: normalizedCheckIn,
                    check_out: normalizedCheckOut,
                    guests: queryGuests,
                    adults: paramAdults || adults.toString(),
                    children: paramChildren || children.toString(),
                    rooms: paramRooms || roomsCount.toString(),
                    promo_code: urlPromo || ''
                }).toString();

                // Rooms + hotel are critical; add-ons are an optional upsell.
                const [roomsData, hotelData] = await Promise.all([
                    apiClient.get<PublicRoomSearchResult[]>(`/public/hotels/${hotelSlug}/rooms?${query}`),
                    apiClient.get<Hotel>(`/public/hotels/${hotelSlug}`)
                ]);

                setRooms(roomsData);
                setHotel(hotelData);

                // Add-ons must never blank the page if their endpoint fails.
                try {
                    const addonsData = await apiClient.get<AddOn[]>(`/public/hotels/${hotelSlug}/addons`);
                    setAddons(addonsData.filter(a => a.is_active !== false));
                } catch (addonErr) {
                    console.error('Failed to fetch add-ons:', addonErr);
                    setAddons([]);
                }

                if (roomsData.length === 0) {
                    try {
                        const recs = await apiClient.get<any[]>(`/public/hotels/${hotelSlug}/recommendations?${query}`);
                        setRecommendations(recs);
                    } catch (err) {
                        console.error('Failed to fetch recommendations:', err);
                        setRecommendations([]);
                    }
                } else {
                    setRecommendations([]);
                }


            } catch (error) {
                console.error('Failed to fetch data:', error);
                setLoadError(true);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDataRef.current = fetchData;
        fetchData();
    }, [hotelSlug, checkIn, checkOut, paramGuests, paramAdults, paramChildren, urlPromo, location.state]);

    /**
     * Surgical rate refresh — called by SSE on price change.
     * Only re-fetches the rooms endpoint and merges price/availability fields.
     * Images, descriptions, amenities are NOT re-fetched (no Supabase calls for them).
     * roomTypeIds=null means "all rooms changed" (bulk op / rate plan change).
     */
    const refreshRatesOnly = useCallback(async (roomTypeIds: string[] | null) => {
        if (!hotelSlug || !checkIn || !checkOut) return;

        const targetIds = roomTypeIds ? new Set(roomTypeIds) : null; // null = all

        // Mark affected rooms as refreshing (shimmer)
        setRefreshingRoomIds(prev => {
            if (targetIds === null) {
                // All rooms — use '__ALL__' sentinel
                return new Set(['__ALL__']);
            }
            const next = new Set(prev);
            targetIds.forEach(id => next.add(id));
            return next;
        });

        try {
            const normalizedCheckIn = checkIn.replace(/\s+/g, '-');
            const normalizedCheckOut = checkOut.replace(/\s+/g, '-');
            const query = new URLSearchParams({
                check_in: normalizedCheckIn,
                check_out: normalizedCheckOut,
                guests: paramGuests || String(adults + children) || '1',
                adults: paramAdults || String(adults),
                children: paramChildren || String(children),
                rooms: paramRooms || String(roomsCount),
                promo_code: urlPromo || '',
            }).toString();

            const freshRooms = await apiClient.get<PublicRoomSearchResult[]>(
                `/public/hotels/${hotelSlug}/rooms?${query}`
            );

            // Merge: update dynamic fields, mark rooms absent from response as sold out
            const freshById = new Map(freshRooms.map(r => [r.id, r]));
            setRooms(prev => prev.map(existing => {
                if (targetIds && !targetIds.has(existing.id)) return existing; // not targeted
                const updated = freshById.get(existing.id);
                if (!updated) {
                    // Room absent from response = sold out — mark it, don't silently keep stale data
                    return { ...existing, available_rooms: 0, rate_options: [] };
                }
                return {
                    ...existing,
                    rate_options: updated.rate_options,
                    available_rooms: updated.available_rooms,
                    price_starting_at: updated.price_starting_at,
                };
            }));
        } catch {
            // silent — guest still sees old price, will reconcile on next poll
        } finally {
            setRefreshingRoomIds(new Set());
        }
    }, [hotelSlug, checkIn, checkOut, paramGuests, adults, children, paramAdults, paramChildren, paramRooms, roomsCount, urlPromo]);

    // SSE subscription: surgically refresh only changed room's rates
    const refreshRatesOnlyRef = useRef(refreshRatesOnly);
    useEffect(() => { refreshRatesOnlyRef.current = refreshRatesOnly; }, [refreshRatesOnly]);

    useEffect(() => {
        if (!hotel?.id) return;
        const es = new EventSource(`${API_BASE_URL}/public/hotels/${hotel.id}/rate-updates`);
        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'rate_update') {
                    // room_type_ids: string[] = specific rooms, null = all rooms
                    refreshRatesOnlyRef.current(data.room_type_ids ?? null);
                    // Also refresh calendar prices (Redis cache cleared by bump_rate_version)
                    setCalendarRefreshTrigger(t => t + 1);
                }
            } catch (_) {
                // ignore parse errors
            }
        };
        es.onerror = () => {
            // SSE errors are non-critical; connection will auto-retry
        };
        return () => es.close();
    }, [hotel?.id]);

    const handleSelectRate = (room: PublicRoomSearchResult, ratePlan: RateOption) => {
        setPendingRoom(room);
        setSelectedRatePlan(ratePlan);
        setSelectedAddons([]);
        setIsAddonSheetOpen(true);
    };

    const toggleAddon = (addon: AddOn) => {
        setSelectedAddons(prev => {
            const exists = prev.find(a => a.id === addon.id);
            if (exists) {
                return prev.filter(a => a.id !== addon.id);
            } else {
                return [...prev, addon];
            }
        });
    };

    const handleProceedToCheckout = () => {
        if (!pendingRoom || !selectedRatePlan) return;

        if (hotel?.settings?.multi_room_cart !== false) {
            const newItem = {
                id: Math.random().toString(36).substring(2, 9),
                room: pendingRoom,
                ratePlan: selectedRatePlan,
                addons: selectedAddons,
                adults,
                children
            };
            setCart(prev => [...prev, newItem]);
            setIsAddonSheetOpen(false);
            setIsCartSheetOpen(true);
            return;
        }

        navigate(`/book/${hotelSlug}/checkout`, {
            state: {
                checkInDate,
                checkOutDate,
                guests: (adults + children).toString() || '1',
                rooms: [{
                    ...pendingRoom,
                    price_per_night: selectedRatePlan.price_per_night,
                    total_price: selectedRatePlan.total_price,
                    rate_plan_id: selectedRatePlan.id,
                    rate_plan_name: selectedRatePlan.name
                }],
                totalRoomPrice: selectedRatePlan.total_price,
                addons: selectedAddons,
                guest_prefill: isLoyaltyChecked ? {
                    email: loyaltyEmail
                } : undefined
            }
        });
    };

    // STAAH Starting Rate Calculation
    const startingRoom = useMemo(() => {
        if (!rooms || rooms.length === 0) return null;
        if (hotel?.settings?.featured_room_type_id && hotel.settings.featured_room_type_id !== 'lowest') {
            const featured = rooms.find(r => r.id === hotel.settings.featured_room_type_id);
            if (featured) return featured;
        }
        let lowestRoom = rooms[0];
        let lowestPrice = Infinity;
        rooms.forEach(r => {
            r.rate_options?.forEach(o => {
                if (o.price_per_night < lowestPrice) {
                    lowestPrice = o.price_per_night;
                    lowestRoom = r;
                }
            });
        });
        return lowestRoom;
    }, [rooms, hotel?.settings?.featured_room_type_id]);

    const startingPrice = (() => {
        if (!startingRoom || !startingRoom.rate_options || startingRoom.rate_options.length === 0) return 0;
        return Math.min(...(startingRoom.rate_options || []).map(o => o.price_per_night));
    })();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 min-h-[600px] bg-slate-50">
                <BookingStepper currentStep={2} />
                <div className="flex flex-col items-center animate-pulse gap-4 mt-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-slate-400 font-medium tracking-wide text-sm uppercase">Checking Availability...</p>
                </div>
            </div>
        );
    }

    // Critical rooms/hotel fetch failed — show a clear, recoverable error instead
    // of a silent blank page (distinct from a genuine "no rooms for these dates").
    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center p-20 min-h-[600px] bg-slate-50">
                <BookingStepper currentStep={2} />
                <div className="flex flex-col items-center gap-4 mt-12 text-center max-w-md">
                    <p className="text-slate-700 font-semibold text-lg">We couldn't load rooms right now</p>
                    <p className="text-slate-500 text-sm">This is usually a temporary connection issue. Please try again.</p>
                    <button
                        onClick={() => fetchDataRef.current?.()}
                        className="mt-2 px-6 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm shadow-sm hover:opacity-90 transition"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const themeColor = hotel?.primary_color || '#7c3aed';
    const grandTotal = (selectedRatePlan?.total_price || 0) + selectedAddons.reduce((sum, a) => sum + a.price, 0);

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20 font-sans">
            <BookingStepper currentStep={2} primaryColor={themeColor} />

            {/* Hero Section */}
            {hotel && hotel.photos && hotel.photos.length > 0 && (
                <div className="w-full h-48 md:h-72 lg:h-[450px] relative overflow-hidden bg-slate-900 group">
                    <AnimatePresence mode="wait">
                        <MotionImg 
                            key={currentImageIndex}
                            src={hotel.photos[currentImageIndex].url} 
                            alt={`${hotel.name} - ${currentImageIndex + 1}`}
                            initial={{ opacity: 0, scale: 1.1 }}
                            animate={{ opacity: 0.8, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    </AnimatePresence>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-6 md:p-12 z-10">
                        <div className="max-w-7xl mx-auto w-full">
                            <MotionDiv initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                                <h1 className="text-3xl md:text-6xl font-black text-white tracking-tight drop-shadow-2xl">{hotel.name}</h1>
                                <div className="flex flex-wrap items-center gap-3 mt-4 text-white/90">
                                    <Badge className="backdrop-blur-md text-white font-bold px-4 py-1.5 shadow-lg" style={{ backgroundColor: `${themeColor}e6`, borderColor: `${themeColor}4d` }}>
                                        {hotel.star_rating} Star Property
                                    </Badge>
                                    {(hotel.amenities || []).slice(0, 3).map((amenity, idx) => {
                                        const Icon = ICONS[amenity.toLowerCase()] || Check;
                                        return (
                                            <span key={idx} className="text-sm font-semibold hidden md:flex items-center gap-2 backdrop-blur-sm bg-black/40 px-4 py-2 rounded-full border border-white/20 shadow-inner">
                                                <Icon className="w-4 h-4 text-white/70" />{amenity}
                                            </span>
                                        );
                                    })}
                                </div>
                            </MotionDiv>
                        </div>
                    </div>

                    {hotel.photos.length > 1 && (
                        <>
                            <button 
                                onClick={() => setCurrentImageIndex(prev => (prev - 1 + hotel.photos.length) % hotel.photos.length)}
                                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-white/20 backdrop-blur-md p-3 rounded-full border border-white/10 text-white transition-all opacity-0 group-hover:opacity-100"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button 
                                onClick={() => setCurrentImageIndex(prev => (prev + 1) % hotel.photos.length)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-white/20 backdrop-blur-md p-3 rounded-full border border-white/10 text-white transition-all opacity-0 group-hover:opacity-100"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                                {hotel.photos.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentImageIndex(idx)}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentImageIndex ? 'w-8' : 'w-2 bg-white/40'}`}
                                        style={idx === currentImageIndex ? { backgroundColor: themeColor } : {}}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="max-w-7xl mx-auto px-3 sm:px-4 mt-4 sm:mt-8">
                {/* Custom Search Header */}
                <RoomSearchHeader
                    searchType={searchType}
                    setSearchType={setSearchType}
                    checkInDate={checkInDate}
                    setCheckInDate={setCheckInDate}
                    checkOutDate={checkOutDate}
                    setCheckOutDate={setCheckOutDate}
                    adults={adults}
                    setAdults={setAdults}
                    children={children}
                    setChildren={setChildren}
                    roomsCount={roomsCount}
                    setRoomsCount={setRoomsCount}
                    promoCode={promoCode}
                    setPromoCode={setPromoCode}
                    isCalendarOpen={isCalendarOpen}
                    setIsCalendarOpen={setIsCalendarOpen}
                    isGuestOpen={isGuestOpen}
                    setIsGuestOpen={setIsGuestOpen}
                    flexibleDates={flexibleDates}
                    setFlexibleDates={setFlexibleDates}
                    themeColor={themeColor}
                    isMobile={isMobile}
                    startingPrice={startingPrice}
                    handleSearch={handleSearch}
                    hotelSlug={hotelSlug}
                    currency={hotel?.settings?.currency || 'INR'}
                    calendarRefreshTrigger={calendarRefreshTrigger}
                />

                {/* Loyalty Program Member Verification Banner */}
                <div className="mb-6 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 flex-shrink-0">
                            <Sparkles className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 tracking-tight text-base">Staybooker Loyalty Program</h3>
                            <p className="text-xs text-slate-500 font-medium">
                                {isLoyaltyChecked 
                                    ? `Welcome back! You have active points available for your stay.` 
                                    : "Enter your email to unlock exclusive member rates & redeem your points."}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {isLoyaltyChecked ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-extrabold px-3 py-1.5 border-0 rounded-full text-xs">
                                    {loyaltyBalance} Points Available
                                </Badge>
                                {loyaltyMessage && (
                                    <span className="text-xs font-bold text-slate-600">{loyaltyMessage}</span>
                                )}
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-slate-400 hover:text-slate-600 font-bold text-xs" 
                                    onClick={() => {
                                        setIsLoyaltyChecked(false);
                                        setLoyaltyEmail('');
                                        setLoyaltyBalance(0);
                                        setLoyaltyMessage('');
                                        sessionStorage.removeItem('loyalty_checked_guest');
                                    }}
                                >
                                    Change
                                </Button>
                            </div>
                        ) : (
                            <div className="flex gap-2 w-full md:w-[320px]">
                                <input
                                    type="email"
                                    placeholder="Enter email address"
                                    value={loyaltyEmail}
                                    onChange={(e) => setLoyaltyEmail(e.target.value)}
                                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-amber-500 font-semibold flex-1"
                                />
                                <Button
                                    size="sm"
                                    className="rounded-xl px-5 font-bold text-white shrink-0 animate-enter"
                                    style={{ backgroundColor: '#f59e0b' }}
                                    onClick={handleCheckLoyalty}
                                    disabled={loyaltyChecking || !loyaltyEmail}
                                >
                                    {loyaltyChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Sidebar Filters */}
                    <div className="lg:col-span-3 space-y-4">
                        <SocialProofWidget hotel={hotel} />
                        <RoomFiltersSort
                            priceRange={priceRange}
                            setPriceRange={setPriceRange}
                            selectedMealPlans={selectedMealPlans}
                            setSelectedMealPlans={setSelectedMealPlans}
                            sortBy={sortBy}
                            setSortBy={setSortBy}
                            searchType={searchType}
                            filteredRoomsCount={filteredRooms.length}
                            isFilterOpen={isFilterOpen}
                            setIsFilterOpen={setIsFilterOpen}
                            themeColor={themeColor}
                        />
                    </div>

                    {/* Room list */}
                    <div className="lg:col-span-9">
                        {/* Results count & Sort section header wrapper (this sits directly above the room list) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                {searchType === 'room' ? (
                                    <>
                                        <div 
                                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: `${themeColor}1a` }}
                                        >
                                            <HotelIcon className="w-4 h-4" style={{ color: themeColor }} />
                                        </div>
                                        {filteredRooms.length} Categories Available
                                    </>
                                ) : (
                                    <>
                                        <div 
                                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: `${themeColor}1a` }}
                                        >
                                            <Sparkles className="w-4 h-4" style={{ color: themeColor }} />
                                        </div>
                                        {filteredRooms.length} Special Offers
                                    </>
                                )}
                            </h2>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-2 shrink-0 max-w-[200px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Sort By</span>
                                <select 
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="bg-transparent text-[13px] font-bold focus:outline-none cursor-pointer w-full text-ellipsis overflow-hidden pr-2"
                                    style={{ color: themeColor }}
                                >
                                    <option value="recommended">Recommended</option>
                                    <option value="price_asc">Price: Low to High</option>
                                    <option value="price_desc">Price: High to Low</option>
                                </select>
                            </div>
                        </div>

                        {filteredRooms.length === 0 ? (
                            <div className="space-y-8">
                                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-slate-100 p-8 text-center shadow-sm">
                                    <h3 className="text-2xl font-bold text-slate-900 mb-3">No availability for these criteria</h3>
                                    <p className="text-slate-500 mb-6">Adjust your dates or filters to search again.</p>
                                    <button 
                                        className="px-6 py-2 text-white rounded-xl font-bold transition-all active:scale-95 shadow-md" 
                                        style={{ backgroundColor: themeColor }}
                                        onClick={() => { setPriceRange([0, 20000]); setSelectedMealPlans([]); }}
                                    >
                                        Clear Filters
                                    </button>
                                </div>
                                {recommendations.length > 0 && (
                                    <div className="bg-gradient-to-br from-indigo-50/40 via-purple-50/20 to-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                <Sparkles className="w-5 h-5 animate-pulse" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-800 tracking-tight">Rooms Sold Out? Sibling Properties are Available</h3>
                                                <p className="text-xs text-slate-500 font-medium">We found these sister properties in the same chain with availability for your dates.</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {recommendations.map((rec) => (
                                                <div key={rec.hotel_id} className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-md transition-all flex flex-col justify-between group">
                                                    <div className="flex gap-4">
                                                        {rec.logo_url ? (
                                                            <img src={rec.logo_url} alt={rec.name} className="w-12 h-12 rounded-xl object-cover border border-slate-100" />
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                                                                <HotelIcon className="w-5 h-5" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <h4 className="font-extrabold text-slate-800 text-[15px] group-hover:text-indigo-600 transition-colors">{rec.name}</h4>
                                                            <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1">
                                                                <MapPin className="w-3.5 h-3.5" /> {rec.city || 'Unknown Location'}
                                                            </p>
                                                            {rec.star_rating && (
                                                                <div className="flex items-center gap-1 mt-1.5">
                                                                    <Badge variant="outline" className="text-[9px] font-bold text-indigo-600 border-indigo-100 bg-indigo-50/30 px-1.5 py-0">
                                                                        {rec.star_rating} Star
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Starting from</span>
                                                            <span className="text-[15px] font-black text-slate-800">{formatCurrency(rec.price_starting_at)}</span>
                                                        </div>
                                                        <Button 
                                                            onClick={() => {
                                                                const queryParams = new URLSearchParams({
                                                                    check_in: checkIn,
                                                                    check_out: checkOut,
                                                                    guests: (adults + children).toString(),
                                                                    adults: adults.toString(),
                                                                    children: children.toString(),
                                                                    rooms: roomsCount.toString(),
                                                                    promo_code: promoCode
                                                                });
                                                                navigate(`/book/${rec.slug}/rooms?${queryParams.toString()}`);
                                                            }}
                                                            className="rounded-xl font-bold text-xs gap-1.5 text-white shadow-sm"
                                                            style={{ backgroundColor: themeColor }}
                                                            size="sm"
                                                        >
                                                            View Rooms
                                                            <ArrowRight className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {searchType === 'package' ? (
                                    Object.values(
                                        rooms.reduce((acc, r) => {
                                            (r.rate_options || []).filter(o => o.is_package).forEach(plan => {
                                                if (!acc[plan.name] || plan.total_price < acc[plan.name].plan.total_price) {
                                                    acc[plan.name] = { room: r, plan };
                                                }
                                            });
                                            return acc;
                                        }, {} as Record<string, { room: any, plan: any }>)
                                    ).map(({ room, plan }) => (
                                        <PackageCard
                                            key={plan.id}
                                            room={room}
                                            plan={plan}
                                            formatCurrency={formatCurrency}
                                            themeColor={themeColor}
                                            handleSelectRate={handleSelectRate}
                                            setSelectedRoom={setSelectedRoom}
                                            setIsModalOpen={setIsModalOpen}
                                            getImageUrl={getImageUrl}
                                        />
                                    ))
                                ) : (
                                    filteredRooms.map((room) => {
                                        const roomFilteredRates = (room.rate_options || []).filter(o => {
                                            if (o.is_package) return false;
                                            const matchesPrice = (o.total_price || 0) <= priceRange[1] || priceRange[1] === 0 || priceRange[1] >= 20000;
                                            const matchesMeal = selectedMealPlans.length === 0 || selectedMealPlans.includes(o.meal_plan_code || '');
                                            return matchesPrice && matchesMeal;
                                        });

                                        return (
                                            <RoomCard
                                                key={room.id}
                                                room={room}
                                                filteredRates={roomFilteredRates}
                                                formatCurrency={formatCurrency}
                                                themeColor={themeColor}
                                                handleSelectRate={handleSelectRate}
                                                setSelectedRoom={setSelectedRoom}
                                                setIsModalOpen={setIsModalOpen}
                                                getImageUrl={getImageUrl}
                                                isRefreshing={
                                                    refreshingRoomIds.has(room.id) ||
                                                    refreshingRoomIds.has('__ALL__')
                                                }
                                            />
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Room Detail Modal */}
            <RoomDetailModal
                room={selectedRoom}
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                onBook={handleSelectRate}
                guests={(adults + children).toString() || '1'}
            />

            {/* Enhancements Add-on Sheet */}
            <Sheet open={isAddonSheetOpen} onOpenChange={setIsAddonSheetOpen}>
                <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-slate-50">
                    <SheetHeader className="p-6 border-b bg-white">
                        <SheetTitle className="text-xl font-bold flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-indigo-500" />
                            Enhance Your Stay
                        </SheetTitle>
                        <SheetDescription>
                            Select optional experiences & activities to customize your stay.
                        </SheetDescription>
                    </SheetHeader>
                    
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                        {addons.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                    <Sparkles className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-slate-800 font-bold mb-1">No Extras Available</h3>
                                <p className="text-sm text-slate-500 max-w-[250px]">We don't have any optional experiences or activities available for this selection right now.</p>
                            </div>
                        ) : (
                            addons.map((addon) => {
                                const isSelected = selectedAddons.some(a => a.id === addon.id);
                                return (
                                    <div
                                        key={addon.id}
                                        className={cn(
                                            "group relative flex flex-col sm:flex-row items-stretch gap-4 p-3 rounded-2xl border transition-all cursor-pointer overflow-hidden",
                                            isSelected 
                                                ? "border-indigo-500 bg-indigo-50/20 shadow-[0_4px_20px_rgba(99,102,241,0.12)]" 
                                                : "border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md"
                                        )}
                                        onClick={() => toggleAddon(addon)}
                                    >
                                        {/* Selection Indicator Background */}
                                        <div className={cn(
                                            "absolute inset-0 bg-indigo-50/50 transition-opacity duration-300 pointer-events-none",
                                            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                                        )} />
                                        
                                        {/* Add-on Image if available, otherwise a premium placeholder */}
                                        <div className="relative w-full sm:w-28 h-32 sm:h-auto shrink-0 rounded-xl overflow-hidden bg-slate-100 shadow-sm z-10">
                                            {addon.image_url ? (
                                                <img 
                                                    src={addon.image_url} 
                                                    alt={addon.name}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-300 transition-transform duration-500 group-hover:scale-105">
                                                    <Sparkles className="w-8 h-8 opacity-50 mb-1" />
                                                </div>
                                            )}
                                            {/* Price Badge over Image */}
                                            <div className="absolute bottom-2 right-2 sm:hidden bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-sm">
                                                <span className="text-xs font-black text-indigo-700">{formatCurrency(addon.price)}</span>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex flex-col justify-center relative z-10 py-1 pr-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold bg-white text-slate-500 border-slate-200 px-1.5 py-0">
                                                            {addon.category || 'Enhancement'}
                                                        </Badge>
                                                    </div>
                                                    <h4 className="font-extrabold text-slate-800 text-[15px] leading-tight group-hover:text-indigo-700 transition-colors">{addon.name}</h4>
                                                </div>
                                                
                                                {/* Checkbox / Plus Icon */}
                                                <div className="shrink-0 mt-1">
                                                    <div className={cn(
                                                        "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm",
                                                        isSelected 
                                                            ? "bg-indigo-600 text-white shadow-indigo-200" 
                                                            : "bg-white border-2 border-slate-200 text-slate-400 group-hover:border-indigo-300 group-hover:text-indigo-400"
                                                    )}>
                                                        {isSelected ? <Check className="w-3.5 h-3.5" /> : <span className="text-lg leading-none font-light mb-[2px]">+</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {addon.description && (
                                                <p className="text-[12px] text-slate-500 mt-2 leading-relaxed line-clamp-2">
                                                    {addon.description}
                                                </p>
                                            )}
                                            
                                            <div className="mt-3 pt-3 border-t border-slate-100/60 hidden sm:flex items-center justify-between">
                                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Additional</span>
                                                <span className="text-[14px] font-black text-indigo-600">{formatCurrency(addon.price)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    
                    <SheetFooter className="p-6 border-t bg-white">
                        <Button
                            className="w-full h-14 text-base font-bold rounded-xl gap-2 text-white shadow-lg"
                            style={{ backgroundColor: themeColor }}
                            onClick={handleProceedToCheckout}
                        >
                            Proceed to {hotel?.settings?.multi_room_cart !== false ? 'Cart' : 'Checkout'}
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <BookingCartSheet
                cart={cart}
                setCart={setCart}
                isCartSheetOpen={isCartSheetOpen}
                setIsCartSheetOpen={setIsCartSheetOpen}
                themeColor={themeColor}
                formatCurrency={formatCurrency}
                navigate={navigate}
                hotelSlug={hotelSlug || ''}
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                adults={adults}
                children={children}
                hotel={hotel}
            />

            <RateSelectDialog
                isRateModalOpen={isRateModalOpen}
                setIsRateModalOpen={setIsRateModalOpen}
                selectedRateInfo={selectedRateInfo}
                defaultCancellationPolicy={hotel?.settings?.cancellation_policy}
            />

            {/* Loyalty Reward Popup — coupon unlocked */}
            <LoyaltyRewardPopup
                isOpen={loyaltyData.isOpen}
                onClose={() => setLoyaltyData(prev => ({ ...prev, isOpen: false }))}
                message={loyaltyData.message}
                couponCode={loyaltyData.couponCode}
                discountText={loyaltyData.discountText}
                onApply={() => applyLoyaltyCoupon(loyaltyData.couponCode)}
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

            {/* Stay-offer Nudge Popup — extend nights to unlock a reward */}
            <StayOfferPopup
                isOpen={stayOffer.isOpen}
                onClose={() => setStayOffer(prev => ({ ...prev, isOpen: false }))}
                title={stayOffer.title}
                nudgeTitle={stayOffer.nudgeTitle}
                nudgeMessage={stayOffer.nudgeMessage}
                rewardLabel={stayOffer.rewardLabel}
                currentNights={stayOffer.currentNights}
                minNights={stayOffer.minNights}
                onExtend={() => {
                    setStayOffer(prev => ({ ...prev, isOpen: false }));
                    setIsCalendarOpen(true);
                }}
            />

            <ChatWidget hotelSlug={hotelSlug || ''} bottomOffset={cart.length > 0 ? "bottom-24" : "bottom-4"} />
        </div>
    );
}
