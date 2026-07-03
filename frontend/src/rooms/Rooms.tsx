// Rooms Page - Management with Clean & Professional UI
import { Plus, Search, Grid, List, Bed, Loader2 } from 'lucide-react';
import { useState, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/core/hooks/use-toast';
import { apiClient } from '@/core/api/client';
import { cn } from '@/core/lib/utils';
import { RoomType, RatePlan } from '@/core/types/api';
import { RoomCard } from '@/rooms/components/RoomCard';
import { RoomListItem } from '@/rooms/components/RoomListItem';
import { PageShell } from '@/components/layout/PageShell';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/core/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatCurrency } from '@/core/utils/currency';

// Lazy load dialog components
const RoomDialog = lazy(() => import('@/rooms/components/RoomDialog').then(m => ({ default: m.RoomDialog })));
const RatePlanDialog = lazy(() => import('@/finance/components/rates/RatePlanDialog').then(m => ({ default: m.RatePlanDialog })));
const PackageCard = lazy(() => import('@/rooms/components/PackageCard').then(m => ({ default: m.PackageCard })));

export function RoomsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'room' | 'package') || 'room';
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPackageDialogOpen, setIsPackageDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<RatePlan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hotel, refreshHotel } = useAuth();

  const { data: rooms = [], isLoading: isLoadingRooms } = useQuery<RoomType[]>({
    queryKey: ['rooms'],
    queryFn: () => apiClient.get<RoomType[]>('/rooms'),
  });

  const { data: allRatePlans = [], isLoading: isLoadingRates } = useQuery<RatePlan[]>({
    queryKey: ['rates'],
    queryFn: () => apiClient.get<RatePlan[]>('/rates/plans'),
  });

  const invalidateRooms = () => queryClient.invalidateQueries({ queryKey: ['rooms'] });
  const invalidateRates = () => queryClient.invalidateQueries({ queryKey: ['rates'] });

  const packages = allRatePlans.filter(p => p.is_package);
  const isLoading = activeTab === 'room' ? isLoadingRooms : isLoadingRates;

  const handleTabChange = (tab: 'room' | 'package') => {
    setSearchParams({ tab });
    setSearchQuery('');
    // Packages don't have a list view — force grid
    if (tab === 'package') setViewMode('grid');
  };

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
      invalidateRooms();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to delete the room category.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateFeaturedRoom = async (val: string) => {
    if (!hotel) return;
    setIsUpdatingSettings(true);
    try {
      const payload = { settings: { ...hotel.settings, featured_room_type_id: val } };
      await apiClient.patch('/hotels/me', payload);
      await refreshHotel();
      toast({
        title: 'Settings Updated',
        description: 'Calendar baseline room updated successfully.',
      });
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to update calendar baseline room.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
      });
    } finally {
      setIsUpdatingSettings(false);
    }
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
              onClick={() => handleTabChange('room')}
              className={cn(
                "px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
                activeTab === 'room' ? "bg-background text-indigo-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Rooms
            </button>
            <button
              onClick={() => handleTabChange('package')}
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
                disabled={activeTab === 'package'}
                title={activeTab === 'package' ? 'List view not available for packages' : undefined}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      {isLoading ? (
        viewMode === 'list' ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 p-4">
                <Skeleton className="h-14 w-20 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden">
                <Skeleton className="aspect-[16/10] w-full rounded-none" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <div className="pt-2 flex justify-between items-center border-t border-border">
                    <Skeleton className="h-7 w-20" />
                    <Skeleton className="h-8 w-14 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
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
                      onDelete={async (id) => {
                        if (!confirm("Are you sure you want to delete this package?")) return;
                        try {
                          await apiClient.delete(`/rates/plans/${id}`);
                          invalidateRates();
                        } catch {
                          toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete the package.' });
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
              ) : null}
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
              invalidateRooms();
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
              invalidateRates();
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
