import { useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL, tokenStorage } from '@/core/api/client';

export interface WsEvent {
  type: string;
  data?: Record<string, unknown>;
  ts?: string;
}

interface Options {
  onEvent: (event: WsEvent) => void;
  enabled?: boolean;
}

const MIN_RECONNECT_MS = 2_000;
const MAX_RECONNECT_MS = 30_000;

function buildWsUrl(token: string): string {
  let wsBase: string;
  if (API_BASE_URL.startsWith('/')) {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    wsBase = `${proto}://${window.location.host}${API_BASE_URL}`;
  } else {
    wsBase = API_BASE_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  }
  return `${wsBase}/ws/hotel?token=${encodeURIComponent(token)}`;
}

/**
 * Maintains a persistent WebSocket connection to the hotel's real-time event
 * channel. Handles auth, keep-alive, and exponential-backoff reconnects.
 *
 * The connection is torn down when `enabled` goes false (e.g. on logout)
 * and re-established when it returns true.
 */
export function useHotelWebSocket({ onEvent, enabled = true }: Options): void {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(MIN_RECONNECT_MS);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const clearReconnectTimer = () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  };

  const connect = useCallback(() => {
    if (!enabled) return;
    const token = tokenStorage.getAccessToken();
    if (!token) return;

    // Don't open a second connection if one is already live
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const url = buildWsUrl(token);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = MIN_RECONNECT_MS;
    };

    ws.onmessage = (e) => {
      try {
        const event: WsEvent = JSON.parse(e.data);
        if (event.type !== 'ping' && event.type !== 'pong') {
          onEventRef.current(event);
        } else if (event.type === 'ping') {
          // Server keepalive — reply with pong
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (!enabled || !tokenStorage.getAccessToken()) return;
      // Exponential backoff reconnect
      clearReconnectTimer();
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_MS);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      wsRef.current?.close();
      clearReconnectTimer();
      return;
    }
    connect();

    // Re-connect when the tab becomes visible again (handles sleep/wake)
    const onVisible = () => {
      if (document.visibilityState === 'visible') connect();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearReconnectTimer();
      wsRef.current?.close();
    };
  }, [connect, enabled]);
}
