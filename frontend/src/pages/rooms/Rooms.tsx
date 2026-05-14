// Rooms Page - Room Types Management with Ultra-Premium UI
import { Plus, Search, Grid, List, Bed, Loader2, Package, Sparkles, SlidersHorizontal } from 'lucide-react';
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

// Lazy load dialog components to avoid circular dependency / "Form is not defined" error
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
        title: 'Inventory Updated',
        description: 'Room category has been successfully removed.',
      });
      refetchRooms();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: 'Encountered an issue while deleting the room category.',
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
    <div className="space-y-8 pb-10">
      {/* Premium Page Header */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-950 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]" />
        
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Inventory Intelligence
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white">
              {activeTab === 'room' ? 'Room Architecture' : 'Signature Packages'}
            </h1>
            <p className="text-indigo-200/70 max-w-xl text-sm sm:text-base font-medium leading-relaxed">
              {activeTab === 'room' 
                ? 'Design and manage high-conversion room categories with precision analytics and real-time inventory control.' 
                : 'Curate exclusive experiences that combine luxury stay with premium add-ons to drive higher revenue per guest.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Custom Premium Tabs */}
            <div className="flex p-1.5 bg-black/20 backdrop-blur-xl border border-white/10 rounded-[20px]">
              <button
                onClick={() => setActiveTab('room')}
                className={cn(
                  "px-8 py-2.5 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all duration-300",
                  activeTab === 'room' 
                    ? "bg-white text-indigo-950 shadow-lg scale-105" 
                    : "text-white/50 hover:text-white"
                )}
              >
                Rooms
              </button>
              <button
                onClick={() => setActiveTab('package')}
                className={cn(
                  "px-8 py-2.5 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all duration-300",
                  activeTab === 'package' 
                    ? "bg-white text-indigo-950 shadow-lg scale-105" 
                    : "text-white/50 hover:text-white"
                )}
              >
                Packages
              </button>
            </div>

            <Button 
              onClick={handleCreateOpen}
              className="h-14 px-8 rounded-[20px] bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_15px_30px_rgba(99,102,241,0.3)] font-black uppercase tracking-widest text-xs flex gap-3 group transition-all active:scale-95"
            >
              <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
              {activeTab === 'room' ? 'Architect Room' : 'Craft Package'}
            </Button>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <RoomDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSuccess={refetchRooms}
          initialData={selectedRoom}
        />
      </Suspense>

      <Suspense fallback={null}>
        <RatePlanDialog
          open={isPackageDialogOpen}
          onOpenChange={setIsPackageDialogOpen}
          onSuccess={refetchRates}
          planToEdit={selectedPackage}
          defaultIsPackage={activeTab === 'package'}
        />
      </Suspense>

      {/* Control Bar: Search & View Mode */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between sticky top-6 z-30 px-2">
        <div className="relative flex-1 max-w-xl group">
          <div className="absolute inset-0 bg-indigo-500/5 rounded-[22px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative flex items-center bg-white/80 backdrop-blur-xl border border-indigo-100/50 rounded-[22px] px-5 py-1 shadow-sm focus-within:shadow-xl focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all duration-300">
            <Search className="h-5 w-5 text-indigo-400 mr-3" />
            <Input
              placeholder={activeTab === 'room' ? "Search room categories, descriptions..." : "Search curated packages..."}
              className="border-none bg-transparent focus-visible:ring-0 text-indigo-950 font-bold h-12"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="h-8 w-[1px] bg-indigo-100 mx-2" />
            <Button variant="ghost" size="icon" className="text-indigo-400 hover:text-indigo-600 rounded-xl">
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white/60 backdrop-blur-lg border border-indigo-100/50 p-2 rounded-[22px] shadow-sm">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "flex items-center justify-center h-11 px-6 rounded-[16px] text-xs font-black uppercase tracking-widest transition-all",
              viewMode === 'grid' ? "bg-indigo-600 text-white shadow-lg" : "text-indigo-400 hover:text-indigo-900 hover:bg-indigo-50"
            )}
          >
            <Grid className="h-4 w-4 mr-2" />
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "flex items-center justify-center h-11 px-6 rounded-[16px] text-xs font-black uppercase tracking-widest transition-all",
              viewMode === 'list' ? "bg-indigo-600 text-white shadow-lg" : "text-indigo-400 hover:text-indigo-900 hover:bg-indigo-50",
              activeTab === 'package' && "opacity-50 cursor-not-allowed"
            )}
            disabled={activeTab === 'package'}
          >
            <List className="h-4 w-4 mr-2" />
            List
          </button>
        </div>
      </div>

      {isLoading && originalItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse" />
            <Loader2 className="h-12 w-12 animate-spin text-indigo-600 relative" />
          </div>
          <span className="text-indigo-900/40 text-xs font-black uppercase tracking-[0.2em]">Synchronizing Inventory...</span>
        </div>
      ) : (
        <div className="px-2">
          {/* Empty State */}
          {originalItems.length === 0 && !isLoading && (
            <Card className="border-2 border-dashed border-indigo-100 bg-indigo-50/20 rounded-[40px] overflow-hidden">
              <CardContent className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-24 h-24 rounded-[32px] bg-white shadow-2xl flex items-center justify-center mb-8 rotate-6 hover:rotate-0 transition-transform duration-500">
                  {activeTab === 'room' ? (
                    <Bed className="h-10 w-10 text-indigo-500" />
                  ) : (
                    <Package className="h-10 w-10 text-indigo-500" />
                  )}
                </div>
                <h3 className="text-2xl font-black text-indigo-950 tracking-tight">Your Inventory is Vacant</h3>
                <p className="text-indigo-400 max-w-sm mt-3 font-medium">
                  Initialize your revenue engine by creating your first {activeTab === 'room' ? 'room architecture' : 'luxury package'}.
                </p>
                <Button 
                  className="mt-8 h-12 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/20 font-bold"
                  onClick={handleCreateOpen}
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Create First {activeTab === 'room' ? 'Room' : 'Package'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* No Search Results */}
          {originalItems.length > 0 && displayItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="text-indigo-950 text-xl font-black tracking-tight">No match discovered</div>
              <p className="text-indigo-400 mt-2 font-medium">We couldn't find any {activeTab === 'room' ? 'rooms' : 'packages'} matching "{searchQuery}"</p>
              <Button variant="link" className="mt-4 text-indigo-600 font-bold" onClick={() => setSearchQuery('')}>Clear all filters</Button>
            </div>
          )}

          {/* Room Types/Packages Grid */}
          {displayItems.length > 0 && viewMode === 'grid' && (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-enter">
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
                <Suspense fallback={null}>
                  {(displayItems as RatePlan[]).map((pkg) => (
                    <PackageCard
                      key={pkg.id}
                      pkg={pkg}
                      onEdit={handleEditOpen}
                      onDelete={(id) => {
                        if (confirm("Permanently remove this package?")) {
                          apiClient.delete(`/rates/plans/${id}`).then(() => refetchRates());
                        }
                      }}
                    />
                  ))}
                </Suspense>
              )}
            </div>
          )}

          {/* List View (Rooms only) */}
          {activeTab === 'room' && displayItems.length > 0 && viewMode === 'list' && (
            <div className="bg-white/70 backdrop-blur-xl border border-indigo-100/50 rounded-[32px] overflow-hidden shadow-sm animate-enter">
              <div className="divide-y divide-indigo-50">
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RoomsPage;
