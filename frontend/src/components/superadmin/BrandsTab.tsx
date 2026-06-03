import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Users,
  Plus,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
  Search,
  CheckCircle,
  Network,
  X,
  Link2,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

interface BrandsTabProps {
  hotels: any[];
  users: any[];
}

export function BrandsTab({ hotels, users }: BrandsTabProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState('');
  
  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isLinkOpen, setIsLinkOpen] = React.useState(false);
  const [selectedBrand, setSelectedBrand] = React.useState<any | null>(null);

  // Form States
  const [brandName, setBrandName] = React.useState('');
  const [brandSlug, setBrandSlug] = React.useState('');
  const [brandLogo, setBrandLogo] = React.useState('');

  // Linkage States
  const [selectedHotelIds, setSelectedHotelIds] = React.useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);

  // Fetch brand list
  const { data: brands = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['superadmin-chains'],
    queryFn: () => apiClient.get('/superadmin/chains'),
  });

  // Create Brand Mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; logo_url?: string }) => 
      apiClient.post('/superadmin/chains', data),
    onSuccess: () => {
      toast.success("Brand group created successfully");
      setIsCreateOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['superadmin-chains'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create brand group");
    }
  });

  // Update Brand Mutation
  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string; slug: string; logo_url?: string }) => 
      apiClient.put(`/superadmin/chains/${data.id}`, { name: data.name, slug: data.slug, logo_url: data.logo_url }),
    onSuccess: () => {
      toast.success("Brand details updated");
      setIsEditOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['superadmin-chains'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update brand group");
    }
  });

  // Delete Brand Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/superadmin/chains/${id}`),
    onSuccess: () => {
      toast.success("Brand deleted successfully");
      refetch();
      queryClient.invalidateQueries({ queryKey: ['superadmin-chains'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete brand");
    }
  });

  // Link Entities Mutation
  const linkMutation = useMutation({
    mutationFn: (data: { id: string; hotel_ids: string[]; user_ids: string[] }) => 
      apiClient.post(`/superadmin/chains/${data.id}/link`, { hotel_ids: data.hotel_ids, user_ids: data.user_ids }),
    onSuccess: () => {
      toast.success("Linked hotels and managers updated successfully");
      setIsLinkOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['superadmin-chains'] });
      // Invalidate hotels/users list as their chain relations changed
      queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-users'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update brand linkages");
    }
  });

  const openCreateDialog = () => {
    setBrandName('');
    setBrandSlug('');
    setBrandLogo('');
    setIsCreateOpen(true);
  };

  const openEditDialog = (brand: any) => {
    setSelectedBrand(brand);
    setBrandName(brand.name);
    setBrandSlug(brand.slug);
    setBrandLogo(brand.logo_url || '');
    setIsEditOpen(true);
  };

  const openLinkDialog = (brand: any) => {
    setSelectedBrand(brand);
    // Pre-populate currently linked hotel IDs and user IDs
    setSelectedHotelIds(brand.hotels.map((h: any) => h.id));
    setSelectedUserIds(brand.users.map((u: any) => u.id));
    setIsLinkOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName || !brandSlug) return;
    createMutation.mutate({ name: brandName, slug: brandSlug, logo_url: brandLogo || undefined });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand || !brandName || !brandSlug) return;
    updateMutation.mutate({ id: selectedBrand.id, name: brandName, slug: brandSlug, logo_url: brandLogo || undefined });
  };

  const handleLinkSubmit = () => {
    if (!selectedBrand) return;
    linkMutation.mutate({
      id: selectedBrand.id,
      hotel_ids: selectedHotelIds,
      user_ids: selectedUserIds
    });
  };

  const filteredBrands = brands.filter((b: any) => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get eligible users to link: Owner, Manager, or Super Admin
  const eligibleUsers = users.filter((u: any) => u.role === 'OWNER' || u.role === 'MANAGER');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Brand Governance Groups</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure multi-property chains and assign property managers.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search brands..."
              className="pl-9 pr-4 py-2 w-64 rounded-xl text-xs h-9 bg-muted/40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="rounded-xl h-9">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button onClick={openCreateDialog} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 px-4 text-xs font-bold gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" /> Create Brand
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-sm rounded-2xl">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-semibold text-xs py-3 pl-6">Brand Name</TableHead>
                <TableHead className="font-semibold text-xs">Slug</TableHead>
                <TableHead className="font-semibold text-xs text-center">Linked Properties</TableHead>
                <TableHead className="font-semibold text-xs text-center">Brand Managers</TableHead>
                <TableHead className="font-semibold text-xs text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <Loader2 className="h-6 w-6 text-indigo-600 animate-spin mx-auto mb-2" />
                    <span className="text-xs text-muted-foreground">Fetching brand groups...</span>
                  </TableCell>
                </TableRow>
              ) : filteredBrands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground text-sm italic">
                    No brand groups found. Click "Create Brand" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredBrands.map((b) => (
                  <TableRow key={b.id} className="hover:bg-muted/15 transition-colors">
                    <TableCell className="py-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          {b.logo_url ? (
                            <img src={b.logo_url} alt="" className="h-full w-full object-cover rounded-lg" />
                          ) : (
                            <Network className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground">{b.name}</span>
                          <span className="text-[10px] text-muted-foreground">ID: {b.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-xs text-muted-foreground">{b.slug}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                        {b.hotels.length} hotels
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                        {b.users.length} managers
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openLinkDialog(b)}
                          className="h-8 text-xs font-semibold gap-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600"
                        >
                          <Link2 className="w-3.5 h-3.5" /> Linkages
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(b)}
                          className="h-8 text-xs font-semibold gap-1.5 hover:bg-muted/40"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete ${b.name}? This will unlink all its hotels and users.`)) {
                              deleteMutation.mutate(b.id);
                            }
                          }}
                          className="h-8 text-xs font-semibold gap-1.5 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CREATE BRAND DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-2xl border-border bg-background max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground">Create Brand Group</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Register a new parent brand chain.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Brand Name</label>
              <Input
                placeholder="e.g. Revmerito Luxury Collection"
                required
                value={brandName}
                onChange={(e) => {
                  setBrandName(e.target.value);
                  setBrandSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                }}
                className="rounded-xl border-border text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Slug (Unique identifier)</label>
              <Input
                placeholder="e.g. revmerito-luxury"
                required
                value={brandSlug}
                onChange={(e) => setBrandSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                className="rounded-xl border-border text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Logo URL (Optional)</label>
              <Input
                placeholder="e.g. https://domain.com/logo.png"
                value={brandLogo}
                onChange={(e) => setBrandLogo(e.target.value)}
                className="rounded-xl border-border text-xs"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-xl text-xs h-10">Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-5 text-xs font-bold">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Brand"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT BRAND DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-2xl border-border bg-background max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground">Edit Brand details</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Update brand group details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Brand Name</label>
              <Input
                placeholder="e.g. Revmerito Luxury Collection"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="rounded-xl border-border text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Slug (Unique)</label>
              <Input
                placeholder="e.g. revmerito-luxury"
                required
                value={brandSlug}
                onChange={(e) => setBrandSlug(e.target.value)}
                className="rounded-xl border-border text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Logo URL</label>
              <Input
                placeholder="e.g. https://domain.com/logo.png"
                value={brandLogo}
                onChange={(e) => setBrandLogo(e.target.value)}
                className="rounded-xl border-border text-xs"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)} className="rounded-xl text-xs h-10">Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-5 text-xs font-bold">
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MANAGE LINKAGES DIALOG */}
      <Dialog open={isLinkOpen} onOpenChange={setIsLinkOpen}>
        <DialogContent className="rounded-2xl border-border bg-background max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0 pb-3 border-b">
            <DialogTitle className="text-lg font-black text-foreground">Linkages: {selectedBrand?.name}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Select hotels and managers linked to this brand group.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4 space-y-6 px-1">
            
            {/* Hotels Multi-Select */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-4.5 h-4.5 text-indigo-500" />
                Select Linked Properties ({selectedHotelIds.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto p-3 border rounded-xl bg-muted/10">
                {hotels.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic col-span-2">No properties registered on the platform.</p>
                ) : (
                  hotels.map((h: any) => {
                    const isChecked = selectedHotelIds.includes(h.id);
                    return (
                      <div key={h.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <Checkbox
                          id={`link-hotel-${h.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedHotelIds([...selectedHotelIds, h.id]);
                            } else {
                              setSelectedHotelIds(selectedHotelIds.filter(id => id !== h.id));
                            }
                          }}
                        />
                        <label htmlFor={`link-hotel-${h.id}`} className="text-xs font-semibold text-foreground cursor-pointer truncate flex-1">
                          {h.name} <span className="text-[10px] text-muted-foreground">({h.slug})</span>
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Users Multi-Select */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="w-4.5 h-4.5 text-emerald-500" />
                Select Brand Managers ({selectedUserIds.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto p-3 border rounded-xl bg-muted/10">
                {eligibleUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic col-span-2">No owners or manager accounts registered.</p>
                ) : (
                  eligibleUsers.map((u: any) => {
                    const isChecked = selectedUserIds.includes(u.id);
                    return (
                      <div key={u.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <Checkbox
                          id={`link-user-${u.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUserIds([...selectedUserIds, u.id]);
                            } else {
                              setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                            }
                          }}
                        />
                        <label htmlFor={`link-user-${u.id}`} className="text-xs font-semibold text-foreground cursor-pointer truncate flex-1">
                          {u.name} <span className="text-[10px] text-muted-foreground">({u.email})</span>
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          <DialogFooter className="shrink-0 pt-3 border-t">
            <Button variant="ghost" onClick={() => setIsLinkOpen(false)} className="rounded-xl text-xs h-10">Cancel</Button>
            <Button onClick={handleLinkSubmit} disabled={linkMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-6 text-xs font-bold gap-1.5">
              {linkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Linkages"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
