import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, User, Mail, CreditCard, Bed, Clock, MessageSquare, CheckCircle, XCircle, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { apiClient } from '@/api/client';
import { useToast } from '@/hooks/use-toast';

interface BookingDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    booking: any;
    onStatusChange?: () => void;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' }> = {
    pending: { label: 'Pending', variant: 'outline' },
    confirmed: { label: 'Confirmed', variant: 'default' },
    checked_in: { label: 'Checked In', variant: 'secondary' },
    checked_out: { label: 'Checked Out', variant: 'secondary' },
    cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export function BookingDetailsDialog({ open, onOpenChange, booking, onStatusChange }: BookingDetailsDialogProps) {
    const { toast } = useToast();
    if (!booking) return null;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const status = statusConfig[booking.status] || { label: booking.status, variant: 'outline' };

    const handleStatusUpdate = async (newStatus: string) => {
        try {
            await apiClient.patch(`/bookings/${booking.id}`, { status: newStatus });
            onOpenChange(false);
            if (onStatusChange) onStatusChange();
            toast({ title: "Success", description: `Booking marked as ${newStatus}` });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update status" });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <div className="flex items-center justify-between mr-8">
                        <DialogTitle>Booking Details</DialogTitle>
                        <Badge variant={status.variant as any}>{status.label}</Badge>
                    </div>
                    <DialogDescription>
                        Reference: <span className="font-mono font-bold text-foreground">{booking.booking_number}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Guest Information */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <User className="h-4 w-4" /> Guest Information
                        </h4>
                        <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg">
                            <div>
                                <span className="text-xs text-muted-foreground">Name</span>
                                <p className="font-medium">{booking.guest?.first_name} {booking.guest?.last_name}</p>
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground">Email</span>
                                <p className="text-sm">{booking.guest?.email}</p>
                            </div>
                            {booking.guest?.phone && (
                                <div>
                                    <span className="text-xs text-muted-foreground">Phone</span>
                                    <p className="text-sm">{booking.guest?.phone}</p>
                                </div>
                            )}
                            {booking.guest?.nationality && (
                                <div>
                                    <span className="text-xs text-muted-foreground">Nationality</span>
                                    <p className="text-sm">{booking.guest?.nationality}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Stay Details */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> Stay Details
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 p-3 border rounded-lg">
                                <div className="bg-primary/10 p-2 rounded">
                                    <Clock className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Check In</p>
                                    <p className="font-medium">{booking.check_in ? format(new Date(booking.check_in), 'EEE, MMM d, yyyy') : 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 border rounded-lg">
                                <div className="bg-primary/10 p-2 rounded">
                                    <Clock className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Check Out</p>
                                    <p className="font-medium">{booking.check_out ? format(new Date(booking.check_out), 'EEE, MMM d, yyyy') : 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rooms */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Bed className="h-4 w-4" /> Rooms & Pricing
                        </h4>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted text-muted-foreground text-left">
                                    <tr>
                                        <th className="p-2 font-medium">Room Type</th>
                                        <th className="p-2 font-medium text-right">Price</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {booking.rooms?.map((room: any, i: number) => (
                                        <tr key={i}>
                                            <td className="p-2">{room.room_type_name}</td>
                                            <td className="p-2 text-right">{formatCurrency(room.total_price)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-muted/10 font-bold">
                                        <td className="p-2">Total Amount</td>
                                        <td className="p-2 text-right">{formatCurrency(booking.total_amount)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <Separator />

                    {/* Add-ons */}
                    {booking.addons && booking.addons.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <PlusCircle className="h-4 w-4" /> Add-ons
                            </h4>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted text-muted-foreground text-left">
                                        <tr>
                                            <th className="p-2 font-medium">Add-on Name</th>
                                            <th className="p-2 font-medium text-right">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {booking.addons.map((addon: any, i: number) => (
                                            <tr key={i}>
                                                <td className="p-2">{addon.name || addon.addon_name}</td>
                                                <td className="p-2 text-right">{formatCurrency(addon.price || addon.amount || addon.total_price)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Special Requests */}
                    {booking.special_requests && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" /> Special Requests
                            </h4>
                            <div className="bg-yellow-50 text-yellow-900 p-3 rounded-lg text-sm border border-yellow-100">
                                {booking.special_requests}
                            </div>
                        </div>
                    )}

                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    {/* Workflow Actions */}
                    {booking.status === 'pending' && (
                        <div className="flex w-full justify-between items-center">
                            <Button variant="destructive" onClick={() => handleStatusUpdate('cancelled')}>Reject / Cancel</Button>
                            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusUpdate('confirmed')}>Confirm Booking</Button>
                        </div>
                    )}

                    {booking.status === 'confirmed' && (
                        <div className="flex w-full justify-between items-center">
                            <Button variant="outline" className="text-red-500 hover:bg-red-50" onClick={() => handleStatusUpdate('cancelled')}>Cancel</Button>
                            <Button onClick={() => handleStatusUpdate('checked_in')}>Check In Guest</Button>
                        </div>
                    )}

                    {booking.status === 'checked_in' && (
                        <div className="flex w-full justify-end">
                            <Button onClick={() => handleStatusUpdate('checked_out')}>Check Out Quote</Button>
                        </div>
                    )}

                    {/* Read Only States */}
                    {(booking.status === 'cancelled' || booking.status === 'checked_out') && (
                        <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Close</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
