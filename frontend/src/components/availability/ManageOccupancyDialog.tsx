import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Loader2, Lock, Unlock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';

interface ManageOccupancyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roomType: { id: string; name: string } | null;
    date: Date | null;
    currentPrice?: number;
    onSuccess: () => void;
}

interface Block {
    id: string;
    start_date: string;
    end_date: string;
    blocked_count: number;
    reason?: string;
}

export function ManageOccupancyDialog({ open, onOpenChange, roomType, date, onSuccess, ...props }: ManageOccupancyDialogProps) {
    const { toast } = useToast();
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newBlockCount, setNewBlockCount] = useState(1);
    const [newBlockReason, setNewBlockReason] = useState('Maintenance');
    const [newPrice, setNewPrice] = useState<number | ''>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open && roomType && date) {
            fetchBlocks();
            if (open) setNewPrice(''); // Reset price input
        }
    }, [open, roomType, date]);

    const fetchBlocks = async () => {
        if (!roomType || !date) return;
        setIsLoading(true);
        try {
            // Fetch blocks that cover this date
            const dateStr = format(date, 'yyyy-MM-dd');
            const data = await apiClient.get<Block[]>('/availability/blocks', {
                room_type_id: roomType.id,
                start_date: dateStr,
                end_date: dateStr
            });
            setBlocks(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDeleteBlock = async (blockId: string) => {
        try {
            setDeletingId(blockId);
            await apiClient.delete(`/availability/blocks/${blockId}`);
            toast({ title: "Available", description: "Room is now available for booking." });
            setBlocks(prev => prev.filter(b => b.id !== blockId)); // Optimistic update
            onSuccess(); // Refresh parent grid
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "Failed to update status." });
        } finally {
            setDeletingId(null);
        }
    };

    const handleCreateBlock = async () => {
        if (!roomType || !date) return;
        setIsSubmitting(true);
        try {
            const dateStr = format(date, 'yyyy-MM-dd');
            await apiClient.post('/availability/blocks', {
                room_type_id: roomType.id,
                start_date: dateStr,
                end_date: dateStr,
                blocked_count: newBlockCount,
                reason: newBlockReason
            });
            toast({ title: "Sold Out", description: "Room marked as sold out." });
            setNewBlockReason('Maintenance'); // Reset
            fetchBlocks();
            onSuccess();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to block room." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdatePrice = async () => {
        if (!roomType || !date || newPrice === '' || typeof newPrice !== 'number') return;
        setIsSubmitting(true);
        try {
            const dateStr = format(date, 'yyyy-MM-dd');
            await apiClient.post('/availability/rates', {
                room_type_id: roomType.id,
                start_date: dateStr,
                end_date: dateStr,
                price: newPrice
            });
            toast({ title: "Price Updated", description: "Daily rate has been set." });
            setNewPrice('');
            onSuccess();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update price." });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!roomType || !date) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Manage Inventory</DialogTitle>
                    <DialogDescription>
                        {format(date, 'EEEE, MMMM d, yyyy')} - <span className="font-semibold text-foreground">{roomType.name}</span>
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : (
                    <div className="space-y-4">
                        {/* Summary Status */}
                        <div className="p-4 bg-muted/30 rounded-lg text-center border border-border/50">
                            <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Current Status</span>
                            <div className="mt-1 flex items-center justify-center gap-2">
                                <h3 className="text-3xl font-bold tracking-tight text-foreground">
                                    {blocks.reduce((acc, b) => acc + b.blocked_count, 0)}
                                </h3>
                                <span className="text-sm text-muted-foreground mt-2">Rooms Sold Out (Manually)</span>
                            </div>
                        </div>



                        {/* Price Controls */}
                        <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100 space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="text-blue-900 font-semibold">Daily Price (Base)</Label>
                                {props.currentPrice && (
                                    <span className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-1 rounded">
                                        Current: ₹{props.currentPrice}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                                    <Input
                                        type="number"
                                        placeholder="Set new price..."
                                        className="pl-7 bg-background"
                                        value={newPrice}
                                        onChange={(e) => setNewPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    />
                                </div>
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={handleUpdatePrice}
                                    disabled={isSubmitting || newPrice === ''}
                                >
                                    Update
                                </Button>
                            </div>
                        </div>

                        {/* Quick Controls */}
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                variant="outline"
                                className="h-14 flex flex-col gap-1 hover:bg-green-50 hover:text-green-600 hover:border-green-200"
                                onClick={() => {
                                    // Find the last block and remove it (LIFOish for quick action)
                                    const lastBlock = blocks[0];
                                    if (lastBlock) handleDeleteBlock(lastBlock.id);
                                }}
                                disabled={blocks.length === 0 || !!deletingId}
                            >
                                <span className="font-bold text-lg">Make Available</span>
                                <span className="text-[10px] font-normal opacity-80">(-1 Sold Out)</span>
                            </Button>

                            <Button
                                variant="outline"
                                className="h-14 flex flex-col gap-1 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                onClick={handleCreateBlock}
                                disabled={isSubmitting}
                            >
                                <span className="font-bold text-lg">Mark Sold Out</span>
                                <span className="text-[10px] font-normal opacity-80">(+1 Sold Out)</span>
                            </Button>
                        </div>

                        {/* Detailed List Toggle */}
                        {blocks.length > 0 && (
                            <div className="pt-2">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-muted-foreground">Detailed Breakdown</span>
                                    {blocks.length > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 text-[10px] text-destructive hover:bg-red-100"
                                            onClick={async () => {
                                                setIsLoading(true);
                                                try {
                                                    await Promise.all(blocks.map(b => apiClient.delete(`/availability/blocks/${b.id}`)));
                                                    toast({ title: "All Cleared", description: "All rooms are now available." });
                                                    setBlocks([]);
                                                    onSuccess();
                                                } catch (e) {
                                                    toast({ variant: "destructive", title: "Error", description: "Failed to clear all." });
                                                } finally {
                                                    setIsLoading(false);
                                                }
                                            }}
                                        >
                                            Clear All
                                        </Button>
                                    )}
                                </div>
                                <div className="max-h-[150px] overflow-y-auto space-y-2 pr-1">
                                    {blocks.map(block => (
                                        <div key={block.id} className="flex items-center justify-between p-2 rounded border bg-card text-xs">
                                            <span>{block.blocked_count} Room ({block.reason || 'Manual'})</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDeleteBlock(block.id)}
                                                disabled={deletingId === block.id}
                                            >
                                                &times;
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog >
    );
}
