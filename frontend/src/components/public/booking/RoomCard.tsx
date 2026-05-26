import { Bed, BedDouble, User, Maximize, Wifi, Check, Sparkles, Gift, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PublicRoomSearchResult, RateOption } from '@/types/api';
import { RoomImageCarousel } from './RoomImageCarousel';
import { ICONS } from '@/lib/amenityIcons';

interface RoomCardProps {
    room: PublicRoomSearchResult;
    formatCurrency: (amount: number | undefined | null) => string;
    themeColor: string;
    handleSelectRate: (room: PublicRoomSearchResult, ratePlan: RateOption) => void;
    setSelectedRoom: (room: PublicRoomSearchResult) => void;
    setIsModalOpen: (val: boolean) => void;
    getImageUrl: (url?: string | null) => string;
}

export function RoomCard({
    room,
    formatCurrency,
    themeColor,
    handleSelectRate,
    setSelectedRoom,
    setIsModalOpen,
    getImageUrl,
}: RoomCardProps) {
    const displayRates = room.rate_options || [];

    return (
        <div className="bg-white rounded-xl overflow-hidden mb-8 border border-slate-200 hover:border-indigo-100 transition-all duration-300 group">
            <div className="flex flex-col lg:flex-row">
                {/* Visual Section */}
                <div className="lg:w-[35%] h-64 lg:h-auto bg-slate-50 relative overflow-hidden">
                    <RoomImageCarousel photos={room.photos} roomName={room.name} onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }} />
                    <div className="absolute top-6 left-6 z-10">
                        <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm flex items-center gap-2 border border-white/50">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Available</span>
                        </div>
                    </div>
                </div>

                {/* Content Section: Minimalist & Clean */}
                <div className="flex-1 flex flex-col p-5 lg:p-6">
                    {/* Header Area */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-4">
                        <div className="space-y-0.5">
                            <h3 className="text-lg font-bold text-slate-800 tracking-tight leading-snug group-hover:text-indigo-600 transition-colors duration-200">
                                {room.name}
                            </h3>
                            <div className="flex items-center gap-3 text-slate-500 text-[11px] font-medium">
                                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {room.max_occupancy} Adults</span>
                                <span className="text-slate-300">•</span>
                                <span className="flex items-center gap-1"><Maximize className="w-3 h-3" /> {room.room_size || '---'} ft²</span>
                            </div>
                        </div>
                        <button 
                            className="text-indigo-600 font-semibold text-xs hover:underline transition-all"
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
                                        <div className="flex items-baseline justify-end gap-1">
                                            <span className="text-lg font-bold text-slate-900">
                                                {formatCurrency(plan.total_price)}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium">total</span>
                                        </div>
                                        {(plan.market_price || room.market_price) && (
                                            <p className="text-[10px] text-slate-300 line-through">
                                                {formatCurrency(plan.market_price || room.market_price || 0)}
                                            </p>
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
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex flex-col md:flex-row mb-8 hover:shadow-xl transition-all duration-300 group border-l-4 border-l-amber-500">
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
                    <RoomImageCarousel photos={room.photos} roomName={room.name} onClick={() => { setSelectedRoom(room); setIsModalOpen(true); }} />
                )}
                <div className="absolute top-4 left-4 z-10">
                    <div className="bg-amber-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> Exclusive Offer
                    </div>
                </div>
            </div>

            {/* Right: Detailed Package Content */}
            <div className="flex-1 flex flex-col p-6 md:p-8">
                <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 group-hover:text-amber-600 transition-colors">
                            {plan.name}
                        </h3>
                        <p className="text-sm font-bold text-slate-500 flex items-center gap-2">
                            <Bed className="w-4 h-4 text-amber-500" /> 
                            Available for {room.name} and more
                        </p>
                    </div>
                    <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 px-3 py-1 rounded-lg font-bold">
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
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1" />
                                Best price guaranteed for this package
                            </li>
                            <li className="text-xs font-bold text-slate-600 flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1" />
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
