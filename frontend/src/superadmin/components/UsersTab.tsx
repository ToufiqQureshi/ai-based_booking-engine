import React, { useState } from 'react';
import { format } from 'date-fns';
import { Search, UserIcon, MoreVertical, XCircle, UserCheck, Trash2, Building2, UserPlus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { toast } from 'sonner';

export function UsersTab() {
    const queryClient = useQueryClient();
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [addOpen, setAddOpen] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '' });

    const addEmployeeMutation = useMutation({
        mutationFn: () => apiClient.post('/superadmin/employees', { ...form, role: 'SUPER_ADMIN' }),
        onSuccess: (res: any) => {
            toast.success(res.message ?? 'Employee added successfully');
            setAddOpen(false);
            setForm({ name: '', email: '', password: '' });
            queryClient.invalidateQueries({ queryKey: ['superadmin-users'] });
        },
        onError: (err: any) => toast.error(err?.message ?? 'Failed to add employee'),
    });

    const { data: users = [], isLoading: isLoadingUsers } = useQuery<any[]>({
        queryKey: ['superadmin-users'],
        queryFn: () => apiClient.get('/superadmin/users')
    });

    const updateRoleMutation = useMutation({
        mutationFn: ({ id, role }: { id: string, role: string }) =>
            apiClient.patch(`/superadmin/users/${id}/role`, { role }),
        onSuccess: () => {
            toast.success("User role updated successfully");
            queryClient.invalidateQueries({ queryKey: ['superadmin-users'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to update user role'),
    });

    const toggleUserStatusMutation = useMutation({
        mutationFn: ({ id, is_active }: { id: string, is_active: boolean }) =>
            apiClient.patch(`/superadmin/users/${id}/status`, { is_active }),
        onSuccess: () => {
            toast.success("User status updated");
            queryClient.invalidateQueries({ queryKey: ['superadmin-users'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to update user status'),
    });

    const deleteUserMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/superadmin/users/${id}`),
        onSuccess: () => {
            toast.success("User permanently deleted");
            queryClient.invalidateQueries({ queryKey: ['superadmin-users'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail || err?.message || 'Failed to delete user'),
    });

    const superAdmins = users.filter((u: any) => u.role === 'SUPER_ADMIN');
    const filteredUsers = superAdmins.filter((u: any) => 
        (u.email?.toLowerCase() || '').includes(userSearchQuery.toLowerCase()) ||
        (u.name?.toLowerCase() || '').includes(userSearchQuery.toLowerCase())
    );

    return (
        <div>
            {/* Add Employee Dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black">
                            <ShieldCheck className="w-5 h-5 text-indigo-600" /> Add Staybooker Employee
                        </DialogTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                            This person will get <strong>SUPER_ADMIN</strong> access and can login at superadmin.staybooker.ai
                        </p>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label className="text-xs font-bold">Full Name</Label>
                            <Input
                                className="mt-1 rounded-xl"
                                placeholder="e.g. Rahul Sharma"
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold">Work Email</Label>
                            <Input
                                className="mt-1 rounded-xl"
                                type="email"
                                placeholder="rahul@staybooker.ai"
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold">Temporary Password</Label>
                            <Input
                                className="mt-1 rounded-xl"
                                type="password"
                                placeholder="Min 8 characters"
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Employee can change this after first login</p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>Cancel</Button>
                        <Button
                            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                            onClick={() => addEmployeeMutation.mutate()}
                            disabled={addEmployeeMutation.isPending || !form.name || !form.email || !form.password}
                        >
                            {addEmployeeMutation.isPending ? 'Adding…' : 'Add Employee'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card className="border-border shadow-sm rounded-2xl p-8 bg-background min-h-[400px]">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-foreground tracking-tight">Staybooker Core Team</h3>
                        <p className="text-sm text-muted-foreground font-medium mt-1">Manage internal Super Admins with full platform access.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                placeholder="Filter by email address..."
                                className="bg-muted/30 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm w-64 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                value={userSearchQuery}
                                onChange={(e) => setUserSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button
                            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 h-10"
                            onClick={() => setAddOpen(true)}
                        >
                            <UserPlus className="w-4 h-4" /> Add Employee
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoadingUsers ? (
                        <div className="col-span-full h-48 flex items-center justify-center">
                            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredUsers.map((u: any) => (
                        <div key={u.id} className="p-6 rounded-2xl border border-border bg-muted/15 hover:border-primary/20 hover:bg-background hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-none transition-all group relative overflow-hidden flex flex-col justify-between">
                            <div>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center shadow-sm border border-border text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                        <UserIcon className="w-6 h-6" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className={`rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider border shadow-none bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-bold`}>
                                            Super Admin
                                        </Badge>
                                        <Badge className={`rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider border shadow-none ${
                                            u.is_active 
                                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-bold' 
                                                : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 font-bold'
                                        }`}>
                                            {u.is_active ? 'Active' : 'Suspended'}
                                        </Badge>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="rounded-xl w-8 h-8 hover:bg-background hover:shadow-sm">
                                                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-border bg-background z-50">
                                                <DropdownMenuLabel className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-3 py-2">User Actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator className="bg-muted/30" />
                                                
                                                <DropdownMenuLabel className="text-[9px] font-black text-muted-foreground uppercase tracking-wider px-3 py-1">Change Role</DropdownMenuLabel>
                                                {['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF'].map((roleOpt) => (
                                                    <DropdownMenuItem 
                                                        key={roleOpt} 
                                                        className={`rounded-xl py-2 cursor-pointer font-semibold text-xs ${u.role === roleOpt ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-foreground'}`}
                                                        onClick={() => updateRoleMutation.mutate({ id: u.id, role: roleOpt })}
                                                    >
                                                        {roleOpt === 'SUPER_ADMIN' ? 'Super Admin' : roleOpt === 'OWNER' ? 'Owner' : roleOpt === 'MANAGER' ? 'Manager' : 'Staff'}
                                                    </DropdownMenuItem>
                                                ))}
                                                
                                                <DropdownMenuSeparator className="bg-muted/30" />
                                                
                                                <DropdownMenuItem 
                                                    className="rounded-xl py-3 cursor-pointer group" 
                                                    onClick={() => toggleUserStatusMutation.mutate({ id: u.id, is_active: !u.is_active })}
                                                >
                                                    {u.is_active ? (
                                                        <>
                                                            <XCircle className="w-4 h-4 mr-3 text-amber-500" />
                                                            <span className="font-bold text-foreground">Suspend Account</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UserCheck className="w-4 h-4 mr-3 text-emerald-600" />
                                                            <span className="font-bold text-foreground">Activate Account</span>
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                                
                                                <DropdownMenuSeparator className="bg-muted/30" />
                                                <DropdownMenuItem 
                                                    className="rounded-xl py-3 cursor-pointer group hover:bg-red-50 text-red-600" 
                                                    onClick={() => {
                                                        if (confirm(`Are you absolutely sure you want to permanently delete user account ${u.email}? This will purge them from Supabase Auth and database levels.`)) {
                                                            deleteUserMutation.mutate(u.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-3 text-red-600" />
                                                    <span className="font-bold">Delete Account</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-bold text-foreground truncate text-sm">{u.name || "Unnamed User"}</p>
                                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                    
                                    <div className="flex items-center gap-1.5 pt-2">
                                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                                        <span className="text-xs font-semibold text-foreground truncate">Staybooker Platform</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                                <span>Joined:</span>
                                <span>{u.created_at ? format(new Date(u.created_at), 'dd MMM yyyy') : 'N/A'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
