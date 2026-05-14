// Rooms Page - Room Types Management with Real API
import { Plus, Search, Grid, List, Bed, Loader2, Package } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { RoomDialog } from '@/components/rooms/RoomDialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { cn } from '@/lib/utils';
import { RoomType, RatePlan } from '@/types/api';
import { RoomCard } from '@/components/rooms/RoomCard';
import { RoomListItem } from '@/components/rooms/RoomListItem';
import { RatePlanDialog } from '@/components/rates/RatePlanDialog';
import { PackageCard } from '@/components/rooms/PackageCard';

export function RoomsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'room' | 'package'>('room');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPackageDialogOpen, setIsPackageDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<RatePlan | null>(null);

  const { toast } = useToast();

  const { data: rooms = [], isLoading: isLoadingRooms, refetch: refetchRooms } = useQuery<RoomType[]>({
    queryKey: ['rooms'],
    queryFn: () => apiClient.get<RoomType[]>('/rooms'),
  });

  const { data: allRatePlans = [], isLoading: isLoadingRates, refetch: refetchRates } = useQuery<RatePlan[]>({
    queryKey: ['rates'],
    queryFn: () => apiClient.get<RatePlan[]>('/rates/plans'),
  });

  const packages = allRatePlans.filter(p => p.is_package);
  const isLoading = activeTab === 'room' ? isLoadingRooms : isLoadingRates;

  const handleCreateOpen = () => {
    if (activeTab === 'room') {
      setSelectedRoom(null);
      setIsDialogOpen(true);
    } else {
      setSelectedPackage(null);
      setIsPackageDialogOpen(true);
    }
  };

  const handleEditOpen = (item: RoomType | RatePlan) => {
    if (activeTab === 'room') {
      setSelectedRoom(item as RoomType);
      setIsDialogOpen(true);
    } else {
      setSelectedPackage(item as RatePlan);
      setIsPackageDialogOpen(true);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm("Are you sure you want to delete this room type?")) return;

    try {
      await apiClient.delete(`/rooms/${roomId}`);
      toast({
        title: 'Deleted',
        description: 'Room type deleted successfully!',
      });
      refetchRooms();
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

  const filteredPackages = packages.filter(pkg =>
    pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (pkg.description && pkg.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const displayItems = activeTab === 'room' ? filteredRooms : filteredPackages;
  const originalItems = activeTab === 'room' ? rooms : packages;

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
        <div className="flex items-center gap-4">
          <div className="flex p-1 bg-muted rounded-full">
            <button
              onClick={() => setActiveTab('room')}
              className={cn(
                "px-6 py-1.5 rounded-full text-sm font-medium transition-all",
                activeTab === 'room' ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Room
            </button>
            <button
              onClick={() => setActiveTab('package')}
              className={cn(
                "px-6 py-1.5 rounded-full text-sm font-medium transition-all",
                activeTab === 'package' ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Package
            </button>
          </div>
          <Button className="gap-2" onClick={handleCreateOpen}>
            <Plus className="h-4 w-4" />
            {activeTab === 'room' ? 'Add Room Type' : 'Create Package'}
          </Button>
        </div>
      </div>

      <RoomDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={refetchRooms}
        initialData={selectedRoom}
      />

      <RatePlanDialog
        open={isPackageDialogOpen}
        onOpenChange={setIsPackageDialogOpen}
        onSuccess={refetchRates}
        planToEdit={selectedPackage}
        defaultIsPackage={activeTab === 'package'}
      />

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={activeTab === 'room' ? "Search room types..." : "Search packages..."}
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
            disabled={activeTab === 'package'} // Packages only in grid for now
          >
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
        </div>
      </div>

      {isLoading && originalItems.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading {activeTab === 'room' ? 'rooms' : 'packages'}...</span>
        </div>
      ) : (
        <>
          {/* Empty State */}
          {originalItems.length === 0 && !isLoading && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                {activeTab === 'room' ? <Bed className="h-12 w-12 text-muted-foreground mb-4" /> : <Package className="h-12 w-12 text-muted-foreground mb-4" />}
                <h3 className="text-lg font-medium">No {activeTab === 'room' ? 'Room Types' : 'Packages'} Yet</h3>
                <p className="text-muted-foreground text-center mt-1">
                  Get started by adding your first {activeTab === 'room' ? 'room type' : 'package'}.
                </p>
                <Button className="mt-4" onClick={handleCreateOpen}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add {activeTab === 'room' ? 'Room Type' : 'Package'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* No Search Results */}
          {originalItems.length > 0 && displayItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No {activeTab === 'room' ? 'rooms' : 'packages'} found matching "{searchQuery}"
            </div>
          )}

          {/* Room Types/Packages Grid */}
          {displayItems.length > 0 && viewMode === 'grid' && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {activeTab === 'room' ? (
                (displayItems as RoomType[]).map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onEdit={handleEditOpen}
                    onDelete={handleDeleteRoom}
                    formatCurrency={formatCurrency}
                  />
                ))
              ) : (
                (displayItems as RatePlan[]).map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    onEdit={handleEditOpen}
                    onDelete={(id) => {
                      if (confirm("Delete this package?")) {
                        apiClient.delete(`/rates/plans/${id}`).then(() => refetchRates());
                      }
                    }}
                  />
                ))
              )}
            </div>
          )}

          {/* List View (Rooms only) */}
          {activeTab === 'room' && displayItems.length > 0 && viewMode === 'list' && (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {(displayItems as RoomType[]).map((room) => (
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
