import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/core/hooks/use-toast';
import { apiClient } from '@/core/api/client';

const editBookingSchema = z.object({
    check_in: z.string().min(1, 'Check-in date is required'),
    check_out: z.string().min(1, 'Check-out date is required'),
    status: z.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']),
    special_requests: z.string().optional(),
});

interface EditBookingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    booking: any;
    onSuccess: () => void;
}

export function EditBookingDialog({ open, onOpenChange, booking, onSuccess }: EditBookingDialogProps) {
    const { toast } = useToast();

    const form = useForm<z.infer<typeof editBookingSchema>>({
        resolver: zodResolver(editBookingSchema),
        defaultValues: {
            check_in: '',
            check_out: '',
            status: 'pending',
            special_requests: '',
        },
    });

    useEffect(() => {
        if (booking) {
            form.reset({
                check_in: booking.check_in,
                check_out: booking.check_out,
                status: booking.status,
                special_requests: booking.special_requests || '',
            });
        }
    }, [booking, form]);

    const onSubmit = async (values: z.infer<typeof editBookingSchema>) => {
        try {
            await apiClient.patch(`/bookings/${booking.id}`, values);
            toast({
                title: 'Booking Updated',
                description: 'Changes have been saved successfully.',
            });
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to update booking.',
            });
        }
    };

    if (!booking) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Booking</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="check_in"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Check In</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="check_out"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Check Out</FormLabel>
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
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="confirmed">Confirmed</SelectItem>
                                            <SelectItem value="checked_in">Checked In</SelectItem>
                                            <SelectItem value="checked_out">Checked Out</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="special_requests"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Special Requests</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Any special requests from the guest..." {...field} />
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
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
