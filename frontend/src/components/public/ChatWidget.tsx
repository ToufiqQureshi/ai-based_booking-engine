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
                        className="mb-4 w-[calc(100vw-2rem)] md:w-96 shadow-2xl rounded-2xl overflow-hidden"
                    >
                        <Card className="border border-slate-200/60 shadow-2xl h-[calc(100vh-140px)] max-h-[600px] min-h-[400px] flex flex-col bg-white overflow-hidden rounded-2xl">
                            {/* Premium Minimal Header */}
                            <CardHeader
                                className="flex flex-row items-center justify-between p-4 shadow-sm relative z-10 shrink-0 bg-white border-b border-slate-100"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-primary/20 blur-md rounded-full"></div>
                                        <div className="bg-primary/10 p-2 rounded-full border border-primary/20 relative flex items-center justify-center w-10 h-10">
                                            <Bot className="w-5 h-5 text-primary" />
                                        </div>
                                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <span className="text-[16px] font-bold text-slate-800 leading-tight tracking-tight">AI Concierge</span>
                                        <div className="flex items-center mt-0.5">
                                            <span className="text-[11px] font-medium text-slate-500">Always online & ready to help</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </CardHeader>

                            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden bg-slate-50/50">
                                <ScrollArea className="flex-1 px-4 py-6">
                                    <div className="space-y-5">
                                        {messages.map((msg, idx) => (
                                            <div
                                                key={idx}
                                                className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300 mb-2`}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${msg.role === 'user' ? 'bg-primary border-primary text-white' : 'bg-white border-slate-200'
                                                    }`}>
                                                    {msg.role === 'user' ? (
                                                        <User className="w-4 h-4 text-white" />
                                                    ) : (
                                                        <Bot className="w-4 h-4 text-slate-600" />
                                                    )}
                                                </div>

                                                <div
                                                    className={`max-w-[85%] px-4 py-3 text-[14px] leading-relaxed relative shadow-sm ${msg.role === 'user'
                                                        ? 'bg-primary text-white rounded-2xl rounded-tr-sm'
                                                        : 'bg-white text-slate-800 border border-slate-200/60 rounded-2xl rounded-tl-sm'
                                                        }`}
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
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border bg-white border-slate-200">
                                                    <Bot className="w-4 h-4 text-slate-600" />
                                                </div>
                                                <div className="bg-white border border-slate-200/60 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                                                    <div className="flex gap-1.5 px-0.5 py-1">
                                                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={scrollRef} className="h-2" />
                                    </div>
                                </ScrollArea>

                                {/* Input Area Polish */}
                                <div className="p-4 bg-white border-t border-slate-100">
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
                                            placeholder="Message Assistant..."
                                            disabled={isLoading}
                                            className="focus-visible:ring-1 focus-visible:ring-primary border-slate-200 rounded-full px-4 py-6 text-[14px] bg-slate-50 placeholder:text-slate-400 pr-12 h-12 transition-all shadow-inner"
                                        />
                                        <Button
                                            type="submit"
                                            size="icon"
                                            disabled={isLoading || !input.trim()}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full h-[36px] w-[36px] bg-primary hover:opacity-90 text-white transition-all shadow-sm flex items-center justify-center"
                                        >
                                            <Send className="w-4 h-4 ml-0.5" />
                                        </Button>
                                    </form>
                                    <p className="text-[10px] text-center text-slate-400 mt-2 font-medium tracking-wider">AI Assistant can make mistakes.</p>
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
                        className="flex items-center gap-3 bg-white/95 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full px-5 py-3 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all border border-slate-100 group"
                        style={{ padding: isOpen ? '0.75rem' : '0.75rem 1.25rem' } as any}
                    >
                        {isOpen ? (
                            <div className="p-2 rounded-full bg-slate-100">
                                <X className="w-5 h-5 text-slate-600" />
                            </div>
                        ) : (
                            <>
                                <div className="relative flex items-center justify-center">
                                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-50" />
                                    <div className="bg-primary p-2.5 rounded-full relative z-10 shadow-md group-hover:-rotate-12 transition-transform">
                                        <Bot className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                                <div className="hidden md:flex flex-col items-start pr-2">
                                    <span className="text-[14px] font-bold text-slate-800 tracking-tight">Need help?</span>
                                </div>
                            </>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
