import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PublicReport from '@/analytics/PublicReport';

// The public report page must degrade gracefully for anonymous visitors when a
// token is missing/revoked/expired — these are the user-facing failure paths.

const renderAt = (token: string) =>
  render(
    <MemoryRouter initialEntries={[`/r/${token}`]}>
      <Routes>
        <Route path="/r/:token" element={<PublicReport />} />
      </Routes>
    </MemoryRouter>,
  );

describe('PublicReport', () => {
  beforeEach(() => { (import.meta as any).env.VITE_API_URL = '/api/v1'; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows an invalid-link message on 404 (unknown / revoked token)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    renderAt('bad-token');
    await waitFor(() =>
      expect(screen.getByText(/invalid or has been revoked/i)).toBeInTheDocument(),
    );
  });

  it('shows an expired message on 410', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 410 }));
    renderAt('expired-token');
    await waitFor(() =>
      expect(screen.getByText(/has expired/i)).toBeInTheDocument(),
    );
  });

  it('renders the report header + KPIs on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        hotel_name: 'Pytest Grand Hotel',
        days: 30,
        generated_at: '2026-06-22T10:00:00Z',
        data: {
          total_visitors: 10, conversion_rate: 5, revenue_total: 1000,
          total_bookings: 2, rooms_booked: 3, rev_par: 50, occupancy_rate: 40,
          avg_daily_rate: 500, channel_mix: [], chart_data: [],
          funnel_data: [], device_stats: [], city_stats: [],
        },
      }),
    }));
    renderAt('good-token');
    await waitFor(() =>
      expect(screen.getByText('Pytest Grand Hotel')).toBeInTheDocument(),
    );
    expect(screen.getByText('Visitors')).toBeInTheDocument();
  });
});
