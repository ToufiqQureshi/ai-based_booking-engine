import os

with open('src/pages/public/BookingCheckout.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add imports
imports_to_add = """import { BookingCheckoutContext } from './BookingCheckoutContext';
import { CheckoutGuestSection } from '@/components/public/checkout/CheckoutGuestSection';
import { CheckoutEnhanceStay } from '@/components/public/checkout/CheckoutEnhanceStay';
import { CheckoutPayment } from '@/components/public/checkout/CheckoutPayment';
import { CheckoutSummary } from '@/components/public/checkout/CheckoutSummary';
"""
text = text.replace("import { SocialProofWidget } from '@/components/public/SocialProofWidget';", "import { SocialProofWidget } from '@/components/public/SocialProofWidget';\n" + imports_to_add)

# 2. Add Context Provider
ctx_provider = """const themeColor = getNormalizedColor(hotel?.primary_color);

    const ctx = {
        hotelSlug: hotelSlug as string, hotel, room, state, setState, register, formState, getNormalizedColor, themeColor, handleEmailBlur, allAddons, currentAddons: state.addons || [], handleToggleAddon, formatCurrency, roomTaxType, addonTaxType, subtotalAmount, taxAmount, taxName, promoCode, setPromoCode, promoMessage, handleApplyPromo, isValidating, discountAmount, finalTotal, isSubmitting, paymentMethod, setPaymentMethod, handleCheckout: onSubmit, handleSubmit, nights, hotelPaymentMode, roomsTotal: subtotalAmount - (state.addons ? state.addons.reduce((sum: number, a: any) => sum + a.price, 0) : 0), addonsTotal: state.addons ? state.addons.reduce((sum: number, a: any) => sum + a.price, 0) : 0
    };

    return (
        <BookingCheckoutContext.Provider value={ctx}>"""

text = text.replace("const themeColor = getNormalizedColor(hotel?.primary_color);\n\n    return (", ctx_provider)

# 3. Cut blocks
start_guest = text.find("{/* Guest Section */}")
end_guest = text.find("                        {/* Enhance Your Stay Upsell Section */}")

text = text[:start_guest] + "<CheckoutGuestSection />\n" + text[end_guest:]

start_enhance = text.find("{/* Enhance Your Stay Upsell Section */}")
end_enhance = text.find("                        {/* Payment Section */}")

text = text[:start_enhance] + "<CheckoutEnhanceStay />\n" + text[end_enhance:]

start_payment = text.find("{/* Payment Section */}")
end_payment = text.find("                    {/* Right Column: Summary */}")

# Note: there is a </div> closing the left column just before Right Column
end_payment_cut = text.rfind("                    </div>\n\n                    {/* Right Column: Summary */}")
if end_payment_cut != -1:
    text = text[:start_payment] + "<CheckoutPayment />\n" + text[end_payment_cut:]

start_summary = text.find("{/* Right Column: Summary */}")
end_summary = text.find("            {/* AI Loyalty Reward Popup */}")

# Note: there are two </div> closing the grid before Loyalty
end_summary_cut = text.rfind("                </div>\n            </div>\n\n            {/* AI Loyalty Reward Popup */}")
if end_summary_cut != -1:
    text = text[:start_summary] + "<CheckoutSummary />\n" + text[end_summary_cut:]

# 4. Add Context Closer
end_return = text.find("        </div>\n    );\n}\n\nexport default function BookingCheckout()")
if end_return != -1:
    text = text[:end_return] + "        </BookingCheckoutContext.Provider>\n" + text[end_return:]

with open('src/pages/public/BookingCheckout.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Replaced sections correctly.")
