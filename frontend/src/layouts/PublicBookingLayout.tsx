import { Outlet, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { startTimeTracking, stopTimeTracking, trackEvent } from '@/lib/tracker';

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
    // Sheet/Dialog/Popover portals render to document.body (outside wrapper div),
    // so we must remove 'dark' from <html> directly — not just use a wrapper class.
    useEffect(() => {
        const htmlEl = document.documentElement;
        const hadDark = htmlEl.classList.contains('dark');
        htmlEl.classList.remove('dark');

        return () => {
            // Restore dark mode when guest leaves public pages
            if (hadDark) {
                htmlEl.classList.add('dark');
            }
        };
    }, []);

    return (
        <div className="light min-h-screen bg-slate-50">
            <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                <div className="container flex h-14 items-center justify-center">
                    <div className="font-bold text-xl tracking-tight text-indigo-600">
                        Staybooker <span className="text-slate-500 text-sm font-normal">Secure Booking</span>
                    </div>
                </div>
            </header>
            <main className="container py-8">
                <Outlet />
            </main>
            <footer className="border-t py-6 md:py-0">
                <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
                    <p className="text-center text-sm leading-loose text-slate-500 md:text-left">
                        Powered by Staybooker. Secure payments by Stripe.
                    </p>
                </div>
            </footer>
        </div>
    );
}
