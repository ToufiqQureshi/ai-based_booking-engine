import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Ruler, BedDouble, Info, LayoutGrid, CreditCard, Users, Zap, Image as ImageIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/api/client';
import { RoomType, Amenity, RoomPhoto, RoomAmenity } from '@/types/api';
import { useToast } from '@/hooks/use-toast';
import { RoomImageUploader } from './RoomImageUploader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const roomSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
    base_price: z.coerce.number().min(0, 'Price must be positive'),
    total_inventory: z.coerce.number().min(0, 'Inventory must be positive'),
    base_occupancy: z.coerce.number().min(1, 'At least 1 person'),
    max_occupancy: z.coerce.number().min(1, 'At least 1 person'),
    max_children: z.coerce.number().min(0, 'Cannot be negative'),
    extra_bed_allowed: z.boolean().default(false),
    extra_person_price: z.coerce.number().min(0, 'Cannot be negative'),
    extra_adult_price: z.coerce.number().min(0, 'Cannot be negative'),
    extra_child_price: z.coerce.number().min(0, 'Cannot be negative'),
    bed_type: z.string().optional(),
    room_size: z.coerce.number().optional(),
    view: z.string().optional(),
    floor: z.string().optional(),
    smoking_allowed: z.boolean().default(false),
    is_pet_friendly: z.boolean().default(false),
    photos: z.array(z.object({
        id: z.string().optional(),
        url: z.string(),
        caption: z.string().optional(),
        is_primary: z.boolean().optional().default(false),
        order: z.number().optional().default(0),
        sort_order: z.number().optional(),
    })).default([]),
    amenity_ids: z.array(z.string()).default([]),
    market_price: z.coerce.number().min(0).optional().nullable(),
    is_active: z.boolean().default(true),
});

interface RoomDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    initialData?: RoomType | null;
}

export function RoomDialog({ open, onOpenChange, onSuccess, initialData }: RoomDialogProps) {
    const { toast } = useToast();
    const isEditing = !!initialData;

    const form = useForm<z.infer<typeof roomSchema>>({
        resolver: zodResolver(roomSchema),
        defaultValues: {
            name: '',
            description: '',
            base_price: 0,
            total_inventory: 1,
            base_occupancy: 2,
            max_occupancy: 2,
            max_children: 0,
            extra_bed_allowed: false,
            extra_person_price: 1000,
            extra_adult_price: 1000,
            extra_child_price: 500,
            bed_type: 'Queen',
            room_size: undefined,
            view: '',
            floor: '',
            smoking_allowed: false,
            is_pet_friendly: false,
            photos: [],
            market_price: undefined,
            is_active: true,
        },
    });

    const [availableAmenities, setAvailableAmenities] = useState<Amenity[]>([]);

    useEffect(() => {
        // Fetch global amenities
        const loadAmenities = async () => {
            try {
                const data = await apiClient.get<Amenity[]>('/amenities');
                setAvailableAmenities(data);
            } catch (e) {
                console.error("Failed to load amenities", e);
            }
        };
        if (open) loadAmenities();
    }, [open]);

    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    name: initialData.name,
                    description: initialData.description || '',
                    base_price: initialData.base_price,
                    total_inventory: initialData.total_inventory,
                    base_occupancy: initialData.base_occupancy,
                    max_occupancy: initialData.max_occupancy,
                    max_children: initialData.max_children || 0,
                    extra_bed_allowed: initialData.extra_bed_allowed || false,
                    extra_person_price: initialData.extra_person_price || 1000,
                    extra_adult_price: initialData.extra_adult_price || 0,
                    extra_child_price: initialData.extra_child_price || 0,
                    bed_type: initialData.bed_type || 'Queen',
                    room_size: initialData.room_size,
                    view: initialData.view || '',
                    floor: initialData.floor || '',
                    smoking_allowed: initialData.smoking_allowed || false,
                    is_pet_friendly: initialData.is_pet_friendly || false,
                    photos: initialData.photos || [],
                    market_price: initialData.market_price,
                    // If backend sends 'amenities' as objects, we map them to IDs
                    amenity_ids: initialData.amenities?.map(a => a.id) || [],
                    is_active: initialData.is_active ?? true,
                });
            } else {
                form.reset({
                    name: '',
                    description: '',
                    base_price: 0,
                    total_inventory: 1,
                    base_occupancy: 2,
                    max_occupancy: 2,
                    max_children: 0,
                    extra_bed_allowed: false,
                    extra_person_price: 1000,
                    extra_adult_price: 0,
                    extra_child_price: 0,
                    bed_type: 'Queen',
                    room_size: undefined,
                    view: '',
                    floor: '',
                    smoking_allowed: false,
                    is_pet_friendly: false,
                    photos: [],
                    amenity_ids: [],
                    market_price: undefined,
                    is_active: true,
                });
            }
        }
    }, [open, initialData, form]);

    const onSubmit = async (values: z.infer<typeof roomSchema>) => {
        try {
            if (isEditing && initialData) {
                await apiClient.patch(`/rooms/${initialData.id}`, values);
                toast({ title: 'Room Updated', description: 'Room details have been saved.' });
            } else {
                await apiClient.post('/rooms', values);
                toast({ title: 'Room Created', description: 'New room type has been added.' });
            }
            onOpenChange(false);
            onSuccess();
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to save room details.',
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-2xl border-white/40 shadow-[0_30px_70px_rgba(0,0,0,0.15)] rounded-[32px] p-0 gap-0 border">
                <DialogHeader className="p-10 pb-6 bg-gradient-to-br from-indigo-50/80 to-white/20 border-b border-indigo-100/20 sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-950 via-indigo-800 to-violet-900 bg-clip-text text-transparent">
                                {isEditing ? 'Refine Experience' : 'New Room Class'}
                            </DialogTitle>
                            <DialogDescription className="text-indigo-600/60 font-semibold text-base mt-2">
                                Design a bespoke sanctuary for your premier guests.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="p-10 pt-8 space-y-12">
                        {/* Basic Information Section */}
                        <section className="space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-100/50 flex items-center justify-center shadow-sm">
                                    <Info className="w-6 h-6 text-indigo-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-indigo-950 tracking-tight">Identity & Atmosphere</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-indigo-50/10 p-8 rounded-[24px] border border-indigo-100/30">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-indigo-900/70 font-bold uppercase text-[11px] tracking-widest">Designation</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    placeholder="e.g. Royal Zenith Suite" 
                                                    {...field} 
                                                    className="bg-white border-indigo-100/50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl h-14 text-lg font-medium transition-all"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="bed_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-indigo-900/70 font-bold uppercase text-[11px] tracking-widest">Curation</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-white border-indigo-100/50 rounded-2xl h-14 text-lg font-medium">
                                                        <SelectValue placeholder="Select Bed" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-2xl border-indigo-50 shadow-2xl">
                                                    <SelectItem value="Single Bed">Single Bed</SelectItem>
                                                    <SelectItem value="Double Bed">Double Bed</SelectItem>
                                                    <SelectItem value="Queen Bed">Queen Bed</SelectItem>
                                                    <SelectItem value="King Bed">King Bed</SelectItem>
                                                    <SelectItem value="Twin Bed">Twin Bed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="md:col-span-2">
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-indigo-900/70 font-bold uppercase text-[11px] tracking-widest">The Narrative</FormLabel>
                                                <FormControl>
                                                    <Textarea 
                                                        placeholder="Paint a picture of luxury..." 
                                                        className="min-h-[140px] bg-white border-indigo-100/50 rounded-2xl resize-none p-5 text-base leading-relaxed focus:ring-4 focus:ring-indigo-500/5 transition-all"
                                                        {...field} 
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Room Specifics Section */}
                        <section className="space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-violet-100/50 flex items-center justify-center shadow-sm">
                                    <LayoutGrid className="w-6 h-6 text-violet-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-indigo-950 tracking-tight">Dimensions & Access</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 bg-violet-50/10 p-8 rounded-[24px] border border-violet-100/30">
                                <FormField
                                    control={form.control}
                                    name="room_size"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-indigo-900/70 font-bold uppercase text-[11px] tracking-widest">Expanse (sq ft)</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    type="number" 
                                                    {...field} 
                                                    className="bg-white border-indigo-100/50 rounded-2xl h-13 font-bold text-lg"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="view"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-indigo-900/70 font-bold uppercase text-[11px] tracking-widest">Vista</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-white border-indigo-100/50 rounded-2xl h-13 font-medium">
                                                        <SelectValue placeholder="Select View" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-2xl border-indigo-50 shadow-2xl">
                                                    <SelectItem value="Garden View">Garden View</SelectItem>
                                                    <SelectItem value="Sea View">Sea View</SelectItem>
                                                    <SelectItem value="City View">City View</SelectItem>
                                                    <SelectItem value="Pool View">Pool View</SelectItem>
                                                    <SelectItem value="Mountain View">Mountain View</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="floor"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-indigo-900/70 font-bold uppercase text-[11px] tracking-widest">Elevation</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    placeholder="e.g. Skyline Level" 
                                                    {...field} 
                                                    className="bg-white border-indigo-100/50 rounded-2xl h-13 font-medium"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="flex gap-8 md:col-span-2 lg:col-span-3 pt-4">
                                    <FormField
                                        control={form.control}
                                        name="smoking_allowed"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-4 space-y-0 bg-white/80 p-5 rounded-2xl border border-indigo-100/40 flex-1 shadow-sm hover:shadow-md transition-shadow">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        className="h-6 w-6 data-[state=checked]:bg-indigo-600 rounded-lg border-indigo-200"
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-bold text-indigo-950 text-base cursor-pointer">Cigar Friendly</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="is_pet_friendly"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-4 space-y-0 bg-white/80 p-5 rounded-2xl border border-indigo-100/40 flex-1 shadow-sm hover:shadow-md transition-shadow">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        className="h-6 w-6 data-[state=checked]:bg-indigo-600 rounded-lg border-indigo-200"
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-bold text-indigo-950 text-base cursor-pointer">Pet Accommodating</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Room Photos Section */}
                        <section className="space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-100/50 flex items-center justify-center shadow-sm">
                                    <ImageIcon className="w-6 h-6 text-indigo-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-indigo-950 tracking-tight">Visual Identity</h3>
                            </div>
                            <div className="p-10 bg-indigo-50/10 rounded-[32px] border border-indigo-100/30">
                                <FormField
                                    control={form.control}
                                    name="photos"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <RoomImageUploader 
                                                    images={field.value as RoomPhoto[]} 
                                                    onChange={field.onChange} 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </section>

                        {/* Capacity & Pricing Section */}
                        <section className="space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-rose-100/50 flex items-center justify-center shadow-sm">
                                    <CreditCard className="w-6 h-6 text-rose-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-indigo-950 tracking-tight">Investment & Scale</h3>
                            </div>
                            <div className="bg-gradient-to-br from-rose-50/20 via-white/5 to-indigo-50/20 p-10 rounded-[32px] border border-rose-100/20 space-y-12 shadow-inner">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                    <FormField
                                        control={form.control}
                                        name="base_price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-rose-900/70 font-bold uppercase text-[11px] tracking-widest">Base Rate (₹)</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        {...field} 
                                                        className="bg-white border-rose-100/50 focus:ring-rose-500/10 rounded-2xl h-16 text-2xl font-black text-rose-950 shadow-sm"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="market_price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-indigo-900/70 font-bold uppercase text-[11px] tracking-widest">Market Value (₹)</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        placeholder="e.g. 25000" 
                                                        {...field} 
                                                        value={field.value ?? ''}
                                                        className="bg-white/50 border-indigo-100/50 rounded-2xl h-16 text-xl font-bold text-indigo-400/70"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="total_inventory"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-indigo-900/70 font-bold uppercase text-[11px] tracking-widest">Key Count</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        {...field} 
                                                        className="bg-white border-indigo-100/50 rounded-2xl h-16 text-xl font-bold text-indigo-950"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="p-10 bg-white/40 backdrop-blur-md rounded-[24px] border border-white/60 shadow-xl space-y-10">
                                    <div className="flex items-center gap-3 text-indigo-950 mb-4">
                                        <Users className="w-6 h-6 text-indigo-600" />
                                        <h4 className="font-extrabold uppercase tracking-[0.2em] text-[10px] text-indigo-900/50">Occupancy Logic</h4>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                        <FormField
                                            control={form.control}
                                            name="base_occupancy"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-bold text-indigo-900/60">Standard Guest Count</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} className="rounded-xl h-12 bg-white/70 font-bold" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="max_occupancy"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-bold text-indigo-900/60">Absolute Ceiling</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} className="rounded-xl h-12 bg-white/70 font-bold" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="max_children"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-bold text-indigo-900/60">Junior Guests</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} className="rounded-xl h-12 bg-white/70 font-bold" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6 border-t border-indigo-100/20">
                                        <FormField
                                            control={form.control}
                                            name="extra_adult_price"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-bold text-indigo-900/60">Surcharge: Adult (₹)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} className="rounded-xl h-12 bg-white/70 font-bold text-indigo-600" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="extra_child_price"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-bold text-indigo-900/60">Surcharge: Junior (₹)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} className="rounded-xl h-12 bg-white/70 font-bold text-indigo-600" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Amenities Section */}
                        <section className="space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-100/50 flex items-center justify-center shadow-sm">
                                    <Zap className="w-6 h-6 text-emerald-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-indigo-950 tracking-tight">Luxury Features</h3>
                            </div>
                            <div className="p-10 bg-emerald-50/10 rounded-[32px] border border-emerald-100/30">
                                <FormField
                                    control={form.control}
                                    name="amenity_ids"
                                    render={() => (
                                        <FormItem>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                                {availableAmenities.filter(a => a.scope === 'room').map((amenity) => (
                                                    <FormField
                                                        key={amenity.id}
                                                        control={form.control}
                                                        name="amenity_ids"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center space-x-4 bg-white/60 p-4 rounded-2xl border border-indigo-50 shadow-sm hover:border-indigo-200 hover:bg-white transition-all cursor-pointer">
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={field.value?.includes(amenity.id)}
                                                                        onCheckedChange={(checked) => {
                                                                            return checked
                                                                                ? field.onChange([...field.value, amenity.id])
                                                                                : field.onChange(field.value?.filter(val => val !== amenity.id))
                                                                        }}
                                                                        className="h-5 w-5 data-[state=checked]:bg-emerald-600 border-emerald-100"
                                                                    />
                                                                </FormControl>
                                                                <FormLabel className="font-bold text-sm text-indigo-900 cursor-pointer flex items-center gap-2">
                                                                    {amenity.name}
                                                                    {amenity.is_featured && <Badge className="bg-amber-400 text-amber-950 text-[9px] font-black h-4 uppercase">Elite</Badge>}
                                                                </FormLabel>
                                                            </FormItem>
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button 
                                    type="button"
                                    variant="ghost" 
                                    className="mt-8 text-indigo-600 font-black tracking-widest text-xs uppercase hover:bg-indigo-50"
                                    onClick={() => window.open('/amenities', '_blank')}
                                >
                                    Define More Luxuries
                                </Button>
                            </div>
                        </section>

                        <div className="flex items-center justify-between pt-12 border-t border-indigo-100/30">
                            <FormField
                                control={form.control}
                                name="is_active"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-5 bg-indigo-50/30 p-5 rounded-[20px] border border-indigo-100/50 pr-10">
                                        <FormControl>
                                            <Switch
                                                checked={!!field.value}
                                                onCheckedChange={field.onChange}
                                                className="data-[state=checked]:bg-emerald-500 scale-125"
                                            />
                                        </FormControl>
                                        <div className="space-y-0.5">
                                            <FormLabel className="font-black text-indigo-950 uppercase text-xs tracking-widest">Experience Status</FormLabel>
                                            <FormDescription className="text-indigo-400 text-xs font-medium">Live on the high-fidelity engine</FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <div className="flex gap-6">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={() => onOpenChange(false)}
                                    className="rounded-[20px] text-indigo-900/50 font-bold px-10 h-16 hover:text-indigo-950 transition-colors"
                                >
                                    Discard
                                </Button>
                                <Button 
                                    type="submit" 
                                    disabled={form.formState.isSubmitting}
                                    className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 hover:scale-[1.03] active:scale-[0.97] text-white font-extrabold rounded-[24px] px-12 h-16 shadow-[0_20px_40px_rgba(79,70,229,0.3)] transition-all duration-300 ease-out flex gap-3"
                                >
                                    {form.formState.isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
                                    <span className="tracking-tight text-lg">
                                        {isEditing ? 'Finalize Experience' : 'Deploy Room Concept'}
                                    </span>
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
