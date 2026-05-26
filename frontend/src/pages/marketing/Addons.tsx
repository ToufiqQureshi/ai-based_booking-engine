import { useState, useCallback, useEffect } from 'react';
import { 
    Plus, Search, Loader2, Sparkles, Pencil, Trash2, ImageOff, 
    Wifi, Tv, Snowflake, Waves, Dumbbell, Car, Utensils, Star, 
    ShieldCheck, Wine, Bath, ShowerHead, Flame, Baby, Languages, 
    ConciergeBell, WashingMachine, Key, Wind, CigaretteOff, PawPrint, 
    VolumeX, Maximize, Briefcase, Map, LayoutGrid, Hotel, BedDouble, Filter,
    Coffee
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { AddOn, Amenity } from '@/types/api';
import { AddonDialog } from '@/components/addons/AddonDialog';
import { getImageUrl, cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
    const [activeTab, setActiveTab] = useState('services');

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
                description: 'Failed to load add-ons. Please try again.',
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
            toast({ title: 'Deleted', description: 'Add-on deleted successfully.' });
            fetchAddons();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to delete add-on.',
            });
        }
    };

    const filteredAddons = addons.filter(addon =>
        addon.name.toLowerCase().includes(addonsSearchQuery.toLowerCase()) ||
        addon.category.toLowerCase().includes(addonsSearchQuery.toLowerCase())
    );

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

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Add-ons & Services</h1>
                    <p className="text-muted-foreground">Manage extra guest services, room rules, and property-wide amenities.</p>
                </div>
                {activeTab === 'services' && (
                    <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-100 dark:shadow-none" onClick={handleCreateAddonOpen}>
                        <Plus className="h-4 w-4" />
                        Add Service
                    </Button>
                )}
                {activeTab === 'room_amenities' && (
                    <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-100 dark:shadow-none" onClick={() => handleCreateAmenityOpen('room')}>
                        <Plus className="h-4 w-4" />
                        Add Room Amenity
                    </Button>
                )}
                {activeTab === 'hotel_amenities' && (
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-100 dark:shadow-none" onClick={() => handleCreateAmenityOpen('hotel')}>
                        <Plus className="h-4 w-4" />
                        Add Property Amenity
                    </Button>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-3 max-w-xl h-11 bg-muted/60 p-1 rounded-xl">
                    <TabsTrigger value="services" className="rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 mr-2" /> Add-on Services
                    </TabsTrigger>
                    <TabsTrigger value="room_amenities" className="rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                        <BedDouble className="w-3.5 h-3.5 mr-2" /> Room Amenities
                    </TabsTrigger>
                    <TabsTrigger value="hotel_amenities" className="rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">
                        <Hotel className="w-3.5 h-3.5 mr-2" /> Property Amenities
                    </TabsTrigger>
                </TabsList>

                {/* ── TAB 1: ADD-ON SERVICES ── */}
                <TabsContent value="services" className="space-y-4 outline-none">
                    <AddonDialog
                        open={isAddonDialogOpen}
                        onOpenChange={setIsAddonDialogOpen}
                        onSuccess={fetchAddons}
                        initialData={selectedAddon}
                    />

                    <div className="flex items-center justify-between">
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search services..."
                                className="pl-10 h-10 rounded-xl"
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
                        <Card className="border-dashed rounded-2xl">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Sparkles className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                                <h3 className="text-lg font-medium">No Services Yet</h3>
                                <p className="text-muted-foreground text-center mt-1 max-w-xs text-sm">
                                    Enhance guest experience by adding extra services like breakfast, airport transfer or spa.
                                </p>
                                <Button className="mt-4 bg-blue-600 hover:bg-blue-700 rounded-xl" onClick={handleCreateAddonOpen}>
                                    Add First Service
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="w-[100px] h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider pl-6">Image</TableHead>
                                        <TableHead className="h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider">Name</TableHead>
                                        <TableHead className="h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider">Category</TableHead>
                                        <TableHead className="h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider">Price</TableHead>
                                        <TableHead className="h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider">Status</TableHead>
                                        <TableHead className="h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAddons.map((addon) => (
                                        <TableRow key={addon.id} className="hover:bg-muted/10 border-border">
                                            <TableCell className="pl-6 py-3.5">
                                                <div className="h-10 w-16 rounded-xl overflow-hidden bg-muted relative border border-border">
                                                    {addon.image_url ? (
                                                        <img
                                                            src={getImageUrl(addon.image_url)}
                                                            alt={addon.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex items-center justify-center h-full w-full text-muted-foreground">
                                                            <ImageOff className="h-4 w-4" />
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-semibold text-sm text-foreground">
                                                <div>{addon.name}</div>
                                                <div className="text-xs text-muted-foreground truncate max-w-[200px] font-normal mt-0.5">
                                                    {addon.description}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="uppercase text-[9px] font-bold tracking-wider rounded-md border-none bg-muted/60">
                                                    {addon.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-bold text-sm">₹{addon.price.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Badge variant={addon.is_active ? 'default' : 'destructive'} className={addon.is_active ? "bg-green-500 hover:bg-green-600 rounded-md" : "rounded-md"}>
                                                    {addon.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600" onClick={() => handleEditAddonOpen(addon)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/20" onClick={() => handleDeleteAddon(addon.id)}>
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
                <TabsContent value="room_amenities" className="space-y-4 outline-none">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search room specific amenities..."
                            className="pl-10 h-10 rounded-xl"
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
                        <Card className="border-dashed rounded-2xl">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                                <h3 className="text-lg font-medium">No Room Amenities</h3>
                                <p className="text-muted-foreground text-center mt-1 max-w-xs text-sm">
                                    Create room traits like "Pet Friendly", "Mini Bar", or "Balcony".
                                </p>
                                <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl" onClick={() => handleCreateAmenityOpen('room')}>
                                    Add First Room Amenity
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="w-[80px] h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider pl-6">Icon</TableHead>
                                        <TableHead className="h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider">Name</TableHead>
                                        <TableHead className="h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider">Category</TableHead>
                                        <TableHead className="h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider text-right pr-6">Operations</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRoomAmenities.map((amenity) => (
                                        <TableRow key={amenity.id} className="hover:bg-muted/10 border-border group">
                                            <TableCell className="pl-6 py-3.5">
                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-slate-900/40 border border-indigo-100/50 dark:border-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm group-hover:scale-105 transition-transform">
                                                    {getAmenityIcon(amenity.icon_slug, "w-4.5 h-4.5")}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-semibold text-sm text-foreground">
                                                <div className="flex flex-col">
                                                    <span>{amenity.name}</span>
                                                    {amenity.is_featured && (
                                                        <div className="flex items-center gap-0.5 mt-0.5 text-amber-500">
                                                            <Star className="w-2.5 h-2.5 fill-current" />
                                                            <span className="text-[9px] font-bold uppercase tracking-wider">Highlight</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn(
                                                    "px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border-none shadow-none",
                                                    AMENITY_CATEGORIES.find(c => c.value === amenity.category)?.color || 'bg-muted'
                                                )}>
                                                    {amenity.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
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
                <TabsContent value="hotel_amenities" className="space-y-4 outline-none">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search property wide amenities..."
                            className="pl-10 h-10 rounded-xl"
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
                        <Card className="border-dashed rounded-2xl">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Hotel className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                                <h3 className="text-lg font-medium">No Property Amenities</h3>
                                <p className="text-muted-foreground text-center mt-1 max-w-xs text-sm">
                                    Create hotel features like "Swimming Pool", "Gym", "Restaurant", or "Free Parking".
                                </p>
                                <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl" onClick={() => handleCreateAmenityOpen('hotel')}>
                                    Add First Property Amenity
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="w-[80px] h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider pl-6">Icon</TableHead>
                                        <TableHead className="h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider">Name</TableHead>
                                        <TableHead className="h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider">Category</TableHead>
                                        <TableHead className="h-11 text-xs font-bold uppercase text-muted-foreground tracking-wider text-right pr-6">Operations</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredHotelAmenities.map((amenity) => (
                                        <TableRow key={amenity.id} className="hover:bg-muted/10 border-border group">
                                            <TableCell className="pl-6 py-3.5">
                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-slate-900/40 border border-emerald-100/50 dark:border-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm group-hover:scale-105 transition-transform">
                                                    {getAmenityIcon(amenity.icon_slug, "w-4.5 h-4.5")}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-semibold text-sm text-foreground">
                                                <div className="flex flex-col">
                                                    <span>{amenity.name}</span>
                                                    {amenity.is_featured && (
                                                        <div className="flex items-center gap-0.5 mt-0.5 text-amber-500">
                                                            <Star className="w-2.5 h-2.5 fill-current" />
                                                            <span className="text-[9px] font-bold uppercase tracking-wider">Highlight</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn(
                                                    "px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border-none shadow-none",
                                                    AMENITY_CATEGORIES.find(c => c.value === amenity.category)?.color || 'bg-muted'
                                                )}>
                                                    {amenity.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
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
        </div>
    );
}
