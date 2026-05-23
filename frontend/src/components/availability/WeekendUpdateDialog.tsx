import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { Switch } from '@/components/ui/switch';

const weekendUpdateSchema = z.object({
    room_type_id: z.string().min(1, 'Room type is required'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().min(1, 'End date is required'),
    price: z.string().optional().transform(val => val && val.trim() !== '' ? parseFloat(val) : undefined),
    blocked_count: z.string().optional().transform(val => val && val.trim() !== '' ? parseInt(val, 10) : undefined),
    reset_to_default: z.boolean().optional(),
}).refine(data => data.reset_to_default || data.price !== undefined || data.blocked_count !== undefined, {
    message: 'Either Weekend Price, Rooms to Block, or Reset to Defaults must be specified',
    path: ['price'],
});

interface WeekendUpdateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roomTypes: Array<{ id: string; name: string; totalInventory: number }>;
    onSuccess: () => void;
}

export function WeekendUpdateDialog({ open, onOpenChange, roomTypes, onSuccess }: WeekendUpdateDialogProps) {
    const { toast } = useToast();

    const form = useForm<z.infer<typeof weekendUpdateSchema>>({
        resolver: zodResolver(weekendUpdateSchema),
        defaultValues: {
            room_type_id: '',
            start_date: '',
            end_date: '',
            price: undefined,
            blocked_count: undefined,
            reset_to_default: false,
        },
    });

    const onSubmit = async (values: z.infer<typeof weekendUpdateSchema>) => {
        try {
            await apiClient.post('/availability/weekend-update', values);
            toast({
                title: values.reset_to_default ? 'Weekend Settings Reset' : 'Weekend Settings Applied',
                description: values.reset_to_default 
                    ? 'Weekend overrides have been successfully reset to base default settings.'
                    : 'Weekend rates and inventory blocks have been updated successfully.',
            });
            form.reset();
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to update weekend availability settings.',
            });
        }
    };

    const isResetSelected = form.watch('reset_to_default');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] border-none shadow-2xl rounded-2xl bg-background p-6">
                <DialogHeader className="space-y-1">
                    <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-indigo-600" />
                        Weekend Special Update
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Specifically modify rates or inventory blocks for Saturdays and Sundays only within the selected date range.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                        <FormField
                            control={form.control}
                            name="room_type_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Room Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-11 rounded-xl border-border">
                                                <SelectValue placeholder="Select room type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl">
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
                                          <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Start Date</FormLabel>
                                          <FormControl>
                                              <Input type="date" className="h-11 rounded-xl border-border" {...field} />
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
                                          <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">End Date</FormLabel>
                                          <FormControl>
                                              <Input type="date" className="h-11 rounded-xl border-border" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                      </FormItem>
                                  )}
                              />
                        </div>

                         <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100/60 dark:bg-indigo-950/20 dark:border-indigo-900/30 space-y-4">
                            <div className="flex items-center gap-1.5 text-xs text-indigo-800 dark:text-indigo-300 font-semibold mb-1">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                Adjust Weekend Values (Sat/Sun)
                            </div>

                            <FormField
                                control={form.control}
                                name="reset_to_default"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-xl border border-indigo-100/40 dark:border-indigo-900/20 p-3 bg-indigo-50/20">
                                        <div className="space-y-0.5 pr-2">
                                            <FormLabel className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Reset to Defaults</FormLabel>
                                            <FormDescription className="text-[10px] text-indigo-700/80 dark:text-indigo-400/80 leading-normal">
                                                Wipe custom overrides and restore base room price & full availability.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className="data-[state=checked]:bg-indigo-600 scale-95"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem className={isResetSelected ? "opacity-50" : ""}>
                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Weekend Price (₹)</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                                                <Input
                                                    type="number"
                                                    placeholder="Keep unchanged"
                                                    disabled={isResetSelected}
                                                    className="h-11 rounded-xl border-border pl-7 bg-background"
                                                    value={field.value === undefined ? '' : field.value}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="blocked_count"
                                render={({ field }) => (
                                    <FormItem className={isResetSelected ? "opacity-50" : ""}>
                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rooms to Block (Sat/Sun)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                placeholder="Keep unchanged"
                                                disabled={isResetSelected}
                                                className="h-11 rounded-xl border-border bg-background"
                                                value={field.value === undefined ? '' : field.value}
                                                onChange={(e) => field.onChange(e.target.value)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 px-6">
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Apply Weekend updates
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
