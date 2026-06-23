import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/core/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { apiClient } from '@/core/api/client';
import HotelReport from '@/reports/HotelReport';

const sample = {
  total_visitors: 320, conversion_rate: 6, revenue_total: 88000,
  total_bookings: 12, rooms_booked: 18, rev_par: 900, occupancy_rate: 55,
  avg_daily_rate: 2400, channel_mix: [], chart_data: [],
  funnel_data: [], device_stats: [], city_stats: [],
};

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <HotelReport />
    </QueryClientProvider>,
  );
};

describe('HotelReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches the dashboard and renders the report KPIs', async () => {
    (apiClient.get as any).mockResolvedValue({ data: sample });
    (apiClient.get as any).mockImplementation((url: string) =>
      url.startsWith('/analytics/dashboard')
        ? Promise.resolve({ data: sample })
        : Promise.resolve({ data: [] }), // ShareReportButton's list call
    );
    renderPage();
    expect(screen.getByText('BI Report')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Rooms Booked')).toBeInTheDocument());
    expect(screen.getByText('18')).toBeInTheDocument();         // rooms booked
    expect(screen.getByText('12 bookings')).toBeInTheDocument();
  });

  it('shows an error state when the report fails to load', async () => {
    (apiClient.get as any).mockImplementation((url: string) =>
      url.startsWith('/analytics/dashboard')
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ data: [] }),
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/could not load the report/i)).toBeInTheDocument(),
    );
  });
});
