import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Ruler, BedDouble } from 'lucide-react';

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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient } from '@/api/client';
import { RoomType, Amenity, RoomPhoto } from '@/types/api';
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
        is_primary: z.boolean(),
        order: z.number(),
    })).default([]),
    amenity_ids: z.array(z.string()).default([]),
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
                    // Map existing Linked Amenities to IDs
                    // If backend sends 'amenities' as objects, we map them to IDs
                    amenity_ids: initialData.amenities?.map(a => a.id) || [],
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
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit Room Type' : 'Add Room Type'}</DialogTitle>
                    <DialogDescription>
                        {isEditing ? 'Modify existing room details.' : 'Create a new room category for your hotel.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Basic Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel>Room Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Deluxe Suite" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Room amenities and details..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Room Specifics */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Room Specifics</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="bed_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Bed Type</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                                    <SelectItem value="Studio">Studio</SelectItem>
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
                                            <FormLabel>Room Size (sq ft)</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Ruler className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input type="number" className="pl-8" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <FormField
                                    control={form.control}
                                    name="view"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Room View</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select view" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Garden View">Garden View</SelectItem>
                                                    <SelectItem value="Pool View">Pool View</SelectItem>
                                                    <SelectItem value="Sea View">Sea View</SelectItem>
                                                    <SelectItem value="City View">City View</SelectItem>
                                                    <SelectItem value="Mountain View">Mountain View</SelectItem>
                                                    <SelectItem value="Courtyard View">Courtyard View</SelectItem>
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
                                            <FormLabel>Floor / Level</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. 1st Floor, Penthouse" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <FormField
                                    control={form.control}
                                    name="smoking_allowed"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel className="text-xs">Smoking Allowed</FormLabel>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="is_pet_friendly"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel className="text-xs">Pet Friendly</FormLabel>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Images */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Room Photos</h3>
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

                        {/* Amenities Selection */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="text-sm font-medium text-muted-foreground">Room Amenities</h3>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 text-[10px] uppercase font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => window.open('/amenities', '_blank')}
                                >
                                    Manage Library
                                </Button>
                            </div>
                            <FormField
                                control={form.control}
                                name="amenity_ids"
                                render={() => (
                                    <FormItem>
                                        <div className="mb-4">
                                            <FormLabel className="text-base font-bold">Select Room Features</FormLabel>
                                            <DialogDescription className="text-xs">
                                                Choose which amenities are available specifically for this room type.
                                            </DialogDescription>
                                        </div>
                                        {availableAmenities.filter(a => a.scope === 'room').length > 0 ? (
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {availableAmenities.filter(a => a.scope === 'room').map((amenity) => (
                                                    <FormField
                                                        key={amenity.id}
                                                        control={form.control}
                                                        name="amenity_ids"
                                                        render={({ field }) => {
                                                            return (
                                                                <FormItem
                                                                    key={amenity.id}
                                                                    className="flex flex-row items-start space-x-3 space-y-0 p-2 rounded-lg border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all"
                                                                >
                                                                    <FormControl>
                                                                        <Checkbox
                                                                            checked={field.value?.includes(amenity.id)}
                                                                            onCheckedChange={(checked) => {
                                                                                return checked
                                                                                    ? field.onChange([...field.value, amenity.id])
                                                                                    : field.onChange(
                                                                                        field.value?.filter(
                                                                                            (value) => value !== amenity.id
                                                                                        )
                                                                                    )
                                                                            }}
                                                                        />
                                                                    </FormControl>
                                                                    <FormLabel className="font-medium text-sm cursor-pointer flex items-center gap-2">
                                                                        {amenity.name}
                                                                        {amenity.is_featured && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[8px] h-3.5 uppercase px-1">Featured</Badge>}
                                                                    </FormLabel>
                                                                </FormItem>
                                                            )
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 border-2 border-dashed rounded-xl bg-slate-50/50">
                                                <p className="text-sm text-slate-500 mb-3">No room-level amenities found.</p>
                                                <Button 
                                                    type="button"
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => window.location.href = '/amenities'}
                                                >
                                                    Go to Amenities Manager
                                                </Button>
                                            </div>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Capacity & Pricing */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Capacity & Pricing</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="base_price"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Base Price (₹)</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <p className="text-[10px] text-muted-foreground">Standard room rate for base occupancy.</p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="total_inventory"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Total Number of Rooms</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Guest Capacity */}
                            <div className="bg-muted/30 p-4 rounded-lg space-y-4">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <BedDouble className="h-4 w-4" /> Guest Capacity & Extra Charges
                                </h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="base_occupancy"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Includes Guests</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <p className="text-[10px] text-muted-foreground">Adults included in base price.</p>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="max_occupancy"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Max Guests</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <p className="text-[10px] text-muted-foreground">Total capacity of room.</p>
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
                                                <p className="text-[10px] text-muted-foreground">Limit for children (0-12 yrs).</p>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                    <FormField
                                        control={form.control}
                                        name="extra_adult_price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Extra Adult Price (₹)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <p className="text-[10px] text-muted-foreground">Charge per extra adult.</p>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="extra_child_price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Extra Child Price (₹)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <p className="text-[10px] text-muted-foreground">Charge per extra child.</p>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                            <FormField
                                control={form.control}
                                name="extra_bed_allowed"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>
                                                Extra Bed Allowed
                                            </FormLabel>
                                        </div>
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
                                {isEditing ? 'Save Changes' : 'Create Room'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog >
    );
}
