import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Sparkles, ShieldCheck, Zap, TrendingUp, Info, Clock, Calendar, CheckCircle2, Package, LayoutGrid, DollarSign, HelpCircle } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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
});

interface RatePlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    planToEdit?: RatePlan | null;
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
            market_price: undefined,
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
                market_price: planToEdit.market_price,
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
            });
        }
    }, [planToEdit, form, open, defaultIsPackage]);

    const onSubmit = async (values: z.infer<typeof ratePlanSchema>) => {
        try {
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
                    title: 'Strategy Updated',
                    description: 'Rate plan parameters synchronized across distribution channels.',
                });
            } else {
                await apiClient.post('/rates/plans', payload);
                toast({
                    title: 'Strategy Deployed',
                    description: 'New pricing architecture is now live.',
                });
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Deployment Failed',
                description: `Unable to ${isEditing ? 'modify' : 'initialize'} rate plan logic.`,
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden bg-white/95 backdrop-blur-2xl border-none shadow-[0_30px_70px_rgba(0,0,0,0.2)] rounded-[40px]">
                {/* Header Section */}
                <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-950 p-8 sm:p-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-white/5 to-transparent pointer-events-none" />
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]" />
                    
                    <div className="relative z-10 space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">
                            <TrendingUp className="w-3 h-3" />
                            Revenue Optimization Strategy
                        </div>
                        <DialogTitle className="text-4xl sm:text-5xl font-black tracking-tighter text-white">
                            {isEditing ? 'Refine Strategy' : 'Craft Strategy'}
                        </DialogTitle>
                        <DialogDescription className="text-indigo-200/60 max-w-lg font-medium leading-relaxed">
                            {isEditing 
                                ? 'Adjust pricing logic and distribution rules to maximize yield and booking velocity.' 
                                : 'Initialize a new revenue model to attract high-value guests and optimize inventory flow.'}
                        </DialogDescription>
                    </div>
                </div>

                <div className="max-h-[65vh] overflow-y-auto px-8 sm:px-10 py-8 scrollbar-none">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
                            
                            {/* Section 1: Identity & Narrative */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                        <Info className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <h3 className="text-xl font-black text-indigo-950 tracking-tight">Identity & Narrative</h3>
                                </div>
                                
                                <div className="grid gap-6">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Plan Designation</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Royal Breakfast Deal, Summer Luxury Escape" className="h-14 rounded-2xl border-indigo-100 bg-indigo-50/30 font-bold text-indigo-950 focus-visible:ring-indigo-500/20 px-6" {...field} />
                                                </FormControl>
                                                <FormMessage className="font-bold text-rose-500" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Strategic Context</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Define the unique value proposition for guests..." className="h-14 rounded-2xl border-indigo-100 bg-indigo-50/30 font-bold text-indigo-950 focus-visible:ring-indigo-500/20 px-6" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <Separator className="bg-indigo-50" />

                            {/* Section 2: Pricing Logic */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
                                        <DollarSign className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <h3 className="text-xl font-black text-indigo-950 tracking-tight">Pricing & Yield Engine</h3>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-8 bg-indigo-50/30 p-8 rounded-[32px] border border-indigo-100/50">
                                    <FormField
                                        control={form.control}
                                        name="price_adjustment"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Incremental Rate (Markup)</FormLabel>
                                                <FormControl>
                                                    <div className="relative group">
                                                        <div className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-indigo-300">₹</div>
                                                        <Input type="number" className="h-14 rounded-2xl border-indigo-100 bg-white font-black text-indigo-600 focus-visible:ring-indigo-500/20 pl-12 pr-6 shadow-sm" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormDescription className="text-[10px] font-medium text-indigo-400">Added to base room rate per night</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="market_price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Market Benchmark (RRP)</FormLabel>
                                                <FormControl>
                                                    <div className="relative group">
                                                        <div className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-indigo-300">₹</div>
                                                        <Input type="number" placeholder="Original price..." className="h-14 rounded-2xl border-indigo-100 bg-white font-black text-indigo-400/50 focus-visible:ring-indigo-500/20 pl-12 pr-6 shadow-sm" {...field} value={field.value ?? ''} />
                                                    </div>
                                                </FormControl>
                                                <FormDescription className="text-[10px] font-medium text-indigo-400 italic">Enables strike-through visual on public site</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="meal_plan"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Gastronomy Protocol</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-14 rounded-2xl border-indigo-100 bg-white font-bold text-indigo-950 focus:ring-indigo-500/20 px-6 shadow-sm">
                                                            <SelectValue placeholder="Select plan" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-2xl">
                                                        <SelectItem value="EP" className="font-bold">EP (Room Only)</SelectItem>
                                                        <SelectItem value="CP" className="font-bold">CP (Continental Breakfast)</SelectItem>
                                                        <SelectItem value="MAP" className="font-bold text-indigo-600">MAP (Half Board)</SelectItem>
                                                        <SelectItem value="AP" className="font-bold text-violet-600">AP (Full Board / Inclusive)</SelectItem>
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
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Stay Duration Filter</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input type="number" className="h-14 rounded-2xl border-indigo-100 bg-white font-black text-indigo-950 px-6 pr-16 shadow-sm" {...field} />
                                                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-300 uppercase">Nights</span>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Section 3: Distribution & Policy */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center">
                                        <ShieldCheck className="h-5 w-5 text-violet-600" />
                                    </div>
                                    <h3 className="text-xl font-black text-indigo-950 tracking-tight">Policies & Thresholds</h3>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="cancellation_hours"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Risk Mitigation (Cancel Window)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Clock className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-300" />
                                                        <Input type="number" className="h-14 rounded-2xl border-indigo-100 bg-indigo-50/30 font-black text-indigo-950 pl-14 pr-6 focus-visible:ring-indigo-500/20" {...field} />
                                                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-300 uppercase">Hours</span>
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
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Advanced Procurement Filter</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-300" />
                                                        <Input type="number" className="h-14 rounded-2xl border-indigo-100 bg-indigo-50/30 font-black text-indigo-950 pl-14 pr-6 focus-visible:ring-indigo-500/20" {...field} />
                                                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-300 uppercase">Days</span>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="flex items-center justify-between p-6 rounded-[24px] bg-emerald-50/30 border border-emerald-100/30 group hover:bg-emerald-50 transition-colors">
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-emerald-900 tracking-tight">Active Deployment</p>
                                            <p className="text-[10px] font-medium text-emerald-600/70 uppercase tracking-widest">Visibility on Booking Nodes</p>
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="is_active"
                                            render={({ field }) => (
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-emerald-500 shadow-lg" />
                                                </FormControl>
                                            )}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-6 rounded-[24px] bg-rose-50/30 border border-rose-100/30 group hover:bg-rose-50 transition-colors">
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-rose-900 tracking-tight">Refund Protocol</p>
                                            <p className="text-[10px] font-medium text-rose-600/70 uppercase tracking-widest">Flexible Cancellation Allowed</p>
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="is_refundable"
                                            render={({ field }) => (
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-rose-500 shadow-lg" />
                                                </FormControl>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Experience Design (Packages) */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center">
                                        <Package className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <h3 className="text-xl font-black text-indigo-950 tracking-tight">Curated Experience Architecture</h3>
                                </div>

                                <div className={cn(
                                    "p-8 rounded-[32px] border transition-all duration-500",
                                    form.watch('is_package') 
                                        ? "bg-gradient-to-br from-amber-50/50 to-orange-50/50 border-amber-200 shadow-xl" 
                                        : "bg-indigo-50/20 border-indigo-100"
                                )}>
                                    <FormField
                                        control={form.control}
                                        name="is_package"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center justify-between mb-8">
                                                <div className="space-y-1">
                                                    <FormLabel className="text-lg font-black text-indigo-950 tracking-tight flex items-center gap-2">
                                                        Neural Bundle Strategy
                                                        <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                                                    </FormLabel>
                                                    <FormDescription className="text-xs font-medium text-indigo-400">Enable high-conversion bundled inventory</FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-amber-600" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {form.watch('is_package') && (
                                        <div className="space-y-6 animate-enter">
                                            <FormField
                                                control={form.control}
                                                name="package_items"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-amber-600">Exclusive Bundle Components</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="e.g. VIP City Tour, Spa Ritual, Sunset Yacht Access" className="h-14 rounded-2xl border-amber-200 bg-white font-bold text-indigo-950 shadow-sm" {...field} />
                                                        </FormControl>
                                                        <FormDescription className="text-[10px] font-bold text-amber-500/70 uppercase tracking-widest">Comma-separated luxury assets</FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    <div className="mt-6">
                                        <FormField
                                            control={form.control}
                                            name="inclusions"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Standard Amenities & Perks</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g. High-Speed WiFi, Welcome Libation, Turndown Service" className="h-14 rounded-2xl border-indigo-100 bg-white font-bold text-indigo-950 shadow-sm" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                        </form>
                    </Form>
                </div>

                <DialogFooter className="p-8 sm:p-10 bg-indigo-50/50 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between border-t border-indigo-100">
                    <div className="flex items-center gap-2 text-indigo-400">
                        <HelpCircle className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">All changes synchronized across global nodes</span>
                    </div>
                    <div className="flex gap-4">
                        <Button variant="ghost" className="rounded-2xl font-black uppercase tracking-widest text-[10px] px-8 h-12 text-indigo-400 hover:bg-indigo-100 transition-all" onClick={() => onOpenChange(false)}>
                            Abort Protocol
                        </Button>
                        <Button 
                            disabled={form.formState.isSubmitting}
                            onClick={form.handleSubmit(onSubmit)}
                            className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 h-12 px-10 font-black uppercase tracking-widest text-[10px] shadow-[0_10px_20px_rgba(79,70,229,0.2)] flex gap-2 group transition-all"
                        >
                            {form.formState.isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Zap className="h-4 w-4 group-hover:scale-125 transition-transform" />
                            )}
                            {isEditing ? 'Finalize Strategy' : 'Deploy Strategy'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog >
    );
}
