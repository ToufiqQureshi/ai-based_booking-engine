import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Clock, ShieldCheck, TrendingUp, Star } from 'lucide-react';
import { Hotel } from '@/core/types/api';
import { useVisibilityInterval } from '@/core/hooks/useVisibilityInterval';
import { apiClient } from '@/core/api/client';

interface SocialProofWidgetProps {
    hotel?: Hotel | null;
    /** Optional pre-fetched stats. If omitted, the widget will fetch
     *  from /api/v1/public/social-proof/{slug} itself. */
    stats?: SocialProofStats | null;
}

interface SocialProofStats {
    is_enabled?: boolean;
    active_viewers?: number;
    hours_since_last_booking?: number;
    bookings_this_month?: number;
    review_count?: number;
    avg_rating?: number;
    custom_badges?: Array<{ label: string; icon: string }>;
    cancellation_policy_text?: string;
}

interface PublicSocialProofResponse {
    is_enabled: boolean;
    active_viewers?: number | null;
    hours_since_last_booking?: number | null;
    bookings_this_month?: number | null;
    review_count?: number | null;
    avg_rating?: number | null;
    custom_badges?: Array<{ label: string; icon: string }>;
    cancellation_policy_text?: string | null;
}

/**
 * Social-proof widget.
 *
 * IMPORTANT — compliance note: this widget must NEVER display synthetic /
 * random numbers as if they were real metrics. "X people are viewing this
 * hotel right now", "last booked N hours ago", and "X bookings this month"
 * are factual claims that fall under truth-in-advertising rules (FTC
 * Endorsement Guides, EU UCPD, ASCI Code in India). The previous version
 * of this component generated these with Math.random() and displayed them
 * as truth — that has been removed.
 *
 * The widget now reads real, verified data from
 *   GET /api/v1/public/social-proof/{slug}
 * which is served from a 60s Redis cache and backed by aggregated
 * hotel_social_proof_settings.cached_* columns. Badges are silently
 * omitted when the data is unavailable — never invented.
 */
export const SocialProofWidget: React.FC<SocialProofWidgetProps> = ({ hotel, stats: prefetchedStats }) => {
    const settings = hotel?.settings as Record<string, any> | undefined;
    const hotelSlug = hotel?.slug;

    const [liveStats, setLiveStats] = useState<PublicSocialProofResponse | null>(prefetchedStats as any ?? null);
    const [isFetching, setIsFetching] = useState(false);

    // Fetch real data from the public endpoint, with 60s visibility-aware polling.
    const fetchStats = React.useCallback(async () => {
        if (!hotelSlug) return;
        if (prefetchedStats) return; // parent provided data, don't double-fetch
        setIsFetching(true);
        try {
            const res = await apiClient.get<PublicSocialProofResponse>(`/public/social-proof/${hotelSlug}`);
            setLiveStats(res);
        } catch (err) {
            // Public endpoint never raises on missing data — it returns
            // is_enabled:false. Keep the last good state on network errors.
        } finally {
            setIsFetching(false);
        }
    }, [hotelSlug, prefetchedStats]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    useVisibilityInterval(() => {
        fetchStats();
    }, 60000);

    const stats = liveStats;
    const isEnabled = stats?.is_enabled !== false;

    const proofs: { icon: React.ReactNode; text: string; color: string; key: string }[] = [];

    if (isEnabled) {
        if (
            settings?.show_viewers_count !== false &&
            typeof stats?.active_viewers === 'number' &&
            stats.active_viewers > 0
        ) {
            proofs.push({
                key: 'viewers',
                icon: <Eye className="w-4 h-4 text-blue-500" />,
                text: `${stats.active_viewers} ${stats.active_viewers === 1 ? 'person is' : 'people are'} viewing this hotel right now`,
                color: 'bg-blue-50 text-blue-700 border-blue-100',
            });
        }

        if (
            settings?.show_last_booked !== false &&
            typeof stats?.hours_since_last_booking === 'number' &&
            stats.hours_since_last_booking >= 0
        ) {
            const hours = stats.hours_since_last_booking;
            let text: string;
            if (hours < 1) {
                text = 'Booked in the last hour';
            } else if (hours < 24) {
                text = `Last booked ${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'} ago`;
            } else {
                const days = Math.round(hours / 24);
                text = `Last booked ${days} day${days === 1 ? '' : 's'} ago`;
            }
            proofs.push({
                key: 'last_booked',
                icon: <Clock className="w-4 h-4 text-orange-500" />,
                text,
                color: 'bg-orange-50 text-orange-700 border-orange-100',
            });
        }

        const hasPolicyText = typeof stats?.cancellation_policy_text === 'string' && (stats.cancellation_policy_text || '').trim().length > 0;
        const hasHotelPolicyText = typeof hotel?.settings?.cancellation_policy === 'string' && (hotel?.settings?.cancellation_policy || '').trim().length > 0;
        if (hasPolicyText || hasHotelPolicyText) {
            proofs.push({
                key: 'cancellation',
                icon: <ShieldCheck className="w-4 h-4 text-green-500" />,
                text: stats?.cancellation_policy_text || (hotel?.settings?.cancellation_policy as string),
                color: 'bg-green-50 text-green-700 border-green-100',
            });
        }

        if (
            settings?.show_popular_badge !== false &&
            typeof stats?.bookings_this_month === 'number' &&
            stats.bookings_this_month > 0
        ) {
            const count = stats.bookings_this_month;
            const template = (settings?.popular_badge_text as string) || 'Popular choice! {count} bookings this month';
            const text = template.replace('{count}', count.toString());
            proofs.push({
                key: 'popular',
                icon: <TrendingUp className="w-4 h-4 text-purple-500" />,
                text,
                color: 'bg-purple-50 text-purple-700 border-purple-100',
            });
        }

        if (
            settings?.show_review_summary !== false &&
            typeof stats?.review_count === 'number' &&
            stats.review_count > 0 &&
            typeof stats?.avg_rating === 'number' &&
            stats.avg_rating > 0
        ) {
            proofs.push({
                key: 'reviews',
                icon: <Star className="w-4 h-4 text-amber-500" />,
                text: `${stats.avg_rating.toFixed(1)}★ from ${stats.review_count} review${stats.review_count === 1 ? '' : 's'}`,
                color: 'bg-amber-50 text-amber-700 border-amber-100',
            });
        }

        for (const b of stats?.custom_badges || []) {
            if (typeof b?.label === 'string' && b.label.trim().length > 0) {
                const icon = (typeof b.icon === 'string' && b.icon.trim()) || '✨';
                proofs.push({
                    key: `custom-${b.label}`,
                    icon: <span className="text-base" aria-hidden>{icon}</span>,
                    text: b.label,
                    color: 'bg-violet-50 text-violet-700 border-violet-100',
                });
            }
        }
    }

    // All hooks must be called unconditionally — no early returns above this line
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex >= proofs.length) setCurrentIndex(0);
    }, [proofs.length, currentIndex]);

    useVisibilityInterval(() => {
        if (proofs.length === 0) return;
        setCurrentIndex((prev) => (prev + 1) % proofs.length);
    }, 5000);

    if (!isEnabled || proofs.length === 0) return null;

    return (
        <div className="space-y-3 mb-6" data-testid="social-proof-widget">
            <AnimatePresence mode="wait">
                <motion.div
                    key={proofs[currentIndex]?.key ?? currentIndex}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className={`flex items-center gap-3 p-3 rounded-2xl border ${proofs[currentIndex].color} text-sm font-medium shadow-sm`}
                >
                    <div className="shrink-0">
                        {proofs[currentIndex].icon}
                    </div>
                    <p>{proofs[currentIndex].text}</p>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
