/**
 * BI Report — the hotelier's dedicated, shareable performance report page.
 *
 * Kept separate from Analytics on purpose: Analytics is the deep operational
 * dashboard, this is the clean "board / investor" report the hotelier can also
 * publish as a public link (Share Report). Renders the same ReportView the
 * public /r/:token page uses, so what the hotelier shares is what they see.
 */
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient as api } from '@/core/api/client';
import { Activity, AlertCircle, FileBarChart2, Settings2, X, Check } from 'lucide-react';
import ReportView, { ReportData, DashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '@/reports/ReportView';
import ShareReportButton from '@/reports/ShareReportButton';

const KPI_OPTIONS = [
  { id: 'visitors', label: 'Visitors' },
  { id: 'rooms', label: 'Rooms Booked' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'revpar', label: 'RevPAR' },
];

const THEME_OPTIONS = [
  { id: 'default', label: 'Default', colors: ['#6366f1', '#14b8a6'] },
  { id: 'ocean', label: 'Ocean', colors: ['#0ea5e9', '#06b6d4'] },
  { id: 'sunset', label: 'Sunset', colors: ['#f97316', '#f43f5e'] },
  { id: 'forest', label: 'Forest', colors: ['#10b981', '#84cc16'] },
];

const HotelReport: React.FC = () => {
  const [days, setDays] = useState(30);
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG);
  const [showConfig, setShowConfig] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('staybooker_dashboard_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig({ ...DEFAULT_DASHBOARD_CONFIG, ...parsed });
      } catch {
        // ignore
      }
    }
  }, []);

  const updateConfig = (newConfig: Partial<DashboardConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem('staybooker_dashboard_config', JSON.stringify(updated));
  };

  const toggleKpi = (kpiId: string) => {
    const current = config.visibleKpis || [];
    if (current.includes(kpiId)) {
      updateConfig({ visibleKpis: current.filter(id => id !== kpiId) });
    } else {
      updateConfig({ visibleKpis: [...current, kpiId] });
    }
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bi-report', days],
    queryFn: () => api.get<ReportData>(`/analytics/dashboard?days=${days}`),
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="p-4 md:p-6 space-y-6 relative">
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
          <button 
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-xs font-bold hover:bg-secondary/80 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" /> Customize
          </button>
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
        <ReportView data={data} config={config} />
      )}

      {/* Configuration Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setShowConfig(false)}>
          <div 
            className="bg-background border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-bold text-foreground">Customize Dashboard</h3>
              </div>
              <button onClick={() => setShowConfig(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-8">
              {/* KPIs */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Visible Metrics</h4>
                <div className="grid grid-cols-2 gap-3">
                  {KPI_OPTIONS.map(kpi => {
                    const active = (config.visibleKpis || []).includes(kpi.id);
                    return (
                      <button
                        key={kpi.id}
                        onClick={() => toggleKpi(kpi.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all ${
                          active ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-border bg-card text-muted-foreground hover:border-indigo-300'
                        }`}
                      >
                        {kpi.label}
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-muted-foreground/30'}`}>
                          {active && <Check className="w-3 h-3" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Theme */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Color Theme</h4>
                <div className="grid grid-cols-2 gap-3">
                  {THEME_OPTIONS.map(theme => {
                    const active = config.colorTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => updateConfig({ colorTheme: theme.id as any })}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${
                          active ? 'border-foreground bg-accent text-foreground shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                        }`}
                      >
                        <div className="flex -space-x-1">
                          <span className="w-4 h-4 rounded-full border border-background shadow-sm" style={{ backgroundColor: theme.colors[0] }} />
                          <span className="w-4 h-4 rounded-full border border-background shadow-sm" style={{ backgroundColor: theme.colors[1] }} />
                        </div>
                        {theme.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Chart Style */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Trend Chart Style</h4>
                <div className="flex bg-muted p-1 rounded-xl">
                  <button
                    onClick={() => updateConfig({ trendChartType: 'area' })}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      config.trendChartType === 'area' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Area Chart
                  </button>
                  <button
                    onClick={() => updateConfig({ trendChartType: 'bar' })}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      config.trendChartType === 'bar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Bar Chart
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-border bg-muted/20 flex justify-end">
              <button 
                onClick={() => setShowConfig(false)}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HotelReport;
