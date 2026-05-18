import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { CheckCircle2, Calendar, MapPin, Printer, Home, Download, FileText, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { apiClient } from '@/api/client';

export default function BookingConfirmation() {
    const { hotelSlug } = useParams();
    const location = useLocation();

    const [hotel, setHotel] = useState<any>(null);

    useEffect(() => {
        if (hotelSlug) {
            apiClient.get(`/public/hotels/${hotelSlug}`)
                .then(res => setHotel(res))
                .catch(console.error);
        }
    }, [hotelSlug]);

    const booking = location.state?.booking;

    if (!booking) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-6">
                <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center">
                    <FileText className="h-10 w-10 text-slate-300" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">No Booking Found</h2>
                    <p className="text-slate-500">We couldn't retrieve the booking details.</p>
                </div>
                <Link to={`/book/${hotelSlug}`}><Button size="lg" className="rounded-full px-8">Return Home</Button></Link>
            </div>
        );
    }

    const handleDownloadInvoice = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text("HOTEL INVOICE", 105, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Booking Ref: ${booking.booking_number}`, 105, 28, { align: 'center' });

        // Hotel Info (Mock for now)
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("Staybooker Collection", 14, 45);

        // Guest Info
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("Bill To:", 140, 45);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`${booking.guest?.first_name} ${booking.guest?.last_name}`, 140, 50);
        doc.text(booking.guest?.email || '', 140, 55);

        // Dates
        doc.line(14, 65, 196, 65);
        doc.text(`Check-in: ${booking.check_in}`, 14, 72);
        doc.text(`Check-out: ${booking.check_out}`, 140, 72);
        doc.line(14, 76, 196, 76);

        // Table
        const tableBody = booking.rooms.flatMap((room: any) => [
            [
                `${room.room_type_name}`,
                `1 Night x 1 Room`,
                new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(room.total_price)
            ]
        ]);

        autoTable(doc, {
            startY: 85,
            head: [['Description', 'Quantity', 'Amount']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [51, 65, 85] },
        });

        // @ts-ignore
        const finalY = doc.lastAutoTable.finalY || 150;

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Total Paid:", 140, finalY + 15);
        doc.text(
            new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(booking.total_amount),
            196, finalY + 15,
            { align: 'right' }
        );

        doc.save(`Invoice_${booking.booking_number}.pdf`);
    };

    const getNormalizedColor = (col?: string | null) => {
        if (!col || ['#3b82f6', '#ef4444', '#2563eb', '#0f172a'].includes(col.toLowerCase())) {
            return '#7c3aed';
        }
        return col;
    };
    const themeColor = getNormalizedColor(hotel?.primary_color);

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 selection:bg-primary/10">
            <div className="max-w-3xl mx-auto space-y-8 animate-enter">

                {/* Success Message */}
                <div className="text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="h-24 w-24 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30 ring-8 ring-white">
                            <CheckCircle2 className="h-12 w-12 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">Booking Confirmed!</h1>
                        <p className="text-lg text-slate-500 max-w-md mx-auto">
                            We've sent a confirmation email to <span className="font-semibold text-slate-900">{booking.guest?.email}</span>.
                        </p>
                    </div>
                </div>

                {/* Ticket Card */}
                <Card className="overflow-hidden border-0 shadow-2xl shadow-slate-200/50 rounded-3xl bg-white relative">
                    {/* Decorative top border */}
                    <div className="absolute top-0 inset-x-0 h-2" style={{ backgroundColor: themeColor }} />

                    <div className="p-8 pb-0">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Booking Reference</p>
                                <p className="text-3xl font-mono font-bold text-slate-900 tracking-tight">{booking.booking_number}</p>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-full border-slate-200 hover:bg-slate-50">
                                    <Printer className="mr-2 h-4 w-4" /> Print
                                </Button>
                                <Button size="sm" onClick={handleDownloadInvoice} className="rounded-full shadow-lg text-white hover:-translate-y-0.5 transition-transform" style={{ backgroundColor: themeColor }}>
                                    <Download className="mr-2 h-4 w-4" /> Invoice
                                </Button>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 md:gap-12 py-8 border-t border-slate-100 border-dashed">
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <User className="h-4 w-4 text-primary" /> Guest Details
                                </h3>
                                <div className="space-y-1 text-slate-600 pl-6">
                                    <p className="font-medium text-slate-900 text-lg">{booking.guest?.first_name} {booking.guest?.last_name}</p>
                                    <p>{booking.guest?.email}</p>
                                    <p>{booking.guest?.phone}</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-primary" /> Stay Dates
                                </h3>
                                <div className="space-y-3 pl-6">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Check-in</span>
                                        <span className="font-bold text-slate-900 text-base">{booking.check_in}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Check-out</span>
                                        <span className="font-bold text-slate-900 text-base">{booking.check_out}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50/50 p-8 border-t border-slate-100">
                        <h3 className="font-bold text-slate-900 mb-4">Itinerary</h3>
                        {booking.rooms && booking.rooms.length > 0 ? (
                            <div className="space-y-3">
                                {booking.rooms.map((room: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                        <div>
                                            <p className="font-bold text-slate-900">{room.room_type_name}</p>
                                            <p className="text-sm text-slate-500">{room.rate_plan_name}</p>
                                        </div>
                                        <span className="font-bold text-slate-900">
                                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(room.total_price)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-400 italic">Room details unavailable.</p>
                        )}

                        <div className="flex justify-between items-center pt-8 mt-4 border-t border-slate-200 border-dashed">
                            <p className="text-slate-500 font-medium">Total Paid</p>
                            <p className="text-3xl font-bold tracking-tight" style={{ color: themeColor }}>
                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(booking.total_amount)}
                            </p>
                        </div>
                    </div>
                </Card>

                <div className="flex justify-center pt-4 pb-20">
                    <Link to={`/book/${hotelSlug}`}>
                        <Button variant="ghost" className="text-slate-400 hover:text-primary hover:bg-transparent transition-colors group">
                            <Home className="mr-2 h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />
                            Return to Property Home
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
