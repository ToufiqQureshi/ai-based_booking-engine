import { Outlet, useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { startTimeTracking, stopTimeTracking, trackEvent } from '@/core/lib/tracker';
import { Shield, FileText } from 'lucide-react';
import { apiClient } from '@/core/api/client';
import { PropertyDetailsFooter } from '@/guest_booking/components/public/PropertyDetailsFooter';
import { LanguageCurrencyHeader } from '@/guest_booking/components/public/booking/LanguageCurrencyHeader';

export function PublicBookingLayout() {
    const { hotelSlug } = useParams();
    const [hotel, setHotel] = useState<any>(null);
    const [hotelSettings, setHotelSettings] = useState<any>(null);

    useEffect(() => {
        if (hotelSlug) {
            startTimeTracking(hotelSlug);
            trackEvent(hotelSlug, "page_view");
            
            // Fetch hotel data for policies and footer
            apiClient.get<any>(`/public/hotels/${hotelSlug}`)
                .then(res => {
                    setHotel(res);
                    setHotelSettings(res?.settings || null);
                })
                .catch(() => {});
        }
        return () => {
            stopTimeTracking();
        };
    }, [hotelSlug]);

    // Force light mode on public booking pages
    useEffect(() => {
        const htmlEl = document.documentElement;
        const hadDark = htmlEl.classList.contains('dark');
        htmlEl.classList.remove('dark');
        return () => {
            if (hadDark) htmlEl.classList.add('dark');
        };
    }, []);

    const policies = [
        { label: 'Cancellation Policy', value: hotelSettings?.cancellation_policy },
        { label: 'Payment Policy', value: hotelSettings?.payment_policy },
        { label: 'Child Policy', value: hotelSettings?.child_policy },
        { label: 'Privacy Policy', value: hotelSettings?.privacy_policy },
        { label: 'Important Information', value: hotelSettings?.important_info },
    ].filter(p => p.value && p.value.trim());

    return (
        <div className="light min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 flex h-14 items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
                            <span className="text-white font-black text-xs">S</span>
                        </div>
                        <span className="font-bold text-base tracking-tight text-violet-700">Staybooker</span>
                        <span className="text-slate-400 text-sm font-normal hidden sm:inline">· Secure Booking</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <Shield className="w-3.5 h-3.5 text-green-500" />
                        <span className="hidden sm:inline">256-bit SSL Secured</span>
                        <span className="sm:hidden">Secured</span>
                    </div>
                    
                    {/* Add Language and Currency Selector here */}
                    <LanguageCurrencyHeader />
                </div>
            </header>

            <main>
                <Outlet />
            </main>

            {/* Premium Property Details Footer */}
            {hotel && <PropertyDetailsFooter hotel={hotel} />}

            <footer className="border-t border-slate-200 bg-white py-5">
                <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-400 font-medium">
                        Powered by <span className="text-violet-600 font-bold">Staybooker.ai</span>
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                        <Link to={`/book/${hotelSlug}/cancel`} className="hover:text-violet-600 hover:underline transition-colors font-medium">
                            Cancel Booking
                        </Link>
                        <span>·</span>
                        <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-green-500" /> Secure Payments</span>
                        <span>·</span>
                        <span>Privacy Protected</span>
                        <span>·</span>
                        <span>Best Price Guaranteed</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}

