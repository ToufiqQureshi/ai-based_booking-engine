import { MoreHorizontal, Users, Bed, Edit, Trash2, BedDouble, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, getImageUrl } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
    // Logic to find primary photo or fallback to first
    const primaryPhoto = room.photos?.find(p => p.is_primary) ?? room.photos?.[0];

    return (
        <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-none ring-1 ring-border/50">
            <div className="aspect-video relative overflow-hidden bg-muted flex items-center justify-center">
                {primaryPhoto ? (
                    <img
                        src={getImageUrl(primaryPhoto.url)}
                        alt={room.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground/50">
                        <Bed className="h-12 w-12 mb-2" />
                        <span className="text-xs font-medium">No Image</span>
                    </div>
                )}
                <div className="absolute top-2 right-2 flex gap-2">
                    {room.is_active ? (
                        <Badge className="bg-emerald-500/90 hover:bg-emerald-500 backdrop-blur-sm shadow-sm">Active</Badge>
                    ) : (
                        <Badge variant="secondary" className="backdrop-blur-sm shadow-sm bg-background/80">Inactive</Badge>
                    )}
                </div>
            </div>
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold tracking-tight">{room.name}</CardTitle>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(room)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDelete(room.id)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Room
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <CardDescription className="line-clamp-2 min-h-[2.5em]">{room.description || 'No description available for this room type.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Room Specs Grid */}
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs text-muted-foreground pt-2">
                    <div className="flex items-center gap-2" title="Occupancy">
                        <Users className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{room.base_occupancy}-{room.max_occupancy} Adults</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Bed className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Max {room.max_occupancy} Guests</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <BedDouble className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{room.bed_type || 'Double'} Bed</span>
                    </div>
                    {room.room_size && (
                        <div className="flex items-center gap-2">
                            <Ruler className="h-3.5 w-3.5 text-indigo-500" />
                            <span>{room.room_size} sq ft</span>
                        </div>
                    )}
                </div>

                <Separator className="opacity-50" />

                {/* Price Section */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Base Price</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-indigo-600">{formatCurrency(room.base_price)}</span>
                            <span className="text-[10px] text-muted-foreground">/night</span>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600" onClick={() => onEdit(room)}>
                        Edit
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
