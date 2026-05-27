import { ArrowRight, Sparkles, Bot, Shield, BarChart3, Globe, Star, Zap, Hotel } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white font-sans selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none opacity-20 blur-[150px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full" />
      <div className="absolute top-[800px] -left-40 w-[400px] h-[400px] pointer-events-none opacity-10 blur-[120px] bg-violet-600 rounded-full" />
      <div className="absolute top-[1600px] -right-40 w-[500px] h-[500px] pointer-events-none opacity-10 blur-[150px] bg-indigo-600 rounded-full" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#030712]/50 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Hotel className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">Staybooker</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block -mt-1 font-mono">AI ENGINE</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#concierge" className="hover:text-white transition-colors">AI Concierge</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </nav>

          <div className="flex items-center gap-4">
            {window.location.hostname.includes('staybooker.ai') && !window.location.hostname.startsWith('app.') ? (
              <>
                <a 
                  href="https://app.staybooker.ai/login" 
                  className="text-sm font-bold text-slate-300 hover:text-white px-4 py-2 transition-colors"
                >
                  Sign In
                </a>
                <a 
                  href="https://app.staybooker.ai/signup" 
                  className="group relative inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="text-sm font-bold text-slate-300 hover:text-white px-4 py-2 transition-colors"
                >
                  Sign In
                </Link>
                <Link 
                  to="/signup" 
                  className="group relative inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">
        {/* Micro badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-indigo-300 mb-8 animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Smarter Direct Hotel Bookings</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] max-w-5xl bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
          Powering the Future of Direct Hotel Bookings with AI
        </h1>
        
        <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-3xl leading-relaxed">
          The ultimate direct booking engine for modern hotels. Boost occupancy, save hours of manual setup, and engage guests with a built-in AI concierge, smart rate optimization, and slab taxes.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          {window.location.hostname.includes('staybooker.ai') && !window.location.hostname.startsWith('app.') ? (
            <a 
              href="https://app.staybooker.ai/signup" 
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-base font-extrabold text-white shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              Create Your Hotel Account
            </a>
          ) : (
            <Link 
              to="/signup" 
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-base font-extrabold text-white shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              Create Your Hotel Account
            </Link>
          )}
          <a 
            href="#features" 
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-base font-extrabold text-slate-300 hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            Explore Features
          </a>
        </div>

        {/* Dashboard Preview / Mockup */}
        <div className="mt-20 w-full rounded-2xl border border-white/10 bg-slate-900/40 p-2.5 backdrop-blur-3xl shadow-2xl relative">
          <div className="absolute inset-0 rounded-2xl bg-indigo-500/5 blur-xl pointer-events-none" />
          <div className="relative rounded-xl border border-white/5 overflow-hidden aspect-[16/9] bg-[#0b0f19]">
            {/* Header Mockup */}
            <div className="h-12 border-b border-white/5 bg-[#070b13]/80 px-4 flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/30" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/30" />
                <span className="w-3 h-3 rounded-full bg-green-500/30" />
              </div>
              <div className="h-6 flex-1 max-w-md rounded-md bg-white/5 border border-white/5 flex items-center justify-center text-[10px] text-slate-500 font-mono">
                app.staybooker.ai/dashboard
              </div>
            </div>
            {/* Dashboard Contents Mock */}
            <div className="p-6 grid grid-cols-3 gap-6 h-[calc(100%-3rem)]">
              <div className="col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <div className="h-4 w-36 bg-white/10 rounded-md mb-2" />
                    <div className="h-3 w-56 bg-white/5 rounded-md" />
                  </div>
                  <div className="h-8 w-24 bg-white/5 border border-white/10 rounded-lg" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2 text-left">
                    <div className="h-3 w-16 bg-white/10 rounded" />
                    <div className="h-6 w-8 bg-indigo-400/80 rounded" />
                    <div className="h-2.5 w-20 bg-white/5 rounded" />
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2 text-left">
                    <div className="h-3 w-16 bg-white/10 rounded" />
                    <div className="h-6 w-8 bg-violet-400/80 rounded" />
                    <div className="h-2.5 w-20 bg-white/5 rounded" />
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2 text-left">
                    <div className="h-3 w-16 bg-white/10 rounded" />
                    <div className="h-6 w-12 bg-pink-400/80 rounded" />
                    <div className="h-2.5 w-20 bg-white/5 rounded" />
                  </div>
                </div>
                <div className="border border-white/5 bg-white/5 rounded-xl h-44 p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-32 bg-white/10 rounded" />
                    <div className="h-6 w-16 bg-white/5 rounded" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-white/10" />
                      <div className="h-3 w-28 bg-white/10 rounded" />
                      <div className="h-3 w-12 bg-white/5 rounded ml-auto" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-white/10" />
                      <div className="h-3 w-36 bg-white/10 rounded" />
                      <div className="h-3 w-12 bg-white/5 rounded ml-auto" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-white/10" />
                      <div className="h-3 w-20 bg-white/10 rounded" />
                      <div className="h-3 w-12 bg-white/5 rounded ml-auto" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-span-1 space-y-6">
                <div className="bg-white/5 border border-white/5 rounded-xl h-full p-4 text-left flex flex-col justify-between">
                  <div>
                    <div className="h-4 w-28 bg-white/10 rounded mb-4" />
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <div className="h-3.5 w-16 bg-white/5 rounded" />
                        <div className="h-3.5 w-12 bg-white/10 rounded" />
                      </div>
                      <div className="flex justify-between">
                        <div className="h-3.5 w-20 bg-white/5 rounded" />
                        <div className="h-3.5 w-10 bg-white/10 rounded" />
                      </div>
                    </div>
                  </div>
                  <div className="h-8 w-full bg-indigo-600/30 border border-indigo-500/20 rounded-lg flex items-center justify-center text-[10px] font-bold text-indigo-300">
                    Live Widget Active
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 border-t border-white/5 bg-slate-950/20 py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Built with Everything Your Hotel Needs to Scale
            </h2>
            <p className="mt-4 text-slate-400">
              Ditch the clunky, expensive legacy property management widgets. Integrate direct bookings inside your domain in minutes.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/[0.08] hover:border-white/10 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">AI Guest Concierge</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                An automated virtual assistant trained on your policies, room rates, and location that books guests natively via chat.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/[0.08] hover:border-white/10 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 mb-6">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Rate Shopper</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Real-time competitor analysis tells you if you are underpricing or overpricing compared to local competitors.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/[0.08] hover:border-white/10 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 mb-6">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Itemized GST Slab Taxes</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Automated tax calculations using dynamic slab rates. Perfectly compliant and frozen at direct checkout.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/[0.08] hover:border-white/10 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-6">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Subdomain Engine</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Scale smoothly with custom branding under staybooker.ai or link your own custom domain directly.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/[0.08] hover:border-white/10 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 mb-6">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Razorpay Integration</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Fully functional test and real keys integrations for Pay Now online payments or Pay at Property confirmations.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/[0.08] hover:border-white/10 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-400 mb-6">
                <Star className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Seamless Multi-Tenant</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Manage multiple rooms, addons, pricing plans, and integration settings inside a single elegant profile portal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust section / CTA */}
      <section className="relative z-10 py-32 border-t border-white/5 bg-gradient-to-b from-transparent to-indigo-950/20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Ready to Accelerate Your Hotel Direct Bookings?
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">
            Create an owner account in less than 2 minutes. Start using your test API keys instantly.
          </p>
          <div className="mt-8 flex justify-center">
            {window.location.hostname.includes('staybooker.ai') && !window.location.hostname.startsWith('app.') ? (
              <a 
                href="https://app.staybooker.ai/signup" 
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-base font-extrabold text-white shadow-xl shadow-indigo-600/35 hover:shadow-indigo-600/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                Sign Up For Free Account
              </a>
            ) : (
              <Link 
                to="/signup" 
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-base font-extrabold text-white shadow-xl shadow-indigo-600/35 hover:shadow-indigo-600/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                Sign Up For Free Account
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-12 bg-[#030712]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Hotel className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-extrabold tracking-tight">Staybooker AI</span>
          </div>
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Staybooker. All rights reserved. Designed for elite hospitality.
          </p>
        </div>
      </footer>
    </div>
  );
}
