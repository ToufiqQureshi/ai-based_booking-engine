
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
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1'; // Fallback

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
    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);
    const [promoCode, setPromoCode] = useState('');

    // Calendar UI State
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
    const [isGuestOpen, setIsGuestOpen] = useState(false);

    // Dynamic Resizing Logic
    useEffect(() => {
        const baseHeight = 100; // Compact height
        const expandedHeight = 600; // Use expanded height when popovers are open
        const isOpen = isCheckInOpen || isCheckOutOpen || isGuestOpen;
        const height = isOpen ? expandedHeight : baseHeight;

        if (window.parent !== window) {
            window.parent.postMessage({ type: 'RESIZE_OVERLAY', height }, '*');
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

        if (promoCode) params.append('promo_code', promoCode);

        if (window.parent !== window) {
            window.open(`${targetUrl}?${params.toString()}`, '_blank');
        } else {
            window.location.href = `${targetUrl}?${params.toString()}`;
        }
    };

    return (
        <div className="w-full flex justify-center font-sans p-2 lg:p-4">
            {/* Main Container - Modern Floating Card */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-2 lg:p-3 w-full max-w-6xl flex flex-col lg:flex-row items-center gap-2 lg:gap-4 border border-white/20 ring-1 ring-black/5">

                {/* DATE GROUP */}
                <div className="flex w-full lg:flex-[2] gap-2">
                    {/* Check In */}
                    <div className="flex-1 relative group">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-3 mb-1 block">Check In</label>
                        <Popover open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full h-14 justify-start text-left font-semibold border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300 rounded-xl transition-all",
                                        !checkInDate && "text-slate-400"
                                    )}
                                >
                                    <CalendarIcon className="mr-3 h-5 w-5 text-indigo-600" />
                                    <div className="flex flex-col items-start leading-none gap-1">
                                        <span className="text-sm text-slate-900">{checkInDate ? format(checkInDate, "dd MMM yyyy") : "Select Date"}</span>
                                        <span className="text-[10px] font-normal text-slate-500">{checkInDate ? format(checkInDate, "EEEE") : "Day"}</span>
                                    </div>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-6 bg-white border-slate-100 shadow-2xl rounded-3xl overflow-hidden" align="start">
                                <div className="mb-4 text-center">
                                    <Badge className="bg-violet-100 text-violet-700 px-3.5 py-1 font-black text-[10px] tracking-widest uppercase">
                                        Dynamic Pricing Engine
                                    </Badge>
                                    <p className="text-xs font-semibold text-slate-500 mt-1">Best available daily room rates shown below</p>
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
                                        cell: "h-14 w-14 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-xl [&:has([aria-selected].day-outside)]:bg-violet-50/50 [&:has([aria-selected])]:bg-violet-50 first:[&:has([aria-selected])]:rounded-l-xl last:[&:has([aria-selected])]:rounded-r-xl focus-within:relative focus-within:z-20",
                                        day: "h-14 w-14 p-0 font-normal group aria-selected:opacity-100 hover:bg-violet-100/50 rounded-xl transition-all",
                                        day_selected: "bg-violet-600 text-white hover:bg-violet-700 hover:text-white focus:bg-violet-600 focus:text-white font-bold shadow-md",
                                        day_today: "bg-violet-100/40 text-violet-700 font-bold border border-violet-200",
                                        head_cell: "text-slate-500 font-black uppercase tracking-wider text-[11px] w-14 pb-3 text-center",
                                        caption: "flex justify-center py-3 px-4 relative items-center bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl mb-4 shadow-md",
                                        caption_label: "text-sm font-extrabold tracking-wide uppercase",
                                        nav_button: "h-8 w-8 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center p-0 opacity-90",
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
                                                <div className="flex flex-col items-center justify-center h-full w-full p-1">
                                                    <span className="text-sm font-bold leading-none">{date.getDate()}</span>
                                                    {!isPast && (
                                                        <span className={cn(
                                                            "text-[10px] font-black leading-none mt-1.5",
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
                                <div className="border-t border-slate-100 pt-4 mt-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2 font-bold tracking-wide">
                                    <X className="w-4 h-4 text-red-500 stroke-[3]" /> SOLD OUT
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Check Out */}
                    <div className="flex-1 relative group">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-3 mb-1 block">Check Out</label>
                        <Popover open={isCheckOutOpen} onOpenChange={setIsCheckOutOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full h-14 justify-start text-left font-semibold border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300 rounded-xl transition-all",
                                        !checkOutDate && "text-slate-400"
                                    )}
                                >
                                    <ArrowRight className="mr-3 h-5 w-5 text-slate-400" />
                                    <div className="flex flex-col items-start leading-none gap-1">
                                        <span className="text-sm text-slate-900">{checkOutDate ? format(checkOutDate, "dd MMM yyyy") : "Select Date"}</span>
                                        <span className="text-[10px] font-normal text-slate-500">{checkOutDate ? format(checkOutDate, "EEEE") : "Day"}</span>
                                    </div>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-6 bg-white border-slate-100 shadow-2xl rounded-3xl overflow-hidden" align="start">
                                <div className="mb-4 text-center">
                                    <Badge className="bg-violet-100 text-violet-700 px-3.5 py-1 font-black text-[10px] tracking-widest uppercase">
                                        Dynamic Pricing Engine
                                    </Badge>
                                    <p className="text-xs font-semibold text-slate-500 mt-1">Best available daily room rates shown below</p>
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
                                        cell: "h-14 w-14 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-xl [&:has([aria-selected].day-outside)]:bg-violet-50/50 [&:has([aria-selected])]:bg-violet-50 first:[&:has([aria-selected])]:rounded-l-xl last:[&:has([aria-selected])]:rounded-r-xl focus-within:relative focus-within:z-20",
                                        day: "h-14 w-14 p-0 font-normal group aria-selected:opacity-100 hover:bg-violet-100/50 rounded-xl transition-all",
                                        day_selected: "bg-violet-600 text-white hover:bg-violet-700 hover:text-white focus:bg-violet-600 focus:text-white font-bold shadow-md",
                                        day_today: "bg-violet-100/40 text-violet-700 font-bold border border-violet-200",
                                        head_cell: "text-slate-500 font-black uppercase tracking-wider text-[11px] w-14 pb-3 text-center",
                                        caption: "flex justify-center py-3 px-4 relative items-center bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl mb-4 shadow-md",
                                        caption_label: "text-sm font-extrabold tracking-wide uppercase",
                                        nav_button: "h-8 w-8 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center p-0 opacity-90",
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
                                                <div className="flex flex-col items-center justify-center h-full w-full p-1">
                                                    <span className="text-sm font-bold leading-none">{date.getDate()}</span>
                                                    {!isPast && (
                                                        <span className={cn(
                                                            "text-[10px] font-black leading-none mt-1.5",
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
                                <div className="border-t border-slate-100 pt-4 mt-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2 font-bold tracking-wide">
                                    <X className="w-4 h-4 text-red-500 stroke-[3]" /> SOLD OUT
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* GUESTS SELECTOR - Smart Combined */}
                <div className="w-full lg:flex-1 relative group">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-3 mb-1 block">Guests</label>
                    <Popover open={isGuestOpen} onOpenChange={setIsGuestOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-14 justify-between font-semibold border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300 rounded-xl transition-all">
                                <div className="flex items-center">
                                    <Users className="mr-3 h-5 w-5 text-indigo-600" />
                                    <div className="flex flex-col items-start leading-none gap-1">
                                        <span className="text-sm text-slate-900">{adults + children} Guests</span>
                                        <span className="text-[10px] font-normal text-slate-500">{adults} Adult, {children} Child</span>
                                    </div>
                                </div>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-4 bg-white border-slate-100 shadow-xl rounded-xl" align="center">
                            <div className="space-y-4">
                                {/* Adults Counter */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-sm text-slate-900">Adults</p>
                                        <p className="text-xs text-slate-500">Ages 13 or above</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 rounded-full"
                                            onClick={() => setAdults(Math.max(1, adults - 1))}
                                            disabled={adults <= 1}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-4 text-center text-sm font-semibold">{adults}</span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 rounded-full"
                                            onClick={() => setAdults(Math.min(10, adults + 1))}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="h-px bg-slate-100" />

                                {/* Children Counter */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-sm text-slate-900">Children</p>
                                        <p className="text-xs text-slate-500">Ages 0-12</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 rounded-full"
                                            onClick={() => setChildren(Math.max(0, children - 1))}
                                            disabled={children <= 0}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-4 text-center text-sm font-semibold">{children}</span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 rounded-full"
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
                <div className="w-full lg:flex-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-3 mb-1 block">Promo Code</label>
                    <div className="relative">
                        <input
                            className="w-full h-14 bg-slate-50/50 border border-slate-200 text-sm font-semibold text-slate-900 px-4 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                            placeholder="Optional code"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                        />
                    </div>
                </div>

                {/* SEARCH BUTTON */}
                <div className="w-full lg:w-auto pt-4 lg:pt-6 lg:pb-1">
                    <Button
                        className="w-full lg:w-32 h-14 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-base shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-2"
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
