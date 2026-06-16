
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious
} from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PublicRoomSearchResult, RateOption } from "@/core/types/api";
import { Wifi, User, Maximize, Check, Info, Tv, Coffee, Snowflake, Waves, Dumbbell, Car, Utensils, Star, LucideIcon, ShieldCheck, Sparkles, BedDouble, Wine, Bath, ShowerHead, Flame, Baby, Languages, ConciergeBell, WashingMachine, Key, Wind, CigaretteOff, PawPrint, VolumeX, Briefcase, Map } from "lucide-react";

// Icon mapping for amenities
const AMENITY_ICONS: Record<string, LucideIcon> = {
    wifi: Wifi,
    tv: Tv,
    coffee: Coffee,
    snowflake: Snowflake,
    waves: Waves,
    dumbbell: Dumbbell,
    car: Car,
    utensils: Utensils,
    star: Star,
    shield: ShieldCheck,
    sparkle: Sparkles,
    wine: Wine,
    bath: Bath,
    shower: ShowerHead,
    bed: BedDouble,
    flame: Flame,
    baby: Baby,
    globe: Languages,
    bell: ConciergeBell,
    laundry: WashingMachine,
    key: Key,
    wind: Wind,
    no_smoking: CigaretteOff,
    pet: PawPrint,
    volume_mute: VolumeX,
    expand: Maximize,
    briefcase: Briefcase,
    map: Map,
};

// Meal plan display names
const MEAL_PLAN_NAMES: Record<string, string> = {
    'EP': 'Room Only',
    'CP': 'Continental Plan (Breakfast)',
    'MAP': 'Modified American Plan',
    'AP': 'American Plan (All Meals)',
};

interface RoomDetailModalProps {
    room: PublicRoomSearchResult | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onBook: (room: PublicRoomSearchResult, ratePlan: RateOption) => void;
    guests: string;
    themeColor?: string;
}

export function RoomDetailModal({ room, open, onOpenChange, onBook, guests, themeColor }: RoomDetailModalProps) {
    if (!room) return null;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden flex flex-col gap-0 border-0 rounded-2xl shadow-2xl">

                {/* Header Image Carousel */}
                <div className="relative h-[300px] bg-slate-100 flex-shrink-0">
                    <Carousel className="w-full h-full">
                        <CarouselContent>
                            {room.photos && room.photos.length > 0 ? (
                                room.photos.map((photo, index) => (
                                    <CarouselItem key={index} className="h-[300px]">
                                        <img
                                            src={photo.url}
                                            alt={photo.caption || room.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </CarouselItem>
                                ))
                            ) : (
                                <CarouselItem className="h-[300px] flex items-center justify-center bg-slate-200 text-slate-400">
                                    No Images Available
                                </CarouselItem>
                            )}
                        </CarouselContent>
                        {room.photos && room.photos.length > 1 && (
                            <>
                                <CarouselPrevious className="left-4 bg-white/90 hover:bg-white border-0 z-50 shadow-md text-slate-800" />
                                <CarouselNext className="right-4 bg-white/90 hover:bg-white border-0 z-50 shadow-md text-slate-800" />
                            </>
                        )}
                    </Carousel>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20">
                        <h2 className="text-3xl font-bold text-white mb-2">{room.name}</h2>
                        <div className="flex gap-4 text-white/90 text-sm">
                            <div className="flex items-center bg-black/30 backdrop-blur px-3 py-1 rounded-full">
                                <User className="w-4 h-4 mr-2" /> Max {room.max_occupancy} Guests
                            </div>
                            <div className="flex items-center bg-black/30 backdrop-blur px-3 py-1 rounded-full">
                                <Maximize className="w-4 h-4 mr-2" /> Spacious Room
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-0 relative">
                    <ScrollArea className="h-full">
                        <div className="p-6 md:p-8 grid md:grid-cols-[1.5fr,1fr] gap-8">

                            {/* Left Column: Details */}
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center">
                                        <Info className="w-5 h-5 mr-2" style={{ color: themeColor || 'var(--primary)' }} /> About this Room
                                    </h3>
                                    <p className="text-slate-600 leading-relaxed text-sm md:text-base">
                                        {room.description || "Experience comfort and luxury in our well-appointed rooms, designed to meet all your needs."}
                                    </p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-4">Amenities</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {room.amenities.map((am: any, i) => {
                                            const IconComponent = AMENITY_ICONS[am.icon_slug || am.icon] || Wifi;
                                            return (
                                                <div key={i} className="flex items-center text-sm text-slate-600">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-3 shrink-0" style={{ color: themeColor || 'var(--primary)' }}>
                                                        <IconComponent className="w-4 h-4" />
                                                    </div>
                                                    {am.name}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Rate Plans */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-slate-900 sticky top-0 bg-white z-10 py-2 border-b">
                                    Available Rates
                                </h3>
                                <div className="space-y-4">
                                    {(room.rate_options || []).map((plan) => (
                                        <div
                                            key={plan.id}
                                            className="border rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all bg-white group"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-slate-900">
                                                            {MEAL_PLAN_NAMES[plan.name.toUpperCase()] || plan.name}
                                                        </h4>
                                                        {plan.is_package && (
                                                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] py-0 px-2 h-5 font-black uppercase">
                                                                Package
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {plan.savings_text && (
                                                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-1 inline-block">
                                                            {plan.savings_text}
                                                        </span>
                                                    )}
                                            </div>

                                            <ul className="space-y-1 mb-4">
                                                {plan.inclusions.map((inc, i) => (
                                                    <li key={i} className="text-xs text-slate-500 flex items-center">
                                                        <Check className="w-3 h-3 text-green-500 mr-2" /> {inc}
                                                    </li>
                                                ))}
                                            </ul>

                                            <div className="pt-3 border-t border-dashed flex items-center justify-between">
                                                <div className="text-right">
                                                    <div className="flex flex-col items-start">
                                                        <span className="text-xl font-bold text-slate-900">
                                                            {formatCurrency(plan.total_price)}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            Total for {guests} Guest{parseInt(guests) !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button size="sm" onClick={() => onBook(room, plan)} style={themeColor ? { backgroundColor: themeColor } : {}}>
                                                    Select
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </ScrollArea>
                </div>

            </DialogContent>
        </Dialog>
    );
}
