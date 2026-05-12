import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, User, Wifi, Calendar as CalendarIcon, Search, ShoppingBag, Plus, Minus, Check, ArrowRight, BedDouble, Utensils, Info, Tv, Coffee, Snowflake, Waves, Dumbbell, Car, Star, Bed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/api/client';
import { PublicRoomSearchResult, RateOption, AddOn, Hotel } from '@/types/api';
import { RoomDetailModal } from '@/components/public/RoomDetailModal';
import { BookingStepper } from '@/components/public/BookingStepper'; // New Component
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
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



    const location = useLocation();

    // Default to Today/Tomorrow if no params
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

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

    const formatCurrency = (amount: number | undefined | null) => {
        if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
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

            {/* 2. Property Hero/Banner */}
            {hotel && hotel.photos && hotel.photos.length > 0 && (
                <div className="w-full h-48 md:h-72 lg:h-[400px] relative overflow-hidden bg-slate-900 group">
                    <img 
                        src={hotel.photos.find(p => p.is_primary)?.url || hotel.photos[0].url} 
                        alt={hotel.name}
                        className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-[20s] ease-linear"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6 md:p-12">
                        <div className="max-w-7xl mx-auto w-full">
                            <h1 className="text-2xl md:text-5xl font-black text-white tracking-tight drop-shadow-xl">{hotel.name}</h1>
                            <div className="flex items-center gap-3 mt-4 text-white/90">
                                <Badge className="bg-white/20 backdrop-blur-md border-white/30 text-white font-bold px-3">
                                    {hotel.star_rating} Star Property
                                </Badge>
                                <span className="text-sm font-medium hidden md:flex items-center gap-1.5 backdrop-blur-sm bg-black/20 px-3 py-1 rounded-full border border-white/10">
                                    <Car className="w-3.5 h-3.5" /> Free Parking
                                </span>
                                <span className="text-sm font-medium hidden md:flex items-center gap-1.5 backdrop-blur-sm bg-black/20 px-3 py-1 rounded-full border border-white/10">
                                    <Wifi className="w-3.5 h-3.5" /> High Speed Wi-Fi
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 mt-8">
                {/* Inline Search Modifier (Always Visible) */}
                {/* Inline Search Modifier (Always Visible) */}
                <div id="search-bar" className="bg-white border border-slate-200 p-4 lg:p-6 rounded-xl shadow-sm mb-8">
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

                {rooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-md border border-slate-200">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <Search className="w-6 h-6 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">
                            {(!checkInDate || !checkOutDate) ? "Select Dates" : "No rooms available"}
                        </h3>
                        <p className="text-slate-500 mb-6">
                            {(!checkInDate || !checkOutDate) ? "Please select check-in and check-out dates." : "Try changing your dates."}
                        </p>
                        <Button variant="outline" onClick={() => document.getElementById('search-bar')?.scrollIntoView()}>Modify Search</Button>
                    </div>
                ) : (
                    <div className="space-y-6">



                        {/* Room List (STAAH Style) */}
                        {rooms.map((room) => (
                            <div key={room.id} className="bg-white border border-slate-200 shadow-sm rounded-md overflow-hidden flex flex-col md:flex-row mb-6">
                                {/* Left: Image (Fixed Width) */}
                                <div className="md:w-72 md:min-w-[18rem] bg-slate-100 relative group cursor-pointer" onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }}>
                                    {room.photos && room.photos.length > 0 ? (
                                        <img src={room.photos[0].url} alt={room.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center flex-col text-slate-400 p-4 text-center">
                                            <Bed className="w-8 h-8 mb-2 opacity-50" />
                                            <span className="text-xs">No Photos</span>
                                        </div>
                                    )}
                                    <div className="absolute bottom-2 left-2">
                                        <Badge variant="secondary" className="bg-black/60 text-white hover:bg-black/70 backdrop-blur border-0 rounded-sm px-2 text-[10px] h-6">
                                            {room.name}
                                        </Badge>
                                    </div>
                                    {/* Hover overlay hint */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <Button size="sm" variant="secondary" className="shadow-lg">View Photos</Button>
                                    </div>
                                </div>

                                {/* Right: Content */}
                                <div className="flex-1 flex flex-col">
                                    {/* Room Header Info */}
                                    <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-bold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-2" onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }}>
                                                    {room.name} <span className="text-xs font-normal text-slate-400 underline underline-offset-2">More Info ↗</span>
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-600">
                                            <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm" title="Occupancy">
                                                <User className="h-3 w-3" />
                                                <span className="text-xs font-bold">{room.base_occupancy}-{room.max_occupancy}</span>
                                            </div>
                                            {room.room_size ? (
                                                <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">
                                                    <div className="text-xs font-bold whitespace-nowrap">{room.room_size} sq ft</div>
                                                </div>
                                            ) : null}
                                            {room.bed_type && (
                                                <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">
                                                    <BedDouble className="h-3 w-3" />
                                                    <span className="text-xs font-bold">{room.bed_type}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Rate Plans List */}
                                    <div className="divide-y divide-slate-100">
                                        {(room.rate_options || []).map((plan) => {
                                            return (
                                                <div key={plan.id} className="p-4 hover:bg-slate-50 transition-colors grid grid-cols-1 md:grid-cols-12 gap-4 items-center group/plan">
                                                    {/* Plan Info (Left) */}
                                                    <div className="md:col-span-8 space-y-1">
                                                        <div className="font-bold text-slate-800 flex items-center gap-2">

                                                            {plan.meal_plan_code === 'EP' && <Bed className="w-4 h-4 text-slate-400" />}
                                                            {plan.meal_plan_code === 'CP' && <Coffee className="w-4 h-4 text-orange-500" />}
                                                            {plan.meal_plan_code === 'MAP' && <Utensils className="w-4 h-4 text-green-600" />}
                                                            {plan.meal_plan_code === 'AP' && <Utensils className="w-4 h-4 text-blue-600" />}
                                                            {plan.name}
                                                            <span
                                                                className="text-xs font-normal text-blue-600 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded cursor-pointer hover:underline flex items-center gap-1 transition-colors"
                                                                title="Click for rate policies"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedRateInfo(plan);
                                                                    setIsRateModalOpen(true);
                                                                }}
                                                            >
                                                                More Info ↗
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-slate-600 flex items-center gap-2">
                                                            {/* Show inclusions text directly if any, or generic */}
                                                            {plan.inclusions && plan.inclusions.length > 0 ? plan.inclusions.join(", ") : "Standard Rate"}
                                                        </div>

                                                        {/* Tags */}
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {plan.savings_text ? (
                                                                <div className="inline-flex items-center bg-red-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm relative shadow-sm">
                                                                    <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-r-[4px] border-r-red-600 border-b-[4px] border-b-transparent"></span>
                                                                    Weekday Discount | Save {plan.savings_text}
                                                                </div>
                                                            ) : (
                                                                <div className="inline-flex items-center bg-green-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm">
                                                                    Best Value
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>



                                                    {/* Right (Price & Button) */}
                                                    <div className="md:col-span-4 flex items-center justify-end gap-4">
                                                        <div className="text-right">
                                                            {plan.savings_text && (
                                                                <div className="text-xs text-slate-400 line-through decoration-slate-400 decoration-1 mb-0.5">
                                                                    {formatCurrency(plan.total_price * 1.15)}
                                                                </div>
                                                            )}
                                                            <div className="flex items-baseline justify-end gap-1">
                                                                <span className="text-xs text-slate-500 font-medium uppercase">INR</span>
                                                                <span className="text-xl font-bold text-slate-900">{new Intl.NumberFormat('en-IN').format(plan.total_price)}</span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-500">Rate for {numNights} Night{numNights > 1 ? 's' : ''}</div>
                                                            <div className="text-[10px] text-slate-400">Excludes Taxes & Fees</div>
                                                        </div>

                                                        <Button
                                                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 shadow-sm rounded-sm h-10 w-24"
                                                            onClick={() => handleSelectRate(room, plan)}
                                                        >
                                                            Book
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
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
                            Free cancellation up to 24 hours before check-in. Late cancellations or no-shows will be charged the first night's rate.
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
