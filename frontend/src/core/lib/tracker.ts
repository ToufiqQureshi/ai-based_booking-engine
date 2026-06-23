/**
 * Native Analytics Tracker
 * Tracks widget visits, page views, and time spent.
 */

const getOrCreateSession = async (hotelId: string) => {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    
    if (!sessionId) {
      // Start a new session
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/analytics/track/start?hotel_id=${hotelId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_agent: navigator.userAgent,
            referrer: document.referrer,
            page_url: window.location.href
          })
        });
        const data = await response.json();
        sessionId = data.session_id;
        sessionStorage.setItem('analytics_session_id', sessionId!);
        sessionStorage.setItem('analytics_hotel_id', hotelId);
      } catch (e) {
        console.error('Failed to start analytics session', e);
      }
    }
    return sessionId;
  };
  
  export const trackEvent = async (hotelId: string, eventType: string, metadata?: any, roomTypeId?: string) => {
    const sessionId = await getOrCreateSession(hotelId);
    if (!sessionId) return;
  
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/analytics/track/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          event_type: eventType,
          page_url: window.location.href,
          room_type_id: roomTypeId,
          metadata_json: metadata ? JSON.stringify(metadata) : null
        })
      });
    } catch (e) {
      // Fail silently
    }
  };
  
  // Heartbeat to track time spent (pings every 10 seconds)
  let pingInterval: any = null;
  
  export const startTimeTracking = (hotelId: string) => {
    if (pingInterval) clearInterval(pingInterval);

    getOrCreateSession(hotelId);
    wireSessionEnd();
    
    pingInterval = setInterval(async () => {
      const sessionId = sessionStorage.getItem('analytics_session_id');
      if (!sessionId) return;
      
      try {
        await fetch(`${import.meta.env.VITE_API_URL}/analytics/track/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            time_spent_seconds: 10
          }),
          keepalive: true // Ensure it sends even if page is closing
        });
      } catch (e) {
        // Fail silently
      }
    }, 10000);
  };
  
  export const stopTimeTracking = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  };

  // Close the session the instant the visitor leaves so time-on-site and the
  // live-visitor count settle. `pagehide`/`visibilitychange` fire reliably on
  // mobile (unlike `beforeunload`), and sendBeacon survives the page teardown.
  let unloadWired = false;
  export const wireSessionEnd = () => {
    if (unloadWired) return;
    unloadWired = true;
    const endSession = () => {
      const sessionId = sessionStorage.getItem('analytics_session_id');
      if (!sessionId) return;
      try {
        const url = `${import.meta.env.VITE_API_URL}/analytics/track/event`;
        const payload = JSON.stringify({ session_id: sessionId, event_type: 'session_end' });
        navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      } catch (e) {
        // Fail silently — losing one end-beacon only nudges time-on-site.
      }
    };
    window.addEventListener('pagehide', endSession);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') endSession();
    });
  };
  export const trackRoomView = (hotelId: string, roomTypeId: string) => {
    trackEvent(hotelId, 'room_view', null, roomTypeId);
  };
  
  export const trackBookingComplete = (hotelId: string, bookingId: string) => {
    trackEvent(hotelId, 'booking_complete', { booking_id: bookingId });
  };

  export const trackSearch = (hotelId: string, searchParams: any) => {
    trackEvent(hotelId, 'search', searchParams);
  };
