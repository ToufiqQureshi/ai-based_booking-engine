import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageCircle, X, Send, Bot, User,
    Calendar, Coffee, MapPin, Clock,
    Sparkles, CreditCard, ArrowRight, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatWidgetProps {
    hotelSlug: string;
    primaryColor?: string;
    bottomOffset?: string;
    isStaticPreview?: boolean;
}

interface BookingData {
    checkInDate: string;
    checkOutDate: string;
    guests: number;
    adults: number;
    children: number;
    rooms: Array<{
        id: string | number;
        name: string;
        base_price: number;
        rate_options: Array<{
            id: string;
            name: string;
            price_per_night: number;
            total_price: number;
        }>;
    }>;
    totalRoomPrice: number;
    guest_info: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
    };
}

// Helper to determine text color based on background
function getContrastText(hexcolor: string) {
    if (!hexcolor || !hexcolor.startsWith('#')) return '#fff';
    try {
        const r = parseInt(hexcolor.substring(1, 3), 16);
        const g = parseInt(hexcolor.substring(3, 5), 16);
        const b = parseInt(hexcolor.substring(5, 7), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#1e293b' : '#ffffff'; // slate-800 or white
    } catch (e) {
        return '#fff';
    }
}

// Helper to format dates beautifully
const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
};

// Helper to get number of nights
const getNights = (inDate: string, outDate: string) => {
    try {
        const d1 = new Date(inDate);
        const d2 = new Date(outDate);
        const diff = d2.getTime() - d1.getTime();
        return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
    } catch {
        return 1;
    }
};

const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    const hostname = window.location.hostname;
    if (hostname.includes('staybooker.ai')) {
        return 'https://api.staybooker.ai/api/v1';
    }
    return 'https://ai-basedbooking-engine-production.up.railway.app/api/v1';
};

export function ChatWidget({ hotelSlug, primaryColor: initialPrimaryColor = '#7c3aed', bottomOffset = 'bottom-4', isStaticPreview = false }: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [hotelInfo, setHotelInfo] = useState<{ name: string, primary_color: string, logo_url?: string } | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    const getNormalizedColor = (col?: string | null) => {
        return col || '#7c3aed';
    };
    const primaryColor = getNormalizedColor(hotelInfo?.primary_color || initialPrimaryColor);

    // Fetch Hotel Config
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch(`${getApiUrl()}/public/hotels/slug/${hotelSlug}/widget-config`);
                if (res.ok) {
                    const data = await res.json();
                    setHotelInfo({ name: data.hotel_name, primary_color: data.primary_color, logo_url: data.logo_url });
                    setMessages([{ role: 'assistant', content: `Hello! I am the virtual concierge for ${data.hotel_name}. How can I assist you today?` }]);
                } else {
                    setMessages([{ role: 'assistant', content: 'Hello! How can I assist you with your stay today?' }]);
                }
            } catch (e) {
                setMessages([{ role: 'assistant', content: 'Hello! How can I assist you with your stay today?' }]);
            }
        };
        fetchConfig();
    }, [hotelSlug]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    // Notify parent window about state changes for resizing
    useEffect(() => {
        const message = isOpen ? 'CHAT_OPEN' : 'CHAT_CLOSE';
        window.parent.postMessage({ type: message, hotelSlug }, '*');
    }, [isOpen, hotelSlug]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const history = messages.map(m => ({ role: m.role, content: m.content }));

            const res = await fetch(`${getApiUrl()}/public/chat/guest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hotel_slug: hotelSlug,
                    message: userMsg,
                    history: history
                })
            });

            if (!res.ok) throw new Error('Failed to fetch');

            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Please try again or reach out directly!" }]);
        } finally {
            setIsLoading(false);
        }
    };

    const triggerQuickAsk = async (promptText: string) => {
        if (isLoading) return;
        setMessages(prev => [...prev, { role: 'user', content: promptText }]);
        setIsLoading(true);

        try {
            const history = [...messages, { role: 'user', content: promptText }].map(m => ({ role: m.role, content: m.content }));

            const res = await fetch(`${getApiUrl()}/public/chat/guest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hotel_slug: hotelSlug,
                    message: promptText,
                    history: history
                })
            });

            if (!res.ok) throw new Error('Failed to fetch');

            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Please try again or reach out directly!" }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`${isStaticPreview ? 'absolute bottom-4 right-4' : `fixed ${bottomOffset} right-4`} z-50 flex flex-col items-end font-sans transition-all duration-300`}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="mb-4 w-full max-w-[calc(100vw-2rem)] md:w-[380px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] rounded-3xl overflow-hidden border border-slate-100"
                    >
                        <Card className="border-0 shadow-none h-[calc(100vh-140px)] max-h-[580px] min-h-[420px] flex flex-col bg-white overflow-hidden rounded-3xl">
                            {/* Premium Glassmorphic Header */}
                            <CardHeader
                                className="flex flex-row items-center justify-between p-4 relative z-10 shrink-0 shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
                                style={{
                                    background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}e0)`,
                                    minHeight: '72px'
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/10 p-1.5 rounded-2xl backdrop-blur-md border border-white/20 shadow-md flex items-center justify-center w-11 h-11 text-white overflow-hidden">
                                        {hotelInfo?.logo_url ? (
                                            <img src={hotelInfo.logo_url} alt="Hotel Logo" className="w-full h-full object-contain rounded-xl" />
                                        ) : (
                                            <Bot className="w-6 h-6" />
                                        )}
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <span className="text-[15px] font-extrabold text-white leading-tight tracking-tight max-w-[200px] truncate">
                                            {hotelInfo?.name || 'Concierge'}
                                        </span>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                            <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest leading-none">Concierge Active</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </CardHeader>

                            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden bg-[#fafafa]">
                                <ScrollArea className="flex-1 px-4 py-5">
                                    <div className="space-y-4">
                                        {messages.map((msg, idx) => {
                                            const parts = msg.content.split("ACTION:BOOKING_LINK|");
                                            const chatText = parts[0].replace(/\[IMAGES: .*?\]/g, '').replace(/https:\/\/.*?\.(jpg|jpeg|png|webp)(\?.*?)?/gi, '').trim();
                                            const bookingJson = parts[1];
                                            let bookingData: BookingData | null = null;

                                            if (bookingJson) {
                                                try {
                                                    bookingData = JSON.parse(bookingJson);
                                                } catch (e) {
                                                    console.error("Booking link JSON parse error", e);
                                                }
                                            }

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user'
                                                        ? 'bg-slate-200 border border-slate-300'
                                                        : 'bg-white border border-slate-100'
                                                        }`}>
                                                        {msg.role === 'user' ? (
                                                            <User className="w-4 h-4 text-slate-600" />
                                                        ) : (
                                                            hotelInfo?.logo_url ? (
                                                                <img src={hotelInfo.logo_url} alt="AI" className="w-5 h-5 object-contain rounded-full" />
                                                            ) : (
                                                                <Bot className="w-4 h-4 text-slate-500" />
                                                            )
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col max-w-[80%]">
                                                        {chatText && (
                                                            <div
                                                                className={`px-4 py-3 text-[14px] leading-relaxed relative ${msg.role === 'user'
                                                                    ? 'rounded-[20px] rounded-tr-[4px] shadow-sm'
                                                                    : 'rounded-[20px] rounded-tl-[4px] shadow-sm border border-slate-100'
                                                                    }`}
                                                                style={msg.role === 'user' ? {
                                                                    background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                                                                    color: getContrastText(primaryColor)
                                                                } : {
                                                                    backgroundColor: '#ffffff',
                                                                    color: '#334155'
                                                                }}
                                                            >
                                                                <div className="prose prose-sm max-w-none break-words font-medium">
                                                                    <ReactMarkdown
                                                                        components={{
                                                                            p: ({ children }) => <p className="m-0 mb-1 last:mb-0 leading-relaxed">{children}</p>,
                                                                            a: ({ href, children }) => (
                                                                                <a href={href} className="font-bold underline hover:opacity-85 transition-opacity" target="_blank" rel="noopener noreferrer" style={{ color: primaryColor }}>
                                                                                    {children}
                                                                                </a>
                                                                            ),
                                                                            ul: ({ children }) => <ul className="mb-2 list-disc pl-4 space-y-0.5">{children}</ul>,
                                                                            li: ({ children }) => <li className="text-[13px]">{children}</li>,
                                                                        }}
                                                                    >
                                                                        {chatText}
                                                                    </ReactMarkdown>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Room Image Gallery Injection */}
                                                        {msg.role === 'assistant' && (
                                                            <div className="mt-2 grid grid-cols-2 gap-2">
                                                                {/* 1. Handle [IMAGES: ...] tag */}
                                                                {msg.content.includes("[IMAGES:") && msg.content.match(/\[IMAGES: (.*?)\]/)?.[1].split(',').map((url, idx) => (
                                                                    <div key={`tagged-${idx}`} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-100 shadow-sm group">
                                                                        <img
                                                                            src={url.trim()}
                                                                            alt="Room"
                                                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                                                        />
                                                                    </div>
                                                                ))}

                                                                {/* 2. Handle Naked Supabase URLs (Fallback) */}
                                                                {!msg.content.includes("[IMAGES:") && msg.content.match(/https:\/\/iupgzyilraahuwqnkgqq\.supabase\.co\/storage\/v1\/object\/public\/hotel-assets\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)/gi)?.map((url, idx) => (
                                                                    <div key={`naked-${idx}`} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-100 shadow-sm group">
                                                                        <img
                                                                            src={url.trim()}
                                                                            alt="Room"
                                                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Premium Reservation Receipt Ticket Card */}
                                                        {msg.role === 'assistant' && bookingData && (
                                                            <div className="mt-2 bg-white border border-slate-200 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.05)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                                {/* Ticket Header */}
                                                                <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">OFFER SUMMARY</span>
                                                                    </div>
                                                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                                                </div>

                                                                {/* Room Details */}
                                                                <div className="p-3.5 space-y-3">
                                                                    <div>
                                                                        <h4 className="text-[14px] font-extrabold text-slate-800 leading-tight">
                                                                            {bookingData.rooms?.[0]?.name || 'Standard Room'}
                                                                        </h4>
                                                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                                                            {bookingData.guests} Guest{bookingData.guests > 1 ? 's' : ''} ({bookingData.adults} Adult{bookingData.adults > 1 ? 's' : ''}{bookingData.children > 0 ? `, ${bookingData.children} Child${bookingData.children > 1 ? 'ren' : ''}` : ''})
                                                                        </p>
                                                                    </div>

                                                                    {/* Check-in / Check-out Grid */}
                                                                    <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                                                                        <div>
                                                                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Check-in</span>
                                                                            <span className="text-[11px] font-bold text-slate-700">{formatDate(bookingData.checkInDate)}</span>
                                                                        </div>
                                                                        <div className="border-l border-slate-200 pl-3">
                                                                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Check-out</span>
                                                                            <span className="text-[11px] font-bold text-slate-700">{formatDate(bookingData.checkOutDate)}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Ticket Tear Line (Notches on sides + dashed line) */}
                                                                <div className="relative flex items-center justify-between px-0 my-0.5">
                                                                    <div className="w-3 h-6 bg-[#fafafa] border-r border-slate-200 rounded-r-full -ml-[1px]" />
                                                                    <div className="flex-1 border-t border-dashed border-slate-200" />
                                                                    <div className="w-3 h-6 bg-[#fafafa] border-l border-slate-200 rounded-l-full -mr-[1px]" />
                                                                </div>

                                                                {/* Price & Action */}
                                                                <div className="p-3.5 pt-1 space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <div>
                                                                            <span className="text-[9px] font-medium text-slate-400 block">Rate Option ({getNights(bookingData.checkInDate, bookingData.checkOutDate)} Night{getNights(bookingData.checkInDate, bookingData.checkOutDate) > 1 ? 's' : ''})</span>
                                                                            <span className="text-[11px] font-bold text-slate-600 truncate max-w-[120px] block">
                                                                                {bookingData.rooms?.[0]?.rate_options?.[0]?.name || 'Standard Rate'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <span className="text-[9px] font-medium text-slate-400 block">Total Price</span>
                                                                            <span className="text-[15px] font-black" style={{ color: primaryColor }}>
                                                                                ₹{bookingData.totalRoomPrice.toLocaleString('en-IN')}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Guest Summary Info */}
                                                                    {bookingData.guest_info && (
                                                                        <div className="bg-slate-50/50 px-2.5 py-1.5 rounded-xl text-[10px] text-slate-600 flex items-center justify-between border border-slate-100">
                                                                            <span className="truncate max-w-[120px] font-medium">
                                                                                {bookingData.guest_info.firstName} {bookingData.guest_info.lastName}
                                                                            </span>
                                                                            <span className="font-bold text-slate-700">{bookingData.guest_info.phone}</span>
                                                                        </div>
                                                                    )}

                                                                    <Button
                                                                        onClick={() => {
                                                                            window.parent.postMessage({ type: 'CHECKOUT_REDIRECT', data: bookingData }, '*');
                                                                        }}
                                                                        className="w-full text-white font-bold py-5 shadow-sm rounded-xl flex items-center justify-center gap-1.5 group transition-all text-xs"
                                                                        style={{
                                                                            background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`
                                                                        }}
                                                                    >
                                                                        <CreditCard className="w-3.5 h-3.5" />
                                                                        Confirm & Book Now
                                                                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* suggestion inquiries on welcome screen */}
                                        {messages.length === 1 && !isLoading && (
                                            <div className="mt-4 space-y-2.5 pl-10.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Suggested Queries</span>
                                                <div className="grid grid-cols-1 gap-2">
                                                    <button
                                                        onClick={() => triggerQuickAsk("Check room availability")}
                                                        className="flex items-center justify-between text-left text-xs bg-white hover:bg-slate-50 border border-slate-150 text-slate-700 px-3.5 py-2.5 rounded-xl transition-all shadow-sm hover:border-slate-200 group active:scale-[0.99]"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-4 h-4 text-slate-500 group-hover:scale-105 transition-transform" style={{ color: primaryColor }} />
                                                            <span className="font-medium text-slate-600">Check Room Rates</span>
                                                        </div>
                                                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                                                    </button>
                                                    <button
                                                        onClick={() => triggerQuickAsk("What amenities are available?")}
                                                        className="flex items-center justify-between text-left text-xs bg-white hover:bg-slate-50 border border-slate-150 text-slate-700 px-3.5 py-2.5 rounded-xl transition-all shadow-sm hover:border-slate-200 group active:scale-[0.99]"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Coffee className="w-4 h-4 text-slate-500 group-hover:scale-105 transition-transform" style={{ color: primaryColor }} />
                                                            <span className="font-medium text-slate-600">Amenities & Pool</span>
                                                        </div>
                                                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                                                    </button>
                                                    <button
                                                        onClick={() => triggerQuickAsk("Where is the hotel located?")}
                                                        className="flex items-center justify-between text-left text-xs bg-white hover:bg-slate-50 border border-slate-150 text-slate-700 px-3.5 py-2.5 rounded-xl transition-all shadow-sm hover:border-slate-200 group active:scale-[0.99]"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <MapPin className="w-4 h-4 text-slate-500 group-hover:scale-105 transition-transform" style={{ color: primaryColor }} />
                                                            <span className="font-medium text-slate-600">Location & Contact</span>
                                                        </div>
                                                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                                                    </button>
                                                    <button
                                                        onClick={() => triggerQuickAsk("What are check-in and check-out times?")}
                                                        className="flex items-center justify-between text-left text-xs bg-white hover:bg-slate-50 border border-slate-150 text-slate-700 px-3.5 py-2.5 rounded-xl transition-all shadow-sm hover:border-slate-200 group active:scale-[0.99]"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="w-4 h-4 text-slate-500 group-hover:scale-105 transition-transform" style={{ color: primaryColor }} />
                                                            <span className="font-medium text-slate-600">Timings & Policies</span>
                                                        </div>
                                                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {isLoading && (
                                            <div className="flex items-start gap-2.5 flex-row animate-in fade-in slide-in-from-bottom-1 duration-300">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border bg-white border-slate-100">
                                                    <Bot className="w-4 h-4 text-slate-400" />
                                                </div>
                                                <div className="bg-white border border-slate-100 rounded-[20px] rounded-tl-[4px] px-4 py-2.5 shadow-sm">
                                                    <div className="flex gap-1.5 px-0.5 py-1">
                                                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={scrollRef} />
                                    </div>
                                </ScrollArea>

                                {/* Input Panel */}
                                <div className="p-3.5 bg-white border-t border-slate-100 shadow-[0_-2px_15px_rgba(0,0,0,0.015)]">
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            handleSend();
                                        }}
                                        className="relative flex items-center gap-2"
                                    >
                                        <Input
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder="Message Concierge..."
                                            disabled={isLoading}
                                            className="focus-visible:ring-0 focus-visible:ring-offset-0 border-slate-200 rounded-2xl px-4 py-5 text-[14px] bg-slate-50/50 placeholder:text-slate-400 pr-12 h-11 transition-all focus:bg-white focus:border-slate-300 shadow-inner font-medium"
                                        />
                                        <Button
                                            type="submit"
                                            size="icon"
                                            disabled={isLoading || !input.trim()}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl h-8 w-8 bg-slate-200 hover:opacity-95 text-white transition-all shadow-sm active:scale-95 flex items-center justify-center border-0"
                                            style={!isLoading && input.trim() ? { backgroundColor: primaryColor } : {}}
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                        </Button>
                                    </form>
                                    <p className="text-[8px] text-center mt-2 font-bold uppercase tracking-widest bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">
                                        Powered by webmerito AI
                                    </p>                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isVisible && (
                    <motion.button
                        key="chat-button"
                        layout
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 20 }}
                        onClick={() => setIsOpen(!isOpen)}
                        whileHover={{ scale: 1.04, y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        className="flex items-center gap-3 bg-white/95 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-full px-5 py-2.5 hover:shadow-[0_8px_35px_rgba(0,0,0,0.18)] transition-all border border-slate-100 group"
                        style={{ padding: isOpen ? '0.75rem' : '0.6rem 1.4rem' } as any}
                    >
                        {isOpen ? (
                            <div
                                className="p-2 rounded-full shadow-inner bg-slate-50"
                            >
                                <X className="w-5.5 h-5.5 text-slate-500" />
                            </div>
                        ) : (
                            <>
                                <div className="relative w-10 h-10 flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full animate-ping scale-150 opacity-10" style={{ backgroundColor: primaryColor }} />
                                    <img src="/webmerito-icon.png" alt="Chat" className="w-full h-full object-contain relative z-10 drop-shadow-md group-hover:rotate-12 transition-transform" />
                                </div>
                                <div className="hidden md:flex flex-col items-start pr-2 ml-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Live Concierge</span>
                                    <span
                                        className="text-[15px] font-black tracking-tight"
                                        style={{ color: primaryColor }}
                                    >
                                        How can I help?
                                    </span>
                                </div>
                            </>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
