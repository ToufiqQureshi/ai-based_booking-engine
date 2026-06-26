// @ts-nocheck
import React from 'react';
import { Link } from 'react-router-dom';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';

export default function PrivacyPolicy() {
    return (
        <div className="font-sans antialiased bg-[#0A0505] text-white relative selection:bg-[#F43F5E]/30 overflow-x-hidden" style={{ backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            <LandingHeader />
            {/* Ambient background glows */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]"></div>
                <div className="absolute top-[800px] right-1/4 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[150px]"></div>
            </div>

            <div id="header-placeholder"></div>

    {/* HEADER BLOCK: Radial Glow Legal Title Banner */}
    <section className="relative pt-44 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center overflow-hidden">
        <div id="threejs-container" className="absolute inset-0 pointer-events-none z-0 opacity-20"></div>

        <div className="relative z-10 space-y-4">
            <span id="hero-badge" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-accentCyan font-medium opacity-0">
                <span className="w-2 h-2 rounded-full bg-accentCyan animate-pulse"></span>
                Legal Framework & Data Protection Compliance
            </span>

            <h1 id="hero-title" className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 opacity-0">
                Privacy Policy
            </h1>
            
            <p id="hero-desc" className="text-slate-500 font-mono text-xs opacity-0">
                Effective Date: <span className="text-white font-bold">June 02, 2026</span> • Platform: <span className="text-white font-bold">Staybooker.ai</span>
            </p>
        </div>
    </section>

    {/* CONTENT GRID: Sticky Quick-Navigation & Clean Typography Sections */}
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 relative z-10 grid lg:grid-cols-12 gap-12 text-left">
        
        {/* LEFT COLUMN: Sticky Legal Navigation Bar */}
        <aside className="lg:col-span-4 hidden lg:block">
            <div className="glass-panel p-6 rounded-2xl border border-white/10 sticky top-28 space-y-4">
                <h4 className="text-xs font-bold font-mono uppercase tracking-widest text-accentCyan pb-2 border-b border-white/5">Table of Contents</h4>
                
                <nav className="flex flex-col space-y-1 text-xs font-mono text-slate-400">
                    <a href="#introduction" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">1. Introduction</a>
                    <a href="#scope" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">2. Scope</a>
                    <a href="#collect" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">3. Information We Collect</a>
                    <a href="#how-collect" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">4. How We Collect Info</a>
                    <a href="#purpose" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">5. Purpose of Processing</a>
                    <a href="#ai" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">6. AI & Automated Services</a>
                    <a href="#google" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">7. Google & Third-Party</a>
                    <a href="#google-data" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">8. Google User Data</a>
                    <a href="#legal-basis" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">9. Legal Basis for Processing</a>
                    <a href="#retention" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">10. Data Retention</a>
                    <a href="#sharing" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">11. Sharing & Disclosure</a>
                    <a href="#rights" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">15. Your Rights</a>
                    <a href="#contact" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">21. Contact Information</a>
                </nav>
            </div>
        </aside>

        {/* RIGHT COLUMN: Structured Text Content */}
        <article className="lg:col-span-8 space-y-12 text-sm text-slate-300 leading-relaxed font-sans reveal-up">
            
            {/* Quick Legal Metadata Banner */}
            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5 font-mono text-xs text-slate-400">
                <div className="flex justify-between"><span>Legal Entity:</span> <span className="text-white font-semibold">Transinterface Digiserv Pvt. Ltd.</span></div>
                <div className="flex justify-between"><span>Website:</span> <span className="text-white font-semibold">www.staybooker.ai</span></div>
                <div className="flex justify-between"><span>Jurisdiction:</span> <span className="text-emerald-400 font-semibold">India (Digital Personal Data Protection Act, 2023)</span></div>
            </div>

            {/* 1. Introduction */}
            <section id="introduction" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    1. Introduction
                </h3>
                <p>
                    Staybooker.ai ("Platform", "we", "our", or "us") is owned and operated by Transinterface Digiserv Pvt. Ltd.
                </p>
                <p>
                    We are committed to protecting your privacy and personal information. This Privacy Policy explains how we collect, use, process, store, disclose, and safeguard personal data when you use our website, booking platform, WhatsApp services, AI-powered hospitality solutions, mobile applications, APIs, and related services.
                </p>
                <p>
                    By accessing or using Staybooker.ai, you acknowledge and consent to the collection and use of information in accordance with this Privacy Policy.
                </p>
            </section>

            {/* 2. Scope */}
            <section id="scope" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    2. Scope
                </h3>
                <p>
                    This Privacy Policy applies to all visitors, customers, hotel partners, business users, accommodation providers, vendors, and individuals who interact with Staybooker.ai through our website, applications, APIs, WhatsApp channels, booking systems, and related services.
                </p>
            </section>

            {/* 3. Information We Collect */}
            <section id="collect" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    3. Information We Collect
                </h3>
                <p>We may collect the following categories of information:</p>
                
                <div className="grid md:grid-cols-2 gap-4 pt-2">
                    {/* Identity */}
                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                        <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">Identity Information</h5>
                        <ul className="list-disc pl-4 text-xs text-slate-400 space-y-1">
                            <li>Full name</li>
                            <li>Business name</li>
                            <li>Designation</li>
                            <li>Government-issued ID (where required)</li>
                        </ul>
                    </div>
                    {/* Contact */}
                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                        <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">Contact Information</h5>
                        <ul className="list-disc pl-4 text-xs text-slate-400 space-y-1">
                            <li>Email address</li>
                            <li>Mobile number</li>
                            <li>Mailing address</li>
                        </ul>
                    </div>
                    {/* Booking */}
                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                        <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">Booking Information</h5>
                        <ul className="list-disc pl-4 text-xs text-slate-400 space-y-1">
                            <li>Reservation details</li>
                            <li>Hotel preferences</li>
                            <li>Travel & Guest parameters</li>
                        </ul>
                    </div>
                    {/* Payments */}
                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                        <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">Payment Information</h5>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            Billing details & Transaction records. Payment card details are processed by authorized payment gateways. Staybooker.ai does not store complete card information unless required by law.
                        </p>
                    </div>
                </div>

                <div className="pt-4 space-y-3">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">Technical & Usage Information</h5>
                    <p className="text-xs text-slate-400">
                        IP address, device identifiers, operating systems, location boundaries, search history, customer support communications, WhatsApp logs, and platform interactions.
                    </p>
                </div>
            </section>

            {/* 4. How We Collect Information */}
            <section id="how-collect" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    4. How We Collect Information
                </h3>
                <p>We collect information:</p>
                <ul className="list-disc pl-6 space-y-2 text-slate-400">
                    <li>Directly from users through forms, registrations, and bookings.</li>
                    <li>Through reservation and inquiry submissions.</li>
                    <li>Through WhatsApp and customer support communications.</li>
                    <li>Through cookies, analytics tools, and tracking technologies.</li>
                    <li>Through hotel partners and accommodation providers.</li>
                    <li>Through payment processors, technology partners, and third-party services.</li>
                </ul>
            </section>

            {/* 5. Purpose of Processing */}
            <section id="purpose" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    5. Purpose of Processing
                </h3>
                <p>We use personal information to:</p>
                <ul className="grid md:grid-cols-2 gap-2 text-xs text-slate-400 pl-4 list-disc">
                    <li>Process bookings and reservations</li>
                    <li>Deliver hospitality and travel services</li>
                    <li>Facilitate partner-to-guest communications</li>
                    <li>Respond to inquiries & support requests</li>
                    <li>Improve platform UI/UX functionality</li>
                    <li>Prevent fraud and unauthorized activities</li>
                    <li>Comply with legal, regulatory obligations</li>
                </ul>
            </section>

            {/* 6. AI and Automated Services */}
            <section id="ai" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    6. AI and Automated Services
                </h3>
                <p>
                    Staybooker.ai may use artificial intelligence and automated technologies to assist with booking recommendations, customer support, hospitality services, analytics, and user experience improvements.
                </p>
                <p className="text-slate-400 text-xs italic">
                    Such technologies are designed to support service delivery and operational efficiency. Users should independently verify important booking information before relying on automated outputs.
                </p>
            </section>

            {/* 7. Google Services and Third-Party Technologies */}
            <section id="google" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    7. Google Services and Third-Party Technologies
                </h3>
                <p>
                    Staybooker.ai may use Google services and technologies, including but not limited to Google Analytics, Google Maps, Google Sign-In, Google OAuth services, Google Hotel-related integrations, and other Google products that support platform functionality, user authentication, analytics, and service delivery.
                </p>
                <p>
                    Information collected through Google services may include account identifiers, usage information, device information, and other data necessary to provide requested services. Such information is processed in accordance with this Privacy Policy and applicable agreements with Google.
                </p>
                <p>
                    Users may learn more about Google's privacy practices by visiting <a href="https://policies.google.com/privacy" className="text-accentCyan hover:underline font-mono" target="_blank">Google's Privacy Policy</a>.
                </p>
            </section>

            {/* 8. Google User Data (Highlighted Block) */}
            <section id="google-data" className="p-6 bg-red-950/10 border border-accentCyan/20 rounded-2xl space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accentCyan animate-pulse"></span>
                    8. Google User Data
                </h3>
                <p className="text-xs text-slate-300">
                    Where users choose to authenticate using Google Sign-In or authorize access through Google OAuth services, Staybooker.ai may collect and process information made available by Google, including:
                </p>
                <ul className="list-disc pl-6 text-xs text-slate-400 space-y-1.5">
                    <li>Name, Email address & Profile details</li>
                    <li>Unique account identifiers</li>
                    <li>Other explicitly authorized permissions</li>
                </ul>
                <p className="text-xs text-slate-300 font-bold">Google user data is used solely for:</p>
                <ul className="list-disc pl-6 text-xs text-slate-400 space-y-1">
                    <li>User authentication and account management</li>
                    <li>Providing requested services and platform functionality</li>
                    <li>Customer support, account verification, and security</li>
                </ul>
                <p className="text-[11px] text-slate-400">
                    Staybooker.ai does not sell Google user data to third parties. Google user data will not be used for advertising purposes unless specifically disclosed and authorized by the user where required by law. Users may revoke Staybooker.ai's access to their Google account permissions at any time through their Google Account settings.
                </p>
            </section>

            {/* 9. Legal Basis for Processing */}
            <section id="legal-basis" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    9. Legal Basis for Processing
                </h3>
                <p>We process personal data based on:</p>
                <ul className="list-disc pl-6 text-slate-400 space-y-1">
                    <li>User consent</li>
                    <li>Contractual necessity</li>
                    <li>Compliance with legal obligations</li>
                    <li>Legitimate business interests (DPDP Act, 2023 guidelines)</li>
                </ul>
            </section>

            {/* 10. Data Retention */}
            <section id="retention" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    10. Data Retention
                </h3>
                <p>
                    <b className="text-white">Google User Data obtained through Google APIs</b> will be retained only for as long as necessary to provide requested services, comply with legal obligations, resolve disputes, enforce agreements, and maintain platform security. When such data is no longer required, it will be deleted, anonymized, or securely disposed of in accordance with applicable laws and industry practices.
                </p>
                <p>
                    Personal data is retained only for as long as reasonably necessary to fulfill contractual bounds, legal compliance cycles, and dispute resolutions.
                </p>
            </section>

            {/* 11. Data Sharing and Disclosure */}
            <section id="sharing" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    11. Data Sharing and Disclosure
                </h3>
                <p className="font-bold text-white text-xs font-mono uppercase tracking-wider">We do not sell personal data.</p>
                <p>We may share information with:</p>
                <ul className="grid md:grid-cols-2 gap-1.5 pl-4 list-disc text-xs text-slate-400">
                    <li>Hotels and accommodation partners</li>
                    <li>Payment processors and banks</li>
                    <li>Technology service providers</li>
                    <li>Analytics & customer support platforms</li>
                    <li>Legal and regulatory authorities</li>
                    <li>Business successors (mergers, acquisitions)</li>
                </ul>
            </section>

            {/* 12. WhatsApp Communications */}
            <section id="whatsapp" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    12. WhatsApp Communications
                </h3>
                <p>
                    Staybooker.ai may communicate with users through WhatsApp Business services for booking confirmations, reservation updates, customer support, service notifications, and promotional communications where consent has been provided. Users may opt out of promotional communications at any time.
                </p>
            </section>

            {/* 13. Cookies and Analytics */}
            <section id="cookies" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    13. Cookies and Analytics
                </h3>
                <p>
                    We use cookies, pixels, and tracking tools to improve website performance, understand user behavior, analyze traffic patterns, and measure marketing effectiveness. Users may manage cookie preferences through browser settings.
                </p>
            </section>

            {/* 14. Data Security */}
            <section id="security" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    14. Data Security
                </h3>
                <p>
                    We implement reasonable technical, administrative, and organizational safeguards designed to protect personal data against unauthorized access, misuse, disclosure, alteration, or destruction. However, no internet-based platform or transmission can guarantee absolute security.
                </p>
            </section>

            {/* 15. Your Rights */}
            <section id="rights" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    15. Your Rights
                </h3>
                <p>
                    Users who have authorized access through Google services may revoke permissions and disconnect their Google account at any time through their Google Account settings or by contacting <a href="mailto:support@staybooker.ai" className="text-accentCyan hover:underline font-mono">support@staybooker.ai</a>.
                </p>
                <p>Subject to applicable laws, users may:</p>
                <ul className="list-disc pl-6 text-slate-400 space-y-1">
                    <li>Access personal data or request corrections</li>
                    <li>Request deletion of personal data</li>
                    <li>Withdraw consent where processing is based on consent</li>
                    <li>Nominate another person to exercise rights under applicable law</li>
                </ul>
            </section>

            {/* 16. Data Deletion Requests */}
            <section id="deletion" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    16. Data Deletion Requests
                </h3>
                <p>
                    Users may request deletion of their personal information by contacting: <a href="mailto:support@staybooker.ai" className="text-accentCyan hover:underline font-mono">support@staybooker.ai</a>.
                </p>
                <p className="text-xs text-slate-400 italic">
                    Certain information may be retained where required by law, regulatory obligations, dispute resolution, or fraud prevention measures.
                </p>
            </section>

            {/* 17-20. Transfers, Children's Privacy, 3rd Party, changes */}
            <section id="legal-miscellaneous" className="space-y-6 scroll-mt-28">
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">17. Cross-Border Transfers</h5>
                    <p className="text-xs text-slate-400">Where personal data is transferred outside India, appropriate safeguards and contractual protections will be implemented in accordance with applicable laws.</p>
                </div>
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">18. Children's Privacy</h5>
                    <p className="text-xs text-slate-400">Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal information from children.</p>
                </div>
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">19. Third-Party Websites and Services</h5>
                    <p className="text-xs text-slate-400">We are not responsible for the privacy practices, policies, or content of third-party platforms linked on our website.</p>
                </div>
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">20. Changes to this Privacy Policy</h5>
                    <p className="text-xs text-slate-400">We reserve the right to update, modify, or revise this policy. Continued use of the platform constitutes acceptance of the revised terms.</p>
                </div>
            </section>

            {/* 21. Contact Information */}
            <section id="contact" className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    21. Contact Information
                </h3>
                <p>For privacy-related inquiries, requests, complaints, data deletion requests, or data protection concerns, please contact:</p>
                
                <div className="space-y-1 font-mono text-xs text-slate-400 pt-2">
                    <div className="text-white font-bold text-sm font-sans mb-1">Transinterface Digiserv Pvt. Ltd.</div>
                    <div>Registered Office: Transinterface Digiserv Pvt. Ltd., India</div>
                    <div>Email: <a href="mailto:support@staybooker.ai" className="text-accentCyan hover:underline">support@staybooker.ai</a></div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-1.5 font-mono text-xs text-slate-400">
                    <div className="text-white font-bold font-sans">Grievance Officer (India):</div>
                    <div>Email: <a href="mailto:support@staybooker.ai" className="text-accentCyan hover:underline">support@staybooker.ai</a></div>
                    <div>Website: <a href="https://www.staybooker.ai" className="text-slate-300 hover:text-white" target="_blank">www.staybooker.ai</a></div>
                </div>
            </section>

        </article>

    </main>

            <LandingFooter />
        </div>
    );
}
