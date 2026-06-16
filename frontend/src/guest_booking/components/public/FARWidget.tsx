import { TrendingDown, ArrowRight } from 'lucide-react';

/**
 * FAR (First Available Rate) Widget
 * Compact badge showing the hotel's lowest available rate + "Book Now" CTA.
 * Designed for homepage heroes, sticky headers, email footers — anywhere
 * a full search bar is too heavy but the rate + CTA drives direct conversions.
 * Embed via widget-v3.js with layout="far" — the iframe is ~72 px tall.
 */
export function FARWidget(props: any) {
    const { startingPrice, primaryHex, bgColor, config, handleSearch } = props;

    const currency = config?.currency || 'INR';
    const formattedPrice = startingPrice > 0
        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(startingPrice)
        : null;

    return (
        <div
            className="w-full flex items-center justify-between gap-4 px-5 py-3 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/40"
            style={{ backgroundColor: bgColor && bgColor !== '#ffffff' ? bgColor : 'rgba(255,255,255,0.97)' }}
        >
            {/* Rate badge */}
            <div className="flex items-center gap-3 min-w-0">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${primaryHex}18`, color: primaryHex }}
                >
                    <TrendingDown className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Best Rate</p>
                    {formattedPrice ? (
                        <p className="text-lg font-black text-slate-900 leading-tight">
                            {formattedPrice}
                            <span className="text-xs font-semibold text-slate-400 ml-1">/night</span>
                        </p>
                    ) : (
                        <p className="text-sm font-bold text-slate-400">Loading rates…</p>
                    )}
                </div>
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-8 w-px bg-slate-100 shrink-0" />

            {/* Tagline */}
            <div className="hidden sm:block min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-600 truncate">Book direct, pay less</p>
                <p className="text-[10px] text-slate-400 truncate">Best rate guaranteed · No booking fees</p>
            </div>

            {/* CTA */}
            <button
                onClick={handleSearch}
                className="shrink-0 h-10 px-5 rounded-xl text-white font-black text-sm flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] transition-all"
                style={{ backgroundImage: `linear-gradient(135deg, ${primaryHex}, ${primaryHex}cc)` }}
            >
                Book Now
                <ArrowRight className="w-4 h-4" />
            </button>
        </div>
    );
}
