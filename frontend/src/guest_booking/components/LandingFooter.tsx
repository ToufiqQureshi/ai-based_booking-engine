import React from 'react';
import { Link } from 'react-router-dom';

export const LandingFooter: React.FC = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="border-t border-white/10 bg-[#0a0a0a]/95 relative overflow-hidden py-16 text-slate-400 text-xs sm:text-sm">
            {/* Ambient background glows inside footer */}
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-red-500/5 rounded-full filter blur-3xl pointer-events-none"></div>
            <div className="absolute -top-24 right-10 w-80 h-80 bg-rose-500/5 rounded-full filter blur-3xl pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* Horizontal Grid Layout matching your screenshot */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-10 lg:gap-8 mb-12 text-left">
                    
                    {/* Column 1: Logo, Description & Social Icons */}
                    <div className="space-y-6 flex flex-col items-start">
                        {/* Logo Container */}
                        <div className="flex items-center">
                            <img src="https://ik.imagekit.io/osr1vi9z0/Stay-Booker_JPG_Red_White-removebg-preview.png" 
                                 alt="StayBooker Logo" 
                                 className="h-[80px] w-auto object-contain rounded-xl relative z-10" />
                        </div>
                        <p className="text-slate-400 leading-relaxed text-xs max-w-sm">
                            Built for hospitality teams leveraging Hotel Management Software to scale growth.
                        </p>
                        {/* Social Icons in Glass Blocks */}
                        <div className="flex items-center gap-3 pt-2">
                            {/* Facebook */}
                            <a href="#" className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300" aria-label="Facebook">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
                                </svg>
                            </a>

                            {/* Instagram */}
                            <a href="#" className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300" aria-label="Instagram">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204 0.013-3.583 0.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                                </svg>
                            </a>

                            {/* LinkedIn */}
                            <a href="#" className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300" aria-label="LinkedIn">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                </svg>
                            </a>
                        </div>
                    </div>

                    {/* Column 2: Platform Core */}
                    <div className="space-y-4">
                        <h4 className="text-white font-semibold uppercase tracking-wider text-xs">Platform Core</h4>
                        <ul className="space-y-2.5 text-xs">
                            <li><a href="#" className="hover:text-white hover:underline decoration-red-500 transition-colors">Hotel WebsiteBooking Engine</a></li>
                            <li><a href="#" className="hover:text-white hover:underline decoration-red-500 transition-colors">Channel Manager</a></li>
                            <li><a href="#" className="hover:text-white hover:underline decoration-red-500 transition-colors">Property Management System</a></li>
                            <li><a href="#" className="hover:text-white hover:underline decoration-red-500 transition-colors">Dynamic Pricing</a></li>
                            <li><a href="#" className="hover:text-white hover:underline decoration-red-500 transition-colors">Royalty Programme</a></li>
                        </ul>
                    </div>

                    {/* Column 3: AI Solutions */}
                    <div className="space-y-4">
                        <h4 className="text-white font-semibold uppercase tracking-wider text-xs">AI Solutions</h4>
                        <ul className="space-y-2.5 text-xs">
                            <li><a href="#" className="hover:text-white hover:underline decoration-red-500 transition-colors">Calling AI Agent</a></li>
                            <li><a href="#" className="hover:text-white hover:underline decoration-red-500 transition-colors">WhatsApp AI Agent</a></li>
                            <li><a href="#" className="hover:text-white hover:underline decoration-red-500 transition-colors">Guest AI Agent</a></li>
                        </ul>
                    </div>

                    {/* Column 4: Resources */}
                    <div className="space-y-4">
                        <h4 className="text-white font-semibold uppercase tracking-wider text-xs">Resources</h4>
                        <ul className="space-y-2.5 text-xs">
                            <li><a href="/#demo" className="hover:text-white hover:underline decoration-red-500 transition-colors">Request Platform Demo</a></li>
                            <li><a href="/#blog" className="text-rose-400 font-semibold hover:text-rose-300 transition-colors inline-flex items-center gap-1.5">Our Blog <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-normal">New</span></a></li>
                            <li><a href="/#faq" className="hover:text-white hover:underline decoration-red-500 transition-colors">FAQs & Support</a></li>
                            <li><a href="#" className="hover:text-white hover:underline decoration-red-500 transition-colors">Savings Calculator</a></li>
                            <li><a href="#" className="hover:text-white hover:underline decoration-red-500 transition-colors">Success Stories</a></li>
                        </ul>
                    </div>

                    {/* Column 5: Security & Trust */}
                    <div className="space-y-4">
                        <h4 className="text-white font-semibold uppercase tracking-wider text-xs">Security & Trust</h4>
                        <ul className="space-y-2.5 text-xs">
                            <li><Link to="/terms-of-service" className="hover:text-white hover:underline decoration-red-500 transition-colors">Terms and Conditions</Link></li>
                            <li><Link to="/privacy-policy" className="hover:text-white hover:underline decoration-red-500 transition-colors">Privacy Policy</Link></li>
                            <li><Link to="/cookie-policy" className="hover:text-white hover:underline decoration-red-500 transition-colors">Cookie Preferences</Link></li>
                            <li><Link to="/data-deletion" className="hover:text-white hover:underline decoration-red-500 transition-colors">Data Deletion Request</Link></li>
                            <li><Link to="/refund-policy" className="hover:text-white hover:underline decoration-red-500 transition-colors">Refund and Cancellation</Link></li>
                        </ul>
                    </div>
                </div>

                {/* Footer Bottom Bar */}
                <div className="border-t border-white/5 pt-8 mt-8 flex justify-center text-xs">
                    <p className="font-mono text-center text-slate-600">
                        © <span id="current-year">{currentYear}</span> StayBooker AI. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
};
