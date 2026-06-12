import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { useTheme } from '@/contexts/ThemeContext';
import { PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { X, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function useBookingWidgetState() {
    const { hotelSlug } = useParams<{ hotelSlug: string }>();
    const updateParentIframeHeight = () => {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [config, setConfig] = useState<any>(null); // Config state kept for future extensibility
    const [startingPrice, setStartingPrice] = useState<number>(4200);

    // Fetch Widget Configuration and Starting Price
    useEffect(() => {
        if (!hotelSlug) return;
        const getApiUrl = () => {
            const hostname = window.location.hostname;
            if (hostname.includes('staybooker.ai')) {
                return 'https://api.staybooker.ai/api/v1';
            }
            if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
            return 'https://ai-basedbooking-engine-production.up.railway.app/api/v1';
        };
        const apiUrl = getApiUrl();

        // Fetch config
        fetch(`${apiUrl}/public/hotels/slug/${hotelSlug}/widget-config`)
            .then(res => {
                if (res.ok) return res.json();
                throw new Error("Failed to fetch config");
            })
            .then(data => setConfig(data))
            .catch(() => {
                setConfig({}); // Fallback to empty object to allow default settings rendering
            });

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
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isGuestOpen, setIsGuestOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Dynamic Resizing Logic — use ResizeObserver to send ACTUAL height
    const widgetRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = widgetRef.current;
        if (!el) return;

        const sendHeight = () => {
            let height = el.scrollHeight + 16; // +16px breathing room
            const isOpen = isCalendarOpen || isGuestOpen;
            if (isOpen) {
                height = Math.max(height, 860);
            }
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'RESIZE_OVERLAY', height }, '*');
                window.parent.postMessage({ type: 'RESIZE_SEARCH_WIDGET', height }, '*');
            }
        };

        // Send height immediately
        sendHeight();

        // Watch for any layout changes
        const observer = new ResizeObserver(sendHeight);
        observer.observe(el);
        return () => observer.disconnect();
    }, [isCalendarOpen, isGuestOpen, config?.widget_layout, isMobile]);

    // Custom JS Code execution inside widget frame
    useEffect(() => {
        if (config?.widget_custom_js) {
            try {
                // Safely evaluate custom JS in the widget context
                const runJs = new Function('config', config.widget_custom_js);
                runJs(config);
            } catch (err) {
                console.error("Error executing widget custom JavaScript:", err);
            }
        }
    }, [config]);

    const handleSearch = () => {
        // Require a valid date range before navigating — never send an empty or
        // inverted range downstream (which would render an empty results page).
        if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
            setIsCalendarOpen(true);
            return;
        }
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

    const urlParams = new URLSearchParams(window.location.search);

    const getNormalizedColor = (col?: string | null) => {
        return col || '#7c3aed';
    };
    const primaryHex = getNormalizedColor(urlParams.get('preview_primary_color') || config?.primary_color);
    const bgColor = urlParams.get('preview_bg_color') || config?.widget_background_color || '#ffffff';
    const widgetTheme = urlParams.get('preview_theme') || config?.widget_theme || 'light';
    const isBgLight = bgColor.toLowerCase() === '#ffffff' || bgColor.toLowerCase() === '#fff' || bgColor.toLowerCase() === '#f8fafc';

    // Calendar popover — same design as public booking page
    const calendarPopoverContent = (
        <PopoverContent
            className="p-0 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-100 overflow-hidden calendar-container"
            style={{ width: isMobile ? 'calc(100vw - 32px)' : 'auto', maxWidth: '720px', transform: 'translateZ(0)', willChange: 'transform, opacity' }}
            align="center"
            side="top"
            avoidCollisions={true}
            sideOffset={8}
        >
            {/* Header */}
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
                <Calendar
                    mode="range"
                    numberOfMonths={isMobile ? 1 : 2}
                    selected={{ from: checkInDate, to: checkOutDate }}
                    onSelect={(range: any) => {
                        if (range?.from) setCheckInDate(range.from);
                        if (range?.to) setCheckOutDate(range.to);
                        if (range?.from && range?.to) setIsCalendarOpen(false);
                    }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    className="p-0"
                    classNames={{
                        cell: "h-9 w-9 sm:h-11 sm:w-11 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-xl [&:has([aria-selected].day-outside)]:custom-theme-bg-light [&:has([aria-selected])]:custom-theme-bg-light first:[&:has([aria-selected])]:rounded-l-xl last:[&:has([aria-selected])]:rounded-r-xl focus-within:relative focus-within:z-20",
                        day: "h-9 w-9 sm:h-11 sm:w-11 p-0 font-normal group aria-selected:opacity-100 hover:bg-slate-100 rounded-xl transition-all",
                        day_selected: "custom-theme-btn font-bold shadow-md",
                        day_today: "custom-theme-text font-bold border border-slate-200 bg-slate-50",
                        head_cell: "text-slate-500 font-black uppercase tracking-wider text-[10px] w-9 sm:w-11 pb-2 text-center",
                        caption: "flex justify-center py-2.5 px-3 relative items-center custom-theme-btn rounded-xl mb-3 shadow-sm",
                        caption_label: "text-xs font-extrabold tracking-wide uppercase",
                        nav_button: "h-7 w-7 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center p-0",
                        months: "flex flex-col md:flex-row space-y-3 md:space-x-4 md:space-y-0"
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
        </PopoverContent>
    );


    const guestPopoverContent = (
        <PopoverContent className="w-80 p-6 bg-white text-slate-800 border-slate-100 shadow-2xl rounded-3xl" style={{ transform: 'translateZ(0)', willChange: 'transform, opacity' }} align="center" side="top" avoidCollisions={true}>
            <div className="space-y-6">
                {/* Rooms Counter */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-bold text-sm text-slate-900 text-left">Rooms</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-left">Total Rooms</p>
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
                        <p className="font-bold text-sm text-slate-900 text-left">Adults</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-left">Ages 13+</p>
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
                        <p className="font-bold text-sm text-slate-900 text-left">Children</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-left">Ages 0-12</p>
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
    );

    const layout = urlParams.get('preview_layout') || config?.widget_layout || 'modern';

    if (config === null) {
        return null; // Prevents flashing of default layout before config is fetched
    }
    return {
        config, setConfig, startingPrice, setStartingPrice, checkInDate, setCheckInDate,
        checkOutDate, setCheckOutDate, roomsCount, setRoomsCount, adults, setAdults,
        children, setChildren, promoCode, setPromoCode, isCalendarOpen, setIsCalendarOpen,
        isGuestOpen, setIsGuestOpen, isMobile, setIsMobile, handleSearch, updateParentIframeHeight,
        primaryHex, bgColor, isBgLight, widgetTheme, layout,
        widgetRef, calendarPopoverContent, guestPopoverContent
    };
}
