import React, { useState } from 'react';
import { Property } from '@/types/api';
import { MapPin, Globe, Phone, Mail, FileText, X, ChevronRight } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface PropertyDetailsFooterProps {
    hotel: Property | null;
}

export function PropertyDetailsFooter({ hotel }: PropertyDetailsFooterProps) {
    const [policyModal, setPolicyModal] = useState<{ title: string, content: string } | null>(null);

    if (!hotel) return null;

    const { name, description, logo_url, address, contact, settings, photos } = hotel;

    const fullAddress = [
        address?.street,
        address?.city,
        address?.state,
        address?.country,
        address?.postal_code
    ].filter(Boolean).join(', ');

    const policies = [
        { label: 'Cancellation Policy', value: settings?.cancellation_policy },
        { label: 'Payment Policy', value: settings?.payment_policy },
        { label: 'Child Policy', value: settings?.child_policy },
        { label: 'Privacy Policy', value: settings?.privacy_policy },
        { label: 'Terms & Conditions', value: settings?.terms_conditions },
        { label: 'Important Information', value: settings?.important_info },
    ].filter(p => p.value && p.value.trim());

    // Determine the main display image. If hotel has photos, use the first one. Otherwise fallback to logo_url.
    const displayImage = photos && photos.length > 0 ? photos[0].url : logo_url;

    const handleLinkClick = (e: React.MouseEvent, title: string, content: string) => {
        e.preventDefault();
        if (content.toLowerCase().startsWith('http://') || content.toLowerCase().startsWith('https://')) {
            window.open(content, '_blank');
        } else {
            setPolicyModal({ title, content });
        }
    };

    return (
        <section className="bg-white border-t border-slate-200 mt-12 pb-0 shadow-sm relative z-10">
            <div className="max-w-7xl mx-auto">
                <div className="p-6 md:p-10">
                    <div className="flex flex-col lg:flex-row gap-10">
                        {/* Left Side: Property Details & Photos */}
                        <div className="flex-1 flex flex-col md:flex-row gap-6 lg:gap-10">
                            {/* Image Section */}
                            <div className="w-full md:w-[280px] shrink-0">
                                <div className="w-full aspect-[4/3] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative group">
                                    {displayImage ? (
                                        <img src={displayImage} alt={name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50">
                                            <span className="text-4xl font-black text-indigo-200">{name.charAt(0).toUpperCase()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Details Section */}
                            <div className="flex-1 flex flex-col justify-between py-1">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 mb-1">{name}</h2>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-4">
                                        <MapPin className="w-3.5 h-3.5" />
                                        <span>{address?.city}, {address?.state}</span>
                                    </div>
                                    {description ? (
                                        <p className="text-[13px] text-slate-600 leading-relaxed mb-6 text-justify max-w-prose line-clamp-4 md:line-clamp-none">
                                            {description}
                                        </p>
                                    ) : (
                                        <p className="text-[13px] text-slate-400 italic mb-6">Experience the best of hospitality with us.</p>
                                    )}
                                </div>

                                {/* Links Section */}
                                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-[13px] font-bold text-indigo-600">
                                    {contact?.website ? (
                                        <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-800 transition-colors hover:underline">Home</a>
                                    ) : (
                                        <a href="#" className="hover:text-indigo-800 transition-colors hover:underline">Home</a>
                                    )}
                                    
                                    {settings?.terms_conditions && (
                                        <button onClick={(e) => handleLinkClick(e, 'Terms & Conditions', settings.terms_conditions!)} className="hover:text-indigo-800 transition-colors hover:underline">Terms & Conditions</button>
                                    )}
                                    {settings?.privacy_policy && (
                                        <button onClick={(e) => handleLinkClick(e, 'Privacy Policy', settings.privacy_policy!)} className="hover:text-indigo-800 transition-colors hover:underline">Privacy Policy</button>
                                    )}
                                    {settings?.payment_policy && (
                                        <button onClick={(e) => handleLinkClick(e, 'Payment Terms', settings.payment_policy!)} className="hover:text-indigo-800 transition-colors hover:underline">Payment Terms</button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Important Information (Compact) */}
                        {policies.length > 0 && (
                            <div className="w-full lg:w-[350px] shrink-0 bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                <div className="flex items-center gap-2 mb-4 border-b border-slate-200/60 pb-3">
                                    <FileText className="w-4 h-4 text-violet-500" />
                                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Important Info</h3>
                                </div>
                                <div className="space-y-4 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                                    {policies.map((policy) => (
                                        <div key={policy.label} className="group">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-violet-400 transition-colors" />
                                                {policy.label}
                                            </p>
                                            <p className="text-[12px] text-slate-600 font-medium leading-relaxed pl-3 line-clamp-3">
                                                {policy.value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Address Bar */}
                <div className="bg-amber-500 text-amber-950 px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-bold border-t border-amber-600/20">
                    <div className="flex flex-wrap items-center gap-2 justify-center text-center md:text-left">
                        <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span>{name}, {fullAddress}</span>
                    </div>
                    {settings?.gst_number && (
                        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 bg-amber-950/10 rounded-full">
                            <span>Business/GST No: <span className="font-black">{settings.gst_number}</span></span>
                        </div>
                    )}
                </div>
            </div>

            {/* Policy Modal */}
            <Dialog open={!!policyModal} onOpenChange={() => setPolicyModal(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-[2rem] p-8">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-slate-800 mb-2">{policyModal?.title}</DialogTitle>
                    </DialogHeader>
                    <div className="prose prose-sm prose-slate max-w-none font-medium whitespace-pre-wrap leading-relaxed text-slate-600">
                        {policyModal?.content}
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    );
}
