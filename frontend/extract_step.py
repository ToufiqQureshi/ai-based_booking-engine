import os

with open('src/pages/public/BookingCheckout.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

os.makedirs('src/components/public/checkout', exist_ok=True)

imports = """import { useBookingCheckout } from '../../pages/public/BookingCheckoutContext';
import { User, Mail, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function CheckoutGuestSection() {
    const { register, formState: { errors }, handleEmailBlur, handleSubmit, handleCheckout } = useBookingCheckout();
    
    return (
        <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden">
"""

content = imports
for i in range(521, 606):
    line = lines[i]
    if 'handleSubmit(onSubmit)' in line:
        line = line.replace('handleSubmit(onSubmit)', 'handleSubmit(handleCheckout)')
    content += line
content += '        </div>\n    );\n}\n'

with open('src/components/public/checkout/CheckoutGuestSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('CheckoutGuestSection created')
