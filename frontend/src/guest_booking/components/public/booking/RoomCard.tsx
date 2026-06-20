import { Bed, BedDouble, User, Maximize, Wifi, Check, Sparkles, Gift, Info, X, BadgePercent, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PublicRoomSearchResult, RateOption } from '@/core/types/api';
import { RoomImageCarousel } from './RoomImageCarousel';
import { ICONS } from '@/core/lib/amenityIcons';

// A stay offer scoped to this room (or hotel-wide). The discounted price shown
// here is a PREVIEW only; the real discount is recomputed server-side at booking.
export interface RoomStayOffer {
    offer_id: string;
    unlocked: boolean;
    apply_mode: 'auto' | 'manual_claim';
    display_style: 'banner' | 'badge';
    unlocked_message: string;
    reward_type: 'percentage' | 'fixed_amount' | 'free_night';
    reward_value: number;
    reward_label: string;
    min_nights: number;
    nights_remaining: number;
}

interface RoomCardProps {
    room: PublicRoomSearchResult;
    filteredRates?: RateOption[];
    formatCurrency: (amount: number | undefined | null) => string;
    themeColor: string;
    handleSelectRate: (room: PublicRoomSearchResult, ratePlan: RateOption) => void;
    setSelectedRoom: (room: PublicRoomSearchResult) => void;
    setIsModalOpen: (val: boolean) => void;
    getImageUrl: (url?: string | null) => string;
    isRefreshing?: boolean;
    stayOffer?: RoomStayOffer;
    offerClaimed?: boolean;
    onClaimOffer?: () => void;
    nights?: number;
}

// Preview-only discounted price for an unlocked offer. Server is the source of
// truth at booking; this just mirrors the same formula for display.
function previewDiscountedPrice(total: number, offer: RoomStayOffer, nights: number): number {
    if (offer.reward_type === 'percentage') return Math.max(0, total * (1 - offer.reward_value / 100));
    if (offer.reward_type === 'fixed_amount') return Math.max(0, total - offer.reward_value);
    if (offer.reward_type === 'free_night' && nights > 0) return Math.max(0, total * (nights - 1) / nights);
    return total;
}

export function RoomCard({
    room,
    filteredRates,
    formatCurrency,
    themeColor,
    handleSelectRate,
    setSelectedRoom,
    setIsModalOpen,
    getImageUrl,
    isRefreshing = false,
    stayOffer,
    offerClaimed = false,
    onClaimOffer,
    nights = 1,
}: RoomCardProps) {
    const displayRates = filteredRates || (room.rate_options || []).filter(o => !o.is_package);
    const isSoldOut = room.available_rooms === 0;
    // The discount is live on the price when the offer is unlocked AND either the
    // hotelier set auto-apply OR the guest tapped Claim.
    const offerActive = !!stayOffer && stayOffer.unlocked &&
        (stayOffer.apply_mode === 'auto' || offerClaimed);
    const showClaimCta = !!stayOffer && stayOffer.unlocked &&
        stayOffer.apply_mode === 'manual_claim' && !offerClaimed;

    return (
        <div className="bg-white rounded-xl overflow-hidden mb-8 border border-slate-200 hover:border-slate-300 transition-all duration-300 group">
            <div className="flex flex-col lg:flex-row">
                {/* Visual Section */}
                <div className="lg:w-[35%] h-64 lg:h-auto bg-slate-50 relative overflow-hidden">
                    <RoomImageCarousel photos={room.photos} videos={(room as any).videos} roomName={room.name} onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }} />
                    <div className="absolute top-6 left-6 z-10">
                        {isSoldOut ? (
                            <div className="bg-red-600/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-white" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Sold Out</span>
                            </div>
                        ) : (
                            <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm flex items-center gap-2 border border-white/50">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Available</span>
                            </div>
                        )}
                    </div>

                    {/* Stay-offer badge (compact corner tag) */}
                    {stayOffer && stayOffer.display_style === 'badge' && !isSoldOut && (
                        <div className="absolute top-6 right-6 z-10 group/badge" title={stayOffer.unlocked_message}>
                            <div
                                className="px-3 py-2 rounded-2xl shadow-lg flex items-center gap-1.5 text-white"
                                style={{ backgroundColor: themeColor }}
                            >
                                <BadgePercent className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-black uppercase tracking-wider">
                                    {stayOffer.unlocked ? stayOffer.reward_label : `${stayOffer.min_nights}+ nights`}
                                </span>
                            </div>
                            <div className="absolute right-0 mt-1 w-52 opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none z-20">
                                <div className="bg-slate-900 text-white text-[11px] font-medium rounded-lg p-2.5 shadow-xl leading-snug">
                                    {stayOffer.unlocked_message}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Content Section: Minimalist & Clean */}
                <div className="flex-1 flex flex-col p-5 lg:p-6">
                    {/* Stay-offer banner (full-width strip) — hotelier's custom upsell copy */}
                    {stayOffer && stayOffer.display_style === 'banner' && !isSoldOut && (
                        <div
                            className="mb-4 rounded-xl p-3 flex items-center justify-between gap-3 border"
                            style={{
                                backgroundColor: `${themeColor}0d`,
                                borderColor: `${themeColor}33`,
                            }}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white"
                                    style={{ backgroundColor: themeColor }}
                                >
                                    {stayOffer.unlocked ? <Sparkles className="w-4 h-4" /> : <CalendarPlus className="w-4 h-4" />}
                                </div>
                                <p className="text-[12px] font-bold leading-snug" style={{ color: themeColor }}>
                                    {stayOffer.unlocked_message}
                                </p>
                            </div>
                            {showClaimCta && (
                                <Button
                                    size="sm"
                                    className="text-white font-bold text-[11px] h-8 px-4 rounded-lg shrink-0"
                                    style={{ backgroundColor: themeColor }}
                                    onClick={onClaimOffer}
                                >
                                    Claim
                                </Button>
                            )}
                            {offerActive && (
                                <span className="text-[10px] font-black uppercase tracking-wider text-green-600 shrink-0">
                                    Applied ✓
                                </span>
                            )}
                        </div>
                    )}

                    {/* Header Area */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-4">
                        <div className="space-y-0.5">
                            <h3 className="text-lg font-bold text-slate-800 tracking-tight leading-snug transition-colors duration-200">
                                {room.name}
                            </h3>
                            <div className="flex items-center gap-3 text-slate-500 text-[11px] font-medium">
                                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {room.max_occupancy} Adults</span>
                                <span className="text-slate-300">•</span>
                                <span className="flex items-center gap-1"><Maximize className="w-3 h-3" /> {room.room_size || '---'} ft²</span>
                            </div>
                        </div>
                        <button 
                            className="font-semibold text-xs hover:underline transition-all"
                            style={{ color: themeColor }}
                            onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }}
                        >
                            Room Details
                        </button>
                    </div>

                    {/* Amenities: Minimal & Gray */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mb-6">
                        {(room.amenities || []).slice(0, 4).map((am: any, i) => {
                            const Icon = ICONS[am.icon_slug || am.icon] || Wifi;
                            return (
                                <div key={i} className="flex items-center gap-1.5" title={am.name}>
                                    <Icon className="w-3 h-3 text-slate-400" />
                                    <span className="text-[11px] text-slate-500">{am.name}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Rates: Clean List Style */}
                    <div className="border-t border-slate-100 mt-auto pt-4 space-y-3">
                        {isSoldOut ? (
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-slate-400 italic">No rooms available for these dates</span>
                                <Button disabled className="text-xs px-6 h-10 rounded-xl opacity-40 cursor-not-allowed">
                                    Sold Out
                                </Button>
                            </div>
                        ) : (
                        <>
                        {isRefreshing && (
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 pb-1">
                                <div className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin" />
                                Refreshing rates…
                            </div>
                        )}
                        {displayRates.map((plan) => (
                            <div 
                                key={plan.id} 
                                className="flex items-center justify-between group/rate py-2"
                            >
                                <div className="flex-1 flex items-center gap-3">
                                    {plan.image_url && (
                                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-100 bg-slate-50 relative">
                                            <img 
                                                src={getImageUrl(plan.image_url)} 
                                                alt={plan.name} 
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-slate-700">{plan.name}</span>
                                            {plan.savings_text && (
                                                <span className="text-[10px] font-bold text-green-600">
                                                    {plan.savings_text}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-3 mt-0.5">
                                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{plan.meal_plan_code}</span>
                                            {plan.is_refundable ? (
                                                <span className="text-[10px] text-emerald-600 font-medium">
                                                    {plan.cancellation_policy || 'Free Cancellation'}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-rose-600 font-medium">Non-Refundable</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-5">
                                    <div className="text-right">
                                        {isRefreshing ? (
                                            <div className="space-y-1.5">
                                                <div className="h-6 w-20 bg-slate-100 animate-pulse rounded ml-auto" />
                                                <div className="h-3 w-14 bg-slate-100 animate-pulse rounded ml-auto" />
                                            </div>
                                        ) : offerActive && stayOffer ? (
                                            <>
                                                {/* Offer applied — show original (strikethrough) + discounted price.
                                                    Preview only; server recomputes the real total at booking. */}
                                                <div className="flex items-baseline justify-end gap-1">
                                                    <span className="text-lg font-black" style={{ color: themeColor }}>
                                                        {formatCurrency(previewDiscountedPrice(plan.total_price, stayOffer, nights))}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">total</span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 line-through">
                                                    {formatCurrency(plan.total_price)}
                                                </p>
                                                <p className="text-[10px] font-bold text-green-600">{stayOffer.reward_label}</p>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-baseline justify-end gap-1">
                                                    <span className="text-lg font-bold text-slate-900">
                                                        {formatCurrency(plan.total_price)}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">total</span>
                                                </div>
                                                {(plan.market_price || room.market_price) && (
                                                    <p className="text-[10px] text-slate-300 line-through">
                                                        {formatCurrency((plan.market_price || room.market_price || 0) * nights)}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <Button 
                                        className="text-white font-extrabold text-xs px-6 h-10 rounded-xl shadow-md transition-all active:scale-95"
                                        style={{ backgroundColor: themeColor }}
                                        onClick={() => handleSelectRate(room, plan)}
                                    >
                                        Select
                                    </Button>
                                </div>
                            </div>
                        ))}
                        </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface PackageCardProps {
    room: PublicRoomSearchResult;
    plan: RateOption;
    formatCurrency: (amount: number | undefined | null) => string;
    themeColor: string;
    handleSelectRate: (room: PublicRoomSearchResult, ratePlan: RateOption) => void;
    setSelectedRoom: (room: PublicRoomSearchResult) => void;
    setIsModalOpen: (val: boolean) => void;
    getImageUrl: (url?: string | null) => string;
}

export function PackageCard({
    room,
    plan,
    formatCurrency,
    themeColor,
    handleSelectRate,
    setSelectedRoom,
    setIsModalOpen,
    getImageUrl,
}: PackageCardProps) {
    return (
        <div 
            className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex flex-col md:flex-row mb-8 hover:shadow-xl transition-all duration-300 group border-l-4"
            style={{ borderLeftColor: themeColor }}
        >
            {/* Left: Premium Image Section */}
            <div className="md:w-[400px] h-72 md:h-auto bg-slate-100 relative overflow-hidden">
                {plan.image_url ? (
                    <img 
                        src={getImageUrl(plan.image_url)} 
                        alt={plan.name} 
                        className="w-full h-full min-h-[250px] object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                        onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }}
                    />
                ) : (
                    <RoomImageCarousel photos={room.photos} videos={(room as any).videos} roomName={room.name} onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }} />
                )}
                <div className="absolute top-4 left-4 z-10">
                    <div 
                        className="text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2"
                        style={{ backgroundColor: themeColor }}
                    >
                        <Sparkles className="w-3 h-3" /> Exclusive Offer
                    </div>
                </div>
            </div>

            {/* Right: Detailed Package Content */}
            <div className="flex-1 flex flex-col p-6 md:p-8">
                <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 transition-colors">
                            {plan.name}
                        </h3>
                        <p className="text-sm font-bold text-slate-500 flex items-center gap-2">
                            <Bed className="w-4 h-4" style={{ color: themeColor }} /> 
                            Available for {room.name} and more
                        </p>
                    </div>
                    <Badge 
                        variant="outline" 
                        className="px-3 py-1 rounded-lg font-bold"
                        style={{ borderColor: `${themeColor}4d`, color: themeColor, backgroundColor: `${themeColor}0d` }}
                    >
                        Limited Time
                    </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Gift className="w-3 h-3" /> Package Inclusions
                        </p>
                        <div className="grid grid-cols-1 gap-2.5">
                            {(plan.inclusions || []).map((inc, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm font-bold text-slate-600">
                                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-green-600" />
                                    </div>
                                    {inc}
                                </div>
                            ))}
                            {(!plan.inclusions || plan.inclusions.length === 0) && (
                                <div className="flex items-center gap-3 text-sm font-bold text-slate-500 italic">
                                    <Info className="w-4 h-4" /> Standard inclusions apply
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Why Book This?</p>
                        <ul className="space-y-2.5">
                            <li className="text-xs font-bold text-slate-600 flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full mt-1" style={{ backgroundColor: themeColor }} />
                                Best price guaranteed for this package
                            </li>
                            <li className="text-xs font-bold text-slate-600 flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full mt-1" style={{ backgroundColor: themeColor }} />
                                Flexible modification available
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="text-center sm:text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Starting From</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-slate-900 leading-none">
                                {formatCurrency(plan.total_price)}
                            </span>
                            <span className="text-sm font-bold text-slate-500">/ stay</span>
                        </div>
                        <p className="text-[10px] font-black text-green-600 uppercase mt-2 bg-green-50 px-2 py-0.5 rounded-md inline-block">
                            Includes all taxes & fees
                        </p>
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button 
                            variant="outline"
                            className="flex-1 sm:flex-none border-slate-200 font-bold hover:bg-slate-50 rounded-xl"
                            onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }}
                        >
                            View Details
                        </Button>
                        <Button
                            className="flex-1 sm:flex-none text-white font-black px-10 shadow-xl rounded-xl h-14 transition-all active:scale-95"
                            style={{ backgroundColor: themeColor }}
                            onClick={() => handleSelectRate(room, plan)}
                        >
                            BOOK NOW
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
