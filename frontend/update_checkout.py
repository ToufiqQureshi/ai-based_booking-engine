import os

with open('src/pages/public/BookingCheckout.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
imports_added = False
for i, line in enumerate(lines):
    if not imports_added and "import { SocialProofWidget } from '@/components/public/SocialProofWidget';" in line:
        new_lines.append(line)
        new_lines.append("import { BookingCheckoutContext } from './BookingCheckoutContext';\n")
        new_lines.append("import { CheckoutGuestSection } from '@/components/public/checkout/CheckoutGuestSection';\n")
        new_lines.append("import { CheckoutEnhanceStay } from '@/components/public/checkout/CheckoutEnhanceStay';\n")
        new_lines.append("import { CheckoutPayment } from '@/components/public/checkout/CheckoutPayment';\n")
        new_lines.append("import { CheckoutSummary } from '@/components/public/checkout/CheckoutSummary';\n")
        imports_added = True
    else:
        new_lines.append(line)

lines = new_lines
new_lines = []

for i, line in enumerate(lines):
    if i == 491 and "const themeColor = getNormalizedColor(hotel?.primary_color);" in line:
        new_lines.append(line)
        new_lines.append("""
    const ctx = {
        hotelSlug: hotelSlug as string, hotel, room, state, setState, register, formState, getNormalizedColor, themeColor, handleEmailBlur, allAddons, currentAddons: state.addons || [], handleToggleAddon, formatCurrency, roomTaxType, addonTaxType, subtotalAmount, taxAmount, taxName, promoCode, setPromoCode, promoMessage, handleApplyPromo, isValidating, discountAmount, finalTotal, isSubmitting, paymentMethod, setPaymentMethod, handleCheckout: onSubmit, handleSubmit, nights, hotelPaymentMode, roomsTotal: subtotalAmount - (state.addons ? state.addons.reduce((sum: number, a: any) => sum + a.price, 0) : 0), addonsTotal: state.addons ? state.addons.reduce((sum: number, a: any) => sum + a.price, 0) : 0
    };
""")
    elif i == 497 and "return (" in line:
        new_lines.append("    return (\n        <BookingCheckoutContext.Provider value={ctx}>\n")
    elif i >= 520 and i <= 607:
        if i == 520:
            new_lines.append("                            <CheckoutGuestSection />\n")
    elif i >= 608 and i <= 673:
        if i == 608:
            new_lines.append("                            <CheckoutEnhanceStay />\n")
    elif i >= 674 and i <= 803:
        if i == 674:
            new_lines.append("                            <CheckoutPayment />\n")
    elif i >= 804 and i <= 1017:
        if i == 804:
            new_lines.append("                            <CheckoutSummary />\n")
    elif i == 1021 and "</div>" in line and ");" in lines[i+1]:
        # Wait, the 1021 index is based on the original file!
        # Because we added lines to the imports and context, the indices are shifted!
        # It's better to just check the content instead of exact indices for the closing tag.
        pass
    else:
        new_lines.append(line)

# Let's fix the closing tag at the end.
for i in range(len(new_lines) - 1, -1, -1):
    if "        </div>" in new_lines[i] and ");" in new_lines[i+1]:
        new_lines.insert(i+1, "        </BookingCheckoutContext.Provider>\n")
        break

with open('src/pages/public/BookingCheckout.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Updated BookingCheckout.tsx safely")
