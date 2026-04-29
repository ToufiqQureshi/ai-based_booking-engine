import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
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
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: 'Namaste! Main Staybooker AI hun. Main aapki hotel growth aur operations mein kaise madad kar sakta hun?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

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
        <div className="container mx-auto p-4 h-[calc(100vh-4rem)] flex flex-col">
            <Card className="flex-1 flex flex-col shadow-lg border-2">
                <CardHeader className="border-b bg-muted/20">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-primary">
                            <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={24} /></AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle>Hotelier AI Assistant</CardTitle>
                            <CardDescription>Ask me anything about your hotel, reports, or tasks.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                    <ScrollArea className="flex-1 p-4">
                        <div className="flex flex-col gap-4">
                            {messages.map((msg, index) => (
                                <div key={index} className={`flex ${msg.role === 'human' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`flex gap-3 max-w-[80%] ${msg.role === 'human' ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <Avatar className="h-8 w-8 mt-1">
                                            {msg.role === 'human' ? (
                                                <AvatarFallback className="bg-slate-200"><User size={16} /></AvatarFallback>
                                            ) : (
                                                <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={16} /></AvatarFallback>
                                            )}
                                        </Avatar>
                                        <div className={`p-3 rounded-lg text-sm ${msg.role === 'human'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted border'
                                            }`}>
                                            <div className="prose dark:prose-invert max-w-none text-sm break-words">
                                                <ReactMarkdown
                                                    components={{
                                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                        ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2" {...props} />,
                                                        ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2" {...props} />,
                                                        strong: ({ node, ...props }) => <strong className="font-bold text-foreground" {...props} />
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
                                <div className="flex flex-wrap gap-2 mt-2 ml-11 max-w-[80%]">
                                    <button
                                        onClick={() => triggerQuickAsk("Show me last week's total revenue")}
                                        className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition"
                                    >
                                        📊 Total Revenue
                                    </button>
                                    <button
                                        onClick={() => triggerQuickAsk("Tell me which rooms are most booked")}
                                        className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition"
                                    >
                                        🛏️ Most Booked Rooms
                                    </button>
                                    <button
                                        onClick={() => triggerQuickAsk("Check our occupancy rate for this month")}
                                        className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition"
                                    >
                                        📈 Occupancy Rate
                                    </button>
                                    <button
                                        onClick={() => triggerQuickAsk("What are the cancellation metrics?")}
                                        className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition"
                                    >
                                        ❌ Cancellation Stats
                                    </button>
                                </div>
                            )}

                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="flex gap-3 max-w-[80%]">
                                        <Avatar className="h-8 w-8 mt-1">
                                            <AvatarFallback className="bg-primary text-primary-foreground"><Bot size={16} /></AvatarFallback>
                                        </Avatar>
                                        <div className="bg-muted border p-3 rounded-lg flex items-center">
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            <span className="text-xs text-muted-foreground">Thinking...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={scrollRef} />
                        </div>
                    </ScrollArea>
                    <div className="p-4 border-t bg-background">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Type your request here (e.g., 'Show me last month's revenue')..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                disabled={isLoading}
                                className="flex-1"
                            />
                            <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AgentPage;
