import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatWidgetProps {
    hotelSlug: string;
    primaryColor?: string;
}

// Helper to determine text color based on background
function getContrastText(hexcolor: string) {
    if (!hexcolor || !hexcolor.startsWith('#')) return '#fff';
    try {
        const r = parseInt(hexcolor.substr(1, 2), 16);
        const g = parseInt(hexcolor.substr(3, 2), 16);
        const b = parseInt(hexcolor.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#1f2937' : '#ffffff'; // Dark Gray or White
    } catch (e) {
        return '#fff';
    }
}

export function ChatWidget({ hotelSlug, primaryColor = '#3B82F6' }: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hello! I am your concierge. How can I assist you with your stay today?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

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

            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1'}/public/chat/guest`, {
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

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end font-sans">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="mb-4 w-[calc(100vw-2rem)] md:w-96 shadow-2xl rounded-3xl overflow-hidden"
                    >
                        <Card className="border border-gray-100 shadow-2xl h-[550px] flex flex-col bg-white overflow-hidden rounded-3xl">
                            {/* Polished Gradient Header */}
                            <CardHeader
                                className="flex flex-row items-center justify-between p-4 shadow-xl relative z-10 shrink-0"
                                style={{
                                    background: 'linear-gradient(135deg, #4f46e5, #3730a3)',
                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                    minHeight: '70px'
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-2 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg flex items-center justify-center w-11 h-11">
                                        <img src="/webmerito-icon.png" alt="Logo" className="w-6 h-6 object-contain" />
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <span className="text-[16px] font-extrabold text-white leading-tight tracking-tight">Saaraa AI</span>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
                                            <span className="text-[11px] font-bold text-indigo-100/80 uppercase tracking-widest leading-none">Concierge Active</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </CardHeader>

                            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden bg-[#fafafa]">
                                <ScrollArea className="flex-1 px-4 py-6">
                                    <div className="space-y-5">
                                        {messages.map((msg, idx) => (
                                            <div
                                                key={idx}
                                                className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300 mb-2`}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md ${msg.role === 'user' ? 'bg-gradient-to-tr from-purple-500 to-indigo-600' : 'bg-white border border-gray-100'
                                                    }`}>
                                                    {msg.role === 'user' ? (
                                                        <User className="w-4 h-4 text-white" />
                                                    ) : (
                                                        <img src="/webmerito-icon.png" alt="AI" className="w-5 h-5 object-contain" />
                                                    )}
                                                </div>

                                                <div
                                                    className={`max-w-[80%] px-4 py-2.5 text-[14px] leading-relaxed relative ${msg.role === 'user'
                                                        ? 'rounded-[20px] rounded-tr-[4px] shadow-md shadow-primary/10'
                                                        : 'rounded-[20px] rounded-tl-[4px] shadow-sm'
                                                        }`}
                                                    style={msg.role === 'user' ? {
                                                        background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                                                        color: getContrastText(primaryColor)
                                                    } : {
                                                        backgroundColor: '#ffffff',
                                                        color: '#374151',
                                                        border: '1px solid #f3f4f6'
                                                    }}
                                                >
                                                    <div className="prose prose-sm max-w-none break-words dark:prose-invert">
                                                        <ReactMarkdown
                                                            components={{
                                                                p: ({ children }) => <p className="m-0 mb-1 last:mb-0 leading-relaxed font-medium">{children}</p>,
                                                                a: ({ href, children }) => (
                                                                    <a href={href} className="font-bold underline hover:opacity-80 transition-opacity" target="_blank" rel="noopener noreferrer">
                                                                        {children}
                                                                    </a>
                                                                ),
                                                                ul: ({ children }) => <ul className="mb-2 list-disc pl-4 space-y-0.5">{children}</ul>,
                                                                li: ({ children }) => <li className="text-[13px]">{children}</li>,
                                                            }}
                                                        >
                                                            {msg.content.split("ACTION:BOOKING_LINK|")[0]}
                                                        </ReactMarkdown>
                                                    </div>

                                                    {/* Booking Button Injection */}
                                                    {msg.role === 'assistant' && msg.content.includes("ACTION:BOOKING_LINK|") && (
                                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                                            <Button
                                                                onClick={() => {
                                                                    const parts = msg.content.split("ACTION:BOOKING_LINK|");
                                                                    if (parts.length > 1) {
                                                                        try {
                                                                            const data = JSON.parse(parts[1]);
                                                                            window.parent.postMessage({ type: 'CHECKOUT_REDIRECT', data }, '*');
                                                                        } catch (e) { console.error(e); }
                                                                    }
                                                                }}
                                                                className="w-full bg-[#111827] text-white hover:bg-[#1f2937] rounded-xl font-bold py-5 shadow-lg flex items-center justify-center gap-2 group transition-all"
                                                            >
                                                                Confirm & Book Now
                                                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {isLoading && (
                                            <div className="flex items-start gap-2.5 flex-row animate-in fade-in slide-in-from-bottom-1 duration-300">
                                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border bg-gray-100 border-gray-200">
                                                    <Bot className="w-4.5 h-4.5 text-gray-400" />
                                                </div>
                                                <div className="bg-white border border-gray-200 rounded-[20px] rounded-tl-[4px] px-4 py-3 shadow-sm">
                                                    <div className="flex gap-1.5 px-0.5 py-1">
                                                        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={scrollRef} />
                                    </div>
                                </ScrollArea>

                                {/* Input Area Polish */}
                                <div className="p-4 bg-white border-t border-gray-100">
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
                                            className="focus-visible:ring-0 focus-visible:ring-offset-0 border-gray-200 rounded-2xl px-4 py-6 text-[14px] bg-gray-50/50 placeholder:text-gray-400 pr-12 h-12 transition-all focus:bg-white focus:border-gray-200 shadow-inner"
                                        />
                                        <Button
                                            type="submit"
                                            size="icon"
                                            disabled={isLoading || !input.trim()}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl h-9 w-9 bg-primary hover:opacity-90 text-white transition-all shadow-md active:scale-95 flex items-center justify-center"
                                            style={!isLoading && input.trim() ? { backgroundColor: primaryColor } : {}}
                                        >
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    </form>
                                    <p className="text-[10px] text-center text-gray-400 mt-2.5 font-bold uppercase tracking-widest opacity-60">Powered by Gadget4me AI</p>
                                </div>
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
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-3 bg-white/95 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full px-5 py-2.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all border border-gray-100 group"
                        style={{ padding: isOpen ? '0.75rem' : '0.6rem 1.4rem' } as any}
                    >
                        {isOpen ? (
                            <div
                                className="p-2.5 rounded-full shadow-inner"
                                style={{ backgroundColor: `${primaryColor}20` }}
                            >
                                <X className="w-6 h-6" style={{ color: primaryColor }} />
                            </div>
                        ) : (
                            <>
                                <div className="relative w-11 h-11 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-primary/5 rounded-full animate-ping scale-150 opacity-10" style={{ backgroundColor: primaryColor }} />
                                    <img src="/webmerito-icon.png" alt="Chat" className="w-full h-full object-contain relative z-10 drop-shadow-md group-hover:rotate-12 transition-transform" />
                                </div>
                                <div className="hidden md:flex flex-col items-start pr-2">
                                    <span className="text-[10px] font-bold text-gray-500/80 uppercase tracking-widest leading-none mb-1">Live Concierge</span>
                                    <span className="text-[18px] font-black tracking-tighter" style={{
                                        fontFamily: 'Inter, sans-serif, system-ui',
                                        background: `linear-gradient(to right, ${primaryColor}, #5735B8)`,
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        color: 'transparent'
                                    } as any}>
                                        Hi, I'm Saaraa!
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
