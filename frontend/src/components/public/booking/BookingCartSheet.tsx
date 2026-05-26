import { addDays } from 'date-fns';
import { ShoppingBag, ArrowRight, Trash2, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import { PublicRoomSearchResult, RateOption, AddOn } from '@/types/api';

interface CartItem {
    id: string;
    room: PublicRoomSearchResult;
    ratePlan: RateOption;
    addons: AddOn[];
    adults: number;
    children: number;
}

interface BookingCartSheetProps {
    cart: CartItem[];
    setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
    isCartSheetOpen: boolean;
    setIsCartSheetOpen: (open: boolean) => void;
    themeColor: string;
    formatCurrency: (amount: number | undefined | null) => string;
    navigate: (url: string, options?: any) => void;
    hotelSlug: string;
    checkInDate: Date | undefined;
    checkOutDate: Date | undefined;
    adults: number;
    children: number;
}

export function BookingCartSheet({
    cart,
    setCart,
    isCartSheetOpen,
    setIsCartSheetOpen,
    themeColor,
    formatCurrency,
    navigate,
    hotelSlug,
    checkInDate,
    checkOutDate,
    adults,
    children,
}: BookingCartSheetProps) {
    const handleCheckout = () => {
        setIsCartSheetOpen(false);
        navigate(`/book/${hotelSlug}/checkout`, {
            state: {
                checkInDate: checkInDate || new Date(),
                checkOutDate: checkOutDate || addDays(new Date(), 1),
                guests: (adults + children).toString() || '1',
                rooms: cart.map(item => ({
                    ...item.room,
                    price_per_night: item.ratePlan.price_per_night,
                    total_price: item.ratePlan.total_price,
                    rate_plan_id: item.ratePlan.id,
                    rate_plan_name: item.ratePlan.name
                })),
                addons: cart.flatMap(item => item.addons),
                totalRoomPrice: cart.reduce((sum, item) => sum + item.ratePlan.total_price, 0)
            }
        });
    };

    const cartTotal = cart.reduce(
        (sum, item) => sum + item.ratePlan.total_price + item.addons.reduce((as, a) => as + a.price, 0),
        0
    );

    return (
        <>
            {/* STAAH Multi-Room Floating Bottom Bar */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 text-white py-4 px-6 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] animate-slide-up">
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div 
                                className="w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${themeColor}33`, borderColor: `${themeColor}4d`, color: themeColor }}
                            >
                                <ShoppingBag className="w-6 h-6 animate-pulse" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-lg">{cart.length} {cart.length === 1 ? 'Room' : 'Rooms'} Selected</span>
                                    <Badge 
                                        className="text-white font-bold px-2 py-0.5 text-xs border-0"
                                        style={{ backgroundColor: themeColor }}
                                    >
                                        Multi-Room Cart
                                    </Badge>
                                </div>
                                <p className="text-xs text-white/70 font-medium line-clamp-1">
                                    {cart.map(c => `${c.room.name} (${c.ratePlan.name})`).join(' + ')}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right hidden sm:block">
                                <span className="text-[10px] uppercase font-black tracking-wider text-white/60 block">Estimated Total</span>
                                <span className="text-xl font-black text-yellow-300">{formatCurrency(cartTotal)}</span>
                            </div>
                            <Button 
                                onClick={() => setIsCartSheetOpen(true)}
                                className="h-12 text-white font-bold rounded-2xl px-6 text-base shadow-lg gap-2"
                                style={{ backgroundColor: themeColor }}
                            >
                                <span>View Cart ({cart.length})</span>
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* STAAH Multi-Room Cart Sheet Drawer */}
            <Sheet open={isCartSheetOpen} onOpenChange={setIsCartSheetOpen}>
                <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col border-l shadow-2xl bg-slate-50 z-50">
                    <SheetHeader className="p-6 border-b bg-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="w-5 h-5" style={{ color: themeColor }} />
                                <SheetTitle className="text-xl font-bold text-slate-900">Your Booking Cart</SheetTitle>
                            </div>
                            <Badge 
                                className="border-0 font-bold animate-pulse"
                                style={{ backgroundColor: `${themeColor}1a`, color: themeColor }}
                            >
                                {cart.length} {cart.length === 1 ? 'Item' : 'Items'}
                            </Badge>
                        </div>
                        <SheetDescription className="text-xs text-slate-500 mt-1">Review and manage all selected rooms and packages before secure checkout.</SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {cart.length === 0 ? (
                            <div className="text-center py-16 space-y-3">
                                <div 
                                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                                    style={{ backgroundColor: `${themeColor}10`, color: themeColor }}
                                >
                                    <ShoppingBag className="w-8 h-8 opacity-80" />
                                </div>
                                <p className="font-bold text-slate-700 text-base">Your booking cart is empty</p>
                                <p className="text-xs text-slate-400 max-w-xs mx-auto">Select a room and rate plan from the list to start building your multi-room stay.</p>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <div key={item.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm relative group space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h4 className="font-black text-slate-900 text-base">{item.room.name}</h4>
                                            <Badge className="mt-1 bg-slate-100 text-slate-700 border-0 text-[11px] font-semibold">{item.ratePlan.name}</Badge>
                                        </div>
                                        <button
                                            onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))}
                                            className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                            title="Remove room"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs">
                                        <div>
                                            <span className="text-slate-400 block font-medium">Guests</span>
                                            <span className="font-bold text-slate-700">{item.adults} Adults{item.children > 0 ? `, ${item.children} Children` : ''}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-slate-400 block font-medium">Room Total</span>
                                            <span className="font-bold text-slate-900">{formatCurrency(item.ratePlan.total_price)}</span>
                                        </div>
                                    </div>

                                    {item.addons.length > 0 && (
                                        <div className="text-xs border-t pt-2 space-y-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Add-ons</span>
                                            {item.addons.map(a => (
                                                <div key={a.id} className="flex justify-between text-slate-600">
                                                    <span>• {a.name}</span>
                                                    <span className="font-semibold text-slate-800">{formatCurrency(a.price)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {cart.length > 0 && (
                        <SheetFooter className="p-6 border-t bg-white flex flex-col sm:flex-col sm:space-x-0 gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.06)] w-full">
                            <div className="bg-slate-50/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-3 w-full">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Stay Cart Summary</p>
                                    <p className="text-sm font-extrabold text-slate-800 truncate">{cart.length} {cart.length === 1 ? 'Room' : 'Rooms'} Selected</p>
                                    <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5 truncate">
                                        <Check className="w-3 h-3 shrink-0" /> <span>Taxes & fees included</span>
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-[10px] uppercase font-black tracking-widest block" style={{ color: themeColor }}>Grand Total</span>
                                    <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                                        {formatCurrency(cartTotal)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 w-full">
                                <Button 
                                    size="lg" 
                                    className="w-full font-black text-base text-white shadow-xl rounded-2xl h-14 flex items-center justify-center gap-2 transition-all active:scale-[0.99]" 
                                    style={{ backgroundColor: themeColor }}
                                    onClick={handleCheckout}
                                >
                                    <span className="truncate">Proceed to Secure Checkout</span>
                                    <ArrowRight className="w-5 h-5 shrink-0 ml-1" />
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="lg" 
                                    className="w-full font-bold text-slate-700 border-slate-200 rounded-2xl h-12 transition-colors flex items-center justify-center gap-2" 
                                    onClick={() => setIsCartSheetOpen(false)}
                                >
                                    <Plus className="w-4 h-4 shrink-0" style={{ color: themeColor }} />
                                    <span className="truncate">Add Another Room to Stay</span>
                                </Button>
                            </div>
                        </SheetFooter>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
}
