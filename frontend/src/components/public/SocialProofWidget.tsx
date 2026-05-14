import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Clock, ShieldCheck, TrendingUp } from 'lucide-react';
import { Hotel } from '@/types/api';

interface SocialProofWidgetProps {
    hotel?: Hotel | null;
}

export const SocialProofWidget: React.FC<SocialProofWidgetProps> = ({ hotel }) => {
    const [viewers, setViewers] = useState(Math.floor(Math.random() * 5) + 3);
    const [lastBooked, setLastBooked] = useState(Math.floor(Math.random() * 12) + 2);
    const settings = hotel?.settings;

    useEffect(() => {
        const timer = setInterval(() => {
            setViewers(prev => {
                const change = Math.random() > 0.5 ? 1 : -1;
                const next = prev + change;
                return next < 2 ? 2 : next > 12 ? 12 : next;
            });
        }, 8000);
        return () => clearInterval(timer);
    }, []);

    const proofs = [];

    if (settings?.show_viewers_count !== false) {
        proofs.push({
            icon: <Eye className="w-4 h-4 text-blue-500" />,
            text: `${viewers} people are viewing this hotel right now`,
            color: "bg-blue-50 text-blue-700 border-blue-100"
        });
    }

    if (settings?.show_last_booked !== false) {
        proofs.push({
            icon: <Clock className="w-4 h-4 text-orange-500" />,
            text: `Last booked ${lastBooked} hours ago`,
            color: "bg-orange-50 text-orange-700 border-orange-100"
        });
    }

    if (hotel?.rate_plans?.some(p => p.is_refundable) || true) { // Defaulting to true if logic not fully integrated yet
        proofs.push({
            icon: <ShieldCheck className="w-4 h-4 text-green-500" />,
            text: hotel?.settings?.cancellation_policy || "Free cancellation available on most rates",
            color: "bg-green-50 text-green-700 border-green-100"
        });
    }

    if (settings?.show_popular_badge !== false) {
        const bookingCount = Math.floor(Math.random() * 30) + 15;
        const text = settings?.popular_badge_text 
            ? settings.popular_badge_text.replace("{count}", bookingCount.toString())
            : `Popular choice! ${bookingCount} bookings this month`;

        proofs.push({
            icon: <TrendingUp className="w-4 h-4 text-purple-500" />,
            text: text,
            color: "bg-purple-50 text-purple-700 border-purple-100"
        });
    }

    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (proofs.length === 0) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % proofs.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [proofs.length]);

    if (proofs.length === 0) return null;

    return (
        <div className="space-y-3 mb-6">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className={`flex items-center gap-3 p-3 rounded-2xl border ${proofs[currentIndex % proofs.length].color} text-sm font-medium shadow-sm`}
                >
                    <div className="shrink-0">
                        {proofs[currentIndex % proofs.length].icon}
                    </div>
                    <p>{proofs[currentIndex % proofs.length].text}</p>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
