import '@testing-library/jest-dom';

// jsdom has no ResizeObserver, which Recharts' ResponsiveContainer needs. Stub
// it so chart-containing components can render in tests without crashing.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
