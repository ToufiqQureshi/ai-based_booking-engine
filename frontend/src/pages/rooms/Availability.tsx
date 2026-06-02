// Availability Page - Premium Redesign with Full Feature Set
import {
  ChevronLeft, ChevronRight, Edit2, Lock, Loader2,
  BedDouble, BarChart3, RefreshCw, Sliders,
  CheckCircle2, AlertTriangle, Sparkles,
  CalendarDays
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PageShell } from '@/components/layout/PageShell';
import { apiClient } from '@/api/client';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, isToday, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { BulkUpdateDialog } from '@/components/availability/BulkUpdateDialog';
import { ManageOccupancyDialog } from '@/components/availability/ManageOccupancyDialog';
import { WeekendUpdateDialog } from '@/components/availability/WeekendUpdateDialog';


interface AvailabilityDay {
  date: string;
  totalRooms: number;
  bookedRooms: number;
  availableRooms: number;
  isBlocked: boolean;
  blockedRooms?: number;
  price?: number;
}

interface RoomAvailability {
  id: string;
  name: string;
  totalInventory: number;
  availability: AvailabilityDay[];
}

interface SummaryStats {
  totalRooms: number;
  totalAvailable: number;
  totalBooked: number;
  totalBlocked: number;
  occupancyRate: number;
}

const DAYS_TO_SHOW = 14;

export function AvailabilityPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isWeekendDialogOpen, setIsWeekendDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ room: { id: string; name: string }; date: Date; price?: number } | null>(null);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dates = Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(currentDate, i));
  const startDateStr = format(dates[0], 'yyyy-MM-dd');
  const endDateStr = format(dates[dates.length - 1], 'yyyy-MM-dd');

  const {
    data: availabilityData = [],
    isLoading,
    isFetching: isRefreshing,
    refetch,
  } = useQuery<RoomAvailability[]>({
    queryKey: ['availability', startDateStr, endDateStr],
    queryFn: () => apiClient.get<RoomAvailability[]>('/availability', {
      start_date: startDateStr,
      end_date: endDateStr,
    }),
    staleTime: 1000 * 60 * 2, // 2 minutes — availability changes with bookings
    gcTime: 1000 * 60 * 10,
  });

  // Used by dialogs after mutations to refresh data
  const fetchAvailability = useCallback((silent = false) => {
    if (!silent) {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    } else {
      refetch();
    }
  }, [queryClient, refetch]);

  const navigateDate = (dir: 'prev' | 'next') =>
    setCurrentDate(d => addDays(d, dir === 'next' ? DAYS_TO_SHOW : -DAYS_TO_SHOW));

  const goToToday = () => setCurrentDate(new Date());

  const handleCellClick = (room: RoomAvailability, date: Date, price?: number) => {
    setSelectedCell({ room: { id: room.id, name: room.name }, date, price });
    setIsManageDialogOpen(true);
  };

  const filteredData = selectedRoomType === 'all'
    ? availabilityData
    : availabilityData.filter(r => r.id === selectedRoomType);

  // Compute summary stats for the current view
  const stats: SummaryStats = filteredData.reduce((acc, room) => {
    room.availability.forEach(day => {
      acc.totalRooms += day.totalRooms;
      acc.totalAvailable += day.availableRooms;
      acc.totalBooked += day.bookedRooms;
      acc.totalBlocked += day.blockedRooms || 0;
    });
    return acc;
  }, { totalRooms: 0, totalAvailable: 0, totalBooked: 0, totalBlocked: 0, occupancyRate: 0 });

  stats.occupancyRate = stats.totalRooms > 0
    ? Math.round((stats.totalBooked / stats.totalRooms) * 100)
    : 0;

  const getCellStyle = (day: AvailabilityDay | undefined) => {
    if (!day) return { bg: 'bg-muted/30', text: 'text-muted-foreground', badge: '' };
    if (day.isBlocked || (day.blockedRooms || 0) >= day.totalRooms)
      return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-500', badge: 'Blocked' };
    const ratio = day.totalRooms > 0 ? day.availableRooms / day.totalRooms : 0;
    if (ratio === 0) return { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600 dark:text-red-400', badge: 'Sold Out' };
    if (ratio < 0.3) return { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400', badge: 'Limited' };
    return { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400', badge: '' };
  };

  if (isLoading && availabilityData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading availability calendar…</p>
      </div>
    );
  }  return (
    <TooltipProvider>
      <PageShell
        title="Calendar"
        subtitle="Real-time room inventory & pricing calendar — click any cell to manage inventory & pricing"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9 text-xs"
              onClick={() => fetchAvailability(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50/50"
              onClick={() => setIsWeekendDialogOpen(true)}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Update Weekends
            </Button>
            <Button
              size="sm"
              className="gap-2 h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              onClick={() => setIsBulkDialogOpen(true)}
            >
              <Sliders className="h-3.5 w-3.5" />
              Bulk Block
            </Button>
          </div>
        }
      >

        {/* ── Summary Stats Bar ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Occupancy Rate',
              value: `${stats.occupancyRate}%`,
              icon: BarChart3,
              color: 'text-indigo-600 dark:text-indigo-400',
              sub: `${stats.totalBooked} of ${stats.totalRooms} room-nights`,
            },
            {
              label: 'Available',
              value: stats.totalAvailable,
              icon: CheckCircle2,
              color: 'text-emerald-600 dark:text-emerald-400',
              sub: 'Room-nights open',
            },
            {
              label: 'Booked',
              value: stats.totalBooked,
              icon: BedDouble,
              color: 'text-blue-600 dark:text-blue-400',
              sub: 'Confirmed reservations',
            },
            {
              label: 'Blocked',
              value: stats.totalBlocked,
              icon: AlertTriangle,
              color: 'text-amber-600 dark:text-amber-400',
              sub: 'Manually blocked rooms',
            },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <Card key={label} className="shadow-none border-border/80 rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 px-4 pt-4">
                <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
                <Icon className={cn('h-4 w-4', color)} />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Info Banner ── */}
        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300 shadow-sm">
          <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <span className="font-semibold text-blue-900 dark:text-blue-200">Quick Tip:</span> Click any individual cell in the grid below to override its daily rate or mark rooms as sold out/blocked. Use the <strong className="font-bold">Bulk Block</strong> button at the top to block multiple rooms over a date range.
          </div>
        </div>

        {/* ── Controls Row ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Navigator */}
            <div className="flex items-center gap-1 bg-muted/60 dark:bg-muted/20 rounded-lg p-1 border border-border/80">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-sm font-semibold min-w-[140px] text-center text-foreground">
                {format(dates[0], 'MMM d')} – {format(dates[dates.length - 1], 'MMM d, yyyy')}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => navigateDate('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={goToToday} className="h-9 text-xs bg-background border-border/80 rounded-lg font-medium shadow-none">
              Today
            </Button>

            {/* Room Type Filter */}
            <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
              <SelectTrigger className="h-9 w-[180px] text-sm bg-background border-border/80 rounded-lg font-medium shadow-none">
                <SelectValue placeholder="All Room Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Room Types</SelectItem>
                {availabilityData.map(room => (
                  <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            {[
              { color: 'bg-emerald-500', label: 'Available' },
              { color: 'bg-amber-500', label: 'Limited (<30%)' },
              { color: 'bg-red-500', label: 'Sold Out' },
              { color: 'bg-slate-400', label: 'Blocked' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Availability Grid ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${220 + DAYS_TO_SHOW * 76}px` }}>

              {/* Header Row */}
              <div
                className="grid border-b border-border/80 bg-muted/40"
                style={{ gridTemplateColumns: `220px repeat(${DAYS_TO_SHOW}, 1fr)` }}
              >
                <div className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <BedDouble className="h-3.5 w-3.5" />
                  Room Type
                </div>
                {dates.map(date => {
                  const past = isBefore(startOfDay(date), startOfDay(new Date()));
                  const today = isToday(date);
                  return (
                    <div
                      key={date.toISOString()}
                      className={cn(
                        'px-1 py-3 text-center border-l border-border/80 text-xs transition-colors flex flex-col items-center justify-center',
                        today && 'bg-primary/5',
                        past && !today && 'opacity-50'
                      )}
                    >
                      <span className={cn('text-[10px] font-semibold uppercase tracking-wider', today ? 'text-primary' : 'text-muted-foreground')}>
                        {format(date, 'EEE')}
                      </span>
                      <span className={cn(
                        'w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold my-0.5 transition-colors',
                        today ? 'bg-primary text-primary-foreground' : 'text-foreground'
                      )}>
                        {format(date, 'd')}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-medium">{format(date, 'MMM')}</span>
                    </div>
                  );
                })}
              </div>

              {/* Room Rows */}
              {filteredData.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <BedDouble className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No rooms found</p>
                  <p className="text-sm mt-1">Try changing the room type filter</p>
                </div>
              ) : filteredData.map((room, rowIdx) => (
                <div
                  key={room.id}
                  className={cn(
                    'grid border-b border-border/80 last:border-0',
                    rowIdx % 2 === 1 && 'bg-muted/5'
                  )}
                  style={{ gridTemplateColumns: `220px repeat(${DAYS_TO_SHOW}, 1fr)` }}
                >
                  {/* Room Name Cell */}
                  <div className="px-5 py-4 flex flex-col justify-center">
                    <span className="font-semibold text-sm text-foreground leading-tight">{room.name}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <BedDouble className="h-2.5 w-2.5" />
                      {room.totalInventory} total
                    </span>
                  </div>

                  {/* Day Cells */}
                  {dates.map((date, idx) => {
                    const dayStr = format(date, 'yyyy-MM-dd');
                    const dayData = room.availability.find(d => d.date === dayStr);
                    const available = dayData?.availableRooms ?? 0;
                    const total = dayData?.totalRooms ?? room.totalInventory;
                    const booked = dayData?.bookedRooms ?? 0;
                    const blocked = dayData?.blockedRooms ?? 0;
                    const isBlocked = dayData?.isBlocked ?? false;
                    const price = dayData?.price;
                    const isPast = isBefore(startOfDay(date), startOfDay(new Date()));
                    const { bg, text } = getCellStyle(dayData);
                    const cellKey = `${room.id}-${dayStr}`;

                    return (
                      <Tooltip key={idx}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'border-l border-b border-border/80 flex flex-col items-center justify-center py-2 px-1 cursor-pointer transition-all duration-150 group relative hover:bg-muted/10',
                              bg,
                              hoveredCell === cellKey && 'ring-2 ring-inset ring-primary/40 z-10',
                              isPast && 'opacity-60',
                              isToday(date) && 'ring-1 ring-inset ring-primary/30'
                            )}
                            style={{ minHeight: '72px' }}
                            onMouseEnter={() => setHoveredCell(cellKey)}
                            onMouseLeave={() => setHoveredCell(null)}
                            onClick={() => !isPast && handleCellClick(room, date, price)}
                          >
                            {/* Available / Total */}
                            <div className="flex items-baseline gap-0.5">
                              <span className={cn('text-base font-semibold leading-none', text)}>{available}</span>
                              <span className="text-[10px] text-muted-foreground/85 font-normal">/{total}</span>
                            </div>

                            {/* Price */}
                            {price ? (
                              <div className="text-[11px] font-semibold text-muted-foreground/90 mt-1">
                                ₹{price.toLocaleString('en-IN')}
                              </div>
                            ) : (
                              <div className="text-[10px] text-muted-foreground/40 mt-1 italic">no rate</div>
                            )}

                            {/* Block indicator */}
                            {(isBlocked || blocked > 0) && (
                              <div className="absolute top-1.5 right-1.5">
                                <Lock className="h-2.5 w-2.5 text-slate-400" />
                              </div>
                            )}

                            {/* Edit on hover */}
                            {!isPast && (
                              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Edit2 className="h-3 w-3 text-primary opacity-0 group-hover:opacity-80 transition-opacity" />
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[200px]">
                          <div className="font-semibold mb-1">{room.name} · {format(date, 'EEE, MMM d')}</div>
                          <div className="space-y-0.5 text-muted-foreground">
                            <div className="flex justify-between gap-4"><span>Total</span><span className="font-medium text-foreground">{total}</span></div>
                            <div className="flex justify-between gap-4"><span>Booked</span><span className="font-medium text-foreground">{booked}</span></div>
                            <div className="flex justify-between gap-4"><span>Blocked</span><span className="font-medium text-foreground">{blocked}</span></div>
                            <div className="flex justify-between gap-4"><span>Available</span><span className="font-medium text-emerald-500">{available}</span></div>
                            {price && <div className="flex justify-between gap-4"><span>Rate</span><span className="font-medium text-foreground">₹{price.toLocaleString('en-IN')}</span></div>}
                          </div>
                          {!isPast && <p className="text-[10px] text-primary mt-2 font-medium">Click to manage</p>}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageShell>

      {/* ── Dialogs ── */}
      <BulkUpdateDialog
        open={isBulkDialogOpen}
        onOpenChange={setIsBulkDialogOpen}
        roomTypes={availabilityData.map(r => ({ id: r.id, name: r.name, totalInventory: r.totalInventory }))}
        onSuccess={() => fetchAvailability(true)}
      />

      <WeekendUpdateDialog
        open={isWeekendDialogOpen}
        onOpenChange={setIsWeekendDialogOpen}
        roomTypes={availabilityData.map(r => ({ id: r.id, name: r.name, totalInventory: r.totalInventory }))}
        onSuccess={() => fetchAvailability(true)}
      />



      <ManageOccupancyDialog
        open={isManageDialogOpen}
        onOpenChange={setIsManageDialogOpen}
        roomType={selectedCell?.room || null}
        date={selectedCell?.date || null}
        currentPrice={selectedCell?.price}
        onSuccess={() => fetchAvailability(true)}
      />
    </TooltipProvider>
  );
}

export default AvailabilityPage;
