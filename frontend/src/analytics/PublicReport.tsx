/**
 * Public, no-login hotel BI report.
 *
 * Rendered at /r/:token — the page a hotelier shares with anyone (investor,
 * owner, partner) who shouldn't have a Staybooker login. It fetches the public
 * report endpoint, which resolves the token to ONE hotel and returns aggregate
 * stats only (no guest PII). No auth context / apiClient here on purpose: the
 * page must work for an anonymous visitor. Renders the same ReportView the
 * authenticated /reports page uses.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, MapPin, Share2 } from 'lucide-react';
import ReportView, { ReportData } from '@/reports/ReportView';
import { API_BASE_URL } from '@/core/api/client';

interface ReportEnvelope {
  hotel_name: string;
  days: number;
  generated_at: string;
  data: ReportData;
}

const PublicReport: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<ReportEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/public/report/${token}`);
        if (!alive) return;
        if (res.status === 404) { setError('This report link is invalid or has been revoked.'); return; }
        if (res.status === 410) { setError('This report link has expired.'); return; }
        if (!res.ok) { setError('Could not load this report. Please try again later.'); return; }
        setReport(await res.json());
      } catch {
        if (alive) setError('Could not load this report. Please check your connection.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <Activity className="w-5 h-5 mr-2 animate-pulse" /> Loading report…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-6">
        <Share2 className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-slate-600 max-w-sm">{error || 'No data available.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{report.hotel_name}</h1>
            <p className="text-xs text-slate-400">
              Performance report · last {report.days} days ·
              {' '}generated {new Date(report.generated_at).toLocaleString('en-IN')}
            </p>
          </div>
          <span className="text-xs text-slate-400">Powered by Staybooker</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <ReportView data={report.data} />
        <footer className="flex items-center justify-center gap-1 text-xs text-slate-400 pt-6 pb-8">
          <MapPin className="w-3 h-3" /> Aggregate figures only — no guest personal data is shared.
        </footer>
      </main>
    </div>
  );
};

export default PublicReport;
