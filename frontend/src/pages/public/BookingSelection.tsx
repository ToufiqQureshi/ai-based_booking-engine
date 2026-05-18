import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, User, Wifi, Calendar as CalendarIcon, Search, ShoppingBag, Plus, Minus, Check, ArrowRight, BedDouble, Utensils, Info, Tv, Coffee, Snowflake, Waves, Dumbbell, Car, Star, Bed, ChevronLeft, ChevronRight, Sparkles, Gift, Hotel as HotelIcon, Maximize, ChevronDown, Trash2, X } from 'lucide-react';
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

    // Cart State (STAAH Multi-Room Booking)
    interface CartItem {
        id: string;
        room: PublicRoomSearchResult;
        ratePlan: RateOption;
        addons: AddOn[];
        adults: number;
        children: number;
    }
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);

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

    // Filtered rooms logic
    const filteredRooms = rooms
        .filter(room => {
            const relevantRates = room.rate_options.filter(o => {
                if ((searchType as string) === 'package') return !!o.is_package;
                return !o.is_package;
            });
            
            const displayRates = relevantRates.length > 0 ? relevantRates : room.rate_options;
            if (displayRates.length === 0) return false;

            const minPrice = Math.min(...displayRates.map(o => o.total_price || 0));
            const matchesPrice = minPrice <= priceRange[1] || priceRange[1] === 0 || priceRange[1] >= 20000;
            const matchesMeal = selectedMealPlans.length === 0 || displayRates.some(o => selectedMealPlans.includes(o.meal_plan_code || ''));
                
            return matchesPrice && matchesMeal;
        })
        .sort((a, b) => {
            const getMinPrice = (r: any) => {
                const rates = r.rate_options;
                return rates.length > 0 ? Math.min(...rates.map((o: any) => o.total_price || 0)) : 0;
            };
            return sortBy === 'price_asc' ? getMinPrice(a) - getMinPrice(b) : getMinPrice(b) - getMinPrice(a);
        });

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

                // Normalize dates to handle potential spaces from URL
                const normalizedCheckIn = checkIn.replace(/\s+/g, '-');
                const normalizedCheckOut = checkOut.replace(/\s+/g, '-');

                const query = new URLSearchParams({
                    check_in: normalizedCheckIn,
                    check_out: normalizedCheckOut,
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
        return Math.min(...startingRoom.rate_options.map(o => o.price_per_night));
    })();


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
                <div id="search-bar" className="bg-white border border-slate-200 p-6 lg:p-8 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.03)] mb-10 relative transition-all duration-300">
                    {/* STAAH Starting Rate Banner */}
                    {startingRoom && startingPrice > 0 && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-black px-6 py-2 rounded-full shadow-lg flex items-center gap-2 tracking-wide uppercase border border-white/20 animate-bounce">
                            <Sparkles className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300 shrink-0" />
                            <span className="truncate">STAAH Best Rate Guarantee: Starting from ₹{startingPrice.toLocaleString('en-IN')}/night for {startingRoom.name}</span>
                        </div>
                    )}
                    {/* Premium Room/Package Switch */}
                    <div className="flex justify-center mb-8">
                        <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50 backdrop-blur-sm">
                            <button
                                onClick={() => setSearchType('room')}
                                className={cn(
                                    "px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2",
                                    searchType === 'room' ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <HotelIcon className="w-3.5 h-3.5" />
                                Room Categories
                            </button>
                            <button
                                onClick={() => setSearchType('package')}
                                className={cn(
                                    "px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2",
                                    searchType === 'package' ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Special Packages
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        {/* Check In */}
                        <div className="md:col-span-3 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Arrival Date</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-bold h-14 border-slate-200 bg-slate-50/30 rounded-2xl hover:bg-white hover:border-blue-200 transition-all">
                                        <CalendarIcon className="mr-3 h-5 w-5 text-blue-600" />
                                        {checkInDate ? format(checkInDate, "MMM dd, yyyy") : <span>Select Date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-slate-100" align="start">
                                    <Calendar mode="single" selected={checkInDate} onSelect={setCheckInDate} initialFocus disabled={(date) => date < new Date()} />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Check Out */}
                        <div className="md:col-span-3 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Departure Date</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-bold h-14 border-slate-200 bg-slate-50/30 rounded-2xl hover:bg-white hover:border-blue-200 transition-all">
                                        <CalendarIcon className="mr-3 h-5 w-5 text-blue-600" />
                                        {checkOutDate ? format(checkOutDate, "MMM dd, yyyy") : <span>Select Date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-slate-100" align="start">
                                    <Calendar mode="single" selected={checkOutDate} onSelect={setCheckOutDate} initialFocus disabled={(date) => date <= (checkInDate || new Date())} />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Guests */}
                        <div className="md:col-span-3 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Guest Configuration</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-bold h-14 border-slate-200 bg-slate-50/30 rounded-2xl px-4 hover:bg-white hover:border-blue-200 transition-all">
                                        <div className="flex items-center">
                                            <User className="mr-3 h-5 w-5 text-blue-600" />
                                            <span>{adults} {adults === 1 ? 'Adult' : 'Adults'}{children > 0 && `, ${children} ${children === 1 ? 'Child' : 'Children'}`}</span>
                                        </div>
                                        <ChevronDown className="h-4 w-4 text-slate-300" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-6 bg-white border-slate-100 shadow-2xl rounded-3xl" align="center">
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm text-slate-900">Adults</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ages 13+</p>
                                            </div>
                                            <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all" onClick={() => setAdults(Math.max(1, adults - 1))} disabled={adults <= 1}>
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-4 text-center text-sm font-black text-slate-900">{adults}</span>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all" onClick={() => setAdults(Math.min(10, adults + 1))}>
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="h-px bg-slate-50" />
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm text-slate-900">Children</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ages 0-12</p>
                                            </div>
                                            <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all" onClick={() => setChildren(Math.max(0, children - 1))} disabled={children <= 0}>
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-4 text-center text-sm font-black text-slate-900">{children}</span>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all" onClick={() => setChildren(Math.min(6, children + 1))}>
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Update Button */}
                        <div className="md:col-span-3">
                            <Button 
                                size="lg" 
                                className="h-14 w-full font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex gap-3 transition-all active:scale-[0.98]" 
                                onClick={handleSearch}
                            >
                                <Search className="w-4 h-4" />
                                Check Availability
                            </Button>
                        </div>
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
                        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                {searchType === 'room' ? (
                                    <>
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                            <HotelIcon className="w-4 h-4 text-blue-600" />
                                        </div>
                                        {filteredRooms.length} Categories Available
                                    </>
                                ) : (
                                    <>
                                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                                            <Sparkles className="w-4 h-4 text-amber-500" />
                                        </div>
                                        {filteredRooms.length} Special Offers
                                    </>
                                )}
                            </h2>
                            <div className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort By</span>
                                <select 
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="bg-transparent text-xs font-bold text-blue-700 focus:outline-none cursor-pointer"
                                >
                                    <option value="recommended">Recommended</option>
                                    <option value="price_asc">Price: Low to High</option>
                                    <option value="price_desc">Price: High to Low</option>
                                </select>
                            </div>
                        </div>

                        {filteredRooms.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] px-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 relative">
                                    <div className="absolute inset-0 bg-blue-100/50 rounded-full animate-ping opacity-20" />
                                    <Search className="w-10 h-10 text-slate-300 relative" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">No availability for these criteria</h3>
                                <p className="text-slate-500 max-w-md mx-auto mb-10 font-medium leading-relaxed">
                                    We couldn't find any {searchType === 'package' ? 'packages' : 'rooms'} matching your current search. Try adjusting your dates or resetting filters to see more options.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Button 
                                        variant="outline" 
                                        className="rounded-xl px-10 font-bold text-slate-500 h-14 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                                        onClick={() => {
                                            setPriceRange([0, 20000]);
                                            setSelectedMealPlans([]);
                                        }}
                                    >
                                        Clear All Filters
                                    </Button>
                                    <Button 
                                        className="rounded-xl px-10 font-bold bg-blue-600 hover:bg-blue-700 text-white h-14 shadow-xl shadow-blue-100 flex gap-2 transition-all active:scale-95"
                                        onClick={() => {
                                            const searchElement = document.getElementById('search-bar');
                                            if (searchElement) {
                                                searchElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                searchElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-8');
                                                setTimeout(() => searchElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-8'), 2000);
                                            }
                                        }}
                                    >
                                        <CalendarIcon className="w-4 h-4" />
                                        Modify Search Dates
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {searchType === 'package' ? (
                                    // Professional Grouped Package View
                                    Object.values(
                                        rooms.reduce((acc, room) => {
                                            room.rate_options
                                                .filter(o => o.is_package)
                                                .forEach(plan => {
                                                    // Only keep the cheapest room option for each unique package name
                                                    if (!acc[plan.name] || plan.total_price < acc[plan.name].plan.total_price) {
                                                        acc[plan.name] = { room, plan };
                                                    }
                                                });
                                            return acc;
                                        }, {} as Record<string, { room: any, plan: any }>)
                                    ).map(({ room, plan }) => (
                                        <div key={plan.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex flex-col md:flex-row mb-8 hover:shadow-xl transition-all duration-300 group border-l-4 border-l-amber-500">
                                            {/* Left: Premium Image Section */}
                                            <div className="md:w-[400px] h-72 md:h-auto bg-slate-100 relative overflow-hidden">
                                                <RoomImageCarousel photos={room.photos} roomName={room.name} onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }} />
                                                <div className="absolute top-4 left-4 z-10">
                                                    <div className="bg-amber-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                                                        <Sparkles className="w-3 h-3" /> Exclusive Offer
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Detailed Package Content */}
                                            <div className="flex-1 flex flex-col p-6 md:p-8">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="space-y-1">
                                                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 group-hover:text-amber-600 transition-colors">
                                                            {plan.name}
                                                        </h3>
                                                        <p className="text-sm font-bold text-slate-500 flex items-center gap-2">
                                                            <Bed className="w-4 h-4 text-amber-500" /> 
                                                            Available for {room.name} and more
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 px-3 py-1 rounded-lg font-bold">
                                                        Limited Time
                                                    </Badge>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                                    <div className="space-y-4">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                            <Gift className="w-3 h-3" /> Package Inclusions
                                                        </p>
                                                        <div className="grid grid-cols-1 gap-2.5">
                                                            {(plan.inclusions || []).map((inc, i) => (
                                                                <div key={i} className="flex items-center gap-3 text-sm font-bold text-slate-600">
                                                                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                                                        <Check className="w-3 h-3 text-green-600" />
                                                                    </div>
                                                                    {inc}
                                                                </div>
                                                            ))}
                                                            {(!plan.inclusions || plan.inclusions.length === 0) && (
                                                                <div className="flex items-center gap-3 text-sm font-bold text-slate-500 italic">
                                                                    <Info className="w-4 h-4" /> Standard inclusions apply
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Why Book This?</p>
                                                        <ul className="space-y-2.5">
                                                            <li className="text-xs font-bold text-slate-600 flex items-start gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1" />
                                                                Best price guaranteed for this package
                                                            </li>
                                                            <li className="text-xs font-bold text-slate-600 flex items-start gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1" />
                                                                Flexible modification available
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>

                                                <div className="mt-auto pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                                                    <div className="text-center sm:text-left">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Starting From</p>
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-4xl font-black text-slate-900 leading-none">
                                                                {formatCurrency(plan.total_price)}
                                                            </span>
                                                            <span className="text-sm font-bold text-slate-500">/ stay</span>
                                                        </div>
                                                        <p className="text-[10px] font-black text-green-600 uppercase mt-2 bg-green-50 px-2 py-0.5 rounded-md inline-block">
                                                            Includes all taxes & fees
                                                        </p>
                                                    </div>

                                                    <div className="flex gap-3 w-full sm:w-auto">
                                                        <Button 
                                                            variant="outline"
                                                            className="flex-1 sm:flex-none border-slate-200 font-bold hover:bg-slate-50 rounded-xl"
                                                            onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }}
                                                        >
                                                            View Details
                                                        </Button>
                                                        <Button
                                                            className="flex-1 sm:flex-none bg-slate-900 hover:bg-black text-white font-black px-10 shadow-xl rounded-xl h-14 transition-all active:scale-95"
                                                            onClick={() => handleSelectRate(room, plan)}
                                                        >
                                                            BOOK NOW
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    // Standard Room View
                                    filteredRooms.map((room) => {
                                        const filteredRates = room.rate_options.filter(o => {
                                                if ((searchType as string) === 'package') return !!o.is_package;
                                                return !o.is_package;
                                            });
                                            
                                            const displayRates = filteredRates.length > 0 ? filteredRates : room.rate_options;

                                            return (
                                                <div key={room.id} className="bg-white rounded-xl overflow-hidden mb-8 border border-slate-200 hover:border-indigo-100 transition-all duration-300 group">
                                                    <div className="flex flex-col lg:flex-row">
                                                        {/* Visual Section */}
                                                        <div className="lg:w-[35%] h-64 lg:h-auto bg-slate-50 relative overflow-hidden">
                                                            <RoomImageCarousel photos={room.photos} roomName={room.name} onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }} />
                                                            <div className="absolute top-6 left-6 z-10">
                                                                <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm flex items-center gap-2 border border-white/50">
                                                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Available</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Content Section: Minimalist & Clean */}
                                                        <div className="flex-1 flex flex-col p-5 lg:p-6">
                                                            {/* Header Area */}
                                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-4">
                                                                <div className="space-y-0.5">
                                                                    <h3 className="text-lg font-bold text-slate-800 tracking-tight leading-snug group-hover:text-indigo-600 transition-colors duration-200">
                                                                        {room.name}
                                                                    </h3>
                                                                    <div className="flex items-center gap-3 text-slate-500 text-[11px] font-medium">
                                                                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {room.max_occupancy} Adults</span>
                                                                        <span className="text-slate-300">•</span>
                                                                        <span className="flex items-center gap-1"><Maximize className="w-3 h-3" /> {room.room_size || '---'} ft²</span>
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    className="text-indigo-600 font-semibold text-xs hover:underline transition-all"
                                                                    onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }}
                                                                >
                                                                    Room Details
                                                                </button>
                                                            </div>

                                                            {/* Amenities: Minimal & Gray */}
                                                            <div className="flex flex-wrap gap-x-4 gap-y-2 mb-6">
                                                                {(room.amenities || []).slice(0, 4).map((am: any, i) => {
                                                                    const Icon = ICONS[am.icon_slug || am.icon] || Wifi;
                                                                    return (
                                                                        <div key={i} className="flex items-center gap-1.5" title={am.name}>
                                                                            <Icon className="w-3 h-3 text-slate-400" />
                                                                            <span className="text-[11px] text-slate-500">{am.name}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* Rates: Clean List Style */}
                                                            <div className="border-t border-slate-100 mt-auto pt-4 space-y-3">
                                                                {displayRates.map((plan, idx) => (
                                                                    <div 
                                                                        key={plan.id} 
                                                                        className="flex items-center justify-between group/rate py-2"
                                                                    >
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-sm font-semibold text-slate-700">{plan.name}</span>
                                                                                {plan.savings_text && (
                                                                                    <span className="text-[10px] font-bold text-green-600">
                                                                                        {plan.savings_text}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex gap-3 mt-0.5">
                                                                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{plan.meal_plan_code}</span>
                                                                                {plan.is_refundable ? (
                                                                                    <span className="text-[10px] text-emerald-600 font-medium">
                                                                                        {plan.cancellation_policy || 'Free Cancellation'}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-[10px] text-rose-600 font-medium">Non-Refundable</span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-5">
                                                                            <div className="text-right">
                                                                                <div className="flex items-baseline justify-end gap-1">
                                                                                    <span className="text-lg font-bold text-slate-900">
                                                                                        {formatCurrency(plan.total_price)}
                                                                                    </span>
                                                                                    <span className="text-[10px] text-slate-400 font-medium">total</span>
                                                                                </div>
                                                                                {(plan.market_price || room.market_price) && (
                                                                                    <p className="text-[10px] text-slate-300 line-through">
                                                                                        {formatCurrency(plan.market_price || room.market_price || 0)}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            <Button 
                                                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 h-9 rounded-lg shadow-sm transition-all active:scale-95"
                                                                                onClick={() => handleSelectRate(room, plan)}
                                                                            >
                                                                                Select
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                )}
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
                        <Button size="lg" className="w-full font-bold text-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 rounded-2xl h-14" onClick={handleProceedToCheckout}>
                            {hotel?.settings?.multi_room_cart !== false ? "Add to Stay Cart & Continue" : "Confirm & Checkout"} <ArrowRight className="ml-2 w-5 h-5" />
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

            {/* STAAH Multi-Room Floating Bottom Bar */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 text-white py-4 px-6 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] animate-slide-up">
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                                <ShoppingBag className="w-6 h-6 animate-pulse" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-lg">{cart.length} {cart.length === 1 ? 'Room' : 'Rooms'} Selected</span>
                                    <Badge className="bg-indigo-500 text-white font-bold px-2 py-0.5 text-xs border-0">Multi-Room Cart</Badge>
                                </div>
                                <p className="text-xs text-white/70 font-medium line-clamp-1">
                                    {cart.map(c => `${c.room.name} (${c.ratePlan.name})`).join(' + ')}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right hidden sm:block">
                                <span className="text-[10px] uppercase font-black tracking-wider text-white/60 block">Estimated Total</span>
                                <span className="text-xl font-black text-yellow-300">₹{cart.reduce((s, item) => s + item.ratePlan.total_price + item.addons.reduce((as, a) => as + a.price, 0), 0).toLocaleString('en-IN')}</span>
                            </div>
                            <Button 
                                onClick={() => setIsCartSheetOpen(true)}
                                className="h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl px-6 text-base shadow-lg shadow-indigo-600/30 gap-2"
                            >
                                <span>View Cart ({cart.length})</span>
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* STAAH Multi-Room Cart Sheet Drawer */}
            <Sheet open={isCartSheetOpen} onOpenChange={setIsCartSheetOpen}>
                <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col border-l shadow-2xl bg-slate-50 z-50">
                    <SheetHeader className="p-6 border-b bg-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="w-5 h-5 text-indigo-600" />
                                <SheetTitle className="text-xl font-bold text-slate-900">Your Booking Cart</SheetTitle>
                            </div>
                            <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-0 font-bold">{cart.length} {cart.length === 1 ? 'Item' : 'Items'}</Badge>
                        </div>
                        <SheetDescription className="text-xs text-slate-500 mt-1">Review and manage all selected rooms and packages before secure checkout.</SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {cart.length === 0 ? (
                            <div className="text-center py-16 space-y-3">
                                <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto text-indigo-400">
                                    <ShoppingBag className="w-8 h-8" />
                                </div>
                                <p className="font-bold text-slate-700 text-base">Your booking cart is empty</p>
                                <p className="text-xs text-slate-400 max-w-xs mx-auto">Select a room and rate plan from the list to start building your multi-room stay.</p>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <div key={item.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm relative group space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h4 className="font-black text-slate-900 text-base">{item.room.name}</h4>
                                            <Badge className="mt-1 bg-slate-100 text-slate-700 border-0 text-[11px] font-semibold">{item.ratePlan.name}</Badge>
                                        </div>
                                        <button
                                            onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))}
                                            className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                            title="Remove room"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs">
                                        <div>
                                            <span className="text-slate-400 block font-medium">Guests</span>
                                            <span className="font-bold text-slate-700">{item.adults} Adults{item.children > 0 ? `, ${item.children} Children` : ''}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-slate-400 block font-medium">Room Total</span>
                                            <span className="font-bold text-slate-900">₹{item.ratePlan.total_price.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>

                                    {item.addons.length > 0 && (
                                        <div className="text-xs border-t pt-2 space-y-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Add-ons</span>
                                            {item.addons.map(a => (
                                                <div key={a.id} className="flex justify-between text-slate-600">
                                                    <span>• {a.name}</span>
                                                    <span className="font-semibold text-slate-800">₹{a.price.toLocaleString('en-IN')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {cart.length > 0 && (
                        <SheetFooter className="p-6 border-t bg-white flex-col gap-4">
                            <div className="flex justify-between items-end">
                                <div className="text-sm">
                                    <p className="text-slate-500 font-medium">Total for {cart.length} {cart.length === 1 ? 'Room' : 'Rooms'}</p>
                                    <p className="text-xs text-green-600 font-bold">Taxes & fees included</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Grand Total</p>
                                    <p className="text-3xl font-black text-indigo-600">
                                        ₹{cart.reduce((s, item) => s + item.ratePlan.total_price + item.addons.reduce((as, a) => as + a.price, 0), 0).toLocaleString('en-IN')}
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Button 
                                    variant="outline" 
                                    size="lg" 
                                    className="font-bold text-slate-700 rounded-2xl h-14" 
                                    onClick={() => setIsCartSheetOpen(false)}
                                >
                                    + Add More Rooms
                                </Button>
                                <Button 
                                    size="lg" 
                                    className="font-black text-base bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/30 rounded-2xl h-14" 
                                    onClick={() => {
                                        setIsCartSheetOpen(false);
                                        navigate(`/book/${hotelSlug}/checkout`, {
                                            state: {
                                                checkInDate: checkInDate || new Date(),
                                                checkOutDate: checkOutDate || addDays(new Date(), 1),
                                                guests: (adults + children).toString() || '1',
                                                rooms: cart.map(item => ({
                                                    ...item.room,
                                                    price_per_night: item.ratePlan.price_per_night,
                                                    total_price: item.ratePlan.total_price,
                                                    rate_plan_id: item.ratePlan.id,
                                                    rate_plan_name: item.ratePlan.name
                                                })),
                                                addons: cart.flatMap(item => item.addons),
                                                totalRoomPrice: cart.reduce((sum, item) => sum + item.ratePlan.total_price, 0)
                                            }
                                        });
                                    }}
                                >
                                    Proceed to Secure Checkout <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </div>
                        </SheetFooter>
                    )}
                </SheetContent>
            </Sheet>

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
