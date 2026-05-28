import { useBookingCheckout } from '@/pages/public/BookingCheckoutContext';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, MapPin, Sparkles, ShieldCheck, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CheckoutSummary() {
    const { room, state, getNormalizedColor, themeColor, formatCurrency, roomTaxType, addonTaxType, subtotalAmount, taxAmount, taxName, promoCode, setPromoCode, promoMessage, handleApplyPromo, isValidating, discountAmount, finalTotal, isSubmitting, nights, roomsTotal, addonsTotal, appliedRoomTaxRate, roomTaxCalculationMethod, roomTaxAmount, addonTaxRate, addonTaxAmount, appliedPromo, setAppliedPromo, setDiscountAmount } = useBookingCheckout();
    
    return (
                    <div className="lg:sticky lg:top-8 h-fit animate-enter" style={{ animationDelay: '0.1s' }}>
                        <div className="bg-white rounded-[3rem] overflow-hidden shadow-2xl shadow-slate-300/50 border border-slate-100">
                            {/* Room Image Header */}
                            <div className="h-56 relative bg-slate-200">
                                {room.photos && room.photos.length > 0 ? (
                                    <img src={room.photos[0].url} alt="Room" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">
                                        <MapPin className="w-12 h-12 opacity-20" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute bottom-6 left-8 right-8 text-white">
                                    <h3 className="font-black text-2xl mb-1 tracking-tight">
                                        {state.rooms.length > 1 ? `${state.rooms.length} Rooms Selected` : room.name}
                                    </h3>
                                    <p className="text-xs text-white/90 font-medium mb-3 line-clamp-1">
                                        {state.rooms.map(r => r.name || r.room_type_name).join(' • ')}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {state.rooms.map((r, idx) => (
                                            <Badge key={idx} className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border-0 font-bold px-3 py-1 rounded-full text-[11px]">
                                                {r.rate_plan_name || r.rate_options?.[0]?.name || 'Standard Rate'}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 md:p-10 space-y-8">
                                {/* Date Timeline */}
                                <div className="grid grid-cols-2 gap-4 relative">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-slate-50 rounded-full border border-slate-100 flex items-center justify-center z-10 hidden md:flex">
                                        <ArrowRight className="w-4 h-4 text-slate-300" />
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Check-in</p>
                                        <p className="font-bold text-slate-900">{format(new Date(state.checkInDate), 'MMM dd')}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase">2:00 PM</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Check-out</p>
                                        <p className="font-bold text-slate-900">{format(new Date(state.checkOutDate), 'MMM dd')}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase">11:00 AM</p>
                                    </div>
                                </div>

                                <Separator className="bg-slate-100" />

                                {/* Price Breakdown */}
                                <div className="space-y-4">
                                    <div className="space-y-3 pb-2 border-b border-dashed border-slate-100">
                                        {state.rooms.map((r: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-start text-sm">
                                                <div>
                                                    <span className="text-slate-800 font-bold block">{r.name || r.room_type_name}</span>
                                                    <span className="text-xs text-slate-400 font-medium">{r.rate_plan_name || r.rate_options?.[0]?.name || 'Standard Rate'} • ({nights} {nights === 1 ? 'night' : 'nights'})</span>
                                                </div>
                                                <span className="font-bold text-slate-900">{formatCurrency(r.total_price || (r.rate_options?.[0]?.total_price))}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {state.addons && state.addons.length > 0 && (
                                        <div className="space-y-3 pt-2">
                                            {state.addons.map((addon, index) => (
                                                <div key={index} className="flex justify-between items-center text-sm">
                                                    <span className="flex items-center text-slate-500 font-medium"><Sparkles className="w-3.5 h-3.5 mr-2 text-primary" /> {addon.name}</span>
                                                    <span className="font-bold text-slate-900">{formatCurrency(addon.price)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="space-y-2.5 pt-3 border-t border-dashed border-slate-100">
                                        <div className="flex justify-between items-center text-xs text-slate-400 font-black uppercase tracking-widest ml-1">
                                            <span>Tax Breakdown ({taxName})</span>
                                            <span>{roomTaxType === 'exclusive' || (addonsTotal > 0 && addonTaxType === 'exclusive') ? 'Extra' : 'Included'}</span>
                                        </div>
                                        <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60 space-y-2 text-xs">
                                            <div className="flex justify-between items-center text-slate-600 font-medium">
                                                <span>Room {taxName} ({appliedRoomTaxRate}%{roomTaxCalculationMethod === 'slab' ? ' slab' : ''} · {roomTaxType})</span>
                                                <span className="font-bold text-slate-900">
                                                    {roomTaxType === 'inclusive' ? `Included (${formatCurrency(roomTaxAmount)})` : formatCurrency(roomTaxAmount)}
                                                </span>
                                            </div>
                                            {addonsTotal > 0 && (
                                                <div className="flex justify-between items-center text-slate-600 font-medium">
                                                    <span>Experiences & Activities {taxName} ({addonTaxRate}%)</span>
                                                    <span className="font-bold text-slate-900">
                                                        {addonTaxType === 'inclusive' ? `Included (${formatCurrency(addonTaxAmount)})` : formatCurrency(addonTaxAmount)}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center text-emerald-600 font-bold pt-1.5 border-t border-slate-200">
                                                <span>Total Taxes</span>
                                                <span>{formatCurrency(taxAmount)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                {/* Coupon Section */}
                                <div className="pt-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <Label htmlFor="promoCode" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Promo Code</Label>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            id="promoCode"
                                            placeholder="ENTER CODE"
                                            value={promoCode}
                                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                            disabled={!!appliedPromo}
                                            className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white font-bold tracking-widest text-center"
                                        />
                                        {appliedPromo ? (
                                            <Button type="button" variant="outline" size="lg" className="rounded-xl px-6 font-bold" onClick={() => {
                                                setAppliedPromo(null);
                                                setDiscountAmount(0);
                                                setPromoCode('');
                                            }}>
                                                Clear
                                            </Button>
                                        ) : (
                                            <Button type="button" size="lg" className="rounded-xl px-8 font-bold text-white" style={{ backgroundColor: themeColor }} onClick={() => handleApplyPromo()} disabled={isValidating || !promoCode}>
                                                {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                                            </Button>
                                        )}
                                    </div>
                                    {promoMessage && (
                                        <div className={cn("mt-3 p-3 rounded-xl text-xs font-bold flex items-center gap-2", appliedPromo ? "bg-green-50 text-green-600 border border-green-100" : "bg-red-50 text-red-500 border border-red-100")}>
                                            <Info className="w-3.5 h-3.5" /> {promoMessage}
                                        </div>
                                    )}
                                </div>

                                {/* Total */}
                                <div className="pt-8 border-t border-slate-100">
                                    <div className="space-y-2 mb-6">
                                        <div className="flex justify-between items-center text-slate-400 font-bold">
                                            <span className="text-xs uppercase tracking-widest">Base Subtotal</span>
                                            <span className="text-sm">{formatCurrency(subtotalAmount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-400 font-bold">
                                            <span className="text-xs uppercase tracking-widest">Taxes</span>
                                            <span className="text-sm">
                                                {roomTaxType === 'exclusive' || (addonsTotal > 0 && addonTaxType === 'exclusive') 
                                                    ? `+ ${formatCurrency(taxAmount)}` 
                                                    : `Incl. ${formatCurrency(taxAmount)}`}
                                            </span>
                                        </div>
                                        {appliedPromo && (
                                            <div className="flex justify-between items-center text-green-600 font-bold animate-in fade-in slide-in-from-top-1">
                                                <span className="text-xs uppercase tracking-widest">Loyalty Reward</span>
                                                <span className="text-sm">-{formatCurrency(discountAmount)}</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-xs font-black text-slate-900 uppercase tracking-widest mb-1">Total to Pay</span>
                                        <div className="text-right">
                                            <span className="text-4xl font-black text-slate-900 tracking-tighter block">{formatCurrency(finalTotal)}</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-right text-slate-400 font-bold uppercase tracking-tighter">
                                        {roomTaxType === 'exclusive' || (addonsTotal > 0 && addonTaxType === 'exclusive')
                                            ? `Exclusive of Taxes (added above)`
                                            : 'Inclusive of all taxes & fees'}
                                    </p>
                                </div>

                                {/* Submit Button */}
                                <Button
                                    className="w-full h-16 text-xl font-black rounded-2xl shadow-2xl text-white hover:-translate-y-1 active:translate-y-0 transition-all uppercase tracking-tight"
                                    style={{ backgroundColor: themeColor }}
                                    type="submit"
                                    form="booking-form"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-3 h-6 w-6 animate-spin" /> Confirming...
                                        </>
                                    ) : (
                                        <>
                                            Finish Booking <ArrowRight className="ml-3 h-6 w-6" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className="text-center mt-10">
                            <div className="flex items-center justify-center gap-4 mb-4">
                                <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                                    <span className="text-xs font-bold text-slate-600 uppercase">256-Bit SSL Secured</span>
                                </div>
                                <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-2.5 opacity-50" />
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-4 opacity-50" />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 max-w-xs mx-auto font-bold uppercase tracking-widest leading-relaxed">
                                By proceeding, you agree to our <a href="#" className="text-primary hover:underline">Terms</a> & <a href="#" className="text-primary hover:underline">Privacy Policy</a>.
                            </p>
                        </div>
                    </div>
    );
}
