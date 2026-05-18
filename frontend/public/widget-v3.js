(function (window) {
    'use strict';

    function init(config) {
        console.clear();
        console.log("%c HOTELIER WIDGET V3: FINAL FIXED SPACER ", "background: #000; color: #0f0; font-size: 16px; font-weight: bold;");

        var hotelSlug = config ? config.hotelSlug : null;
        var frontendUrl = config && config.frontendUrl ? config.frontendUrl : window.location.origin;

        var container = document.getElementById('hotelier-booking-widget');
        if (container) {
            hotelSlug = hotelSlug || container.getAttribute('data-hotel-slug');
            if (hotelSlug) {
                renderWidget(container, hotelSlug, frontendUrl);
            }
        }

        if (!hotelSlug) {
            console.error('Hotelier Widget: Missing Hotel Slug in config or data-hotel-slug');
            return;
        }

        renderChatWidget(hotelSlug, frontendUrl);
    }

    function renderWidget(container, hotelSlug, frontendUrl) {
        // Set container relative for absolute positioning of iframe
        container.style.position = 'relative';
        container.style.zIndex = '50';
        // Force height to never collapse but never expand beyond bar
        container.style.height = '100px';
        container.style.display = 'block';
        container.style.overflow = 'visible'; // Ensure content outside 100px is visible

        // 1. Create Spacer (Fixed Height - NEVER CHANGES)
        var spacer = document.createElement('div');
        spacer.style.width = '100%';
        spacer.style.height = '100px';
        spacer.style.display = 'block';

        // 2. Create Iframe (Floats over content when expanded)
        var iframe = document.createElement('iframe');
        iframe.src = frontendUrl + '/book/' + hotelSlug + '/widget';
        iframe.style.position = 'absolute';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100px'; // Initial height matching bar
        iframe.style.border = 'none';
        iframe.style.overflow = 'visible';
        iframe.style.zIndex = '999999'; // Super High Z-Index
        iframe.style.backgroundColor = 'transparent';
        iframe.allowTransparency = 'true';
        iframe.scrolling = 'no';
        iframe.style.transition = 'height 0.2s ease';

        container.innerHTML = '';
        container.appendChild(spacer);
        container.appendChild(iframe);

        // Listen for Resize - BUT ONLY RESIZE IFRAME, NEVER SPACER
        window.addEventListener('message', function (event) {
            if (event.data && event.data.type === 'RESIZE_OVERLAY') {
                console.log("Widget V3: Resize Received ->", event.data.height);
                if (event.data.height) {
                    iframe.style.height = event.data.height + 'px';
                    // Note: We deliberately DO NOT resize the spacer or container.
                    // This ensures the page content stays put (under the floating calendar).
                }
            }
        });
    }

    function renderChatWidget(hotelSlug, frontendUrl) {
        if (document.getElementById('hotelier-chat-widget')) return;

        var chatIframe = document.createElement('iframe');
        chatIframe.id = 'hotelier-chat-widget';
        chatIframe.src = frontendUrl + '/book/' + hotelSlug + '/chat';

        // --- CONSTANTS ---
        var DESKTOP_BOTTOM = '110px';
        var DESKTOP_RIGHT = '20px';
        var MOBILE_BOTTOM = '10px';
        var MOBILE_RIGHT = '10px';

        // Initial Dimensions (Button State)
        var BTN_WIDTH = '280px';
        var BTN_HEIGHT = '100px';

        // --- STYLES ---
        chatIframe.style.cssText = `
            position: fixed !important;
            bottom: ${window.innerWidth <= 768 ? MOBILE_BOTTOM : DESKTOP_BOTTOM} !important;
            right: ${window.innerWidth <= 768 ? MOBILE_RIGHT : DESKTOP_RIGHT} !important;
            left: auto !important;
            top: auto !important;
            width: ${BTN_WIDTH} !important;
            height: ${BTN_HEIGHT} !important;
            border: none !important;
            z-index: 2147483647 !important;
            overflow: visible !important;
            background: transparent !important;
            transition: width 0.3s ease, height 0.3s ease, right 0.3s ease, bottom 0.3s ease;
            box-shadow: none !important;
        `;

        document.body.appendChild(chatIframe);

        // --- EVENT HANDLERS ---
        window.addEventListener('message', function (event) {
            if (!event.data) return;

            var isMobile = window.innerWidth <= 768;

            if (event.data.type === 'CHAT_OPEN') {
                var openWidth = isMobile ? '90vw' : '400px';
                var openHeight = isMobile ? '80vh' : '650px';

                chatIframe.style.width = openWidth;
                chatIframe.style.height = openHeight;
                chatIframe.style.borderRadius = "16px";
                chatIframe.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.25)";

            } else if (event.data.type === 'CHAT_CLOSE') {
                chatIframe.style.width = BTN_WIDTH;
                chatIframe.style.height = BTN_HEIGHT;
                chatIframe.style.borderRadius = "0";
                chatIframe.style.boxShadow = "none";
            } else if (event.data.type === 'CHECKOUT_REDIRECT') {
                if (event.data.data && event.data.data.booking_id) {
                    window.location.href = frontendUrl + '/checkout/' + event.data.data.booking_id;
                }
            }
        });

        window.addEventListener('resize', function () {
            var isMobile = window.innerWidth <= 768;
            chatIframe.style.bottom = isMobile ? MOBILE_BOTTOM : DESKTOP_BOTTOM;
            chatIframe.style.right = isMobile ? MOBILE_RIGHT : DESKTOP_RIGHT;
        });
    }

    // Expose global object
    window.HotelierWidget = {
        init: init
    };

})(window);
