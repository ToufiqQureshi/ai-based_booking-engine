import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/api/client";
import ReactMarkdown from 'react-markdown';

// Types
interface Message {
    role: 'human' | 'ai';
    content: string;
}

interface ChatResponse {
    response: string;
}

const AgentPage = () => {
    const location = useLocation();
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: 'Namaste! Main Staybooker AI hun. Main aapki hotel growth aur operations mein kaise madad kar sakta hun?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    // Handle incoming state prompt from Dashboard Quick Links
    const hasTriggeredInitialPrompt = useRef(false);

    useEffect(() => {
        if (location.state?.prompt && !hasTriggeredInitialPrompt.current) {
            hasTriggeredInitialPrompt.current = true;
            triggerQuickAsk(location.state.prompt);
            // clear state to prevent re-triggering on refresh
            window.history.replaceState({}, document.title)
        }
    }, [location.state]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = input.trim();
        setInput('');

        // Add User Message
        const newMessages: Message[] = [...messages, { role: 'human', content: userMessage }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Send history as list of [role, content]
            const historyArray = newMessages.map(m => [m.role, m.content]);

            const data = await apiClient.post<ChatResponse>('/agent/chat', {
                message: userMessage,
                history: historyArray
            });

            setMessages(prev => [...prev, { role: 'ai', content: data.response }]);
        } catch (error: any) {
            console.error("Agent Error:", error);
            toast({
                title: "Error",
                description: error.message || "Something went wrong. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const triggerQuickAsk = async (promptText: string) => {
        if (isLoading) return;
        const newMessages: Message[] = [...messages, { role: 'human', content: promptText }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            const historyArray = newMessages.map(m => [m.role, m.content]);
            const data = await apiClient.post<ChatResponse>('/agent/chat', {
                message: promptText,
                history: historyArray
            });
            setMessages(prev => [...prev, { role: 'ai', content: data.response }]);
        } catch (error: any) {
            console.error("Agent Error:", error);
            toast({
                title: "Error",
                description: error.message || "Something went wrong. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="container mx-auto p-4 h-[calc(100vh-5rem)] flex flex-col">
            <Card className="flex-1 flex flex-col shadow-xl border-slate-200/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 p-6 flex flex-row items-center justify-between shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                            <Avatar className="h-12 w-12 border border-slate-200 shadow-md relative">
                                <AvatarFallback className="bg-primary text-white"><Bot size={24} /></AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-950 rounded-full"></span>
                        </div>
                        <div>
                            <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">Staybooker Assistant</CardTitle>
                            <CardDescription className="font-medium text-slate-500">Always online & ready to help</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 flex flex-col overflow-hidden bg-slate-50/30 dark:bg-slate-900/30">
                    <ScrollArea className="flex-1 px-6 py-6">
                        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
                            {messages.map((msg, index) => (
                                <div key={index} className={`flex ${msg.role === 'human' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                                    <div className={`flex gap-3 max-w-[85%] ${msg.role === 'human' ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <Avatar className="h-8 w-8 mt-1 shrink-0 shadow-sm border border-slate-200 dark:border-slate-800">
                                            {msg.role === 'human' ? (
                                                <AvatarFallback className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><User size={14} /></AvatarFallback>
                                            ) : (
                                                <AvatarFallback className="bg-primary text-white"><Bot size={14} /></AvatarFallback>
                                            )}
                                        </Avatar>
                                        <div className={`px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${msg.role === 'human'
                                            ? 'bg-primary text-white rounded-2xl rounded-tr-sm'
                                            : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800 rounded-2xl rounded-tl-sm'
                                            }`}>
                                            <div className="prose dark:prose-invert max-w-none break-words">
                                                <ReactMarkdown
                                                    components={{
                                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                        ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                                                        ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                                                        li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                                        strong: ({ node, ...props }) => <strong className="font-semibold text-inherit" {...props} />
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {messages.length === 1 && (
                                <div className="flex flex-wrap gap-2.5 mt-2 ml-12 max-w-[80%] animate-in fade-in zoom-in duration-500">
                                    {[
                                        { icon: '📊', text: "Show last week's revenue", prompt: "Show me last week's total revenue" },
                                        { icon: '🛏️', text: "Most booked rooms", prompt: "Tell me which rooms are most booked" },
                                        { icon: '📈', text: "Occupancy rate", prompt: "Check our occupancy rate for this month" },
                                        { icon: '❌', text: "Cancellation stats", prompt: "What are the cancellation metrics?" }
                                    ].map((action, i) => (
                                        <button
                                            key={i}
                                            onClick={() => triggerQuickAsk(action.prompt)}
                                            className="text-sm bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-700 dark:text-slate-300 px-4 py-2 rounded-full transition-all hover:shadow-md hover:-translate-y-0.5 font-medium flex items-center gap-2"
                                        >
                                            <span>{action.icon}</span> {action.text}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {isLoading && (
                                <div className="flex justify-start animate-in fade-in">
                                    <div className="flex gap-3 max-w-[80%]">
                                        <Avatar className="h-8 w-8 mt-1 shrink-0 border border-slate-200">
                                            <AvatarFallback className="bg-primary text-white"><Bot size={14} /></AvatarFallback>
                                        </Avatar>
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 px-5 py-3.5 rounded-2xl rounded-tl-sm flex items-center shadow-sm">
                                            <div className="flex gap-1.5 items-center px-1">
                                                <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={scrollRef} className="h-4" />
                        </div>
                    </ScrollArea>
                    <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
                        <div className="max-w-4xl mx-auto flex items-end gap-3 relative">
                            <Input
                                placeholder="Message Assistant..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                disabled={isLoading}
                                className="flex-1 py-6 pl-5 pr-14 text-base rounded-full border-slate-300 shadow-sm focus-visible:ring-primary focus-visible:border-primary transition-all bg-slate-50 dark:bg-slate-900"
                            />
                            <Button
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                                className="absolute right-1.5 bottom-1.5 h-[38px] w-[38px] rounded-full p-0 shadow-md hover:shadow-lg transition-all"
                            >
                                <Send className="h-4 w-4 ml-0.5" />
                            </Button>
                        </div>
                        <p className="text-center text-[11px] text-slate-400 mt-3 font-medium uppercase tracking-wider">AI Assistant can make mistakes. Verify important information.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AgentPage;
