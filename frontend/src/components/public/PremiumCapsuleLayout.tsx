import React from 'react';
import { format } from 'date-fns';
import { Search, Calendar as CalendarIcon, Users, ChevronDown, Minus, Plus, ArrowRight, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export function PremiumCapsuleLayout(props: any) {
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
            {/* 4. PREMIUM CAPSULE LAYOUT */}
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
