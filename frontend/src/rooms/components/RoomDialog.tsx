import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Info, Image as ImageIcon, DollarSign, ListChecks, Check, Sparkles, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { apiClient } from '@/core/api/client';
import { RoomType, Amenity, RoomPhoto, RoomAmenity, RatePlan } from '@/core/types/api';
import { useToast } from '@/core/hooks/use-toast';
import { RoomImageUploader } from './RoomImageUploader';
import { VideoUploader, MediaVideo } from '@/components/common/VideoUploader';
import { cn } from '@/core/lib/utils';

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
    videos: z.array(z.object({
        id: z.string().optional(),
        url: z.string(),
        type: z.string().optional(),
        mime: z.string().optional(),
    })).max(2, 'A room can have at most 2 videos').default([]),
    amenity_ids: z.array(z.string()).default([]),
    market_price: z.coerce.number().min(0).optional().nullable(),
    cancellation_policy: z.string().optional(),
    rate_plan_overrides: z.record(z.any()).optional().nullable(),
    is_active: z.boolean().default(true),
}).refine(data => data.max_occupancy >= data.base_occupancy, {
    message: 'Max adults must be ≥ base occupancy',
    path: ['max_occupancy'],
});

interface RoomDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    initialData?: RoomType | null;
}

export function RoomDialog({ open, onOpenChange, onSuccess, initialData }: RoomDialogProps) {
    const navigate = useNavigate();
    const { toast } = useToast();
    const isEditing = !!initialData;
    const [activeTab, setActiveTab] = useState('basic');


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
            extra_adult_price: 0,
            extra_child_price: 0,
            bed_type: '',
            room_size: undefined,
            view: '',
            floor: '',
            smoking_allowed: false,
            is_pet_friendly: false,
            photos: [],
            videos: [],
            amenity_ids: [],
            market_price: undefined,
            cancellation_policy: '',
            rate_plan_overrides: {},
            is_active: true,
        },
    });

    const [availableAmenities, setAvailableAmenities] = useState<Amenity[]>([]);
    const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [amenitiesData, ratesData] = await Promise.all([
                    apiClient.get<Amenity[]>('/amenities'),
                    apiClient.get<RatePlan[]>('/rates/plans'),
                ]);
                setAvailableAmenities(amenitiesData);
                setRatePlans(ratesData);
            } catch (e) {
                console.error("Failed to load room dialog data", e);
            }
        };
        if (open) loadData();
    }, [open]);

    useEffect(() => {
        if (open) {
            setActiveTab('basic');
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
                    extra_person_price: initialData.extra_person_price || 0,
                    extra_adult_price: initialData.extra_adult_price || 0,
                    extra_child_price: initialData.extra_child_price || 0,
                    bed_type: initialData.bed_type || '',
                    room_size: initialData.room_size,
                    view: initialData.view || '',
                    floor: initialData.floor || '',
                    smoking_allowed: initialData.smoking_allowed || false,
                    is_pet_friendly: initialData.is_pet_friendly || false,
                    photos: initialData.photos || [],
                    videos: initialData.videos || [],
                    market_price: initialData.market_price,
                    cancellation_policy: initialData.cancellation_policy || '',
                    amenity_ids: (initialData.amenities as RoomAmenity[])?.map(a => a.id) || [],
                    rate_plan_overrides: initialData.rate_plan_overrides || {},
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
                    extra_person_price: 0,
                    extra_adult_price: 0,
                    extra_child_price: 0,
                    bed_type: '',
                    room_size: undefined,
                    view: '',
                    floor: '',
                    smoking_allowed: false,
                    is_pet_friendly: false,
                    photos: [],
                    videos: [],
                    amenity_ids: [],
                    market_price: undefined,
                    cancellation_policy: '',
                    rate_plan_overrides: {},
                    is_active: true,
                });
            }
        }
    }, [open, initialData, form]);

    const handleToggleOverride = (planId: string, enabled: boolean, defaultPlanSettings: RatePlan) => {
        const currentOverrides = { ...(form.getValues('rate_plan_overrides') || {}) };
        if (enabled) {
            currentOverrides[planId] = {
                is_active: true,
                is_refundable: defaultPlanSettings.is_refundable,
                cancellation_hours: defaultPlanSettings.cancellation_hours ?? 24
            };
        } else {
            delete currentOverrides[planId];
        }
        form.setValue('rate_plan_overrides', currentOverrides, { shouldDirty: true });
    };

    const handleUpdateOverride = (planId: string, field: string, value: any) => {
        const currentOverrides = { ...(form.getValues('rate_plan_overrides') || {}) };
        if (!currentOverrides[planId]) {
            currentOverrides[planId] = { is_active: true, is_refundable: true, cancellation_hours: 24 };
        }
        currentOverrides[planId] = {
            ...currentOverrides[planId],
            [field]: value
        };
        form.setValue('rate_plan_overrides', currentOverrides, { shouldDirty: true });
    };

    const onSubmit = async (values: z.infer<typeof roomSchema>) => {
        try {
            if (isEditing && initialData) {
                await apiClient.patch(`/rooms/${initialData.id}`, values);
                toast({ title: 'Success', description: 'Room details updated successfully.' });
            } else {
                await apiClient.post('/rooms', values);
                toast({ title: 'Success', description: 'New room type added successfully.' });
            }
            onOpenChange(false);
            onSuccess();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to save room details.',
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-none shadow-2xl rounded-2xl bg-background">
                {/* Header */}
                <div className="px-8 py-6 border-b border-border bg-muted/40">
                    <DialogTitle className="text-2xl font-bold text-foreground">
                        {isEditing ? 'Edit Room Type' : 'Add New Room Type'}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground mt-1">
                        {isEditing ? 'Update your room category details and inventory.' : 'Define a new room category for your property.'}
                    </DialogDescription>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
                            <div className="px-8 pt-4">
                                <TabsList className="grid grid-cols-5 w-full h-11 bg-muted/60 p-1 rounded-xl">
                                    <TabsTrigger value="basic" className="rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                        <Info className="w-3.5 h-3.5 mr-2" /> Basic Info
                                    </TabsTrigger>
                                    <TabsTrigger value="photos" className="rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                        <ImageIcon className="w-3.5 h-3.5 mr-2" /> Photos
                                    </TabsTrigger>
                                    <TabsTrigger value="pricing" className="rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                        <DollarSign className="w-3.5 h-3.5 mr-2" /> Pricing
                                    </TabsTrigger>
                                    <TabsTrigger value="amenities" className="rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                        <ListChecks className="w-3.5 h-3.5 mr-2" /> Amenities
                                    </TabsTrigger>
                                    <TabsTrigger value="rates" className="rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                        <SlidersHorizontal className="w-3.5 h-3.5 mr-2" /> Rate Settings
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* ── TAB 1: BASIC INFO ── */}
                            <TabsContent value="basic" className="flex-1 overflow-y-auto px-8 pb-8 space-y-6 mt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Room Category Name *</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g. Deluxe Balcony Room" className="h-11 rounded-xl border-border focus-visible:ring-blue-600/10 focus-visible:border-blue-600" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Describe the room highlights (e.g. view, special features)..."
                                                            className="min-h-[100px] rounded-xl border-border focus-visible:ring-blue-600/10 focus-visible:border-blue-600 resize-none p-4"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>



                                    <FormField
                                        control={form.control}
                                        name="bed_type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Primary Bed Type</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-11 rounded-xl border-border">
                                                            <SelectValue placeholder="Select bed type" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="Single">Single Bed</SelectItem>
                                                        <SelectItem value="Double">Double Bed</SelectItem>
                                                        <SelectItem value="Queen">Queen Bed</SelectItem>
                                                        <SelectItem value="King">King Bed</SelectItem>
                                                        <SelectItem value="Twin">Twin Beds</SelectItem>
                                                        <SelectItem value="Bunk">Bunk Beds</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="room_size"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Room Area (sq ft)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input type="number" placeholder="e.g. 300" className="h-11 rounded-xl border-border pr-12" {...field} />
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">SQ FT</span>
                                                    </div>
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
                                                <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">View from Room</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-11 rounded-xl border-border">
                                                            <SelectValue placeholder="Select view" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="Garden View">Garden View</SelectItem>
                                                        <SelectItem value="Sea View">Sea View</SelectItem>
                                                        <SelectItem value="City View">City View</SelectItem>
                                                        <SelectItem value="Pool View">Pool View</SelectItem>
                                                        <SelectItem value="Mountain View">Mountain View</SelectItem>
                                                        <SelectItem value="No View">No Specific View</SelectItem>
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
                                                <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Floor Level</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. 1st Floor, Top Floor" className="h-11 rounded-xl border-border" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />


                                </div>
                            </TabsContent>

                            {/* ── TAB 2: PHOTOS ── */}
                            <TabsContent value="photos" className="flex-1 overflow-y-auto px-8 pb-8 mt-6">
                                <FormField
                                    control={form.control}
                                    name="photos"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="mb-6">
                                                <h3 className="text-sm font-bold text-foreground mb-1">Room Gallery</h3>
                                                <p className="text-xs text-muted-foreground">Upload high-quality photos of the room. The first photo will be your cover image.</p>
                                            </div>
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

                                <FormField
                                    control={form.control}
                                    name="videos"
                                    render={({ field }) => (
                                        <FormItem className="mt-8">
                                            <div className="mb-4">
                                                <h3 className="text-sm font-bold text-foreground mb-1">Room Videos</h3>
                                                <p className="text-xs text-muted-foreground">Optional short walkthrough clips (MP4/WebM, up to 2). Shown to guests alongside the photos.</p>
                                            </div>
                                            <FormControl>
                                                <VideoUploader
                                                    videos={(field.value as MediaVideo[]) || []}
                                                    onChange={field.onChange}
                                                    max={2}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>

                            {/* ── TAB 3: PRICING & OCCUPANCY ── */}
                            <TabsContent value="pricing" className="flex-1 overflow-y-auto px-8 pb-8 mt-6">
                                <div className="space-y-8">
                                    <div className="p-6 rounded-2xl bg-blue-50/30 border border-blue-100">
                                        <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-5">Standard Pricing & Inventory</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="base_price"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Room Rate (Base) *</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                                                                <Input type="number" className="h-11 rounded-xl border-border pl-7" {...field} />
                                                            </div>
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
                                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Original Price (MRP)</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                                                                <Input type="number" placeholder="Optional..." className="h-11 rounded-xl border-border pl-7" {...field} value={field.value ?? ''} />
                                                            </div>
                                                        </FormControl>
                                                        <FormDescription className="text-[10px]">For strike-through display</FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="total_inventory"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Rooms *</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" className="h-11 rounded-xl border-border" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-2xl bg-muted/40 border border-border">
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-5">Occupancy Settings</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="base_occupancy"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Base Guests</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" className="h-11 rounded-xl border-border" {...field} />
                                                        </FormControl>
                                                        <FormDescription className="text-[10px]">Included in base rate</FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="max_occupancy"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Max Adults</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" className="h-11 rounded-xl border-border" {...field} />
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
                                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Max Children</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" className="h-11 rounded-xl border-border" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 px-2">Extra Charges (Per Night)</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="extra_adult_price"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Extra Adult (₹)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" className="h-11 rounded-xl border-border" {...field} />
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
                                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Extra Child (₹)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" className="h-11 rounded-xl border-border" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="extra_person_price"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Extra Person (₹)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" className="h-11 rounded-xl border-border" {...field} />
                                                        </FormControl>
                                                        <FormDescription className="text-[10px]">General extra person charge</FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-2xl bg-muted/40 border border-border">
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-5">Room Policies</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="smoking_allowed"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border p-4 bg-background">
                                                        <div className="space-y-0.5">
                                                            <FormLabel className="text-xs font-bold text-foreground">Smoking Allowed</FormLabel>
                                                            <FormDescription className="text-[10px]">Guests may smoke in room</FormDescription>
                                                        </div>
                                                        <FormControl>
                                                            <Switch
                                                                checked={!!field.value}
                                                                onCheckedChange={field.onChange}
                                                                className="data-[state=checked]:bg-blue-600"
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="is_pet_friendly"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border p-4 bg-background">
                                                        <div className="space-y-0.5">
                                                            <FormLabel className="text-xs font-bold text-foreground">Pet Friendly</FormLabel>
                                                            <FormDescription className="text-[10px]">Pets are welcome</FormDescription>
                                                        </div>
                                                        <FormControl>
                                                            <Switch
                                                                checked={!!field.value}
                                                                onCheckedChange={field.onChange}
                                                                className="data-[state=checked]:bg-blue-600"
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="extra_bed_allowed"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border p-4 bg-background">
                                                        <div className="space-y-0.5">
                                                            <FormLabel className="text-xs font-bold text-foreground">Extra Bed Allowed</FormLabel>
                                                            <FormDescription className="text-[10px]">Additional bed can be added</FormDescription>
                                                        </div>
                                                        <FormControl>
                                                            <Switch
                                                                checked={!!field.value}
                                                                onCheckedChange={field.onChange}
                                                                className="data-[state=checked]:bg-blue-600"
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="mt-6">
                                            <FormField
                                                control={form.control}
                                                name="cancellation_policy"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cancellation Policy</FormLabel>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="e.g. Free cancellation up to 24 hours before check-in. No refund thereafter."
                                                                className="min-h-[80px] rounded-xl border-border focus-visible:ring-blue-600/10 focus-visible:border-blue-600 resize-none p-4"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormDescription className="text-[10px]">Optional room-specific cancellation text shown to guests</FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* ── TAB 4: AMENITIES ── */}
                            <TabsContent value="amenities" className="flex-1 overflow-y-auto px-8 pb-8 mt-6">
                                <FormField
                                    control={form.control}
                                    name="amenity_ids"
                                    render={() => (
                                        <FormItem>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                {availableAmenities.filter(a => a.scope === 'room').map((amenity) => (
                                                    <FormField
                                                        key={amenity.id}
                                                        control={form.control}
                                                        name="amenity_ids"
                                                        render={({ field }) => (
                                                            <FormItem className={cn(
                                                                "flex flex-row items-center space-x-3 space-y-0 border rounded-xl p-3.5 cursor-pointer transition-all hover:border-blue-200 dark:hover:border-blue-800",
                                                                field.value?.includes(amenity.id) 
                                                                    ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60" 
                                                                    : "bg-muted/30 dark:bg-muted/10 border-border"
                                                            )}>
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={field.value?.includes(amenity.id)}
                                                                        onCheckedChange={(checked) => {
                                                                            return checked
                                                                                ? field.onChange([...field.value, amenity.id])
                                                                                : field.onChange(field.value?.filter(val => val !== amenity.id));
                                                                        }}
                                                                        className="rounded-md border-slate-300"
                                                                    />
                                                                </FormControl>
                                                                <FormLabel className="font-bold text-xs text-foreground cursor-pointer flex items-center gap-2">
                                                                    {amenity.name}
                                                                    {amenity.is_featured && <Sparkles className="w-3 h-3 text-amber-500" />}
                                                                </FormLabel>
                                                            </FormItem>
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                            {availableAmenities.filter(a => a.scope === 'room').length === 0 && (
                                                <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border">
                                                    <p className="text-sm text-muted-foreground font-medium">No amenities available.</p>
                                                    <Button variant="link" className="text-blue-600 font-bold" onClick={() => navigate('/amenities')}>Add Amenities</Button>
                                                </div>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>

                            {/* ── TAB 5: RATE PLAN OVERRIDES ── */}
                            <TabsContent value="rates" className="flex-1 overflow-y-auto px-8 pb-8 mt-6">
                                <div className="space-y-6">
                                    <div className="mb-6">
                                        <h3 className="text-sm font-bold text-foreground mb-1">Custom Rate Settings</h3>
                                        <p className="text-xs text-muted-foreground">
                                            Configure room-specific cancellation policies, refundability, or active status for each rate plan. Left unmodified, the global rate plan settings will apply.
                                        </p>
                                    </div>

                                    {ratePlans.length === 0 ? (
                                        <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border">
                                            <p className="text-sm text-muted-foreground font-medium">No rate plans found.</p>
                                            <Button type="button" variant="link" className="text-blue-600 font-bold" onClick={() => navigate('/finance/rates')}>
                                                Manage Rate Plans
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {ratePlans.map((plan) => {
                                                const currentOverrides = form.watch('rate_plan_overrides') || {};
                                                const hasOverride = !!currentOverrides[plan.id];
                                                const overrideVal = currentOverrides[plan.id] || {};
                                                
                                                const isActive = hasOverride ? (overrideVal.is_active ?? true) : plan.is_active;
                                                const isRefundable = hasOverride ? (overrideVal.is_refundable ?? false) : plan.is_refundable;
                                                const cancellationHours = hasOverride ? (overrideVal.cancellation_hours ?? 24) : (plan.cancellation_hours ?? 24);

                                                return (
                                                    <div 
                                                        key={plan.id}
                                                        className={cn(
                                                            "p-5 rounded-2xl border transition-all duration-200 bg-background",
                                                            hasOverride ? "border-indigo-200 ring-1 ring-indigo-50/50" : "border-border hover:border-slate-300"
                                                        )}
                                                    >
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="text-sm font-bold text-foreground">{plan.name}</h4>
                                                                    <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-semibold bg-muted/40 uppercase">
                                                                        {plan.meal_plan}
                                                                    </Badge>
                                                                    {plan.is_package && (
                                                                        <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/25 border-emerald-500/20 py-0.5 px-2 font-semibold">
                                                                            Package
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    Default: {plan.is_refundable ? `Refundable (${plan.cancellation_hours}h)` : "Non-refundable"} | Global Status: {plan.is_active ? "Active" : "Inactive"}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xs font-bold text-muted-foreground">Override</span>
                                                                <Switch 
                                                                    type="button"
                                                                    checked={hasOverride}
                                                                    onCheckedChange={(checked) => handleToggleOverride(plan.id, checked, plan)}
                                                                    className="data-[state=checked]:bg-indigo-600"
                                                                />
                                                            </div>
                                                        </div>

                                                        {hasOverride && (
                                                            <div className="mt-4 pt-4 border-t border-dashed border-muted grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                                                <div className="flex flex-col gap-1.5 justify-center">
                                                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Plan Status</label>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <Switch 
                                                                            type="button"
                                                                            checked={isActive}
                                                                            onCheckedChange={(checked) => handleUpdateOverride(plan.id, 'is_active', checked)}
                                                                            className="data-[state=checked]:bg-indigo-600"
                                                                        />
                                                                        <span className="text-xs font-semibold text-foreground">
                                                                            {isActive ? "Available for booking" : "Hidden / Disabled"}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col gap-1.5 justify-center">
                                                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Refundability</label>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <Switch 
                                                                            type="button"
                                                                            checked={isRefundable}
                                                                            onCheckedChange={(checked) => handleUpdateOverride(plan.id, 'is_refundable', checked)}
                                                                            className="data-[state=checked]:bg-indigo-600"
                                                                            disabled={!isActive}
                                                                        />
                                                                        <span className="text-xs font-semibold text-foreground">
                                                                            {isRefundable ? "Refundable" : "Non-refundable"}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {isRefundable && isActive && (
                                                                    <div className="flex flex-col gap-1.5">
                                                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cancellation Window</label>
                                                                        <Select 
                                                                            value={String(cancellationHours)} 
                                                                            onValueChange={(val) => handleUpdateOverride(plan.id, 'cancellation_hours', Number(val))}
                                                                        >
                                                                            <SelectTrigger className="h-10 rounded-xl border-border bg-background">
                                                                                <SelectValue placeholder="Hours before check-in" />
                                                                            </SelectTrigger>
                                                                            <SelectContent className="rounded-xl">
                                                                                <SelectItem value="12">12 hours before check-in</SelectItem>
                                                                                <SelectItem value="24">24 hours before check-in</SelectItem>
                                                                                <SelectItem value="48">48 hours before check-in</SelectItem>
                                                                                <SelectItem value="72">72 hours before check-in</SelectItem>
                                                                                <SelectItem value="96">96 hours before check-in</SelectItem>
                                                                                <SelectItem value="120">5 days before check-in</SelectItem>
                                                                                <SelectItem value="168">7 days before check-in</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-8 py-5 border-t border-border bg-muted/40 gap-4 shrink-0">
                            <FormField
                                control={form.control}
                                name="is_active"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <Switch
                                                checked={!!field.value}
                                                onCheckedChange={field.onChange}
                                                className="data-[state=checked]:bg-blue-600"
                                            />
                                        </FormControl>
                                        <div className="flex flex-col">
                                            <FormLabel className="font-bold text-xs text-foreground">Online Status</FormLabel>
                                            <span className="text-[10px] text-muted-foreground font-medium">Visible to guests</span>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => onOpenChange(false)}
                                    className="px-6 font-bold text-muted-foreground"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={form.formState.isSubmitting}
                                    className="px-8 bg-blue-600 hover:bg-blue-700 h-11 rounded-xl font-bold shadow-lg shadow-blue-100 flex gap-2"
                                >
                                    {form.formState.isSubmitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Check className="h-4 w-4" />
                                    )}
                                    {isEditing ? 'Save Changes' : 'Create Room'}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
