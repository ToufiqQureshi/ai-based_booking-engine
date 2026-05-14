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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { RatePlan } from '@/types/api';

const ratePlanSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    meal_plan: z.string(),
    price_adjustment: z.coerce.number().min(0, 'Must be positive'),
    is_refundable: z.boolean(),
    cancellation_hours: z.coerce.number().min(0),
    is_active: z.boolean(),
    min_los: z.coerce.number().min(1),
    advance_purchase_days: z.coerce.number().min(0),
    inclusions: z.string().optional(), // Comma-separated string, will be converted to array
    is_package: z.boolean().default(false),
    package_items: z.string().optional(), // Comma-separated string for package components
});

interface RatePlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    planToEdit?: RatePlan | null; // If present, we are editing
    onSuccess: () => void;
    defaultIsPackage?: boolean;
}

export function RatePlanDialog({ open, onOpenChange, planToEdit, onSuccess, defaultIsPackage = false }: RatePlanDialogProps) {
    const { toast } = useToast();
    const isEditing = !!planToEdit;

    const form = useForm<z.infer<typeof ratePlanSchema>>({
        resolver: zodResolver(ratePlanSchema),
        defaultValues: {
            name: '',
            description: '',
            meal_plan: 'EP',
            price_adjustment: 0,
            is_refundable: true,
            cancellation_hours: 24,
            is_active: true,
            min_los: 1,
            advance_purchase_days: 0,
            inclusions: '',
            is_package: false,
            package_items: '',
        },
    });

    useEffect(() => {
        if (planToEdit) {
            form.reset({
                name: planToEdit.name,
                description: planToEdit.description || '',
                meal_plan: planToEdit.meal_plan || 'EP',
                price_adjustment: planToEdit.price_adjustment || 0,
                is_refundable: planToEdit.is_refundable,
                cancellation_hours: planToEdit.cancellation_hours,
                is_active: planToEdit.is_active,
                min_los: planToEdit.min_los || 1,
                advance_purchase_days: planToEdit.advance_purchase_days || 0,
                inclusions: (planToEdit.inclusions || []).join(', '),
                is_package: planToEdit.is_package || false,
                package_items: (planToEdit.package_items || []).join(', '),
            });
        } else {
            form.reset({
                name: '',
                description: '',
                meal_plan: 'EP',
                price_adjustment: 0,
                is_refundable: true,
                cancellation_hours: 24,
                is_active: true,
                min_los: 1,
                advance_purchase_days: 0,
                inclusions: '',
                is_package: defaultIsPackage,
                package_items: '',
            });
        }
    }, [planToEdit, form, open]);

    const onSubmit = async (values: z.infer<typeof ratePlanSchema>) => {
        try {
            // Parse inclusions string to array
            const payload = {
                ...values,
                inclusions: values.inclusions
                    ? values.inclusions.split(',').map(s => s.trim()).filter(Boolean)
                    : [],
                package_items: values.package_items
                    ? values.package_items.split(',').map(s => s.trim()).filter(Boolean)
                    : []
            };

            if (isEditing) {
                await apiClient.patch(`/rates/plans/${planToEdit.id}`, payload);
                toast({
                    title: 'Rate Plan Updated',
                    description: 'Changes saved successfully.',
                });
            } else {
                await apiClient.post('/rates/plans', payload);
                toast({
                    title: 'Rate Plan Created',
                    description: 'New rate plan added successfully.',
                });
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `Failed to ${isEditing ? 'update' : 'create'} rate plan.`,
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit Rate Plan' : 'Add New Rate Plan'}</DialogTitle>
                    <DialogDescription>
                        {isEditing ? 'Modify existing rate plan details.' : 'Create a new pricing strategy for your rooms.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rate Plan Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Bed & Breakfast, Special Deal" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Short description for guests" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="meal_plan"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Meal Plan</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select meal plan" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="EP">EP (Room Only)</SelectItem>
                                                <SelectItem value="CP">CP (Breakfast)</SelectItem>
                                                <SelectItem value="MAP">MAP (Breakfast + Dinner)</SelectItem>
                                                <SelectItem value="AP">AP (All Meals)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="price_adjustment"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Extra Rate (Markup)</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                                                <Input type="number" min={0} className="pl-7" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormDescription>Added to room base price per night</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="cancellation_hours"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cancellation (Hours)</FormLabel>
                                        <FormControl>
                                            <Input type="number" min={0} {...field} value={field.value} onChange={e => field.onChange(e.target.value)} />
                                        </FormControl>
                                        <FormDescription>Hours before check-in</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="min_los"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Min Stay (Nights)</FormLabel>
                                        <FormControl>
                                            <Input type="number" min={1} {...field} />
                                        </FormControl>
                                        <FormDescription>Minimum nights required</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="advance_purchase_days"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Advance Purchase (Days)</FormLabel>
                                        <FormControl>
                                            <Input type="number" min={0} {...field} />
                                        </FormControl>
                                        <FormDescription>Book this many days before</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="inclusions"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Inclusions</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Free WiFi, Airport Pickup, Welcome Drink" {...field} />
                                    </FormControl>
                                    <FormDescription>Comma-separated list of perks</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex flex-col gap-4 p-4 border rounded-lg bg-muted/20">
                            <FormField
                                control={form.control}
                                name="is_package"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg p-0">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base text-primary font-bold">Mark as Package</FormLabel>
                                            <FormDescription>
                                                Bundled deals like Stay + Food + Activities
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            {form.watch('is_package') && (
                                <FormField
                                    control={form.control}
                                    name="package_items"
                                    render={({ field }) => (
                                        <FormItem className="mt-2 p-3 bg-primary/5 rounded-md border border-primary/10">
                                            <FormLabel className="text-xs font-bold text-primary">Package Inclusions (Exclusive Items)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. 1-Day City Tour, Candle Light Dinner, Spa Coupon" {...field} />
                                            </FormControl>
                                            <FormDescription className="text-[10px]">Add items unique to this package</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>

                        <div className="flex flex-col gap-4 p-4 border rounded-lg bg-muted/20">
                            <FormField
                                control={form.control}
                                name="is_refundable"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg p-0">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Refundable</FormLabel>
                                            <FormDescription>
                                                Can guests cancel for a refund?
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="is_active"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg p-0">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Active Status</FormLabel>
                                            <FormDescription>
                                                Visible to guests on booking engine
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditing ? 'Save Changes' : 'Create Plan'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog >
    );
}
