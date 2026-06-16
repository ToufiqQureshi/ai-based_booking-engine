import { useState, useEffect } from 'react';
import { 
    Loader2, 
    Plus, 
    Trash2, 
    Wifi, 
    Tv, 
    Coffee, 
    Snowflake, 
    Waves, 
    Dumbbell, 
    Car, 
    Utensils, 
    Star, 
    ShieldCheck, 
    Sparkles, 
    LayoutGrid, 
    Hotel, 
    BedDouble,
    Search,
    Filter,
    Wine,
    Bath,
    ShowerHead,
    Flame,
    Baby,
    Languages,
    ConciergeBell,
    WashingMachine,
    Key,
    Wind,
    CigaretteOff,
    PawPrint,
    VolumeX,
    Maximize,
    Briefcase,
    Map
} from 'lucide-react';
import { cn } from '@/core/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Badge } from '@/components/ui/badge';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';

import { apiClient } from '@/core/api/client';
import { useToast } from "@/core/hooks/use-toast";
import { Amenity } from '@/core/types/api';
import { PageShell } from '@/components/layout/PageShell';

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

const CATEGORIES = [
    { value: 'general', label: 'General', color: 'bg-muted text-foreground' },
    { value: 'tech', label: 'Technology', color: 'bg-blue-100 text-blue-700' },
    { value: 'wellness', label: 'Wellness', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'dining', label: 'Dining', color: 'bg-orange-100 text-orange-700' },
    { value: 'room', label: 'Room Feature', color: 'bg-indigo-100 text-indigo-700' },
];

export default function Amenities() {
    const { toast } = useToast();
    const [amenities, setAmenities] = useState<Amenity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterScope, setFilterScope] = useState<'all' | 'hotel' | 'room'>('all');

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        icon_slug: 'star',
        category: 'general',
        scope: 'room' as 'hotel' | 'room',
        is_featured: false
    });

    useEffect(() => {
        fetchAmenities();
    }, []);

    const fetchAmenities = async () => {
        setIsLoading(true);
        try {
            const data = await apiClient.get<Amenity[]>('/amenities');
            // If empty, try seeding defaults
            if (data.length === 0) {
                await apiClient.post('/amenities/seed-defaults');
                const seeded = await apiClient.get<Amenity[]>('/amenities');
                setAmenities(seeded);
            } else {
                setAmenities(data);
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Connection Error", description: "Failed to synchronize luxury library." });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!formData.name) return;
        setIsSubmitting(true);
        try {
            const newAmenity = await apiClient.post<Amenity>('/amenities', formData);
            setAmenities([...amenities, newAmenity]);
            setIsDialogOpen(false);
            setFormData({ name: '', icon_slug: 'star', category: 'general', scope: 'room', is_featured: false });
            toast({ title: "Sanctuary Enhanced", description: "Your luxury library has been expanded." });
        } catch (error) {
            toast({ variant: "destructive", title: "Curation Error", description: "Failed to create amenity definition." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await apiClient.delete(`/amenities/${id}`);
            setAmenities(amenities.filter(a => a.id !== id));
            toast({ title: "Inventory Updated", description: "The amenity has been permanently removed." });
        } catch (error) {
            toast({ variant: "destructive", title: "Operation Failed", description: "Failed to de-list amenity." });
        }
    };

    const getIcon = (slug: string, className = "w-4 h-4") => {
        const Icon = ICONS[slug] || Star;
        return <Icon className={className} />;
    };

    const filteredAmenities = amenities.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             a.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesScope = filterScope === 'all' || a.scope === filterScope;
        return matchesSearch && matchesScope;
    });

    return (
        <PageShell
            title="Amenity Library"
            subtitle="Curate services and features that define your guest experience."
            actions={
                <Button
                    onClick={() => setIsDialogOpen(true)}
                    className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm flex gap-2 group"
                >
                    <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />
                    Add Amenity
                </Button>
            }
        >
            {/* Smart Filters */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                <div className="lg:col-span-2 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 transition-colors group-focus-within:text-indigo-600" />
                    <Input 
                        placeholder="Search luxury library..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-11 pl-11 pr-4 rounded-xl border-indigo-100/50 bg-background shadow-sm focus:ring-2 focus:ring-indigo-500/5 text-sm font-medium transition-all"
                    />
                </div>
                <div className="flex gap-3 lg:col-span-2">
                    <div className="flex-1">
                        <Select value={filterScope} onValueChange={(val: any) => setFilterScope(val)}>
                            <SelectTrigger className="h-11 rounded-xl border-indigo-100/50 bg-background px-4 font-semibold text-sm">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-3.5 h-3.5 text-indigo-400" />
                                    <SelectValue placeholder="Scope" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-indigo-50 shadow-xl">
                                <SelectItem value="all">Universal Library</SelectItem>
                                <SelectItem value="hotel">Property Assets</SelectItem>
                                <SelectItem value="room">Room Features</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Library Grid */}
            <Card className="rounded-2xl border-border bg-card backdrop-blur-xl shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-indigo-50/20">
                            <TableRow className="border-indigo-50/50 hover:bg-transparent">
                                <TableHead className="h-11 px-6 text-indigo-900/40 font-bold uppercase text-[10px] tracking-wider">Aesthetic</TableHead>
                                <TableHead className="h-11 px-4 text-indigo-900/40 font-bold uppercase text-[10px] tracking-wider">Designation</TableHead>
                                <TableHead className="h-11 px-4 text-indigo-900/40 font-bold uppercase text-[10px] tracking-wider">Classification</TableHead>
                                <TableHead className="h-11 px-4 text-indigo-900/40 font-bold uppercase text-[10px] tracking-wider">Level</TableHead>
                                <TableHead className="h-11 px-6 text-indigo-900/40 font-bold uppercase text-[10px] tracking-wider text-right">Operations</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-48 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                            <span className="text-indigo-400 font-bold uppercase tracking-wider text-[10px]">Synchronizing Library...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredAmenities.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-48 text-center">
                                        <div className="flex flex-col items-center gap-3 text-indigo-300">
                                            <LayoutGrid className="w-12 h-12 opacity-25" />
                                            <span className="font-semibold text-sm">No assets found in current selection.</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredAmenities.map((amenity) => (
                                <TableRow key={amenity.id} className="border-indigo-50/30 hover:bg-indigo-50/10 transition-colors group">
                                    <TableCell className="px-6 py-3.5">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-white flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-105 transition-transform">
                                            {getIcon(amenity.icon_slug, "w-4.5 h-4.5")}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3.5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-indigo-950">{amenity.name}</span>
                                            {amenity.is_featured && (
                                                <div className="flex items-center gap-0.5 mt-0.5 text-amber-600">
                                                    <Star className="w-2.5 h-2.5 fill-current" />
                                                    <span className="text-[9px] font-bold uppercase tracking-wider">Elite Highlight</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3.5">
                                        <Badge className={cn(
                                            "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border-none shadow-none",
                                            CATEGORIES.find(c => c.value === amenity.category)?.color || 'bg-muted'
                                        )}>
                                            {amenity.category}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-4 py-3.5">
                                        <div className="flex items-center gap-1.5">
                                            {amenity.scope === 'hotel' ? (
                                                <Hotel className="w-3.5 h-3.5 text-indigo-400" />
                                            ) : (
                                                <BedDouble className="w-3.5 h-3.5 text-indigo-400" />
                                            )}
                                            <span className="text-xs font-semibold text-indigo-900/60 capitalize">{amenity.scope}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-3.5 text-right">
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-8 w-8 rounded-lg text-indigo-300 hover:text-rose-600 hover:bg-rose-50 transition-all opacity-40 group-hover:opacity-100"
                                            onClick={() => handleDelete(amenity.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Modern Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[460px] bg-background border-border shadow-2xl rounded-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 bg-gradient-to-br from-indigo-50/50 to-white border-b border-indigo-100/10">
                        <DialogTitle className="text-xl font-bold tracking-tight text-indigo-950">New Amenity Definition</DialogTitle>
                        <DialogDescription className="text-indigo-600/60 font-semibold text-xs mt-1">
                            Create a new standard of luxury for your property.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-6 space-y-5">
                        <div className="space-y-2">
                            <Label className="text-indigo-900/50 font-bold uppercase text-[9px] tracking-wider ml-0.5">Asset Name</Label>
                            <Input
                                placeholder="e.g. Presidential Lounge"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="h-11 rounded-xl border-border bg-background px-4 font-semibold text-sm focus:ring-2 focus:ring-indigo-500/5"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-indigo-900/50 font-bold uppercase text-[9px] tracking-wider ml-0.5">Category</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(val) => setFormData({ ...formData, category: val })}
                                >
                                    <SelectTrigger className="h-11 rounded-xl border-border bg-background px-4 font-semibold text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-indigo-50 shadow-2xl">
                                        {CATEGORIES.map(cat => (
                                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-indigo-900/50 font-bold uppercase text-[9px] tracking-wider ml-0.5">Target Level</Label>
                                <Select
                                    value={formData.scope}
                                    onValueChange={(val) => setFormData({ ...formData, scope: val as 'hotel' | 'room' })}
                                >
                                    <SelectTrigger className="h-11 rounded-xl border-border bg-background px-4 font-semibold text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-indigo-50 shadow-2xl">
                                        <SelectItem value="hotel">Property Wide</SelectItem>
                                        <SelectItem value="room">Room Specific</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-indigo-900/50 font-bold uppercase text-[9px] tracking-wider ml-0.5">Visual Symbol</Label>
                            <div className="max-h-36 overflow-y-auto p-3 bg-indigo-50/20 rounded-xl border border-indigo-100/30 scrollbar-thin">
                                <div className="grid grid-cols-8 gap-2">
                                    {Object.keys(ICONS).map(slug => (
                                        <button
                                            key={slug}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, icon_slug: slug })}
                                            className={cn(
                                                "w-9 h-9 rounded-lg flex items-center justify-center transition-all border border-transparent",
                                                formData.icon_slug === slug 
                                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105" 
                                                    : "bg-background text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50"
                                            )}
                                        >
                                            {getIcon(slug, "w-4 h-4")}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/30 group hover:border-indigo-200/50 transition-colors">
                            <div className="space-y-0.5">
                                <Label className="font-bold text-indigo-950 text-sm">Prominent Highlight</Label>
                                <p className="text-[10px] text-indigo-900/40 font-medium">Display with priority on public pages</p>
                            </div>
                            <Switch
                                checked={formData.is_featured}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                                className="data-[state=checked]:bg-indigo-600 scale-90"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-0 flex gap-3">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsDialogOpen(false)}
                            className="flex-1 h-11 rounded-xl font-bold text-sm text-indigo-900/50 hover:text-indigo-950 hover:bg-slate-50"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleCreate} 
                            disabled={isSubmitting}
                            className="flex-[2] h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-100 transition-all"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Finalize Asset"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    );
}
