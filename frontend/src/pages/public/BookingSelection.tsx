import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, User, Wifi, Calendar as CalendarIcon, Search, ShoppingBag, Plus, Minus, Check, ArrowRight, BedDouble, Utensils, Info, Tv, Coffee, Snowflake, Waves, Dumbbell, Car, Star, Bed, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/api/client';
import { PublicRoomSearchResult, RateOption, AddOn, Hotel } from '@/types/api';
import { RoomDetailModal } from '@/components/public/RoomDetailModal';
import { BookingStepper } from '@/components/public/BookingStepper'; // New Component
import { SocialProofWidget } from '@/components/public/SocialProofWidget';
import { ChatWidget } from '@/components/public/ChatWidget';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays } from 'date-fns';
import { cn, getImageUrl } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

export default function BookingSelection() {
    const { hotelSlug } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [rooms, setRooms] = useState<PublicRoomSearchResult[]>([]);
    const [addons, setAddons] = useState<AddOn[]>([]);
    const [hotel, setHotel] = useState<Hotel | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState<PublicRoomSearchResult | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRateInfo, setSelectedRateInfo] = useState<RateOption | null>(null);
    const [isRateModalOpen, setIsRateModalOpen] = useState(false);

    // Icon Mapping (Should theoretically be shared but duplicating for speed)
    const ICONS: Record<string, any> = {
        wifi: Wifi,
        tv: Tv,
        coffee: Coffee,
        snowflake: Snowflake,
        waves: Waves,
        dumbbell: Dumbbell,
        car: Car,
        utensils: Utensils,
        star: Star
    };

    // Addon Sheet State
    const [isAddonSheetOpen, setIsAddonSheetOpen] = useState(false);
    const [selectedRatePlan, setSelectedRatePlan] = useState<RateOption | null>(null);
    const [selectedAddons, setSelectedAddons] = useState<AddOn[]>([]);
    const [pendingRoom, setPendingRoom] = useState<PublicRoomSearchResult | null>(null);

    // Search State
    const [checkInDate, setCheckInDate] = useState<Date | undefined>(undefined);
    const [checkOutDate, setCheckOutDate] = useState<Date | undefined>(undefined);
    // const [guestCount, setGuestCount] = useState('2'); // Deprecated
    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);
    const [promoCode, setPromoCode] = useState('');
    
    // Filters
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 20000]);
    const [selectedMealPlans, setSelectedMealPlans] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'recommended'>('recommended');
    const [searchType, setSearchType] = useState<'room' | 'package'>('room');

    // Carousel State
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Auto-slide effect
    useEffect(() => {
        if (!hotel?.photos || hotel.photos.length <= 1) return;
        
        const timer = setInterval(() => {
            setCurrentImageIndex(prev => (prev + 1) % hotel.photos.length);
        }, 5000);
        
        return () => clearInterval(timer);
    }, [hotel?.photos]);



    const location = useLocation();

    // Default to Today/Tomorrow if no params
    const today = new Date();
    const tomorrow = addDays(today, 1);

    const formatCurrency = (amount: number) => {
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
    const urlPromo = searchParams.get('promo_code');

    useEffect(() => {
        // Fallback to location state if URL params are missing
        const state = location.state as any;

        if (checkIn) setCheckInDate(new Date(checkIn));
        else if (state?.checkInDate) setCheckInDate(new Date(state.checkInDate));

        if (checkOut) setCheckOutDate(new Date(checkOut));
        else if (state?.checkOutDate) setCheckOutDate(new Date(state.checkOutDate));

        // Smart Guest Logic
        if (paramAdults) setAdults(parseInt(paramAdults));
        else if (paramGuests && !paramAdults) setAdults(parseInt(paramGuests)); // Fallback if only 'guests' param exists

        if (paramChildren) setChildren(parseInt(paramChildren));

        if (urlPromo) setPromoCode(urlPromo);
    }, [checkIn, checkOut, paramGuests, paramAdults, paramChildren, urlPromo, location.state]);

    const handleSearch = () => {
        if (!hotelSlug || !checkInDate || !checkOutDate) return;
        const totalGuests = adults + children;

        const params = new URLSearchParams({
            check_in: format(checkInDate, 'yyyy-MM-dd'),
            check_out: format(checkOutDate, 'yyyy-MM-dd'),
            guests: totalGuests.toString(),
            adults: adults.toString(),
            children: children.toString(),
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

                const query = new URLSearchParams({
                    check_in: checkIn,
                    check_out: checkOut,
                    guests: queryGuests,
                    adults: paramAdults || adults.toString(),
                    children: paramChildren || children.toString(),
                    promo_code: urlPromo || ''
                }).toString();

                const [roomsData, addonsData, hotelData] = await Promise.all([
                    apiClient.get<PublicRoomSearchResult[]>(`/public/hotels/${hotelSlug}/rooms?${query}`),
                    apiClient.get<AddOn[]>(`/public/hotels/${hotelSlug}/addons`),
                    apiClient.get<Hotel>(`/public/hotels/${hotelSlug}`)
                ]);

                setRooms(roomsData);
                setAddons(addonsData.filter(a => a.is_active !== false));
                setHotel(hotelData);
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


    // Calculate number of nights
    const numNights = checkInDate && checkOutDate
        ? Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 1;

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

    const grandTotal = (selectedRatePlan?.total_price || 0) + selectedAddons.reduce((sum, a) => sum + a.price, 0);

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20 font-sans">
            {/* 1. Header with Stepper */}
            <BookingStepper currentStep={2} />

            {/* 2. Property Hero/Banner Slider */}
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

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-6 md:p-12 z-10">
                        <div className="max-w-7xl mx-auto w-full">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <h1 className="text-3xl md:text-6xl font-black text-white tracking-tight drop-shadow-2xl">
                                    {hotel.name}
                                </h1>
                                <div className="flex flex-wrap items-center gap-3 mt-4 text-white/90">
                                    <Badge className="bg-indigo-600/90 backdrop-blur-md border-indigo-400/30 text-white font-bold px-4 py-1.5 shadow-lg">
                                        {hotel.star_rating} Star Property
                                    </Badge>
                                    {(hotel.amenities || []).slice(0, 3).map((amenity, idx) => {
                                        const Icon = ICONS[amenity.toLowerCase()] || Check;
                                        return (
                                            <span key={idx} className="text-sm font-semibold hidden md:flex items-center gap-2 backdrop-blur-sm bg-black/40 px-4 py-2 rounded-full border border-white/20 shadow-inner">
                                                <Icon className="w-4 h-4 text-indigo-400" /> {amenity}
                                            </span>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    {/* Slider Navigation */}
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

                            {/* Dots Indicator */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                                {hotel.photos.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentImageIndex(idx)}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentImageIndex ? 'w-8 bg-indigo-500' : 'w-2 bg-white/40'}`}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 mt-8">
                {/* Inline Search Modifier (Always Visible) */}
                <div id="search-bar" className="bg-white border border-slate-200 p-4 lg:p-6 rounded-xl shadow-sm mb-8 relative">
                    {/* Room/Package Toggle */}
                    <div className="absolute -top-12 right-0 flex bg-white border border-slate-200 p-1 rounded-full shadow-sm">
                        <button
                            onClick={() => setSearchType('room')}
                            className={cn(
                                "px-6 py-2 rounded-full text-sm font-bold transition-all",
                                searchType === 'room' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            Room
                        </button>
                        <button
                            onClick={() => setSearchType('package')}
                            className={cn(
                                "px-6 py-2 rounded-full text-sm font-bold transition-all",
                                searchType === 'package' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            Package
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        {/* Check In */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Check In</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-semibold h-12 border-slate-200 bg-slate-50/50">
                                        <CalendarIcon className="mr-2 h-4 w-4 text-indigo-600" />
                                        {checkInDate ? format(checkInDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={checkInDate} onSelect={setCheckInDate} initialFocus disabled={(date) => date < new Date()} />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Check Out */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Check Out</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-semibold h-12 border-slate-200 bg-slate-50/50">
                                        <CalendarIcon className="mr-2 h-4 w-4 text-indigo-600" />
                                        {checkOutDate ? format(checkOutDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={checkOutDate} onSelect={setCheckOutDate} initialFocus disabled={(date) => date <= (checkInDate || new Date())} />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Guests - Smart Selector */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Guests</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-semibold h-12 border-slate-200 bg-slate-50/50 px-3">
                                        <div className="flex items-center">
                                            <User className="mr-2 h-4 w-4 text-indigo-600" />
                                            <span>{adults} Adult, {children} Child</span>
                                        </div>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-4 bg-white border-slate-100 shadow-xl rounded-xl" align="center">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-sm text-slate-900">Adults</p>
                                                <p className="text-xs text-slate-500">Ages 13+</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setAdults(Math.max(1, adults - 1))} disabled={adults <= 1}>
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-4 text-center text-sm font-semibold">{adults}</span>
                                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setAdults(Math.min(10, adults + 1))}>
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="h-px bg-slate-100" />
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-sm text-slate-900">Children</p>
                                                <p className="text-xs text-slate-500">Ages 0-12</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setChildren(Math.max(0, children - 1))} disabled={children <= 0}>
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-4 text-center text-sm font-semibold">{children}</span>
                                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setChildren(Math.min(6, children + 1))}>
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Update Button */}
                        <Button size="lg" className="h-12 w-full font-bold shadow-md bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSearch}>
                            Update Search
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Sidebar: Social Proof & Filters */}
                    <div className="lg:col-span-3 space-y-6">
                        <SocialProofWidget hotel={hotel} />
                        
                        {/* Filters Card */}
                        <Card className="p-5 border-slate-200 shadow-sm rounded-xl bg-white sticky top-24">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Search className="w-4 h-4 text-indigo-600" /> Filter Rooms
                            </h3>
                            
                            <div className="space-y-6">
                                {/* Price Filter */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Price Range</label>
                                    <div className="px-2">
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="20000" 
                                            step="500"
                                            value={priceRange[1]}
                                            onChange={(e) => setPriceRange([0, parseInt(e.target.value)])}
                                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                        <div className="flex justify-between mt-2 text-xs font-bold text-slate-600">
                                            <span>₹0</span>
                                            <span>Up to ₹{priceRange[1].toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Meal Plan Filter */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Meal Plan</label>
                                    <div className="space-y-2">
                                        {['EP', 'CP', 'MAP', 'AP'].map(plan => (
                                            <label key={plan} className="flex items-center gap-3 cursor-pointer group">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedMealPlans.includes(plan)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedMealPlans([...selectedMealPlans, plan]);
                                                        else setSelectedMealPlans(selectedMealPlans.filter(p => p !== plan));
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-sm font-medium text-slate-600 group-hover:text-indigo-600 transition-colors">
                                                    {plan === 'EP' ? 'Room Only (EP)' : 
                                                     plan === 'CP' ? 'With Breakfast (CP)' :
                                                     plan === 'MAP' ? 'Half Board (MAP)' : 'Full Board (AP)'}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            <Button 
                                variant="ghost" 
                                className="w-full mt-6 text-xs font-bold text-slate-400 hover:text-red-500"
                                onClick={() => {
                                    setPriceRange([0, 20000]);
                                    setSelectedMealPlans([]);
                                }}
                            >
                                Reset All Filters
                            </Button>
                        </Card>
                    </div>

                    {/* Right Side: Room List */}
                    <div className="lg:col-span-9">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-slate-900">
                                {searchType === 'package' 
                                    ? `${rooms.reduce((acc, r) => acc + r.rate_options.filter(o => o.is_package).length, 0)} Packages Found`
                                    : `${rooms.length} Rooms Found`
                                }
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400 uppercase">Sort By:</span>
                                <select 
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="bg-transparent text-sm font-bold text-indigo-600 focus:outline-none cursor-pointer"
                                >
                                    <option value="recommended">Recommended</option>
                                    <option value="price_asc">Price: Low to High</option>
                                    <option value="price_desc">Price: High to Low</option>
                                </select>
                            </div>
                        </div>

                        {rooms.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <Search className="w-6 h-6 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">No {searchType === 'package' ? 'packages' : 'rooms'} match your filters</h3>
                                <p className="text-slate-500">Try adjusting your filters or search dates.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {searchType === 'package' ? (
                                    // Flattened Package View
                                    rooms.flatMap(room => 
                                        room.rate_options
                                            .filter(o => o.is_package)
                                            .map(plan => ({ room, plan }))
                                    ).map(({ room, plan }) => (
                                        <div key={plan.id} className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col md:flex-row mb-6 hover:shadow-md transition-shadow group">
                                            {/* Left: Image Carousel */}
                                            <div className="md:w-80 md:min-w-[20rem] h-64 md:h-auto bg-slate-100 relative group">
                                                <RoomImageCarousel photos={room.photos} roomName={room.name} onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }} />
                                                <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                                                    <Badge className="bg-amber-500 text-white border-0 rounded-md shadow-lg font-black px-3 py-1 uppercase text-[10px] tracking-widest">
                                                        Special Package
                                                    </Badge>
                                                </div>
                                            </div>

                                            {/* Right: Content */}
                                            <div className="flex-1 flex flex-col">
                                                <div className="p-5 border-b border-slate-100 bg-amber-50/20 flex justify-between items-start">
                                                    <div>
                                                        <h3 className="text-xl font-black text-slate-900 hover:text-amber-600 transition-colors cursor-pointer flex items-center gap-2" onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }}>
                                                            {plan.name}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Valid for: {room.name}</span>
                                                            <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                                            <div className="flex items-center gap-1 text-[10px] font-black text-slate-500">
                                                                <User className="h-3 w-3" /> {room.max_occupancy} Max
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="text-amber-600 font-bold text-xs hover:bg-amber-50"
                                                        onClick={() => { setSelectedRateInfo(plan); setIsRateModalOpen(true); }}
                                                    >
                                                        Package Details
                                                    </Button>
                                                </div>

                                                <div className="p-5 flex-1 flex flex-col justify-between">
                                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">What's Included</p>
                                                            <div className="space-y-1.5">
                                                                {(plan.inclusions || []).slice(0, 3).map((inc, i) => (
                                                                    <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                                                        <Check className="w-3.5 h-3.5 text-green-500" /> {inc}
                                                                    </div>
                                                                ))}
                                                                {(plan.inclusions || []).length > 3 && (
                                                                    <p className="text-[10px] text-indigo-600 font-bold ml-5">+{plan.inclusions.length - 3} more benefits</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Room Features</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {(room.amenities || []).slice(0, 4).map((am: any, i) => {
                                                                    const Icon = ICONS[am.icon_slug || am.icon] || Wifi;
                                                                    return (
                                                                        <div key={i} className="bg-slate-50 p-1.5 rounded-lg border border-slate-100" title={am.name}>
                                                                            <Icon className="w-3.5 h-3.5 text-slate-400" />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
                                                        <div className="text-left">
                                                            <div className="text-[10px] font-bold text-slate-400 mb-0.5 line-through decoration-red-400/50">
                                                                {formatCurrency(plan.price_per_night * 1.2)} / night
                                                            </div>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-3xl font-black text-slate-900 leading-none">
                                                                    {formatCurrency(plan.total_price)}
                                                                </span>
                                                                <span className="text-xs font-bold text-indigo-600">Total</span>
                                                            </div>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-tighter italic">Limited time package deal</p>
                                                        </div>

                                                        <Button
                                                            className="bg-amber-500 hover:bg-amber-600 text-white font-black px-8 shadow-md rounded-xl h-12 transition-all active:scale-95 group-hover:scale-105"
                                                            onClick={() => handleSelectRate(room, plan)}
                                                        >
                                                            BOOK PACKAGE
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    // Standard Room View
                                    rooms
                                        .filter(room => {
                                            const minPrice = Math.min(...room.rate_options.map(o => o.total_price));
                                            const matchesPrice = minPrice <= priceRange[1];
                                            const matchesMeal = selectedMealPlans.length === 0 || 
                                                room.rate_options.some(o => selectedMealPlans.includes(o.meal_plan_code || ''));
                                            return matchesPrice && matchesMeal;
                                        })
                                        .sort((a, b) => {
                                            const aPrice = Math.min(...a.rate_options.map(o => o.total_price));
                                            const bPrice = Math.min(...b.rate_options.map(o => o.total_price));
                                            if (sortBy === 'price_asc') return aPrice - bPrice;
                                            if (sortBy === 'price_desc') return bPrice - aPrice;
                                            return 0;
                                        })
                                        .map((room) => {
                                            // Filter rate options to NOT show packages in standard room view
                                            const filteredRates = room.rate_options.filter(o => !o.is_package);
                                            if (filteredRates.length === 0) return null;
                                            
                                            return (
                                            <div key={room.id} className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col md:flex-row mb-6 hover:shadow-md transition-shadow">
                                                {/* Left: Image Carousel (Fixed Width) */}
                                                <div className="md:w-80 md:min-w-[20rem] h-64 md:h-auto bg-slate-100 relative group">
                                                    <RoomImageCarousel photos={room.photos} roomName={room.name} onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }} />
                                                    <div className="absolute top-2 left-2 z-10">
                                                        <Badge className="bg-indigo-600/90 text-white border-0 rounded-md shadow-lg">
                                                            {room.name || 'Standard'}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                {/* Right: Content */}
                                                <div className="flex-1 flex flex-col">
                                                    {/* Room Header Info */}
                                                    <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex justify-between items-start">
                                                        <div>
                                                            <h3 className="text-xl font-black text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-2" onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }}>
                                                                {room.name}
                                                            </h3>
                                                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tighter">Instant Confirmation Available</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-slate-600">
                                                            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm" title="Occupancy">
                                                                <User className="h-3.5 w-3.5 text-indigo-500" />
                                                                <span className="text-xs font-black">{room.max_occupancy}</span>
                                                            </div>
                                                            {room.room_size && (
                                                                <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                                                                    <Waves className="h-3.5 w-3.5 text-indigo-500" />
                                                                    <span className="text-xs font-black">{room.room_size} ft²</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Rate Plans List */}
                                                    <div className="divide-y divide-slate-100">
                                                        {filteredRates.map((plan) => (
                                                            <div key={plan.id} className="p-5 hover:bg-slate-50/50 transition-colors grid grid-cols-1 md:grid-cols-12 gap-4 items-center group/plan">
                                                                <div className="md:col-span-8 space-y-1.5">
                                                                    <div className="font-black text-slate-800 flex items-center gap-2">
                                                                        <div className={cn(
                                                                            "w-2 h-2 rounded-full",
                                                                            plan.meal_plan_code === 'EP' ? 'bg-slate-300' : 'bg-green-500 animate-pulse'
                                                                        )} />
                                                                        {plan.name}
                                                                        {plan.is_package && (
                                                                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] py-0 px-2 h-5 font-black uppercase shadow-sm">
                                                                                Package
                                                                            </Badge>
                                                                        )}
                                                                        <button 
                                                                            className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider hover:bg-indigo-100 transition-colors"
                                                                            onClick={() => { setSelectedRateInfo(plan); setIsRateModalOpen(true); }}
                                                                        >
                                                                            Details
                                                                        </button>
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-3">
                                                                        {(plan.inclusions || []).map((inclusion, idx) => (
                                                                            <div key={idx} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                                                                <Check className="w-3.5 h-3.5 text-green-500" /> {inclusion}
                                                                            </div>
                                                                        ))}
                                                                        {plan.cancellation_policy && (
                                                                            <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                                                                <Info className="w-3 h-3" /> {plan.cancellation_policy}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="md:col-span-4 flex items-center justify-end gap-5">
                                                                    <div className="text-right">
                                                                        <div className="text-[10px] font-bold text-slate-400 mb-0.5">
                                                                            {formatCurrency(plan.price_per_night)} / night
                                                                        </div>
                                                                        <div className="flex items-baseline justify-end gap-1">
                                                                            <span className="text-2xl font-black text-slate-900 leading-none">
                                                                                {formatCurrency(plan.total_price)}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[10px] font-bold text-indigo-600 uppercase mt-1 tracking-tighter">Total for {numNights} Night{numNights > 1 ? 's' : ''}</p>
                                                                    </div>

                                                                    <Button
                                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 shadow-md rounded-xl h-11 min-w-[100px] transition-all active:scale-95"
                                                                        onClick={() => handleSelectRate(room, plan)}
                                                                    >
                                                                        BOOK
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Room Detail Modal (Preserved) */}
            <RoomDetailModal
                room={selectedRoom}
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                onBook={handleSelectRate}
                guests={(adults + children).toString() || '1'}
            />

            {/* Add-on Sidebar (Sheet) */}
            <Sheet open={isAddonSheetOpen} onOpenChange={setIsAddonSheetOpen}>
                <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col border-l shadow-2xl">
                    <SheetHeader className="p-6 border-b bg-slate-50">
                        <Badge className="w-fit mb-2 bg-slate-200 text-slate-700 hover:bg-slate-300 border-0">Step 3 of 4</Badge>
                        <SheetTitle className="text-xl font-bold text-slate-900">Enhance Your Stay</SheetTitle>
                        <SheetDescription>Optional extras for {pendingRoom?.name}</SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {addons.length === 0 ? (
                            <div className="text-center py-10 space-y-2">
                                <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
                                <p className="text-slate-500">No add-ons available.</p>
                            </div>
                        ) : (
                            addons.map((addon) => {
                                const isSelected = selectedAddons.some(a => a.id === addon.id);
                                return (
                                    <div
                                        key={addon.id}
                                        className={cn(
                                            "flex gap-4 p-4 rounded-lg border cursor-pointer transition-all",
                                            isSelected ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/30"
                                        )}
                                        onClick={() => toggleAddon(addon)}
                                    >
                                        <div className="w-16 h-16 bg-slate-100 rounded-md overflow-hidden shrink-0">
                                            {addon.image_url ? (
                                                <img src={getImageUrl(addon.image_url)} className="w-full h-full object-cover" />
                                            ) : (
                                                <ShoppingBag className="w-6 h-6 m-auto mt-5 text-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between font-bold text-slate-900">
                                                <span>{addon.name}</span>
                                                <span>₹{addon.price}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-2 mt-1">{addon.description}</p>
                                            {isSelected ? (
                                                <div className="mt-2 text-xs font-bold text-primary flex items-center"><Check className="w-3 h-3 mr-1" /> Added</div>
                                            ) : (
                                                <div className="mt-2 text-xs font-bold text-slate-400 flex items-center"><Plus className="w-3 h-3 mr-1" /> Add</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <SheetFooter className="p-6 border-t bg-white flex-col gap-4">
                        <div className="flex justify-between items-end">
                            <div className="text-sm">
                                <p className="text-slate-500">Room Total</p>
                                <p className="font-bold">{formatCurrency(selectedRatePlan?.total_price)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-slate-400 text-xs uppercase font-bold">Grand Total</p>
                                <p className="text-2xl font-bold text-slate-900">{formatCurrency(grandTotal)}</p>
                            </div>
                        </div>
                        <Button size="lg" className="w-full font-bold text-lg" onClick={handleProceedToCheckout}>
                            Confirm & Checkout <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
            {/* Rate Info Dialog */}
            <Dialog open={isRateModalOpen} onOpenChange={setIsRateModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedRateInfo?.name}</DialogTitle>
                        <DialogDescription>
                            Rate plan details and policies.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-sm mb-2">Inclusions</h4>
                            <ul className="list-disc pl-5 text-sm space-y-1">
                                {selectedRateInfo?.inclusions?.map((inc, idx) => (
                                    <li key={idx}>{inc}</li>
                                )) || <li>Room Only</li>}
                            </ul>
                        </div>
                        <div className="bg-slate-50 p-3 rounded text-sm text-slate-600">
                            <strong>Cancellation Policy:</strong><br />
                            {selectedRateInfo?.cancellation_policy || hotel?.settings?.cancellation_policy || "Standard cancellation policy applies."}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* AI Chat Widget */}
            <ChatWidget hotelSlug={hotelSlug || ''} />
        </div>
    );
}

// --- Component: RoomImageCarousel ---
function RoomImageCarousel({ photos, roomName, onClick }: { photos: any[], roomName: string, onClick: () => void }) {
    const [index, setIndex] = useState(0);

    if (!photos || photos.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center flex-col text-slate-400 p-4 text-center" onClick={onClick}>
                <Bed className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-xs">No Photos Available</span>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.img
                    key={index}
                    src={photos[index].url}
                    alt={`${roomName} - ${index + 1}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={onClick}
                />
            </AnimatePresence>

            {photos.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIndex(prev => (prev - 1 + photos.length) % photos.length); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/20 hover:bg-black/40 p-1.5 rounded-full text-white transition-all opacity-0 group-hover:opacity-100"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIndex(prev => (prev + 1) % photos.length); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/20 hover:bg-black/40 p-1.5 rounded-full text-white transition-all opacity-0 group-hover:opacity-100"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>

                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
                        {photos.map((_, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "h-1 rounded-full transition-all duration-300",
                                    idx === index ? "w-4 bg-white" : "w-1 bg-white/50"
                                )}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
