import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import {
    Building2, Calendar as CalendarIcon, Users, Search,
    ChevronDown, Minus, Plus, X, MapPin, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ChainProperty {
    hotel_id: string;
    name: string;
    slug: string;
    city?: string;
    logo_url?: string | null;
    star_rating?: number;
    primary_color?: string | null;
}

interface ChainInfo {
    id: string;
    name: string;
    slug: string;
    logo_url?: string | null;
    primary_color?: string | null;
    properties: ChainProperty[];
}

// ── Resolve API base same way as single hotel widget ─────────────────────────
function getApiUrl(): string {
    const hostname = window.location.hostname;
    if (hostname.includes('staybooker.ai')) return 'https://api.staybooker.ai/api/v1';
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    return 'https://ai-basedbooking-engine-production.up.railway.app/api/v1';
}

// Target the embedding parent's origin (derived from the referrer) instead of a
// wildcard '*'. Falls back to '*' only when the referrer is unavailable.
const PARENT_ORIGIN: string = (() => {
    try {
        return document.referrer ? new URL(document.referrer).origin : '*';
    } catch {
        return '*';
    }
})();

export default function ChainBookingWidget() {
    const { chainSlug } = useParams<{ chainSlug: string }>();
    const widgetRef = useRef<HTMLDivElement>(null);

    // ── Chain data ──────────────────────────────────────────────────────────
    const [chain, setChain] = useState<ChainInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedProperty, setSelectedProperty] = useState<ChainProperty | null>(null);
    const [checkInDate, setCheckInDate] = useState<Date | undefined>(new Date());
    const [checkOutDate, setCheckOutDate] = useState<Date | undefined>(addDays(new Date(), 1));
    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);
    const [rooms, setRooms] = useState(1);
    const [startingPrice, setStartingPrice] = useState<number>(0);

    // ── UI state ────────────────────────────────────────────────────────────
    const [isPropertyOpen, setIsPropertyOpen] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isGuestOpen, setIsGuestOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [propertySearch, setPropertySearch] = useState('');

    // ── URL preview params (for live preview in Integration page) ───────────
    const urlParams = new URLSearchParams(
        typeof window !== 'undefined' ? window.location.search : ''
    );
    const previewColor = urlParams.get('preview_primary_color');

    // ── Fetch chain info ────────────────────────────────────────────────────
    useEffect(() => {
        if (!chainSlug) return;
        setIsLoading(true);
        fetch(`${getApiUrl()}/public/chain/${chainSlug}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data) setChain(data);
            })
            .catch(() => {})
            .finally(() => setIsLoading(false));
    }, [chainSlug]);

    // ── Fetch room price when selected property changes ─────────────────────
    useEffect(() => {
        if (!selectedProperty) {
            setStartingPrice(0);
            return;
        }
        const checkInStr = format(new Date(), 'yyyy-MM-dd');
        const checkOutStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        fetch(`${getApiUrl()}/public/hotels/${selectedProperty.slug}/rooms?check_in=${checkInStr}&check_out=${checkOutStr}`)
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
                    } else {
                        setStartingPrice(4200); // Default fallback
                    }
                } else {
                    setStartingPrice(4200); // Default fallback
                }
            })
            .catch(err => {
                console.error("Failed to fetch rooms for chain widget price:", err);
                setStartingPrice(4200); // Fallback
            });
    }, [selectedProperty]);

    // ── Transparent body for iframe ─────────────────────────────────────────
    useEffect(() => {
        document.body.style.backgroundColor = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';
        return () => {
            document.body.style.backgroundColor = '';
            document.documentElement.style.backgroundColor = '';
        };
    }, []);

    // ── Responsive ─────────────────────────────────────────────────────────
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // ── Notify parent window when calendar, property list or guest picker is open for styling/stacking adjustments ──
    useEffect(() => {
        if (window.parent !== window) {
            const isOpen = isPropertyOpen || isCalendarOpen || isGuestOpen;
            window.parent.postMessage({ type: 'RESIZE_OVERLAY', open: isOpen }, PARENT_ORIGIN);
        }
    }, [isPropertyOpen, isCalendarOpen, isGuestOpen]);

    // ── Search handler → redirect to hotel booking page ─────────────────────
    const handleSearch = () => {
        if (!selectedProperty) {
            setIsPropertyOpen(true);
            return;
        }
        // Require a valid date range before navigating to the property's rooms page.
        if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
            setIsCalendarOpen(true);
            return;
        }
        const params = new URLSearchParams();
        if (checkInDate) params.set('check_in', format(checkInDate, 'yyyy-MM-dd'));
        if (checkOutDate) params.set('check_out', format(checkOutDate, 'yyyy-MM-dd'));
        params.set('adults', adults.toString());
        params.set('children', children.toString());
        params.set('rooms', rooms.toString());
        params.set('guests', (adults + children).toString());

        const targetUrl = `${window.location.origin}/book/${selectedProperty.slug}/rooms?${params.toString()}`;

        if (window.parent !== window) {
            window.open(targetUrl, '_blank');
        } else {
            window.location.href = targetUrl;
        }
    };

    const primaryColor = previewColor || selectedProperty?.primary_color || chain?.primary_color || '#4f46e5';

    const filteredProperties = (chain?.properties || []).filter(p =>
        p.name.toLowerCase().includes(propertySearch.toLowerCase()) ||
        (p.city || '').toLowerCase().includes(propertySearch.toLowerCase())
    );

    // ── Loading state ───────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="w-full flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    // ── Fallback: chain not found (show generic UI for preview) ─────────────
    const demoProperties: ChainProperty[] = chain?.properties?.length
        ? chain.properties
        : [
            { hotel_id: '1', name: 'Grand Palace — Mumbai', slug: 'grand-palace-mumbai', city: 'Mumbai' },
            { hotel_id: '2', name: 'Grand Palace — Delhi', slug: 'grand-palace-delhi', city: 'Delhi' },
            { hotel_id: '3', name: 'Grand Palace — Goa', slug: 'grand-palace-goa', city: 'Goa' },
        ];
    const chainName = chain?.name || 'Your Hotel Chain';
    const displayProperties = filteredProperties.length > 0 || chain ? filteredProperties : demoProperties;

    return (
        <div ref={widgetRef} className="light w-full font-sans p-2 lg:p-4">
            <style>{`
                .chain-btn {
                    background-color: ${primaryColor} !important;
                    color: white !important;
                    box-shadow: 0 4px 12px 0 ${primaryColor}30;
                    transition: all 0.2s ease-in-out;
                }
                .chain-btn:hover {
                    filter: brightness(1.08);
                    box-shadow: 0 6px 16px 0 ${primaryColor}40;
                }
                .chain-accent { color: ${primaryColor} !important; }
                .chain-border-focus:focus-within {
                    border-color: ${primaryColor} !important;
                    box-shadow: 0 0 0 2px ${primaryColor}22 !important;
                }
                .chain-radio-active {
                    border-color: ${primaryColor} !important;
                    background-color: ${primaryColor}15 !important;
                }
                .rdp-day_selected {
                    background-color: ${primaryColor} !important;
                    color: white !important;
                    box-shadow: 0 4px 14px 0 ${primaryColor}40;
                }
                .rdp-caption {
                    background-color: ${primaryColor} !important;
                }
                .rdp-day_today:not(.rdp-day_selected) {
                    color: ${primaryColor} !important;
                    border-color: ${primaryColor}80 !important;
                }
                .rdp-day_selected.rdp-day_today,
                .rdp-day_selected.rdp-day_today span {
                    color: white !important;
                }
            `}</style>

            {/* ── Chain branding header ────────────────────────────────── */}
            <div className="flex items-center gap-2 mb-3 px-1">
                {chain?.logo_url ? (
                    <img src={chain.logo_url} alt={chainName} className="h-7 w-auto object-contain" />
                ) : (
                    <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${primaryColor}20` }}
                    >
                        <Building2 className="w-4 h-4" style={{ color: primaryColor }} />
                    </div>
                )}
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    {chainName}
                </span>
            </div>

            {/* ── Main widget card ─────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-visible">
                <div className={cn(
                    'flex flex-col sm:flex-row',
                    !isMobile && 'divide-x divide-slate-100'
                )}>

                    {/* Property selector */}
                    <div className={cn('flex-1 min-w-0', isMobile && 'border-b border-slate-100')}>
                        <Popover open={isPropertyOpen} onOpenChange={setIsPropertyOpen}>
                            <PopoverTrigger asChild>
                                <button className="w-full h-16 px-4 flex items-center gap-3 hover:bg-slate-50/70 transition-colors rounded-tl-2xl rounded-bl-2xl text-left group">
                                    <div
                                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${primaryColor}15` }}
                                    >
                                        <MapPin className="w-4 h-4" style={{ color: primaryColor }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                                            Property
                                        </p>
                                        <p className={cn(
                                            'text-sm font-bold truncate leading-none transition-colors',
                                            selectedProperty ? 'text-slate-800' : 'text-slate-400'
                                        )}>
                                            {selectedProperty ? selectedProperty.name : 'Select a property'}
                                        </p>
                                    </div>
                                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 group-hover:text-slate-600 transition-colors" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-80 p-0 rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
                                align="start"
                                side="bottom"
                                avoidCollisions={false}
                                sideOffset={8}
                            >
                                {/* Search input */}
                                <div className="p-3 border-b border-slate-100">
                                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                                        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <input
                                            autoFocus
                                            placeholder="Search by hotel or city..."
                                            value={propertySearch}
                                            onChange={e => setPropertySearch(e.target.value)}
                                            className="flex-1 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none font-medium"
                                        />
                                        {propertySearch && (
                                            <button onClick={() => setPropertySearch('')}>
                                                <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Property list */}
                                <div className="max-h-64 overflow-y-auto py-1">
                                    {displayProperties.length === 0 ? (
                                        <div className="p-6 text-center text-xs text-slate-400">
                                            No properties found
                                        </div>
                                    ) : (
                                        displayProperties.map(property => (
                                            <button
                                                key={property.hotel_id}
                                                onClick={() => {
                                                    setSelectedProperty(property);
                                                    setIsPropertyOpen(false);
                                                    setPropertySearch('');
                                                }}
                                                className={cn(
                                                    'w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left',
                                                    selectedProperty?.hotel_id === property.hotel_id && 'chain-radio-active'
                                                )}
                                            >
                                                <div
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                                                    style={{ backgroundColor: `${primaryColor}15` }}
                                                >
                                                    {property.logo_url ? (
                                                        <img src={property.logo_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Building2 className="w-4 h-4" style={{ color: primaryColor }} />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-slate-800 truncate leading-tight">
                                                        {property.name}
                                                    </p>
                                                    {property.city && (
                                                        <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                                            <MapPin className="w-2.5 h-2.5" />
                                                            {property.city}
                                                        </p>
                                                    )}
                                                </div>
                                                {selectedProperty?.hotel_id === property.hotel_id && (
                                                    <div
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: primaryColor }}
                                                    />
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Date picker */}
                    <div className={cn('flex-1 min-w-0', isMobile && 'border-b border-slate-100')}>
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                                <button className="w-full h-16 px-4 flex items-center gap-3 hover:bg-slate-50/70 transition-colors text-left group">
                                    <div
                                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${primaryColor}15` }}
                                    >
                                        <CalendarIcon className="w-4 h-4" style={{ color: primaryColor }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                                            Dates
                                        </p>
                                        <p className="text-sm font-bold text-slate-800 leading-none">
                                            {checkInDate ? format(checkInDate, 'dd MMM') : 'Check-in'}
                                            {' → '}
                                            {checkOutDate ? format(checkOutDate, 'dd MMM') : 'Check-out'}
                                        </p>
                                    </div>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="p-0 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-100 overflow-hidden calendar-container"
                                style={{ width: isMobile ? 'calc(100vw - 32px)' : 'auto', maxWidth: '720px' }}
                                align="center"
                                side="bottom"
                                avoidCollisions={false}
                                sideOffset={8}
                            >
                                <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Select Dates</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">Tap check-in, then check-out</p>
                                    </div>
                                    <button
                                        onClick={() => setIsCalendarOpen(false)}
                                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                    >
                                        <X className="w-4 h-4 text-slate-500" />
                                    </button>
                                </div>
                                <div className="p-3">
                                    <Calendar
                                        mode="range"
                                        numberOfMonths={isMobile ? 1 : 2}
                                        selected={{ from: checkInDate, to: checkOutDate }}
                                        onSelect={(range: any) => {
                                            // Mirror the computed range exactly so a new
                                            // check-in click clears the old check-out and
                                            // starts a fresh range (see useBookingWidgetState).
                                            setCheckInDate(range?.from);
                                            setCheckOutDate(range?.to);
                                            // Calendar stays open until guest explicitly hits X
                                        }}
                                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                        className="p-0"
                                        classNames={{
                                            cell: 'h-9 w-9 sm:h-11 sm:w-11 text-center text-xs p-0 relative focus-within:relative focus-within:z-20',
                                            day: 'h-9 w-9 sm:h-11 sm:w-11 p-0 font-normal group aria-selected:opacity-100 hover:bg-slate-100 rounded-xl transition-all',
                                            day_selected: 'font-bold shadow-md',
                                            day_today: 'font-bold border border-slate-200 bg-slate-50',
                                            head_cell: 'text-slate-500 font-black uppercase tracking-wider text-[10px] w-9 sm:w-11 pb-2 text-center',
                                            caption: 'flex justify-center py-2.5 px-3 relative items-center rounded-xl mb-3 shadow-sm',
                                            caption_label: 'text-xs font-extrabold tracking-wide uppercase text-white',
                                            nav_button: 'h-7 w-7 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center p-0',
                                            months: 'flex flex-col md:flex-row space-y-3 md:space-x-4 md:space-y-0',
                                        }}
                                        modifiersStyles={{
                                            selected: { backgroundColor: primaryColor, color: '#fff' },
                                        }}
                                        components={{
                                            DayContent: ({ date }: any) => {
                                                const todayObj = new Date(new Date().setHours(0, 0, 0, 0));
                                                const isPast = date < todayObj;
                                                
                                                if (!selectedProperty) {
                                                    return (
                                                        <div className="flex flex-col items-center justify-center h-full w-full p-0.5">
                                                            <span className="text-xs font-bold leading-none">{date.getDate()}</span>
                                                        </div>
                                                    );
                                                }
                                                
                                                // Show the property's real starting ("from") rate only when
                                                // known. No fabricated weekend surcharge and no fake per-day
                                                // "Sold Out": real price & availability are confirmed on the
                                                // next step against live inventory.
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
                                    {selectedProperty && (
                                        <div className="border-t border-slate-100 pt-3 mt-2 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5 font-bold tracking-wide">
                                            Starting (&ldquo;from&rdquo;) rates &middot; final price &amp; availability confirmed at the next step
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Guests picker */}
                    <div className={cn('flex-1 min-w-0', isMobile && 'border-b border-slate-100')}>
                        <Popover open={isGuestOpen} onOpenChange={setIsGuestOpen}>
                            <PopoverTrigger asChild>
                                <button className="w-full h-16 px-4 flex items-center gap-3 hover:bg-slate-50/70 transition-colors text-left group">
                                    <div
                                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${primaryColor}15` }}
                                    >
                                        <Users className="w-4 h-4" style={{ color: primaryColor }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                                            Guests & Rooms
                                        </p>
                                        <p className="text-sm font-bold text-slate-800 leading-none">
                                            {adults + children} Guest{adults + children !== 1 ? 's' : ''}, {rooms} Room{rooms !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-80 p-6 bg-white text-slate-800 border-slate-100 shadow-2xl rounded-3xl"
                                align="center"
                                side="bottom"
                                avoidCollisions={false}
                            >
                                <div className="space-y-5">
                                    {[
                                        { label: 'Rooms', sub: 'Total rooms', value: rooms, setValue: setRooms, min: 1, max: 5 },
                                        { label: 'Adults', sub: 'Ages 13+', value: adults, setValue: setAdults, min: 1, max: 10 },
                                        { label: 'Children', sub: 'Ages 0–12', value: children, setValue: setChildren, min: 0, max: 6 },
                                    ].map(({ label, sub, value, setValue, min, max }) => (
                                        <div key={label} className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm text-slate-900">{label}</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{sub}</p>
                                            </div>
                                            <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                                                    onClick={() => setValue(v => Math.max(min, v - 1))}
                                                    disabled={value <= min}
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-5 text-center text-sm font-black text-slate-900">{value}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                                                    onClick={() => setValue(v => Math.min(max, v + 1))}
                                                    disabled={value >= max}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Search button */}
                    <div className="flex items-center p-2.5 shrink-0">
                        <button
                            onClick={handleSearch}
                            className="chain-btn h-11 px-6 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-md flex items-center gap-2 w-full sm:w-auto justify-center"
                        >
                            <Search className="w-4 h-4" />
                            {isMobile ? 'Search' : 'Check Availability'}
                        </button>
                    </div>
                </div>

                {/* Required field hint */}
                {!selectedProperty && (
                    <div className="px-4 pb-3 text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Please select a property to continue
                    </div>
                )}
            </div>
        </div>
    );
}
