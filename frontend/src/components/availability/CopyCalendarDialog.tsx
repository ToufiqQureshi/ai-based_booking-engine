import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Copy, Sparkles } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';

const copyCalendarSchema = z.object({
    room_type_id: z.string().min(1, 'Room type is required'),
    source_start_date: z.string().min(1, 'Source start date is required'),
    source_end_date: z.string().min(1, 'Source end date is required'),
    target_start_date: z.string().min(1, 'Target start date is required'),
    target_end_date: z.string().min(1, 'Target end date is required'),
    copy_price: z.boolean().default(true),
    copy_availability: z.boolean().default(true),
}).refine(data => data.copy_price || data.copy_availability, {
    message: 'Please select at least one option to copy (Rates or Availability)',
    path: ['copy_price'],
});

interface CopyCalendarDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roomTypes: Array<{ id: string; name: string; totalInventory: number }>;
    onSuccess: () => void;
}

export function CopyCalendarDialog({ open, onOpenChange, roomTypes, onSuccess }: CopyCalendarDialogProps) {
    const { toast } = useToast();

    const form = useForm<z.infer<typeof copyCalendarSchema>>({
        resolver: zodResolver(copyCalendarSchema),
        defaultValues: {
            room_type_id: '',
            source_start_date: '',
            source_end_date: '',
            target_start_date: '',
            target_end_date: '',
            copy_price: true,
            copy_availability: true,
        },
    });

    const onSubmit = async (values: z.infer<typeof copyCalendarSchema>) => {
        try {
            await apiClient.post('/availability/copy', values);
            toast({
                title: 'Calendar Copied Successfully',
                description: 'Pricing and/or availability records have been duplicated to your target dates.',
            });
            form.reset();
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to copy calendar overrides. Ensure date ranges are valid.',
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] border-none shadow-2xl rounded-2xl bg-background p-6">
                <DialogHeader className="space-y-1">
                    <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Copy className="w-5 h-5 text-indigo-600" />
                        Copy Rates & Availability
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Duplicate calendar overrides day-by-day from a source date range to a target date range.
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

                        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                            <div className="col-span-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span> Source Date Range
                            </div>
                            <FormField
                                control={form.control}
                                name="source_start_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Start Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" className="h-11 rounded-xl border-border bg-background" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="source_end_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">End Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" className="h-11 rounded-xl border-border bg-background" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                            <div className="col-span-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span> Target Date Range
                            </div>
                            <FormField
                                control={form.control}
                                name="target_start_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Start Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" className="h-11 rounded-xl border-border bg-background" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="target_end_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">End Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" className="h-11 rounded-xl border-border bg-background" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100/60 dark:bg-indigo-950/20 dark:border-indigo-900/30 flex flex-col gap-3">
                            <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                Choose what details to copy
                            </div>
                            
                            <div className="flex gap-6">
                                <FormField
                                    control={form.control}
                                    name="copy_price"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-2 space-y-0 cursor-pointer">
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-md" />
                                            </FormControl>
                                            <FormLabel className="font-bold text-xs text-foreground cursor-pointer">Rates / Pricing</FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="copy_availability"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-2 space-y-0 cursor-pointer">
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-md" />
                                            </FormControl>
                                            <FormLabel className="font-bold text-xs text-foreground cursor-pointer">Availability / Blocks</FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 px-6">
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Copy Settings
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
