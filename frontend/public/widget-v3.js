(function (window, document) {
    'use strict';

    // Loader ka origin uske apne <script src> se nikaalte hain — hotelier agar
    // frontendUrl pass karna bhool jaye to bhi widget sahi host se load hota hai
    var SCRIPT_ORIGIN = (function () {
        try {
            var src = document.currentScript && document.currentScript.src;
            return src ? new URL(src).origin : null;
        } catch (e) {
            return null;
        }
    })();

    var booted = false;

    function init(config) {
        config = config || {};
        var container = document.getElementById('hotelier-booking-widget');

        var hotelSlug = config.hotelSlug
            || (container && container.getAttribute('data-hotel-slug'))
            || null;
        var frontendUrl = config.frontendUrl || SCRIPT_ORIGIN || window.location.origin;
        var widgetLayout = config.widgetLayout
            || (container && container.getAttribute('data-widget-layout'))
            || 'modern';
        var primaryColor = sanitizeColor(
            config.primaryColor || (container && container.getAttribute('data-color'))
        );

        if (!hotelSlug) {
            console.error('Hotelier Widget: missing hotel slug — pass init({ hotelSlug }) or set data-hotel-slug on #hotelier-booking-widget');
            return;
        }
        if (booted) return;
        booted = true;

        var widgetOrigin;
        try {
            widgetOrigin = new URL(frontendUrl).origin;
        } catch (e) {
            widgetOrigin = window.location.origin;
        }

        // Connection warm-up: iframe document + API dono ke TLS handshakes
        // host page parse hote hi shuru ho jate hain
        preconnect(frontendUrl, false);
        if (config.apiUrl) {
            try { preconnect(new URL(config.apiUrl).origin, true); } catch (e) { /* invalid apiUrl — skip */ }
        }

        injectLoaderStyles();

        if (container) {
            renderWidget(container, hotelSlug, frontendUrl, widgetOrigin, widgetLayout);
        } else {
            console.warn('Hotelier Widget: #hotelier-booking-widget container not found — booking bar skipped, chat widget only');
        }

        renderChatWidget(hotelSlug, frontendUrl, widgetOrigin, primaryColor, !!container);
    }

    function sanitizeColor(col) {
        return (col && /^#[0-9a-fA-F]{3,8}$/.test(col)) ? col : '#7c3aed';
    }

    function preconnect(href, crossOrigin) {
        try {
            if (document.querySelector('link[rel="preconnect"][href="' + href + '"]')) return;
            var link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = href;
            if (crossOrigin) link.crossOrigin = 'anonymous';
            (document.head || document.documentElement).appendChild(link);
        } catch (e) { /* best effort */ }
    }

    function injectLoaderStyles() {
        if (document.getElementById('hotelier-widget-loader-css')) return;
        var style = document.createElement('style');
        style.id = 'hotelier-widget-loader-css';
        style.textContent =
            '@keyframes hotelier-shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}' +
            '.hotelier-skeleton-line{background:linear-gradient(90deg,#eef2f7 25%,#f8fafc 37%,#eef2f7 63%);background-size:600px 100%;animation:hotelier-shimmer 1.3s ease-in-out infinite;border-radius:12px;}' +
            '@media (max-width:768px){.hotelier-chat-skel-text{display:none !important}}';
        (document.head || document.documentElement).appendChild(style);
    }

    // Booking bar ka instant skeleton — real iframe ready hone tak host page pe
    // widget "pehle se loaded" feel deta hai
    function buildSkeleton(barHeight) {
        var skel = document.createElement('div');
        skel.style.cssText =
            'position:absolute;top:8px;left:8px;right:8px;height:' + Math.max(barHeight - 16, 56) + 'px;' +
            'background:#fff;border:1px solid rgba(15,23,42,.06);border-radius:24px;' +
            'box-shadow:0 18px 45px -18px rgba(15,23,42,.18);' +
            'display:flex;align-items:center;gap:12px;padding:0 20px;box-sizing:border-box;' +
            'transition:opacity .3s ease;overflow:hidden;';
        for (var i = 0; i < 3; i++) {
            var line = document.createElement('div');
            line.className = 'hotelier-skeleton-line';
            line.style.cssText = (i === 2 ? 'flex:0 0 120px;' : 'flex:1;') + 'height:44px;max-height:60%;';
            skel.appendChild(line);
        }
        return skel;
    }

    function renderWidget(container, hotelSlug, frontendUrl, widgetOrigin, widgetLayout) {
        if (container.getAttribute('data-hotelier-widget-ready') === '1') return;
        container.setAttribute('data-hotelier-widget-ready', '1');

        // Pehle paint ke liye layout-wise approximate height; iframe baad mein
        // apni asli content height (WIDGET_HEIGHT) bhejta rehta hai
        // FAR = compact rate badge, no calendar — stays 72 px always
        var barHeight = widgetLayout === 'classic' ? 360 : widgetLayout === 'minimal' ? 85 : widgetLayout === 'far' ? 72 : 110;
        var provisionalOpenHeight = widgetLayout === 'classic' ? 750 : 550;

        // Sirf apne container ko style karte hain. Host page ke parent elements
        // ko KABHI mutate nahi karna — purane z-index/overflow hacks hotelier
        // sites ke sliders/sticky headers tod dete the.
        container.style.setProperty('position', 'relative', 'important');
        container.style.setProperty('display', 'block', 'important');
        container.style.setProperty('height', 'auto', 'important');
        container.style.setProperty('overflow', 'visible', 'important');

        var spacer = document.createElement('div');
        spacer.style.cssText = 'display:block;width:100%;height:' + barHeight + 'px;transition:height .2s ease;';

        var skeleton = buildSkeleton(barHeight);

        var iframe = document.createElement('iframe');
        iframe.src = frontendUrl + '/book/' + encodeURIComponent(hotelSlug) + '/widget?preview_layout=' + encodeURIComponent(widgetLayout);
        iframe.title = 'Hotel Booking Search';
        iframe.loading = 'eager';
        iframe.setAttribute('fetchpriority', 'high');
        iframe.setAttribute('allowtransparency', 'true');
        iframe.style.cssText =
            'position:absolute;top:0;left:0;width:100%;height:' + barHeight + 'px;' +
            'border:none;z-index:9999;background:transparent;color-scheme:normal;' +
            'opacity:0;transition:opacity .3s ease,height .2s ease;';

        container.innerHTML = '';
        container.appendChild(spacer);
        container.appendChild(skeleton);
        container.appendChild(iframe);

        var overlayOpen = false;
        var contentHeight = barHeight;
        var revealed = false;

        function reveal() {
            if (revealed) return;
            revealed = true;
            iframe.style.opacity = '1';
            skeleton.style.opacity = '0';
            setTimeout(function () {
                if (skeleton.parentNode) skeleton.parentNode.removeChild(skeleton);
            }, 350);
        }

        // Purana app build WIDGET_READY na bheje to bhi load ke baad dikha dete hain
        iframe.addEventListener('load', function () {
            setTimeout(reveal, 800);
        });

        function viewportCap(topPx) {
            return Math.max(window.innerHeight - topPx - 12, 200);
        }

        function applyHeights() {
            if (overlayOpen) {
                var top = parseFloat(iframe.style.top) || 0;
                iframe.style.height = Math.min(contentHeight, viewportCap(top)) + 'px';
                // Spacer stays at its natural bar height so host page layout doesn't jump
                spacer.style.height = barHeight + 'px';
            } else {
                iframe.style.height = contentHeight + 'px';
                spacer.style.height = barHeight + 'px'; // Fix: spacer never blindly follows overlay height!
            }
        }

        function syncOverlayPosition() {
            var rect = spacer.getBoundingClientRect();
            iframe.style.top = rect.top + 'px';
            iframe.style.left = rect.left + 'px';
            iframe.style.width = rect.width + 'px';
            applyHeights();
        }

        function setOverlay(open) {
            if (open === overlayOpen) return;
            overlayOpen = open;
            if (open) {
                // Calendar/guest picker khulne par iframe viewport-fixed ho jata
                // hai: host ke overflow:hidden ya stacking context se bahar nikal
                // jata hai bina host page ki ek bhi style chhede
                iframe.style.position = 'fixed';
                iframe.style.zIndex = '2147483647';
                contentHeight = Math.max(contentHeight, provisionalOpenHeight);
                syncOverlayPosition();
                window.addEventListener('scroll', syncOverlayPosition, true);
                window.addEventListener('resize', syncOverlayPosition);
            } else {
                window.removeEventListener('scroll', syncOverlayPosition, true);
                window.removeEventListener('resize', syncOverlayPosition);
                iframe.style.position = 'absolute';
                iframe.style.top = '0';
                iframe.style.left = '0';
                iframe.style.width = '100%';
                iframe.style.zIndex = '9999';
                applyHeights();
            }
        }

        window.addEventListener('message', function (event) {
            // Sirf apne hi iframe ke messages — host page ke doosre iframes
            // (ads/analytics) widget ko control nahi kar sakte
            if (event.origin !== widgetOrigin || event.source !== iframe.contentWindow) return;
            var data = event.data;
            if (!data || typeof data !== 'object') return;

            if (data.type === 'WIDGET_READY') {
                reveal();
            } else if (data.type === 'WIDGET_HEIGHT') {
                var h = Number(data.height);
                var bh = Number(data.baseHeight) || h; // Fallback for older widget builds
                if (isFinite(h) && h > 40 && h < 4000) {
                    contentHeight = Math.ceil(h);
                    barHeight = Math.ceil(bh);
                    applyHeights();
                }
            } else if (data.type === 'RESIZE_OVERLAY') {
                reveal();
                setOverlay(!!data.open);
            }
        });
    }

    function renderChatWidget(hotelSlug, frontendUrl, widgetOrigin, primaryColor, hasBookingWidget) {
        if (!document.body) {
            // Script <head> mein async load hua aur body abhi parse nahi hui
            document.addEventListener('DOMContentLoaded', function () {
                renderChatWidget(hotelSlug, frontendUrl, widgetOrigin, primaryColor, hasBookingWidget);
            });
            return;
        }
        if (document.getElementById('hotelier-chat-widget') || document.getElementById('hotelier-chat-skeleton')) return;

        var BTN_W = '280px';
        var BTN_H = '76px';

        function isMobileView() { return window.innerWidth <= 768; }
        function bottomFor() { return isMobileView() ? 16 : (hasBookingWidget ? 110 : 24); }
        function rightFor() { return isMobileView() ? 10 : 20; }

        // Placeholder pill — host page ke saath hi turant dikh jata hai, real
        // chat iframe peeche idle time mein load hota hai. Position chat iframe
        // ke andar wale button (bottom-4 right-4 = +16px inset) se match karti hai.
        var skel = document.createElement('div');
        skel.id = 'hotelier-chat-skeleton';
        skel.style.cssText =
            'position:fixed;z-index:99998;display:flex;align-items:center;gap:10px;' +
            'background:rgba(255,255,255,.95);border:1px solid #f1f5f9;border-radius:9999px;' +
            'padding:8px 22px 8px 10px;box-shadow:0 8px 30px rgba(0,0,0,.12);' +
            'transition:opacity .3s ease;cursor:default;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';

        var icon = document.createElement('img');
        icon.src = frontendUrl + '/webmerito-icon.png';
        icon.alt = 'Chat';
        icon.style.cssText = 'width:40px;height:40px;object-fit:contain;display:block;';
        icon.onerror = function () { icon.style.visibility = 'hidden'; };
        skel.appendChild(icon);

        var text = document.createElement('div');
        text.className = 'hotelier-chat-skel-text';
        text.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;padding-right:6px;';
        var label = document.createElement('span');
        label.textContent = 'LIVE CONCIERGE';
        label.style.cssText = 'font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:.1em;line-height:1;margin-bottom:4px;';
        var headline = document.createElement('span');
        headline.textContent = 'How can I help?';
        headline.style.cssText = 'font-size:15px;font-weight:900;letter-spacing:-.01em;line-height:1;color:' + primaryColor + ';';
        text.appendChild(label);
        text.appendChild(headline);
        skel.appendChild(text);

        function positionFloating() {
            skel.style.bottom = (bottomFor() + 16) + 'px';
            skel.style.right = (rightFor() + 16) + 'px';
        }
        positionFloating();
        document.body.appendChild(skel);

        var chatIframe = null;
        var chatRevealed = false;

        function chatReveal() {
            if (chatRevealed) return;
            chatRevealed = true;
            if (chatIframe) chatIframe.style.opacity = '1';
            skel.style.opacity = '0';
            setTimeout(function () {
                if (skel.parentNode) skel.parentNode.removeChild(skel);
            }, 350);
        }

        function positionChat() {
            if (!chatIframe) return;
            chatIframe.style.bottom = bottomFor() + 'px';
            chatIframe.style.right = rightFor() + 'px';
        }

        function mountChatIframe() {
            if (chatIframe) return;
            chatIframe = document.createElement('iframe');
            chatIframe.id = 'hotelier-chat-widget';
            chatIframe.src = frontendUrl + '/book/' + encodeURIComponent(hotelSlug) + '/chat';
            chatIframe.title = 'Hotel AI Concierge Chat';
            chatIframe.style.cssText =
                'position:fixed;left:auto;top:auto;width:' + BTN_W + ';height:' + BTN_H + ';' +
                'border:none;z-index:99999;background:transparent;color-scheme:normal;box-shadow:none;' +
                'opacity:0;transition:opacity .3s ease,width .3s ease,height .3s ease;';
            positionChat();
            document.body.appendChild(chatIframe);

            // Safety net: app purana ho aur ready signal na aaye to bhi swap ho jaye
            chatIframe.addEventListener('load', function () {
                setTimeout(chatReveal, 1500);
            });

            window.addEventListener('message', function (event) {
                if (event.origin !== widgetOrigin || event.source !== chatIframe.contentWindow) return;
                var data = event.data;
                if (!data || typeof data !== 'object') return;

                if (data.type === 'CHAT_READY') {
                    chatReveal();
                } else if (data.type === 'CHAT_OPEN') {
                    chatReveal();
                    chatIframe.style.width = isMobileView() ? '95vw' : '400px';
                    chatIframe.style.height = isMobileView() ? '80vh' : '650px';
                    chatIframe.style.borderRadius = '16px';
                    chatIframe.style.boxShadow = '0 25px 50px -12px rgba(0,0,0,.25)';
                } else if (data.type === 'CHAT_CLOSE') {
                    chatReveal();
                    chatIframe.style.width = BTN_W;
                    chatIframe.style.height = BTN_H;
                    chatIframe.style.borderRadius = '0';
                    chatIframe.style.boxShadow = 'none';
                }
            });
        }

        // Booking widget pehle network priority le, chat idle time mein aaye —
        // placeholder ki wajah se user ko deri dikhti hi nahi
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(mountChatIframe, { timeout: 2500 });
        } else {
            setTimeout(mountChatIframe, 1200);
        }

        window.addEventListener('resize', function () {
            positionFloating();
            positionChat();
        });
    }

    // Single-tag embed: agar container pe data-hotel-slug hai to explicit
    // init() call ke bina bhi widget khud boot ho jata hai
    function autoInit() {
        if (booted) return;
        var container = document.getElementById('hotelier-booking-widget');
        if (container && container.getAttribute('data-hotel-slug')) init({});
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

    window.HotelierWidget = {
        init: init
    };

})(window, document);
