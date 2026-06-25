import { format, addMonths, startOfMonth } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, Search, User, ChevronDown, Plus, Minus, X, ArrowRight, Hotel as HotelIcon, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/core/lib/utils';
import { useCurrencyConverter } from '@/core/contexts/GuestPreferencesContext';
import { apiClient } from '@/core/api/client';
import { useTranslation } from 'react-i18next';

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
    hideAdvancedOptions?: boolean;
    layoutStyle?: string;
    minNights?: number;
    advancePurchaseDays?: number;
    showPromoCode?: boolean;
    showPackages?: boolean;
    showFlexibleDates?: boolean;
    bgColor?: string;
    isBgLight?: boolean;
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
    hideAdvancedOptions = false,
    layoutStyle = 'modern',
    minNights = 1,
    advancePurchaseDays = 0,
    showPromoCode = true,
    showPackages = true,
    showFlexibleDates = true,
    bgColor,
    isBgLight = true
}: RoomSearchHeaderProps) {
    const [calendarData, setCalendarData] = useState<Record<string, CalendarDay>>({});
    const [displayMonth, setDisplayMonth] = useState<Date>(startOfMonth(new Date()));
    
    // BUG FIX (Calendar Field Tracking):
    // Previously, the widget didn't know if the user was trying to pick Check-In or Check-Out.
    // This state tracks exactly which field is currently active, allowing us to interpret their calendar clicks accurately.
    const [activeDateType, setActiveDateType] = useState<'checkIn' | 'checkOut'>('checkIn');
    const fetchedMonths = useRef<Set<string>>(new Set());
    // Months whose prices are still in flight — drives the per-cell skeleton
    // shimmer so the calendar reads as "loading" instead of "no prices".
    const [loadingMonths, setLoadingMonths] = useState<Set<string>>(new Set());
    const { format: formatPrice, convert, guestCurrency } = useCurrencyConverter();
    const { t } = useTranslation();

    const formatPriceCompact = (price: number) => {
        const converted = convert(price);
        const p = Math.round(converted);
        
        let _symbol = '';
        if (guestCurrency === 'INR') _symbol = '₹';
        else if (guestCurrency === 'USD') _symbol = '$';
        else if (guestCurrency === 'EUR') _symbol = '€';
        else if (guestCurrency === 'GBP') _symbol = '£';

        const body = p >= 100000
            ? `${(p / 100000).toFixed(p % 100000 === 0 ? 0 : 1)}L`
            : p >= 1000
                ? `${(p / 1000).toFixed(p % 1000 === 0 ? 0 : 1)}k`
                : `${p}`;
        return _symbol ? `${_symbol}${body}` : `${p}`;
    };

    // Fetch calendar data for a month string "YYYY-MM"
    const fetchMonth = async (monthStr: string) => {
        if (!hotelSlug) return;
        setLoadingMonths(prev => new Set(prev).add(monthStr));
        try {
            const data = await apiClient.get<Record<string, CalendarDay>>(
                `/public/hotels/${hotelSlug}/calendar`,
                { month: monthStr }
            );
            setCalendarData(prev => ({ ...prev, ...data }));
        } catch {
            // silent — calendar will just show no prices
        } finally {
            setLoadingMonths(prev => {
                const next = new Set(prev);
                next.delete(monthStr);
                return next;
            });
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

    // Shared calendar body — rendered inside a Popover on desktop and a
    // full-screen bottom sheet on mobile (see render below).
    const calendarPanel = (
        <>
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Select Dates</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tap check-in, then check-out</p>
                </div>
                <button onClick={() => setIsCalendarOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                    <X className="w-4 h-4 text-slate-500" />
                </button>
            </div>
            {/* Bounded height + internal scroll so the calendar and
                legend are never clipped by the popover/sheet. */}
            <div className="p-2 sm:p-3 overflow-x-auto overflow-y-auto max-h-[85vh] md:max-h-[700px] flex-1 min-h-0">
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
                    selected={{ from: checkInDate, to: checkOutDate }}
                    onSelect={(range: any, selectedDay: Date) => {
                        // BUG FIX (react-day-picker Range UX):
                        // DayPicker's native "range" mode behaves weirdly (e.g., clicking inside a range resets it).
                        // Instead of relying blindly on `range`, we use `selectedDay` + `activeDateType` to manually enforce user intent.
                        //
                        // The guest's clicked date is always respected as-is — we never silently lengthen
                        // their stay to satisfy a hotelier "minimum nights" setting. A min-nights upsell must
                        // be surfaced as a visible, opt-in offer (see the loyalty stay-offer nudge), never a
                        // forced date change the guest didn't ask for.
                        if (activeDateType === 'checkIn' || !checkInDate) {
                            setCheckInDate(selectedDay);
                            // If the existing check-out is no longer after the new check-in, clear it
                            if (checkOutDate && checkOutDate <= selectedDay) {
                                setCheckOutDate(undefined);
                            }
                            setActiveDateType('checkOut');
                        } else {
                            // User is picking check-out
                            if (selectedDay <= checkInDate) {
                                // If they click a date before check-in, they probably meant to change check-in!
                                setCheckInDate(selectedDay);
                                setCheckOutDate(undefined);
                                setActiveDateType('checkOut');
                            } else {
                                setCheckOutDate(selectedDay);
                            }
                        }
                    }}
                    disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (advancePurchaseDays > 0) {
                            today.setDate(today.getDate() + advancePurchaseDays);
                        }
                        
                        // Disable past dates and advance purchase
                        if (date < today) return true;
                        
                        // Enforce minNights when selecting checkOut
                        if (activeDateType === 'checkOut' && checkInDate) {
                            const minCheckOut = new Date(checkInDate);
                            minCheckOut.setDate(minCheckOut.getDate() + minNights);
                            minCheckOut.setHours(0, 0, 0, 0);
                            if (date < minCheckOut) return true;
                        }
                        
                        return false;
                    }}
                    className="p-0"
                    classNames={{
                        cell: "h-8 w-8 sm:h-10 sm:w-10 text-center text-[11px] p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-lg first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg focus-within:relative focus-within:z-20",
                        day: "h-8 w-8 sm:h-10 sm:w-10 p-0 font-normal group aria-selected:opacity-100 hover:bg-slate-100 rounded-lg transition-all",
                        day_selected: "text-white font-bold shadow-md",
                        day_today: "font-bold border border-slate-200 bg-slate-50",
                        head_cell: "text-slate-500 font-black uppercase tracking-wider text-[9px] w-8 sm:w-10 pb-1 text-center",
                        caption: "flex justify-center py-2.5 px-3 relative items-center text-white rounded-xl mb-3 shadow-sm",
                        caption_label: "text-xs font-extrabold tracking-wide uppercase",
                        nav_button: "h-7 w-7 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center p-0",
                        // Width-driven (isMobile), not the md: breakpoint —
                        // the embedded iframe is often <768px on desktop.
                        months: isMobile ? "flex flex-col space-y-3" : "flex flex-row space-x-4"
                    }}
                    styles={{ caption: { backgroundColor: themeColor } }}
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
                            // Show a shimmer in the price line while this date's month
                            // is still being fetched (data not yet arrived).
                            const isLoading = !dayData && !isPast && loadingMonths.has(format(date, 'yyyy-MM'));

                            return (
                                <div className="flex flex-col items-center justify-center h-full w-full p-0.5">
                                    <span className={cn(
                                        "text-[12px] font-extrabold leading-none",
                                        isPast ? "text-slate-400" : "text-slate-800 group-aria-selected:text-white"
                                    )}>
                                        {date.getDate()}
                                    </span>
                                    {!isPast && (
                                        isLoading ? (
                                            <span className="mt-1 h-[7px] w-6 rounded-full bg-slate-200 animate-pulse" aria-hidden="true" />
                                        ) : (
                                        <span className={cn(
                                            "text-[8px] font-extrabold leading-none mt-0.5",
                                            isSoldOut
                                                ? "text-red-500"
                                                : price !== null
                                                    ? "text-slate-700 group-aria-selected:text-white group-hover:text-slate-900"
                                                    : "text-slate-300"
                                        )}>
                                            {isSoldOut ? "Sold" : price !== null ? formatPriceCompact(price) : ''}
                                        </span>
                                        )
                                    )}
                                </div>
                            );
                        }
                    }}
                />
                <div className="border-t border-slate-100 pt-3 mt-2 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5 font-bold tracking-wide">
                    <span className="text-red-400 font-extrabold">Sold</span> = No rooms &nbsp;·&nbsp; From-price per night · taxes &amp; extra guests may apply
                </div>
            </div>
        </>
    );

    let containerClasses = "mb-6 sm:mb-10 max-w-6xl mx-auto transition-all duration-500 ease-out ";
    let containerStyle: React.CSSProperties = {};
    
    if (layoutStyle === 'minimal') {
        containerClasses += "bg-transparent p-2 sm:p-4";
    } else if (layoutStyle === 'classic') {
        containerClasses += "bg-white p-6 sm:p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 max-w-4xl";
    } else if (layoutStyle === 'floating') {
        containerClasses = "fixed bottom-6 left-6 right-6 z-50 bg-white/90 backdrop-blur-2xl p-4 sm:p-5 rounded-[28px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] border border-white max-w-4xl mx-auto ring-1 ring-slate-900/5";
    } else if (layoutStyle === 'ota') {
        containerClasses += "p-4 sm:p-6 lg:p-8 rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] max-w-5xl mx-auto";
        containerStyle = { backgroundColor: themeColor, backgroundImage: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` };
    } else if (layoutStyle === 'glassmorphism') {
        containerClasses += "bg-white/40 backdrop-blur-md border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-4 sm:p-6 rounded-[32px] max-w-5xl mx-auto";
    } else {
        // modern
        containerClasses += "bg-white/70 backdrop-blur-3xl p-4 sm:p-6 rounded-[32px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] border border-white max-w-5xl mx-auto ring-1 ring-white/50";
    }

    const hasCustomBg = !!bgColor && !['#ffffff', '#fff', ''].includes(bgColor.toLowerCase());
    if (hasCustomBg && layoutStyle !== 'ota' && layoutStyle !== 'minimal') {
        containerStyle = { ...containerStyle, backgroundColor: bgColor };
    }

    const isOta = layoutStyle === 'ota';

    return (
        <div id="hotelier-search-widget" className={containerClasses} style={containerStyle}>
            {!hideAdvancedOptions && !isOta && showPackages && (
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
            )}

            <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
                {/* Date Selector Popover (Check-In & Check-Out) */}
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverAnchor asChild>
                        {/* BUG FIX (Split Trigger): 
                            Previously this was a single button, meaning we didn't know if the user clicked the Check-In side or Check-Out side.
                            We split the hit areas into two buttons inside the PopoverTrigger so we can set activeDateType on click, 
                            using e.stopPropagation() so Radix doesn't accidentally auto-close it when we manually open it.
                        */}
                        <div className="flex-[2] flex flex-row items-stretch gap-3">
                            <button 
                                className={isOta 
                                    ? "flex-1 flex flex-col justify-center p-3 sm:p-4 bg-white rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.05)] text-left hover:bg-slate-50 transition-all relative min-h-[80px]"
                                    : "flex-1 flex items-center gap-3 p-4 rounded-[20px] border transition-all duration-300 text-left cursor-pointer hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 h-[68px]"
                                }
                                style={isOta ? {} : { 
                                    borderColor: (isCalendarOpen && activeDateType === 'checkIn') ? themeColor : 'rgba(226, 232, 240, 0.6)', 
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    boxShadow: (isCalendarOpen && activeDateType === 'checkIn') ? `0 0 0 4px ${themeColor}15` : undefined
                                }}
                                onClick={(e) => { 
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsGuestOpen(false); 
                                    setActiveDateType('checkIn'); 
                                    setIsCalendarOpen(true); 
                                }}
                            >
                                {isOta ? (
                                    <div className="px-1 sm:px-2 w-full pr-6 border-r border-slate-100">
                                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Check In</span>
                                        <span className="text-2xl sm:text-3xl font-black text-slate-900 block leading-none">
                                            {checkInDate ? format(checkInDate, 'dd') : '--'}
                                            <span className="text-base sm:text-lg font-bold ml-1 text-slate-600">
                                                {checkInDate ? format(checkInDate, 'MMM') : 'Select'}
                                            </span>
                                        </span>
                                        <span className="text-xs font-semibold text-slate-500 block mt-1">
                                            {checkInDate ? format(checkInDate, 'EEEE') : 'Select Date'}
                                        </span>
                                        <ChevronDown className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
                                    </div>
                                ) : (
                                    <>
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
                                    </>
                                )}
                            </button>
                            
                            <button
                                className={isOta
                                    ? "flex-1 flex flex-col justify-center p-3 sm:p-4 bg-white rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.05)] text-left hover:bg-slate-50 transition-all relative min-h-[80px]"
                                    : "flex-1 flex items-center gap-3 p-4 rounded-[20px] border transition-all duration-300 text-left cursor-pointer hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 h-[68px]"
                                }
                                style={isOta ? {} : { 
                                    borderColor: (isCalendarOpen && activeDateType === 'checkOut') ? themeColor : 'rgba(226, 232, 240, 0.6)', 
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    boxShadow: (isCalendarOpen && activeDateType === 'checkOut') ? `0 0 0 4px ${themeColor}15` : undefined
                                }}
                                onClick={(e) => { 
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsGuestOpen(false); 
                                    setActiveDateType('checkOut'); 
                                    setIsCalendarOpen(true); 
                                    if (checkInDate) setDisplayMonth(startOfMonth(checkInDate));
                                }}
                            >
                                {isOta ? (
                                    <div className="px-1 sm:px-2 w-full pr-6">
                                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Check Out</span>
                                        <span className="text-2xl sm:text-3xl font-black text-slate-900 block leading-none">
                                            {checkOutDate ? format(checkOutDate, 'dd') : '--'}
                                            <span className="text-base sm:text-lg font-bold ml-1 text-slate-600">
                                                {checkOutDate ? format(checkOutDate, 'MMM') : 'Select'}
                                            </span>
                                        </span>
                                        <span className="text-xs font-semibold text-slate-500 block mt-1">
                                            {checkOutDate ? format(checkOutDate, 'EEEE') : 'Select Date'}
                                        </span>
                                    </div>
                                ) : (
                                    <>
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
                                    </>
                                )}
                            </button>
                        </div>
                    </PopoverAnchor>

                    {/* Desktop: anchored popover. Mobile: full-screen bottom sheet (below). */}
                    {!isMobile && (
                    <PopoverContent
                        className="p-0 bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col"
                        style={{ width: 'auto', maxWidth: '720px', boxSizing: 'border-box' }}
                        align="center"
                        sideOffset={8}
                        avoidCollisions={true}
                        collisionPadding={24}
                    >
                        {calendarPanel}
                    </PopoverContent>
                    )}
                </Popover>

                {/* Mobile: full-screen bottom sheet so the calendar is never clipped
                    by the popover/iframe and gets a clear sticky confirm CTA. */}
                {isMobile && isCalendarOpen && createPortal(
                    <div
                        className="fixed inset-0 z-[2147483646] bg-black/40 flex flex-col justify-end"
                        role="dialog"
                        aria-modal="true"
                        onClick={() => setIsCalendarOpen(false)}
                    >
                        <div
                            className="bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {calendarPanel}
                            <div className="border-t border-slate-100 p-3 shrink-0">
                                <button
                                    onClick={() => setIsCalendarOpen(false)}
                                    className="w-full py-3 rounded-2xl text-white font-extrabold text-sm tracking-wide shadow-md active:scale-[0.99] transition-transform"
                                    style={{ backgroundColor: themeColor }}
                                >
                                    {checkInDate && checkOutDate ? 'Done' : 'Select your dates'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Guests Configuration Popover */}
                <Popover open={isGuestOpen} onOpenChange={setIsGuestOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className={isOta
                                ? "flex-1 flex flex-col justify-center p-3 sm:p-4 bg-white rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.05)] text-left hover:bg-slate-50 transition-all relative min-h-[80px]"
                                : "flex-1 flex items-center gap-3 px-4 rounded-[20px] border transition-all duration-300 text-left cursor-pointer hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 h-[68px]"
                            }
                            style={isOta ? {} : { 
                                borderColor: isGuestOpen ? themeColor : 'rgba(226, 232, 240, 0.6)', 
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                boxShadow: isGuestOpen ? `0 0 0 4px ${themeColor}15` : undefined
                            }}
                            onClick={() => { setIsGuestOpen(!isGuestOpen); setIsCalendarOpen(false); }}
                        >
                            {isOta ? (
                                <div className="px-1 sm:px-2 w-full pr-6">
                                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Guests & Rooms</span>
                                    <span className="text-2xl sm:text-3xl font-black text-slate-900 block leading-none flex items-baseline gap-1">
                                        {adults + children}
                                        <span className="text-base sm:text-lg font-bold">{adults + children === 1 ? 'Guest' : 'Guests'}</span>
                                    </span>
                                    <span className="text-xs font-semibold text-slate-500 block mt-1 truncate">
                                        {roomsCount} Room{roomsCount !== 1 ? 's' : ''}
                                    </span>
                                    <ChevronDown className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
                                </div>
                            ) : (
                                <>
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                         style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{t('booking.search.guests')}</span>
                                        <span className="text-sm font-extrabold text-slate-800 block">
                                            {adults + children} {adults + children === 1 ? 'Guest' : 'Guests'}
                                        </span>
                                        <span className="text-xs text-slate-500 block truncate">
                                            {roomsCount} Room{roomsCount !== 1 ? 's' : ''}, {adults} Adult{adults !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <ChevronDown className="w-4 h-4 text-slate-400 ml-auto shrink-0"
                                                 style={{ transform: isGuestOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                </>
                            )}
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
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all" onClick={() => setRoomsCount(Math.min(5, roomsCount + 1))} disabled={roomsCount >= 5}>
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
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all" onClick={() => setAdults(Math.min(10, adults + 1))} disabled={adults >= 10}>
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
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all" onClick={() => setChildren(Math.min(6, children + 1))} disabled={children >= 6}>
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Promo Input */}
                {!isOta && showPromoCode && (
                    <div className="hidden md:flex w-40 flex-col justify-center px-4 rounded-[20px] border border-[rgba(226,232,240,0.6)] bg-[rgba(255,255,255,0.95)] transition-all duration-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 focus-within:border-slate-300 focus-within:shadow-[0_8px_20px_rgba(0,0,0,0.06)] focus-within:-translate-y-0.5 h-[68px]">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Promo Code</span>
                        <input 
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            placeholder="Optional"
                            className="bg-transparent border-0 font-extrabold text-sm p-0 focus:outline-none focus:ring-0 shadow-none placeholder:text-slate-300 text-slate-800 w-full"
                        />
                    </div>
                )}

                {/* Search Button */}
                <button
                    className={isOta
                        ? "h-[76px] sm:h-auto px-8 py-4 rounded-xl font-black text-xl flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(0,0,0,0.2)] transition-all duration-300 active:scale-[0.98] shrink-0 uppercase tracking-wide hover:shadow-[0_15px_35px_rgba(0,0,0,0.3)] hover:-translate-y-0.5"
                        : "h-[68px] px-10 rounded-[20px] text-white font-black text-[15px] flex items-center justify-center gap-2 shadow-[0_12px_30px_-5px_rgba(0,0,0,0.3)] hover:shadow-[0_18px_40px_-5px_rgba(0,0,0,0.4)] hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] transition-all duration-300 shrink-0 border border-white/20 backdrop-blur-md"
                    }
                    style={isOta
                        ? { backgroundColor: '#fff', color: themeColor }
                        : { backgroundImage: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` }
                    }
                    onClick={handleSearch}
                >
                    <Search className={isOta ? "w-6 h-6 stroke-[3]" : "w-5 h-5 stroke-[2.5] drop-shadow-sm"} />
                    Search
                </button>
            </div>

            {!hideAdvancedOptions && showFlexibleDates && (
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
            )}
        </div>
    );
}
