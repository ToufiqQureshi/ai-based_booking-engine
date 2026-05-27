import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ChevronLeft, ChevronRight, Check, ShoppingBag, X, ArrowRight, Sparkles, Hotel as HotelIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import { apiClient } from '@/api/client';
import { cn } from '@/lib/utils';
import { PublicRoomSearchResult, RateOption, AddOn, Hotel } from '@/types/api';
import { RoomDetailModal } from '@/components/public/RoomDetailModal';
import { BookingStepper } from '@/components/public/BookingStepper';
import { SocialProofWidget } from '@/components/public/SocialProofWidget';
import { ChatWidget } from '@/components/public/ChatWidget';
import { format, addDays } from 'date-fns';
import { getImageUrl } from '@/lib/utils';
import { ICONS } from '@/lib/amenityIcons';

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
    const [selectedRoom, setSelectedRoom] = useState<PublicRoomSearchResult | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRateInfo, setSelectedRateInfo] = useState<RateOption | null>(null);
    const [isRateModalOpen, setIsRateModalOpen] = useState(false);

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

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

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
    const checkIn = searchParams.get('check_in') || format(today, 'yyyy-MM-dd');
    const checkOut = searchParams.get('check_out') || format(tomorrow, 'yyyy-MM-dd');
    const paramGuests = searchParams.get('guests');
    const paramAdults = searchParams.get('adults');
    const paramChildren = searchParams.get('children');
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

    useEffect(() => {
        const fetchData = async () => {
            if (!hotelSlug || !checkIn || !checkOut) {
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
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

                // --- 5-min sessionStorage cache ---
                const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms
                const cacheKey = `booking_cache:${hotelSlug}:${query}`;
                const hotelCacheKey = `booking_hotel:${hotelSlug}`;
                const addonsCacheKey = `booking_addons:${hotelSlug}`;

                const cachedRooms = sessionStorage.getItem(cacheKey);
                const cachedHotel = sessionStorage.getItem(hotelCacheKey);
                const cachedAddons = sessionStorage.getItem(addonsCacheKey);

                // Only cache room availability search, keep hotel settings and addons fresh
                if (cachedRooms) {
                    try {
                        const parsedRooms = JSON.parse(cachedRooms);
                        const roomsFresh = Date.now() - (parsedRooms._cachedAt || 0) < CACHE_TTL;

                        if (roomsFresh) {
                            setRooms(parsedRooms.data);
                            // Fetch hotel details and addons fresh to ensure settings (taxes, policies) are in sync
                            const [addonsData, hotelData] = await Promise.all([
                                apiClient.get<AddOn[]>(`/public/hotels/${hotelSlug}/addons`),
                                apiClient.get<Hotel>(`/public/hotels/${hotelSlug}`)
                            ]);
                            setHotel(hotelData);
                            setAddons((addonsData || []).filter((a: any) => a.is_active !== false));
                            setIsLoading(false);
                            return;
                        }
                    } catch {
                        // Corrupted cache — continue to fetch fresh
                    }
                }
                // --- End cache check ---

                const [roomsData, addonsData, hotelData] = await Promise.all([
                    apiClient.get<PublicRoomSearchResult[]>(`/public/hotels/${hotelSlug}/rooms?${query}`),
                    apiClient.get<AddOn[]>(`/public/hotels/${hotelSlug}/addons`),
                    apiClient.get<Hotel>(`/public/hotels/${hotelSlug}`)
                ]);

                setRooms(roomsData);
                setAddons(addonsData.filter(a => a.is_active !== false));
                setHotel(hotelData);

                // --- Save to sessionStorage cache ---
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({ data: roomsData, _cachedAt: Date.now() }));
                    sessionStorage.setItem(hotelCacheKey, JSON.stringify({ data: hotelData, _cachedAt: Date.now() }));
                    sessionStorage.setItem(addonsCacheKey, JSON.stringify({ data: addonsData, _cachedAt: Date.now() }));
                } catch {
                    // sessionStorage full — silently ignore
                }
                // --- End cache save ---

            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [hotelSlug, checkIn, checkOut, paramGuests, paramAdults, paramChildren, urlPromo, location.state]);

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
                addons: selectedAddons
            }
        });
    };

    // STAAH Starting Rate Calculation
    const startingRoom = (() => {
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
    })();

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

    const themeColor = hotel?.primary_color || '#7c3aed';
    const grandTotal = (selectedRatePlan?.total_price || 0) + selectedAddons.reduce((sum, a) => sum + a.price, 0);

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20 font-sans">
            <BookingStepper currentStep={2} primaryColor={themeColor} />

            {/* Hero Section */}
            {hotel && hotel.photos && hotel.photos.length > 0 && (
                <div className="w-full h-48 md:h-72 lg:h-[450px] relative overflow-hidden bg-slate-900 group">
                    <AnimatePresence mode="wait">
                        <motion.img 
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
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
                            </motion.div>
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
                />

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
                            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-slate-100 p-8 text-center">
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

            <ChatWidget hotelSlug={hotelSlug || ''} bottomOffset={cart.length > 0 ? "bottom-24" : "bottom-4"} />
        </div>
    );
}
