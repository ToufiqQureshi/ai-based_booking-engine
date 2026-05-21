import { Outlet, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { startTimeTracking, stopTimeTracking, trackEvent } from '@/lib/tracker';
import { Shield } from 'lucide-react';

export function PublicBookingLayout() {
    const { hotelSlug } = useParams();

    useEffect(() => {
        if (hotelSlug) {
            startTimeTracking(hotelSlug);
            trackEvent(hotelSlug, "page_view");
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

            <footer className="border-t border-slate-200 bg-white py-5 mt-12">
                <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-400 font-medium">
                        Powered by <span className="text-violet-600 font-bold">Staybooker.ai</span>
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
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
