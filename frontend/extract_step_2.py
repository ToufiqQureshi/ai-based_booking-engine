import os

with open('src/pages/public/BookingCheckout.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def write_component(name, imports, start, end, prefix='', suffix=''):
    content = imports
    content += prefix
    for i in range(start, end):
        content += lines[i]
    content += suffix
    
    with open(f'src/components/public/checkout/{name}.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'{name} created')

# 2. CheckoutEnhanceStay
imports_enhance = """import { useBookingCheckout } from '../../pages/public/BookingCheckoutContext';
import { Sparkles, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CheckoutEnhanceStay() {
    const { allAddons, state, handleToggleAddon, formatCurrency } = useBookingCheckout();
    
    if (allAddons.length === 0) return null;
    
    return (
"""
write_component('CheckoutEnhanceStay', imports_enhance, 609, 672, '', '    );\n}\n')

# 3. CheckoutPayment
imports_payment = """import { useBookingCheckout } from '../../pages/public/BookingCheckoutContext';
import { CreditCard, Building2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CheckoutPayment() {
    const { hotelPaymentMode, paymentMethod, setPaymentMethod } = useBookingCheckout();
    
    return (
"""
write_component('CheckoutPayment', imports_payment, 674, 802, '', '    );\n}\n')

# 4. CheckoutSummary
imports_summary = """import { useBookingCheckout } from '../../pages/public/BookingCheckoutContext';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowRight } from 'lucide-react';

export function CheckoutSummary() {
    const { room, state, getNormalizedColor, themeColor, formatCurrency, roomTaxType, addonTaxType, subtotalAmount, taxAmount, taxName, promoCode, setPromoCode, promoMessage, handleApplyPromo, isValidating, discountAmount, finalTotal, isSubmitting, nights, roomsTotal, addonsTotal } = useBookingCheckout();
    
    return (
"""
write_component('CheckoutSummary', imports_summary, 805, 1016, '', '    );\n}\n')

