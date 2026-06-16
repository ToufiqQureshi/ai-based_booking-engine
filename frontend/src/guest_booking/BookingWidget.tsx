import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { format, addDays, addMonths, startOfMonth } from 'date-fns';
import { Minus, Plus, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import {
    PopoverContent,
} from '@/components/ui/popover';
import { cn } from '@/core/lib/utils';

import { RoomSearchHeader } from '@/guest_booking/components/public/booking/RoomSearchHeader';
import { FARWidget } from '@/guest_booking/components/public/FARWidget';

// Embedding (hotelier) page ka origin referrer se nikaalte hain taaki
// postMessage wildcard '*' pe broadcast na ho
const PARENT_ORIGIN: string = (() => {
    try {
        return document.referrer ? new URL(document.referrer).origin : '*';
    } catch {
        return '*';
    }
})();

const API_BASE_URL = window.location.hostname.includes('staybooker.ai')
    ? 'https://api.staybooker.ai/api/v1'
    : (import.meta.env.VITE_API_URL as string | undefined) || 'https://ai-basedbooking-engine-production.up.railway.app/api/v1';

export default function BookingWidget() {
    const { hotelSlug } = useParams<{ hotelSlug: string }>();
    const [config, setConfig] = useState<any>(null);
    // 0 = abhi pata nahi; kabhi bhi fake placeholder price guest ko mat dikhao
    const [startingPrice, setStartingPrice] = useState<number>(0);
    const [calendarData, setCalendarData] = useState<Record<string, any>>({});
    const [displayMonth, setDisplayMonth] = useState<Date>(startOfMonth(new Date()));
    const fetchedMonths = useRef<Set<string>>(new Set());
    
    // Add refresh trigger for SSE updates
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // SSE Listener for real-time config & rate updates
    useEffect(() => {
        if (!hotelSlug) return;
        let es: EventSource | null = null;

        fetch(`${API_BASE_URL}/public/hotels/${hotelSlug}`)
            .then(res => res.json())
            .then(hotel => {
                if (hotel?.id) {
                    es = new EventSource(`${API_BASE_URL}/public/hotels/${hotel.id}/rate-updates`);
                    es.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data);
                            if (data.type === 'hotel_update' || data.type === 'rate_update') {
                                setRefreshTrigger(t => t + 1);
                                fetchedMonths.current.clear();
                            }
                        } catch (_) {}
                    };
                }
            })
            .catch(() => {});

        return () => {
            if (es) es.close();
        };
    }, [hotelSlug]);

    // Fetch Widget Configuration and Starting Price
    useEffect(() => {
        if (!hotelSlug) return;

        // Fetch config
        fetch(`${API_BASE_URL}/public/hotels/slug/${hotelSlug}/widget-config`)
            .then(res => {
                if (res.ok) return res.json();
                throw new Error("Failed to fetch config");
            })
            .then(data => setConfig(data))
            .catch(() => {
                setConfig({}); // Fallback to empty object to allow default settings rendering
            });

        // Fetch rooms to calculate live starting price and extract room types for filter dropdown
        const checkInStr = format(new Date(), 'yyyy-MM-dd');
        const checkOutStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        fetch(`${API_BASE_URL}/public/hotels/${hotelSlug}/rooms?check_in=${checkInStr}&check_out=${checkOutStr}`)
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
                    // Extract unique room types for the filter dropdown
                    const seen = new Set<string>();
                    const types: Array<{ id: string; name: string }> = [];
                    rooms.forEach(r => {
                        if (r.id && r.name && !seen.has(r.id)) {
                            seen.add(r.id);
                            types.push({ id: r.id, name: r.name });
                        }
                    });
                    setRoomTypes(types);
                }
            })
            .catch(err => console.error("Failed to fetch rooms for widget price:", err));
    }, [hotelSlug, refreshTrigger]);

    // Ensure iframe body is transparent
    useEffect(() => {
        document.body.style.backgroundColor = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';
        return () => {
            document.body.style.backgroundColor = '';
            document.documentElement.style.backgroundColor = '';
        };
    }, []);

    // Fetch calendar rates dynamically
    useEffect(() => {
        if (!hotelSlug) return;

        const fetchMonth = async (monthStr: string) => {
            try {
                const res = await fetch(`${API_BASE_URL}/public/hotels/${hotelSlug}/calendar?month=${monthStr}`);
                if (res.ok) {
                    const data = await res.json();
                    setCalendarData(prev => ({ ...prev, ...data }));
                }
            } catch (err) {
                console.error("Failed to fetch calendar month:", err);
            }
        };

        const months = [
            format(displayMonth, 'yyyy-MM'),
            format(addMonths(displayMonth, 1), 'yyyy-MM'),
        ];

        months.forEach(m => {
            if (!fetchedMonths.current.has(m)) {
                fetchedMonths.current.add(m);
                fetchMonth(m);
            }
        });
    }, [hotelSlug, displayMonth, refreshTrigger]);

    // State
    const [checkInDate, setCheckInDate] = useState<Date | undefined>(new Date());
    const [checkOutDate, setCheckOutDate] = useState<Date | undefined>(addDays(new Date(), 1));
    const [roomsCount, setRoomsCount] = useState(1);
    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);
    const [promoCode, setPromoCode] = useState('');
    const [searchType, setSearchType] = useState<'room' | 'package'>('room');
    const [flexibleDates, setFlexibleDates] = useState(false);
    // Room types extracted from rooms fetch — for filter dropdown
    const [roomTypes, setRoomTypes] = useState<Array<{ id: string; name: string }>>([]);
    const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>('');

    // Apply advance_purchase_days and min_nights from config once loaded
    useEffect(() => {
        if (!config) return;
        const advanceDays = config.advance_purchase_days ?? 0;
        const minNights = config.min_nights ?? 1;
        const newCheckIn = addDays(new Date(), advanceDays);
        setCheckInDate(newCheckIn);
        setCheckOutDate(addDays(newCheckIn, Math.max(minNights, 1)));
    }, [config?.advance_purchase_days, config?.min_nights]); // eslint-disable-line react-hooks/exhaustive-deps

    // Calendar UI State
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isGuestOpen, setIsGuestOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    // widgetWidth tracks the widget container's own width — used for
    // responsive calendar sizing inside iframes (window.innerWidth = host page)
    const [widgetWidth, setWidgetWidth] = useState(720);

    // Refs — declared before effects that use them
    const widgetRef = useRef<HTMLDivElement>(null);
    const lastHeightRef = useRef(0);

    // Use ResizeObserver on the widget's own container — not window.innerWidth —
    // so that breakpoints work correctly when embedded in any host site iframe.
    useEffect(() => {
        const el = widgetRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width ?? el.getBoundingClientRect().width;
            setWidgetWidth(w);
            setIsMobile(w < 640);
        });
        ro.observe(el);
        // Initial measure
        const w = el.getBoundingClientRect().width;
        if (w > 0) { setWidgetWidth(w); setIsMobile(w < 640); }
        return () => ro.disconnect();
    }, []);

    // Notify parent window when calendar or guest picker is open for styling/stacking adjustments

    // Loader ko apni asli content height bhejte rehte hain — hardcoded iframe
    // heights ki jagah har layout/breakpoint pe exact fit. Popovers fixed-position
    // hote hain isliye unka bottom alag se max() mein lete hain.
    // debouncePostHeight: height change hone par sirf ek postMessage bhejo,
    // loop nahi — ResizeObserver → iframe resize → layout change → observer loop
    // rokne ke liye 80ms debounce use karo.
    const postHeightRafRef = useRef<number>(0);
    const postHeight = () => {
        if (window.parent === window) return;
        cancelAnimationFrame(postHeightRafRef.current);
        postHeightRafRef.current = requestAnimationFrame(() => {
            const mainContainer = document.getElementById('widget-main-container');
            const baseHeight = mainContainer
                ? mainContainer.getBoundingClientRect().height
                : document.body.scrollHeight;

            let overlayHeight = baseHeight;
            document.querySelectorAll('[data-radix-popper-content-wrapper]').forEach((el) => {
                overlayHeight = Math.max(overlayHeight, el.getBoundingClientRect().bottom + 16);
            });

            overlayHeight = Math.ceil(overlayHeight);
            const finalBaseHeight = Math.ceil(baseHeight);

            // 4px threshold — 2px se kam tha isliye SubPixel animations pe bhi fire hota tha
            if (Math.abs(overlayHeight - lastHeightRef.current) < 4) return;
            lastHeightRef.current = overlayHeight;

            window.parent.postMessage({
                type: 'WIDGET_HEIGHT',
                height: overlayHeight,
                baseHeight: finalBaseHeight
            }, PARENT_ORIGIN);
        });
    };

    // Ready + height reporting (config render hone ke baad)
    useEffect(() => {
        if (window.parent === window || config === null) return;
        window.parent.postMessage({ type: 'WIDGET_READY' }, PARENT_ORIGIN);
        const raf = requestAnimationFrame(postHeight);
        const ro = new ResizeObserver(() => requestAnimationFrame(postHeight));
        ro.observe(document.body);
        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
        };
    }, [config]);

    useEffect(() => {
        if (window.parent === window) return;
        const isOpen = isCalendarOpen || isGuestOpen;

        // RESIZE_OVERLAY pehle bhejo — widget-v3.js turant iframe ko
        // position:fixed + provisionalOpenHeight (550px) kar deta hai.
        window.parent.postMessage({ type: 'RESIZE_OVERLAY', open: isOpen }, PARENT_ORIGIN);

        if (isOpen) {
            // Calendar/guest picker ke liye ek accurate measurement bhejo.
            //
            // KEY FIX: baseHeight = sirf widget bar height (isMobile ? compact : bar).
            // widget-v3.js 'barHeight' ko baseHeight se update karta hai.
            // Agar hum overlayHeight ko baseHeight se bhejein toh scroll/resize
            // pe applyHeights() barHeight badi samajh ke height chhoti nahi karega.
            // YAHI shaking ka root cause tha.
            const sendOverlayHeight = () => {
                if (window.parent === window) return;
                cancelAnimationFrame(postHeightRafRef.current);
                postHeightRafRef.current = requestAnimationFrame(() => {
                    const mainContainer = document.getElementById('widget-main-container');
                    const barH = Math.ceil(
                        mainContainer
                            ? mainContainer.getBoundingClientRect().height
                            : document.body.scrollHeight
                    );

                    let overlayH = barH;
                    document.querySelectorAll('[data-radix-popper-content-wrapper]').forEach((el) => {
                        overlayH = Math.max(overlayH, el.getBoundingClientRect().bottom + 24);
                    });
                    overlayH = Math.ceil(overlayH);

                    if (Math.abs(overlayH - lastHeightRef.current) < 4) return;
                    lastHeightRef.current = overlayH;

                    window.parent.postMessage({
                        type: 'WIDGET_HEIGHT',
                        height: overlayH,
                        // baseHeight = actual bar height ONLY — never the overlay total.
                        // widget-v3.js uses this as barHeight for layout-shift-free shrink.
                        baseHeight: barH,
                    }, PARENT_ORIGIN);
                });
            };

            const t1 = setTimeout(sendOverlayHeight, 100);  // calendar DOM render ke baad
            const t2 = setTimeout(sendOverlayHeight, 450);  // Radix animation settle ke baad
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }

        // Close: exit animation ke baad correct shrunk height bhejo
        const t1 = setTimeout(postHeight, 200);
        const t2 = setTimeout(postHeight, 550);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [isCalendarOpen, isGuestOpen]);  // eslint-disable-line react-hooks/exhaustive-deps

    // NOTE: arbitrary per-hotel custom JS is intentionally NOT executed in the
    // public widget. Running tenant-supplied JS via new Function() is a code
    // execution sink (a compromised hotelier account / DB row would run script
    // in every guest's payment widget). Leading OTAs never allow tenant JS in
    // their booking widgets — custom theming is limited to sanitized CSS only.

    const handleSearch = () => {
        const minNights = config?.min_nights ?? 1;
        // Require a valid date range before navigating
        if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
            setIsCalendarOpen(true);
            return;
        }
        // Enforce minimum stay — bump checkout if guest selected fewer nights
        const nights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86400000);
        const effectiveCheckOut = nights < minNights ? addDays(checkInDate, minNights) : checkOutDate;

        const targetUrl = `${window.location.origin}/book/${hotelSlug}/rooms`;

        const totalGuests = adults + children;

        const params = new URLSearchParams();
        if (checkInDate) params.append('check_in', format(checkInDate, 'yyyy-MM-dd'));
        params.append('check_out', format(effectiveCheckOut, 'yyyy-MM-dd'));

        params.append('guests', totalGuests.toString());
        params.append('adults', adults.toString());
        params.append('children', children.toString());
        params.append('rooms', roomsCount.toString());

        if (selectedRoomTypeId) params.append('room_type_id', selectedRoomTypeId);
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

    const currency = config?.currency || 'INR';
    const formatPrice = (price: number) => {
        if (currency === 'INR') return `₹${Math.round(price).toLocaleString('en-IN')}`;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
    };
    // Compact form for tight calendar cells (e.g. ₹2.5k, $1.2k) — keeps the
    // price-per-night line from overflowing the day cell on narrow screens,
    // the way Booking.com/Airbnb abbreviate in-cell prices.
    const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '';
    const formatPriceCompact = (price: number) => {
        const p = Math.round(price);
        const body = p >= 100000
            ? `${(p / 100000).toFixed(p % 100000 === 0 ? 0 : 1)}L`
            : p >= 1000
                ? `${(p / 1000).toFixed(p % 1000 === 0 ? 0 : 1)}k`
                : `${p}`;
        return symbol ? `${symbol}${body}` : formatPrice(price);
    };

    // Calendar popover — same design as public booking page
    // Width is derived from the widget's own container so it fits inside any iframe
    const calendarPopoverWidth = isMobile
        ? Math.min(widgetWidth - 16, 400)
        : Math.min(widgetWidth, 720);

    const calendarPopoverContent = (
        <PopoverContent
            className="z-[2147483647] p-0 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-100 calendar-container"
            style={{ width: `${calendarPopoverWidth}px`, maxWidth: '720px', boxSizing: 'border-box', transform: 'translateZ(0)', willChange: 'transform, opacity' }}
            align="center"
            side="bottom"
            avoidCollisions={true}
            collisionPadding={isMobile ? 16 : 24}
            sideOffset={10}
        >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-slate-800">Select dates</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tap check-in, then check-out</p>
                </div>
                <button onClick={() => setIsCalendarOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                    <X className="w-4 h-4 text-slate-500" />
                </button>
            </div>
            {/* Bounded height with internal scroll so the calendar + legend can
                never be clipped by the popover/iframe — the date grid stays fully
                reachable on short screens instead of being cut off. */}
            <div className="p-3 overflow-x-auto max-h-[75vh] overflow-y-auto">
                <Calendar
                    mode="range"
                    numberOfMonths={isMobile ? 1 : 2}
                    selected={{ from: checkInDate, to: checkOutDate }}
                    onSelect={(range: any) => {
                        setCheckInDate(range?.from);
                        setCheckOutDate(range?.to);
                    }}
                    disabled={(date: Date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    className="p-0"
                    classNames={{
                        cell: "h-8 w-8 sm:h-10 sm:w-10 text-center text-[11px] p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-lg [&:has([aria-selected].day-outside)]:custom-theme-bg-light [&:has([aria-selected])]:custom-theme-bg-light first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg focus-within:relative focus-within:z-20",
                        day: "h-8 w-8 sm:h-10 sm:w-10 p-0 font-normal group aria-selected:opacity-100 hover:bg-slate-100 rounded-lg transition-all",
                        day_selected: "custom-theme-btn font-semibold shadow-sm",
                        day_today: "custom-theme-text font-semibold border border-slate-200 bg-slate-50",
                        head_cell: "text-slate-400 font-semibold uppercase tracking-wide text-[9px] w-8 sm:w-10 pb-1 text-center",
                        caption: "flex justify-center py-2 px-3 relative items-center custom-theme-btn rounded-xl mb-3",
                        caption_label: "text-xs font-semibold tracking-wide",
                        nav_button: "h-7 w-7 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center p-0",
                        // Drive the 1-vs-2-month layout from the widget's actual
                        // width (isMobile), NOT the Tailwind md: breakpoint — the
                        // iframe is often <768px on desktop, which previously left
                        // the second month half-visible.
                        months: isMobile ? "flex flex-col space-y-3" : "flex flex-row space-x-4"
                    }}
                    modifiersStyles={{
                        selected: { backgroundColor: primaryHex, color: '#fff' }
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
                                    <span className={cn(
                                        "text-[12px] font-extrabold leading-none",
                                        isPast ? "text-slate-400" : "text-slate-800 group-aria-selected:text-white"
                                    )}>
                                        {date.getDate()}
                                    </span>
                                    {!isPast && (
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
                                    )}
                                </div>
                            );
                        }
                    }}
                />
                <div className="border-t border-slate-100 pt-3 mt-2 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                    <span className="text-red-400 font-semibold">Sold</span> = No rooms &nbsp;·&nbsp; From-price per night · taxes &amp; extra guests may apply
                </div>
            </div>
        </PopoverContent>
    );


    const guestPopoverContent = (
        <PopoverContent className="z-[2147483647] w-80 p-5 bg-white text-slate-800 border border-slate-200 shadow-xl rounded-2xl" style={{ transform: 'translateZ(0)', willChange: 'transform, opacity' }} align="center" side="bottom" avoidCollisions={false} collisionPadding={0} sideOffset={10}>
            <div className="space-y-1">
                {([['Rooms', roomsCount, setRoomsCount, 1, 5, 'Total rooms'],
                   ['Adults', adults, setAdults, 1, 10, 'Ages 13+'],
                   ['Children', children, setChildren, 0, 6, 'Ages 0–12']] as const).map(([label, val, setter, min, max, hint], idx) => (
                    <div key={label}>
                        {idx > 0 && <div className="h-px bg-slate-100" />}
                        <div className="flex items-center justify-between py-3">
                            <div className="text-left">
                                <p className="font-medium text-sm text-slate-800">{label}</p>
                                <p className="text-[11px] text-slate-400">{hint}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:border-slate-400 transition-colors disabled:opacity-40 disabled:hover:border-slate-200"
                                    onClick={() => (setter as any)(Math.max(min, val - 1))}
                                    disabled={val <= min}
                                >
                                    <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-5 text-center text-sm font-semibold text-slate-900">{val}</span>
                                <button
                                    className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:border-slate-400 transition-colors disabled:opacity-40 disabled:hover:border-slate-200"
                                    onClick={() => (setter as any)(Math.min(max, val + 1))}
                                    disabled={val >= max}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </PopoverContent>
    );

    const layoutStyle = urlParams.get('preview_layout') || config?.widget_layout || 'modern';

    if (config === null) {
        return null; // Prevents flashing of default layout before config is fetched
    }

    const stateBag = {
        config, setConfig, startingPrice, setStartingPrice, checkInDate, setCheckInDate,
        checkOutDate, setCheckOutDate, roomsCount, setRoomsCount, adults, setAdults,
        children, setChildren, promoCode, setPromoCode, isCalendarOpen, setIsCalendarOpen,
        isGuestOpen, setIsGuestOpen, isMobile, setIsMobile, handleSearch,
        primaryHex, bgColor, isBgLight, widgetTheme, layout: layoutStyle,
        widgetRef, calendarPopoverContent, guestPopoverContent,
        roomTypes, selectedRoomTypeId, setSelectedRoomTypeId,
        // Per-date calendar data + formatter — passed so mobile layouts can show
        // real prices per date instead of a static starting price
        calendarData, formatPrice,
    };

    return (
        <div id="widget-main-container" ref={widgetRef} className="light w-full flex justify-center font-sans p-2 lg:p-4 relative z-50 overflow-visible">
            <style>{`
                .custom-theme-btn {
                    background-color: ${primaryHex} !important;
                    color: white !important;
                }
                .custom-theme-text:not(.rdp-day_selected) {
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
                    box-shadow: 0 4px 14px 0 ${primaryHex}40;
                }
                .rdp-caption {
                    background-color: ${primaryHex} !important;
                }
                .rdp-day_disabled {
                    opacity: 1 !important;
                }
                .rdp-day_disabled span {
                    color: #94a3b8 !important;
                }

                ${window.self !== window.parent ? `
                /* height:auto rakhna zaroori hai — body.scrollHeight se hi
                   parent loader ko exact content height report hoti hai */
                html, body, #root {
                    height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background-color: transparent !important;
                    overflow-x: hidden !important;
                    overflow-y: auto !important;
                }
                ` : ''}

                /* Calendar Theme Overrides */
                ${widgetTheme === 'dark' ? `
                    .calendar-container {
                        background-color: #0f172a !important;
                        color: #f8fafc !important;
                        border-color: #1e293b !important;
                    }
                    .rdp-months {
                        background-color: #0f172a !important;
                        color: #f8fafc !important;
                    }
                    .rdp-caption_label, .rdp-head_cell {
                        color: #cbd5e1 !important;
                    }
                    .rdp-day {
                        color: #cbd5e1 !important;
                    }
                    .rdp-day:hover {
                        background-color: #1e293b !important;
                        color: #ffffff !important;
                    }
                    .rdp-day_today {
                        background-color: #1e293b !important;
                        color: ${primaryHex} !important;
                    }
                    .rdp-day_disabled span {
                        color: #475569 !important;
                    }
                    .rdp-day_selected {
                        background-color: ${primaryHex} !important;
                        color: white !important;
                    }
                ` : widgetTheme === 'theme' ? `
                    .calendar-container {
                        background-color: ${bgColor} !important;
                        color: ${isBgLight ? '#0f172a' : '#f8fafc'} !important;
                        border-color: ${primaryHex}30 !important;
                    }
                    .rdp-day {
                        color: ${isBgLight ? '#334155' : '#e2e8f0'} !important;
                    }
                    .rdp-day:hover {
                        background-color: ${primaryHex}20 !important;
                    }
                    .rdp-day_today {
                        border-color: ${primaryHex}80 !important;
                        color: ${primaryHex} !important;
                    }
                    .rdp-day_selected {
                        background-color: ${primaryHex} !important;
                        color: white !important;
                    }
                ` : ''}

                /* Fix checkin/checkout date text color conflict */
                .rdp-day_selected,
                .rdp-day_selected.custom-theme-text,
                .rdp-day_selected.rdp-day_today {
                    color: white !important;
                }
                .rdp-day_selected.rdp-day_today {
                    background-color: ${primaryHex} !important;
                    border-color: transparent !important;
                }
                .rdp-day_selected.rdp-day_today span {
                    color: white !important;
                }
            `}</style>
            
            {/* Custom CSS overrides saved in DB settings */}
            {config?.widget_custom_css && (
                <style>{config.widget_custom_css}</style>
            )}

            {layoutStyle === 'far' ? (
                <FARWidget {...stateBag} />
            ) : (
                <RoomSearchHeader
                    searchType={searchType}
                    setSearchType={setSearchType}
                    checkInDate={checkInDate}
                    setCheckInDate={setCheckInDate}
                    checkOutDate={checkOutDate}
                    setCheckOutDate={setCheckOutDate}
                    adults={adults}
                    setAdults={setAdults}
                    children={children}
                    setChildren={setChildren}
                    roomsCount={roomsCount}
                    setRoomsCount={setRoomsCount}
                    promoCode={promoCode}
                    setPromoCode={setPromoCode}
                    isCalendarOpen={isCalendarOpen}
                    setIsCalendarOpen={setIsCalendarOpen}
                    isGuestOpen={isGuestOpen}
                    setIsGuestOpen={setIsGuestOpen}
                    flexibleDates={flexibleDates}
                    setFlexibleDates={setFlexibleDates}
                    themeColor={primaryHex}
                    isMobile={isMobile}
                    startingPrice={startingPrice}
                    handleSearch={handleSearch}
                    hotelSlug={hotelSlug}
                    currency={config?.currency || 'INR'}
                    hideAdvancedOptions={true}
                    layoutStyle={layoutStyle}
                    minNights={config?.min_nights ?? 1}
                    advancePurchaseDays={config?.advance_purchase_days ?? 0}
                />
            )}
        </div>
    );
}
