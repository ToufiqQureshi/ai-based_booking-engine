// @ts-nocheck
import React from 'react';
import { Link } from 'react-router-dom';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';

export default function CookiePolicy() {
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
                Cookie Usage & Device Identifiers Guide
            </span>

            <h1 id="hero-title" className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 opacity-0">
                Cookie Policy
            </h1>
            
            <p id="hero-desc" className="text-slate-500 font-mono text-xs opacity-0">
                Effective Date: <span className="text-white font-bold">June 02, 2026</span> • Last Updated: <span className="text-white font-bold">June 02, 2026</span>
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
                    <a href="#what-are-cookies" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">2. What Are Cookies?</a>
                    <a href="#similar-tech" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">3. Similar Technologies</a>
                    <a href="#types-cookies" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">4. Types of Cookies We Use</a>
                    <a href="#first-third-party" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">5. First & Third-Party</a>
                    <a href="#google" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">6. Google Technologies</a>
                    <a href="#other-third" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">7. Other Third-Parties</a>
                    <a href="#info-collected" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">8. Information Collected</a>
                    <a href="#managing-cookies" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">11. Managing Cookies</a>
                    <a href="#data-retention" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">13. Data Retention</a>
                    <a href="#contact" className="py-2 px-3 rounded-lg hover:bg-white/5 hover:text-white transition-colors">16. Contact Information</a>
                </nav>
            </div>
        </aside>

        {/* RIGHT COLUMN: Structured Text Content */}
        <article className="lg:col-span-8 space-y-12 text-sm text-slate-300 leading-relaxed font-sans reveal-up">
            
            {/* Quick Legal Metadata Banner */}
            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5 font-mono text-xs text-slate-400">
                <div className="flex justify-between"><span>Legal Entity:</span> <span className="text-white font-semibold">Transinterface Digiserv Pvt. Ltd.</span></div>
                <div className="flex justify-between"><span>Website:</span> <span className="text-white font-semibold">www.staybooker.ai</span></div>
                <div className="flex justify-between"><span>Cookie Consent Node:</span> <span className="text-emerald-400 font-semibold">Dynamic User Choice Enabled</span></div>
            </div>

            {/* 1. Introduction */}
            <section id="introduction" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    1. Introduction
                </h3>
                <p>
                    This Cookie Policy explains how Staybooker.ai ("Staybooker.ai", "we", "our", or "us") uses cookies and similar technologies when users visit, access, or interact with our website, applications, booking platform, APIs, WhatsApp integrations, and related services.
                </p>
                <p>
                    This policy should be read together with our Privacy Policy, Terms and Conditions, and other applicable policies available on the platform.
                </p>
                <p>
                    By continuing to use Staybooker.ai, users acknowledge the use of cookies and similar technologies as described in this policy.
                </p>
            </section>

            {/* 2. What Are Cookies? */}
            <section id="what-are-cookies" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    2. What Are Cookies?
                </h3>
                <p>
                    Cookies are small text files placed on a user's device when visiting a website. Cookies help websites function efficiently, improve user experiences, remember preferences, analyze performance, and support security and marketing activities.
                </p>
                <p>
                    Cookies may be stored temporarily during a browsing session or remain on a device for a longer period depending on their purpose.
                </p>
            </section>

            {/* 3. Similar Technologies */}
            <section id="similar-tech" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    3. Similar Technologies
                </h3>
                <p>In addition to cookies, Staybooker.ai may use similar technologies including:</p>
                <ul className="grid grid-cols-2 gap-2 text-xs text-slate-400 pl-4 list-disc">
                    <li>Web Beacons & Pixels</li>
                    <li>Tags & Local Storage</li>
                    <li>Device Identifiers</li>
                    <li>Software Development Kits (SDKs)</li>
                </ul>
                <p className="pt-2 text-xs">These technologies may collect information about user interactions with our services.</p>
            </section>

            {/* 4. Types of Cookies We Use */}
            <section id="types-cookies" className="space-y-6 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    4. Types of Cookies We Use
                </h3>
                
                <div className="space-y-4">
                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl">
                        <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider mb-2">Essential Cookies</h5>
                        <p className="text-xs text-slate-400">Essential cookies are necessary for the operation of the platform and cannot generally be disabled. These support user authentication, session management, security, load balancing, and booking or reservation processes. Without these cookies, certain services may not function properly.</p>
                    </div>

                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl">
                        <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider mb-2">Performance and Analytics Cookies</h5>
                        <p className="text-xs text-slate-400">These cookies help us understand how visitors interact with our services, collecting metrics like page views, traffic statistics, navigation paths, device/browser details, and session durations to improve platform experiences.</p>
                    </div>

                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl">
                        <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider mb-2">Functionality Cookies</h5>
                        <p className="text-xs text-slate-400">Functionality cookies help remember language preferences, region settings, login states, interface customizations, and specific booking parameters to improve user convenience.</p>
                    </div>

                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl">
                        <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider mb-2">Marketing and Advertising Cookies</h5>
                        <p className="text-xs text-slate-400">Where permitted by applicable law, marketing cookies are used to deliver relevant advertisements, measure marketing effectiveness, limit repetitive ads exposure, and build audience insights.</p>
                    </div>
                </div>
            </section>

            {/* 5. First-Party and Third-Party Cookies */}
            <section id="first-third-party" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    5. First-Party and Third-Party Cookies
                </h3>
                <p>
                    <b className="text-white">First-Party Cookies:</b> Placed directly by Staybooker.ai and used to support platform functionality, security, and performance.
                </p>
                <p>
                    <b className="text-white">Third-Party Cookies:</b> Placed by service providers and technology partners that assist us in delivering services, analytics, advertising, communications, and platform features. Third-party providers process information according to their own privacy policies.
                </p>
            </section>

            {/* 6. Google Services and Technologies (Highlighted Block) */}
            <section id="google" className="p-6 bg-red-950/10 border border-accentCyan/20 rounded-2xl space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accentCyan animate-pulse"></span>
                    6. Google Services and Technologies
                </h3>
                <p className="text-xs text-slate-300">
                    Staybooker.ai may use Google services and technologies, including but not limited to:
                </p>
                <ul className="grid grid-cols-2 gap-2 text-xs text-slate-400 pl-4 list-disc">
                    <li>Google Analytics & Google Ads</li>
                    <li>Google Tag Manager</li>
                    <li>Google Sign-In & Google OAuth Services</li>
                    <li>Google Maps & Google Hotel APIs</li>
                </ul>
                <p className="text-[11px] text-slate-400">
                    These technologies may use cookies and similar mechanisms to collect information regarding website usage, authentication, traffic analysis, service performance, and user interactions. Information collected through Google technologies may be subject to Google's privacy practices and policies.
                </p>
            </section>

            {/* 7. Other Third-Party Technologies */}
            <section id="other-third" className="space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    7. Other Third-Party Technologies
                </h3>
                <p>Staybooker.ai may use services provided by:</p>
                <ul className="list-disc pl-6 text-slate-400 space-y-1">
                    <li>Meta (Facebook and Instagram) & WhatsApp Business Services</li>
                    <li>Payment Processors & Cloud Hosting Providers</li>
                    <li>Customer Support Platforms, Marketing & Analytics Platforms</li>
                </ul>
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

            {/* 11. Managing Cookies (Highlighted Block) */}
            <section id="managing-cookies" className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    11. Managing Cookies
                </h3>
                <p className="text-xs text-slate-300">
                    Most web browsers allow users to control cookies through browser settings. Users may:
                </p>
                <ul className="list-disc pl-6 text-xs text-slate-400 space-y-1">
                    <li>View and delete existing cookies.</li>
                    <li>Block future cookies or configure notifications.</li>
                    <li>Restrict third-party cookies.</li>
                </ul>
                <p className="text-xs text-slate-400">
                    Browser settings can generally be managed through Google Chrome, Mozilla Firefox, Microsoft Edge, Apple Safari, and other supported browsers. Disabling certain cookies may affect website functionality and user experience.
                </p>
            </section>

            {/* 12-15. Withdrawal, Retention, Security, Changes */}
            <section id="retention-security" className="space-y-6 scroll-mt-28">
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">12. Withdrawal of Consent</h5>
                    <p className="text-xs text-slate-400">Where cookie processing is based on consent, users may withdraw consent at any time through available preference management tools or browser settings.</p>
                </div>
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">13. Data Retention</h5>
                    <p className="text-xs text-slate-400">Cookie retention periods vary depending on the cookie type and purpose. Some are deleted automatically, while others remain on a device for longer periods to support analytics, security, and preferences.</p>
                </div>
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">14. Data Security</h5>
                    <p className="text-xs text-slate-400">Staybooker.ai implements reasonable technical, administrative, and organizational measures designed to protect information collected through cookies. No online system can guarantee absolute security.</p>
                </div>
                <div className="space-y-2">
                    <h5 className="font-bold text-white text-xs font-mono uppercase tracking-wider">15. Changes to This Cookie Policy</h5>
                    <p className="text-xs text-slate-400">We reserve the right to update or modify this policy at any time. Updated versions will be published on the website with a revised effective date.</p>
                </div>
            </section>

            {/* 16. Contact Information */}
            <section id="contact" className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 scroll-mt-28">
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentCyan"></span>
                    16. Contact Information
                </h3>
                <p>For questions regarding this Cookie Policy or our use of cookies and similar technologies, please contact:</p>
                
                <div className="space-y-1 font-mono text-xs text-slate-400 pt-2">
                    <div className="text-white font-bold text-sm font-sans mb-1">Transinterface Digiserv Pvt. Ltd.</div>
                    <div>Registered Address: Transinterface Digiserv Pvt. Ltd., India</div>
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
