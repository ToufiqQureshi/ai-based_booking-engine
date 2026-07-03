// Guests Page - Real API Integration
import { useState, useEffect } from 'react';
import { Search, Users, Mail, Phone, MoreHorizontal, Eye, Loader2, UserX } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { apiClient } from '@/core/api/client';
import { Guest } from '@/core/types/api';
import { PageShell } from '@/components/layout/PageShell';
import { formatCurrency } from '@/core/utils/currency';

export function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [repeatGuestsCount, setRepeatGuestsCount] = useState(0);

  const handleViewProfile = (guest: Guest) => {
    setSelectedGuest(guest);
    setIsProfileOpen(true);
  };

  const handleSendEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  useEffect(() => {
    const fetchGuests = async () => {
      try {
        setIsLoading(true);
        // Note: The endpoint is currently nested under /bookings/guests in the backend
        const data = await apiClient.get<Guest[]>('/bookings/guests');
        setGuests(data);

        // Fetch stats
        const stats = await apiClient.get<{ repeat_guests: number }>('/bookings/guests/stats');
        setRepeatGuestsCount(stats.repeat_guests);
      } catch (error) {
        console.error('Failed to fetch guests:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuests();
  }, []);

  const filteredGuests = guests.filter(guest =>
    guest.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    guest.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    guest.email.toLowerCase().includes(searchQuery.toLowerCase())
  );


  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading guests...</span>
      </div>
    );
  }

  return (
    <PageShell
      title="Guests"
      subtitle="View and manage your guest directory"
    >

      {/* Stats Cards - Calculated from real data */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Guests</p>
              <p className="text-2xl font-bold">{guests.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Repeat Guests</p>
              <p className="text-2xl font-bold">{repeatGuestsCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
              <Users className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Now</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search guests by name or email..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Empty State */}
      {filteredGuests.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserX className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Guests Found</h3>
            <p className="text-muted-foreground text-center mt-1">
              Guests will appear here once they make a booking.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Guests Table */}
      {filteredGuests.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>ID Number</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuests.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(guest.first_name, guest.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {guest.first_name} {guest.last_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {guest.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {guest.phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{guest.nationality}</TableCell>
                    <TableCell>{guest.id_number || '-'}</TableCell>
                    <TableCell>{new Date(guest.created_at).toLocaleDateString('en-GB')}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewProfile(guest)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSendEmail(guest.email)}>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Email
                          </DropdownMenuItem>
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

      {/* Guest Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Guest Profile</DialogTitle>
            <DialogDescription>
              Details for {selectedGuest?.first_name} {selectedGuest?.last_name}
            </DialogDescription>
          </DialogHeader>
          {selectedGuest && (
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {getInitials(selectedGuest.first_name, selectedGuest.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{selectedGuest.first_name} {selectedGuest.last_name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedGuest.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Nationality</p>
                  <p className="text-sm">{selectedGuest.nationality}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Phone</p>
                  <p className="text-sm">{selectedGuest.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">ID Number</p>
                  <p className="text-sm">{selectedGuest.id_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Member Since</p>
                  <p className="text-sm">{new Date(selectedGuest.created_at).toLocaleDateString('en-GB')}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

export default GuestsPage;
