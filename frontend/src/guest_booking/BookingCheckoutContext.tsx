import { createContext, useContext } from 'react';
import { AddOn, Hotel, RoomType } from '@/core/types/api';

export interface BookingCheckoutContextType {
    hotelSlug: string;
    hotel: Hotel | null;
    room: RoomType | null;
    state: any;
    setState: any;
    register: any;
    formState: any;
    getNormalizedColor: (c?: string | null) => string;
    themeColor: string;
    handleEmailBlur: () => void;
    allAddons: AddOn[];
    currentAddons: AddOn[];
    handleToggleAddon: (addon: AddOn) => void;
    formatCurrency: (val: number) => string;
    roomTaxType: string;
    addonTaxType: string;
    subtotalAmount: number;
    taxAmount: number;
    taxName: string;
    promoCode: string;
    setPromoCode: (val: string) => void;
    promoMessage: string | null;
    handleApplyPromo: () => void;
    isValidating: boolean;
    discountAmount: number;
    finalTotal: number;
    isSubmitting: boolean;
    appliedRoomTaxRate: number;
    roomTaxCalculationMethod: string;
    roomTaxAmount: number;
    addonTaxRate: number;
    addonTaxAmount: number;
    appliedPromo: string | null;
    setAppliedPromo: (val: string | null) => void;
    setDiscountAmount: (val: number) => void;
    paymentMethod: 'online' | 'property';
    setPaymentMethod: any;
    handleCheckout: (data: any) => void;
    handleSubmit: any;
    nights: number;
    hotelPaymentMode: string;
    roomsTotal: number;
    addonsTotal: number;
    pointsBalance?: number;
    setPointsBalance?: (val: number) => void;
    redeemPointsActive?: boolean;
    setRedeemPointsActive?: (val: boolean) => void;
    redeemPointsAmount?: number;
    setRedeemPointsAmount?: (val: number) => void;
    handleOpenDateChange?: () => void;
}

export const BookingCheckoutContext = createContext<BookingCheckoutContextType | null>(null);

export function useBookingCheckout() {
    const ctx = useContext(BookingCheckoutContext);
    if (!ctx) throw new Error('useBookingCheckout must be used within BookingCheckoutContext');
    return ctx;
}
