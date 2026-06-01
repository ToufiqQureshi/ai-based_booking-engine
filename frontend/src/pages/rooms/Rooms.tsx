// Rooms Page - Management with Clean & Professional UI
import { Plus, Search, Grid, List, Bed, Loader2, Package, SlidersHorizontal } from 'lucide-react';
import { useState, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { cn } from '@/lib/utils';
import { RoomType, RatePlan } from '@/types/api';
import { RoomCard } from '@/components/rooms/RoomCard';
import { RoomListItem } from '@/components/rooms/RoomListItem';
import { PageShell } from '@/components/layout/PageShell';

// Lazy load dialog components
const RoomDialog = lazy(() => import('@/components/rooms/RoomDialog').then(m => ({ default: m.RoomDialog })));
const RatePlanDialog = lazy(() => import('@/components/rates/RatePlanDialog').then(m => ({ default: m.RatePlanDialog })));
const PackageCard = lazy(() => import('@/components/rooms/PackageCard').then(m => ({ default: m.PackageCard })));

export function RoomsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'room' | 'package'>('room');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPackageDialogOpen, setIsPackageDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<RatePlan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    if (isDeleting || !confirm("Are you sure you want to delete this room type?")) return;

    setIsDeleting(true);
    try {
      await apiClient.delete(`/rooms/${roomId}`);
      toast({
        title: 'Room Deleted',
        description: 'Room category has been successfully removed.',
      });
      refetchRooms();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete the room category.',
      });
    } finally {
      setIsDeleting(false);
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

  return (
    <PageShell
      title={activeTab === 'room' ? 'Room Types' : 'Packages'}
      subtitle={activeTab === 'room' ? 'Manage your hotel room categories and inventory.' : 'Create and manage special stay packages.'}
      actions={
        <Button onClick={handleCreateOpen} className="bg-indigo-600 hover:bg-indigo-700 h-9 px-5 text-sm font-semibold">
          <Plus className="w-4 h-4 mr-1.5" />
          {activeTab === 'room' ? 'Add Room Type' : 'Add Package'}
        </Button>
      }
    >

      {/* Controls Bar */}
      <Card className="shadow-none border-border">
        <CardContent className="p-4 flex flex-col gap-4 md:flex-row md:items-center justify-between">
          {/* Tabs */}
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('room')}
              className={cn(
                "px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
                activeTab === 'room' ? "bg-background text-indigo-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Rooms
            </button>
            <button
              onClick={() => setActiveTab('package')}
              className={cn(
                "px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
                activeTab === 'package' ? "bg-background text-indigo-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Packages
            </button>
          </div>

          {/* Search & View Mode */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeTab === 'room' ? 'rooms' : 'packages'}...`}
                className="pl-9 h-9 text-sm border-border shadow-none focus-visible:ring-blue-600"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex border border-border rounded-lg p-1 bg-background">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7 rounded-md", viewMode === 'grid' && "bg-muted text-indigo-600")}
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7 rounded-md", viewMode === 'list' && "bg-muted text-indigo-600")}
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          <p className="text-muted-foreground text-sm font-medium">Loading content...</p>
        </div>
      ) : displayItems.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed border-border">
          <Bed className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No {activeTab === 'room' ? 'rooms' : 'packages'} found</h3>
          <p className="text-sm text-muted-foreground mb-6">Start by adding your first {activeTab === 'room' ? 'room category' : 'package'}.</p>
          <Button onClick={handleCreateOpen} variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50">
            Create {activeTab === 'room' ? 'Room' : 'Package'}
          </Button>
        </div>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                <Suspense fallback={<div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
                  {(displayItems as RatePlan[]).map((pkg) => (
                    <PackageCard
                      key={pkg.id}
                      pkg={pkg}
                      onEdit={handleEditOpen}
                      onDelete={(id) => {
                        if (confirm("Are you sure you want to delete this package?")) {
                          apiClient.delete(`/rates/plans/${id}`).then(() => refetchRates());
                        }
                      }}
                    />
                  ))}
                </Suspense>
              )}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {activeTab === 'room' ? (
                (displayItems as RoomType[]).map((room) => (
                  <RoomListItem
                    key={room.id}
                    room={room}
                    onEdit={handleEditOpen}
                    onDelete={handleDeleteRoom}
                    formatCurrency={formatCurrency}
                  />
                ))
              ) : (
                <div className="p-10 text-center text-muted-foreground italic text-sm">
                  List view for packages coming soon. Please use grid view.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <Suspense fallback={null}>
        {isDialogOpen && (
          <RoomDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            onSuccess={() => {
              refetchRooms();
              setIsDialogOpen(false);
            }}
            initialData={selectedRoom}
          />
        )}
        {isPackageDialogOpen && (
          <RatePlanDialog
            open={isPackageDialogOpen}
            onOpenChange={setIsPackageDialogOpen}
            onSuccess={() => {
              refetchRates();
              setIsPackageDialogOpen(false);
            }}
            initialData={selectedPackage}
          />
        )}
      </Suspense>
    </PageShell>
  );
}

export default RoomsPage;
