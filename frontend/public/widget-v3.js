(function (window) {
    'use strict';

    function init(config) {
        // Intentionally do NOT call console.clear() here — clearing the host
        // page's console would destroy any debugging information the hotelier's
        // developer has already logged, and is universally considered hostile
        // behaviour for a third-party widget.

        var hotelSlug = config ? config.hotelSlug : null;
        var frontendUrl = config && config.frontendUrl ? config.frontendUrl : window.location.origin;
        var widgetLayout = config && config.widgetLayout ? config.widgetLayout : 'modern';

        var container = document.getElementById('hotelier-booking-widget');
        if (container) {
            hotelSlug = hotelSlug || container.getAttribute('data-hotel-slug');
            widgetLayout = widgetLayout || container.getAttribute('data-widget-layout') || 'modern';
            if (hotelSlug) {
                renderWidget(container, hotelSlug, frontendUrl, widgetLayout);
            }
        }

        if (!hotelSlug) {
            console.error('Hotelier Widget: Missing Hotel Slug in config or data-hotel-slug');
            return;
        }

        renderChatWidget(hotelSlug, frontendUrl);
    }

    function renderWidget(container, hotelSlug, frontendUrl, widgetLayout) {
        // ── Bar height per layout — the container ALWAYS stays this height ──
        var barHeight = 100;
        if (widgetLayout === 'classic') {
            barHeight = 360;
        } else if (widgetLayout === 'minimal') {
            barHeight = 85;
        }
        // When the calendar / guest picker is open the iframe must be tall
        // enough to contain both the bar AND the popover that opens upward.
        var openHeight = widgetLayout === 'classic' ? 750 : 550;

        // ── Container — occupies exactly barHeight in the page flow ──────────
        container.style.setProperty('position', 'relative', 'important');
        container.style.setProperty('z-index', '999999', 'important');
        container.style.setProperty('height', barHeight + 'px', 'important');
        container.style.setProperty('display', 'block', 'important');
        container.style.setProperty('overflow', 'visible', 'important');

        // NOTE: We do NOT touch parent elements on page load. Modifying the
        // host site's overflow/position at init time breaks their layout and
        // creates blank spaces. Parent overrides are applied ONLY while the
        // calendar overlay is open and reverted immediately when it closes.

        // ── Iframe ──────────────────────────────────────────────────────────
        var iframe = document.createElement('iframe');
        iframe.src = frontendUrl + '/book/' + hotelSlug + '/widget';
        iframe.title = 'Hotel Booking Search';
        iframe.loading = 'eager';
        iframe.style.cssText = [
            'position: absolute',
            'bottom: 0',
            'left: 0',
            'width: 100%',
            'height: ' + barHeight + 'px',
            'border: none',
            'z-index: 9999',
            'background-color: transparent',
            'transition: height 0.25s ease'
        ].join('; ');
        iframe.setAttribute('allowtransparency', 'true');
        iframe.setAttribute('scrolling', 'no');

        container.innerHTML = '';
        container.appendChild(iframe);

        // ── State ───────────────────────────────────────────────────────────
        var overlayOpen = false;
        var parentOriginalStyles = [];

        function setParentStacking(open) {
            if (open) {
                try {
                    var p = container.parentElement;
                    var d = 0;
                    parentOriginalStyles = [];
                    while (p && d < 5) {
                        if (p.tagName === 'BODY' || p.tagName === 'HTML') break;
                        var pcs = window.getComputedStyle(p);
                        parentOriginalStyles.push({
                            el: p,
                            zIndex: p.style.zIndex,
                            position: p.style.position,
                            overflow: p.style.overflow
                        });
                        // Raise stacking context so calendar floats above everything
                        p.style.setProperty('z-index', '2147483647', 'important');
                        if (pcs.position === 'static') {
                            p.style.setProperty('position', 'relative', 'important');
                        }
                        // Prevent clipping the iframe that extends above the container
                        if (pcs.overflow === 'hidden' || pcs.overflowY === 'hidden') {
                            p.style.setProperty('overflow', 'visible', 'important');
                        }
                        p = p.parentElement;
                        d++;
                    }
                } catch (e) { /* best effort */ }
            } else {
                // Restore every parent to its original inline styles
                for (var i = 0; i < parentOriginalStyles.length; i++) {
                    var item = parentOriginalStyles[i];
                    if (item.zIndex) {
                        item.el.style.setProperty('z-index', item.zIndex);
                    } else {
                        item.el.style.removeProperty('z-index');
                    }
                    if (item.position) {
                        item.el.style.setProperty('position', item.position);
                    } else {
                        item.el.style.removeProperty('position');
                    }
                    if (item.overflow) {
                        item.el.style.setProperty('overflow', item.overflow);
                    } else {
                        item.el.style.removeProperty('overflow');
                    }
                }
                parentOriginalStyles = [];
            }
        }

        // ── Listen for RESIZE_OVERLAY from the widget React app ─────────────
        window.addEventListener('message', function (event) {
            if (!event.data || event.data.type !== 'RESIZE_OVERLAY') return;

            var wasOpen = overlayOpen;
            overlayOpen = !!event.data.open;

            if (overlayOpen === wasOpen) return; // no change

            if (overlayOpen) {
                // Grow iframe upward to show calendar
                iframe.style.height = openHeight + 'px';
                iframe.style.zIndex = '2147483647';
                setParentStacking(true);
            } else {
                // Shrink back to bar only
                iframe.style.height = barHeight + 'px';
                iframe.style.zIndex = '9999';
                setParentStacking(false);
            }
        });
    }

    function renderChatWidget(hotelSlug, frontendUrl) {
        if (document.getElementById('hotelier-chat-widget')) return;

        var chatIframe = document.createElement('iframe');
        chatIframe.id = 'hotelier-chat-widget';
        chatIframe.src = frontendUrl + '/book/' + hotelSlug + '/chat';
        chatIframe.title = 'Hotel AI Concierge Chat';
        // Lazy-load the chat iframe so it does not block or compete with the
        // hotel website's initial render. The chat button is not visible until
        // the page is interactive anyway.
        chatIframe.loading = 'lazy';

        var DESKTOP_RIGHT = '20px';
        var MOBILE_RIGHT  = '10px';
        var MOBILE_BOTTOM = '16px';

        // Only push the chat button up by 110 px if the booking-search widget is
        // also present on this page (to avoid overlapping it when both are used
        // together). When only the chat is embedded, sit 24 px from the bottom.
        var DESKTOP_BOTTOM = document.getElementById('hotelier-booking-widget')
            ? '110px'
            : '24px';

        // Closed state: sized to match the actual button pill (~250 × 64 px) with
        // a small buffer. Keeping the iframe tight prevents an invisible dead-zone
        // that silently swallows host-page clicks on elements below the button.
        var BTN_WIDTH  = '280px';
        var BTN_HEIGHT = '76px';

        chatIframe.style.cssText = `
            position: fixed !important;
            bottom: ${window.innerWidth <= 768 ? MOBILE_BOTTOM : DESKTOP_BOTTOM} !important;
            right: ${window.innerWidth <= 768 ? MOBILE_RIGHT : DESKTOP_RIGHT} !important;
            left: auto !important;
            top: auto !important;
            width: ${BTN_WIDTH} !important;
            height: ${BTN_HEIGHT} !important;
            border: none !important;
            z-index: 99999 !important;
            overflow: visible !important;
            background: transparent !important;
            transition: width 0.3s ease, height 0.3s ease, right 0.3s ease, bottom 0.3s ease;
            box-shadow: none !important;
        `;

        document.body.appendChild(chatIframe);

        window.addEventListener('message', function (event) {
            if (!event.data) return;

            var isMobile = window.innerWidth <= 768;

            if (event.data.type === 'CHAT_OPEN') {
                var openWidth  = isMobile ? '90vw'  : '400px';
                var openHeight = isMobile ? '80vh'  : '650px';

                chatIframe.style.width        = openWidth;
                chatIframe.style.height       = openHeight;
                chatIframe.style.borderRadius = '16px';
                chatIframe.style.boxShadow    = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';

            } else if (event.data.type === 'CHAT_CLOSE') {
                chatIframe.style.width        = BTN_WIDTH;
                chatIframe.style.height       = BTN_HEIGHT;
                chatIframe.style.borderRadius = '0';
                chatIframe.style.boxShadow    = 'none';

            } else if (event.data.type === 'CHECKOUT_REDIRECT') {
                if (event.data.data && event.data.data.booking_id) {
                    window.location.href = frontendUrl + '/checkout/' + event.data.data.booking_id;
                }
            }
        });

        window.addEventListener('resize', function () {
            var isMobile = window.innerWidth <= 768;
            chatIframe.style.bottom = isMobile ? MOBILE_BOTTOM : DESKTOP_BOTTOM;
            chatIframe.style.right  = isMobile ? MOBILE_RIGHT  : DESKTOP_RIGHT;
        });
    }

    // Expose global object
    window.HotelierWidget = {
        init: init
    };

})(window);
