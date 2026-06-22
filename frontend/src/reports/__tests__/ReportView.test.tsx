import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReportView, { ReportData } from '@/reports/ReportView';

// Recharts' ResponsiveContainer has no layout in jsdom, so the charts render
// empty — that's fine. These tests assert the data-driven KPI cards and the
// empty-state copy, which is the logic worth guarding in the report body.

const sample: ReportData = {
  total_visitors: 1240,
  conversion_rate: 7.6,
  revenue_total: 420000,
  total_bookings: 95,
  rooms_booked: 130,
  rev_par: 1850,
  occupancy_rate: 64,
  avg_daily_rate: 3200,
  channel_mix: [
    { channel: 'Direct', bookings: 60, revenue: 250000 },
    { channel: 'AI Agent', bookings: 35, revenue: 170000 },
  ],
  chart_data: [{ date: '2026-06-01', revenue: 10000, occupancy: 50 }],
  funnel_data: [{ stage: 'Visitors', count: 1240 }, { stage: 'Booked', count: 95 }],
  device_stats: [{ type: 'mobile', count: 800 }, { type: 'desktop', count: 440 }],
  city_stats: [{ city: 'Mumbai', visitors: 500, percentage: 40 }],
};

describe('ReportView', () => {
  it('renders the headline KPIs from the data', () => {
    render(<ReportView data={sample} />);
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('1,240')).toBeInTheDocument();          // visitors
    expect(screen.getByText('7.6% converted')).toBeInTheDocument();  // conversion
    expect(screen.getByText('130')).toBeInTheDocument();             // rooms booked
    expect(screen.getByText('95 bookings')).toBeInTheDocument();
    expect(screen.getByText('₹4,20,000')).toBeInTheDocument();       // revenue (en-IN)
    expect(screen.getByText('₹1,850')).toBeInTheDocument();          // RevPAR
    expect(screen.getByText('64% occupancy')).toBeInTheDocument();
  });

  it('shows empty states when there are no bookings / visitors', () => {
    const empty: ReportData = {
      ...sample, channel_mix: [], device_stats: [], city_stats: [],
    };
    render(<ReportView data={empty} />);
    expect(screen.getByText('No bookings in this period.')).toBeInTheDocument();
    expect(screen.getByText('No location data yet.')).toBeInTheDocument();
    expect(screen.getByText('No visitor data yet.')).toBeInTheDocument();
  });
});
