import { format } from 'date-fns';
import { Search, Calendar as CalendarIcon, Users, ChevronDown, Minus, Plus, ArrowRight, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

// ═══════════════════════════════════════════════════════════════════════════
// 1. MODERN FLOATING CARD LAYOUT (DEFAULT)
// ═══════════════════════════════════════════════════════════════════════════

export function ModernFloatingLayout(props: any) {
    const {
        config, startingPrice, checkInDate, setCheckInDate,
        checkOutDate, setCheckOutDate, roomsCount, setRoomsCount, adults, setAdults,
        children, setChildren, promoCode, setPromoCode, isCalendarOpen, setIsCalendarOpen,
        isGuestOpen, setIsGuestOpen, isMobile, handleSearch,
        primaryHex, bgColor, isBgLight, widgetTheme, layout,
        calendarPopoverContent, guestPopoverContent
    } = props;
    return (
        <>
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
                                        setCheckInDate(range?.from);
                                        setCheckOutDate(range?.to);
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
                                            const showPrice = !isPast && startingPrice > 0;
                                            return (
                                                <div className="flex flex-col items-center justify-center h-full w-full p-0.5">
                                                    <span className="text-xs font-bold leading-none">{date.getDate()}</span>
                                                    {showPrice && (
                                                        <span className="text-[9px] font-extrabold leading-none mt-1 text-emerald-600 group-aria-selected:text-white group-hover:text-emerald-700 font-bold">
                                                            ₹{startingPrice}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        }
                                    }}
                                />
                                <div className="border-t border-slate-100 pt-3 mt-2 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5 font-bold tracking-wide">
                                    Starting (&ldquo;from&rdquo;) rates &middot; final price &amp; availability confirmed at the next step
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

                    {/* Promo Code inline */}
                    <div className="w-full flex items-center p-3.5 rounded-2xl border-2 transition-all bg-white" style={{ borderColor: '#f1f5f9' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${primaryHex}18`, color: primaryHex }}>
                            <span className="font-bold">%</span>
                        </div>
                        <div className="flex-1 ml-3">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Promo Code</span>
                            <input
                                className="bg-transparent border-0 font-extrabold text-xs focus:outline-none placeholder:text-slate-300 text-slate-800 w-full p-0 mt-0.5"
                                placeholder="Enter optional code"
                                value={promoCode}
                                onChange={(e) => setPromoCode(e.target.value)}
                            />
                        </div>
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


// ═══════════════════════════════════════════════════════════════════════════
// 2. CLASSIC STACKED LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

export function ClassicStackedLayout(props: any) {
    const {
        checkInDate, checkOutDate, roomsCount, adults,
        children, promoCode, setPromoCode, isCalendarOpen, setIsCalendarOpen,
        isGuestOpen, setIsGuestOpen, handleSearch,
        primaryHex, bgColor, layout,
        calendarPopoverContent, guestPopoverContent
    } = props;
    return (
        <>
            {layout === 'classic' && (
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 w-full max-w-md flex flex-col gap-4"
                     style={{ backgroundColor: bgColor }}>
                    <div className="text-center pb-2 border-b border-slate-100">
                        <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-200">
                            Book Your Stay
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">Select check-in &amp; check-out dates</p>
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-col text-left">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-1">Dates</span>
                            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                <PopoverTrigger asChild>
                                    <button className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-primary transition-all text-left bg-white text-slate-800 cursor-pointer"
                                            style={{ backgroundColor: bgColor === '#ffffff' ? '#ffffff' : 'rgba(255,255,255,0.7)' }}>
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className="w-4 h-4 custom-theme-text" />
                                            <span className="text-xs font-extrabold">
                                                {checkInDate ? format(checkInDate, "dd MMM yyyy") : "Check In"}
                                            </span>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-300" />
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-extrabold">
                                                {checkOutDate ? format(checkOutDate, "dd MMM yyyy") : "Check Out"}
                                            </span>
                                            <CalendarIcon className="w-4 h-4 custom-theme-text" />
                                        </div>
                                    </button>
                                </PopoverTrigger>
                                {calendarPopoverContent}
                            </Popover>
                        </div>

                        <div className="flex flex-col text-left">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-1">Guests &amp; Rooms</span>
                            <Popover open={isGuestOpen} onOpenChange={setIsGuestOpen}>
                                <PopoverTrigger asChild>
                                    <button className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-primary transition-all text-left bg-white text-slate-800 cursor-pointer"
                                            style={{ backgroundColor: bgColor === '#ffffff' ? '#ffffff' : 'rgba(255,255,255,0.7)' }}>
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 custom-theme-text" />
                                            <span className="text-xs font-extrabold">
                                                {adults + children} Guest{adults + children > 1 ? 's' : ''} / {roomsCount} Room{roomsCount > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <Plus className="w-4 h-4 text-slate-400" />
                                    </button>
                                </PopoverTrigger>
                                {guestPopoverContent}
                            </Popover>
                        </div>

                        <div className="flex flex-col text-left">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-1">Promo Code</span>
                            <div className="flex items-center p-3.5 rounded-xl border border-slate-200 bg-white"
                                 style={{ backgroundColor: bgColor === '#ffffff' ? '#ffffff' : 'rgba(255,255,255,0.7)' }}>
                                <input
                                    className="bg-transparent border-0 font-extrabold text-xs focus:outline-none placeholder:text-slate-400 placeholder:font-medium text-slate-800 w-full"
                                    placeholder="Enter optional code"
                                    value={promoCode}
                                    onChange={(e) => setPromoCode(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <Button
                        className="w-full py-4 h-12 rounded-xl custom-theme-btn font-extrabold text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border-0 mt-2"
                        onClick={handleSearch}
                    >
                        <Search className="w-4 h-4" />
                        Search Rooms / Packages
                    </Button>
                </div>
            )}
        </>
    );
}


// ═══════════════════════════════════════════════════════════════════════════
// 3. MINIMAL BAR LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

export function MinimalBarLayout(props: any) {
    const {
        checkInDate, checkOutDate, roomsCount, adults,
        children, promoCode, setPromoCode, isCalendarOpen, setIsCalendarOpen,
        isGuestOpen, setIsGuestOpen, handleSearch,
        primaryHex, bgColor, layout,
        calendarPopoverContent, guestPopoverContent
    } = props;
    return (
        <>
            {layout === 'minimal' && (
                <div className="w-full max-w-5xl flex flex-col sm:flex-row items-center gap-4 py-2 px-4 border-b border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-950/40 rounded-xl"
                     style={{ backgroundColor: bgColor === '#ffffff' ? 'transparent' : bgColor }}>
                    
                    {/* Dates */}
                    <div className="flex-1 w-full text-left">
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                                <button className="w-full flex items-center justify-between py-1 px-2 text-left bg-transparent text-slate-800 dark:text-slate-200 cursor-pointer">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Select Dates</span>
                                        <span className="text-xs font-extrabold">
                                            {checkInDate ? format(checkInDate, "dd MMM") : "In"} - {checkOutDate ? format(checkOutDate, "dd MMM") : "Out"}
                                        </span>
                                    </div>
                                    <CalendarIcon className="w-4 h-4 custom-theme-text" />
                                </button>
                            </PopoverTrigger>
                            {calendarPopoverContent}
                        </Popover>
                    </div>

                    <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-800" />

                    {/* Guests */}
                    <div className="flex-1 w-full text-left">
                        <Popover open={isGuestOpen} onOpenChange={setIsGuestOpen}>
                            <PopoverTrigger asChild>
                                <button className="w-full flex items-center justify-between py-1 px-2 text-left bg-transparent text-slate-800 dark:text-slate-200 cursor-pointer">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Guests & Rooms</span>
                                        <span className="text-xs font-extrabold">
                                            {adults + children} Guest{adults + children > 1 ? 's' : ''}, {roomsCount} R
                                        </span>
                                    </div>
                                    <Users className="w-4 h-4 custom-theme-text" />
                                </button>
                            </PopoverTrigger>
                            {guestPopoverContent}
                        </Popover>
                    </div>

                    <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-800" />

                    {/* Promo */}
                    <div className="w-full sm:w-32 flex flex-col justify-center text-left py-1 px-2">
                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Promo Code</span>
                        <input
                            className="bg-transparent border-0 font-extrabold text-xs focus:outline-none placeholder:text-slate-400 placeholder:font-medium text-slate-800 dark:text-slate-100 w-full"
                            placeholder="Optional code"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                        />
                    </div>

                    {/* Button */}
                    <Button
                        className="w-full sm:w-auto px-6 h-10 rounded-lg custom-theme-btn font-extrabold text-xs shadow-sm hover:shadow hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0"
                        onClick={handleSearch}
                    >
                        <Search className="w-3.5 h-3.5" />
                        Search
                    </Button>
                </div>
            )}
        </>
    );
}


// ═══════════════════════════════════════════════════════════════════════════
// 4. PREMIUM CAPSULE LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

export function PremiumCapsuleLayout(props: any) {
    const {
        checkInDate, checkOutDate, adults,
        children, promoCode, setPromoCode, isCalendarOpen, setIsCalendarOpen,
        isGuestOpen, setIsGuestOpen, handleSearch,
        primaryHex, bgColor, layout,
        calendarPopoverContent, guestPopoverContent
    } = props;
    return (
        <>
            {layout === 'premium' && (
                <div className="w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-2 p-2 sm:p-2 bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl sm:rounded-full shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)] border border-slate-700/50"
                     style={{ backgroundColor: bgColor === '#ffffff' ? 'rgba(15,23,42,0.95)' : bgColor }}>
                    
                    {/* Dates */}
                    <div className="flex-[1.5] w-full text-left pl-2 sm:pl-6 py-2">
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                                <button className="w-full flex items-center gap-4 text-left bg-transparent text-slate-100 cursor-pointer group">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                                         style={{ backgroundColor: `${primaryHex}20`, color: primaryHex }}>
                                        <CalendarIcon className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col flex-1">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-hover:text-slate-300 transition-colors">Dates</span>
                                        <span className="text-sm font-extrabold tracking-wide">
                                            {checkInDate ? format(checkInDate, "dd MMM") : "Check In"} – {checkOutDate ? format(checkOutDate, "dd MMM") : "Out"}
                                        </span>
                                    </div>
                                </button>
                            </PopoverTrigger>
                            {calendarPopoverContent}
                        </Popover>
                    </div>

                    <div className="hidden sm:block h-10 w-px bg-slate-700/50" />

                    {/* Guests */}
                    <div className="flex-1 w-full text-left pl-2 py-2">
                        <Popover open={isGuestOpen} onOpenChange={setIsGuestOpen}>
                            <PopoverTrigger asChild>
                                <button className="w-full flex items-center gap-4 text-left bg-transparent text-slate-100 cursor-pointer group">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                                         style={{ backgroundColor: `${primaryHex}20`, color: primaryHex }}>
                                        <Users className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-hover:text-slate-300 transition-colors">Guests</span>
                                        <span className="text-sm font-extrabold tracking-wide">
                                            {adults + children} Guest{adults + children > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </button>
                            </PopoverTrigger>
                            {guestPopoverContent}
                        </Popover>
                    </div>

                    <div className="hidden sm:block h-10 w-px bg-slate-700/50" />

                    {/* Promo */}
                    <div className="w-full sm:w-40 flex flex-col justify-center text-left pl-2 py-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-0.5">Promo</span>
                        <input
                            className="bg-transparent border-0 font-extrabold text-sm focus:outline-none placeholder:text-slate-500 text-slate-100 w-full"
                            placeholder="Optional code"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                        />
                    </div>

                    {/* Button */}
                    <Button
                        className="w-full sm:w-auto px-8 h-14 sm:h-14 rounded-2xl sm:rounded-full font-extrabold text-sm shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border-0 sm:ml-2 mt-2 sm:mt-0"
                        style={{ backgroundColor: primaryHex, color: '#fff' }}
                        onClick={handleSearch}
                    >
                        <Search className="w-4 h-4" />
                        Search
                    </Button>
                </div>
            )}
        </>
    );
}
