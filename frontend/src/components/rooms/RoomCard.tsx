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
    const primaryPhoto = room.photos?.find(p => p.is_primary) || room.photos?.[0] || null;

    return (
        <Card className="overflow-hidden group hover:shadow-md transition-all duration-200 border border-border bg-card rounded-xl relative flex flex-col">
            {/* Image Section */}
            <div className="aspect-[16/10] relative overflow-hidden bg-muted">
                {primaryPhoto ? (
                    <img
                        src={getImageUrl(primaryPhoto.url)}
                        alt={room.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Bed className="h-10 w-10 mb-2 opacity-20" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">No Image</span>
                    </div>
                )}
                
                {/* Status Badges */}
                <div className="absolute top-3 left-3 flex gap-2">
                    {room.is_active ? (
                        <Badge className="bg-green-500 hover:bg-green-600 text-white border-none text-[10px] font-bold px-2 py-0.5">
                            Active
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5">
                            Paused
                        </Badge>
                    )}
                </div>

                {/* Actions Dropdown */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-lg bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm">
                                <MoreHorizontal className="h-4 w-4 text-slate-600" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-lg p-1 min-w-[140px]">
                            <DropdownMenuItem onClick={() => onEdit(room)} className="rounded-md cursor-pointer text-sm font-medium">
                                <Edit className="mr-2 h-4 w-4 text-slate-400" />
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

            {/* Content Section */}
            <CardHeader className="p-4 pb-2 flex-none">
                <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-foreground leading-tight">
                        {room.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-muted-foreground text-xs font-medium leading-relaxed min-h-[32px]">
                        {room.description || 'No description provided for this room category.'}
                    </CardDescription>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-3 flex flex-col flex-1">
                {/* Stats Row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{room.base_occupancy}-{room.max_occupancy} Pax</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-border" />
                    <div className="flex items-center gap-1.5">
                        <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{room.bed_type || 'Double'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    {room.room_size && (
                        <div className="flex items-center gap-1.5">
                            <Ruler className="h-3 w-3" />
                            <span>{room.room_size} SQ FT</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                        <span>Inventory: {room.total_inventory}</span>
                    </div>
                </div>

                {/* Price Footer - mt-auto pushes it to bottom */}
                <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Price / Night</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-bold text-blue-600">
                                {formatCurrency(room.base_price)}
                            </span>
                            {room.market_price && room.market_price > room.base_price && (
                                <span className="text-xs font-medium text-slate-300 line-through">
                                    {formatCurrency(room.market_price)}
                                </span>
                            )}
                        </div>
                    </div>
                    <Button 
                        size="sm"
                        onClick={() => onEdit(room)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 px-4"
                    >
                        Edit
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
