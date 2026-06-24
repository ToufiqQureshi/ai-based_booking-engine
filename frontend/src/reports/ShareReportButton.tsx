/**
 * "Share Report" control for the hotelier analytics dashboard.
 *
 * Mints a public, no-login report link (PowerBI-style "publish to web") and
 * lets the hotelier copy it, send it on WhatsApp, or revoke it. The link opens
 * the /r/:token page, which shows aggregate stats only — never guest PII.
 *
 * Backend: POST/GET/DELETE /analytics/share (OWNER/MANAGER only).
 */
import React, { useState } from 'react';
import { apiClient as api } from '@/core/api/client';
import { Share2, Copy, Trash2, Plus, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface ShareLink {
  id: string;
  token: string;
  label?: string | null;
  days: number;
  is_active: boolean;
  expires_at: string | null;
  view_count: number;
}

const publicUrl = (token: string) => `${window.location.origin}/r/${token}`;

const ShareReportButton: React.FC<{ days: number }> = ({ days }) => {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<ShareLink[]>('/analytics/share');
      setLinks(res || []);
    } catch {
      toast.error('Could not load share links');
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => { setOpen(true); load(); };

  const createLink = async () => {
    setCreating(true);
    try {
      // Share the same window the hotelier is currently viewing; default 30-day
      // link validity (revocable any time).
      const res = await api.post<ShareLink>('/analytics/share', { days, expires_in_days: 30 });
      setLinks((prev) => [res, ...prev]);
      await navigator.clipboard?.writeText(publicUrl(res.token)).catch(() => {});
      toast.success('Share link created & copied to clipboard');
    } catch {
      toast.error('Could not create link (OWNER/MANAGER only)');
    } finally {
      setCreating(false);
    }
  };

  const copy = (token: string) => {
    navigator.clipboard?.writeText(publicUrl(token));
    toast.success('Link copied');
  };

  const shareWhatsApp = (token: string) => {
    const text = encodeURIComponent(`Here's our live hotel performance report: ${publicUrl(token)}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const revoke = async (id: string) => {
    try {
      await api.delete(`/analytics/share/${id}`);
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, is_active: false } : l)));
      toast.success('Link revoked');
    } catch {
      toast.error('Could not revoke link');
    }
  };

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm transition-colors"
      >
        <Share2 className="w-3.5 h-3.5" />
        Share Report
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-background border border-border rounded-2xl w-full max-w-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-foreground">Share this report</h3>
                <p className="text-xs text-muted-foreground">Anyone with the link can view aggregate stats — no login, no guest data.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              <button
                onClick={createLink}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-60"
              >
                <Plus className="w-3.5 h-3.5" />
                {creating ? 'Creating…' : `New link (last ${days} days)`}
              </button>

              {loading ? (
                <p className="text-xs text-muted-foreground py-4">Loading…</p>
              ) : links.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No share links yet. Create one above.</p>
              ) : (
                links.map((l) => (
                  <div key={l.id} className={`border border-border rounded-xl p-3 ${!l.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono truncate text-foreground">{publicUrl(l.token)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {l.days}d window · {l.view_count} views · {l.is_active ? 'active' : 'revoked'}
                        </p>
                      </div>
                      {l.is_active && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button title="Copy" onClick={() => copy(l.token)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Copy className="w-3.5 h-3.5" /></button>
                          <button title="WhatsApp" onClick={() => shareWhatsApp(l.token)} className="p-1.5 rounded-lg hover:bg-muted text-green-600"><ExternalLink className="w-3.5 h-3.5" /></button>
                          <button title="Revoke" onClick={() => revoke(l.id)} className="p-1.5 rounded-lg hover:bg-muted text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ShareReportButton;
