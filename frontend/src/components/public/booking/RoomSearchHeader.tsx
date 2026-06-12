import { format, addMonths, startOfMonth } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Search, User, ChevronDown, Plus, Minus, X, ArrowRight, Hotel as HotelIcon, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiClient } from '@/api/client';

interface CalendarDay { min_price: number | null; available: boolean; }

interface RoomSearchHeaderProps {
    searchType: 'room' | 'package';
    setSearchType: (val: 'room' | 'package') => void;
    checkInDate: Date | undefined;
    setCheckInDate: (date: Date | undefined) => void;
    checkOutDate: Date | undefined;
    setCheckOutDate: (date: Date | undefined) => void;
    adults: number;
    setAdults: (n: number) => void;
    children: number;
    setChildren: (n: number) => void;
    roomsCount: number;
    setRoomsCount: (n: number) => void;
    promoCode: string;
    setPromoCode: (val: string) => void;
    isCalendarOpen: boolean;
    setIsCalendarOpen: (val: boolean) => void;
    isGuestOpen: boolean;
    setIsGuestOpen: (val: boolean) => void;
    flexibleDates: boolean;
    setFlexibleDates: (val: boolean) => void;
    themeColor: string;
    isMobile: boolean;
    startingPrice: number;
    handleSearch: () => void;
    hotelSlug?: string;
    currency?: string;
    calendarRefreshTrigger?: number;
}

export function RoomSearchHeader({
    searchType,
    setSearchType,
    checkInDate,
    setCheckInDate,
    checkOutDate,
    setCheckOutDate,
    adults,
    setAdults,
    children,
    setChildren,
    roomsCount,
    setRoomsCount,
    promoCode,
    setPromoCode,
    isCalendarOpen,
    setIsCalendarOpen,
    isGuestOpen,
    setIsGuestOpen,
    flexibleDates,
    setFlexibleDates,
    themeColor,
    isMobile,
    startingPrice,
    handleSearch,
    hotelSlug,
    currency = 'INR',
    calendarRefreshTrigger,
}: RoomSearchHeaderProps) {
    const [calendarData, setCalendarData] = useState<Record<string, CalendarDay>>({});
    const [displayMonth, setDisplayMonth] = useState<Date>(startOfMonth(new Date()));
    const fetchedMonths = useRef<Set<string>>(new Set());

    const formatPrice = (price: number) => {
        if (currency === 'INR') return `₹${Math.round(price).toLocaleString('en-IN')}`;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
    };

    // Fetch calendar data for a month string "YYYY-MM"
    const fetchMonth = async (monthStr: string) => {
        if (!hotelSlug) return;
        try {
            const data = await apiClient.get<Record<string, CalendarDay>>(
                `/public/hotels/${hotelSlug}/calendar`,
                { month: monthStr }
            );
            setCalendarData(prev => ({ ...prev, ...data }));
        } catch {
            // silent — calendar will just show no prices
        }
    };

    // Fetch visible months whenever displayMonth, hotelSlug, or refresh trigger changes
    useEffect(() => {
        if (!hotelSlug) return;
        const months = [
            format(displayMonth, 'yyyy-MM'),
            format(addMonths(displayMonth, 1), 'yyyy-MM'),
        ];
        // On refresh trigger, clear cache so we re-fetch
        if (calendarRefreshTrigger !== undefined) {
            fetchedMonths.current.clear();
        }
        months.forEach(m => {
            if (!fetchedMonths.current.has(m)) {
                fetchedMonths.current.add(m);
                fetchMonth(m);
            }
        });
    }, [hotelSlug, displayMonth, calendarRefreshTrigger]);

    return (
        <div id="hotelier-search-widget" className="bg-white/95 backdrop-blur-2xl p-4 sm:p-6 rounded-[32px] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.15)] mb-6 sm:mb-10 max-w-6xl mx-auto border border-white/60">
            {/* Premium Room/Package Switch */}
            <div className="flex justify-center mb-4">
                <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50 backdrop-blur-sm">
                    <button
                        onClick={() => setSearchType('room')}
                        className={cn(
                            "px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2",
                            searchType === 'room' ? "bg-white shadow-sm ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-600"
                        )}
                        style={searchType === 'room' ? { color: themeColor } : {}}
                    >
                        <HotelIcon className="w-3.5 h-3.5" />
                        Rooms
                    </button>
                    <button
                        onClick={() => setSearchType('package')}
                        className={cn(
                            "px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2",
                            searchType === 'package' ? "bg-white shadow-sm ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-600"
                        )}
                        style={searchType === 'package' ? { color: themeColor } : {}}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Packages
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row items-stretch gap-3">
                {/* Date Selector Popover (Check-In & Check-Out) */}
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                        <button 
                            className="flex-[2] flex flex-row items-center gap-3 p-4 rounded-[20px] border-2 transition-all text-left cursor-pointer hover:bg-slate-50/60"
                            style={{ borderColor: isCalendarOpen ? themeColor : '#f1f5f9', backgroundColor: '#fff' }}
                            onClick={() => { setIsCalendarOpen(!isCalendarOpen); setIsGuestOpen(false); }}
                        >
                            <div className="flex-1 flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                     style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>
                                    <CalendarIcon className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Check In</span>
                                    <span className="text-sm font-extrabold text-slate-800 block">
                                        {checkInDate ? format(checkInDate, 'dd MMM yyyy') : 'Select Date'}
                                    </span>
                                    <span className="text-xs text-slate-500 block truncate">
                                        {checkInDate ? format(checkInDate, 'EEEE') : 'Add date'}
                                    </span>
                                </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-300 shrink-0" />
                            <div className="flex-1 flex items-center gap-3 pl-3 border-l border-slate-100 min-w-0">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                     style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>
                                    <CalendarIcon className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Check Out</span>
                                    <span className="text-sm font-extrabold text-slate-800 block">
                                        {checkOutDate ? format(checkOutDate, 'dd MMM yyyy') : 'Select Date'}
                                    </span>
                                    <span className="text-xs text-slate-500 block truncate">
                                        {checkOutDate ? format(checkOutDate, 'EEEE') : 'Add date'}
                                    </span>
                                </div>
                            </div>
                        </button>
                    </PopoverTrigger>

                    <PopoverContent
                        className="p-0 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
                        style={{ width: isMobile ? 'calc(100vw - 32px)' : 'auto', maxWidth: '720px' }}
                        align="center"
                        sideOffset={8}
                    >
                        <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Select Dates</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">Tap check-in, then check-out</p>
                            </div>
                            <button onClick={() => setIsCalendarOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-3 overflow-x-auto">
                            <style>{`
                                .rdp-day_selected,
                                .rdp-day_selected:hover {
                                    background-color: ${themeColor} !important;
                                    color: white !important;
                                }
                                .rdp-day_today:not(.rdp-day_selected) {
                                    color: ${themeColor} !important;
                                }
                                .rdp-day_selected.rdp-day_today {
                                    color: white !important;
                                }
                            `}</style>
                        <Calendar 
                            mode="range"
                            numberOfMonths={isMobile ? 1 : 2}
                            selected={{
                                from: checkInDate,
                                to: checkOutDate
                            }}
                            onSelect={(range: any) => {
                                // Mirror the computed range exactly so a new check-in
                                // click clears the old check-out and starts a fresh
                                // range instead of producing an inverted/locked range.
                                setCheckInDate(range?.from);
                                setCheckOutDate(range?.to);
                                // Calendar stays open until guest explicitly hits X
                            }}
                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                            className="p-0"
                            classNames={{
                                cell: "h-9 w-9 sm:h-11 sm:w-11 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-xl first:[&:has([aria-selected])]:rounded-l-xl last:[&:has([aria-selected])]:rounded-r-xl focus-within:relative focus-within:z-20",
                                day: "h-9 w-9 sm:h-11 sm:w-11 p-0 font-normal group aria-selected:opacity-100 hover:bg-slate-100 rounded-xl transition-all",
                                day_selected: "text-white font-bold shadow-md",
                                day_today: "font-bold border border-slate-200 bg-slate-50",
                                head_cell: "text-slate-500 font-black uppercase tracking-wider text-[10px] w-9 sm:w-11 pb-2 text-center",
                                caption: "flex justify-center py-2.5 px-3 relative items-center text-white rounded-xl mb-3 shadow-sm",
                                caption_label: "text-xs font-extrabold tracking-wide uppercase",
                                nav_button: "h-7 w-7 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center p-0",
                                months: "flex flex-col md:flex-row space-y-3 md:space-x-4 md:space-y-0"
                            }}
                            styles={{
                                caption: { backgroundColor: themeColor },
                            }}
                            modifiersStyles={{
                                selected: { backgroundColor: themeColor, color: '#fff' },
                                today: { color: themeColor, fontWeight: 700 }
                            }}
                            onMonthChange={(month: Date) => setDisplayMonth(startOfMonth(month))}
                            components={{
                                DayContent: ({ date }: any) => {
                                    const todayObj = new Date(new Date().setHours(0, 0, 0, 0));
                                    const isPast = date < todayObj;
                                    const key = format(date, 'yyyy-MM-dd');
                                    const dayData = calendarData[key];
                                    const isSoldOut = dayData ? !dayData.available : false;
                                    const price = dayData?.min_price ?? null;

                                    return (
                                        <div className="flex flex-col items-center justify-center h-full w-full p-0.5">
                                            <span className="text-xs font-bold leading-none">{date.getDate()}</span>
                                            {!isPast && (
                                                <span className={cn(
                                                    "text-[9px] font-extrabold leading-none mt-1",
                                                    isSoldOut
                                                        ? "text-red-400"
                                                        : price !== null
                                                            ? "text-emerald-600 group-aria-selected:text-white group-hover:text-emerald-700"
                                                            : "text-slate-300"
                                                )}>
                                                    {isSoldOut ? "Sold" : price !== null ? formatPrice(price) : ''}
                                                </span>
                                            )}
                                        </div>
                                    );
                                }
                            }}
                        />
                        <div className="border-t border-slate-100 pt-3 mt-2 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5 font-bold tracking-wide">
                            <span className="text-red-400 font-extrabold">Sold</span> = No rooms &nbsp;·&nbsp; Prices shown are starting rates
                        </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Guests Configuration Popover */}
                <Popover open={isGuestOpen} onOpenChange={setIsGuestOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className="flex-1 flex items-center gap-3 p-4 rounded-[20px] border-2 transition-all text-left cursor-pointer hover:bg-slate-50/60"
                            style={{ borderColor: isGuestOpen ? themeColor : '#f1f5f9', backgroundColor: '#fff' }}
                            onClick={() => { setIsGuestOpen(!isGuestOpen); setIsCalendarOpen(false); }}
                        >
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                 style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>
                                <User className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Guests &amp; Rooms</span>
                                <span className="text-sm font-extrabold text-slate-800 block">
                                    {adults + children} {adults + children === 1 ? 'Guest' : 'Guests'}
                                </span>
                                <span className="text-xs text-slate-500 block truncate">
                                    {roomsCount} Room{roomsCount !== 1 ? 's' : ''}, {adults} Adult{adults !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <ChevronDown className="w-4 h-4 text-slate-400 ml-auto shrink-0"
                                         style={{ transform: isGuestOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-6 bg-white border-slate-100 shadow-2xl rounded-3xl" align="center">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-sm text-slate-900">Rooms</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Rooms</p>
                                </div>
                                <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all" onClick={() => setRoomsCount(Math.max(1, roomsCount - 1))} disabled={roomsCount <= 1}>
                                        <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="w-4 text-center text-sm font-black text-slate-900">{roomsCount}</span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all" onClick={() => setRoomsCount(Math.min(5, roomsCount + 1))}>
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            <div className="h-px bg-slate-50" />
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

                {/* Promo Input */}
                <div className="hidden lg:flex w-40 flex-col justify-center p-4 rounded-[20px] border-2 border-[#f1f5f9] bg-white transition-all hover:bg-slate-50/60 focus-within:border-slate-300">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Promo Code</span>
                    <input 
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Optional"
                        className="bg-transparent border-0 font-extrabold text-sm p-0 focus:outline-none focus:ring-0 shadow-none placeholder:text-slate-300 text-slate-800 w-full"
                    />
                </div>

                {/* Search Button */}
                <button
                    className="h-[76px] px-10 rounded-[20px] text-white font-black text-[15px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_25px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all shrink-0"
                    style={{ backgroundImage: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` }}
                    onClick={handleSearch}
                >
                    <Search className="w-5 h-5 stroke-[2.5]" />
                    Search
                </button>
            </div>

            {/* Flexible Dates Checkbox */}
            <div className="mt-4 px-4 flex items-center justify-center gap-2.5">
                <input 
                    type="checkbox" 
                    id="flex-dates" 
                    checked={flexibleDates}
                    onChange={(e) => setFlexibleDates(e.target.checked)}
                    className="rounded border-slate-300 w-4 h-4 cursor-pointer" 
                    style={{ accentColor: themeColor }}
                />
                <label htmlFor="flex-dates" className="text-xs text-slate-500 font-black tracking-wider uppercase cursor-pointer select-none hover:text-slate-700 transition-colors">
                    Flexible Dates
                </label>
            </div>
        </div>
    );
}
