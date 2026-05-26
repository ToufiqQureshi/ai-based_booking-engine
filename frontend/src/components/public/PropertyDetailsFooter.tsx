import React from 'react';
import { Property } from '@/types/api';
import { MapPin, Globe, Phone, Mail } from 'lucide-react';

interface PropertyDetailsFooterProps {
    hotel: Property | null;
}

export function PropertyDetailsFooter({ hotel }: PropertyDetailsFooterProps) {
    if (!hotel) return null;

    const { name, description, logo_url, address, contact, settings } = hotel;

    const fullAddress = [
        address?.street,
        address?.city,
        address?.state,
        address?.country,
        address?.postal_code
    ].filter(Boolean).join(', ');

    return (
        <section className="bg-white border-t border-slate-200 mt-16 pb-0 shadow-sm">
            <div className="max-w-7xl mx-auto">
                <div className="p-8 md:p-12">
                    <h2 className="text-2xl font-black text-slate-800 mb-8 border-b border-slate-100 pb-4">Property Details</h2>
                    
                    <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
                        {/* Image / Logo Section */}
                        <div className="w-full md:w-1/3 lg:w-1/4 shrink-0">
                            <div className="w-full aspect-video md:aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                                {logo_url ? (
                                    <img src={logo_url} alt={name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50">
                                        <span className="text-4xl font-black text-indigo-200">{name.charAt(0).toUpperCase()}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Details Section */}
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{name}</h3>
                                {description ? (
                                    <p className="text-sm text-slate-600 leading-relaxed mb-6 text-justify">
                                        {description}
                                    </p>
                                ) : (
                                    <p className="text-sm text-slate-400 italic mb-6">Experience the best of hospitality with us.</p>
                                )}
                            </div>

                            {/* Links Section */}
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-4 text-sm font-semibold text-indigo-600">
                                <a href="#" className="hover:text-indigo-800 transition-colors underline-offset-4 hover:underline">Home</a>
                                {settings?.terms_conditions && (
                                    <a href="#" className="hover:text-indigo-800 transition-colors underline-offset-4 hover:underline">Terms & Conditions</a>
                                )}
                                {settings?.privacy_policy && (
                                    <a href="#" className="hover:text-indigo-800 transition-colors underline-offset-4 hover:underline">Privacy Policy</a>
                                )}
                                {settings?.payment_policy && (
                                    <a href="#" className="hover:text-indigo-800 transition-colors underline-offset-4 hover:underline">Payment Terms</a>
                                )}
                                <a href="#" className="hover:text-indigo-800 transition-colors underline-offset-4 hover:underline">Manage Bookings</a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Address Bar */}
                <div className="bg-amber-500 text-amber-950 px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm font-medium">
                    <div className="flex flex-wrap items-center gap-2 justify-center text-center md:text-left">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span>{name}, {fullAddress}</span>
                    </div>
                    {settings?.gst_number && (
                        <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-amber-600/20 rounded-full font-bold">
                            <span>Business/GST No: {settings.gst_number}</span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
