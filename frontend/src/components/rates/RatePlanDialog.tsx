import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, TrendingUp, Info, Clock, Calendar, Package, DollarSign, HelpCircle, Check, Eye } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ImageUpload } from '@/components/common/ImageUpload';

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
    inclusions: z.string().optional(),
    is_package: z.boolean().default(false),
    package_items: z.string().optional(),
    market_price: z.coerce.number().min(0).optional().nullable(),
    image_url: z.string().optional(),
    valid_from: z.string().optional(),
    valid_to: z.string().optional(),
});

interface RatePlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: RatePlan | null;
    onSuccess: () => void;
    defaultIsPackage?: boolean;
    showPackageSection?: boolean;
}

export function RatePlanDialog({ open, onOpenChange, initialData, onSuccess, defaultIsPackage = false, showPackageSection = true }: RatePlanDialogProps) {
    const { toast } = useToast();
    const isEditing = !!initialData;

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
            market_price: undefined,
            image_url: '',
            valid_from: '',
            valid_to: '',
        },
    });

    const isRefundable = form.watch('is_refundable');
    const cancellationHours = form.watch('cancellation_hours');

    useEffect(() => {
        if (initialData) {
            form.reset({
                name: initialData.name,
                description: initialData.description || '',
                meal_plan: initialData.meal_plan || 'EP',
                price_adjustment: initialData.price_adjustment || 0,
                is_refundable: initialData.is_refundable,
                cancellation_hours: initialData.cancellation_hours,
                is_active: initialData.is_active,
                min_los: initialData.min_los || 1,
                advance_purchase_days: initialData.advance_purchase_days || 0,
                inclusions: (initialData.inclusions || []).join(', '),
                is_package: initialData.is_package || false,
                package_items: (initialData.package_items || []).join(', '),
                market_price: initialData.market_price,
                image_url: initialData.image_url || '',
                valid_from: initialData.valid_from || '',
                valid_to: initialData.valid_to || '',
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
                market_price: undefined,
                image_url: '',
                valid_from: '',
                valid_to: '',
            });
        }
    }, [initialData, form, open, defaultIsPackage]);

    const onSubmit = async (values: z.infer<typeof ratePlanSchema>) => {
        try {
            const payload = {
                ...values,
                inclusions: values.inclusions
                    ? values.inclusions.split(',').map(s => s.trim()).filter(Boolean)
                    : [],
                package_items: values.package_items
                    ? values.package_items.split(',').map(s => s.trim()).filter(Boolean)
                    : [],
                valid_from: values.valid_from || null,
                valid_to: values.valid_to || null,
            };

            if (isEditing) {
                await apiClient.patch(`/rates/plans/${initialData.id}`, payload);
                toast({
                    title: 'Success',
                    description: 'Rate plan updated successfully.',
                });
            } else {
                await apiClient.post('/rates/plans', payload);
                toast({
                    title: 'Success',
                    description: 'New rate plan created successfully.',
                });
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `Failed to ${isEditing ? 'update' : 'create'} rate plan.`,
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-background border-none shadow-2xl rounded-2xl">
                {/* Header */}
                <div className="bg-muted/50 p-6 sm:p-8 border-b border-border">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-600 mb-2">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Rate Management</span>
                        </div>
                        <DialogTitle className="text-2xl font-bold text-foreground">
                            {isEditing ? 'Edit Rate Plan' : 'Add Rate Plan'}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-sm">
                            {isEditing 
                                ? 'Update your pricing rules and cancellation policies.' 
                                : 'Create a new pricing plan for your rooms.'}
                        </DialogDescription>
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto px-6 sm:px-8 py-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            
                            {/* Section 1: Basic Info */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-foreground">
                                    <Info className="h-4 w-4" />
                                    <h3 className="text-base font-bold">Basic Information</h3>
                                </div>
                                
                                <div className="grid gap-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">Plan Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Early Bird Offer, Winter Special" className="h-10 border-border focus-visible:ring-blue-600" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">Short Description</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="What makes this plan special?" className="h-10 border-border focus-visible:ring-blue-600" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="image_url"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">Plan / Package Image</FormLabel>
                                                <FormControl>
                                                    <ImageUpload
                                                        existingImage={field.value}
                                                        onUploadComplete={(url) => field.onChange(url)}
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-[10px]">
                                                    Upload an image to display with this rate plan/package on the booking engine.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <Separator className="bg-muted" />

                            {/* Section 2: Pricing */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-foreground">
                                    <DollarSign className="h-4 w-4" />
                                    <h3 className="text-base font-bold">Pricing Rules</h3>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-6 p-6 rounded-xl bg-muted/30 border border-border">
                                    <FormField
                                        control={form.control}
                                        name="price_adjustment"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">Markup / Add-on Price</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</div>
                                                        <Input type="number" className="h-10 border-border pl-7" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormDescription className="text-[10px]">Added to room base price</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="market_price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">Display Price (M.R.P.)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</div>
                                                        <Input type="number" placeholder="Original price..." className="h-10 border-border pl-7" {...field} value={field.value ?? ''} />
                                                    </div>
                                                </FormControl>
                                                <FormDescription className="text-[10px]">For strike-through display</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="meal_plan"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">Meal Plan</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-10 border-border">
                                                            <SelectValue placeholder="Select meal plan" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="EP">EP (Room Only)</SelectItem>
                                                        <SelectItem value="CP">CP (Breakfast Only)</SelectItem>
                                                        <SelectItem value="MAP">MAP (Breakfast & Dinner)</SelectItem>
                                                        <SelectItem value="AP">AP (All Meals)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="min_los"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">Min. Nights Stay</FormLabel>
                                                <FormControl>
                                                    <Input type="number" className="h-10 border-border" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Section 3: Policies */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-foreground">
                                    <Clock className="h-4 w-4" />
                                    <h3 className="text-base font-bold">Cancellation & Booking Policies</h3>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="cancellation_hours"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">Free Cancellation Before</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input type="number" className="h-10 border-border pr-14" {...field} />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">Hours</span>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="advance_purchase_days"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">Advance Booking Req.</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input type="number" className="h-10 border-border pr-14" {...field} />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">Days</span>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border border-border">
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-bold text-foreground">Active Status</p>
                                            <p className="text-[10px] text-muted-foreground">Show this plan to guests</p>
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="is_active"
                                            render={({ field }) => (
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                            )}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border border-border">
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-bold text-foreground">Refundable</p>
                                            <p className="text-[10px] text-muted-foreground">Allow refunds on cancellation</p>
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="is_refundable"
                                            render={({ field }) => (
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Guest Live Preview Banner */}
                                <div className="mt-2 p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                                            <Eye className="w-4 h-4 text-indigo-600" />
                                            Guest View Live Preview on Booking Engine
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full bg-background text-[10px] text-indigo-700 font-bold border border-indigo-200">Live Preview</span>
                                    </div>
                                    <div className="flex items-center gap-2 pt-0.5">
                                        <span className="text-xs text-muted-foreground font-medium">Cancellation Policy Display:</span>
                                        <span className={`text-xs font-bold px-3 py-1 rounded-md shadow-xs border ${
                                            isRefundable 
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                                : "bg-rose-50 text-rose-700 border-rose-200"
                                        }`}>
                                            {isRefundable ? `Free cancellation up to ${cancellationHours || 0} hours before check-in` : 'Non-Refundable'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Package Inclusions — hidden on Rate Plans page */}
                            {showPackageSection && <div className="space-y-4">
                                <div className="flex items-center gap-2 text-foreground">
                                    <Package className="h-4 w-4" />
                                    <h3 className="text-base font-bold">Bundle Package Details</h3>
                                </div>

                                <div className={cn(
                                    "p-6 rounded-xl border transition-all",
                                    form.watch('is_package') 
                                        ? "bg-blue-50/30 border-blue-100" 
                                        : "bg-muted/30 border-border"
                                )}>
                                    <FormField
                                        control={form.control}
                                        name="is_package"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center justify-between mb-4">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-sm font-bold text-foreground">Enable as Package</FormLabel>
                                                    <FormDescription className="text-[10px]">Bundle extra services with room stay</FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {form.watch('is_package') && (
                                        <div className="space-y-4">
                                            <FormField
                                                control={form.control}
                                                name="package_items"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground">Package Inclusions (Comma separated)</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="e.g. Free Sightseeing, Spa Session, Welcome Drink" className="h-10 border-border" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="grid sm:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="valid_from"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-xs font-semibold text-muted-foreground">Valid From (optional)</FormLabel>
                                                            <FormControl>
                                                                <Input type="date" className="h-10 border-border" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="valid_to"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-xs font-semibold text-muted-foreground">Valid Until (optional)</FormLabel>
                                                            <FormControl>
                                                                <Input type="date" className="h-10 border-border" {...field} />
                                                            </FormControl>
                                                            <FormDescription className="text-[10px]">Leave both blank for an always-available package.</FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-4">
                                        <FormField
                                            control={form.control}
                                            name="inclusions"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-semibold text-muted-foreground">Standard Amenities (Comma separated)</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g. Free WiFi, AC, Geyser" className="h-10 border-border" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>}
                        </form>
                    </Form>
                </div>

                <DialogFooter className="p-6 bg-muted/50 flex items-center justify-between border-t border-border">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <HelpCircle className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Updates will sync instantly</span>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" className="rounded-lg text-sm font-semibold" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button 
                            disabled={form.formState.isSubmitting}
                            onClick={form.handleSubmit(onSubmit)}
                            className="rounded-lg bg-blue-600 hover:bg-blue-700 h-10 px-8 font-bold text-sm shadow-sm flex gap-2"
                        >
                            {form.formState.isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Check className="h-4 w-4" />
                            )}
                            {isEditing ? 'Save Changes' : 'Create Plan'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog >
    );
}
