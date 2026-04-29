// Rooms Page - Room Types Management with Real API
import { Plus, Search, Grid, List, Bed, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { RoomDialog } from '@/components/rooms/RoomDialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { RoomType } from '@/types/api';
import { RoomCard } from '@/components/rooms/RoomCard';
import { RoomListItem } from '@/components/rooms/RoomListItem';

export function RoomsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);

  const { toast } = useToast();

  const { data: rooms = [], isLoading, refetch } = useQuery<RoomType[]>({
    queryKey: ['rooms'],
    queryFn: () => apiClient.get<RoomType[]>('/rooms'),
  });

  const fetchRooms = () => {
    refetch();
  };

  const handleCreateOpen = () => {
    setSelectedRoom(null);
    setIsDialogOpen(true);
  };

  const handleEditOpen = (room: RoomType) => {
    setSelectedRoom(room);
    setIsDialogOpen(true);
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm("Are you sure you want to delete this room type?")) return;

    try {
      await apiClient.delete(`/rooms/${roomId}`);
      toast({
        title: 'Deleted',
        description: 'Room type deleted successfully!',
      });
      refetch();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete room',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (room.description && room.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Room Types</h1>
          <p className="text-muted-foreground">
            Manage your room categories and inventory
          </p>
        </div>
        <Button className="gap-2" onClick={handleCreateOpen}>
          <Plus className="h-4 w-4" />
          Add Room Type
        </Button>
      </div>

      <RoomDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={fetchRooms}
        initialData={selectedRoom}
      />

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search room types..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 border rounded-md p-1 bg-muted/20">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-2"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4 mr-2" />
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-2"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
        </div>
      </div>

      {isLoading && rooms.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading rooms...</span>
        </div>
      ) : (
        <>
          {/* Empty State */}
          {rooms.length === 0 && !isLoading && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bed className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Room Types Yet</h3>
                <p className="text-muted-foreground text-center mt-1">
                  Get started by adding your first room type.
                </p>
                <Button className="mt-4" onClick={handleCreateOpen}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Room Type
                </Button>
              </CardContent>
            </Card>
          )}

          {/* No Search Results */}
          {rooms.length > 0 && filteredRooms.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No rooms found matching "{searchQuery}"
            </div>
          )}

          {/* Room Types Grid */}
          {filteredRooms.length > 0 && viewMode === 'grid' && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onEdit={handleEditOpen}
                  onDelete={handleDeleteRoom}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          )}

          {/* List View */}
          {filteredRooms.length > 0 && viewMode === 'list' && (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredRooms.map((room) => (
                    <RoomListItem
                      key={room.id}
                      room={room}
                      onEdit={handleEditOpen}
                      onDelete={handleDeleteRoom}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default RoomsPage;
