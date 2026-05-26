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

            {/* Premium Hotel Policies Section */}
            {policies.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 mt-16 mb-8 relative z-10">
                    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 md:p-10 relative overflow-hidden">
                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-50 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-60 translate-y-1/3 -translate-x-1/3 pointer-events-none" />
                        
                        <div className="relative z-10 flex flex-col items-center text-center mb-10">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-50 flex items-center justify-center mb-4 border border-violet-100 shadow-sm">
                                <FileText className="w-6 h-6 text-violet-600" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Important Information</h3>
                            <p className="text-sm text-slate-500 mt-2 max-w-lg mx-auto">Please review our property policies to ensure a smooth and comfortable stay with us.</p>
                        </div>

                        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {policies.map((policy, idx) => (
                                <div 
                                    key={policy.label} 
                                    className="group bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                                >
                                    <div className="flex items-center gap-3 mb-3 border-b border-slate-50 pb-3">
                                        <div className="w-2 h-2 rounded-full bg-violet-400 group-hover:scale-150 transition-transform" />
                                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{policy.label}</p>
                                    </div>
                                    <p className="text-[14px] text-slate-600 font-medium leading-relaxed">{policy.value}</p>
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

