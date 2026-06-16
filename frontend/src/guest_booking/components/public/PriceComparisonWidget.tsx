
import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/core/lib/utils";

interface PriceComparisonWidgetProps {
    currentPrice: number;
}

export function PriceComparisonWidget({ currentPrice }: PriceComparisonWidgetProps) {
    const [isVisible, setIsVisible] = useState(false);

    // Mock OTA prices (always higher)
    const agodaPrice = Math.round(currentPrice * 1.15);
    const bookingPrice = Math.round(currentPrice * 1.18);
    const expediaPrice = Math.round(currentPrice * 1.20);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(price);
    };

    useEffect(() => {
        // Show after a slight delay
        const timer = setTimeout(() => setIsVisible(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    if (currentPrice === 0) return null;

    return (
        <Card
            className={cn(
                "fixed bottom-4 left-4 z-40 w-72 shadow-2xl border-0 overflow-hidden transition-all duration-500 transform",
                isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            )}
        >
            <div className="bg-green-600 p-3 flex justify-between items-center text-white">
                <div className="font-bold text-sm flex items-center">
                    <Check className="w-4 h-4 mr-1.5" /> Best Rate Guaranteed
                </div>
                <button onClick={() => setIsVisible(false)} className="text-white/80 hover:text-white">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <CardContent className="p-0">
                <div className="bg-green-50/50 p-3 border-b border-green-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">Direct Booking</span>
                    </div>
                    <span className="font-bold text-green-700">{formatPrice(currentPrice)}</span>
                </div>

                <div className="p-4 text-center text-xs text-slate-500 font-medium bg-white">
                    Always book direct to get the guaranteed best prices and zero booking fees!
                </div>
            </CardContent>
        </Card>
    );
}
