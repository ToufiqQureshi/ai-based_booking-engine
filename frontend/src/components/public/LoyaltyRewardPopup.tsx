import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Gift, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LoyaltyRewardPopupProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
    couponCode: string;
    discountText: string;
    onApply: () => void;
}

export const LoyaltyRewardPopup: React.FC<LoyaltyRewardPopupProps> = ({
    isOpen,
    onClose,
    message,
    couponCode,
    discountText,
    onApply
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-md overflow-hidden bg-white rounded-[2.5rem] shadow-2xl"
                    >
                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent -z-10" />
                        <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
                        
                        <div className="p-8 text-center">
                            <button 
                                onClick={onClose}
                                className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>

                            <div className="flex justify-center mb-6">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                                    <div className="relative w-20 h-20 bg-primary text-white rounded-3xl flex items-center justify-center rotate-6">
                                        <Sparkles className="w-10 h-10" />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                                        <Gift className="w-5 h-5 text-primary" />
                                    </div>
                                </div>
                            </div>

                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4">
                                <CheckCircle2 className="w-3 h-3" /> AI Personalized Offer
                            </div>

                            <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight leading-tight">
                                Special Reward Unlocked!
                            </h2>
                            
                            <p className="text-slate-600 mb-8 leading-relaxed px-4">
                                {message}
                            </p>

                            <div className="relative mb-8 group">
                                <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-md group-hover:bg-primary/15 transition-all" />
                                <div className="relative border-2 border-dashed border-primary/30 bg-primary/5 rounded-2xl p-6 transition-all group-hover:border-primary/50">
                                    <p className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-1">Coupon Code</p>
                                    <p className="text-3xl font-black text-primary tracking-tighter mb-2">{couponCode}</p>
                                    <p className="text-sm font-bold text-slate-900">{discountText}</p>
                                </div>
                            </div>

                            <Button 
                                onClick={onApply}
                                className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:-translate-y-1 transition-all"
                            >
                                Claim My Discount <ArrowRight className="ml-2 w-5 h-5" />
                            </Button>
                            
                            <p className="mt-4 text-xs text-slate-400">
                                Valid for this booking only. Terms & conditions apply.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
