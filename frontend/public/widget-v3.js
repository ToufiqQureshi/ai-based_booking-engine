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

        // Force container styles with high specificity to ensure layout sits on top
        container.style.setProperty('position', 'relative', 'important');
        container.style.setProperty('z-index', '999999', 'important');
        container.style.setProperty('height', defaultHeight, 'important');
        container.style.setProperty('display', 'block', 'important');
        container.style.setProperty('overflow', 'visible', 'important');

        // Safeguard against parent stacking contexts and clipping (up to 3 levels)
        try {
            var parent = container.parentElement;
            var depth = 0;
            while (parent && depth < 3) {
                if (parent.tagName === 'BODY' || parent.tagName === 'HTML') {
                    break;
                }
                var compStyle = window.getComputedStyle(parent);
                if (
                    compStyle.overflow === 'hidden' ||
                    compStyle.overflowX === 'hidden' ||
                    compStyle.overflowY === 'hidden'
                ) {
                    parent.style.setProperty('overflow', 'visible', 'important');
                    parent.style.setProperty('overflow-x', 'visible', 'important');
                    parent.style.setProperty('overflow-y', 'visible', 'important');
                    console.warn('Staybooker Booking Widget: Overriding parent overflow:hidden to visible on parent element to prevent clipping.', parent);
                }
                // Also ensure parents have a stacking context that permits visibility if they have z-indices
                if (compStyle.position === 'static' && compStyle.zIndex !== 'auto') {
                    parent.style.setProperty('position', 'relative', 'important');
                }
                parent = parent.parentElement;
                depth++;
            }
        } catch (e) {
            console.error('Staybooker Booking Widget: Error traversing parents', e);
        }

        // 1. Spacer — occupies the bar height in the page flow so layout never
        //    shifts. It NEVER changes size; the iframe floats above/over it.
        var spacer = document.createElement('div');
        spacer.style.width = '100%';
        spacer.style.height = defaultHeight;
        spacer.style.display = 'block';

        // 2. Iframe — anchored at top:0 over the spacer. When the calendar opens it
        //    grows DOWNWARD only: the search bar stays exactly where it is and the
        //    calendar drops below it, floating over the host page content beneath
        //    the bar. The spacer never changes size, so the hero and every other
        //    section of the host page stay frozen in place — nothing moves.
        var maxIframeHeight = 850;
        var barHeight = parseInt(defaultHeight) || 100;
        var offsetTop = -(maxIframeHeight - barHeight);

        var iframe = document.createElement('iframe');
        iframe.src = frontendUrl + '/book/' + hotelSlug + '/widget';
        iframe.title = 'Hotel Booking Search';
        iframe.loading = 'eager'; // Above-the-fold widget must load immediately, not wait for scroll
        iframe.style.position = 'absolute';
        iframe.style.top = offsetTop + 'px'; // Offset upward so widget bar sits exactly on spacer and calendar opens upward
        iframe.style.left = '0';
        iframe.style.width = '100%';
        iframe.style.height = maxIframeHeight + 'px'; // Fixed large height to accommodate calendar popover without clipping
        iframe.style.border = 'none';
        iframe.style.overflow = 'visible';
        iframe.style.zIndex = '9999';
        iframe.style.backgroundColor = 'transparent';
        iframe.allowTransparency = 'true';
        iframe.scrolling = 'no';
        iframe.style.pointerEvents = 'none'; // Allow clicking through transparent parts when closed

        container.innerHTML = '';
        container.appendChild(spacer);
        container.appendChild(iframe);

        var calendarIsOpen = false;
        var isHovered = false;
        var parentOriginalStyles = [];

        function updateParentStackingContext(open) {
            if (open) {
                try {
                    var parent = container.parentElement;
                    var depth = 0;
                    parentOriginalStyles = [];
                    while (parent && depth < 4) {
                        if (parent.tagName === 'BODY' || parent.tagName === 'HTML') {
                            break;
                        }
                        var compStyle = window.getComputedStyle(parent);
                        parentOriginalStyles.push({
                            element: parent,
                            zIndex: parent.style.zIndex,
                            position: parent.style.position
                        });
                        parent.style.setProperty('z-index', '2147483647', 'important');
                        if (compStyle.position === 'static') {
                            parent.style.setProperty('position', 'relative', 'important');
                        }
                        parent = parent.parentElement;
                        depth++;
                    }
                } catch (e) {
                    console.error('Staybooker Booking Widget: Error updating parent stacking context', e);
                }
            } else {
                for (var i = 0; i < parentOriginalStyles.length; i++) {
                    var item = parentOriginalStyles[i];
                    if (item.zIndex) {
                        item.element.style.setProperty('z-index', item.zIndex);
                    } else {
                        item.element.style.removeProperty('z-index');
                    }
                    if (item.position) {
                        item.element.style.setProperty('position', item.position);
                    } else {
                        item.element.style.removeProperty('position');
                    }
                }
                parentOriginalStyles = [];
            }
        }

        // Toggle pointerEvents when mouse enters/leaves the widget bar area
        container.addEventListener('mouseenter', function () {
            isHovered = true;
            iframe.style.pointerEvents = 'auto';
        });

        container.addEventListener('mouseleave', function () {
            isHovered = false;
            if (!calendarIsOpen) {
                iframe.style.pointerEvents = 'none';
            }
        });

        // Listen for message events to raise z-index and handle pointer-events when calendar opens
        window.addEventListener('message', function (event) {
            if (!event.data || event.data.type !== 'RESIZE_OVERLAY') return;
            var wasOpen = calendarIsOpen;
            calendarIsOpen = !!event.data.open;
            iframe.style.zIndex = calendarIsOpen ? '2147483647' : '9999';
            
            if (calendarIsOpen !== wasOpen) {
                updateParentStackingContext(calendarIsOpen);
            }
            
            if (calendarIsOpen) {
                iframe.style.pointerEvents = 'auto';
            } else {
                if (!isHovered) {
                    iframe.style.pointerEvents = 'none';
                }
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
