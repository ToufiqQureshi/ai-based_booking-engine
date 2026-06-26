// @ts-nocheck
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function RefundCancellation() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="legal-page-container">
            

    
    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primaryBlue/10 rounded-full blur-[120px] pointer-events-none"></div>
    <div className="absolute top-[700px] right-1/4 w-[600px] h-[600px] bg-accentCyan/5 rounded-full blur-[150px] pointer-events-none"></div>
                        
    
    <div id="header-placeholder"></div>

    
    <section className="relative pt-44 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center overflow-hidden">
        <div id="threejs-container" className="absolute inset-0 pointer-events-none z-0 opacity-20"></div>

        <div className="relative z-10 space-y-4">
            <span id="hero-badge" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-accentCyan font-medium opacity-0">
                <span className="w-2 h-2 rounded-full bg-accentCyan animate-pulse"></span>
                Reservation Cancellation & SaaS Billing Rules
            </span>

            <h1 id="hero-title" className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 opacity-0">
                Refund & Cancellation Policy
            </h1>
            
            <p id="hero-desc" className="text-slate-500 font-mono text-xs opacity-0">
                Effective Date: <span className="text-white font-bold">June 02, 2026</span> • Last Updated: <span className="text-white font-bold">June 02, 2026</span>
            </p>
        </div>
    </section>

    
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 relative z-10 grid lg:grid-cols-12 gap-12 text-left">
        
        
        <aside className="lg:col-span-4 hidden lg:block">
            <div className="glass-panel p-6 rounded-2xl border border-white/10 sticky top-28 space-y-4">
                <h4 className="text-xs font-bold font-mono uppercase tracking-widest text-accentCyan pb-2 border-b border-white/5">Table of Contents</h4>
                
                <nav className="flex flex-col space-y-1 text-xs font-mono text-slate-400">
                    <a href="#introduction" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">1. Introduction</a>
                    <a href="#scope" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">2. Scope</a>
                    <a href="#hotel-reservations" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">3. Hotel Reservations</a>
                    <a href="#cancellation-requests" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">4. Cancellation Requests</a>
                    <a href="#non-refundable" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">6. Non-Refundable Rules</a>
                    <a href="#no-show" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">8. No-Show Policy</a>
                    <a href="#inventory-disclaimer" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">9. Inventory Disclaimer</a>
                    <a href="#refund-processing" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">11. Refund Processing</a>
                    <a href="#subscription-saas" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">15. Subscription & SaaS</a>
                    <a href="#exceptional-circumstances" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">19. Exceptional Cases</a>
                    <a href="#contact" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">23. Contact Information</a>
                </nav>
            </div>
        </aside>

        
        <article className="lg:col-span-8 space-y-12 text-sm text-slate-300 leading-relaxed font-sans reveal-up">
            
            
            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5 font-mono text-xs text-slate-400">
                <div className="flex justify-between"><span>Legal Entity:</span> <span className="text-white font-semibold">Transinterface Digiserv Pvt. Ltd.</span></div>
                <div className="flex justify-between"><span>Website:</span> <span className="text-white font-semibold">www.staybooker.ai</span></div>
                <div className="flex justify-between"><span>Disbursement Gateway:</span> <span className="text-emerald-400 font-semibold">Original Payment Source</span></div>
            </div>

            
            <section id="introduction" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    1. Introduction
                </h3>
                <p>
                    This Refund and Cancellation Policy governs bookings, reservations, subscriptions, software services, AI-powered solutions, hospitality technology services, and transactions conducted through Staybooker.ai.
                </p>
                <p>
                    By accessing or using Staybooker.ai, users acknowledge and agree to the refund, cancellation, modification, and payment terms described in this policy.
                </p>
                <p>
                    This policy should be read together with our Terms and Conditions and Privacy Policy.
                </p>
            </section>

            
            <section id="scope" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    2. Scope
                </h3>
                <p>This policy applies to:</p>
                <ul className="list-disc pl-6 text-slate-400 space-y-1.5">
                    <li>Hotel and accommodation bookings</li>
                    <li>Hospitality-related services & Reservation management services</li>
                    <li>Software subscriptions and SaaS products</li>
                    <li>AI-powered services and platform access</li>
                    <li>Promotional offers and discounts</li>
                </ul>
                <p className="text-xs text-slate-400 italic mt-2">
                    Specific booking conditions displayed at the time of reservation may supersede portions of this policy where expressly stated.
                </p>
            </section>

            
            <section id="hotel-reservations" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    3. Hotel Reservations
                </h3>
                <p>
                    Staybooker.ai acts as a technology platform connecting users with hotels, accommodation providers, hospitality partners, and booking systems.
                </p>
                <p>
                    Cancellation eligibility, modification rights, refund amounts, and booking conditions are generally determined by the respective accommodation provider. Users are responsible for reviewing all booking conditions before completing a reservation.
                </p>
            </section>

            
            <section id="cancellation-requests" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    4. Cancellation Requests
                </h3>
                <p>Users may request cancellation through:</p>
                <ul className="list-disc pl-6 text-slate-400 space-y-1">
                    <li>The Staybooker.ai platform where available</li>
                    <li>Customer support channels</li>
                    <li>Hotel or accommodation provider channels where applicable</li>
                </ul>
                <p>
                    Cancellation requests are considered effective only after confirmation is issued by the relevant provider or booking system. Submission of a request does not automatically guarantee cancellation or refund eligibility.
                </p>
            </section>

            
            <section id="free-cancellation" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    5. Free Cancellation Reservations
                </h3>
                <p>
                    Where a reservation includes a free cancellation period, users may cancel the booking within the specified timeframe and receive a refund in accordance with the property's cancellation policy. The cancellation deadline displayed at booking shall govern eligibility.
                </p>
            </section>

            
            <section id="non-refundable" className="p-6 bg-red-950/10 border border-accentCyan/20 rounded-2xl space-y-3 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accentCyan animate-pulse"></span>
                    6. Non-Refundable Reservations
                </h3>
                <p className="text-xs text-slate-300">
                    Certain reservations may be designated as non-refundable. Examples include:
                </p>
                <ul className="grid grid-cols-2 gap-2 text-xs text-slate-400 pl-4 list-disc">
                    <li>Promotional rates</li>
                    <li>Flash sales</li>
                    <li>Holiday and peak-season offers</li>
                    <li>Special event reservations</li>
                    <li>Limited-time campaigns</li>
                    <li>Advance purchase bookings</li>
                </ul>
                <p className="text-[11px] text-slate-400 pt-2">
                    Where a reservation is identified as non-refundable, no refund will be provided unless required by applicable law or expressly approved by the accommodation provider.
                </p>
            </section>

            
            <section id="booking-modifications" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    7. Booking Modifications
                </h3>
                <p>Changes to reservations may include travel dates, guest information, room category upgrades, occupancy changes, or special requests. Modification requests remain subject to hotel availability, provider approval, rate differences, and additional charges. Staybooker.ai does not guarantee modification approval.</p>
            </section>

            
            <section id="no-show" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    8. No-Show Policy
                </h3>
                <p>
                    A "No-Show" occurs when a guest fails to arrive or check in on the scheduled arrival date without canceling in accordance with the applicable booking terms.
                </p>
                <ul className="list-disc pl-6 text-slate-400 space-y-1">
                    <li>All or part of the booking amount may be retained by the accommodation provider.</li>
                    <li>Refund eligibility will depend on the provider's policies.</li>
                    <li>Additional charges may apply where permitted.</li>
                </ul>
                <p className="text-xs text-slate-400">
                    Staybooker.ai shall not be responsible for refund decisions resulting from no-show situations.
                </p>
            </section>

            
            <section id="inventory-disclaimer" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    9. Booking Confirmation and Inventory Disclaimer
                </h3>
                <p>
                    Booking confirmations are generated based on information received from accommodation providers and integrated reservation systems. Although reasonable efforts are made to ensure accuracy, Staybooker.ai cannot guarantee continuous room availability, pricing accuracy, property descriptions, amenities, or inventory synchronization across all systems.
                </p>
                <p>
                    In rare cases involving inventory discrepancies, technical errors, force majeure events, supplier failures, or pricing issues, reservations may be modified, substituted, or canceled. Where appropriate, users may be offered an alternative booking, credit, or refund in accordance with provider policies.
                </p>
            </section>

            
            <section id="refund-eligibility" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    10. Refund Eligibility
                </h3>
                <p>
                    Refund eligibility depends on booking conditions, cancellation timing, hotel policies, promotional restrictions, payment status, and applicable legal requirements. Refund approval does not occur automatically and may require review by the accommodation provider or Staybooker.ai.
                </p>
            </section>

            
            <section id="refund-processing" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    11. Refund Processing
                </h3>
                <p>
                    Approved refunds will generally be issued through the original payment method used for the transaction. Processing times may vary depending on banks, credit card networks, payment gateways, financial institutions, and international payment systems. Refunds typically appear within 7–14 business days but may require additional time depending on the payment provider.
                </p>
            </section>

            
            <section id="duplicate-taxes-promotional" className="space-y-6 scroll-mt-28">
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">12. Duplicate Payments</h5>
                    <p className="text-xs text-slate-400">If a user is accidentally charged more than once for the same transaction, Staybooker.ai may investigate and process a refund for any verified duplicate payment. Users should report duplicate transactions promptly.</p>
                </div>
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">13. Taxes, Fees, and Charges</h5>
                    <p className="text-xs text-slate-400">Refunds may exclude taxes where required by law, service fees, processing charges, third-party fees, and non-refundable charges imposed by accommodation providers.</p>
                </div>
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">14. Promotional Offers and Credits</h5>
                    <p className="text-xs text-slate-400">Coupons, promotional credits, reward points, discount vouchers, or referral bonuses may expire upon cancellation, be forfeited upon refund approval, and carry no cash value unless stated otherwise.</p>
                </div>
            </section>

            
            <section id="subscription-saas" className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    15. Subscription and SaaS Services
                </h3>
                <p className="text-xs text-slate-300">
                    For software subscriptions, AI services, SaaS products, and recurring platform services:
                </p>
                <ul className="list-disc pl-6 text-xs text-slate-400 space-y-1.5">
                    <li>Subscription fees are generally non-refundable.</li>
                    <li>Users may cancel future renewals at any time to prevent future billing.</li>
                    <li>Current billing periods remain active until expiration; partial-month refunds are not available.</li>
                </ul>
                <p className="text-[11px] text-slate-500 font-mono">
                    Access will typically continue until the end of the paid subscription term.
                </p>
            </section>

            
            <section id="payments-security" className="space-y-6 scroll-mt-28">
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">16. Failed Payments</h5>
                    <p className="text-xs text-slate-400">Staybooker.ai reserves the right to suspend, restrict, or terminate services where payment authorization fails, chargebacks occur, or outstanding balances remain unpaid.</p>
                </div>
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">17. Fraudulent Transactions</h5>
                    <p className="text-xs text-slate-400">Refund requests associated with fraud, abuse, chargeback manipulation, unauthorized activity, or violations of applicable laws may be denied. We cooperate with financial institutions and legal authorities.</p>
                </div>
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">18. Service Interruptions</h5>
                    <p className="text-xs text-slate-400">Temporary interruptions caused by maintenance activities, software updates, network disruptions, third-party outages, or force majeure events do not automatically qualify users for refunds.</p>
                </div>
            </section>

            
            <section id="exceptional-circumstances" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    19. Exceptional Circumstances
                </h3>
                <p>
                    Staybooker.ai may review refund requests arising from extraordinary circumstances on a case-by-case basis. Examples include medical emergencies, government travel restrictions, natural disasters, or major transportation disruptions. Approval remains at the sole discretion of Staybooker.ai and the applicable provider.
                </p>
            </section>

            
            <section id="disputes-rights" className="space-y-6 scroll-mt-28">
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">20. Chargebacks and Payment Disputes</h5>
                    <p className="text-xs text-slate-400">Users agree to contact Staybooker.ai before initiating chargebacks, card disputes, or payment claims. We reserve the right to provide transaction records and communication evidence to payment processors and regulators.</p>
                </div>
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">21. Consumer Rights</h5>
                    <p className="text-xs text-slate-400">Nothing in this policy shall exclude or limit any rights that cannot be excluded under applicable consumer protection laws.</p>
                </div>
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">22. Policy Updates</h5>
                    <p className="text-xs text-slate-400">Staybooker.ai reserves the right to modify, amend, or update this policy at any time. Continued use of the platform constitutes acceptance of the revised policy.</p>
                </div>
            </section>

            
            <section id="contact" className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    23. Contact Information
                </h3>
                <p>For refund requests, booking cancellations, or related queries, please contact our support desk:</p>
                
                <div className="space-y-1 font-mono text-xs text-slate-400 pt-2">
                    <div className="text-white font-bold text-sm font-sans mb-1">Transinterface Digiserv Pvt. Ltd.</div>
                    <div>Registered Address: Transinterface Digiserv Pvt. Ltd., India</div>
                    <div>Email: <a href="mailto:support@staybooker.ai" className="text-accentCyan hover:underline">support@staybooker.ai</a></div>
                    <div>Website: <a href="https://www.staybooker.ai" className="text-slate-300 hover:text-white" target="_blank">www.staybooker.ai</a></div>
                </div>
            </section>

        </article>

    </main>

    
    <div id="footer-placeholder"></div>

    
    

        </div>
    );
}
