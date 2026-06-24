import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/core/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { apiClient } from '@/core/api/client';
import ShareReportButton from '@/reports/ShareReportButton';

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('ShareReportButton', () => {
  it('opens the modal and lists existing links', async () => {
    (apiClient.get as any).mockResolvedValue([
      { id: 'share_1', token: 'tok123', days: 30, is_active: true, expires_at: null, view_count: 4 }
    ]);
    render(<ShareReportButton days={30} />);
    fireEvent.click(screen.getByText('Share Report'));
    await waitFor(() => expect(screen.getByText(/\/r\/tok123/)).toBeInTheDocument());
    expect(screen.getByText(/4 views/)).toBeInTheDocument();
  });

  it('creates a new link when "New link" is clicked', async () => {
    (apiClient.get as any).mockResolvedValue([]);
    (apiClient.post as any).mockResolvedValue(
      { id: 'share_2', token: 'newtok', days: 30, is_active: true, expires_at: null, view_count: 0 }
    );
    render(<ShareReportButton days={30} />);
    fireEvent.click(screen.getByText('Share Report'));
    await waitFor(() => expect(screen.getByText(/no share links yet/i)).toBeInTheDocument());

    fireEvent.click(screen.getByText(/new link/i));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/analytics/share', { days: 30, expires_in_days: 30 }),
    );
    await waitFor(() => expect(screen.getByText(/\/r\/newtok/)).toBeInTheDocument());
  });
});
