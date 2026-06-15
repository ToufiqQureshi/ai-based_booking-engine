(function (window, document) {
    'use strict';

    // Loader ka origin uske apne <script src> se — hardcoded prod URL ki
    // zaroorat nahi (purana Netlify fallback stale tha)
    var SCRIPT_ORIGIN = (function () {
        try {
            var src = document.currentScript && document.currentScript.src;
            return src ? new URL(src).origin : null;
        } catch (e) {
            return null;
        }
    })();

    function initChat(config) {
        config = config || {};
        var hotelSlug = config.hotelSlug;
        var frontendUrl = config.frontendUrl || SCRIPT_ORIGIN || window.location.origin;
        var primaryColor = (config.primaryColor && /^#[0-9a-fA-F]{3,8}$/.test(config.primaryColor))
            ? config.primaryColor
            : '#7c3aed';

        if (!hotelSlug) {
            console.error('Hotelier Chat: missing hotelSlug in config');
            return;
        }

        if (!document.body) {
            document.addEventListener('DOMContentLoaded', function () { initChat(config); });
            return;
        }
        if (document.getElementById('hotelier-chat-widget') || document.getElementById('hotelier-chat-skeleton')) return;

        var widgetOrigin;
        try {
            widgetOrigin = new URL(frontendUrl).origin;
        } catch (e) {
            widgetOrigin = window.location.origin;
        }

        var BTN_W = '280px';
        var BTN_H = '76px';

        function isMobileView() { return window.innerWidth <= 768; }
        function bottomFor() { return isMobileView() ? 16 : 24; }
        function rightFor() { return isMobileView() ? 10 : 20; }

        // Placeholder pill turant dikhta hai; real chat iframe peeche load hota
        // hai taaki host page pe "alag se load ho raha hai" feel na aaye
        var skel = document.createElement('div');
        skel.id = 'hotelier-chat-skeleton';
        skel.style.cssText =
            'position:fixed;z-index:2147483646;display:flex;align-items:center;gap:10px;' +
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
        text.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;padding-right:6px;';
        if (isMobileView()) text.style.display = 'none';
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
        var revealed = false;

        function reveal() {
            if (revealed) return;
            revealed = true;
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
            // Sandbox the chat to our own origin — no access to the host page,
            // no top-navigation hijack; popups (checkout) may escape.
            chatIframe.setAttribute(
                'sandbox',
                'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-storage-access-by-user-activation'
            );
            chatIframe.style.cssText =
                'position:fixed;left:auto;top:auto;width:' + BTN_W + ';height:' + BTN_H + ';' +
                'border:none;z-index:2147483647;background:transparent;color-scheme:normal;box-shadow:none;' +
                'opacity:0;transition:opacity .3s ease,width .3s ease,height .3s ease;';
            positionChat();
            document.body.appendChild(chatIframe);

            // CHAT_READY reveals instantly; short fallback for old builds only.
            chatIframe.addEventListener('load', function () {
                setTimeout(reveal, 400);
            });

            window.addEventListener('message', function (event) {
                // Sirf apne hi iframe ke messages accept karo — koi aur frame
                // chat ko resize/control na kar paye
                if (event.origin !== widgetOrigin || event.source !== chatIframe.contentWindow) return;
                var data = event.data;
                if (!data || typeof data !== 'object') return;

                if (data.type === 'CHAT_READY') {
                    reveal();
                } else if (data.type === 'CHAT_OPEN') {
                    reveal();
                    chatIframe.style.width = isMobileView() ? '95vw' : '400px';
                    chatIframe.style.height = isMobileView() ? '80vh' : '650px';
                    chatIframe.style.borderRadius = '16px';
                    chatIframe.style.boxShadow = '0 25px 50px -12px rgba(0,0,0,.25)';
                } else if (data.type === 'CHAT_CLOSE') {
                    reveal();
                    chatIframe.style.width = BTN_W;
                    chatIframe.style.height = BTN_H;
                    chatIframe.style.borderRadius = '0';
                    chatIframe.style.boxShadow = 'none';
                }
            });
        }

        // Cap the idle wait low (was 2500/1200ms) and mount on first interaction
        // so the chat button never appears seconds after the page is usable.
        var chatMounted = false;
        function mountChatOnce() {
            if (chatMounted) return;
            chatMounted = true;
            mountChatIframe();
        }
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(mountChatOnce, { timeout: 800 });
        } else {
            setTimeout(mountChatOnce, 400);
        }
        ['pointerdown', 'scroll', 'keydown'].forEach(function (ev) {
            window.addEventListener(ev, mountChatOnce, { once: true, passive: true });
        });

        window.addEventListener('resize', function () {
            text.style.display = isMobileView() ? 'none' : 'flex';
            positionFloating();
            positionChat();
        });
    }

    window.HotelierChat = {
        init: initChat
    };

})(window, document);
