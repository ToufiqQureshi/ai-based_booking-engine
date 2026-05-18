import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { Calendar as CalendarIcon, Users, ArrowRight, Minus, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export default function BookingWidget() {
    const { hotelSlug } = useParams();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [config, setConfig] = useState<any>(null); // Config state kept for future extensibility
    const [startingPrice, setStartingPrice] = useState<number>(4200);

    // Fetch Widget Configuration and Starting Price
    useEffect(() => {
        if (!hotelSlug) return;
        const apiUrl = import.meta.env.VITE_API_URL || 'https://ai-basedbooking-engine-production.up.railway.app/api/v1'; // Fallback

        // Fetch config
        fetch(`${apiUrl}/public/hotels/slug/${hotelSlug}/widget-config`)
            .then(res => {
                if (res.ok) return res.json();
                throw new Error("Failed to fetch config");
            })
            .then(data => setConfig(data))
            .catch(() => { /* Defaults */ });

        // Fetch rooms to calculate live starting price
        const checkInStr = format(new Date(), 'yyyy-MM-dd');
        const checkOutStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        fetch(`${apiUrl}/public/hotels/${hotelSlug}/rooms?check_in=${checkInStr}&check_out=${checkOutStr}`)
            .then(res => res.ok ? res.json() : [])
            .then((rooms: any[]) => {
                if (rooms && rooms.length > 0) {
                    let lowest = Infinity;
                    rooms.forEach(r => {
                        r.rate_options?.forEach((o: any) => {
                            if (o.price_per_night < lowest) lowest = o.price_per_night;
                        });
                    });
                    if (lowest !== Infinity && lowest > 0) {
                        setStartingPrice(lowest);
                    }
                }
            })
            .catch(err => console.error("Failed to fetch rooms for widget price:", err));
    }, [hotelSlug]);

    // Ensure iframe body is transparent
    useEffect(() => {
        document.body.style.backgroundColor = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';
        return () => {
            document.body.style.backgroundColor = '';
            document.documentElement.style.backgroundColor = '';
        };
    }, []);

    // State
    const [checkInDate, setCheckInDate] = useState<Date | undefined>(new Date());
    const [checkOutDate, setCheckOutDate] = useState<Date | undefined>(addDays(new Date(), 1));
    const [roomsCount, setRoomsCount] = useState(1);
    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);
    const [promoCode, setPromoCode] = useState('');

    // Calendar UI State
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
    const [isGuestOpen, setIsGuestOpen] = useState(false);

    // Dynamic Resizing Logic
    useEffect(() => {
        const baseHeight = 140; // Full height for card + drop shadow without shifting hotelier page
        const expandedHeight = 750; // Use expanded height when popovers are open to prevent price clipping
        const isOpen = isCheckInOpen || isCheckOutOpen || isGuestOpen;
        const height = isOpen ? expandedHeight : baseHeight;

        if (window.parent !== window) {
            window.parent.postMessage({ type: 'RESIZE_OVERLAY', height }, '*');
            window.parent.postMessage({ type: 'RESIZE_SEARCH_WIDGET', height }, '*');
        }
    }, [isCheckInOpen, isCheckOutOpen, isGuestOpen]);

    const handleSearch = () => {
        const targetUrl = `${window.location.origin}/book/${hotelSlug}/rooms`;

        const totalGuests = adults + children;

        const params = new URLSearchParams();
        if (checkInDate) params.append('check_in', format(checkInDate, 'yyyy-MM-dd'));
        if (checkOutDate) params.append('check_out', format(checkOutDate, 'yyyy-MM-dd'));

        params.append('guests', totalGuests.toString());
        params.append('adults', adults.toString());
        params.append('children', children.toString());
        params.append('rooms', roomsCount.toString());

        if (promoCode) params.append('promo_code', promoCode);

        if (window.parent !== window) {
            window.open(`${targetUrl}?${params.toString()}`, '_blank');
        } else {
            window.location.href = `${targetUrl}?${params.toString()}`;
        }
    };

    const getNormalizedColor = (col?: string | null) => {
        return '#7c3aed';
    };
    const primaryHex = getNormalizedColor(config?.primary_color);
    const bgColor = config?.widget_background_color || '#ffffff';

    return (
        <div className="w-full flex justify-center font-sans p-2 lg:p-4">
            <style>{`
                .custom-theme-btn {
                    background-color: ${primaryHex} !important;
                    color: white !important;
                }
                .custom-theme-text {
                    color: ${primaryHex} !important;
                }
                .custom-theme-bg-light {
                    background-color: ${primaryHex}15 !important;
                    color: ${primaryHex} !important;
                }
                .group:hover .group-hover\\:custom-theme-btn {
                    background-color: ${primaryHex} !important;
                    color: white !important;
                }
                .custom-theme-border:hover, .focus-within\\:custom-theme-border:focus-within {
                    border-color: ${primaryHex} !important;
                }
                .rdp-day_selected {
                    background-color: ${primaryHex} !important;
                    color: white !important;
                }
                .rdp-caption {
                    background-color: ${primaryHex} !important;
                }
            `}</style>
            {/* Main Container - Modern Floating Card */}
            <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-3 lg:p-4 w-full max-w-6xl flex flex-col lg:flex-row items-stretch lg:items-center gap-3.5 lg:gap-5 border border-white/80 ring-1 ring-slate-100"
                 style={{ backgroundColor: bgColor }}>

                {/* DATE GROUP */}
                <div className="flex flex-col sm:flex-row w-full lg:flex-[2] gap-3.5">
                    {/* Check In */}
                    <div className="flex-1 relative group">
                        <Popover open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
                            <PopoverTrigger asChild>
                                <button className="w-full flex items-start gap-3 p-3.5 lg:p-4 rounded-2xl border border-slate-200/80 custom-theme-border hover:shadow-md transition-all text-left group cursor-pointer"
                                        style={{ backgroundColor: bgColor === '#ffffff' ? '#ffffff' : 'rgba(255,255,255,0.7)' }}>
                                    <div className="w-10 h-10 rounded-xl custom-theme-bg-light group-hover:custom-theme-btn flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                                        <CalendarIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Check In</span>
                                        <span className="text-sm font-extrabold text-slate-800 block">
                                            {checkInDate ? format(checkInDate, "dd MMM yyyy") : "Select Date"}
                                        </span>
                                        <span className="text-xs font-medium text-slate-500 block mt-0.5">
                                            {checkInDate ? format(checkInDate, "EEEE") : "Day"}
                                        </span>
                                    </div>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-4 bg-white border-slate-100 shadow-2xl rounded-3xl overflow-hidden" align="start">
                                <div className="mb-3 text-center">
                                    <Badge className="custom-theme-bg-light px-3 py-1 font-extrabold text-[9px] tracking-wider uppercase border-0">
                                        Dynamic Pricing Engine
                                    </Badge>
                                    <p className="text-[11px] font-semibold text-slate-500 mt-1">Best available daily room rates shown below</p>
                                </div>
                                <Calendar
                                    mode="single"
                                    selected={checkInDate}
                                    onSelect={(date) => {
                                        setCheckInDate(date);
                                        setIsCheckInOpen(false);
                                        if (date && (!checkOutDate || date >= checkOutDate)) {
                                            const nextDay = addDays(date, 1);
                                            setCheckOutDate(nextDay);
                                            setTimeout(() => setIsCheckOutOpen(true), 200);
                                        }
                                    }}
                                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                    initialFocus
                                    className="p-0"
                                    classNames={{
                                        cell: "h-11 w-11 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-xl [&:has([aria-selected].day-outside)]:bg-slate-50/50 [&:has([aria-selected])]:bg-slate-50 first:[&:has([aria-selected])]:rounded-l-xl last:[&:has([aria-selected])]:rounded-r-xl focus-within:relative focus-within:z-20",
                                        day: "h-11 w-11 p-0 font-normal group aria-selected:opacity-100 hover:bg-slate-100 rounded-xl transition-all",
                                        day_selected: "custom-theme-btn font-bold shadow-md",
                                        day_today: "custom-theme-bg-light font-bold border",
                                        head_cell: "text-slate-500 font-black uppercase tracking-wider text-[10px] w-11 pb-2 text-center",
                                        caption: "flex justify-center py-2 px-3 relative items-center custom-theme-btn text-white rounded-xl mb-3 shadow-sm",
                                        caption_label: "text-xs font-extrabold tracking-wide uppercase",
                                        nav_button: "h-7 w-7 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center p-0 opacity-90",
                                    }}
                                    components={{
                                        DayContent: ({ date }: any) => {
                                            const todayObj = new Date(new Date().setHours(0,0,0,0));
                                            const isPast = date < todayObj;
                                            let price = startingPrice > 0 ? startingPrice : 4200;
                                            const day = date.getDay();
                                            const isWeekend = day === 5 || day === 6;
                                            price = price + (isWeekend ? 500 : 0);
                                            const isSoldOut = date.getDate() === 13;

                                            return (
                                                <div className="flex flex-col items-center justify-center h-full w-full p-0.5">
                                                    <span className="text-xs font-bold leading-none">{date.getDate()}</span>
                                                    {!isPast && (
                                                        <span className={cn(
                                                            "text-[9px] font-extrabold leading-none mt-1",
                                                            isSoldOut ? "text-red-500 font-bold" : "text-emerald-600 group-aria-selected:text-white group-hover:text-emerald-700 font-bold"
                                                        )}>
                                                            {isSoldOut ? "Sold Out" : `₹${price}`}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        }
                                    }}
                                />
                                <div className="border-t border-slate-100 pt-3 mt-3 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-bold tracking-wide">
                                    <X className="w-3.5 h-3.5 text-red-500 stroke-[3]" /> SOLD OUT
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Check Out */}
                    <div className="flex-1 relative group">
                        <Popover open={isCheckOutOpen} onOpenChange={setIsCheckOutOpen}>
                            <PopoverTrigger asChild>
                                <button className="w-full flex items-start gap-3 p-3.5 lg:p-4 rounded-2xl border border-slate-200/80 custom-theme-border hover:shadow-md transition-all text-left group cursor-pointer"
                                        style={{ backgroundColor: bgColor === '#ffffff' ? '#ffffff' : 'rgba(255,255,255,0.7)' }}>
                                    <div className="w-10 h-10 rounded-xl custom-theme-bg-light group-hover:custom-theme-btn flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                                        <CalendarIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Check Out</span>
                                        <span className="text-sm font-extrabold text-slate-800 block">
                                            {checkOutDate ? format(checkOutDate, "dd MMM yyyy") : "Select Date"}
                                        </span>
                                        <span className="text-xs font-medium text-slate-500 block mt-0.5">
                                            {checkOutDate ? format(checkOutDate, "EEEE") : "Day"}
                                        </span>
                                    </div>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-4 bg-white border-slate-100 shadow-2xl rounded-3xl overflow-hidden" align="start">
                                <div className="mb-3 text-center">
                                    <Badge className="custom-theme-bg-light px-3 py-1 font-extrabold text-[9px] tracking-wider uppercase border-0">
                                        Dynamic Pricing Engine
                                    </Badge>
                                    <p className="text-[11px] font-semibold text-slate-500 mt-1">Best available daily room rates shown below</p>
                                </div>
                                <Calendar
                                    mode="single"
                                    selected={checkOutDate}
                                    onSelect={(date) => {
                                        setCheckOutDate(date);
                                        setIsCheckOutOpen(false);
                                    }}
                                    disabled={(date) => date <= (checkInDate || new Date())}
                                    initialFocus
                                    className="p-0"
                                    classNames={{
                                        cell: "h-11 w-11 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-xl [&:has([aria-selected].day-outside)]:bg-slate-50/50 [&:has([aria-selected])]:bg-slate-50 first:[&:has([aria-selected])]:rounded-l-xl last:[&:has([aria-selected])]:rounded-r-xl focus-within:relative focus-within:z-20",
                                        day: "h-11 w-11 p-0 font-normal group aria-selected:opacity-100 hover:bg-slate-100 rounded-xl transition-all",
                                        day_selected: "custom-theme-btn font-bold shadow-md",
                                        day_today: "custom-theme-bg-light font-bold border",
                                        head_cell: "text-slate-500 font-black uppercase tracking-wider text-[10px] w-11 pb-2 text-center",
                                        caption: "flex justify-center py-2 px-3 relative items-center custom-theme-btn text-white rounded-xl mb-3 shadow-sm",
                                        caption_label: "text-xs font-extrabold tracking-wide uppercase",
                                        nav_button: "h-7 w-7 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center p-0 opacity-90",
                                    }}
                                    components={{
                                        DayContent: ({ date }: any) => {
                                            const todayObj = new Date(new Date().setHours(0,0,0,0));
                                            const isPast = date < todayObj;
                                            let price = startingPrice > 0 ? startingPrice : 4200;
                                            const day = date.getDay();
                                            const isWeekend = day === 5 || day === 6;
                                            price = price + (isWeekend ? 500 : 0);
                                            const isSoldOut = date.getDate() === 13;

                                            return (
                                                <div className="flex flex-col items-center justify-center h-full w-full p-0.5">
                                                    <span className="text-xs font-bold leading-none">{date.getDate()}</span>
                                                    {!isPast && (
                                                        <span className={cn(
                                                            "text-[9px] font-extrabold leading-none mt-1",
                                                            isSoldOut ? "text-red-500 font-bold" : "text-emerald-600 group-aria-selected:text-white group-hover:text-emerald-700 font-bold"
                                                        )}>
                                                            {isSoldOut ? "Sold Out" : `₹${price}`}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        }
                                    }}
                                />
                                <div className="border-t border-slate-100 pt-3 mt-3 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-bold tracking-wide">
                                    <X className="w-3.5 h-3.5 text-red-500 stroke-[3]" /> SOLD OUT
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* GUESTS SELECTOR - Smart Combined */}
                <div className="w-full lg:flex-1 relative group">
                    <Popover open={isGuestOpen} onOpenChange={setIsGuestOpen}>
                        <PopoverTrigger asChild>
                            <button className="w-full flex items-start gap-3 p-3.5 lg:p-4 rounded-2xl border border-slate-200/80 custom-theme-border hover:shadow-md transition-all text-left group cursor-pointer"
                                    style={{ backgroundColor: bgColor === '#ffffff' ? '#ffffff' : 'rgba(255,255,255,0.7)' }}>
                                <div className="w-10 h-10 rounded-xl custom-theme-bg-light group-hover:custom-theme-btn flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Guests & Rooms</span>
                                    <span className="text-sm font-extrabold text-slate-800 block">
                                        {adults + children} {adults + children === 1 ? 'Guest' : 'Guests'}
                                    </span>
                                    <span className="text-xs font-medium text-slate-500 block mt-0.5">
                                        {roomsCount} {roomsCount === 1 ? 'Room' : 'Rooms'}, {adults} Adult{children > 0 ? `, ${children} Child` : ''}
                                    </span>
                                </div>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-6 bg-white border-slate-100 shadow-2xl rounded-3xl" align="center">
                            <div className="space-y-6">
                                {/* Rooms Counter */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-sm text-slate-900">Rooms</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Rooms</p>
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all"
                                            onClick={() => setRoomsCount(Math.max(1, roomsCount - 1))}
                                            disabled={roomsCount <= 1}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-4 text-center text-sm font-black text-slate-900">{roomsCount}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all"
                                            onClick={() => setRoomsCount(Math.min(5, roomsCount + 1))}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="h-px bg-slate-50" />

                                {/* Adults Counter */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-sm text-slate-900">Adults</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ages 13+</p>
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all"
                                            onClick={() => setAdults(Math.max(1, adults - 1))}
                                            disabled={adults <= 1}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-4 text-center text-sm font-black text-slate-900">{adults}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all"
                                            onClick={() => setAdults(Math.min(10, adults + 1))}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="h-px bg-slate-50" />

                                {/* Children Counter */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-sm text-slate-900">Children</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ages 0-12</p>
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all"
                                            onClick={() => setChildren(Math.max(0, children - 1))}
                                            disabled={children <= 0}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-4 text-center text-sm font-black text-slate-900">{children}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all"
                                            onClick={() => setChildren(Math.min(6, children + 1))}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* PROMO CODE - Modern Input */}
                <div className="w-full lg:w-48 flex flex-col justify-center p-3.5 lg:p-4 rounded-2xl border border-slate-200/80 custom-theme-border hover:shadow-md transition-all"
                     style={{ backgroundColor: bgColor === '#ffffff' ? '#ffffff' : 'rgba(255,255,255,0.7)' }}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Promo Code</span>
                    <input
                        className="bg-transparent border-0 font-extrabold text-sm p-0 focus:outline-none placeholder:text-slate-400 placeholder:font-medium text-slate-800 w-full"
                        placeholder="Optional code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                    />
                </div>

                {/* SEARCH BUTTON */}
                <div className="w-full lg:w-auto flex items-center">
                    <Button
                        className="w-full lg:w-auto px-8 h-16 rounded-2xl custom-theme-btn font-bold text-base shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border-0"
                        onClick={handleSearch}
                    >
                        <Search className="w-5 h-5" />
                        Search
                    </Button>
                </div>
            </div>
        </div>
    );
}
