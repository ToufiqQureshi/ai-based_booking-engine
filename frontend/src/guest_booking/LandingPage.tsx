// @ts-nocheck
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LandingHeader } from './components/LandingHeader';
import { LandingFooter } from './components/LandingFooter';

export default function LandingPage() {
    useEffect(() => {
        
        // Register GSAP plugins
        gsap.registerPlugin(ScrollTrigger);

      // --- 1. ASYNC HEADER & FOOTER LOADER (with Cache Buster) ---
        async function loadHeaderAndFooter() {
            try {
                // Browser ko purana cache load karne se rokne ke liye version lagaya hai
                const version = new Date().getTime();

                // Header Load karega (?v= ke sath)
                const headerResponse = await fetch('header.html?v=' + version);
                const headerData = await headerResponse.text();
                document.getElementById('header-placeholder').innerHTML = headerData;
                
                // Header load hone ke baad uski JavaScript ko active karega
                initializeHeaderLogic(); 

                // Footer Load karega (?v= ke sath)
                const footerResponse = await fetch('footer.html?v=' + version);
                const footerData = await footerResponse.text();
                document.getElementById('footer-placeholder').innerHTML = footerData;
                
                // Footer load hone ke baad current year update hoga
                const yearEl = document.getElementById('current-year');
                if (yearEl) {
                    yearEl.textContent = new Date().getFullYear();
                }
            } catch (error) {
                console.error("Error loading layout components:", error);
            }
        }

        // --- 2. HEADER RELATED LOGIC & ANIMATIONS ---
        function initializeHeaderLogic() {
            // Header GSAP entry animation
            gsap.to("#main-header", {
                y: 0,
                opacity: 1,
                duration: 1,
                ease: "power4.out"
            });

            // Mobile menu drawer action logic
            const hamburgerBtn = document.getElementById('hamburger-btn');
            const mobileMenu = document.getElementById('mobile-menu');
            const hamburgerIcon = document.getElementById('hamburger-icon');
            const closeIcon = document.getElementById('close-icon');

            if (hamburgerBtn && mobileMenu) {
                hamburgerBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const isHidden = mobileMenu.classList.contains('hidden');
                    
                    if (isHidden) {
                        mobileMenu.classList.remove('hidden');
                        mobileMenu.classList.add('flex');
                        hamburgerIcon.classList.add('hidden');
                        closeIcon.classList.remove('hidden');
                    } else {
                        mobileMenu.classList.add('hidden');
                        mobileMenu.classList.remove('flex');
                        hamburgerIcon.classList.remove('hidden');
                        closeIcon.classList.add('hidden');
                    }
                });
            }

            // Mobile dropdown triggers
            const submenuButtons = document.querySelectorAll('.mobile-sublist-btn');
            submenuButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const sublistContent = button.nextElementSibling;
                    const arrowIcon = button.querySelector('svg');
                    
                    if (sublistContent) {
                        if (sublistContent.classList.contains('hidden')) {
                            sublistContent.classList.remove('hidden');
                            sublistContent.classList.add('flex');
                            if(arrowIcon) arrowIcon.classList.add('rotate-180');
                        } else {
                            sublistContent.classList.remove('flex');
                            sublistContent.classList.add('hidden');
                            if(arrowIcon) arrowIcon.classList.remove('rotate-180');
                        }
                    }
                });
            });
        }

        // --- 3. THREE.JS INTERACTIVE 3D HOLOGRAM GLOBE ---
        let scene, camera, renderer, globeParticles, connections;
        const container = document.getElementById('threejs-container');
        let mouseX = 0, mouseY = 0;

        function init3D() {
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
            camera.position.z = 12.5; 

            renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            container.appendChild(renderer.domElement);

            const particleCount = 1600; 
            const positions = new Float32Array(particleCount * 3);
            const r = 7.2; 

            for (let i = 0; i < particleCount; i++) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);

                positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
                positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
                positions[i * 3 + 2] = r * Math.cos(phi);
            }

            const particleGeometry = new THREE.BufferGeometry();
            particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const particleMaterial = new THREE.PointsMaterial({
                color: 0xF43F5E, 
                size: 0.085, 
                transparent: true,
                opacity: 0.75,
                blending: THREE.AdditiveBlending
            });

            globeParticles = new THREE.Points(particleGeometry, particleMaterial);
            scene.add(globeParticles);

            const connectionCount = 20; 
            const lineMaterial = new THREE.LineBasicMaterial({
                color: 0xDC2626, 
                transparent: true,
                opacity: 0.35,
                blending: THREE.AdditiveBlending
            });

            connections = new THREE.Group();
            for(let i = 0; i < connectionCount; i++) {
                const p1Index = Math.floor(Math.random() * particleCount);
                const p2Index = Math.floor(Math.random() * particleCount);

                const p1 = new THREE.Vector3(positions[p1Index*3], positions[p1Index*3+1], positions[p1Index*3+2]);
                const p2 = new THREE.Vector3(positions[p2Index*3], positions[p2Index*3+1], positions[p2Index*3+2]);

                const controlPoint = p1.clone().add(p2).multiplyScalar(0.5).normalize().multiplyScalar(r * 1.3);
                const curve = new THREE.QuadraticBezierCurve3(p1, controlPoint, p2);
                
                const curvePoints = curve.getPoints(30);
                const lineGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
                const line = new THREE.Line(lineGeometry, lineMaterial);
                connections.add(line);  
            }
            scene.add(connections);

            window.addEventListener('resize', onWindowResize);
            window.addEventListener('mousemove', onMouseMove);

            animate3D();
        }

        function onMouseMove(event) {
            mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        }

        function onWindowResize() {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }

        function animate3D() {
            requestAnimationFrame(animate3D);

            globeParticles.rotation.y += 0.0012;
            connections.rotation.y += 0.0012;

            globeParticles.rotation.y += (mouseX * 0.05 - globeParticles.rotation.y) * 0.1;
            globeParticles.rotation.x += (-mouseY * 0.05 - globeParticles.rotation.x) * 0.1;
            
            connections.rotation.y += (mouseX * 0.05 - connections.rotation.y) * 0.1;
            connections.rotation.x += (-mouseY * 0.05 - connections.rotation.x) * 0.1;

            renderer.render(scene, camera);
        }

        // --- PAGE INITIALIZATION & LOAD ANIMATIONS ---
        setTimeout(() => {
            const tl = gsap.timeline();

            // Dynamic header/footer load logic start
            

            init3D();

            tl.to("#hero-badge", { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" })
              .to("#hero-title", { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, "-=0.4")
              .to("#hero-desc", { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, "-=0.6")
              .to("#hero-ctas", { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, "-=0.6")
              .to("#hero-feed-container", { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, "-=0.4");

            gsap.to("#hero-dashboard", {
                opacity: 1,
                duration: 1.2,
                ease: "power3.out",
                delay: 0.4
            });

            gsap.to("#hero-floating-badge", {
                opacity: 1,
                y: 0,
                duration: 1.2,
                ease: "elastic.out(1, 0.5)",
                delay: 0.8
            });

            gsap.to("#hero-dashboard", {
                y: "-=12px",
                rotationZ: "+=1.5deg",
                duration: 4,
                ease: "sine.inOut",
                repeat: -1,
                yoyo: true
            });

            gsap.set("#hero-chart-line", { 
                strokeDasharray: 300, 
                strokeDashoffset: 300 
            });

            gsap.to("#hero-chart-line", {
                strokeDashoffset: 0,
                duration: 5.5,
                ease: "power2.out",
                delay: 0.8
            });

            initScrollReveals();
        });

        // --- SCROLL REVEALS USING GSAP ---
        function initScrollReveals() {
            const revealUpElements = gsap.utils.toArray('.reveal-up');
            revealUpElements.forEach((element) => {
                gsap.to(element, {
                    opacity: 1,
                    y: 0,
                    duration: 0.4, 
                    ease: "power2.out",
                    scrollTrigger: {
                        trigger: element,
                        start: "top 95%", 
                        toggleActions: "play none none none"
                    }
                });
            });

            gsap.to("#globe-network-svg", {
                rotation: 360,
                scrollTrigger: {
                    trigger: "#demo",
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 1
                }
            });
        }

        // --- FAQ ACCORDION UI LOGIC ---
        function toggleFaq(index) {
            const faqContent = document.getElementById(`faq-content-${index}`);
            const faqIcon = document.getElementById(`faq-icon-${index}`);

            if (faqContent.classList.contains('hidden')) {
                faqContent.classList.remove('hidden');
                gsap.fromTo(faqContent, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.25, ease: "power1.out" });
                faqIcon.textContent = '−';
                faqIcon.classList.add('text-accentCyan');
            } else {
                gsap.to(faqContent, {
                    height: 0,
                    opacity: 0,
                    duration: 0.15,
                    onComplete: () => faqContent.classList.add('hidden')
                });
                faqIcon.textContent = '+';
                faqIcon.classList.remove('text-accentCyan');
            }
        }

        const luxuryNames = ["Grand Palace Resort", "Aethelgard Suites", "The Luminary Retreat", "Sonder Private Villas"];
        const values = ["₹3,120", "₹4,850", "₹6,200", "₹1,450"];
        let feedIndex = 0;
        setInterval(() => {
            const liveFeed = document.getElementById('hero-live-feed');
            if (liveFeed) {
                feedIndex = (feedIndex + 1) % luxuryNames.length;
                gsap.to(liveFeed, {
                    opacity: 0,
                    y: -5,
                    duration: 0.2,
                    onComplete: () => {
                        liveFeed.textContent = `Live Check: ${luxuryNames[feedIndex]} secured +${values[feedIndex]} in direct bookings this hour.`;
                        gsap.to(liveFeed, { opacity: 1, y: 0, duration: 0.2 });
                    }
                });
            }
        }, 8000);
    

        const track = document.getElementById('testimonial-track');
        const dotsContainer = document.getElementById('testimonial-dots');
        let slides = Array.from(track.children);
        let currentIndex = 0;
        let slideInterval;

        function updateSliderPosition() {
            slides.forEach(slide => {
                slide.style.width = '100%';
            });

            const amountToMove = currentIndex * 100;
            track.style.transform = `translateX(-${amountToMove}%)`;
            
            updateActiveDots();
        }

        function setupDots() {
            dotsContainer.innerHTML = '';
            const totalDots = slides.length;

            if (totalDots <= 1) return;

            for (let i = 0; i < totalDots; i++) {
                const dot = document.createElement('button');
                dot.className = `w-2 h-2 rounded-full transition-all duration-300 ${i === currentIndex ? 'bg-accentCyan w-6' : 'bg-white/20'}`;
                dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
                dot.addEventListener('click', () => {
                    currentIndex = i;
                    updateSliderPosition();
                    resetInterval();
                });
                dotsContainer.appendChild(dot);
            }
        }

        function updateActiveDots() {
            const dots = Array.from(dotsContainer.children);
            dots.forEach((dot, idx) => {
                if (idx === currentIndex) {
                    dot.classList.add('bg-accentCyan', 'w-6');
                    dot.classList.remove('bg-white/20');
                } else {
                    dot.classList.remove('bg-accentCyan', 'w-6');
                    dot.classList.add('bg-white/20');
                }
            });
        }

        function nextSlide() {
            const maxIndex = slides.length - 1;

            if (currentIndex >= maxIndex) {
                currentIndex = 0;
            } else {
                currentIndex++;
            }
            updateSliderPosition();
        }

        function startInterval() {
            slideInterval = setInterval(nextSlide, 5000);
        }

        function resetInterval() {
            clearInterval(slideInterval);
            startInterval();
        }

        window.addEventListener('resize', () => {
            updateSliderPosition();
        });

        let startX = 0;
        let isDragging = false;

        track.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
            clearInterval(slideInterval);
        });

        track.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const diff = startX - e.touches[0].clientX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    nextSlide();
                } else {
                    if (currentIndex > 0) {
                        currentIndex--;
                    } else {
                        currentIndex = slides.length - 1;
                    }
                    updateSliderPosition();
                }
                isDragging = false;
                resetInterval();
            }
        });

        track.addEventListener('touchend', () => isDragging = false);

        setTimeout( () => {
            setupDots();
            updateSliderPosition();
            startInterval();
        });
    
        return () => {
            if (window.slideInterval) clearInterval(window.slideInterval);
        };
    }, []);

    return (
        <div className="font-sans antialiased bg-[#0A0505] text-white relative selection:bg-[#F43F5E]/30 overflow-x-hidden" style={{ backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            <LandingHeader />
            {/* Ambient background glows */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]"></div>
                <div className="absolute top-[800px] right-1/4 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[150px]"></div>
                <div className="absolute top-[2500px] left-1/3 w-[700px] h-[700px] bg-red-950/10 rounded-full blur-[160px]"></div>
                <div className="absolute top-[4200px] right-1/3 w-[600px] h-[600px] bg-rose-950/20 rounded-full blur-[140px]"></div>
            </div>

            {/* Hero Section */}
    <section className="relative min-h-screen pt-24 lg:pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col justify-between overflow-hidden">
        
        {/* Background Animation Deco */}
        <div className="absolute top-[20%] right-[10%] w-72 h-72 bg-gradient-to-br from-red-500/20 to-rose-600/20 rounded-full animate-morph filter blur-3xl pointer-events-none"></div>

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center pt-8 relative">
            
            {/* Right 3D Visual Column */}
            <div className="lg:col-span-6 flex justify-center items-center perspective-lg relative mt-6 lg:mt-0 h-[380px] sm:h-[540px] lg:h-[650px] w-full order-1 lg:order-2 overflow-hidden">
                
                {/* Canvas container for Three.js 3D Globe */}
                <div id="threejs-container" className="absolute inset-0 w-full h-full pointer-events-none z-0"></div>

                {/* Floating 3D Booking Dashboard Frame */}
                <div id="hero-dashboard" className="tilt-3d w-full max-w-[440px] glass-panel rounded-2xl p-4 sm:p-6 border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.75)] relative overflow-hidden opacity-0 z-10">
                    <div className="absolute inset-0 bg-gradient-to-tr from-red-500/5 to-transparent pointer-events-none"></div>
                    
                    {/* Windows buttons decoration */}
                    <div className="flex items-center gap-2 mb-6">
                        <span className="w-3 h-3 rounded-full bg-rose-500/60 block"></span>
                        <span className="w-3 h-3 rounded-full bg-amber-500/60 block"></span>
                        <span className="w-3 h-3 rounded-full bg-emerald-500/60 block"></span>
                        <span className="text-[9px] sm:text-[10px] text-slate-500 font-mono ml-2 sm:ml-4 overflow-hidden text-ellipsis whitespace-nowrap">dashboard.staybooker.ai</span>
                    </div>

                    {/* Internal Mockup Elements */}
                    <div className="space-y-4 sm:space-y-6">
                        <div className="flex justify-between items-center gap-2">
                            <div>
                                <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Today's Performance</p>
                                <h3 className="text-xl sm:text-2xl font-bold text-white">₹12,43,592</h3>
                            </div>
                            <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-[10px] sm:text-xs font-semibold flex items-center gap-1 border border-emerald-500/20 shrink-0">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
                                +28.4%
                            </span>
                        </div>

                        {/* Mini Interactive Chart Graphic */}
                        <div className="h-20 sm:h-28 relative">
                            <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stop-color="#DC2626" stop-opacity="0.4"/>
                                        <stop offset="100%" stop-color="#DC2626" stop-opacity="0"/>
                                    </linearGradient>
                                </defs>
                                <path id="hero-chart-path" d="M 0 35 Q 15 25, 30 15 T 60 25 T 90 5 T 100 12 L 100 40 L 0 40 Z" fill="url(#chartGlow)" />
                                <path id="hero-chart-line" d="M 0 35 Q 15 25, 30 15 T 60 25 T 90 5 T 100 12" fill="none" stroke="#F43F5E" strokeWidth="1.5" />
                                <circle cx="90" cy="5" r="2.5" fill="#F43F5E" className="animate-ping" />
                                <circle cx="90" cy="5" r="1.5" fill="#F43F5E" />
                            </svg>
                            {/* Mini floating indicator */}
                            <div className="absolute top-1 sm:top-2 right-4 sm:right-12 bg-darkCard/90 border border-white/10 text-[8px] sm:text-[9px] px-2 py-0.5 rounded shadow">
                                Peak: ₹14,82,310 INR
                            </div>
                        </div>

                        {/* Real-time Live booking activity element */}
                        <div className="glass-card p-2.5 sm:p-3 rounded-xl border border-white/10 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accentCyan/10 flex items-center justify-center shrink-0">
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accentCyan" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                </div>
                                <div className="text-left min-w-0">
                                    <p className="text-[10px] sm:text-[11px] font-semibold text-white truncate">Deluxe Villa booked by Liam O.</p>
                                    <p className="text-[8px] sm:text-[9px] text-slate-400 truncate">Commission saved: ₹15,400.00</p>
                                </div>
                            </div>
                            <span className="text-[8px] sm:text-[9px] font-mono text-emerald-400 shrink-0">Just Now</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Left Copy Column */}
            <div className="lg:col-span-6 space-y-6 sm:space-y-8 text-left z-10 order-2 lg:order-1">
                <div id="hero-badge" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-accentCyan font-medium opacity-0">
                    <span className="w-2 h-2 rounded-full bg-accentCyan animate-pulse"></span>
                   AI-Powered Growth for Modern Hotels
                </div>
                
                <h1 id="hero-title" className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 opacity-0">
                    The Smartest AI Solutions for Hotels That Want to Own Their Bookings
                </h1>
                
                <p id="hero-desc" className="text-slate-400 text-sm sm:text-base md:text-lg max-w-xl leading-relaxed opacity-0">
                    A direct booking platform built for modern hotels, boutique resorts, private villas, and serviced apartments — powered by AI to cut OTA commissions and maximize revenue.
                </p>

                <div id="hero-ctas" className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2 opacity-0">
                    <a href="#demo" className="w-full sm:w-auto text-center px-8 py-4 rounded-xl bg-gradient-to-r from-primaryBlue to-accentCyan font-semibold shadow-lg shadow-red-500/10 hover:shadow-red-500/30 transition-all duration-300 hover:scale-[1.02]">
                        Schedule Free Demo
                    </a>
                    <a href="#features" className="w-full sm:w-auto text-center px-8 py-4 rounded-xl bg-white/5 border border-white/10 font-semibold hover:bg-white/10 transition-all duration-300 flex items-center justify-center gap-2">
                        Explore Features
                    </a>
                </div>

                {/* Live Notification Feed Hook */}
                <div id="hero-feed-container" className="pt-6 border-t border-white/10 max-w-md opacity-0">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </div>
                        <span id="hero-live-feed" className="text-xs text-slate-400 font-mono">
                            Live Check: Grand Resort & Spa secured +₹4,120 in direct bookings this hour.
                        </span>
                    </div>
                </div>
            </div>

        </div>
    </section>

    {/* Detailed Alternating Features Ecosystem Section */}
    <section id="features" className="py-12 bg-darkBg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-4 reveal-up">
                <span className="text-xs text-accentCyan uppercase tracking-widest font-semibold px-3 py-1.5 bg-accentCyan/5 rounded-full border border-accentCyan/15">StayBooker AI Features</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">AI Solutions For Hotel, Perfected.</h2>
                <p className="text-slate-400 text-sm sm:text-base">A complete platform built for modern hotels. Explore how every module streamlines operations, automates workflows, and drives revenue growth across your property.</p>
            </div>
        </div>

        {/* FEATURE 1 */}
        <div className="py-16 border-b border-white/5 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-5 space-y-6 text-center lg:text-left order-2 lg:order-1 reveal-up">
                    <span className="px-3 py-1 text-xs font-semibold text-accentCyan bg-accentCyan/10 rounded-full border border-accentCyan/20 inline-block">Revenue Control</span>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">AI Revenue Assistant</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Make smarter revenue decisions with real-time visibility into occupancy, room sales, cancellations, and OTA performance. AI-powered recommendations use weather trends and local event data to help optimize pricing and maximize revenue.
                    </p>
                    <div className="flex flex-wrap justify-center lg:justify-start items-center gap-2">
                        <span className="text-[11px] sm:text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">✓ Real-time Weather Sync</span>
                        <span className="text-[11px] sm:text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">✓ Event Trigger Automation</span>
                    </div>
                    <div className="pt-2">
                        <a href="#revenue-details" className="inline-block px-7 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 hover:scale-105 active:scale-95 transition-all duration-300">
                            Read More
                        </a>
                    </div>
                </div>
                <div className="lg:col-span-7 flex justify-center order-1 lg:order-2 reveal-up">
                    <div className="w-full max-w-[550px] glass-panel rounded-2xl p-4 sm:p-6 border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
                            <span className="text-xs text-slate-400 font-mono">Dynamic Yield Console</span>
                            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row gap-2 justify-between sm:items-center">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Local Weather Event</p>
                                    <p className="text-xs sm:text-sm font-bold text-white mt-1">Heavy Rain Alert (Weekend)</p>
                                </div>
                                <span className="text-xs text-amber-400 font-mono self-start sm:self-auto">Rainy Weekend Adjuster</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left">
                                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Standard Price</p>
                                    <p className="text-base sm:text-lg font-bold text-slate-400 font-mono mt-1">₹18,400.00</p>
                                </div>
                                <div className="p-4 rounded-xl bg-gradient-to-tr from-red-500/10 to-rose-500/10 border border-accentCyan/30 text-left">
                                    <p className="text-[10px] text-accentCyan uppercase font-semibold">Optimized AI Rate</p>
                                    <p className="text-base sm:text-lg font-bold text-white font-mono mt-1">₹15,470.00 <span className="text-xs text-emerald-400 font-semibold">(-15.9%)</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* FEATURE 2 */}
        <div className="py-16 border-b border-white/5 relative bg-white/[0.01]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7 flex justify-center order-1 lg:order-1 reveal-up">
                    <div className="w-full max-w-[550px] glass-panel rounded-2xl p-4 sm:p-6 border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
                            <span className="text-xs text-slate-400 font-mono">Live Competitor Shopper</span>
                            <span className="text-xs text-accentCyan">Live Checks Active</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10 text-xs gap-2">
                                <span className="font-bold text-white">Your Direct Offer</span>
                                <span className="font-mono text-emerald-400 font-bold">₹14,900.00</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10 text-xs opacity-70 gap-2">
                                <span>Booking.com (OTA)</span>
                                <span className="font-mono text-white">₹17,900.00</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10 text-xs opacity-70 gap-2">
                                <span>Competitor Hotel A</span>
                                <span className="font-mono text-white">₹16,500.00</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="lg:col-span-5 space-y-6 text-center lg:text-left order-2 lg:order-2 reveal-up">
                    <span className="px-3 py-1 text-xs font-semibold text-accentCyan bg-accentCyan/10 rounded-full border border-accentCyan/20 inline-block">Competitor Insights</span>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">Rate Shopper</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Stay ahead of the competition with automated rate intelligence. Monitor competitor pricing and OTA rates in real time to identify opportunities and adjust your strategy faster.
                    </p>
                    <div className="pt-2">
                        <a href="#rate-shopper-details" className="inline-block px-7 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 hover:scale-105 active:scale-95 transition-all duration-300">
                            Read More
                        </a>
                    </div>
                </div>
            </div>
        </div>

        {/* FEATURE 3 */}
        <div className="py-16 border-b border-white/5 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-5 space-y-6 text-center lg:text-left order-2 lg:order-1 reveal-up">
                    <span className="px-3 py-1 text-xs font-semibold text-accentCyan bg-accentCyan/10 rounded-full border border-accentCyan/20 inline-block">Reputation AI</span>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">Auto Feedback Reply by AI</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Respond to online reviews instantly and professionally. Our AI instantly analyzes customer sentiments, drafting personalized, highly tailored responses for positive and neutral feedback, and tags complex negative reviews for human intervention.
                    </p>
                    <div className="pt-2">
                        <a href="#reputation-details" className="inline-block px-7 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 hover:scale-105 active:scale-95 transition-all duration-300">
                            Read More
                        </a>
                    </div>
                </div>

                <div className="lg:col-span-7 flex justify-center order-1 lg:order-2 reveal-up">
                    <div className="w-full max-w-[550px] glass-panel rounded-2xl p-4 sm:p-6 border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
                            <span className="text-xs text-slate-400 font-mono">Review Auto-Responder</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">AI Auto Drafted</span>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-white/5 p-3.5 rounded-lg border border-white/10 text-left space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-white">David Miller</span>
                                    <span className="text-amber-400 text-xs">★★★★★</span>
                                </div>
                                <p className="text-xs text-slate-300">"Excellent service, loved the quiet room. Breakfast was wonderful!"</p>
                            </div>
                            <div className="bg-red-950/10 p-3.5 rounded-lg border border-accentCyan/20 text-left space-y-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-accentCyan animate-pulse"></span>
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-accentCyan">AI Smart Drafted Response</span>
                                </div>
                                <p className="text-xs text-slate-200">"Dear David, thank you for your feedback! We are thrilled you loved our breakfast and room ambience. We look forward to welcome you back."</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* FEATURE 4 */}
        <div className="py-16 border-b border-white/5 relative bg-white/[0.01]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7 flex justify-center order-1 lg:order-1 reveal-up">
                    <div className="w-full max-w-[550px] glass-panel rounded-2xl p-4 sm:p-6 border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center space-y-1">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Overall Rating</span>
                                <h4 className="text-2xl sm:text-3xl font-extrabold text-white">4.92</h4>
                                <span className="text-amber-400 text-xs block">★★★★★</span>
                            </div>
                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center space-y-1">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Positive Sentiment</span>
                                <h4 className="text-2xl sm:text-3xl font-extrabold text-emerald-400">96.4%</h4>
                                <span className="text-[9px] text-slate-400">Automatic escalation active</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-5 space-y-6 text-center lg:text-left order-2 lg:order-2 reveal-up">
                    <span className="px-3 py-1 text-xs font-semibold text-accentCyan bg-accentCyan/10 rounded-full border border-accentCyan/20 inline-block">Brand Authority</span>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">Google Review Management</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Build a stronger online reputation without the hassle. Automatically collect Google reviews, generate AI-powered responses for positive and neutral feedback, and escalate negative reviews for management approval.
                    </p>
                    <div className="pt-2">
                        <a href="#google-reviews-details" className="inline-block px-7 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 hover:scale-105 active:scale-95 transition-all duration-300">
                            Read More
                        </a>
                    </div>
                </div>
            </div>
        </div>

        {/* FEATURE 5 */}
        <div className="py-16 border-b border-white/5 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-5 space-y-6 text-center lg:text-left order-2 lg:order-1 reveal-up">
                    <span className="px-3 py-1 text-xs font-semibold text-accentCyan bg-accentCyan/10 rounded-full border border-accentCyan/20 inline-block">WhatsApp Business</span>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">WhatsApp AI Booking Agent</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Turn conversations into bookings around the clock. Handle guest inquiries, collect leads, manage reservations, and communicate seamlessly in multiple languages through WhatsApp.
                    </p>
                    <div className="pt-2">
                        <a href="#whatsapp-agent-details" className="inline-block px-7 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 hover:scale-105 active:scale-95 transition-all duration-300">
                            Read More
                        </a>
                    </div>
                </div>
                <div className="lg:col-span-7 flex justify-center order-1 lg:order-2 reveal-up w-full">
                    <div className="w-full max-w-[420px] bg-[#075e54]/20 border border-[#25d366]/30 p-4 rounded-3xl shadow-2xl relative space-y-4">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                            <span className="w-3 h-3 rounded-full bg-[#25d366] block shrink-0"></span>
                            <span className="font-bold text-sm text-white">StayBooker WhatsApp Agent</span>
                        </div>
                        <div className="space-y-3">
                            <div className="bg-white/5 p-3 rounded-xl max-w-[85%] text-left text-xs text-slate-300">
                                "Hi, I want to book a room for this weekend."
                            </div>
                            <div className="bg-[#25d366]/20 border border-[#25d366]/30 p-3 rounded-xl max-w-[85%] ml-auto text-left text-xs text-white">
                                "Hello! Sure, we have Deluxe Villa available. Would you like to confirm the booking for ₹14,900/night?"
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* FEATURE 6 */}
        <div className="py-16 border-b border-white/5 relative bg-white/[0.01]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7 flex justify-center order-1 lg:order-1 reveal-up w-full">
                    <div className="w-full max-w-[420px] glass-panel rounded-3xl border border-white/10 p-4 sm:p-5 shadow-2xl relative space-y-4">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                            <div className="w-2 h-2 rounded-full bg-accentCyan animate-pulse"></div>
                            <span className="text-xs font-bold text-white">StayBooker AI Desk</span>
                        </div>
                        <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-left text-xs text-slate-300 leading-relaxed">
                            "Hi there! Need help? I can suggest the perfect suite or check available dates instantly."
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button className="p-2.5 bg-white/5 border border-white/10 text-[10px] text-white hover:border-accentCyan/30 rounded-lg text-center font-medium transition-all">Check Rooms</button>
                            <button className="p-2.5 bg-white/5 border border-white/10 text-[10px] text-white hover:border-accentCyan/30 rounded-lg text-center font-medium transition-all">Hotel Offers</button>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-5 space-y-6 text-center lg:text-left order-2 lg:order-2 reveal-up">
                    <span className="px-3 py-1 text-xs font-semibold text-accentCyan bg-accentCyan/10 rounded-full border border-accentCyan/20 inline-block">Guest Support</span>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">Website AI Chat Assistant</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Engage website visitors instantly with intelligent guest support. Answer questions, recommend rooms, and capture valuable leads automatically before they leave your website.
                    </p>
                    <div className="pt-2">
                        <a href="#chat-assistant-details" className="inline-block px-7 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 hover:scale-105 active:scale-95 transition-all duration-300">
                            Read More
                        </a>
                    </div>
                </div>
            </div>
        </div>

        {/* FEATURE 7 */}
        <div className="py-16 border-b border-white/5 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-5 space-y-6 text-center lg:text-left order-2 lg:order-1 reveal-up">
                    <div className="flex items-center justify-center lg:justify-start gap-2">
                        <span className="px-3 py-1 text-xs font-semibold text-accentCyan bg-accentCyan/10 rounded-full border border-accentCyan/20 inline-block">Smart Calling</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">Coming Soon</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">Voice Call AI Agent</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Automate follow-up calls to unconverted leads with AI-powered voice interactions. Increase conversion opportunities while reducing manual follow-up efforts.
                    </p>
                    <div className="pt-2">
                        <a href="#voice-agent-details" className="inline-block px-7 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 hover:scale-105 active:scale-95 transition-all duration-300">
                            Read More
                        </a>
                    </div>
                </div>
                <div className="lg:col-span-7 flex justify-center order-1 lg:order-2 reveal-up">
                    <div className="w-full max-w-[500px] glass-panel rounded-2xl p-4 sm:p-6 border border-white/10 shadow-2xl relative text-center space-y-4">
                        <span className="text-xs text-slate-500 uppercase tracking-widest font-mono">Live Calling Waveform</span>
                        <div className="h-20 flex items-center justify-center gap-1.5 py-4">
                            <span className="w-1.5 h-6 bg-accentCyan rounded-full animate-bounce" style={{'animation-delay': '0.1s'}}></span>
                            <span className="w-1.5 h-12 bg-accentCyan rounded-full animate-bounce" style={{'animation-delay': '0.2s'}}></span>
                            <span className="w-1.5 h-16 bg-accentCyan rounded-full animate-bounce" style={{'animation-delay': '0.3s'}}></span>
                            <span className="w-1.5 h-8 bg-accentCyan rounded-full animate-bounce" style={{'animation-delay': '0.4s'}}></span>
                            <span className="w-1.5 h-14 bg-accentCyan rounded-full animate-bounce" style={{'animation-delay': '0.5s'}}></span>
                        </div>
                        <p className="text-xs text-slate-400">Automating lead conversion seamlessly through dynamic voice lines.</p>
                    </div>
                </div>
            </div>
        </div>

        {/* FEATURE 8 */}
        <div className="py-16 border-b border-white/5 relative bg-white/[0.01]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7 flex justify-center order-1 lg:order-1 reveal-up">
                    <div className="w-full max-w-[550px] bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-2xl text-left space-y-4">
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-white">Google Search Results</span>
                        </div>
                        <div className="p-3 sm:p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                                <span className="text-xs font-bold text-accentCyan">❖ StayBooker Luxury Suites Official Website </span>
                                <span className="text-[10px] text-slate-400 font-mono self-start sm:self-auto">Official Site</span>
                            </div>
                            <p className="text-[11px] text-slate-400">From ₹14,900/night Free Wi-Fi • Breakfast Included Book Direct for Best Available Rate</p>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-5 space-y-6 text-center lg:text-left order-2 lg:order-2 reveal-up">
                    <span className="px-3 py-1 text-xs font-semibold text-accentCyan bg-accentCyan/10 rounded-full border border-accentCyan/20 inline-block">Ads Platform</span>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">Google Hotel Ads Integration</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Increase direct booking visibility by connecting your property to Google Hotel Ads. Reach travelers at the moment they are searching and drive commission-free bookings.
                    </p>
                    <div className="pt-2">
                        <a href="#hotel-ads-details" className="inline-block px-7 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 hover:scale-105 active:scale-95 transition-all duration-300">
                            Read More
                        </a>
                    </div>
                </div>
            </div>
        </div>

        {/* FEATURE 9 */}
        <div className="py-16 border-b border-white/5 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-5 space-y-6 text-center lg:text-left order-2 lg:order-1 reveal-up">
                    <span className="px-3 py-1 text-xs font-semibold text-accentCyan bg-accentCyan/10 rounded-full border border-accentCyan/20 inline-block">Secure SMTP</span>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">Custom Email System</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Deliver professional guest communication using your own branded email domain. SMTP integration ensures reliable delivery for confirmations, inquiries, and marketing campaigns.
                    </p>
                    <div className="pt-2">
                        <a href="#email-system-details" className="inline-block px-7 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 hover:scale-[1.03] transition-all">
                            Read More
                        </a>
                    </div>
                </div>
                <div className="lg:col-span-7 flex justify-center order-1 lg:order-2 reveal-up">
                    <div className="w-full max-w-[550px] glass-panel rounded-2xl p-4 sm:p-6 border border-white/10 shadow-2xl relative text-left">
                        <div className="border-b border-white/5 pb-3 mb-4 flex justify-between items-center gap-2">
                            <span className="text-xs text-slate-400 truncate">SMTP Server Delivery Report</span>
                            <span className="text-xs text-emerald-400 font-mono font-bold shrink-0">● Sent Successfully</span>
                        </div>
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2 overflow-hidden">
                            <p className="text-xs text-slate-400 font-mono truncate">From: reservations@yourhotel.com</p>
                            <p className="text-xs text-slate-400 font-mono truncate">To: guest@staybooker.ai</p>
                            <div className="h-[1px] bg-white/5 my-2"></div>
                            <p className="text-sm font-bold text-white">Your reservation is confirmed! ✓</p>
                            <p className="text-xs text-slate-400 leading-relaxed">Thank you for choosing StayBooker. We are preparing everything for your arrival.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* FEATURE 10 */}
        <div className="py-16 border-b border-white/5 relative bg-white/[0.01]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7 flex justify-center order-1 lg:order-1 reveal-up">
                    <div className="w-full max-w-[550px] glass-panel rounded-2xl p-4 sm:p-6 border border-white/10 shadow-2xl text-left space-y-4">
                        <span className="text-xs text-slate-400 font-mono block">Domain & Whitelabel Settings</span>
                        <div className="space-y-3">
                            <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-1.5">
                                <span className="text-[10px] text-slate-400 uppercase font-semibold">Custom Masking URL</span>
                                <div className="text-xs sm:text-sm font-mono text-white truncate">booking.yourhoteldomain.com</div>
                            </div>
                            <div className="flex justify-between items-center p-3.5 bg-white/5 border border-white/10 rounded-xl gap-2">
                                <span className="text-xs font-semibold">Platform Interface Theme</span>
                                <span className="px-2.5 py-0.5 rounded bg-accentCyan/10 text-accentCyan border border-accentCyan/20 text-[10px] sm:text-xs font-bold shrink-0">Premium Red</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-5 space-y-6 text-center lg:text-left order-2 lg:order-2 reveal-up">
                    <span className="px-3 py-1 text-xs font-semibold text-accentCyan bg-accentCyan/10 rounded-full border border-accentCyan/20 inline-block">Whitelabel branding</span>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">URL Masking & UI Customization</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Create a seamless brand experience with your own booking domain, customized platform branding, and personalized interface themes tailored to your hotel.
                    </p>
                    <div className="pt-2">
                        <a href="#whitelabel-details" className="inline-block px-7 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 hover:scale-105 active:scale-95 transition-all duration-300">
                            Read More
                        </a>
                    </div>
                </div>
            </div>
        </div>

        {/* FEATURE 11 */}
        <div className="py-16 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-5 space-y-6 text-center lg:text-left order-2 lg:order-1 reveal-up">
                    <span className="px-3 py-1 text-xs font-semibold text-accentCyan bg-accentCyan/10 rounded-full border border-accentCyan/20 inline-block">Deep Insights</span>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics & Reporting</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Track the metrics that matter most. Access detailed reports on revenue, bookings, occupancy, lead generation, and overall business performance from a single dashboard.
                    </p>
                    <div className="pt-2">
                        <a href="#analytics-details" className="inline-block px-7 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 hover:scale-105 active:scale-95 transition-all duration-300">
                            Read More
                        </a>
                    </div>
                </div>
                <div className="lg:col-span-7 flex justify-center order-1 lg:order-2 reveal-up">
                    <div className="w-full max-w-[550px] glass-panel rounded-2xl p-4 sm:p-6 border border-white/10 shadow-2xl text-left space-y-6">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400 font-mono">Performance Analytics</span>
                            <span className="text-xs text-accentCyan">Dynamic Updates Live</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:gap-4">
                            <div className="bg-white/5 p-2 sm:p-3 rounded-xl border border-white/5 text-center">
                                <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold">Direct Share</span>
                                <p className="text-base sm:text-lg font-bold text-accentCyan mt-1">68.4%</p>
                            </div>
                            <div className="bg-white/5 p-2 sm:p-3 rounded-xl border border-white/5 text-center">
                                <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold">Occupancy</span>
                                <p className="text-base sm:text-lg font-bold text-white mt-1">86.2%</p>
                            </div>
                            <div className="bg-white/5 p-2 sm:p-3 rounded-xl border border-white/5 text-center">
                                <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold">RevPAR</span>
                                <p className="text-base sm:text-lg font-bold text-white mt-1 font-mono truncate">₹12,294</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {/* FAQ Section (Accordion) */}
    <section className="py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 space-y-4 reveal-up">
            <span className="text-xs text-accentCyan uppercase tracking-widest font-semibold font-mono">Common Queries</span>
            <h2 className="text-3xl font-extrabold">Frequently Asked Questions</h2>
            <p className="text-slate-400 text-sm">Everything you need to know about setting up your booking engine.</p>
        </div>

        <div className="space-y-4" id="faq-accordions">
            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden reveal-up">
                <button onclick="toggleFaq(1)" className="w-full px-4 sm:px-6 py-4 sm:py-5 text-left font-bold text-sm sm:text-base flex items-center justify-between hover:text-accentCyan transition-colors gap-4">
                    <span>1. What makes StayBooker one of the leading AI Solutions for Hotels?</span>
                    <span id="faq-icon-1" className="text-slate-400 transition-transform duration-300 shrink-0">+</span>
                </button>
                <div id="faq-content-1" className="hidden px-4 sm:px-6 pb-5 text-xs sm:text-sm text-slate-400 leading-relaxed transition-all duration-300">
                    StayBooker combines intelligent automation, data-driven insights, and guest engagement tools to help hotels streamline operations, increase direct bookings, and improve overall profitability through advanced AI technology.
                </div>
            </div>

            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden reveal-up">
                <button onclick="toggleFaq(2)" className="w-full px-4 sm:px-6 py-4 sm:py-5 text-left font-bold text-sm sm:text-base flex items-center justify-between hover:text-accentCyan transition-colors gap-4">
                    <span>2. How does StayBooker simplify Hotel Management Software?</span>
                    <span id="faq-icon-2" className="text-slate-400 transition-transform duration-300 shrink-0">+</span>
                </button>
                <div id="faq-content-2" className="hidden px-4 sm:px-6 pb-5 text-xs sm:text-sm text-slate-400 leading-relaxed transition-all duration-300">
                    StayBooker centralizes reservations, guest profiles, room inventory, housekeeping, and operational workflows into a single platform, making hotel management more efficient and easier to control.
                </div>
            </div>

            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden reveal-up">
                <button onclick="toggleFaq(3)" className="w-full px-4 sm:px-6 py-4 sm:py-5 text-left font-bold text-sm sm:text-base flex items-center justify-between hover:text-accentCyan transition-colors gap-4">
                    <span>3. How can the StayBooker Hotel Booking Engine increase direct bookings?</span>
                    <span id="faq-icon-3" className="text-slate-400 transition-transform duration-300 shrink-0">+</span>
                </button>
                <div id="faq-content-3" className="hidden px-4 sm:px-6 pb-5 text-xs sm:text-sm text-slate-400 leading-relaxed transition-all duration-300">
                    The StayBooker Hotel Booking Engine provides a seamless booking experience, real-time availability updates, and conversion-focused booking flows that help hotels reduce OTA dependency and increase direct revenue.
                </div>
            </div>

            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden reveal-up">
                <button onclick="toggleFaq(4)" className="w-full px-4 sm:px-6 py-4 sm:py-5 text-left font-bold text-sm sm:text-base flex items-center justify-between hover:text-accentCyan transition-colors gap-4">
                    <span>4. How does the StayBooker Hotel Revenue Management System improve profitability?</span>
                    <span id="faq-icon-4" className="text-slate-400 transition-transform duration-300 shrink-0">+</span>
                </button>
                <div id="faq-content-4" className="hidden px-4 sm:px-6 pb-5 text-xs sm:text-sm text-slate-400 leading-relaxed transition-all duration-300">
                    The StayBooker Hotel Revenue Management System uses real-time data, demand forecasting, and dynamic pricing recommendations to help hotels optimize rates, maximize occupancy, and increase RevPAR.
                </div>
            </div>
        </div>
    </section>
   
    {/* Testimonials Section */}
    <section id="testimonials" className="py-24 bg-darkBg relative overflow-hidden border-t border-white/5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primaryBlue/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-4 reveal-up">
                <span className="text-xs text-accentCyan uppercase tracking-widest font-semibold px-3 py-1.5 bg-accentCyan/5 rounded-full border border-accentCyan/15">
                    Client Success
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                    Trusted by Leading Hoteliers
                </h2>
                <p className="text-slate-400 text-sm">
                    See how independent luxury properties and boutique resort groups are scaling their direct revenue.
                </p>
            </div>

            <div className="relative overflow-hidden px-4 py-8 max-w-3xl mx-auto" id="testimonial-slider-container">
                <div id="testimonial-track" className="flex transition-transform duration-500 ease-out cursor-grab active:cursor-grabbing">
                    
                    {/* Slide 1 */}
                    <div className="w-full shrink-0 px-4">
                        <div className="glass-card p-6 sm:p-8 rounded-3xl h-full flex flex-col justify-between relative overflow-hidden group">
                            <div className="absolute top-0 right-0 bg-emerald-500/10 text-emerald-400 text-[9px] sm:text-[10px] font-bold uppercase px-3 py-1.5 rounded-bl-xl tracking-wider border-l border-b border-emerald-500/15">
                                +34% Direct Bookings
                            </div>
                            <div className="space-y-6 pt-8 sm:pt-4">
                                <div className="flex items-center gap-1 text-accentCyan">
                                    <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                                </div>
                                <p className="text-slate-300 text-xs sm:text-sm italic leading-relaxed">
                                    "Switching to StayBooker AI was a turning point for our resort. We saw a drastic drop in OTA commissions within the first 30 days. The automated WhatsApp agent handles guest queries effortlessly."
                                </p>
                            </div>
                            <div className="flex items-center gap-4 pt-6 border-t border-white/5 mt-6">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accentCyan/20 flex items-center justify-center font-bold text-white text-xs sm:text-sm border border-accentCyan/30 shrink-0">
                                    RM
                                </div>
                                <div className="text-left min-w-0">
                                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">Rohan Malhotra</h4>
                                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">General Manager, Vera Vista Resorts</p>
                                    <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono">Goa, India</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Slide 2 */}
                    <div className="w-full shrink-0 px-4">
                        <div className="glass-card p-6 sm:p-8 rounded-3xl h-full flex flex-col justify-between relative overflow-hidden group">
                            <div className="absolute top-0 right-0 bg-accentCyan/10 text-accentCyan text-[9px] sm:text-[10px] font-bold uppercase px-3 py-1.5 rounded-bl-xl tracking-wider border-l border-b border-accentCyan/15">
                                Saved ₹4.2L In Commissions
                            </div>
                            <div className="space-y-6 pt-8 sm:pt-4">
                                <div className="flex items-center gap-1 text-accentCyan">
                                    <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                                </div>  
                                <p className="text-slate-300 text-xs sm:text-sm italic leading-relaxed">
                                    "The dynamic rate shopper and automated review replies have saved our team hours of manual work. Our direct booking share has grown from 12% to over 45% now."
                                </p>
                            </div>
                            <div className="flex items-center gap-4 pt-6 border-t border-white/5 mt-6">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accentCyan/20 flex items-center justify-center font-bold text-white text-xs sm:text-sm border border-accentCyan/30 shrink-0">
                                    AD
                                </div>
                                <div className="text-left min-w-0">
                                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">Ananya Deshmukh</h4>
                                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">Revenue Director, Luminary Suites</p>
                                    <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono">Mumbai, India</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Slide 3 */}
                    <div className="w-full shrink-0 px-4">
                        <div className="glass-card p-6 sm:p-8 rounded-3xl h-full flex flex-col justify-between relative overflow-hidden group">
                            <div className="absolute top-0 right-0 bg-emerald-500/10 text-emerald-400 text-[9px] sm:text-[10px] font-bold uppercase px-3 py-1.5 rounded-bl-xl tracking-wider border-l border-b border-emerald-500/15">
                                64% Loyalty Rate
                            </div>
                            <div className="space-y-6 pt-8 sm:pt-4">
                                <div className="flex items-center gap-1 text-accentCyan">
                                    <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                                </div>
                                <p className="text-slate-300 text-xs sm:text-sm italic leading-relaxed">
                                    "Our guests love the custom-branded booking process. URL masking keeps our identity intact, and the direct Google Ads integration brings high-quality booking intents."
                                </p>
                            </div>
                            <div className="flex items-center gap-4 pt-6 border-t border-white/5 mt-6">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accentCyan/20 flex items-center justify-center font-bold text-white text-xs sm:text-sm border border-accentCyan/30 shrink-0">
                                    VS
                                </div>
                                <div className="text-left min-w-0">
                                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">Vikram Singh</h4>
                                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">Owner, Aethelgard Heritage Hotels</p>
                                    <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono">Udaipur, India</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Slide 4 */}
                    <div className="w-full shrink-0 px-4">
                        <div className="glass-card p-6 sm:p-8 rounded-3xl h-full flex flex-col justify-between relative overflow-hidden group">
                            <div className="absolute top-0 right-0 bg-emerald-500/10 text-emerald-400 text-[9px] sm:text-[10px] font-bold uppercase px-3 py-1.5 rounded-bl-xl tracking-wider border-l border-b border-emerald-500/15">
                                +2.8x ROI Achieved
                            </div>
                            <div className="space-y-6 pt-8 sm:pt-4">
                                <div className="flex items-center gap-1 text-accentCyan">
                                    <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                                </div>
                                <p className="text-slate-300 text-xs sm:text-sm italic leading-relaxed">
                                    "The seamless integration with our PMS was completed in just 4 days. Having a flat pricing model with no booking commissions has increased our profit margins instantly."
                                </p>
                            </div>
                            <div className="flex items-center gap-4 pt-6 border-t border-white/5 mt-6">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accentCyan/20 flex items-center justify-center font-bold text-white text-xs sm:text-sm border border-accentCyan/30 shrink-0">
                                    KL
                                </div>
                                <div className="text-left min-w-0">
                                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">Kunal Luthra</h4>
                                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">Operations Head, The Sonder Inn</p>
                                    <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono">Bangalore, India</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Navigation Indicator Dots */}
                <div className="flex justify-center items-center gap-2 mt-10" id="testimonial-dots">
                    {/* Dots generated dynamically by JS */}
                </div>
            </div>
        </div>
    </section>

    {/* Final CTA Section (Cinematic Background Globe Simulation) */}
    <section id="demo" className="relative py-24 sm:py-32 px-4 overflow-hidden border-t border-white/10 bg-darkBg">
        <div className="absolute inset-0 opacity-15 pointer-events-none flex items-center justify-center">
            <svg id="globe-network-svg" className="w-[800px] h-[800px]" viewBox="0 0 200 200" fill="none">
                <circle cx="100" cy="100" r="80" stroke="#DC2626" strokeWidth="0.5" stroke-dasharray="4,4"/>
                <circle cx="100" cy="100" r="50" stroke="#F43F5E" strokeWidth="0.5" stroke-dasharray="2,2"/>
                <circle cx="100" cy="100" r="20" stroke="#F43F5E" strokeWidth="0.3"/>
                <line x1="20" y1="100" x2="180" y2="100" stroke="#DC2626" strokeWidth="0.2"/>
                <line x1="100" y1="20" x2="100" y2="180" stroke="#DC2626" strokeWidth="0.2"/>
                <circle cx="45" cy="55" r="2" fill="#F43F5E" className="animate-pulse"/>
                <circle cx="155" cy="145" r="2.5" fill="#DC2626" className="animate-pulse"/>
                <circle cx="120" cy="30" r="1.5" fill="#F43F5E"/>
                <circle cx="80" cy="170" r="2" fill="#DC2626"/>
            </svg>
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-8 z-10">
            <span className="text-xs text-accentCyan uppercase tracking-widest font-semibold px-3 py-1.5 bg-accentCyan/10 rounded-full border border-accentCyan/20 reveal-up">Demo Reservation Request</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight reveal-up">Ready to Drive Direct Sales Volume?</h2>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto reveal-up">
                Schedule an exploratory session with our technical integrations team to walk through custom dashboard flows and see how StayBooker AI can fit into your operations.
            </p>

            {/* Dynamic Mock Calendar Demo Booker */}
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 shadow-2xl max-w-lg mx-auto text-left space-y-4 reveal-up" id="demo-form-panel">
                <h4 className="text-xs sm:text-sm font-semibold uppercase text-slate-400 font-mono">Request demo consultation</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input type="text" placeholder="Full Name" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accentCyan/50 text-white w-full transition-colors" />
                    <input type="email" placeholder="Business Email" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accentCyan/50 text-white w-full transition-colors" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input type="text" placeholder="Hotel Name" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accentCyan/50 text-white w-full transition-colors" />
                    <select className="bg-[#140E0E] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accentCyan/50 text-slate-300 w-full transition-colors">
                        <option value="">Property Count: 1-5 units</option>
                        <option value="">Property Count: 6-25 units</option>
                        <option value="">Property Count: 26-100 units</option>
                        <option value="">Property Count: 100+ units</option>
                    </select>
                </div>
                <button onclick="alert('Thank you for your interest! The StayBooker team will reach out shortly to schedule your demo.')" className="w-full py-4 rounded-xl bg-gradient-to-r from-primaryBlue to-accentCyan text-white font-bold text-sm tracking-wide shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all duration-300">
                    Schedule Free Demo Consultation
                </button>
            </div>
        </div>
    </section>

            <LandingFooter />
        </div>
    );
}
