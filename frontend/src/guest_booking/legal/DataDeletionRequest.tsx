// @ts-nocheck
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function DataDeletionRequest() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="legal-page-container">
            

    
    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primaryBlue/10 rounded-full blur-[120px] pointer-events-none"></div>
    <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-accentCyan/5 rounded-full blur-[150px] pointer-events-none"></div>

    
    <div id="header-placeholder"></div>

    
    <section className="relative pt-44 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center overflow-hidden">
        <div id="threejs-deletion-container" className="absolute inset-0 pointer-events-none z-0 opacity-30"></div>
        
        <div className="relative z-10 space-y-4 max-w-3xl mx-auto">
            <div id="hero-badge" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-accentCyan font-medium opacity-0">
                <span className="w-2 h-2 rounded-full bg-accentCyan animate-pulse"></span>
                Privacy Operations Dashboard
            </div>
            <h1 id="hero-title" className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 opacity-0">
                Data Deletion Requests
            </h1>
            <div id="hero-desc" className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-slate-400 opacity-0">
                <span>Effective Date: June 02, 2026</span>
                <span className="text-white/20">•</span>
                <span>Last Updated: June 02, 2026</span>
            </div>
        </div>
    </section>

    
    <section className="py-6 pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-12 gap-8 items-stretch max-w-6xl mx-auto">
            
            
            <div className="lg:col-span-7 glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-4 text-left reveal-up">
                <h4 className="text-xs font-semibold uppercase text-slate-400 font-mono flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accentCyan animate-pulse"></span>
                    Direct Data Deletion Portal
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Full Name</label>
                        <input type="text" id="del-name" placeholder="Full Registered Name" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-xs focus:outline-none focus:border-accentCyan/50 text-white w-full transition-colors" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Registered Email Address</label>
                        <input type="email" id="del-email" placeholder="email@domain.com" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-xs focus:outline-none focus:border-accentCyan/50 text-white w-full transition-colors" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Mobile Number (Optional)</label>
                        <input type="text" id="del-phone" placeholder="+1 (555) 000-0000" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-xs focus:outline-none focus:border-accentCyan/50 text-white w-full transition-colors" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Booking Reference (Optional)</label>
                        <input type="text" id="del-ref" placeholder="Reference Number" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-xs focus:outline-none focus:border-accentCyan/50 text-white w-full transition-colors" />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Request Details & Focus Parameters</label>
                    <textarea id="del-statement" rows="3" placeholder="Please specify if you want specific records or full account structures purged..." className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-xs focus:outline-none focus:border-accentCyan/50 text-white w-full transition-colors resize-none"></textarea>
                </div>

                <div className="flex items-start gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
                    <input type="checkbox" id="del-consent" className="mt-0.5 rounded border-white/10 bg-white/5 text-accentCyan focus:ring-accentCyan/50 cursor-pointer" />
                    <label htmlFor="del-consent" className="text-[10px] text-slate-400 leading-normal cursor-pointer">
                        I confirm that I am the authorized owner of this account data, and understand that account deletion is permanent and irreversible.
                    </label>
                </div>

                <button onclick="transmitDeletionPayload()" className="w-full py-4 rounded-xl bg-gradient-to-r from-primaryBlue to-accentCyan text-white font-bold text-xs uppercase tracking-wide shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all duration-300">
                    Submit Purge Request
                </button>
            </div>

            
            <div className="lg:col-span-5 glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 text-left flex flex-col justify-between reveal-up">
                <div className="space-y-4">
                    <h4 className="text-xs font-semibold uppercase text-slate-400 font-mono border-b border-white/5 pb-2">Verification Operations Log</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        StayBooker requires immediate structural verification. Your submission details trigger automatic routing protocols directly to our security pipeline.
                    </p>
                </div>

                
                <div className="bg-black/60 border border-white/10 p-4 rounded-xl font-mono text-[10px] text-slate-400 space-y-2 mt-4" id="purge-terminal">
                    <div className="text-slate-600">[14:22:04] Operations pipeline initialized...</div>
                    <div className="text-slate-500">[14:22:05] Idle. Ready for dynamic data allocation.</div>
                </div>

                <div className="pt-4 border-t border-white/5 mt-4 text-[10px] text-slate-500">
                    Requests are processed according to our general operational timelines (usually within 30 business days).
                </div>
            </div>

        </div>
    </section>

    
    <section className="pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-12 gap-8 items-start">
            
            
            <aside className="hidden lg:block lg:col-span-3 sticky top-32 glass-panel p-5 rounded-2xl border border-white/5 text-left text-xs space-y-1 max-h-[70vh] overflow-y-auto">
                <h4 className="text-[10px] font-mono tracking-widest text-slate-400 uppercase mb-3 px-3">Sections</h4>
                <nav className="space-y-0.5" id="toc-nav">
                    <a href="#introduction" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">1. Introduction</a>
                    <a href="#right-to-request" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">2. Right to Request</a>
                    <a href="#how-to-submit" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">3. How to Submit</a>
                    <a href="#alternative-methods" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">4. Alternative Methods</a>
                    <a href="#verification" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">5. Identity Verification</a>
                    <a href="#eligible-info" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">6. Eligible Information</a>
                    <a href="#google-data" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">7. Google Data Deletion</a>
                    <a href="#retained-info" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">8. Retained Information</a>
                    <a href="#timeline" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">9. Processing Timeline</a>
                    <a href="#confirmation" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">10. Confirmation</a>
                    <a href="#backup" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">11. Backup Information</a>
                    <a href="#effect" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">12. Effect of Deletion</a>
                    <a href="#third-parties" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">13. Third-Party Providers</a>
                    <a href="#refusal" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">14. Refused Requests</a>
                    <a href="#copy" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">15. Copy of Your Data</a>
                    <a href="#withdrawal" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">16. Withdrawal of Consent</a>
                    <a href="#contact-info" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">17. Contact Info</a>
                    <a href="#changes" className="block py-2 px-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium">18. Policy Changes</a>
                </nav>
            </aside>

            
            <main className="lg:col-span-9 glass-panel p-6 sm:p-12 rounded-3xl border border-white/5 text-left relative overflow-hidden space-y-10" id="legal-content">
                
                
                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2 text-xs font-mono text-slate-400">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <span>Platform: <b className="text-white">Staybooker.ai</b></span>
                        <span>Legal Entity: <b className="text-white">Transinterface Digiserv Pvt. Ltd.</b></span>
                        <span>Website: <a href="https://www.staybooker.ai" className="text-accentCyan hover:underline">www.staybooker.ai</a></span>
                    </div>
                </div>

                
                <section id="introduction" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">01.</span> Introduction
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Staybooker.ai respects the privacy rights of its users and is committed to providing transparent mechanisms for managing personal information. This Data Deletion Policy explains how users may request the deletion of personal data collected through Staybooker.ai and related services.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        This policy applies to personal information collected through our website, applications, booking systems, APIs, WhatsApp communications, customer support channels, and other services operated by Transinterface Digiserv Pvt. Ltd.
                    </p>
                </section>

                
                <section id="right-to-request" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">02.</span> Right to Request Deletion
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Subject to applicable laws, users may request the deletion of personal information associated with their Staybooker.ai account or services.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Users may exercise this right at any time by submitting a deletion request using the contact details provided in this policy.
                    </p>
                </section>

                
                <section id="how-to-submit" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">03.</span> How to Submit a Data Deletion Request
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Users may request deletion of their personal information by sending an email to:
                    </p>
                    <p className="text-xs sm:text-sm text-accentCyan font-mono font-bold">
                        support@staybooker.ai
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-semibold">
                        To help us verify and process the request efficiently, please include:
                    </p>
                    <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-400 space-y-1.5">
                        <li>Full Name</li>
                        <li>Registered Email Address</li>
                        <li>Mobile Number (if applicable)</li>
                        <li>Booking Reference Number (if applicable)</li>
                        <li>Details of the deletion request</li>
                    </ul>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Incomplete requests may require additional verification before processing.
                    </p>
                </section>

                
                <section id="alternative-methods" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">04.</span> Alternative Account Deletion Methods
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Where available, users may also delete their account and associated personal information directly through account settings within the Staybooker.ai platform.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-mono text-[11px]">
                        If an in-platform deletion feature is available, users may initiate deletion without contacting customer support, subject to verification and applicable legal requirements.
                    </p>
                </section>

                
                <section id="verification" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">05.</span> Identity Verification
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        To protect users from unauthorized access, fraudulent deletion requests, or misuse of personal information, Staybooker.ai may require reasonable identity verification before processing any deletion request. Verification methods may include:
                    </p>
                    <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-400 space-y-1.5">
                        <li>Confirmation through the registered email address</li>
                        <li>Account authentication</li>
                        <li>Verification of booking details</li>
                        <li>Additional supporting information where necessary</li>
                    </ul>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Failure to complete verification may delay or prevent processing of the request.
                    </p>
                </section>

                
                <section id="eligible-info" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">06.</span> Information Eligible for Deletion
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-semibold">
                        Subject to applicable legal and contractual obligations, users may request deletion of:
                    </p>
                    <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-400 space-y-1.5">
                        <li>User account information</li>
                        <li>Profile information</li>
                        <li>Contact details</li>
                        <li>Communication records</li>
                        <li>Marketing preferences</li>
                        <li>Customer support records</li>
                        <li>Booking-related personal information</li>
                        <li>Usage data associated with identifiable users</li>
                        <li>Other personal information maintained by Staybooker.ai</li>
                    </ul>
                </section>

                
                <section id="google-data" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">07.</span> Google User Data Deletion
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Where users have connected their Google account through Google Sign-In, Google OAuth, or other Google services, users may:
                    </p>
                    <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-400 space-y-1.5">
                        <li>Request deletion of Google-related account information stored by Staybooker.ai</li>
                        <li>Disconnect their Google account from Staybooker.ai</li>
                        <li>Revoke Staybooker.ai access through their Google Account security settings</li>
                    </ul>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Users may manage Google account permissions directly through their Google Account settings. Upon successful deletion, Google user data retained by Staybooker.ai will be deleted unless retention is required by law or legitimate business obligations.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-mono text-[11px]">
                        Staybooker.ai's use and transfer of information received from Google APIs will comply with the Google API Services User Data Policy, including the Limited Use requirements where applicable.
                    </p>
                </section>

                
                <section id="retained-info" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">08.</span> Information That May Be Retained
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-semibold">
                        Certain information may be retained where required for:
                    </p>
                    <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-400 space-y-1.5">
                        <li>Compliance with applicable laws and regulations</li>
                        <li>Tax, accounting, and financial recordkeeping obligations</li>
                        <li>Fraud prevention and security monitoring</li>
                        <li>Dispute resolution and legal claims</li>
                        <li>Contract enforcement</li>
                        <li>Regulatory investigations</li>
                        <li>Protection of platform integrity and security</li>
                    </ul>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Where retention is required, such information will remain protected in accordance with our Privacy Policy.
                    </p>
                </section>

                
                <section id="timeline" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">09.</span> Deletion Processing Timeline
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Staybooker.ai aims to acknowledge deletion requests within 7 business days of receipt. Eligible requests will generally be processed within 30 business days, subject to verification requirements, legal obligations, and operational considerations.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Processing times may vary depending on verification requirements, complexity of the request, legal obligations affecting data retention, or technical limitations.
                    </p>
                </section>

                
                <section id="confirmation" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">10.</span> Confirmation of Deletion
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Upon completion of an eligible deletion request, Staybooker.ai may provide confirmation that the request has been processed.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Where certain information cannot be deleted due to legal, regulatory, security, fraud prevention, or contractual obligations, users may be informed regarding the categories of information retained and the reasons for retention where permitted by law.
                    </p>
                </section>

                
                <section id="backup" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">11.</span> Backup and Archived Information
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Deleted personal information may remain temporarily within secure backup systems, disaster recovery environments, or archived records for a limited period. Such information will remain subject to appropriate security safeguards and will be deleted or overwritten in accordance with applicable retention schedules and operational requirements.
                    </p>
                </section>

                
                <section id="effect" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">12.</span> Effect of Data Deletion
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-semibold">
                        Deletion of personal information may result in:
                    </p>
                    <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-400 space-y-1.5">
                        <li>Loss of access to user accounts</li>
                        <li>Removal of booking history</li>
                        <li>Inability to access certain services</li>
                        <li>Permanent deletion of stored preferences and settings</li>
                    </ul>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Certain anonymized, aggregated, or non-personally identifiable information may continue to be retained for analytics, security, operational, or legal purposes.
                    </p>
                </section>

                
                <section id="third-parties" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">13.</span> Third-Party Service Providers
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Staybooker.ai may use third-party service providers for hosting, analytics, payment processing, customer support, communications, and platform operations. Where personal information has been shared with authorized service providers, Staybooker.ai will take reasonable steps to ensure deletion requests are communicated and processed in accordance with applicable contractual and legal requirements, where feasible.
                    </p>
                </section>

                
                <section id="refusal" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">14.</span> Circumstances Where Requests May Be Refused
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Staybooker.ai may refuse or limit deletion requests where: identity cannot be verified, the request is fraudulent or abusive, retention is required by law or regulatory obligations, retention is necessary for security, fraud prevention, or dispute resolution purposes, or applicable legal exemptions permit continued retention.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Where permitted by law, users may be informed of the reasons for refusal.
                    </p>
                </section>

                
                <section id="copy" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">15.</span> Requesting a Copy of Your Data
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Before requesting deletion, users may contact Staybooker.ai to request information regarding personal data associated with their account, subject to applicable laws and verification requirements.
                    </p>
                </section>

                
                <section id="withdrawal" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">16.</span> Withdrawal of Consent
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Where personal data is processed based on user consent, users may withdraw consent at any time by contacting Staybooker.ai. Withdrawal of consent will not affect processing that occurred prior to the withdrawal request.
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Users may revoke Staybooker.ai's access to their Google Account by visiting Google's Security Settings and removing Staybooker.ai from the list of authorized applications.
                    </p>
                </section>

                
                <section id="contact-info" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">17.</span> Contact Information
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-semibold">
                        For data deletion requests, privacy concerns, or questions regarding this policy, please contact:
                    </p>
                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl text-xs sm:text-sm text-slate-400 space-y-1.5 font-mono">
                        <p className="text-white font-bold font-sans">Transinterface Digiserv Pvt. Ltd.</p>
                        <p>Registered Office Address: [Insert Registered Company Address]</p>
                        <p>Email: <a href="mailto:support@staybooker.ai" className="text-accentCyan hover:underline">support@staybooker.ai</a></p>
                        <p>Website: <a href="https://www.staybooker.ai" className="text-accentCyan hover:underline">www.staybooker.ai</a></p>
                    </div>
                </section>

                
                <section id="changes" className="space-y-3 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-accentCyan font-mono">18.</span> Changes to This Policy
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        Staybooker.ai reserves the right to update or modify this Data Deletion Policy at any time. Updated versions will be published on the website with a revised effective date. Continued use of the platform following such updates constitutes acceptance of the revised policy.
                    </p>
                </section>

            </main>
        </div>
    </section>

    
    <div id="footer-placeholder"></div>

    
    

        </div>
    );
}
