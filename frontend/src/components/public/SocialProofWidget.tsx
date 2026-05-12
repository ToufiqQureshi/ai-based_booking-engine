import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Clock, ShieldCheck, TrendingUp } from 'lucide-react';

export const SocialProofWidget: React.FC = () => {
    const [viewers, setViewers] = useState(Math.floor(Math.random() * 5) + 3);
    const [lastBooked, setLastBooked] = useState(Math.floor(Math.random() * 12) + 2);
    const [isVisible, setIsVisible] = useState(true);

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

    const proofs = [
        {
            icon: <Eye className="w-4 h-4 text-blue-500" />,
            text: `${viewers} people are viewing this hotel right now`,
            color: "bg-blue-50 text-blue-700 border-blue-100"
        },
        {
            icon: <Clock className="w-4 h-4 text-orange-500" />,
            text: `Last booked ${lastBooked} hours ago`,
            color: "bg-orange-50 text-orange-700 border-orange-100"
        },
        {
            icon: <ShieldCheck className="w-4 h-4 text-green-500" />,
            text: "Free cancellation available on most rates",
            color: "bg-green-50 text-green-700 border-green-100"
        },
        {
            icon: <TrendingUp className="w-4 h-4 text-purple-500" />,
            text: "Popular choice! 45 bookings this month",
            color: "bg-purple-50 text-purple-700 border-purple-100"
        }
    ];

    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % proofs.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [proofs.length]);

    return (
        <div className="space-y-3 mb-6">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className={`flex items-center gap-3 p-3 rounded-2xl border ${proofs[currentIndex].color} text-sm font-medium shadow-sm`}
                >
                    <div className="shrink-0">
                        {proofs[currentIndex].icon}
                    </div>
                    <p>{proofs[currentIndex].text}</p>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
