import { Outlet, useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { startTimeTracking, stopTimeTracking, trackEvent } from '@/lib/tracker';
import { Shield, FileText } from 'lucide-react';
import { apiClient } from '@/api/client';

export function PublicBookingLayout() {
    const { hotelSlug } = useParams();
    const [hotelSettings, setHotelSettings] = useState<any>(null);

    useEffect(() => {
        if (hotelSlug) {
            startTimeTracking(hotelSlug);
            trackEvent(hotelSlug, "page_view");
            
            // Fetch hotel data for policies
            apiClient.get<any>(`/public/hotels/${hotelSlug}`)
                .then(res => setHotelSettings(res?.settings || null))
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
                </div>
            </header>

            <main>
                <Outlet />
            </main>

            {/* Hotel Policies Section */}
            {policies.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 mt-10 mb-2">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
                        <div className="flex items-center gap-2 mb-5">
                            <FileText className="w-4 h-4 text-violet-500" />
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Hotel Policies</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {policies.map((policy) => (
                                <div key={policy.label} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{policy.label}</p>
                                    <p className="text-sm text-slate-700 font-medium leading-relaxed">{policy.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <footer className="border-t border-slate-200 bg-white py-5 mt-4">
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

