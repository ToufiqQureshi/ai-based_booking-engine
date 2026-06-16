import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/core/hooks/use-toast';
import { apiClient } from '@/core/api/client';

const bulkUpdateSchema = z.object({
    room_type_id: z.string().min(1, 'Room type is required'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().min(1, 'End date is required'),
    blocked_count: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1, 'At least 1 room must be blocked')),
    reason: z.string().optional(),
});

interface BulkUpdateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roomTypes: Array<{ id: string; name: string; totalInventory: number }>;
    onSuccess: () => void;
}

export function BulkUpdateDialog({ open, onOpenChange, roomTypes, onSuccess }: BulkUpdateDialogProps) {
    const { toast } = useToast();

    const form = useForm<z.infer<typeof bulkUpdateSchema>>({
        resolver: zodResolver(bulkUpdateSchema),
        defaultValues: {
            room_type_id: '',
            start_date: '',
            end_date: '',
            blocked_count: 1, // Default as number, but input will be string
            reason: 'Maintenance',
        },
    });

    const onSubmit = async (values: z.infer<typeof bulkUpdateSchema>) => {
        try {
            await apiClient.post('/availability/blocks', values);
            toast({
                title: 'Rooms Blocked',
                description: 'Availability has been updated successfully.',
            });
            form.reset();
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to update availability.',
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Bulk Update Availability</DialogTitle>
                    <DialogDescription>
                        Block rooms for maintenance or other reasons. This will reduce the available inventory.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        <FormField
                            control={form.control}
                            name="room_type_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Room Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select room type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {roomTypes.map((room) => (
                                                <SelectItem key={room.id} value={room.id}>
                                                    {room.name} (Max: {room.totalInventory})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="start_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Start Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="end_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>End Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="blocked_count"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rooms to Block</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={1} {...field} value={field.value?.toString()} />
                                    </FormControl>
                                    <FormDescription>
                                        Number of rooms to remove from inventory.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason (Internal)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Maintenance, Renovation" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Block Rooms
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
