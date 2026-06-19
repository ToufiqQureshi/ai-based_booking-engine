import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Plus, Search, Loader2, Sparkles, Pencil, Trash2, ImageOff,
    Wifi, Tv, Snowflake, Waves, Dumbbell, Car, Utensils, Star,
    ShieldCheck, Wine, Bath, ShowerHead, Flame, Baby, Languages,
    ConciergeBell, WashingMachine, Key, Wind, CigaretteOff, PawPrint,
    VolumeX, Maximize, Briefcase, Map, LayoutGrid, Hotel, BedDouble, Filter,
    Coffee, Sunrise, Sunset, Plane, ParkingCircle, UtensilsCrossed, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/core/hooks/use-toast';
import { apiClient } from '@/core/api/client';
import { AddOn, Amenity } from '@/core/types/api';
import { AddonDialog } from '@/marketing/components/addons/AddonDialog';
import { getImageUrl, cn } from '@/core/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageShell } from '@/components/layout/PageShell';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const ICONS: Record<string, any> = {
    wifi: Wifi,
    tv: Tv,
    coffee: Coffee,
    snowflake: Snowflake,
    waves: Waves,
    dumbbell: Dumbbell,
    car: Car,
    utensils: Utensils,
    star: Star,
    shield: ShieldCheck,
    sparkle: Sparkles,
    wine: Wine,
    bath: Bath,
    shower: ShowerHead,
    bed: BedDouble,
    flame: Flame,
    baby: Baby,
    globe: Languages,
    bell: ConciergeBell,
    laundry: WashingMachine,
    key: Key,
    wind: Wind,
    no_smoking: CigaretteOff,
    pet: PawPrint,
    volume_mute: VolumeX,
    expand: Maximize,
    briefcase: Briefcase,
    map: Map,
};

const AMENITY_CATEGORIES = [
    { value: 'general', label: 'General', color: 'bg-muted text-foreground' },
    { value: 'tech', label: 'Technology', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
    { value: 'wellness', label: 'Wellness', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
    { value: 'dining', label: 'Dining', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' },
    { value: 'room', label: 'Room Feature', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400' },
];

export default function AddonsPage() {
    const { toast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'services';
    const setActiveTab = (tab: string) => setSearchParams({ tab });

    // ==========================================
    // TAB 1: ADD-ON SERVICES STATE & LOGIC
    // ==========================================
    const [addons, setAddons] = useState<AddOn[]>([]);
    const [isAddonsLoading, setIsAddonsLoading] = useState(true);
    const [addonsSearchQuery, setAddonsSearchQuery] = useState('');
    const [isAddonDialogOpen, setIsAddonDialogOpen] = useState(false);
    const [selectedAddon, setSelectedAddon] = useState<AddOn | null>(null);

    const fetchAddons = useCallback(async () => {
        try {
            setIsAddonsLoading(true);
            const data = await apiClient.get<AddOn[]>('/addons');
            setAddons(data);
        } catch (error) {
            console.error('Failed to fetch addons:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to load experiences. Please try again.',
            });
        } finally {
            setIsAddonsLoading(false);
        }
    }, [toast]);

    const handleCreateAddonOpen = () => {
        setSelectedAddon(null);
        setIsAddonDialogOpen(true);
    };

    const handleEditAddonOpen = (addon: AddOn) => {
        setSelectedAddon(addon);
        setIsAddonDialogOpen(true);
    };

    const handleDeleteAddon = async (id: string) => {
        if (!confirm("Are you sure you want to delete this service?")) return;
        try {
            await apiClient.delete(`/addons/${id}`);
            toast({ title: 'Deleted', description: 'Experience deleted successfully.' });
            fetchAddons();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to delete experience.',
            });
        }
    };

    const filteredAddons = addons.filter(addon =>
        addon.name.toLowerCase().includes(addonsSearchQuery.toLowerCase()) ||
        addon.category.toLowerCase().includes(addonsSearchQuery.toLowerCase())
    );

    // Quick upsell templates — one-click to create; hotelier edits price if needed
    const UPSELL_TEMPLATES = [
        { name: 'Early Check-in',        description: 'Check in from 9 AM onwards, subject to availability',         price: 500,  category: 'general',   icon: Sunrise },
        { name: 'Late Check-out',         description: 'Extend your stay until 2 PM hassle-free',                     price: 500,  category: 'general',   icon: Sunset },
        { name: 'Breakfast Package',      description: 'Continental breakfast for 2 served in-room or at restaurant', price: 350,  category: 'food',      icon: Coffee },
        { name: 'Airport Transfer',       description: 'One-way air-conditioned cab pickup or drop at airport',        price: 800,  category: 'transport', icon: Plane },
        { name: 'Parking',               description: 'Secure covered parking for one vehicle',                       price: 200,  category: 'transport', icon: ParkingCircle },
        { name: 'Spa Session',           description: '60-minute full-body relaxation massage',                       price: 1500, category: 'wellness',  icon: Waves },
        { name: 'Candlelight Dinner',    description: 'Private candlelight dinner for 2 with curated menu',          price: 2000, category: 'romance',   icon: UtensilsCrossed },
        { name: 'City Tour',             description: 'Half-day guided sightseeing tour of top local attractions',   price: 1200, category: 'activity',  icon: Map },
    ] as const;

    const createFromTemplate = async (t: typeof UPSELL_TEMPLATES[number]) => {
        try {
            await apiClient.post('/addons', {
                name: t.name,
                description: t.description,
                price: t.price,
                category: t.category,
                is_active: true,
            });
            toast({ title: `"${t.name}" added!`, description: 'Edit the price to match your rates.' });
            fetchAddons();
        } catch {
            toast({ variant: 'destructive', title: 'Failed to create', description: 'Try again.' });
        }
    };

    const [showTemplates, setShowTemplates] = useState(true);

    // ==========================================
    // TAB 2 & 3: AMENITIES STATE & LOGIC
    // ==========================================
    const [amenities, setAmenities] = useState<Amenity[]>([]);
    const [isAmenitiesLoading, setIsAmenitiesLoading] = useState(true);
    const [amenitiesSearchQuery, setAmenitiesSearchQuery] = useState('');
    const [isAmenityDialogOpen, setIsAmenityDialogOpen] = useState(false);
    const [isAmenitySubmitting, setIsAmenitySubmitting] = useState(false);

    const [amenityFormData, setAmenityFormData] = useState({
        name: '',
        icon_slug: 'star',
        category: 'general',
        scope: 'room' as 'hotel' | 'room',
        is_featured: false
    });

    const fetchAmenities = useCallback(async () => {
        setIsAmenitiesLoading(true);
        try {
            const data = await apiClient.get<Amenity[]>('/amenities');
            if (data.length === 0) {
                await apiClient.post('/amenities/seed-defaults');
                const seeded = await apiClient.get<Amenity[]>('/amenities');
                setAmenities(seeded);
            } else {
                setAmenities(data);
            }
        } catch (error) {
            console.error('Failed to fetch amenities:', error);
            toast({ 
                variant: "destructive", 
                title: "Error", 
                description: "Failed to load amenities. Please try again." 
            });
        } finally {
            setIsAmenitiesLoading(false);
        }
    }, [toast]);

    const handleCreateAmenityOpen = (scope: 'room' | 'hotel') => {
        setAmenityFormData({
            name: '',
            icon_slug: 'star',
            category: 'general',
            scope: scope,
            is_featured: false
        });
        setIsAmenityDialogOpen(true);
    };

    const handleCreateAmenity = async () => {
        if (!amenityFormData.name) return;
        setIsAmenitySubmitting(true);
        try {
            const newAmenity = await apiClient.post<Amenity>('/amenities', amenityFormData);
            setAmenities(prev => [...prev, newAmenity]);
            setIsAmenityDialogOpen(false);
            toast({ title: "Success", description: `${amenityFormData.scope === 'room' ? 'Room' : 'Property'} amenity added successfully.` });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to create amenity definition." });
        } finally {
            setIsAmenitySubmitting(false);
        }
    };

    const handleDeleteAmenity = async (id: string) => {
        if (!confirm("Are you sure you want to delete this amenity?")) return;
        try {
            await apiClient.delete(`/amenities/${id}`);
            setAmenities(prev => prev.filter(a => a.id !== id));
            toast({ title: "Deleted", description: "The amenity has been permanently removed." });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to delete amenity." });
        }
    };

    const getAmenityIcon = (slug: string, className = "w-4.5 h-4.5") => {
        const Icon = ICONS[slug] || Star;
        return <Icon className={className} />;
    };

    const filteredRoomAmenities = amenities.filter(a => 
        a.scope === 'room' && (
            a.name.toLowerCase().includes(amenitiesSearchQuery.toLowerCase()) || 
            a.category.toLowerCase().includes(amenitiesSearchQuery.toLowerCase())
        )
    );

    const filteredHotelAmenities = amenities.filter(a => 
        a.scope === 'hotel' && (
            a.name.toLowerCase().includes(amenitiesSearchQuery.toLowerCase()) || 
            a.category.toLowerCase().includes(amenitiesSearchQuery.toLowerCase())
        )
    );

    // ==========================================
    // INITIAL LOAD
    // ==========================================
    useEffect(() => {
        fetchAddons();
        fetchAmenities();
    }, [fetchAddons, fetchAmenities]);

  const getAddonCategoryBadge = (category: string) => {
    const cat = category.toLowerCase();
    let color = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/50";
    if (cat.includes('transport')) color = "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30";
    else if (cat.includes('food') || cat.includes('dining')) color = "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100/50 dark:border-amber-900/30";
    else if (cat.includes('wellness') || cat.includes('spa')) color = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30";
    else if (cat.includes('activity')) color = "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30";
    
    return (
      <Badge variant="secondary" className={cn("uppercase text-[10px] font-black tracking-widest rounded-lg px-2.5 py-1 border", color)}>
        {category}
      </Badge>
    );
  };

  const pageActions = (
    <div className="flex items-center gap-2">
      {activeTab === 'services' && (
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-100 dark:shadow-none h-11 px-5 transition-all active:scale-95" onClick={handleCreateAddonOpen}>
          <Plus className="h-4 w-4" />
          Add Experience
        </Button>
      )}
      {activeTab === 'room_amenities' && (
        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none h-11 px-5 transition-all active:scale-95" onClick={() => handleCreateAmenityOpen('room')}>
          <Plus className="h-4 w-4" />
          Add Room Amenity
        </Button>
      )}
      {activeTab === 'hotel_amenities' && (
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 dark:shadow-none h-11 px-5 transition-all active:scale-95" onClick={() => handleCreateAmenityOpen('hotel')}>
          <Plus className="h-4 w-4" />
          Add Property Amenity
        </Button>
      )}
    </div>
  );

  return (
    <PageShell
      title="Experiences & Activities"
      subtitle="Manage extra guest services, experience packages, room rules, and property-wide amenities."
      actions={pageActions}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 max-w-xl h-11 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/10">
          <TabsTrigger value="services" className="rounded-lg text-xs font-black tracking-wide data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            <Sparkles className="w-3.5 h-3.5 mr-2" /> Experiences &amp; Activities
          </TabsTrigger>
          <TabsTrigger value="room_amenities" className="rounded-lg text-xs font-black tracking-wide data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
            <BedDouble className="w-3.5 h-3.5 mr-2" /> Room Amenities
          </TabsTrigger>
          <TabsTrigger value="hotel_amenities" className="rounded-lg text-xs font-black tracking-wide data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">
            <Hotel className="w-3.5 h-3.5 mr-2" /> Property Amenities
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: ADD-ON SERVICES ── */}
        <TabsContent value="services" className="space-y-5 outline-none">
          <AddonDialog
            open={isAddonDialogOpen}
            onOpenChange={setIsAddonDialogOpen}
            onSuccess={fetchAddons}
            initialData={selectedAddon}
          />

          {/* Quick Upsell Templates */}
          <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-blue-800 dark:text-blue-300">Quick Upsell Templates</span>
                <span className="text-xs text-blue-500 dark:text-blue-400">— click to add instantly, then edit price</span>
              </div>
              <button
                onClick={() => setShowTemplates(v => !v)}
                className="text-xs text-blue-500 hover:text-blue-700 font-semibold"
              >
                {showTemplates ? 'Hide' : 'Show'}
              </button>
            </div>
            {showTemplates && (
              <div className="flex flex-wrap gap-2">
                {UPSELL_TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => createFromTemplate(t)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-800/50 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all shadow-sm hover:shadow-md"
                  >
                    <t.icon className="w-3.5 h-3.5 text-blue-500" />
                    {t.name}
                    <span className="text-xs text-muted-foreground font-normal">₹{t.price}</span>
                    <Plus className="w-3 h-3 text-blue-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search experiences..."
                className="pl-11 h-11 rounded-xl border-slate-200 focus-visible:ring-blue-500 font-medium"
                value={addonsSearchQuery}
                onChange={(e) => setAddonsSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {isAddonsLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Loading Services...</span>
            </div>
          ) : filteredAddons.length === 0 ? (
            <Card className="border-dashed border-2 rounded-3xl bg-slate-50/20">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Sparkles className="h-14 w-14 text-slate-300 dark:text-slate-700 mb-4 opacity-70" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">No Experiences Yet</h3>
                <p className="text-muted-foreground text-center mt-1.5 max-w-xs text-sm leading-relaxed">
                  Enhance guest experience by adding extra services like airport pick ups, candlelight dinners, or spa sessions.
                </p>
                <Button className="mt-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md" onClick={handleCreateAddonOpen}>
                  Add First Experience
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/20">
                  <TableRow className="border-slate-100 dark:border-slate-800">
                    <TableHead className="w-[120px] h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest pl-6">Image</TableHead>
                    <TableHead className="h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Experience / Activity</TableHead>
                    <TableHead className="h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Category</TableHead>
                    <TableHead className="h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Price</TableHead>
                    <TableHead className="h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Status</TableHead>
                    <TableHead className="h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAddons.map((addon) => (
                    <TableRow key={addon.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10 border-slate-100 dark:border-slate-800 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <div className="h-12 w-20 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 relative border border-slate-100 dark:border-slate-800 flex items-center justify-center">
                          {addon.image_url ? (
                            <img
                              src={getImageUrl(addon.image_url)}
                              alt={addon.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full w-full text-slate-300">
                              <ImageOff className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                        <div className="flex flex-col">
                          <span>{addon.name}</span>
                          <span className="text-xs text-slate-400 font-normal truncate max-w-[260px] mt-0.5">
                            {addon.description || "No description provided."}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {getAddonCategoryBadge(addon.category)}
                      </TableCell>
                      <TableCell className="font-black text-slate-800 dark:text-slate-100 text-sm">₹{addon.price.toLocaleString()}</TableCell>
                      <TableCell className="py-4">
                        <Badge className={cn(
                          "rounded-lg px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider border-none shadow-none",
                          addon.is_active 
                            ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" 
                            : "bg-rose-500/10 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"
                        )}>
                          {addon.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 py-4">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg" onClick={() => handleEditAddonOpen(addon)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg" onClick={() => handleDeleteAddon(addon.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ── TAB 2: ROOM AMENITIES ── */}
        <TabsContent value="room_amenities" className="space-y-5 outline-none">
          <div className="relative max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search room specific amenities..."
              className="pl-11 h-11 rounded-xl border-slate-200 focus-visible:ring-indigo-500 font-medium"
              value={amenitiesSearchQuery}
              onChange={(e) => setAmenitiesSearchQuery(e.target.value)}
            />
          </div>

          {isAmenitiesLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Loading Room Amenities...</span>
            </div>
          ) : filteredRoomAmenities.length === 0 ? (
            <Card className="border-dashed border-2 rounded-3xl bg-slate-50/20">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <LayoutGrid className="h-14 w-14 text-slate-300 dark:text-slate-700 mb-4 opacity-70" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">No Room Amenities</h3>
                <p className="text-muted-foreground text-center mt-1.5 max-w-xs text-sm leading-relaxed">
                  Create room-specific traits like "Balcony View", "Mini Bar", or "Jacuzzi".
                </p>
                <Button className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md" onClick={() => handleCreateAmenityOpen('room')}>
                  Add First Room Amenity
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/20">
                  <TableRow className="border-slate-100 dark:border-slate-800">
                    <TableHead className="w-[100px] h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest pl-6">Icon</TableHead>
                    <TableHead className="h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Amenity Name</TableHead>
                    <TableHead className="h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Category</TableHead>
                    <TableHead className="h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest text-right pr-6">Operations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoomAmenities.map((amenity) => (
                    <TableRow key={amenity.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10 border-slate-100 dark:border-slate-800 transition-colors group">
                      <TableCell className="pl-6 py-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm group-hover:scale-105 transition-transform">
                          {getAmenityIcon(amenity.icon_slug, "w-5 h-5")}
                        </div>
                      </TableCell>
                      <TableCell className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                        <div className="flex flex-col">
                          <span>{amenity.name}</span>
                          {amenity.is_featured && (
                            <div className="flex items-center gap-0.5 mt-0.5 text-amber-500 font-bold">
                              <Star className="w-3 h-3 fill-current" />
                              <span className="text-[9px] uppercase tracking-wider">Featured Priority</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge className={cn(
                          "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border-none shadow-none",
                          AMENITY_CATEGORIES.find(c => c.value === amenity.category)?.color || 'bg-slate-100 text-slate-700'
                        )}>
                          {amenity.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 py-4">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                          onClick={() => handleDeleteAmenity(amenity.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ── TAB 3: PROPERTY WIDE AMENITIES ── */}
        <TabsContent value="hotel_amenities" className="space-y-5 outline-none">
          <div className="relative max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search property wide amenities..."
              className="pl-11 h-11 rounded-xl border-slate-200 focus-visible:ring-emerald-500 font-medium"
              value={amenitiesSearchQuery}
              onChange={(e) => setAmenitiesSearchQuery(e.target.value)}
            />
          </div>

          {isAmenitiesLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Loading Property Amenities...</span>
            </div>
          ) : filteredHotelAmenities.length === 0 ? (
            <Card className="border-dashed border-2 rounded-3xl bg-slate-50/20">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Hotel className="h-14 w-14 text-slate-300 dark:text-slate-700 mb-4 opacity-70" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">No Property Amenities</h3>
                <p className="text-muted-foreground text-center mt-1.5 max-w-xs text-sm leading-relaxed">
                  Create hotel features like "Swimming Pool", "Gym", "Restaurant", or "Valet Parking".
                </p>
                <Button className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md" onClick={() => handleCreateAmenityOpen('hotel')}>
                  Add First Property Amenity
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/20">
                  <TableRow className="border-slate-100 dark:border-slate-800">
                    <TableHead className="w-[100px] h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest pl-6">Icon</TableHead>
                    <TableHead className="h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Amenity Name</TableHead>
                    <TableHead className="h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Category</TableHead>
                    <TableHead className="h-12 text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest text-right pr-6">Operations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHotelAmenities.map((amenity) => (
                    <TableRow key={amenity.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10 border-slate-100 dark:border-slate-800 transition-colors group">
                      <TableCell className="pl-6 py-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm group-hover:scale-105 transition-transform">
                          {getAmenityIcon(amenity.icon_slug, "w-5 h-5")}
                        </div>
                      </TableCell>
                      <TableCell className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                        <div className="flex flex-col">
                          <span>{amenity.name}</span>
                          {amenity.is_featured && (
                            <div className="flex items-center gap-0.5 mt-0.5 text-amber-500 font-bold">
                              <Star className="w-3 h-3 fill-current" />
                              <span className="text-[9px] uppercase tracking-wider">Featured Priority</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge className={cn(
                          "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border-none shadow-none",
                          AMENITY_CATEGORIES.find(c => c.value === amenity.category)?.color || 'bg-slate-100 text-slate-700'
                        )}>
                          {amenity.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 py-4">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                          onClick={() => handleDeleteAmenity(amenity.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

            {/* Dialog for Custom Rule/Amenity */}
            <Dialog open={isAmenityDialogOpen} onOpenChange={setIsAmenityDialogOpen}>
                <DialogContent className="sm:max-w-[460px] bg-background border-border shadow-2xl rounded-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 bg-muted/40 border-b border-border">
                        <DialogTitle className="text-lg font-bold text-foreground">
                            New {amenityFormData.scope === 'room' ? 'Room' : 'Property'} Rule/Amenity
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-1">
                            Create characteristics like "Pet Friendly" or "Swimming Pool".
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-6 space-y-5">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rule / Amenity Name</Label>
                            <Input
                                placeholder={amenityFormData.scope === 'room' ? "e.g. Pet Friendly, No Smoking" : "e.g. Swimming Pool, Free Parking"}
                                value={amenityFormData.name}
                                onChange={(e) => setAmenityFormData(prev => ({ ...prev, name: e.target.value }))}
                                className="h-11 rounded-xl"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Category</Label>
                            <Select
                                value={amenityFormData.category}
                                onValueChange={(val) => setAmenityFormData(prev => ({ ...prev, category: val }))}
                            >
                                <SelectTrigger className="h-11 rounded-xl bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border shadow-2xl">
                                    {AMENITY_CATEGORIES.map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Visual Symbol (Icon)</Label>
                            <div className="max-h-36 overflow-y-auto p-3 bg-muted/40 rounded-xl border border-border scrollbar-thin">
                                <div className="grid grid-cols-8 gap-2">
                                    {Object.keys(ICONS).map(slug => (
                                        <button
                                            key={slug}
                                            type="button"
                                            onClick={() => setAmenityFormData(prev => ({ ...prev, icon_slug: slug }))}
                                            className={cn(
                                                "w-9 h-9 rounded-lg flex items-center justify-center transition-all border border-transparent",
                                                amenityFormData.icon_slug === slug 
                                                    ? "bg-indigo-600 text-white shadow-md scale-105" 
                                                    : "bg-background text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                                            )}
                                        >
                                            {getAmenityIcon(slug, "w-4 h-4")}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-border">
                            <div className="space-y-0.5">
                                <Label className="font-bold text-foreground text-sm">Prominent Highlight</Label>
                                <p className="text-[10px] text-muted-foreground">Display with priority on public pages</p>
                            </div>
                            <Switch
                                checked={amenityFormData.is_featured}
                                onCheckedChange={(checked) => setAmenityFormData(prev => ({ ...prev, is_featured: checked }))}
                                className="data-[state=checked]:bg-indigo-600 scale-90"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-0 flex gap-3">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsAmenityDialogOpen(false)}
                            className="flex-1 h-11 rounded-xl font-bold text-sm"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleCreateAmenity} 
                            disabled={isAmenitySubmitting}
                            className={cn(
                                "flex-[2] h-11 rounded-xl text-white font-bold text-sm shadow-md",
                                amenityFormData.scope === 'room' ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"
                            )}
                        >
                            {isAmenitySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Definition"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    );
}
