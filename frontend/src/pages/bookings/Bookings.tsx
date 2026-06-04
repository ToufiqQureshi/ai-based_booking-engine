// Bookings Page - Real API Integration
import { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Plus, Search, Filter, Eye, Edit, X, MoreHorizontal, Loader2,
  CalendarDays, Download, MessageSquare, Phone, Globe, Building2
} from 'lucide-react';
import { CreateBookingDialog } from '@/components/bookings/CreateBookingDialog';
import { BookingDetailsDialog } from '@/components/bookings/BookingDetailsDialog';
import { EditBookingDialog } from '@/components/bookings/EditBookingDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { PageShell } from '@/components/layout/PageShell';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BookingData {
  id: string;
  booking_number: string;
  guest: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    nationality?: string;
  };
  rooms: Array<{ room_type_name: string; total_price: number }>;
  check_in: string;
  check_out: string;
  status: string;
  total_amount: number;
  source: string;
  special_requests?: string;
}

interface LeadData {
  id: string;
  guest_name: string;
  guest_email?: string;
  guest_phone: string;
  room_type_preference?: string;
  check_in?: string;
  check_out?: string;
  status: string;
  ai_conversation_summary?: string;
  created_at: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const statusConfig: Record<string, {
  label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string;
}> = {
  pending:          { label: 'Pending',          variant: 'outline' },
  confirmed:        { label: 'Confirmed',        variant: 'default', className: 'bg-green-600 hover:bg-green-700 text-white' },
  checked_in:       { label: 'Checked In',       variant: 'secondary', className: 'bg-blue-100 text-blue-800' },
  checked_out:      { label: 'Checked Out',      variant: 'secondary', className: 'bg-gray-100 text-gray-700' },
  cancelled:        { label: 'Cancelled',        variant: 'destructive' },
  cancel_requested: { label: 'Cancel Requested', variant: 'outline', className: 'bg-amber-100 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 font-bold' },
};

const sourceLabels: Record<string, { label: string; icon: JSX.Element }> = {
  walk_in:      { label: 'Walk-in',       icon: <Building2 className="h-3 w-3" /> },
  phone:        { label: 'Phone',         icon: <Phone className="h-3 w-3" /> },
  online:       { label: 'Online',        icon: <Globe className="h-3 w-3" /> },
  booking_com:  { label: 'Booking.com',   icon: <Globe className="h-3 w-3" /> },
  agoda:        { label: 'Agoda',         icon: <Globe className="h-3 w-3" /> },
  airbnb:       { label: 'Airbnb',        icon: <Globe className="h-3 w-3" /> },
  goibibo:      { label: 'Goibibo',       icon: <Globe className="h-3 w-3" /> },
  makemytrip:   { label: 'MakeMyTrip',    icon: <Globe className="h-3 w-3" /> },
  travel_agent: { label: 'Travel Agent',  icon: <Building2 className="h-3 w-3" /> },
  corporate:    { label: 'Corporate',     icon: <Building2 className="h-3 w-3" /> },
  whatsapp:     { label: 'WhatsApp',      icon: <MessageSquare className="h-3 w-3" /> },
  manual:       { label: 'Manual',        icon: <Plus className="h-3 w-3" /> },
  direct:       { label: 'Direct',        icon: <Globe className="h-3 w-3" /> },
  booking_engine: { label: 'Booking Engine', icon: <Globe className="h-3 w-3" /> },
  ai_agent:     { label: 'AI Agent',      icon: <MessageSquare className="h-3 w-3" /> },
};

// ─── CSV Export Helper ────────────────────────────────────────────────────────

function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const csvRows = [
    keys.join(','),
    ...data.map(row =>
      keys.map(k => {
        const val = String(row[k] ?? '').replace(/"/g, '""');
        return `"${val}"`;
      }).join(',')
    )
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [leadsSearch, setLeadsSearch] = useState('');
  const [leadsStatusFilter, setLeadsStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { toast } = useToast();

  const { data: bookings = [], isLoading, isPlaceholderData, refetch } = useQuery({
    queryKey: ['bookings', statusFilter],
    queryFn: async () => {
      const params = statusFilter !== 'all' ? { status: statusFilter } : undefined;
      return await apiClient.get<BookingData[]>('/bookings', params);
    },
    placeholderData: keepPreviousData
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => await apiClient.get<LeadData[]>('/leads'),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  const fetchBookings = () => { refetch(); };

  const [isCancelling, setIsCancelling] = useState<string | null>(null);

  const handleCancelBooking = async (bookingId: string) => {
    if (isCancelling) return;
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    setIsCancelling(bookingId);
    const queryKey = ['bookings', statusFilter];
    const previousBookings = queryClient.getQueryData<BookingData[]>(queryKey);
    if (previousBookings) {
      queryClient.setQueryData<BookingData[]>(queryKey, (old) =>
        old?.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
      );
    }
    try {
      await apiClient.patch(`/bookings/${bookingId}`, { status: 'cancelled' });
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Booking Cancelled', description: 'The booking has been cancelled.' });
    } catch {
      if (previousBookings) queryClient.setQueryData(queryKey, previousBookings);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to cancel booking on server.' });
    } finally {
      setIsCancelling(null);
    }
  };

  const [updatingLead, setUpdatingLead] = useState<string | null>(null);

  const handleLeadStatusChange = async (leadId: string, newStatus: string) => {
    setUpdatingLead(leadId);
    const previousLeads = queryClient.getQueryData<LeadData[]>(['leads']);
    // Optimistic update
    queryClient.setQueryData<LeadData[]>(['leads'], (old) =>
      old?.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
    try {
      await apiClient.patch(`/leads/${leadId}?status=${encodeURIComponent(newStatus)}`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead Updated', description: `Marked as ${newStatus}.` });
    } catch {
      if (previousLeads) queryClient.setQueryData(['leads'], previousLeads);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update lead status.' });
    } finally {
      setUpdatingLead(null);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  // ── Filter bookings ──
  const filteredBookings = bookings.filter(b => {
    const matchesSearch =
      b.guest?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.guest?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.booking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.guest?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.guest?.phone?.includes(searchQuery);
    const matchesSource = sourceFilter === 'all' || b.source === sourceFilter;
    return matchesSearch && matchesSource;
  });

  // ── Filter leads ──
  const filteredLeads = leads.filter(l => {
    const matchesSearch =
      l.guest_name?.toLowerCase().includes(leadsSearch.toLowerCase()) ||
      l.guest_phone?.includes(leadsSearch) ||
      l.guest_email?.toLowerCase().includes(leadsSearch.toLowerCase()) ||
      l.ai_conversation_summary?.toLowerCase().includes(leadsSearch.toLowerCase());
    const matchesStatus = leadsStatusFilter === 'all' || l.status === leadsStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // ── Export handlers ──
  const handleExportBookings = () => {
    const rows = filteredBookings.map(b => ({
      'Booking ID': b.booking_number,
      'Guest Name': `${b.guest?.first_name} ${b.guest?.last_name}`,
      'Email': b.guest?.email || '',
      'Phone': b.guest?.phone || '',
      'Room': b.rooms?.[0]?.room_type_name || '',
      'Check In': b.check_in,
      'Check Out': b.check_out,
      'Status': b.status,
      'Source': sourceLabels[b.source]?.label || b.source,
      'Total (₹)': b.total_amount,
    }));
    exportToCSV(rows, `bookings_${new Date().toISOString().slice(0,10)}.csv`);
    toast({ title: '✅ Export Successful', description: `${rows.length} bookings exported to CSV.` });
  };

  const handleExportLeads = () => {
    const rows = filteredLeads.map(l => ({
      'Guest Name': l.guest_name,
      'Phone': l.guest_phone,
      'Email': l.guest_email || '',
      'Room Interested': l.room_type_preference || '',
      'Check In': l.check_in || '',
      'Check Out': l.check_out || '',
      'AI Summary': l.ai_conversation_summary || '',
      'Status': l.status,
      'Date Captured': new Date(l.created_at).toLocaleDateString('en-IN'),
    }));
    exportToCSV(rows, `ai_leads_${new Date().toISOString().slice(0,10)}.csv`);
    toast({ title: '✅ Export Successful', description: `${rows.length} leads exported to CSV.` });
  };

  if (isLoading && !isPlaceholderData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading bookings...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <PageShell
        title="Bookings"
        subtitle="View and manage all reservations"
        actions={<CreateBookingDialog onSuccess={fetchBookings} />}
      >
        <BookingDetailsDialog
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          booking={selectedBooking}
          onStatusChange={fetchBookings}
        />
        <EditBookingDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          booking={selectedBooking}
          onSuccess={fetchBookings}
        />

        <Tabs defaultValue="bookings" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
            <TabsTrigger value="bookings">Confirmed Bookings</TabsTrigger>
            <TabsTrigger value="leads" className="relative">
              AI Enquiries (Leads)
              {leads.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                  {leads.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════ BOOKINGS TAB ═══════════════════ */}
          <TabsContent value="bookings" className="space-y-4">
            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, booking ID, email, phone..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[145px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="checked_out">Checked Out</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="cancel_requested">Cancel Requested</SelectItem>
                </SelectContent>
              </Select>

              {/* Source Filter */}
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="ai_agent">🤖 AI Agent</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="booking_engine">Booking Engine</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="online">Hotel Website</SelectItem>
                  <SelectItem value="booking_com">Booking.com</SelectItem>
                  <SelectItem value="agoda">Agoda</SelectItem>
                  <SelectItem value="airbnb">Airbnb</SelectItem>
                  <SelectItem value="goibibo">Goibibo</SelectItem>
                  <SelectItem value="makemytrip">MakeMyTrip</SelectItem>
                  <SelectItem value="travel_agent">Travel Agent</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="manual">Manual / Other</SelectItem>
                </SelectContent>
              </Select>

              {/* Export CSV */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" className="gap-2" onClick={handleExportBookings}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export filtered bookings to CSV / Excel</TooltipContent>
              </Tooltip>
            </div>

            {/* Count */}
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredBookings.length}</span> of {bookings.length} bookings
              {sourceFilter !== 'all' && ` · Source: ${sourceLabels[sourceFilter]?.label || sourceFilter}`}
            </p>

            {filteredBookings.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Bookings Found</h3>
                  <p className="text-muted-foreground text-center mt-1">
                    {statusFilter !== 'all' || searchQuery || sourceFilter !== 'all'
                      ? 'No matching bookings found. Try clearing filters.'
                      : 'Start by creating your first booking.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Booking ID</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-mono text-xs font-medium">{booking.booking_number}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{booking.guest?.first_name} {booking.guest?.last_name}</p>
                              <p className="text-xs text-muted-foreground">{booking.guest?.email}</p>
                              {booking.guest?.phone && (
                                <p className="text-xs text-muted-foreground">{booking.guest.phone}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{booking.rooms?.[0]?.room_type_name || 'N/A'}</TableCell>
                          <TableCell className="text-sm">{booking.check_in}</TableCell>
                          <TableCell className="text-sm">{booking.check_out}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {sourceLabels[booking.source]?.icon}
                              <span>{sourceLabels[booking.source]?.label || booking.source || 'Direct'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={statusConfig[booking.status]?.variant || 'default'}
                              className={statusConfig[booking.status]?.className}
                            >
                              {statusConfig[booking.status]?.label || booking.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(booking.total_amount)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedBooking(booking); setIsDetailsOpen(true); }}>
                                  <Eye className="mr-2 h-4 w-4" />View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedBooking(booking); setIsEditOpen(true); }}>
                                  <Edit className="mr-2 h-4 w-4" />Edit Booking
                                </DropdownMenuItem>
                                {booking.status !== 'cancelled' && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    disabled={isCancelling === booking.id}
                                    onClick={() => handleCancelBooking(booking.id)}
                                  >
                                    {isCancelling === booking.id ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <X className="mr-2 h-4 w-4" />
                                    )}
                                    Cancel Booking
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════════════ AI LEADS TAB ═══════════════════ */}
          <TabsContent value="leads" className="space-y-4">
            {/* Leads Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, email or summary..."
                  className="pl-10"
                  value={leadsSearch}
                  onChange={(e) => setLeadsSearch(e.target.value)}
                />
              </div>

              <Select value={leadsStatusFilter} onValueChange={setLeadsStatusFilter}>
                <SelectTrigger className="w-[145px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" className="gap-2" onClick={handleExportLeads}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export AI leads to CSV / Excel</TooltipContent>
              </Tooltip>
            </div>

            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredLeads.length}</span> of {leads.length} AI leads
            </p>

            <Card>
              <CardContent className="p-0">
                {leadsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span className="text-muted-foreground">Loading leads...</span>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guest Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Room Interested</TableHead>
                        <TableHead>Check-in / Out</TableHead>
                        <TableHead>AI Conversation Summary</TableHead>
                        <TableHead>Date Captured</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                            {leadsSearch || leadsStatusFilter !== 'all'
                              ? 'No leads match your filters.'
                              : 'No AI enquiries yet. They appear here when guests chat via the AI Concierge.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLeads.map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {lead.guest_name || <span className="text-muted-foreground italic">Unknown</span>}
                            </TableCell>
                            <TableCell className="text-sm">
                              {lead.guest_phone || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-sm">
                              {lead.guest_email || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-sm max-w-[160px]">
                              {lead.room_type_preference ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block truncate cursor-default">{lead.room_type_preference}</span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-xs">{lead.room_type_preference}</TooltipContent>
                                </Tooltip>
                              ) : <span className="text-muted-foreground">Not specified</span>}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {lead.check_in && lead.check_out
                                ? `${lead.check_in} → ${lead.check_out}`
                                : <span className="text-muted-foreground">Not decided</span>}
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="truncate text-xs text-muted-foreground italic cursor-default">
                                    {lead.ai_conversation_summary || '—'}
                                  </p>
                                </TooltipTrigger>
                                {lead.ai_conversation_summary && (
                                  <TooltipContent className="max-w-xs whitespace-pre-wrap text-xs">
                                    {lead.ai_conversation_summary}
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={lead.status || 'new'}
                                onValueChange={(v) => handleLeadStatusChange(lead.id, v)}
                                disabled={updatingLead === lead.id}
                              >
                                <SelectTrigger
                                  className={`h-7 w-[130px] text-xs font-medium ${
                                    lead.status === 'new' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                                    lead.status === 'converted' ? 'border-green-300 text-green-700 bg-green-50' :
                                    lead.status === 'lost' ? 'border-red-300 text-red-700 bg-red-50' :
                                    'border-amber-300 text-amber-700 bg-amber-50'
                                  }`}
                                >
                                  {updatingLead === lead.id
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <SelectValue />}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="new">New</SelectItem>
                                  <SelectItem value="contacted">Contacted</SelectItem>
                                  <SelectItem value="converted">Converted</SelectItem>
                                  <SelectItem value="lost">Lost</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageShell>
    </TooltipProvider>
  );
}

export default BookingsPage;
