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
    Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

import { apiClient } from '@/api/client';
import { useToast } from "@/hooks/use-toast";
import { Amenity } from '@/types/api';
import { cn } from '@/lib/utils';

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
};

const CATEGORIES = [
    { value: 'general', label: 'General', color: 'bg-slate-100 text-slate-700' },
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

    const getIcon = (slug: string) => {
        const Icon = ICONS[slug] || Star;
        return <Icon className="w-5 h-5" />;
    };

    const filteredAmenities = amenities.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             a.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesScope = filterScope === 'all' || a.scope === filterScope;
        return matchesSearch && matchesScope;
    });

    return (
        <div className="min-h-screen bg-[#FDFDFF] p-8 lg:p-12 space-y-10">
            {/* High-Fidelity Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-1 object-cover bg-indigo-600 rounded-full" />
                        <span className="text-xs font-black uppercase tracking-[0.3em] text-indigo-600/60">Asset Management</span>
                    </div>
                    <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-indigo-950">
                        Luxury <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Library</span>
                    </h1>
                    <p className="text-lg text-indigo-900/50 font-medium max-w-xl leading-relaxed">
                        Curate the definitive collection of services and features that define your guest experience.
                    </p>
                </div>
                
                <Button 
                    onClick={() => setIsDialogOpen(true)}
                    className="h-16 px-10 rounded-[24px] bg-indigo-950 hover:bg-indigo-900 text-white font-extrabold text-lg shadow-[0_20px_40px_rgba(30,27,75,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] flex gap-3 group"
                >
                    <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                    Define Amenity
                </Button>
            </div>

            {/* Smart Filters & Search */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-2 relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400 transition-colors group-focus-within:text-indigo-600" />
                    <Input 
                        placeholder="Search luxury library..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-16 pl-14 pr-6 rounded-[24px] border-indigo-100/50 bg-white shadow-sm focus:ring-4 focus:ring-indigo-500/5 text-lg font-medium transition-all"
                    />
                </div>
                <div className="flex gap-4 lg:col-span-2">
                    <div className="flex-1">
                        <Select value={filterScope} onValueChange={(val: any) => setFilterScope(val)}>
                            <SelectTrigger className="h-16 rounded-[24px] border-indigo-100/50 bg-white px-6 font-bold text-indigo-950">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-indigo-400" />
                                    <SelectValue placeholder="Scope" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-indigo-50 shadow-2xl">
                                <SelectItem value="all">Universal Library</SelectItem>
                                <SelectItem value="hotel">Property Assets</SelectItem>
                                <SelectItem value="room">Room Features</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Library Grid */}
            <Card className="rounded-[32px] border-indigo-100/30 bg-white/60 backdrop-blur-xl shadow-2xl shadow-indigo-100/50 overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-indigo-50/30">
                            <TableRow className="border-indigo-50 hover:bg-transparent">
                                <TableHead className="h-16 px-10 text-indigo-900/40 font-black uppercase text-[10px] tracking-widest">Aesthetic</TableHead>
                                <TableHead className="h-16 px-6 text-indigo-900/40 font-black uppercase text-[10px] tracking-widest">Designation</TableHead>
                                <TableHead className="h-16 px-6 text-indigo-900/40 font-black uppercase text-[10px] tracking-widest">Classification</TableHead>
                                <TableHead className="h-16 px-6 text-indigo-900/40 font-black uppercase text-[10px] tracking-widest">Level</TableHead>
                                <TableHead className="h-16 px-6 text-indigo-900/40 font-black uppercase text-[10px] tracking-widest text-right">Operations</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                                            <span className="text-indigo-400 font-bold uppercase tracking-widest text-xs">Synchronizing Library...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredAmenities.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center">
                                        <div className="flex flex-col items-center gap-4 text-indigo-300">
                                            <LayoutGrid className="w-16 h-16 opacity-20" />
                                            <span className="font-bold text-lg">No assets found in current selection.</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredAmenities.map((amenity) => (
                                <TableRow key={amenity.id} className="border-indigo-50/50 hover:bg-indigo-50/20 transition-colors group">
                                    <TableCell className="px-10 py-6">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-white flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                                            {getIcon(amenity.icon_slug)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-6">
                                        <div className="flex flex-col">
                                            <span className="text-lg font-bold text-indigo-950">{amenity.name}</span>
                                            {amenity.is_featured && (
                                                <div className="flex items-center gap-1 mt-1 text-amber-600">
                                                    <Star className="w-3 h-3 fill-current" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Elite Highlight</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-6">
                                        <Badge className={cn(
                                            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-none",
                                            CATEGORIES.find(c => c.value === amenity.category)?.color || 'bg-slate-100'
                                        )}>
                                            {amenity.category}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-6 py-6">
                                        <div className="flex items-center gap-2">
                                            {amenity.scope === 'hotel' ? (
                                                <Hotel className="w-4 h-4 text-indigo-400" />
                                            ) : (
                                                <BedDouble className="w-4 h-4 text-indigo-400" />
                                            )}
                                            <span className="text-sm font-bold text-indigo-900/60 capitalize">{amenity.scope}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-10 py-6 text-right">
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-10 w-10 rounded-xl text-indigo-300 hover:text-rose-600 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                                            onClick={() => handleDelete(amenity.id)}
                                        >
                                            <Trash2 className="w-5 h-5" />
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
                <DialogContent className="sm:max-w-[500px] bg-white/95 backdrop-blur-2xl border-white/40 shadow-[0_30px_70px_rgba(0,0,0,0.15)] rounded-[32px] p-0 overflow-hidden border">
                    <DialogHeader className="p-10 pb-6 bg-gradient-to-br from-indigo-50/80 to-white/20 border-b border-indigo-100/20">
                        <DialogTitle className="text-3xl font-extrabold tracking-tight text-indigo-950">New Amenity Definition</DialogTitle>
                        <DialogDescription className="text-indigo-600/60 font-semibold text-sm mt-2">
                            Create a new standard of luxury for your property.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-10 space-y-8">
                        <div className="space-y-3">
                            <Label className="text-indigo-900/50 font-black uppercase text-[10px] tracking-[0.2em] ml-1">Asset Name</Label>
                            <Input
                                placeholder="e.g. Presidential Lounge"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="h-14 rounded-2xl border-indigo-100/50 bg-white px-5 font-bold text-lg focus:ring-4 focus:ring-indigo-500/5"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <Label className="text-indigo-900/50 font-black uppercase text-[10px] tracking-[0.2em] ml-1">Category</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(val) => setFormData({ ...formData, category: val })}
                                >
                                    <SelectTrigger className="h-14 rounded-2xl border-indigo-100/50 bg-white px-5 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-indigo-50 shadow-2xl">
                                        {CATEGORIES.map(cat => (
                                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-3">
                                <Label className="text-indigo-900/50 font-black uppercase text-[10px] tracking-[0.2em] ml-1">Target Level</Label>
                                <Select
                                    value={formData.scope}
                                    onValueChange={(val) => setFormData({ ...formData, scope: val as 'hotel' | 'room' })}
                                >
                                    <SelectTrigger className="h-14 rounded-2xl border-indigo-100/50 bg-white px-5 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-indigo-50 shadow-2xl">
                                        <SelectItem value="hotel">Property Wide</SelectItem>
                                        <SelectItem value="room">Room Specific</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-indigo-900/50 font-black uppercase text-[10px] tracking-[0.2em] ml-1">Visual Symbol</Label>
                            <div className="grid grid-cols-6 gap-3 p-4 bg-indigo-50/30 rounded-[20px] border border-indigo-100/50">
                                {Object.keys(ICONS).map(slug => (
                                    <button
                                        key={slug}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, icon_slug: slug })}
                                        className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                                            formData.icon_slug === slug 
                                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110" 
                                                : "bg-white text-indigo-400 hover:text-indigo-600"
                                        )}
                                    >
                                        {getIcon(slug)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-indigo-50/50 p-6 rounded-[24px] border border-indigo-100/40 group hover:border-indigo-300 transition-colors">
                            <div className="space-y-1">
                                <Label className="font-extrabold text-indigo-950">Prominent Highlight</Label>
                                <p className="text-xs text-indigo-900/40 font-medium">Display with priority on public pages</p>
                            </div>
                            <Switch
                                checked={formData.is_featured}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                                className="data-[state=checked]:bg-indigo-600"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-10 pt-0 flex gap-4">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsDialogOpen(false)}
                            className="flex-1 h-16 rounded-2xl font-bold text-indigo-900/50 hover:text-indigo-950"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleCreate} 
                            disabled={isSubmitting}
                            className="flex-[2] h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg shadow-xl shadow-indigo-100 transition-all"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Finalize Asset"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
