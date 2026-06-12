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
        var defaultHeight = '100px';
        if (widgetLayout === 'classic') {
            defaultHeight = '360px';
        } else if (widgetLayout === 'minimal') {
            defaultHeight = '85px';
        }

        // Container is relative so the iframe can float above page content when
        // the calendar is open. overflow:visible lets the calendar expand above
        // the container without being clipped.
        container.style.position = 'relative';
        container.style.zIndex = '9999';
        container.style.height = defaultHeight;
        container.style.display = 'block';
        container.style.overflow = 'visible';

        // 1. Spacer — occupies the bar height in the page flow so layout never
        //    shifts. It NEVER changes size; the iframe floats above/over it.
        var spacer = document.createElement('div');
        spacer.style.width = '100%';
        spacer.style.height = defaultHeight;
        spacer.style.display = 'block';

        // 2. Iframe — sits inline (absolute over the spacer) in its closed state.
        //    When the calendar opens it is lifted to a fixed full-viewport overlay
        //    (see the message handler below) so the popup floats above the host
        //    page without disturbing it.
        var iframe = document.createElement('iframe');
        iframe.src = frontendUrl + '/book/' + hotelSlug + '/widget';
        iframe.title = 'Hotel Booking Search';
        iframe.loading = 'eager'; // Above-the-fold widget must load immediately, not wait for scroll
        iframe.style.position = 'absolute';
        iframe.style.bottom = '0';
        iframe.style.left = '0';
        iframe.style.width = '100%';
        iframe.style.height = defaultHeight;
        iframe.style.border = 'none';
        iframe.style.overflow = 'visible';
        iframe.style.zIndex = '9999';
        iframe.style.backgroundColor = 'transparent';
        iframe.allowTransparency = 'true';
        iframe.scrolling = 'no';
        iframe.style.transition = 'height 0.25s ease';

        container.innerHTML = '';
        container.appendChild(spacer);
        container.appendChild(iframe);

        // When the calendar / guest picker opens, lift the iframe out to a FIXED
        // full-viewport overlay so the calendar floats ABOVE the host page (over a
        // dim backdrop rendered inside the iframe) without moving a single pixel of
        // host content — the spacer keeps the page layout frozen in place. On close
        // the iframe collapses straight back to the inline search bar. This is the
        // only way an iframe widget can show a floating popup without either being
        // clipped by its own bounds or pushing/covering the host page.
        window.addEventListener('message', function (event) {
            if (!event.data || event.data.type !== 'RESIZE_OVERLAY') return;

            if (event.data.open) {
                // Expand to a fixed, full-viewport modal layer.
                iframe.style.position = 'fixed';
                iframe.style.top = '0';
                iframe.style.left = '0';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.zIndex = '2147483000';
            } else {
                // Collapse back to the inline search bar in the page flow.
                iframe.style.position = 'absolute';
                iframe.style.top = 'auto';
                iframe.style.right = 'auto';
                iframe.style.bottom = '0';
                iframe.style.left = '0';
                iframe.style.width = '100%';
                iframe.style.height = (event.data.height ? event.data.height + 'px' : defaultHeight);
                iframe.style.zIndex = '9999';
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
