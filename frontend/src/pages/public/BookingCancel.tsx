import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { Loader2, ArrowRight, User, Mail, ShieldAlert, CheckCircle, HelpCircle, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/api/client';
import { useToast } from '@/components/ui/use-toast';
import { BookingStepper } from '@/components/public/BookingStepper';
import { cn } from '@/lib/utils';

interface LookupForm {
    bookingNumber: string;
    email: string;
}

interface BookingCancelDetails {
    booking_number: string;
    guest_name: string;
    check_in: string;
    check_out: string;
    rooms: Array<{ room_type_name: string; total_price: number; cancellation_policy: string }>;
    total_amount: number;
    paid_amount: number;
    cancellation_policy: string;
    is_refundable: boolean;
    cancellation_hours: number;
    potential_fee: number;
    potential_refund: number;
    refund_status: string;
    status: string;
    cancellation_mode: 'instant' | 'request';
}

export default function BookingCancel() {
    const { hotelSlug } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const [hotel, setHotel] = useState<any>(null);
    const [loadingHotel, setLoadingHotel] = useState(true);
    const [bookingDetails, setBookingDetails] = useState<BookingCancelDetails | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelSuccess, setCancelSuccess] = useState(false);
    const [cancelResult, setCancelResult] = useState<any>(null);

    const { register, handleSubmit, formState: { errors } } = useForm<LookupForm>();

    useEffect(() => {
        if (hotelSlug) {
            setLoadingHotel(true);
            apiClient.get(`/public/hotels/${hotelSlug}`)
                .then(res => {
                    setHotel(res);
                })
                .catch(err => {
                    console.error("Failed to load hotel details", err);
                })
                .finally(() => {
                    setLoadingHotel(false);
                });
        }
    }, [hotelSlug]);

    const handleLookup = async (data: LookupForm) => {
        setLoadingDetails(true);
        setBookingDetails(null);
        try {
            const res = await apiClient.post<BookingCancelDetails>('/public/bookings/cancel-request', {
                booking_number: data.bookingNumber.trim().toUpperCase(),
                email: data.email.trim().toLowerCase()
            });
            setBookingDetails(res);
        } catch (error: any) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Booking Not Found",
                description: error.response?.data?.detail || "Please verify your Booking Reference and Email.",
            });
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleConfirmCancellation = async () => {
        if (!bookingDetails) return;
        setIsCancelling(true);
        try {
            const lookupForm = document.getElementById("lookup-form-data") as HTMLFormElement;
            const email = new FormData(lookupForm).get("email") as string;
            
            const res = await apiClient.post('/public/bookings/cancel-confirm', {
                booking_number: bookingDetails.booking_number,
                email: email.trim().toLowerCase()
            });
            setCancelResult(res);
            setCancelSuccess(true);
            toast({
                title: bookingDetails.cancellation_mode === 'request' ? "Cancellation Requested" : "Booking Cancelled",
                description: bookingDetails.cancellation_mode === 'request'
                    ? "Your cancellation request has been submitted for approval."
                    : "Your booking has been cancelled successfully.",
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Cancellation Failed",
                description: error.response?.data?.detail || "Failed to cancel booking. Please contact hotel staff.",
            });
        } finally {
            setIsCancelling(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    const themeColor = hotel?.primary_color || '#7c3aed';

    if (loadingHotel) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-slate-500 font-medium">Loading cancellation portal...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20 selection:bg-indigo-500/10">
            {/* Header / Brand block */}
            <div className="w-full bg-white border-b border-slate-100 py-6 px-6 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {hotel?.logo_url ? (
                        <img src={hotel.logo_url} alt="Logo" className="h-10 object-contain" />
                    ) : (
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                            SB
                        </div>
                    )}
                    <span className="font-bold text-slate-800 text-lg">{hotel?.name || 'Staybooker'}</span>
                </div>
                <Link to={`/book/${hotelSlug}`}>
                    <Button variant="ghost" size="sm" className="rounded-full text-slate-500 gap-1">
                        <ArrowLeft className="w-4 h-4" /> Return to Rooms
                    </Button>
                </Link>
            </div>

            <div className="max-w-3xl mx-auto px-4 mt-12">
                <div className="mb-10 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold border border-red-100 mb-3">
                        <ShieldAlert className="w-3.5 h-3.5" /> Cancellation Portal
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Cancel Your Reservation</h1>
                    <p className="text-slate-500 font-medium">Enter details below to check policies and confirm cancellation.</p>
                </div>

                {!cancelSuccess ? (
                    <div className="space-y-8">
                        {/* Lookup Form */}
                        <form id="lookup-form-data" onSubmit={handleSubmit(handleLookup)} className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="bookingNumber" className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Booking Reference</Label>
                                    <Input
                                        id="bookingNumber"
                                        placeholder="e.g. BK20260523ABC"
                                        className="h-12 rounded-xl bg-slate-50 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold tracking-widest"
                                        {...register('bookingNumber', { required: 'Booking number is required' })}
                                    />
                                    {errors.bookingNumber && <span className="text-xs text-red-500 font-semibold">{errors.bookingNumber.message}</span>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Guest Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        name="email"
                                        placeholder="john@example.com"
                                        className="h-12 rounded-xl bg-slate-50 border-transparent focus:border-indigo-600 focus:bg-white transition-all"
                                        {...register('email', { required: 'Email address is required' })}
                                    />
                                    {errors.email && <span className="text-xs text-red-500 font-semibold">{errors.email.message}</span>}
                                </div>
                            </div>
                            <Button 
                                type="submit" 
                                className="w-full h-12 text-white font-bold rounded-xl shadow-md"
                                style={{ backgroundColor: themeColor }}
                                disabled={loadingDetails}
                            >
                                {loadingDetails ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying booking...
                                    </>
                                ) : (
                                    'Review Cancellation Terms'
                                )}
                            </Button>
                        </form>

                        {/* Booking Details & Fee Calculations */}
                        {bookingDetails && (
                            <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden animate-enter">
                                <div className="bg-slate-900 text-white p-8">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Booking Reference</span>
                                        <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Active</span>
                                    </div>
                                    <h3 className="text-2xl font-black tracking-tight">{bookingDetails.booking_number}</h3>
                                    <p className="text-slate-400 text-sm mt-1">Booked for: <span className="font-semibold text-white">{bookingDetails.guest_name}</span></p>
                                    
                                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-800">
                                        <div>
                                            <span className="text-[10px] text-slate-500 uppercase font-black">Check-in</span>
                                            <p className="font-bold text-white mt-0.5">{bookingDetails.check_in}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 uppercase font-black">Check-out</span>
                                            <p className="font-bold text-white mt-0.5">{bookingDetails.check_out}</p>
                                        </div>
                                    </div>
                                </div>

                                <CardContent className="p-8 md:p-10 space-y-8 bg-white">
                                    {/* Itinerary */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Selected Rooms</h4>
                                        {bookingDetails.rooms.map((room, i) => (
                                            <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-slate-50 border border-slate-100">
                                                <div>
                                                    <p className="font-bold text-slate-950">{room.room_type_name}</p>
                                                    <p className="text-xs text-red-500 font-medium mt-0.5">Policy: {room.cancellation_policy}</p>
                                                </div>
                                                <span className="font-bold text-slate-950">{formatCurrency(room.total_price)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <Separator className="bg-slate-100" />

                                    {/* Cancellation Calculation Details */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Cancellation summary</h4>
                                        
                                        <div className="space-y-3 p-6 rounded-2xl bg-slate-50 border border-slate-100">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500 font-medium">Total Price</span>
                                                <span className="font-bold text-slate-900">{formatCurrency(bookingDetails.total_amount)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500 font-medium">Amount Paid</span>
                                                <span className="font-bold text-slate-900">{formatCurrency(bookingDetails.paid_amount)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm pt-2 border-t border-slate-200 border-dashed text-red-600 font-bold">
                                                <span className="flex items-center gap-1.5"><HelpCircle className="w-4 h-4 shrink-0" /> Cancellation Fee</span>
                                                <span>{bookingDetails.potential_fee > 0 ? formatCurrency(bookingDetails.potential_fee) : 'Free Cancellation'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm pt-2 border-t border-slate-200 border-dashed text-green-600 font-bold">
                                                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 shrink-0" /> Refund to Process</span>
                                                <span>{formatCurrency(bookingDetails.potential_refund)}</span>
                                            </div>
                                        </div>

                                        {bookingDetails.potential_fee > 0 && (
                                            <p className="text-xs text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-100 leading-relaxed font-medium">
                                                🚨 **Notice**: This cancellation request is submitted outside the free cancellation window configured for your rate plans/room types. A late fee is applied accordingly.
                                            </p>
                                        )}
                                    </div>

                                    {/* Warning terms */}
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                        {bookingDetails.cancellation_mode === 'request'
                                            ? 'By clicking "Submit Cancellation Request", you submit a request to the hotel to cancel your booking. Room inventory remains occupied until hotel approval.'
                                            : 'By clicking "Confirm Cancellation", you agree that your booking will be cancelled and room inventory released back to the hotel. Refund execution follows the hotel guarantee terms.'}
                                    </p>

                                    {/* Action buttons */}
                                    <div className="flex gap-4">
                                        <Button variant="outline" className="flex-1 h-14 text-slate-600 rounded-xl font-bold" onClick={() => setBookingDetails(null)}>
                                            Back
                                        </Button>
                                        <Button 
                                            variant="destructive"
                                            className="flex-1 h-14 rounded-xl font-black uppercase text-base"
                                            onClick={handleConfirmCancellation}
                                            disabled={isCancelling}
                                        >
                                            {isCancelling ? (
                                                <>
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...
                                                </>
                                            ) : (
                                                bookingDetails.cancellation_mode === 'request' ? 'Submit Cancellation Request' : 'Confirm Cancellation'
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                ) : (
                    // Success View
                    <Card className="rounded-[2.5rem] border-0 shadow-2xl p-10 text-center space-y-6 bg-white animate-enter">
                        <div className="flex justify-center">
                            {cancelResult?.status === 'cancel_requested' ? (
                                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-500 animate-pulse">
                                    <HelpCircle className="w-12 h-12" />
                                </div>
                            ) : (
                                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-red-500">
                                    <XCircle className="w-12 h-12" />
                                </div>
                            )}
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                                {cancelResult?.status === 'cancel_requested' ? 'Cancellation Requested' : 'Booking Cancelled'}
                            </h2>
                            <p className="text-slate-500 mt-2 font-medium">
                                {cancelResult?.status === 'cancel_requested' ? (
                                    <>
                                        Your cancellation request for booking reference <span className="font-mono font-bold text-slate-800">{cancelResult?.booking_number}</span> has been submitted.
                                    </>
                                ) : (
                                    <>
                                        Your booking reference <span className="font-mono font-bold text-slate-800">{cancelResult?.booking_number}</span> has been cancelled.
                                    </>
                                )}
                            </p>
                        </div>

                        <Separator className="bg-slate-100" />

                        <div className="max-w-md mx-auto bg-slate-50 border border-slate-100 rounded-2xl p-6 text-sm space-y-3 text-left">
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">
                                    {cancelResult?.status === 'cancel_requested' ? 'Estimated Cancellation Fee:' : 'Cancellation Fee:'}
                                </span>
                                <span className="font-bold text-slate-900">{cancelResult?.cancellation_fee > 0 ? formatCurrency(cancelResult.cancellation_fee) : '₹0 (Free)'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">
                                    {cancelResult?.status === 'cancel_requested' ? 'Estimated Refund Amount:' : 'Total Refund Processed:'}
                                </span>
                                <span className="font-bold text-green-600">{formatCurrency(cancelResult?.refund_amount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Refund / Request Status:</span>
                                <span className={cn(
                                    "font-extrabold uppercase text-xs px-2 py-0.5 rounded tracking-wider",
                                    cancelResult?.status === 'cancel_requested'
                                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                                        : "bg-slate-200 text-slate-800"
                                )}>
                                    {cancelResult?.status === 'cancel_requested' ? 'Pending Approval' : cancelResult?.refund_status}
                                </span>
                            </div>
                        </div>

                        {cancelResult?.status === 'cancel_requested' && (
                            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed font-medium">
                                The hotel front office has been notified. They will review the request and update your reservation status. Room inventory will remain secured for you until then.
                            </p>
                        )}

                        <div className="pt-4">
                            <Link to={`/book/${hotelSlug}`}>
                                <Button className="rounded-xl px-8 h-12 font-bold text-white" style={{ backgroundColor: themeColor }}>
                                    Back to Home
                                </Button>
                            </Link>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
