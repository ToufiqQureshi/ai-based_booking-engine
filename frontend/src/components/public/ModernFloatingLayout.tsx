import React from 'react';
import { format } from 'date-fns';
import { Search, Calendar as CalendarIcon, Users, ChevronDown, Minus, Plus, ArrowRight, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

export function ModernFloatingLayout(props: any) {
    const {
        config, setConfig, startingPrice, setStartingPrice, checkInDate, setCheckInDate,
        checkOutDate, setCheckOutDate, roomsCount, setRoomsCount, adults, setAdults,
        children, setChildren, promoCode, setPromoCode, isCalendarOpen, setIsCalendarOpen,
        isGuestOpen, setIsGuestOpen, isMobile, setIsMobile, handleSearch, updateParentIframeHeight,
        primaryHex, bgColor, isBgLight, widgetTheme, layout,
        widgetRef, calendarPopoverContent, guestPopoverContent
    } = props;
    return (
        <>
            {/* 1. MODERN FLOATING CARD LAYOUT (DEFAULT) */}
            {layout === 'modern' && isMobile && (
                /* ── MOBILE: vertical stack with INLINE calendar ── */
                <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] p-4 w-full flex flex-col gap-3 border border-white/60"
                     style={{ backgroundColor: bgColor === '#ffffff' || bgColor === '#fff' ? 'rgba(255,255,255,0.95)' : bgColor }}>

                    {/* Date trigger */}
                    <button
                        className="w-full flex flex-row items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left cursor-pointer hover:bg-slate-50/50"
                        style={{ borderColor: isCalendarOpen ? primaryHex : '#f1f5f9', backgroundColor: '#fff' }}
                        onClick={() => { setIsCalendarOpen(!isCalendarOpen); setIsGuestOpen(false); }}
                    >
                        <div className="flex-1 flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                 style={{ backgroundColor: `${primaryHex}18`, color: primaryHex }}>
                                <CalendarIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Check In</span>
                                <span className="text-xs font-extrabold text-slate-800 block truncate">
                                    {checkInDate ? format(checkInDate, "dd MMM yyyy") : "Select date"}
                                </span>
                            </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                        <div className="flex-1 flex items-center gap-2.5 pl-2 border-l border-slate-100 min-w-0">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                 style={{ backgroundColor: `${primaryHex}18`, color: primaryHex }}>
                                <CalendarIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Check Out</span>
                                <span className="text-xs font-extrabold text-slate-800 block truncate">
                                    {checkOutDate ? format(checkOutDate, "dd MMM yyyy") : "Select date"}
                                </span>
                            </div>
                        </div>
                    </button>

                    {/* Inline calendar — same theme as public booking page */}
                    {isCalendarOpen && (
                        <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.08)] calendar-container">
                            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Select Dates</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Tap check-in, then check-out</p>
                                </div>
                                <button onClick={() => setIsCalendarOpen(false)}
                                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                    <X className="w-4 h-4 text-slate-500" />
                                </button>
                            </div>
                            <div className="p-3">
                                <Calendar
                                    mode="range"
                                    numberOfMonths={1}
                                    selected={{ from: checkInDate, to: checkOutDate }}
                                    onSelect={(range: any) => {
                                        if (range?.from) setCheckInDate(range.from);
                                        if (range?.to) setCheckOutDate(range.to);
                                        if (range?.from && range?.to) setIsCalendarOpen(false);
                                    }}
                                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                    className="p-0"
                                    classNames={{
                                        cell: "h-11 w-11 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-xl [&:has([aria-selected].day-outside)]:custom-theme-bg-light [&:has([aria-selected])]:custom-theme-bg-light first:[&:has([aria-selected])]:rounded-l-xl last:[&:has([aria-selected])]:rounded-r-xl focus-within:relative focus-within:z-20",
                                        day: "h-11 w-11 p-0 font-normal group aria-selected:opacity-100 hover:bg-slate-100 rounded-xl transition-all",
                                        day_selected: "custom-theme-btn font-bold shadow-md",
                                        day_today: "custom-theme-text font-bold border border-slate-200 bg-slate-50",
                                        head_cell: "text-slate-500 font-black uppercase tracking-wider text-[10px] w-11 pb-2 text-center",
                                        caption: "flex justify-center py-2.5 px-3 relative items-center custom-theme-btn rounded-xl mb-3 shadow-sm",
                                        caption_label: "text-xs font-extrabold tracking-wide uppercase",
                                        nav_button: "h-7 w-7 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center p-0",
                                        months: "w-full"
                                    }}
                                    modifiersStyles={{
                                        selected: { backgroundColor: primaryHex, color: '#fff' }
                                    }}
                                    components={{
                                        DayContent: ({ date }: any) => {
                                            const todayObj = new Date(new Date().setHours(0, 0, 0, 0));
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
                                <div className="border-t border-slate-100 pt-3 mt-2 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5 font-bold tracking-wide">
                                    <X className="w-3.5 h-3.5 text-red-500 stroke-[3]" /> SOLD OUT &nbsp;·&nbsp; Weekend rates slightly higher
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Guests inline */}
                    <div className="w-full">
                        <button
                            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left cursor-pointer hover:bg-slate-50/50"
                            style={{ borderColor: isGuestOpen ? primaryHex : '#f1f5f9', backgroundColor: '#fff' }}
                            onClick={() => { setIsGuestOpen(!isGuestOpen); setIsCalendarOpen(false); }}
                        >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                 style={{ backgroundColor: `${primaryHex}18`, color: primaryHex }}>
                                <Users className="w-4 h-4" />
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Guests &amp; Rooms</span>
                                <span className="text-xs font-extrabold text-slate-800 block">
                                    {adults + children} Guest{adults + children !== 1 ? 's' : ''} · {roomsCount} Room{roomsCount !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <ChevronDown className="w-4 h-4 text-slate-400 ml-auto shrink-0"
                                         style={{ transform: isGuestOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>
                        {isGuestOpen && (
                            <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                                {([['Rooms', roomsCount, setRoomsCount, 1, 5],
                                   ['Adults', adults, setAdults, 1, 10],
                                   ['Children', children, setChildren, 0, 6]] as const).map(([label, val, setter, min, max]) => (
                                    <div key={label as string} className="flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-sm text-slate-900">{label as string}</p>
                                            <p className="text-[10px] text-slate-400">
                                                {label === 'Rooms' ? 'Total rooms' : label === 'Adults' ? 'Ages 13+' : 'Ages 0–12'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                            <button className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white transition-all disabled:opacity-40"
                                                    onClick={() => (setter as any)(Math.max(min as number, (val as number) - 1))}
                                                    disabled={(val as number) <= (min as number)}>
                                                <Minus className="h-3 w-3 text-slate-700" />
                                            </button>
                                            <span className="w-5 text-center text-sm font-black text-slate-900">{val as number}</span>
                                            <button className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white transition-all disabled:opacity-40"
                                                    onClick={() => (setter as any)(Math.min(max as number, (val as number) + 1))}
                                                    disabled={(val as number) >= (max as number)}>
                                                <Plus className="h-3 w-3 text-slate-700" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Search button */}
                    <button
                        className="w-full h-[60px] mt-1 rounded-2xl text-white font-black text-[15px] tracking-wide flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_25px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all"
                        style={{ backgroundImage: `linear-gradient(135deg, ${primaryHex}, ${primaryHex}dd)` }}
                        onClick={handleSearch}
                    >
                        <Search className="w-5 h-5" />
                        Search Available Rooms
                    </button>
                </div>
            )}

            {layout === 'modern' && !isMobile && (
                /* ── DESKTOP: inline accordion — no Popover needed ── */
                <div className="bg-white/90 backdrop-blur-2xl rounded-[32px] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.15)] p-4 w-full max-w-6xl flex flex-col gap-3 border border-white/60"
                     style={{ backgroundColor: bgColor === '#ffffff' || bgColor === '#fff' ? 'rgba(255,255,255,0.92)' : bgColor }}>

                    {/* Top row: date + guests + promo + search */}
                    <div className="flex flex-row items-center gap-3">
                        {/* Date trigger */}
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    className="flex-[2] flex flex-row items-center gap-3 p-4 rounded-[20px] border-2 transition-all text-left cursor-pointer hover:bg-slate-50/60"
                                    style={{ borderColor: isCalendarOpen ? primaryHex : '#f1f5f9', backgroundColor: '#fff' }}
                                >
                                    <div className="flex-1 flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                             style={{ backgroundColor: `${primaryHex}15`, color: primaryHex }}>
                                            <CalendarIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Check In</span>
                                            <span className="text-sm font-extrabold text-slate-800 block">
                                                {checkInDate ? format(checkInDate, "dd MMM yyyy") : "Select Date"}
                                            </span>
                                            <span className="text-xs text-slate-500">{checkInDate ? format(checkInDate, "EEEE") : "Add date"}</span>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-slate-300 shrink-0" />
                                    <div className="flex-1 flex items-center gap-3 pl-3 border-l border-slate-100 min-w-0">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                             style={{ backgroundColor: `${primaryHex}15`, color: primaryHex }}>
                                            <CalendarIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Check Out</span>
                                            <span className="text-sm font-extrabold text-slate-800 block">
                                                {checkOutDate ? format(checkOutDate, "dd MMM yyyy") : "Select Date"}
                                            </span>
                                            <span className="text-xs text-slate-500">{checkOutDate ? format(checkOutDate, "EEEE") : "Add date"}</span>
                                        </div>
                                    </div>
                                </button>
                            </PopoverTrigger>
                            {calendarPopoverContent}
                        </Popover>

                        {/* Guests trigger */}
                        <Popover open={isGuestOpen} onOpenChange={setIsGuestOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    className="flex-1 flex items-center gap-3 p-4 rounded-[20px] border-2 transition-all text-left cursor-pointer hover:bg-slate-50/60"
                                    style={{ borderColor: isGuestOpen ? primaryHex : '#f1f5f9', backgroundColor: '#fff' }}
                                >
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                         style={{ backgroundColor: `${primaryHex}15`, color: primaryHex }}>
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Guests &amp; Rooms</span>
                                        <span className="text-sm font-extrabold text-slate-800 block">
                                            {adults + children} {adults + children === 1 ? 'Guest' : 'Guests'}
                                        </span>
                                        <span className="text-xs text-slate-500">{roomsCount} Room{roomsCount !== 1 ? 's' : ''}, {adults} Adult{adults !== 1 ? 's' : ''}</span>
                                    </div>
                                    <ChevronDown className="w-4 h-4 text-slate-400 ml-auto shrink-0"
                                                 style={{ transform: isGuestOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                </button>
                            </PopoverTrigger>
                            {guestPopoverContent}
                        </Popover>

                        {/* Promo */}
                        <div className="w-40 flex flex-col justify-center p-4 rounded-[20px] border-2 border-[#f1f5f9] bg-white transition-all hover:bg-slate-50/60 focus-within:border-slate-300">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Promo Code</span>
                            <input
                                className="bg-transparent border-0 font-extrabold text-sm p-0 focus:outline-none placeholder:text-slate-300 text-slate-800 w-full"
                                placeholder="Optional"
                                value={promoCode}
                                onChange={(e) => setPromoCode(e.target.value)}
                            />
                        </div>

                        {/* Search button */}
                        <button
                            className="h-[76px] px-10 rounded-[20px] text-white font-black text-[15px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_25px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all shrink-0"
                            style={{ backgroundImage: `linear-gradient(135deg, ${primaryHex}, ${primaryHex}dd)` }}
                            onClick={handleSearch}
                        >
                            <Search className="w-5 h-5" />
                            Search
                        </button>
                    </div>


                </div>
            )}


            {layout === 'floating' && !isMobile && (
                <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-4 w-full max-w-6xl flex flex-row items-center gap-4 border border-white/80 ring-1 ring-slate-100"
                     style={{ backgroundColor: bgColor }}>

                    {/* Date Group */}
                    <div className="flex-[2]">
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                                <button className="w-full flex flex-row items-center gap-3 p-4 rounded-2xl border border-slate-200 custom-theme-border hover:shadow-md transition-all text-left cursor-pointer"
                                        style={{ backgroundColor: bgColor === '#ffffff' ? '#ffffff' : 'rgba(255,255,255,0.7)' }}>
                                    <div className="flex-1 flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                             style={{ backgroundColor: `${primaryHex}15`, color: primaryHex }}>
                                            <CalendarIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Check In</span>
                                            <span className="text-sm font-extrabold text-slate-800 block">
                                                {checkInDate ? format(checkInDate, "dd MMM yyyy") : "Select Date"}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {checkInDate ? format(checkInDate, "EEEE") : "Day"}
                                            </span>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-slate-300" />
                                    <div className="flex-1 flex items-center gap-3 pl-3 border-l border-slate-100 min-w-0">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                             style={{ backgroundColor: `${primaryHex}15`, color: primaryHex }}>
                                            <CalendarIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Check Out</span>
                                            <span className="text-sm font-extrabold text-slate-800 block">
                                                {checkOutDate ? format(checkOutDate, "dd MMM yyyy") : "Select Date"}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {checkOutDate ? format(checkOutDate, "EEEE") : "Day"}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            </PopoverTrigger>
                            {calendarPopoverContent}
                        </Popover>
                    </div>

                    {/* Guests */}
                    <div className="flex-1">
                        <Popover open={isGuestOpen} onOpenChange={setIsGuestOpen}>
                            <PopoverTrigger asChild>
                                <button className="w-full flex items-center gap-3 p-4 rounded-2xl border border-slate-200 custom-theme-border hover:shadow-md transition-all text-left cursor-pointer"
                                        style={{ backgroundColor: bgColor === '#ffffff' ? '#ffffff' : 'rgba(255,255,255,0.7)' }}>
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                         style={{ backgroundColor: `${primaryHex}15`, color: primaryHex }}>
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Guests &amp; Rooms</span>
                                        <span className="text-sm font-extrabold text-slate-800 block">
                                            {adults + children} {adults + children === 1 ? 'Guest' : 'Guests'}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {roomsCount} Room{roomsCount !== 1 ? 's' : ''}, {adults} Adult{adults !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </button>
                            </PopoverTrigger>
                            {guestPopoverContent}
                        </Popover>
                    </div>

                    {/* Promo */}
                    <div className="w-44 flex flex-col justify-center p-4 rounded-2xl border border-slate-200"
                         style={{ backgroundColor: bgColor === '#ffffff' ? '#ffffff' : 'rgba(255,255,255,0.7)' }}>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Promo Code</span>
                        <input
                            className="bg-transparent border-0 font-extrabold text-sm p-0 focus:outline-none placeholder:text-slate-400 text-slate-800 w-full"
                            placeholder="Optional code"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                        />
                    </div>

                    {/* Search */}
                    <button
                        className="h-16 px-8 rounded-2xl text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-xl hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
                        style={{ backgroundColor: primaryHex }}
                        onClick={handleSearch}
                    >
                        <Search className="w-5 h-5" />
                        Search
                    </button>
                </div>
            )}

        </>
    );
}
