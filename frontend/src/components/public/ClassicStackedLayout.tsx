import React from 'react';
import { format } from 'date-fns';
import { Search, Calendar as CalendarIcon, Users, ChevronDown, Minus, Plus, ArrowRight, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

export function ClassicStackedLayout(props: any) {
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
            {/* 2. CLASSIC STACKED LAYOUT */}
            {layout === 'classic' && (
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 w-full max-w-md flex flex-col gap-4"
                     style={{ backgroundColor: bgColor }}>
                    <div className="text-center pb-2 border-b border-slate-100">
                        <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-200">
                            Book Your Stay
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">Select check-in & check-out dates</p>
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
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-1">Guests & Rooms</span>
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
