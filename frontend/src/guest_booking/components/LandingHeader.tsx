import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export const LandingHeader: React.FC = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openSublist, setOpenSublist] = useState<string | null>(null);

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

    const toggleSublist = (name: string) => {
        setOpenSublist(openSublist === name ? null : name);
    };

    // Header animation on mount
    useEffect(() => {
        const header = document.getElementById('main-header');
        if (header) {
            header.style.opacity = '1';
            header.style.transform = 'translateY(0)';
        }
    }, []);

    return (
        <header id="main-header" className="fixed top-0 left-0 right-0 w-full z-[100] transition-all duration-300 opacity-0 -translate-y-10">
            <nav className="glass-panel px-4 sm:px-6 py-1 md:py-1.5 rounded-t-none flex items-center justify-between border-b border-x border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] relative">
                
                {/* Logo Container */}
                <div className="flex items-center">
                    <Link to="/">
                        <img 
                            src="https://ik.imagekit.io/osr1vi9z0/Stay-Booker_JPG_Red_White-removebg-preview.png" 
                            alt="StayBooker Logo" 
                            className="h-[100px] sm:h-[95px] md:h-[125px] lg:h-[165px] w-auto object-contain rounded-xl ml-2 md:ml-6 lg:ml-10 my-[-8px] md:my-[-15px] relative z-10" 
                        />
                    </Link>
                </div>
                
                {/* Nav Links (Desktop) */}
                <div className="hidden lg:flex items-center gap-8 text-sm text-slate-300 font-medium">
                    
                    {/* AI Products */}
                    <div className="relative group h-12 flex items-center cursor-pointer">
                        <button className="hover:text-white transition-colors flex items-center gap-1.5">
                            AI Products
                            <svg className="w-3 h-3 arrow-icon transition-transform duration-500 ease-in-out" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <div className="absolute top-12 left-0 pt-4 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-300 ease-out w-64">
                            <div className="bg-[#0a0a0a] glass-panel p-3 rounded-2xl border border-white/10 shadow-2xl">
                                <a href="#" className="block px-4 py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">Hotel Website Booking Engine</a>
                                <a href="#" className="block px-4 py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">Channel Manager</a>
                                <a href="#" className="block px-4 py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">Property Management System</a>
                                <a href="#" className="block px-4 py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">Reputation Management System</a>
                                <a href="#" className="block px-4 py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">Dynamic Pricing System</a>
                                <a href="#" className="block px-4 py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">Royalty Programm</a>
                                <a href="#" className="block px-4 py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">Google Hotel Ads</a>
                            </div>  
                        </div>
                    </div>

                    {/* AI Solutions */}
                    <div className="relative group h-12 flex items-center cursor-pointer">
                        <button className="hover:text-white transition-colors flex items-center gap-1.5">
                            AI Solutions
                            <svg className="w-3 h-3 arrow-icon transition-transform duration-500 ease-in-out" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <div className="absolute top-12 left-0 pt-4 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-300 ease-out w-56">
                            <div className="bg-[#0a0a0a] glass-panel p-3 rounded-2xl border border-white/10 shadow-2xl">
                                <a href="#" className="block px-4 py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">Calling AI Agent</a>
                                <a href="#" className="block px-4 py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">WhatsApp AI Agent</a>
                                <a href="#" className="block px-4 py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">Guest AI Agent</a>
                            </div>
                        </div>     
                    </div>

                    <a href="/#about" className="hover:text-white transition-colors">About Us</a>

                    {/* Resources */}
                    <div className="relative group h-12 flex items-center cursor-pointer">
                        <button className="hover:text-white transition-colors flex items-center gap-1.5">
                            Resources
                            <svg className="w-3 h-3 arrow-icon transition-transform duration-500 ease-in-out" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <div className="absolute top-12 left-0 pt-4 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-300 ease-out w-48">
                            <div className="bg-[#0a0a0a] glass-panel p-3 rounded-2xl border border-white/10 shadow-2xl">
                                <a href="#" className="block px-4 py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">Blog</a>
                                <a href="#" className="block px-4 py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">Savings Calculator</a>
                                <a href="#" className="block px-4 py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">Success Stories</a>
                            </div>
                        </div>
                    </div>

                    <a href="/#contact" className="hover:text-white transition-colors">Contact Us</a>
                </div>

                {/* Right Side Buttons (Desktop) */}
                <div className="hidden lg:flex items-center gap-8">
                    <a href="https://app.staybooker.ai/" className="text-sm text-slate-300 hover:text-white transition-colors">Log In</a>
                    <a href="/#demo" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 hover:scale-105 transition-all">Book Demo</a>
                </div>

                {/* Hamburger Icon Button (Mobile Only) */}
                <div className="flex lg:hidden items-center gap-4">
                    <a href="/#demo" className="sm:flex hidden px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-xs font-bold shadow-lg shadow-red-900/15 hover:scale-105 transition-all">Book Demo</a>
                    
                    <button onClick={toggleMobileMenu} className="text-slate-300 hover:text-white p-2 focus:outline-none" aria-label="Toggle Menu">
                        <svg className={`w-6 h-6 ${isMobileMenuOpen ? 'hidden' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                        </svg>
                        <svg className={`w-6 h-6 ${isMobileMenuOpen ? '' : 'hidden'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                {/* Mobile Menu Drawer */}
                <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} absolute top-[calc(100%+12px)] left-0 w-full bg-[#0a0a0a]/95 glass-panel rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.6)] p-6 lg:hidden flex-col gap-4 max-h-[75vh] overflow-y-auto z-50`}>
                    <div className="flex flex-col gap-3 text-slate-300 font-medium text-sm">
                        {/* Mobile Dropdown: AI Products */}
                        <div>
                            <button onClick={() => toggleSublist('products')} className="w-full flex items-center justify-between py-2.5 text-left hover:text-white transition-colors border-b border-white/5">
                                <span>AI Products</span>
                                <svg className={`w-4 h-4 transition-transform duration-300 ${openSublist === 'products' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <div className={`${openSublist === 'products' ? 'flex' : 'hidden'} pl-4 mt-1 flex-col gap-1.5`}>
                                <a href="#" className="block py-1.5 text-xs text-slate-400 hover:text-white">Hotel Website Booking Engine</a>
                                <a href="#" className="block py-1.5 text-xs text-slate-400 hover:text-white">Channel Manager</a>
                                <a href="#" className="block py-1.5 text-xs text-slate-400 hover:text-white">Property Management System</a>
                                <a href="#" className="block py-1.5 text-xs text-slate-400 hover:text-white">Reputation Management system</a>
                                <a href="#" className="block py-1.5 text-xs text-slate-400 hover:text-white">Dynamic Pricing System</a>
                                <a href="#" className="block py-1.5 text-xs text-slate-400 hover:text-white">Royalty Programme</a>
                                <a href="#" className="block py-1.5 text-xs text-slate-400 hover:text-white">Google Hotel Ads</a>
                            </div>
                        </div>

                        {/* Mobile Dropdown: AI Solutions */}
                        <div>
                            <button onClick={() => toggleSublist('solutions')} className="w-full flex items-center justify-between py-2.5 text-left hover:text-white transition-colors border-b border-white/5">
                                <span>AI Solutions</span>
                                <svg className={`w-4 h-4 transition-transform duration-300 ${openSublist === 'solutions' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <div className={`${openSublist === 'solutions' ? 'flex' : 'hidden'} pl-4 mt-1 flex-col gap-1.5`}>
                                <a href="#" className="block py-1.5 text-xs text-slate-400 hover:text-white">Calling AI Agent</a>
                                <a href="#" className="block py-1.5 text-xs text-slate-400 hover:text-white">WhatsApp Calling AI Agent</a>
                                <a href="#" className="block py-1.5 text-xs text-slate-400 hover:text-white">Guest AI Agent</a>
                            </div>
                        </div>

                        <a href="/#about" className="py-2.5 border-b border-white/5 hover:text-white transition-colors">About Us</a>

                        {/* Mobile Dropdown: Resources */}
                        <div>
                            <button onClick={() => toggleSublist('resources')} className="w-full flex items-center justify-between py-2.5 text-left hover:text-white transition-colors border-b border-white/5">
                                <span>Resources</span>
                                <svg className={`w-4 h-4 transition-transform duration-300 ${openSublist === 'resources' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <div className={`${openSublist === 'resources' ? 'flex' : 'hidden'} pl-4 mt-1 flex-col gap-1.5`}>
                                <a href="#" className="block py-1.5 text-xs text-slate-400 hover:text-white">Blog</a>
                                <a href="#" className="block py-1.5 text-xs text-slate-400 hover:text-white">Savings Calculator</a>
                                <a href="#" className="block py-1.5 text-xs text-slate-400 hover:text-white">Success Stories</a>
                            </div>
                        </div>

                        <a href="/#contact" className="py-2.5 hover:text-white transition-colors">Contact Us</a>
                    </div>

                    {/* Mobile Action Buttons */}
                    <div className="border-t border-white/10 pt-4 flex flex-col gap-3">
                        <a href="https://app.staybooker.ai/" className="w-full text-center py-2.5 rounded-xl border border-white/10 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all">Log In</a>
                        <a href="/#demo" className="w-full text-center py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 transition-all">Book Demo</a>
                    </div>
                </div>
            </nav>
        </header>
    );
};
