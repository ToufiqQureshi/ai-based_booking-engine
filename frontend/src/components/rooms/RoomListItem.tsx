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
        <div className="flex items-center gap-6 p-4 group hover:bg-muted/50 transition-colors border-b border-border last:border-none">
            {/* Thumbnail */}
            <div className="h-14 w-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border">
                {primaryPhoto ? (
                    <img
                        src={getImageUrl(primaryPhoto.url)}
                        alt={room.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                ) : (
                    <Bed className="h-5 w-5 text-muted-foreground" />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-foreground truncate">
                        {room.name}
                    </h3>
                    <Badge variant={room.is_active ? "default" : "secondary"} className={cn(
                        "text-[9px] font-bold px-2 py-0 border-none",
                        room.is_active ? "bg-green-500 hover:bg-green-500" : "bg-slate-200 text-muted-foreground"
                    )}>
                        {room.is_active ? 'Active' : 'Paused'}
                    </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                    <span className="truncate max-w-md">{room.description || 'No description available'}</span>
                    {room.room_size && (
                        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
                            <Ruler className="h-3 w-3" />
                            <span>{room.room_size} SF</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-8 text-xs tabular-nums shrink-0 mr-4">
                <div className="flex flex-col items-center gap-0.5" title="Occupancy">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-foreground uppercase">
                        {room.base_occupancy}-{room.max_occupancy} Pax
                    </span>
                </div>
                <div className="flex flex-col items-center gap-0.5" title="Inventory">
                    <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-foreground uppercase">
                        {room.total_inventory} Units
                    </span>
                </div>
                <div className="flex flex-col items-end gap-0.5 w-24">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Base Rate</span>
                    <span className="text-lg font-bold text-blue-600">
                        {formatCurrency(room.base_price)}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    onClick={() => onEdit(room)}
                >
                    <Edit className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-lg p-1 min-w-[140px]">
                        <DropdownMenuItem onClick={() => onEdit(room)} className="rounded-md cursor-pointer text-sm font-medium">
                            <Edit className="mr-2 h-4 w-4 text-muted-foreground" />
                            Edit Room
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="rounded-md text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer text-sm font-medium"
                            onClick={() => onDelete(room.id)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
