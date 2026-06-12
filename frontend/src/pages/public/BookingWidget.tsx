import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { Calendar as CalendarIcon, Users, ArrowRight, Minus, Plus, Search, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { useBookingWidgetState } from '@/hooks/useBookingWidgetState';
import { ModernFloatingLayout } from '@/components/public/ModernFloatingLayout';
import { ClassicStackedLayout } from '@/components/public/ClassicStackedLayout';
import { MinimalBarLayout } from '@/components/public/MinimalBarLayout';
import { PremiumCapsuleLayout } from '@/components/public/PremiumCapsuleLayout';

export default function BookingWidget() {
    const stateBag = useBookingWidgetState();
    if (!stateBag) return null;
    const {
        config, setConfig, startingPrice, setStartingPrice, checkInDate, setCheckInDate,
        checkOutDate, setCheckOutDate, roomsCount, setRoomsCount, adults, setAdults,
        children, setChildren, promoCode, setPromoCode, isCalendarOpen, setIsCalendarOpen,
        isGuestOpen, setIsGuestOpen, isMobile, setIsMobile, handleSearch, updateParentIframeHeight,
        primaryHex, bgColor, isBgLight, widgetTheme, layout,
        widgetRef, calendarPopoverContent, guestPopoverContent
    } = stateBag;

    // When the calendar / guest picker is open, the embed script has lifted the
    // iframe to a fixed full-viewport overlay. Mirror that here: dim the host page
    // behind a backdrop and centre the search bar near the top, so the popup reads
    // as an intentional modal and the host page never shifts.
    const isOverlayOpen = isCalendarOpen || isGuestOpen;

    return (
        <div
            ref={widgetRef}
            className={cn(
                'light font-sans',
                isOverlayOpen
                    ? 'fixed inset-0 z-[2147483000] flex items-start justify-center overflow-y-auto px-3 py-[7vh]'
                    : 'w-full flex justify-center p-2 lg:p-4'
            )}
        >
            {isOverlayOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-[-1]"
                    onClick={() => { setIsCalendarOpen(false); setIsGuestOpen(false); }}
                />
            )}
            <style>{`
                .custom-theme-btn {
                    background-color: ${primaryHex} !important;
                    color: white !important;
                }
                .custom-theme-text {
                    color: ${primaryHex} !important;
                }
                .custom-theme-bg-light {
                    background-color: ${primaryHex}15 !important;
                    color: ${primaryHex} !important;
                }
                .group:hover .group-hover\\:custom-theme-btn {
                    background-color: ${primaryHex} !important;
                    color: white !important;
                }
                .custom-theme-border:hover, .focus-within\\:custom-theme-border:focus-within {
                    border-color: ${primaryHex} !important;
                }
                .rdp-day_selected {
                    background-color: ${primaryHex} !important;
                    color: white !important;
                    box-shadow: 0 4px 14px 0 ${primaryHex}40;
                }
                .rdp-caption {
                    background-color: ${primaryHex} !important;
                }
                .rdp-day_disabled {
                    opacity: 1 !important;
                }
                .rdp-day_disabled span {
                    color: #94a3b8 !important;
                }

                /* Calendar Theme Overrides */
                ${widgetTheme === 'dark' ? `
                    .calendar-container {
                        background-color: #0f172a !important;
                        color: #f8fafc !important;
                        border-color: #1e293b !important;
                    }
                    .rdp-months {
                        background-color: #0f172a !important;
                        color: #f8fafc !important;
                    }
                    .rdp-caption_label, .rdp-head_cell {
                        color: #cbd5e1 !important;
                    }
                    .rdp-day {
                        color: #cbd5e1 !important;
                    }
                    .rdp-day:hover {
                        background-color: #1e293b !important;
                        color: #ffffff !important;
                    }
                    .rdp-day_today {
                        background-color: #1e293b !important;
                        color: ${primaryHex} !important;
                    }
                    .rdp-day_disabled span {
                        color: #475569 !important;
                    }
                    .rdp-day_selected {
                        background-color: ${primaryHex} !important;
                        color: white !important;
                    }
                ` : widgetTheme === 'theme' ? `
                    .calendar-container {
                        background-color: ${bgColor} !important;
                        color: ${isBgLight ? '#0f172a' : '#f8fafc'} !important;
                        border-color: ${primaryHex}30 !important;
                    }
                    .rdp-day {
                        color: ${isBgLight ? '#334155' : '#e2e8f0'} !important;
                    }
                    .rdp-day:hover {
                        background-color: ${primaryHex}20 !important;
                    }
                    .rdp-day_today {
                        border-color: ${primaryHex}80 !important;
                        color: ${primaryHex} !important;
                    }
                    .rdp-day_selected {
                        background-color: ${primaryHex} !important;
                        color: white !important;
                    }
                ` : ''}

                /* Fix checkin/checkout date text color conflict */
                .rdp-day_selected,
                .rdp-day_selected.custom-theme-text,
                .rdp-day_selected.rdp-day_today {
                    color: white !important;
                }
                /* When check-in/check-out lands on TODAY, the "today" styling
                   (light bg + border) fought the selected pill and clipped/hid
                   the day number. Force the selected pill to fully win: dark bg,
                   white text, no border. */
                .rdp-day_selected.rdp-day_today {
                    background-color: ${primaryHex} !important;
                    border-color: transparent !important;
                }
                .rdp-day_selected.rdp-day_today span {
                    color: white !important;
                }
            `}</style>
            
            {/* Custom CSS overrides saved in DB settings */}
            {config?.widget_custom_css && (
                <style>{config.widget_custom_css}</style>
            )}

            {layout === 'modern' && <ModernFloatingLayout {...stateBag} />}
            {layout === 'classic' && <ClassicStackedLayout {...stateBag} />}
            {layout === 'minimal' && <MinimalBarLayout {...stateBag} />}
            {layout === 'premium' && <PremiumCapsuleLayout {...stateBag} />}
        </div>
    );
}
