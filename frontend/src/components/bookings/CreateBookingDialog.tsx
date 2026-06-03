import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, differenceInDays, addDays } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';

const BOOKING_SOURCES = [
    { value: 'walk_in',     label: '🚶 Walk-in',              color: 'bg-orange-100 text-orange-700' },
    { value: 'phone',       label: '📞 Phone Call',            color: 'bg-blue-100 text-blue-700' },
    { value: 'online',      label: '🌐 Hotel Website (Online)', color: 'bg-green-100 text-green-700' },
    { value: 'booking_com', label: '🏨 Booking.com',           color: 'bg-indigo-100 text-indigo-700' },
    { value: 'agoda',       label: '🔵 Agoda',                 color: 'bg-purple-100 text-purple-700' },
    { value: 'airbnb',      label: '🏠 Airbnb',                color: 'bg-pink-100 text-pink-700' },
    { value: 'goibibo',     label: '✈️ Goibibo',               color: 'bg-red-100 text-red-700' },
    { value: 'makemytrip',  label: '🎒 MakeMyTrip',            color: 'bg-yellow-100 text-yellow-700' },
    { value: 'travel_agent',label: '🤝 Travel Agent',          color: 'bg-teal-100 text-teal-700' },
    { value: 'corporate',   label: '💼 Corporate / B2B',       color: 'bg-slate-100 text-slate-700' },
    { value: 'whatsapp',    label: '💬 WhatsApp / Social',     color: 'bg-emerald-100 text-emerald-700' },
    { value: 'manual',      label: '✏️ Manual / Other',        color: 'bg-gray-100 text-gray-700' },
];

const formSchema = z.object({
    firstName: z.string().min(2, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(7, 'Phone number required'),
    roomTypeId: z.string().min(1, 'Room type is required'),
    checkIn: z.date(),
    checkOut: z.date(),
    pricePerNight: z.coerce.number().min(0, 'Price must be positive'),
    source: z.string().min(1, 'Booking source is required'),
    specialRequests: z.string().optional(),
});

interface RoomType {
    id: string;
    name: string;
    base_price: number;
}

interface CreateBookingDialogProps {
    onSuccess: () => void;
}

export function CreateBookingDialog({ onSuccess }: CreateBookingDialogProps) {
    const { hotel, user } = useAuth();
    const isLocked = hotel?.feature_new_booking === false && user?.role !== 'SUPER_ADMIN';
    const [open, setOpen] = useState(false);
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            checkIn: new Date(),
            checkOut: addDays(new Date(), 1),
            pricePerNight: 0,
            source: 'walk_in',
            specialRequests: '',
        },
    });

    useEffect(() => {
        if (open) {
            apiClient.get<RoomType[]>('/rooms').then(setRoomTypes).catch(console.error);
        }
    }, [open]);

    const handleRoomTypeChange = (id: string) => {
        const room = roomTypes.find(r => r.id === id);
        if (room) {
            form.setValue('pricePerNight', room.base_price);
        }
        form.setValue('roomTypeId', id);
    };

    const selectedSource = BOOKING_SOURCES.find(s => s.value === form.watch('source'));

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            const nights = differenceInDays(values.checkOut, values.checkIn);
            if (nights < 1) {
                form.setError('checkOut', { message: 'Check-out must be after check-in' });
                return;
            }

            const selectedRoom = roomTypes.find(r => r.id === values.roomTypeId);

            const payload = {
                check_in: format(values.checkIn, 'yyyy-MM-dd'),
                check_out: format(values.checkOut, 'yyyy-MM-dd'),
                guest: {
                    first_name: values.firstName,
                    last_name: values.lastName,
                    email: values.email,
                    phone: values.phone,
                },
                rooms: [
                    {
                        room_type_id: values.roomTypeId,
                        room_type_name: selectedRoom?.name || 'Unknown',
                        guests: 2,
                        price_per_night: values.pricePerNight,
                        total_price: values.pricePerNight * nights,
                    }
                ],
                source: values.source,
                special_requests: values.specialRequests || '',
            };

            await apiClient.post('/bookings', payload);

            toast({
                title: '✅ Booking Created',
                description: `Booking for ${values.firstName} created via ${selectedSource?.label || values.source}.`,
            });
            setOpen(false);
            form.reset();
            onSuccess();
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Failed to create booking',
                description: 'Please check all fields and try again.',
            });
        }
    };

    if (isLocked) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="relative">
                            <Button className="gap-2 bg-indigo-600/60 hover:bg-indigo-600/60 text-white/80 cursor-not-allowed border border-indigo-400/20 backdrop-blur-sm shadow-none">
                                <Lock className="h-4 w-4 text-white/80" />
                                New Booking
                            </Button>
                            <div className="absolute -inset-0.5 rounded-lg bg-white/30 dark:bg-slate-950/30 backdrop-blur-[2px] flex items-center justify-center border border-white/20" />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 border border-slate-800 text-white rounded-xl p-3 shadow-xl max-w-xs">
                        <div className="flex items-start gap-2.5">
                            <Lock className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-bold text-xs text-slate-100">Premium Feature Locked</p>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                                    Manual booking creations are locked. Please contact your Super Admin to upgrade your subscription plan.
                                </p>
                            </div>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Booking
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Booking</DialogTitle>
                    <DialogDescription>
                        Enter guest details, room selection, and booking source.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        {/* Guest Name */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="firstName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>First Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="John" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="lastName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Last Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Doe" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Email & Phone */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input placeholder="john@example.com" type="email" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+91 98765 43210" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Booking Source */}
                        <FormField
                            control={form.control}
                            name="source"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Booking Source</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="How did the guest book?" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {BOOKING_SOURCES.map(src => (
                                                <SelectItem key={src.value} value={src.value}>
                                                    {src.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedSource && (
                                        <div className="mt-1">
                                            <Badge className={cn('text-xs font-medium border-0', selectedSource.color)}>
                                                Source: {selectedSource.label}
                                            </Badge>
                                        </div>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Room Type */}
                        <FormField
                            control={form.control}
                            name="roomTypeId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Room Type</FormLabel>
                                    <Select onValueChange={handleRoomTypeChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a room" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {roomTypes.map((room) => (
                                                <SelectItem key={room.id} value={room.id}>
                                                    {room.name} — ₹{room.base_price.toLocaleString('en-IN')}/night
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="checkIn"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Check-in</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="checkOut"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Check-out</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) => date <= form.getValues('checkIn')}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Price */}
                        <FormField
                            control={form.control}
                            name="pricePerNight"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Price Per Night (₹)</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormDescription>Override standard rate if needed</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Special Requests */}
                        <FormField
                            control={form.control}
                            name="specialRequests"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Special Requests <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Early check-in, extra bed..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    'Create Booking'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
