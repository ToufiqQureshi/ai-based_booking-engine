import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

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
import { apiClient } from '@/api/client';
import { RoomType, Amenity, RoomPhoto, RoomAmenity } from '@/types/api';
import { useToast } from '@/hooks/use-toast';
import { RoomImageUploader } from './RoomImageUploader';

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
            market_price: undefined,
            is_active: true,
        },
    });

    const [availableAmenities, setAvailableAmenities] = useState<Amenity[]>([]);

    useEffect(() => {
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
                    market_price: initialData.market_price,
                    amenity_ids: (initialData.amenities as RoomAmenity[])?.map(a => a.id) || [],
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
            <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl">
                {/* Header */}
                <DialogHeader className="px-6 py-5 border-b bg-white">
                    <DialogTitle className="text-xl font-bold">
                        {isEditing ? 'Edit Room Type' : 'Add New Room Type'}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        {isEditing ? 'Update room details and settings.' : 'Create a new room category for your hotel.'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
                            <TabsList className="grid grid-cols-4 mx-6 mt-4 mb-2 h-10 rounded-xl bg-muted/60">
                                <TabsTrigger value="basic" className="rounded-lg text-xs font-semibold">Basic Info</TabsTrigger>
                                <TabsTrigger value="photos" className="rounded-lg text-xs font-semibold">Photos</TabsTrigger>
                                <TabsTrigger value="pricing" className="rounded-lg text-xs font-semibold">Pricing</TabsTrigger>
                                <TabsTrigger value="amenities" className="rounded-lg text-xs font-semibold">Amenities</TabsTrigger>
                            </TabsList>

                            {/* ── TAB 1: BASIC INFO ── */}
                            <TabsContent value="basic" className="flex-1 overflow-y-auto px-6 pb-4 space-y-5 mt-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                                    {/* Room Name */}
                                    <div className="md:col-span-2">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Room Name *</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g. Deluxe King Room" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {/* Description */}
                                    <div className="md:col-span-2">
                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Description</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Describe the room features and highlights..."
                                                            className="min-h-[100px] resize-none"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {/* Bed Type */}
                                    <FormField
                                        control={form.control}
                                        name="bed_type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Bed Type</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select bed type" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
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

                                    {/* Room Size */}
                                    <FormField
                                        control={form.control}
                                        name="room_size"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Room Size (sq ft)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" placeholder="e.g. 300" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* View */}
                                    <FormField
                                        control={form.control}
                                        name="view"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Room View</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select view type" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
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

                                    {/* Floor */}
                                    <FormField
                                        control={form.control}
                                        name="floor"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Floor / Level</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Ground Floor, 2nd Floor" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Toggles Row */}
                                    <div className="md:col-span-2 flex flex-wrap gap-4 pt-2">
                                        <FormField
                                            control={form.control}
                                            name="smoking_allowed"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center space-x-3 space-y-0 border rounded-xl px-4 py-3 flex-1 min-w-[180px]">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-medium cursor-pointer">Smoking Allowed</FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="is_pet_friendly"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center space-x-3 space-y-0 border rounded-xl px-4 py-3 flex-1 min-w-[180px]">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-medium cursor-pointer">Pet Friendly</FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="extra_bed_allowed"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center space-x-3 space-y-0 border rounded-xl px-4 py-3 flex-1 min-w-[180px]">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-medium cursor-pointer">Extra Bed Allowed</FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </TabsContent>

                            {/* ── TAB 2: PHOTOS ── */}
                            <TabsContent value="photos" className="flex-1 overflow-y-auto px-6 pb-4 mt-0">
                                <div className="pt-4">
                                    <FormField
                                        control={form.control}
                                        name="photos"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-base font-semibold">Room Photos</FormLabel>
                                                <FormDescription>Upload photos for this room. First photo will be shown as the main image.</FormDescription>
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
                            </TabsContent>

                            {/* ── TAB 3: PRICING & OCCUPANCY ── */}
                            <TabsContent value="pricing" className="flex-1 overflow-y-auto px-6 pb-4 mt-0">
                                <div className="space-y-6 pt-4">
                                    {/* Pricing */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Pricing</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                            <FormField
                                                control={form.control}
                                                name="base_price"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Base Price (₹) *</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} />
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
                                                        <FormLabel>Market Price (₹)</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                placeholder="Strike-through price"
                                                                {...field}
                                                                value={field.value ?? ''}
                                                            />
                                                        </FormControl>
                                                        <FormDescription className="text-xs">Shown as crossed-out price</FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="total_inventory"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Total Rooms *</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {/* Occupancy */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Occupancy</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                            <FormField
                                                control={form.control}
                                                name="base_occupancy"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Base Guests</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} />
                                                        </FormControl>
                                                        <FormDescription className="text-xs">Included in base price</FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="max_occupancy"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Max Adults</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} />
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
                                                        <FormLabel>Max Children</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {/* Extra Charges */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Extra Guest Charges</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <FormField
                                                control={form.control}
                                                name="extra_adult_price"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Extra Adult Charge (₹)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} />
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
                                                        <FormLabel>Extra Child Charge (₹)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* ── TAB 4: AMENITIES ── */}
                            <TabsContent value="amenities" className="flex-1 overflow-y-auto px-6 pb-4 mt-0">
                                <div className="pt-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Room Amenities</h3>
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
                                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 border rounded-xl p-3 hover:bg-muted/40 cursor-pointer transition-colors">
                                                                    <FormControl>
                                                                        <Checkbox
                                                                            checked={field.value?.includes(amenity.id)}
                                                                            onCheckedChange={(checked) => {
                                                                                return checked
                                                                                    ? field.onChange([...field.value, amenity.id])
                                                                                    : field.onChange(field.value?.filter(val => val !== amenity.id));
                                                                            }}
                                                                        />
                                                                    </FormControl>
                                                                    <FormLabel className="font-medium text-sm cursor-pointer flex items-center gap-2">
                                                                        {amenity.name}
                                                                        {amenity.is_featured && <Badge className="bg-amber-100 text-amber-700 text-[9px] h-4 border-none">Featured</Badge>}
                                                                    </FormLabel>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                                {availableAmenities.filter(a => a.scope === 'room').length === 0 && (
                                                    <p className="text-sm text-muted-foreground text-center py-8">
                                                        No room amenities found. <a href="/amenities" target="_blank" className="text-primary underline">Add amenities</a> first.
                                                    </p>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-6 py-4 border-t bg-white gap-4 shrink-0">
                            <FormField
                                control={form.control}
                                name="is_active"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <Switch
                                                checked={!!field.value}
                                                onCheckedChange={field.onChange}
                                                className="data-[state=checked]:bg-green-500"
                                            />
                                        </FormControl>
                                        <div>
                                            <FormLabel className="font-semibold text-sm">Active</FormLabel>
                                            <FormDescription className="text-xs">Show this room in booking engine</FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                    className="px-6"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={form.formState.isSubmitting}
                                    className="px-8 bg-indigo-600 hover:bg-indigo-700"
                                >
                                    {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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
