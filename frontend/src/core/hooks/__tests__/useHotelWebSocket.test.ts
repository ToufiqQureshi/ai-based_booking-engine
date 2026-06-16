import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── Mock dependencies ────────────────────────────────────────────────────────

vi.mock('@/core/api/client', () => ({
  API_BASE_URL: '/api/v1',
  tokenStorage: {
    getAccessToken: vi.fn(() => 'test-jwt-token'),
  },
}));

// WebSocket mock with correct static readyState constants
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) { this.sentMessages.push(data); }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ type: 'close' } as CloseEvent);
  }

  // Test helpers — simulate server-side events
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({ type: 'open' } as Event);
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useHotelWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    Object.defineProperty(window, 'location', {
      value: { protocol: 'http:', host: 'localhost:8080' },
      writable: true,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('opens a WebSocket with the correct URL and token', async () => {
    const { useHotelWebSocket } = await import('../useHotelWebSocket');
    renderHook(() => useHotelWebSocket({ onEvent: vi.fn() }));

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe(
      'ws://localhost:8080/api/v1/ws/hotel?token=test-jwt-token'
    );
  });

  it('does not open a connection when enabled=false', async () => {
    const { useHotelWebSocket } = await import('../useHotelWebSocket');
    renderHook(() => useHotelWebSocket({ onEvent: vi.fn(), enabled: false }));
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('calls onEvent when server sends a booking_created message', async () => {
    const { useHotelWebSocket } = await import('../useHotelWebSocket');
    const onEvent = vi.fn();
    renderHook(() => useHotelWebSocket({ onEvent }));

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage({
        type: 'booking_created',
        data: { booking_number: 'BK20260608ABC', guest_name: 'Ravi Kumar' },
      });
    });

    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'booking_created' })
    );
  });

  it('does NOT call onEvent for ping/pong frames', async () => {
    const { useHotelWebSocket } = await import('../useHotelWebSocket');
    const onEvent = vi.fn();
    renderHook(() => useHotelWebSocket({ onEvent }));

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage({ type: 'ping' });
      MockWebSocket.instances[0].simulateMessage({ type: 'pong' });
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('replies with pong when server sends ping', async () => {
    const { useHotelWebSocket } = await import('../useHotelWebSocket');
    renderHook(() => useHotelWebSocket({ onEvent: vi.fn() }));

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage({ type: 'ping' });
    });

    expect(MockWebSocket.instances[0].sentMessages).toHaveLength(1);
    expect(JSON.parse(MockWebSocket.instances[0].sentMessages[0])).toEqual({ type: 'pong' });
  });

  it('schedules a reconnect with backoff after disconnect', async () => {
    const { useHotelWebSocket } = await import('../useHotelWebSocket');
    renderHook(() => useHotelWebSocket({ onEvent: vi.fn() }));

    act(() => { MockWebSocket.instances[0].simulateOpen(); });
    act(() => { MockWebSocket.instances[0].close(); });

    // No immediate reconnect
    expect(MockWebSocket.instances).toHaveLength(1);

    // After 2s backoff delay, reconnect fires
    act(() => { vi.advanceTimersByTime(2100); });
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('closes connection when enabled switches to false', async () => {
    const { useHotelWebSocket } = await import('../useHotelWebSocket');
    const { rerender } = renderHook(
      ({ enabled }) => useHotelWebSocket({ onEvent: vi.fn(), enabled }),
      { initialProps: { enabled: true } }
    );

    const ws = MockWebSocket.instances[0];
    act(() => { ws.simulateOpen(); });

    rerender({ enabled: false });
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);

    // No reconnect should be scheduled
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});
