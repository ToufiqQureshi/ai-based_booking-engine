import { useBookingCheckout } from '@/guest_booking/BookingCheckoutContext';
import { Sparkles, Plus, Check } from 'lucide-react';
import { cn } from '@/core/lib/utils';

export function CheckoutEnhanceStay() {
    const { allAddons, state, handleToggleAddon, formatCurrency } = useBookingCheckout();
    
    if (allAddons.length === 0) return null;
    
    return (
        <>
            {allAddons.length > 0 && (
                            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                    <Sparkles className="w-32 h-32 text-primary" />
                                </div>

                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 rotate-3 animate-pulse">
                                        <Sparkles className="w-6 h-6 animate-pulse" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Enhance Your Stay</h2>
                                        <p className="text-sm text-slate-500 font-medium">Add exclusive experiences, activities, and dining options to your booking.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {allAddons.map((addon) => {
                                        const isSelected = state.addons?.some(a => a.id === addon.id) || false;
                                        return (
                                            <div
                                                key={addon.id}
                                                onClick={() => handleToggleAddon(addon)}
                                                className={cn(
                                                    "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer select-none",
                                                    isSelected
                                                        ? "border-indigo-500 bg-indigo-50/20 shadow-md shadow-indigo-100/50"
                                                        : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-50"
                                                )}
                                            >
                                                {/* Addon Image/Icon */}
                                                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200/60 shrink-0 flex items-center justify-center text-slate-400 relative">
                                                    <Sparkles className="w-6 h-6 text-indigo-400" />
                                                    {addon.image_url && (
                                                        <img
                                                            src={addon.image_url}
                                                            alt={addon.name}
                                                            className="absolute inset-0 w-full h-full object-cover"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    )}
                                                </div>

                                                {/* Addon Content */}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-extrabold text-slate-800 text-sm leading-snug truncate">{addon.name}</h4>
                                                    <p className="text-xs font-black text-indigo-600 mt-1">{formatCurrency(addon.price)}</p>
                                                </div>

                                                {/* Selection Checkbox */}
                                                <div className={cn(
                                                    "w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all shrink-0",
                                                    isSelected
                                                        ? "bg-indigo-600 border-indigo-600 text-white"
                                                        : "border-slate-200 text-slate-300 bg-white"
                                                )}>
                                                    {isSelected ? (
                                                        <Check className="w-3.5 h-3.5" />
                                                    ) : (
                                                        <Plus className="w-3.5 h-3.5" />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
        </>
    );
}



