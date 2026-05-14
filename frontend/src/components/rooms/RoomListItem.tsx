import { MoreHorizontal, Users, Bed, Edit, Trash2, ArrowRight, Ruler, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoomType } from '@/types/api';
import { cn, getImageUrl } from '@/lib/utils';

interface RoomListItemProps {
    room: RoomType;
    onEdit: (room: RoomType) => void;
    onDelete: (id: string) => void;
    formatCurrency: (amount: number) => string;
}

export function RoomListItem({ room, onEdit, onDelete, formatCurrency }: RoomListItemProps) {
    const primaryPhoto = room.photos?.find(p => p.is_primary) ?? room.photos?.[0];

    return (
        <div className="flex items-center gap-6 p-5 group hover:bg-indigo-50/40 transition-all duration-300 relative border-b border-indigo-50 last:border-none">
            {/* Thumbnail */}
            <div className="h-16 w-24 rounded-2xl bg-indigo-100/30 flex items-center justify-center overflow-hidden shrink-0 border border-indigo-50/50 shadow-sm relative group-hover:scale-105 transition-transform duration-500">
                {primaryPhoto ? (
                    <img
                        src={getImageUrl(primaryPhoto.url)}
                        alt={room.name}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <Bed className="h-6 w-6 text-indigo-200" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                    <h3 className="text-base font-black text-indigo-950 tracking-tight group-hover:text-indigo-600 transition-colors truncate">
                        {room.name}
                    </h3>
                    <div className={cn(
                        "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] flex items-center gap-1.5",
                        room.is_active ? "bg-emerald-500/10 text-emerald-600 border border-emerald-200/50" : "bg-slate-100 text-slate-500"
                    )}>
                        {room.is_active && <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />}
                        {room.is_active ? 'Active' : 'Paused'}
                    </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-bold text-indigo-400">
                    <span className="truncate max-w-md">{room.description || 'No description available'}</span>
                    {room.room_size && (
                        <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-lg bg-indigo-50/50 border border-indigo-100/30">
                            <Ruler className="h-3 w-3" />
                            <span>{room.room_size} SF</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-8 text-xs tabular-nums shrink-0 mr-4">
                <div className="flex flex-col items-center gap-1" title="Occupancy">
                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm border border-indigo-50">
                        <Users className="h-3.5 w-3.5 text-indigo-500" />
                    </div>
                    <span className="text-[10px] font-black text-indigo-900/60 uppercase tracking-tighter">
                        {room.base_occupancy}-{room.max_occupancy} Pax
                    </span>
                </div>
                <div className="flex flex-col items-center gap-1" title="Inventory">
                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm border border-indigo-50">
                        <LayoutGrid className="h-3.5 w-3.5 text-indigo-500" />
                    </div>
                    <span className="text-[10px] font-black text-indigo-900/60 uppercase tracking-tighter">
                        {room.total_inventory} Units
                    </span>
                </div>
                <div className="flex flex-col items-end gap-1 w-24">
                    <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Base Rate</span>
                    <span className="text-lg font-black text-indigo-600 tracking-tighter">
                        {formatCurrency(room.base_price)}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 rounded-xl text-indigo-300 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-indigo-100 transition-all shadow-sm"
                    onClick={() => onEdit(room)}
                >
                    <Edit className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-indigo-300 hover:text-indigo-950">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl border-indigo-50 shadow-2xl p-2 min-w-[160px]">
                        <DropdownMenuItem onClick={() => onEdit(room)} className="rounded-xl focus:bg-indigo-50 cursor-pointer py-2.5 font-bold text-indigo-900">
                            <Edit className="mr-3 h-4 w-4 text-indigo-500" />
                            Modify Architecture
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="rounded-xl text-rose-500 focus:text-rose-600 focus:bg-rose-50 cursor-pointer py-2.5 font-bold"
                            onClick={() => onDelete(room.id)}
                        >
                            <Trash2 className="mr-3 h-4 w-4" />
                            Delete Instance
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button 
                    onClick={() => onEdit(room)}
                    className="h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 flex items-center justify-center p-0 group/btn"
                >
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                </Button>
            </div>
        </div>
    );
}
