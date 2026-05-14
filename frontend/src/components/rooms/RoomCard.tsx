import { MoreHorizontal, Users, Bed, Edit, Trash2, BedDouble, Ruler, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, getImageUrl } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoomType } from '@/types/api';

interface RoomCardProps {
    room: RoomType;
    onEdit: (room: RoomType) => void;
    onDelete: (id: string) => void;
    formatCurrency: (amount: number) => string;
}

export function RoomCard({ room, onEdit, onDelete, formatCurrency }: RoomCardProps) {
    const primaryPhoto = room.photos?.find(p => p.is_primary) ?? room.photos?.[0];

    return (
        <Card className="overflow-hidden group hover:shadow-[0_20px_50px_rgba(79,70,229,0.15)] transition-all duration-500 border-none bg-white/70 backdrop-blur-xl rounded-[32px] ring-1 ring-indigo-50/50 hover:ring-indigo-100/50 relative">
            {/* Image Section */}
            <div className="aspect-[16/10] relative overflow-hidden bg-indigo-50/30">
                {primaryPhoto ? (
                    <img
                        src={getImageUrl(primaryPhoto.url)}
                        alt={room.name}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-indigo-200">
                        <Bed className="h-16 w-16 mb-2 opacity-20" />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">No Visual Assets</span>
                    </div>
                )}
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Status Badges */}
                <div className="absolute top-4 left-4 flex gap-2">
                    {room.is_active ? (
                        <div className="flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg">
                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            Active
                        </div>
                    ) : (
                        <div className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
                            Paused
                        </div>
                    )}
                </div>

                {/* Actions Dropdown Overlay */}
                <div className="absolute top-4 right-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/40 hover:scale-110 transition-all">
                                <MoreHorizontal className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl border-indigo-50 shadow-2xl p-2 min-w-[160px]">
                            <DropdownMenuItem onClick={() => onEdit(room)} className="rounded-xl focus:bg-indigo-50 cursor-pointer py-2.5 font-bold text-indigo-900">
                                <Edit className="mr-3 h-4 w-4 text-indigo-500" />
                                Edit Experience
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="rounded-xl text-rose-500 focus:text-rose-600 focus:bg-rose-50 cursor-pointer py-2.5 font-bold"
                                onClick={() => onDelete(room.id)}
                            >
                                <Trash2 className="mr-3 h-4 w-4" />
                                Delete Concept
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Content Section */}
            <CardHeader className="p-6 pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-black tracking-tight text-indigo-950 group-hover:text-indigo-600 transition-colors">
                        {room.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-indigo-400 text-xs font-medium leading-relaxed">
                        {room.description || 'Define a unique narrative for this room category to captivate guests.'}
                    </CardDescription>
                </div>
            </CardHeader>

            <CardContent className="p-6 pt-2 space-y-6">
                {/* Features Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-indigo-50/30 border border-indigo-100/20">
                        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                            <Users className="h-4 w-4 text-indigo-500" />
                        </div>
                        <span className="text-[11px] font-bold text-indigo-900/70">{room.base_occupancy}-{room.max_occupancy} Pax</span>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-violet-50/30 border border-violet-100/20">
                        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                            <BedDouble className="h-4 w-4 text-violet-500" />
                        </div>
                        <span className="text-[11px] font-bold text-violet-900/70">{room.bed_type || 'Master'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-indigo-300 px-1">
                    {room.room_size && (
                        <div className="flex items-center gap-2">
                            <Ruler className="h-3 w-3" />
                            <span>{room.room_size} SQ FT</span>
                        </div>
                    )}
                    <div className="w-1 h-1 rounded-full bg-indigo-200" />
                    <span>Inventory: {room.total_inventory}</span>
                </div>

                {/* Price Footer */}
                <div className="pt-4 border-t border-indigo-100/30 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-black text-indigo-300 tracking-[0.2em] mb-1">Nightly Yield</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-indigo-600 tracking-tighter">
                                {formatCurrency(room.base_price)}
                            </span>
                            {room.market_price && room.market_price > room.base_price && (
                                <span className="text-xs font-bold text-indigo-300 line-through">
                                    {formatCurrency(room.market_price)}
                                </span>
                            )}
                        </div>
                    </div>
                    <Button 
                        onClick={() => onEdit(room)}
                        className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_10px_20px_rgba(79,70,229,0.2)] font-bold px-6 h-11 flex gap-2 group/btn"
                    >
                        Edit
                        <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
