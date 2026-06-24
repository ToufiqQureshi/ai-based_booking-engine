/**
 * BI Report — the hotelier's dedicated, shareable performance report page.
 *
 * Kept separate from Analytics on purpose: Analytics is the deep operational
 * dashboard, this is the clean "board / investor" report the hotelier can also
 * publish as a public link (Share Report). Renders the same ReportView the
 * public /r/:token page uses, so what the hotelier shares is what they see.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient as api } from '@/core/api/client';
import { Activity, AlertCircle, FileBarChart2 } from 'lucide-react';
import ReportView, { ReportData } from '@/reports/ReportView';
import ShareReportButton from '@/reports/ShareReportButton';

const HotelReport: React.FC = () => {
  const [days, setDays] = useState(30);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bi-report', days],
    queryFn: () => api.get<ReportData>(`/analytics/dashboard?days=${days}`),
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileBarChart2 className="w-5 h-5 text-indigo-600" />
          <div>
            <h1 className="text-lg font-bold text-foreground">BI Report</h1>
            <p className="text-xs text-muted-foreground">Shareable performance summary · last {days} days</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Day filter */}
          <div className="flex items-center gap-0.5 bg-muted border border-border rounded-xl p-0.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  days === d ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <ShareReportButton days={days} />
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Activity className="w-5 h-5 mr-2 animate-pulse" /> Loading report…
        </div>
      ) : isError || !data ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Could not load the report. Please try again.</p>
        </div>
      ) : (
        <ReportView data={data} />
      )}
    </div>
  );
};

export default HotelReport;
