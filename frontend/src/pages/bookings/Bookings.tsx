// Bookings Page - Real API Integration
import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Plus, Search, Filter, Eye, Edit, X, MoreHorizontal, Loader2, CalendarDays } from 'lucide-react';
import { CreateBookingDialog } from '@/components/bookings/CreateBookingDialog';
import { BookingDetailsDialog } from '@/components/bookings/BookingDetailsDialog';
import { EditBookingDialog } from '@/components/bookings/EditBookingDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';

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

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'outline' },
  confirmed: { label: 'Confirmed', variant: 'default' },
  checked_in: { label: 'Checked In', variant: 'secondary' },
  checked_out: { label: 'Checked Out', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog States
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

  const fetchBookings = () => {
    refetch();
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await apiClient.patch(`/bookings/${bookingId}`, { status: 'cancelled' });
      toast({
        title: 'Booking Cancelled',
        description: 'The booking has been cancelled.',
      });
      fetchBookings();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to cancel booking.',
      });
    }
  };

  const handleViewDetails = (booking: BookingData) => {
    setSelectedBooking(booking);
    setIsDetailsOpen(true);
  };

  const handleEditBooking = (booking: BookingData) => {
    setSelectedBooking(booking);
    setIsEditOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filteredBookings = bookings.filter(booking =>
    booking.guest?.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    booking.guest?.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    booking.booking_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading && !isPlaceholderData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading bookings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground">
            View and manage all reservations
          </p>
        </div>
        <CreateBookingDialog onSuccess={fetchBookings} />
      </div>

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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by guest name or booking ID..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="checked_in">Checked In</SelectItem>
            <SelectItem value="checked_out">Checked Out</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2" onClick={() => toast({ title: 'Feature Coming Soon', description: 'Advanced filtering options are under development.' })}>
          <Filter className="h-4 w-4" />
          More Filters
        </Button>
      </div>

      {/* Empty State */}
      {filteredBookings.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Bookings Found</h3>
            <p className="text-muted-foreground text-center mt-1">
              {statusFilter !== 'all' || searchQuery
                ? 'No matching bookings found.'
                : 'Start by creating your first booking.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Bookings Table */}
      {filteredBookings.length > 0 && (
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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">{booking.booking_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {booking.guest?.first_name} {booking.guest?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">{booking.guest?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{booking.rooms?.[0]?.room_type_name || 'N/A'}</TableCell>
                    <TableCell>{booking.check_in}</TableCell>
                    <TableCell>{booking.check_out}</TableCell>
                    <TableCell>
                      <Badge
                        variant={statusConfig[booking.status]?.variant || 'default'}
                        className={booking.status === 'confirmed' ? 'bg-green-600 hover:bg-green-700' : ''}
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
                          <DropdownMenuItem onClick={() => handleViewDetails(booking)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditBooking(booking)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Booking
                          </DropdownMenuItem>
                          {booking.status !== 'cancelled' && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleCancelBooking(booking.id)}
                            >
                              <X className="mr-2 h-4 w-4" />
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
    </div>
  );
}

export default BookingsPage;
