import { useBookingCheckout } from '@/guest_booking/BookingCheckoutContext';
import { CreditCard, Building2, MapPin, ShieldCheck } from 'lucide-react';
import { cn } from '@/core/lib/utils';

export function CheckoutPayment() {
    const { hotelPaymentMode, paymentMethod, setPaymentMethod, themeColor } = useBookingCheckout();
    
    // Payment Section
    return (
        <div className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-xl shadow-slate-200/40">
            {/* Header */}
            <div className="px-8 md:px-10 pt-8 md:pt-10 pb-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Payment</h2>
                                    <p className="text-sm font-medium" style={{ color: themeColor }}>
                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse align-middle" />
                                        Powered by Razorpay • 256-bit SSL Encrypted
                                    </p>
                                </div>
                            </div>

                            {/* Payment Options */}
                            <div className="px-8 md:px-10 pb-8 md:pb-10 space-y-3">

                                {/* --- ONLINE ONLY: Just a clean info block, no choice --- */}
                                {hotelPaymentMode === 'online_only' && (
                                    <div className="flex items-start gap-4 p-5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/40">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <CreditCard className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-black text-slate-900">Secure Online Payment</h3>
                                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-widest">Required</span>
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium">Complete your booking with a secure online payment via Credit/Debit Card, UPI, or Net Banking.</p>
                                            <div className="flex items-center gap-2 mt-3">
                                                <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-4 opacity-50" />
                                                <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-5 opacity-50" />
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">+ UPI, NetBanking</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* --- PROPERTY ONLY: Just a clean info block, no choice --- */}
                                {hotelPaymentMode === 'property_only' && (
                                    <div className="flex items-start gap-4 p-5 rounded-2xl border-2 border-slate-200 bg-slate-50/50">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <CreditCard className="w-5 h-5 text-slate-500" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-black text-slate-900">Pay at Property</h3>
                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-widest">No Charge Today</span>
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium">Your booking is guaranteed. Full payment is collected directly at the hotel during check-in or check-out.</p>
                                        </div>
                                    </div>
                                )}

                                {/* --- BOTH: Guest chooses --- */}
                                {hotelPaymentMode === 'both' && (
                                    <>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Choose how you'd like to pay</p>

                                        {/* Pay Now Option */}
                                        <label
                                            htmlFor="pay-online"
                                            className={cn(
                                                "flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200",
                                                paymentMethod === 'online'
                                                    ? "border-emerald-500 bg-emerald-50/40 shadow-sm shadow-emerald-100"
                                                    : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50"
                                            )}
                                        >
                                            <div className="flex items-center pt-0.5">
                                                <input
                                                    id="pay-online"
                                                    type="radio"
                                                    name="paymentMethod"
                                                    value="online"
                                                    checked={paymentMethod === 'online'}
                                                    onChange={() => setPaymentMethod('online')}
                                                    className="w-4 h-4 accent-emerald-600"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-black text-slate-900">Pay Now (Online)</h3>
                                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-widest">Instant Confirm</span>
                                                </div>
                                                <p className="text-sm text-slate-500 font-medium">Pay securely via Credit/Debit Card, UPI, or Net Banking. Booking confirmed instantly.</p>
                                                <div className="flex items-center gap-2 mt-2.5">
                                                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className={cn("h-3.5 transition-opacity", paymentMethod === 'online' ? 'opacity-70' : 'opacity-30')} />
                                                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className={cn("h-5 transition-opacity", paymentMethod === 'online' ? 'opacity-70' : 'opacity-30')} />
                                                    <span className={cn("text-[10px] font-bold uppercase tracking-wider transition-colors", paymentMethod === 'online' ? 'text-slate-400' : 'text-slate-300')}>+ UPI, NetBanking</span>
                                                </div>
                                            </div>
                                        </label>

                                        {/* Pay at Property Option */}
                                        <label
                                            htmlFor="pay-property"
                                            className={cn(
                                                "flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200",
                                                paymentMethod === 'property'
                                                    ? "border-slate-400 bg-slate-50/60 shadow-sm"
                                                    : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50"
                                            )}
                                        >
                                            <div className="flex items-center pt-0.5">
                                                <input
                                                    id="pay-property"
                                                    type="radio"
                                                    name="paymentMethod"
                                                    value="property"
                                                    checked={paymentMethod === 'property'}
                                                    onChange={() => setPaymentMethod('property')}
                                                    className="w-4 h-4 accent-slate-600"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-black text-slate-900">Pay at Property</h3>
                                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-widest">No Charge Today</span>
                                                </div>
                                                <p className="text-sm text-slate-500 font-medium">No charges today. Your booking is guaranteed and payment is collected at the hotel.</p>
                                            </div>
                                        </label>
                                    </>
                                )}
                            </div>
        </div>
    );
}



