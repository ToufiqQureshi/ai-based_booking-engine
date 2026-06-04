import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Gift, CheckCircle2, ArrowRight, Trophy, Zap, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Reward popup (milestone reached — coupon unlocked) ─────────────────────
interface LoyaltyRewardPopupProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
    couponCode: string;
    discountText: string;
    onApply: () => void;
}

export const LoyaltyRewardPopup: React.FC<LoyaltyRewardPopupProps> = ({
    isOpen, onClose, message, couponCode, discountText, onApply,
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.88, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: 24 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="relative w-full max-w-sm overflow-hidden bg-white dark:bg-slate-900 rounded-3xl shadow-2xl"
                    >
                        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent pointer-events-none" />

                        <div className="relative p-7 text-center">
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4 text-slate-400" />
                            </button>

                            <div className="flex justify-center mb-5">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary/25 rounded-full blur-2xl animate-pulse" />
                                    <div className="relative w-[72px] h-[72px] bg-primary text-white rounded-[1.4rem] flex items-center justify-center rotate-6 shadow-lg shadow-primary/30">
                                        <Sparkles className="w-9 h-9" />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 w-9 h-9 bg-white dark:bg-slate-800 rounded-xl shadow-md flex items-center justify-center border border-primary/10">
                                        <Gift className="w-4 h-4 text-primary" />
                                    </div>
                                </div>
                            </div>

                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider mb-3">
                                <CheckCircle2 className="w-3 h-3" /> Reward Unlocked
                            </div>

                            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-3 tracking-tight leading-snug">
                                Special Reward Unlocked!
                            </h2>

                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed px-2">
                                {message}
                            </p>

                            <div className="relative mb-6 group cursor-pointer" onClick={onApply}>
                                <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-md group-hover:bg-primary/15 transition-all" />
                                <div className="relative border-2 border-dashed border-primary/40 bg-primary/5 rounded-2xl p-5 transition-all group-hover:border-primary/60">
                                    <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-1">Coupon Code</p>
                                    <p className="text-2xl font-black text-primary tracking-tight mb-1">{couponCode}</p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{discountText}</p>
                                </div>
                            </div>

                            <Button
                                onClick={onApply}
                                className="w-full h-12 text-base font-bold rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                Claim My Discount <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>

                            <p className="mt-3 text-[11px] text-slate-400">
                                Valid for this booking only. Terms apply.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};


// ── Milestone nudge popup (1 booking away — not yet unlocked) ───────────────
interface LoyaltyMilestonePopupProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    rewardDescription: string;
    bookingsCompleted: number;
    bookingsToReward: number;
    milestoneTotal: number;
    onContinue: () => void;
}

export const LoyaltyMilestonePopup: React.FC<LoyaltyMilestonePopupProps> = ({
    isOpen, onClose, title, message, rewardDescription,
    bookingsCompleted, bookingsToReward, milestoneTotal, onContinue,
}) => {
    const completedInCycle = milestoneTotal > 0 ? bookingsCompleted % milestoneTotal : bookingsCompleted;
    const progress = milestoneTotal > 0
        ? Math.min(100, Math.round((completedInCycle / milestoneTotal) * 100))
        : 0;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.88, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: 24 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="relative w-full max-w-sm overflow-hidden bg-white dark:bg-slate-900 rounded-3xl shadow-2xl"
                    >
                        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-amber-500/10 via-amber-400/5 to-transparent pointer-events-none" />

                        <div className="relative p-7 text-center">
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4 text-slate-400" />
                            </button>

                            <div className="flex justify-center mb-5">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-2xl animate-pulse" />
                                    <div className="relative w-[72px] h-[72px] bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-[1.4rem] flex items-center justify-center shadow-lg shadow-amber-400/30">
                                        <Trophy className="w-9 h-9" />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 w-9 h-9 bg-white dark:bg-slate-800 rounded-xl shadow-md flex items-center justify-center border border-amber-100">
                                        <Zap className="w-4 h-4 text-amber-500" />
                                    </div>
                                </div>
                            </div>

                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-3">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Almost There
                            </div>

                            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                                {title}
                            </h2>

                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed px-2">
                                {message}
                            </p>

                            {/* Progress bar */}
                            <div className="mb-5">
                                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                                    <span>{completedInCycle} / {milestoneTotal} stays</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                                    <motion.div
                                        className="h-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                                    />
                                </div>
                            </div>

                            {/* Reward preview */}
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-5">
                                <p className="text-[10px] font-bold text-amber-600/70 dark:text-amber-400/70 uppercase tracking-widest mb-1">
                                    Your Upcoming Reward
                                </p>
                                <p className="text-base font-black text-amber-700 dark:text-amber-300">
                                    {rewardDescription}
                                </p>
                            </div>

                            <Button
                                onClick={onContinue}
                                className="w-full h-12 text-base font-bold rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 border-0 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-400/25 hover:-translate-y-0.5 transition-all"
                            >
                                Continue Booking <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>

                            <p className="mt-3 text-[11px] text-slate-400">
                                Complete this booking to get {bookingsToReward} step closer!
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
