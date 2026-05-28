import { useBookingCheckout } from '@/pages/public/BookingCheckoutContext';
import { User, Mail, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function CheckoutGuestSection() {
    const { register, formState: { errors }, handleEmailBlur, handleSubmit, handleCheckout } = useBookingCheckout();
    
    return (
        <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                <User className="w-32 h-32" />
                            </div>

                            <div className="flex items-center gap-4 mb-10">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary rotate-3">
                                    <User className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Guest Information</h2>
                                    <p className="text-sm text-slate-500 font-medium">Please enter the details of the primary guest.</p>
                                </div>
                            </div>

                            <form id="booking-form" onSubmit={handleSubmit(handleCheckout)} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <Label htmlFor="firstName" className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black ml-1">First Name</Label>
                                        <Input
                                            id="firstName"
                                            placeholder="e.g. John"
                                            className="h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:border-primary focus:bg-white transition-all text-lg font-medium"
                                            {...register('firstName', { required: 'First name is required' })}
                                        />
                                        {errors.firstName && <span className="text-xs text-red-500 font-bold ml-1">{errors.firstName.message}</span>}
                                    </div>
                                    <div className="space-y-3">
                                        <Label htmlFor="lastName" className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black ml-1">Last Name</Label>
                                        <Input
                                            id="lastName"
                                            placeholder="e.g. Doe"
                                            className="h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:border-primary focus:bg-white transition-all text-lg font-medium"
                                            {...register('lastName', { required: 'Last name is required' })}
                                        />
                                        {errors.lastName && <span className="text-xs text-red-500 font-bold ml-1">{errors.lastName.message}</span>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <Label htmlFor="email" className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black ml-1">Email Address</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-6 top-5 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="email"
                                                type="email"
                                                className="pl-14 h-14 pr-6 rounded-2xl bg-slate-50 border-transparent focus:border-primary focus:bg-white transition-all text-lg font-medium"
                                                placeholder="john@example.com"
                                                {...register('email', {
                                                    required: 'Email is required',
                                                    pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' }
                                                })}
                                                onBlur={handleEmailBlur}
                                            />
                                        </div>
                                        {errors.email && <span className="text-xs text-red-500 font-bold ml-1">{errors.email.message}</span>}
                                    </div>

                                    <div className="space-y-3">
                                        <Label htmlFor="phone" className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black ml-1">Phone Number</Label>
                                        <div className="relative">
                                            <Phone className="absolute left-6 top-5 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="phone"
                                                type="tel"
                                                className="pl-14 h-14 pr-6 rounded-2xl bg-slate-50 border-transparent focus:border-primary focus:bg-white transition-all text-lg font-medium"
                                                placeholder="+91 98765 43210"
                                                {...register('phone', { required: 'Phone is required' })}
                                            />
                                        </div>
                                        {errors.phone && <span className="text-xs text-red-500 font-bold ml-1">{errors.phone.message}</span>}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label htmlFor="requests" className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black ml-1">Special Requests</Label>
                                    <Textarea
                                        id="requests"
                                        placeholder="Any specific preferences? (Optional)"
                                        className="min-h-[120px] p-6 rounded-2xl bg-slate-50 border-transparent focus:border-primary focus:bg-white transition-all resize-none text-lg"
                                        {...register('specialRequests')}
                                    />
                                </div>
                            </form>
        </div>
    );
}
