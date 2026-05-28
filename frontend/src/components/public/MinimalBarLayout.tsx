import React from 'react';
import { format } from 'date-fns';
import { Search, Calendar as CalendarIcon, Users, ChevronDown, Minus, Plus, ArrowRight, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export function MinimalBarLayout(props: any) {
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
            {/* 3. MINIMAL BAR LAYOUT */}
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

                    {/* Divider */}
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

                    {/* Divider */}
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
