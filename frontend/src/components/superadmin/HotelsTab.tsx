import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Search, Loader2, Building2, Plus, Shield, Users, Mail, Phone, Calendar, Globe, Trash2, CheckCircle2, Lock, Tag, MapPin, Edit, Settings2, BarChart3, Radio, RefreshCw, Smartphone, Key, Star, LayoutGrid, CheckSquare, XSquare, MessageSquare, ListFilter, PlayCircle, Filter, Download, Zap, UploadCloud, ChevronRight, Save, LayoutTemplate, Activity, AlertTriangle, ShieldCheck, FileText, Send, Eye, X, Crown, Clock, Copy, ArrowRight, UserCheck, CheckCircle, SlidersHorizontal, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from '@/components/ui/separator';
import { TabsContent, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

export function HotelsTab(props: any) {
  const {
    user, logout, authLoading, theme, toggleTheme, selectedWorkspaceHotel,
    setSelectedWorkspaceHotel, workspaceTab, setWorkspaceTab, workspacePermissions, setWorkspacePermissions, editedPlanFeatures,
    setEditedPlanFeatures, searchQuery, setSearchQuery, userSearchQuery, setUserSearchQuery, selectedQuotaHotel,
    setSelectedQuotaHotel, whatsappCredits, setWhatsappCredits, smsCredits, setSmsCredits, aiUsageLimit,
    setAiUsageLimit, broadcastTitle, setBroadcastTitle, broadcastMessage, setBroadcastMessage, broadcastType,
    setBroadcastType, isAddUserOpen, setIsAddUserOpen, addUserEmail, setAddUserEmail, addUserName,
    setAddUserName, addUserPassword, setAddUserPassword, addUserRole, setAddUserRole, statusFilter,
    setStatusFilter, planFilter, setPlanFilter, featureFilterAI, setFeatureFilterAI, featureFilterBot,
    setFeatureFilterBot, featureFilterRates, setFeatureFilterRates, detailHotel, setDetailHotel, selectedSubHotel,
    setSelectedSubHotel, subPlanName, setSubPlanName, subStatus, setSubStatus, subEndDate,
    setSubEndDate, auditSearchQuery, setAuditSearchQuery, auditActionFilter, setAuditActionFilter, toast,
    queryClient, hotels, isLoading, refetch, users, isLoadingUsers,
    auditLogs, isLoadingAudit, refetchAudit, broadcasts, isLoadingBroadcasts, refetchBroadcasts,
    planFeatures, isLoadingPlanFeatures, refetchPlanFeatures, activeDetailHotel, updateWorkspacePermissionsMutation, toggleFeatureMutation,
    updateQuotaMutation, deletePropertyMutation, toggleSubMutation, handleSaveEditedPlanFeatures, savePlanFeaturesMutation, createBroadcastMutation,
    deleteBroadcastMutation, addUserMutation, updateUserStatusMutation, toggleUserStatusMutation, deleteUserMutation, getInitials,
    filteredHotels, filteredAuditLogs, uniqueAuditActions
  } = props;
  return (
    <>
<TabsContent value="hotels" className="mt-0">
                        {selectedWorkspaceHotel ? (
                            <div className="space-y-6">
                                {/* Workspace Header */}
                                <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/20 dark:bg-slate-900/40 p-6 rounded-2xl border border-border">
                                    <div className="flex items-center gap-4">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSelectedWorkspaceHotel(null)}
                                            className="rounded-xl border-border bg-background hover:bg-muted/50 w-10 h-10 shrink-0"
                                        >
                                            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                                        </Button>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-2xl font-black text-foreground tracking-tight">
                                                    {selectedWorkspaceHotel.name}
                                                </h2>
                                                <Badge className={`rounded-lg px-2.5 py-0.5 font-black text-[9px] uppercase tracking-widest border ${
                                                    selectedWorkspaceHotel.is_active 
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                                    : 'bg-red-50 text-red-650 border-red-150 dark:bg-red-950/40 dark:text-red-400'
                                                }`}>
                                                    {selectedWorkspaceHotel.is_active ? 'Active' : 'Locked'}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground font-mono mt-0.5">slug: {selectedWorkspaceHotel.slug}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 shadow-md transition-all flex items-center gap-2"
                                            onClick={() => impersonateMutation.mutate(selectedWorkspaceHotel.id)}
                                            disabled={impersonateMutation.isPending}
                                        >
                                            <UserCheck className="w-4 h-4" /> Impersonate Hotelier
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="rounded-xl border-border bg-background font-bold h-11 px-6 hover:bg-muted/30"
                                            onClick={() => setSelectedWorkspaceHotel(null)}
                                        >
                                            Exit Workspace
                                        </Button>
                                    </div>
                                </div>

                                {/* Workspace Sub-tabs Navigation */}
                                <div className="flex border-b border-border gap-2 overflow-x-auto">
                                    {[
                                        { id: 'overview', name: 'Overview & Subscription', icon: Sliders },
                                        { id: 'users', name: 'User Accounts', icon: Users },
                                        { id: 'permissions', name: 'Role Permissions Matrix', icon: Lock },
                                        { id: 'features', name: 'Feature Lock Controls', icon: SlidersHorizontal }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setWorkspaceTab(tab.id as any)}
                                            className={cn(
                                                "flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-sm transition-all focus:outline-none whitespace-nowrap",
                                                workspaceTab === tab.id
                                                    ? "border-indigo-600 text-indigo-600"
                                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <tab.icon className="w-4 h-4" />
                                            {tab.name}
                                        </button>
                                    ))}
                                </div>

                                {/* Workspace Sub-tabs Contents */}
                                {workspaceTab === 'overview' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        {/* Subscription Controls */}
                                        <Card className="border border-border rounded-2xl p-6 bg-background lg:col-span-2 space-y-6">
                                            <div>
                                                <h3 className="text-lg font-bold text-foreground">Billing & Plan Configuration</h3>
                                                <p className="text-xs text-muted-foreground font-medium mt-1">Configure plan tiers, cycle status, and billing expirations.</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Subscription Tier</label>
                                                    <Select value={subPlanName} onValueChange={setSubPlanName}>
                                                        <SelectTrigger className="h-12 rounded-xl border-border bg-muted/20 font-bold text-foreground">
                                                            <SelectValue placeholder="Select Plan" />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-border bg-background">
                                                            <SelectItem value="Free">Free / Trial Plan</SelectItem>
                                                            <SelectItem value="Basic">Basic Plan</SelectItem>
                                                            <SelectItem value="Premium">Premium Plan</SelectItem>
                                                            <SelectItem value="Enterprise">Enterprise Tier</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Status</label>
                                                    <Select value={subStatus} onValueChange={setSubStatus}>
                                                        <SelectTrigger className="h-12 rounded-xl border-border bg-muted/20 font-bold text-foreground">
                                                            <SelectValue placeholder="Select Status" />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-border bg-background">
                                                            <SelectItem value="active">Active</SelectItem>
                                                            <SelectItem value="trialing">Trialing</SelectItem>
                                                            <SelectItem value="grace_period">Grace Period</SelectItem>
                                                            <SelectItem value="inactive">Inactive / Cancelled</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2 md:col-span-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Subscription End Date</label>
                                                    <Input
                                                        type="date"
                                                        className="h-12 bg-muted/20 border-border rounded-xl font-bold text-foreground"
                                                        value={subEndDate}
                                                        onChange={(e) => setSubEndDate(e.target.value)}
                                                    />
                                                    <span className="text-[10px] text-muted-foreground font-medium block">Leave empty for infinite lifetime access.</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-end pt-2">
                                                <Button
                                                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 shadow-md transition-all"
                                                    disabled={updateSubscriptionMutation.isPending}
                                                    onClick={() => updateSubscriptionMutation.mutate({
                                                        id: selectedWorkspaceHotel.id,
                                                        data: {
                                                            plan_name: subPlanName,
                                                            status: subStatus,
                                                            end_date: subEndDate ? new Date(subEndDate).toISOString() : null
                                                        }
                                                    })}
                                                >
                                                    Save Subscription Plan
                                                </Button>
                                            </div>
                                        </Card>

                                        {/* Resource limits & Danger Zone */}
                                        <div className="space-y-6 lg:col-span-1">
                                            <Card className="border border-border rounded-2xl p-6 bg-background space-y-6">
                                                <div>
                                                    <h3 className="text-lg font-bold text-foreground">Resource Limits</h3>
                                                    <p className="text-xs text-muted-foreground font-medium mt-1">Configure communication credits & request caps.</p>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp Credits</label>
                                                        <Input type="number" value={whatsappCredits} onChange={(e) => setWhatsappCredits(e.target.value)} className="h-11 bg-muted/20 border-border rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-500" /> SMS Credits</label>
                                                        <Input type="number" value={smsCredits} onChange={(e) => setSmsCredits(e.target.value)} className="h-11 bg-muted/20 border-border rounded-xl font-bold" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><BrainCircuit className="w-3.5 h-3.5 text-indigo-500" /> AI Usage Limit</label>
                                                        <Input type="number" value={aiUsageLimit} onChange={(e) => setAiUsageLimit(e.target.value)} className="h-11 bg-muted/20 border-border rounded-xl font-bold" />
                                                    </div>
                                                </div>
                                                <Button
                                                    className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 transition-all"
                                                    disabled={updateQuotasMutation.isPending}
                                                    onClick={() => updateQuotasMutation.mutate({
                                                        id: selectedWorkspaceHotel.id,
                                                        data: {
                                                            whatsapp_credits: parseInt(whatsappCredits, 10) || 0,
                                                            sms_credits: parseInt(smsCredits, 10) || 0,
                                                            ai_usage_limit: parseInt(aiUsageLimit, 10) || 0
                                                        }
                                                    })}
                                                >
                                                    Update Quota Limits
                                                </Button>
                                            </Card>

                                            <Card className="border border-red-200 dark:border-red-950/40 rounded-2xl p-6 bg-red-50/20 space-y-6">
                                                <div>
                                                    <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Danger Zone</h3>
                                                    <p className="text-xs text-red-650 dark:text-red-550/80 font-medium mt-1">High-risk tenant removal and restrictions.</p>
                                                </div>
                                                <div className="space-y-3">
                                                    <Button
                                                        variant="outline"
                                                        className="w-full rounded-xl border-red-200 dark:border-red-950/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-650 dark:text-red-400 font-bold h-11 flex items-center gap-2"
                                                        onClick={() => toggleActive(selectedWorkspaceHotel.id, selectedWorkspaceHotel.is_active)}
                                                    >
                                                        {selectedWorkspaceHotel.is_active ? <XCircle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                                                        {selectedWorkspaceHotel.is_active ? 'Restrict Property Access' : 'Grant Property Access'}
                                                    </Button>
                                                    <Button
                                                        className="w-full rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold h-11 flex items-center gap-2"
                                                        onClick={() => {
                                                            if (confirm(`Are you absolutely sure you want to permanently delete hotel ${selectedWorkspaceHotel.name}? This will wipe everything including all employee logins and data, and is 100% irreversible.`)) {
                                                                deleteHotelMutation.mutate(selectedWorkspaceHotel.id);
                                                                setSelectedWorkspaceHotel(null);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" /> Wipe Hotel Data
                                                    </Button>
                                                </div>
                                            </Card>
                                        </div>
                                    </div>
                                )}

                                {workspaceTab === 'users' && (
                                    <Card className="border border-border rounded-2xl p-8 bg-background min-h-[400px] space-y-6">
                                        <div className="flex items-center justify-between pb-4 border-b border-border">
                                            <div>
                                                <h3 className="text-xl font-bold text-foreground">Hotel User Registry</h3>
                                                <p className="text-xs text-muted-foreground font-medium mt-1">Review and manage platform users associated with {selectedWorkspaceHotel.name}.</p>
                                            </div>
                                            <Button 
                                                className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold h-10 px-4 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                                                onClick={() => setIsAddUserOpen(true)}
                                            >
                                                <Plus className="w-4 h-4" /> Add Employee Account
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {users.filter(u => u.hotel_id === selectedWorkspaceHotel.id).length === 0 ? (
                                                <div className="col-span-full py-16 text-center text-muted-foreground italic font-medium">
                                                    No employee accounts registered under this property yet.
                                                </div>
                                            ) : (
                                                users.filter(u => u.hotel_id === selectedWorkspaceHotel.id).map((u: any) => (
                                                    <div key={u.id} className="p-5 rounded-xl border border-border bg-muted/15 flex flex-col justify-between group relative bg-background">
                                                        <div>
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center border border-border text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                                                    <UserIcon className="w-5 h-5" />
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Badge className={`rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider border border-border shadow-none ${
                                                                        u.role === 'OWNER' 
                                                                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-bold'
                                                                            : u.role === 'MANAGER'
                                                                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 font-bold'
                                                                            : 'bg-muted/40 text-muted-foreground border-border'
                                                                    }`}>
                                                                        {u.role}
                                                                    </Badge>
                                                                    <Badge className={`rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider border border-border shadow-none ${
                                                                        u.is_active 
                                                                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-bold' 
                                                                            : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 font-bold'
                                                                    }`}>
                                                                        {u.is_active ? 'Active' : 'Suspended'}
                                                                    </Badge>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="rounded-xl w-7 h-7 hover:bg-background hover:shadow-sm">
                                                                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-52 p-2 rounded-2xl shadow-2xl border border-border bg-background z-50">
                                                                            <DropdownMenuLabel className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-3 py-1.5">Employee Actions</DropdownMenuLabel>
                                                                            <DropdownMenuSeparator className="bg-muted/30" />
                                                                            
                                                                            <DropdownMenuLabel className="text-[8px] font-black text-muted-foreground uppercase tracking-wider px-3 py-1">Set Role</DropdownMenuLabel>
                                                                            {['OWNER', 'MANAGER', 'STAFF'].map((roleOpt) => (
                                                                                <DropdownMenuItem 
                                                                                    key={roleOpt} 
                                                                                    className={`rounded-xl py-2 cursor-pointer font-semibold text-xs ${u.role === roleOpt ? 'bg-indigo-50 text-indigo-750 font-bold' : 'text-foreground'}`}
                                                                                    onClick={() => updateRoleMutation.mutate({ id: u.id, role: roleOpt })}
                                                                                >
                                                                                    {roleOpt === 'OWNER' ? 'Owner / Admin' : roleOpt === 'MANAGER' ? 'Manager' : 'Staff'}
                                                                                </DropdownMenuItem>
                                                                            ))}
                                                                            
                                                                            <DropdownMenuSeparator className="bg-muted/30" />
                                                                            
                                                                            <DropdownMenuItem 
                                                                                className="rounded-xl py-2.5 cursor-pointer" 
                                                                                onClick={() => toggleUserStatusMutation.mutate({ id: u.id, is_active: !u.is_active })}
                                                                            >
                                                                                {u.is_active ? (
                                                                                    <>
                                                                                        <XCircle className="w-4 h-4 mr-2.5 text-amber-500" />
                                                                                        <span className="font-bold text-foreground">Suspend Login</span>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <UserCheck className="w-4 h-4 mr-2.5 text-emerald-600" />
                                                                                        <span className="font-bold text-foreground">Activate Login</span>
                                                                                    </>
                                                                                )}
                                                                            </DropdownMenuItem>
                                                                            
                                                                            <DropdownMenuSeparator className="bg-muted/30" />
                                                                            <DropdownMenuItem 
                                                                                className="rounded-xl py-2.5 cursor-pointer hover:bg-red-50 text-red-650" 
                                                                                onClick={() => {
                                                                                    if (confirm(`Delete employee user account ${u.email}?`)) {
                                                                                        deleteUserMutation.mutate(u.id);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <Trash2 className="w-4 h-4 mr-2.5 text-red-600" />
                                                                                <span className="font-bold">Purge User</span>
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="font-bold text-sm text-foreground truncate">{u.name || "Unnamed User"}</p>
                                                                <p className="text-[11px] text-muted-foreground truncate font-mono">{u.email}</p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                                                            <span>Created:</span>
                                                            <span>{u.created_at ? format(new Date(u.created_at), 'dd MMM yyyy') : 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </Card>
                                )}

                                {workspaceTab === 'permissions' && (
                                    <Card className="border border-border rounded-2xl bg-background overflow-hidden shadow-sm">
                                        <div className="p-6 border-b border-border bg-slate-50/40 flex flex-wrap items-center justify-between gap-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                                    <Lock className="w-5 h-5 text-indigo-600" /> Role-Based Access Configuration Matrix
                                                </h3>
                                                <p className="text-xs text-muted-foreground font-medium mt-1">Configure exactly which pages & dashboards each hotel role (Owner, Manager, Staff) is authorized to see in the app navigation menu.</p>
                                            </div>
                                            <Button
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 rounded-xl shadow-md transition-all flex items-center gap-2"
                                                disabled={updateWorkspacePermissionsMutation.isPending}
                                                onClick={() => updateWorkspacePermissionsMutation.mutate({
                                                    id: selectedWorkspaceHotel.id,
                                                    permissions: workspacePermissions
                                                })}
                                            >
                                                {updateWorkspacePermissionsMutation.isPending ? (
                                                    <>
                                                        <RefreshCw className="w-4 h-4 animate-spin" /> Saving Matrix...
                                                    </>
                                                ) : (
                                                    <>
                                                        <ShieldCheck className="w-4 h-4" /> Save Access Controls
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        <div className="p-6">
                                            <div className="overflow-x-auto border border-border rounded-xl">
                                                <Table>
                                                    <TableHeader className="bg-muted/30 border-b border-border">
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableHead className="w-[380px] text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 pl-6">
                                                                Sidebar Option / Dashboard Page
                                                            </TableHead>
                                                            {['OWNER', 'MANAGER', 'STAFF'].map(roleOpt => (
                                                                <TableHead key={roleOpt} className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-muted border border-border text-foreground">
                                                                        {roleOpt === 'OWNER' ? 'Owner / Admin' : roleOpt === 'MANAGER' ? 'Manager (GM)' : 'Basic Staff'}
                                                                    </span>
                                                                </TableHead>
                                                            ))}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {[
                                                            { path: '/dashboard', label: 'Dashboard Overview', desc: 'Main operations summary and key performance indicators.' },
                                                            { path: '/analytics', label: 'System Analytics', desc: 'Detailed occupancy, revenue charts, and forecasting.' },
                                                            { path: '/agent', label: 'AI Reservation Assistant', desc: 'Control panel for provisioning reservation automated agents.' },
                                                            { path: '/rooms', label: 'Rooms Management', desc: 'Create, update, and manage hotel room inventory.' },
                                                            { path: '/rates', label: 'Rate Plans & Packages', desc: 'Configure pricing rules, packages, and seasonal rate plans.' },
                                                            { path: '/rate-shopper', label: 'Rate Shopper Engine', desc: 'Monitor competitor pricing in real-time.' },
                                                            { path: '/availability', label: 'Calendar Grid', desc: 'Visual booking calendar with drag-and-drop features.' },
                                                            { path: '/bookings', label: 'Bookings List', desc: 'Complete database of all past, present, and upcoming stays.' },
                                                            { path: '/guests', label: 'Guest Profiles', desc: 'Review guest profiles, loyalty indices, and preferences.' },
                                                            { path: '/payments', label: 'Payments Ledger', desc: 'Check invoicing, transaction statuses, and charge records.' },
                                                            { path: '/amenities', label: 'Amenities & Inclusions', desc: 'Manage hotel amenities, dining, and other inclusions.' },
                                                            { path: '/addons', label: 'Add-ons & Services', desc: 'Add secondary items like spa vouchers or breakfast upgrades.' },
                                                            { path: '/channel-settings', label: 'Channel Manager', desc: 'Sync inventory rates to OTAs like Agoda and Expedia.' },
                                                            { path: '/integration', label: 'Integration Settings', desc: 'Generate embed code blocks and chatbot widgets.' },
                                                            { path: '/settings', label: 'Hotel Profile & SMTP Settings', desc: 'Primary property configurations and mailing parameters.' }
                                                        ].map((route) => (
                                                            <TableRow key={route.path} className="hover:bg-muted/5 transition-colors border-b border-border last:border-0">
                                                                <TableCell className="py-4 pl-6">
                                                                    <div className="space-y-0.5">
                                                                        <p className="font-bold text-sm text-foreground">{route.label}</p>
                                                                        <p className="text-[10px] text-muted-foreground font-medium leading-relaxed max-w-[320px]">
                                                                            {route.desc}
                                                                        </p>
                                                                    </div>
                                                                </TableCell>
                                                                {['OWNER', 'MANAGER', 'STAFF'].map(roleOpt => {
                                                                    const roleList = workspacePermissions[roleOpt] || [];
                                                                    const hasAccess = roleList.includes(route.path);
                                                                    return (
                                                                        <TableCell key={roleOpt} className="text-center">
                                                                            <div className="flex justify-center items-center">
                                                                                <Switch
                                                                                    checked={hasAccess}
                                                                                    onCheckedChange={(checked) => {
                                                                                        setWorkspacePermissions(prev => {
                                                                                            const oldList = prev[roleOpt] || [];
                                                                                            const newList = checked 
                                                                                                ? [...oldList, route.path]
                                                                                                : oldList.filter(p => p !== route.path);
                                                                                            return { ...prev, [roleOpt]: newList };
                                                                                        });
                                                                                    }}
                                                                                    className="data-[state=checked]:bg-indigo-600"
                                                                                />
                                                                            </div>
                                                                        </TableCell>
                                                                    );
                                                                })}
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </Card>
                                )}

                                {workspaceTab === 'features' && (
                                    <Card className="border border-border rounded-2xl p-8 bg-background shadow-sm space-y-6">
                                        <div className="flex flex-wrap items-center justify-between gap-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-foreground">Property Capability Matrix</h3>
                                                <p className="text-xs text-muted-foreground font-medium mt-1">Provision specific modular features for {selectedWorkspaceHotel.name}. Modifying these values overrides defaults.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {[
                                                { title: 'AI Assistant Enabled', desc: 'Core reservation AI agent and booking support chatbot.', key: 'ai_enabled', val: selectedWorkspaceHotel.feature_ai_agent },
                                                { title: 'Guest AI Agent & Bot Widgets', desc: 'Guest interaction bots for WhatsApp, web widget, and post-stay automation.', key: 'guest_bot_enabled', val: selectedWorkspaceHotel.feature_guest_bot },
                                                { title: 'Rate Shopper Engine', desc: 'Allows property operators to track competitor pricing dynamically.', key: 'rate_shopper_enabled', val: selectedWorkspaceHotel.feature_rate_shopper },
                                                { title: 'New Calendar Booking Button', desc: 'Ability to manually add reservations directly from the calendar layout.', key: 'new_booking_enabled', val: selectedWorkspaceHotel.feature_new_booking },
                                                { title: 'Color Palette Customizer', desc: 'Brand theme building and layout controls customizer.', key: 'color_palette_enabled', val: selectedWorkspaceHotel.feature_color_palette },
                                                { title: 'Custom Logo Branding', desc: 'Swap standard Staybooker logo files with property branding graphics.', key: 'custom_logo_enabled', val: selectedWorkspaceHotel.feature_custom_logo },
                                                { title: 'Widget Snippet Embeds', desc: 'JS embedding snippet generation codes for third-party landing pages.', key: 'custom_widget_enabled', val: selectedWorkspaceHotel.feature_custom_widget },
                                            ].map((feat) => (
                                                <div key={feat.key} className="flex items-center justify-between p-4 rounded-xl border border-border/80 hover:bg-muted/10 transition-colors">
                                                    <div className="space-y-0.5 max-w-[80%]">
                                                        <p className="text-sm font-bold text-foreground">{feat.title}</p>
                                                        <p className="text-[11px] text-muted-foreground leading-normal font-medium">{feat.desc}</p>
                                                    </div>
                                                    <Switch
                                                        checked={feat.val}
                                                        onCheckedChange={() => toggleFeature(selectedWorkspaceHotel.id, feat.key, feat.val)}
                                                        className="data-[state=checked]:bg-indigo-600 scale-105"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <Separator className="bg-border/60" />

                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                                                    <ShieldCheck className="w-4 h-4 text-indigo-650" /> Guest Cancellation Flow Control
                                                </h4>
                                                <p className="text-[11px] text-muted-foreground mt-0.5 font-medium leading-relaxed">
                                                    Choose whether cancellation requests are processed automatically/instantly or require manual hotelier approval first.
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/5">
                                                <div className="space-y-0.5">
                                                    <span className="text-xs font-bold text-foreground block">Cancellation Mode</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium block">
                                                        {selectedWorkspaceHotel.settings?.cancellation_mode === 'request'
                                                            ? 'Approval-Based Request (Locked)'
                                                            : 'Instant Self-Cancellation (Default)'}
                                                    </span>
                                                </div>
                                                <Select
                                                    value={selectedWorkspaceHotel.settings?.cancellation_mode || 'instant'}
                                                    onValueChange={(val) => {
                                                        const currentSettings = selectedWorkspaceHotel.settings || {};
                                                        updateMutation.mutate({
                                                            id: selectedWorkspaceHotel.id,
                                                            data: {
                                                                settings: {
                                                                    ...currentSettings,
                                                                    cancellation_mode: val
                                                                }
                                                            }
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-[220px] h-10 rounded-xl border-border bg-background font-bold text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-border bg-background z-50">
                                                        <SelectItem value="instant">Instant Self-Cancellation</SelectItem>
                                                        <SelectItem value="request">Approval-Based Request</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </Card>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Advanced Filter Panel */}
                                <div className="p-6 border border-border bg-slate-50/40 rounded-2xl flex flex-wrap gap-4 items-end justify-between bg-background">
                                    <div className="flex flex-wrap gap-4 items-center">
                                        {/* Plan Selector */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <Crown className="w-3 h-3 text-indigo-500" /> Subscription Plan
                                            </label>
                                            <Select value={planFilter} onValueChange={setPlanFilter}>
                                                <SelectTrigger className="w-[150px] h-10 rounded-xl border-border bg-background text-xs font-bold text-foreground">
                                                    <SelectValue placeholder="All Plans" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-border bg-background">
                                                    <SelectItem value="all">All Plans</SelectItem>
                                                    <SelectItem value="none">No Plan</SelectItem>
                                                    <SelectItem value="basic">Basic Plan</SelectItem>
                                                    <SelectItem value="premium">Premium Plan</SelectItem>
                                                    <SelectItem value="enterprise">Enterprise</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Status Selector */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <ShieldCheck className="w-3 h-3 text-emerald-500" /> Account Status
                                            </label>
                                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                                <SelectTrigger className="w-[140px] h-10 rounded-xl border-border bg-background text-xs font-bold text-foreground">
                                                    <SelectValue placeholder="All Statuses" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-border bg-background">
                                                    <SelectItem value="all">All Statuses</SelectItem>
                                                    <SelectItem value="active">Active Only</SelectItem>
                                                    <SelectItem value="locked">Locked Only</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Active Features Switches */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <SlidersHorizontal className="w-3 h-3 text-purple-500" /> Feature Filters
                                            </label>
                                            <div className="flex items-center gap-4 border border-border px-4 h-10 rounded-xl bg-background">
                                                <div className="flex items-center gap-1.5">
                                                    <Switch id="filter-ai" checked={featureFilterAI} onCheckedChange={setFeatureFilterAI} className="scale-75 data-[state=checked]:bg-indigo-600" />
                                                    <label htmlFor="filter-ai" className="text-[10px] font-bold text-muted-foreground cursor-pointer select-none">AI Agent</label>
                                                </div>
                                                <div className="h-4 w-px bg-slate-200" />
                                                <div className="flex items-center gap-1.5">
                                                    <Switch id="filter-bot" checked={featureFilterBot} onCheckedChange={setFeatureFilterBot} className="scale-75 data-[state=checked]:bg-indigo-600" />
                                                    <label htmlFor="filter-bot" className="text-[10px] font-bold text-muted-foreground cursor-pointer select-none">Bot</label>
                                                </div>
                                                <div className="h-4 w-px bg-slate-200" />
                                                <div className="flex items-center gap-1.5">
                                                    <Switch id="filter-rates" checked={featureFilterRates} onCheckedChange={setFeatureFilterRates} className="scale-75 data-[state=checked]:bg-indigo-600" />
                                                    <label htmlFor="filter-rates" className="text-[10px] font-bold text-muted-foreground cursor-pointer select-none">Rates</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Active Filters Clear Button */}
                                    {(planFilter !== 'all' || statusFilter !== 'all' || featureFilterAI || featureFilterBot || featureFilterRates) && (
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                setPlanFilter('all');
                                                setStatusFilter('all');
                                                setFeatureFilterAI(false);
                                                setFeatureFilterBot(false);
                                                setFeatureFilterRates(false);
                                            }}
                                            className="h-10 text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 rounded-xl px-4 flex items-center gap-1.5 border border-indigo-100"
                                        >
                                            <XCircle className="w-4 h-4" /> Clear All Filters
                                        </Button>
                                    )}
                                </div>

                                {/* Hotel Cards Grid */}
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center p-20 gap-3 border border-border bg-background rounded-2xl">
                                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm font-bold text-muted-foreground animate-pulse">Loading Properties Portfolio...</span>
                                    </div>
                                ) : filteredHotels.length === 0 ? (
                                    <div className="p-20 text-center text-muted-foreground font-bold italic border border-border bg-background rounded-2xl">
                                        No properties matched your search.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {filteredHotels.map((hotel) => {
                                            const activeFeatures = [
                                                hotel.feature_ai_agent && 'AI',
                                                hotel.feature_guest_bot && 'Bot',
                                                hotel.feature_rate_shopper && 'Rates',
                                                hotel.feature_new_booking && 'Bookings',
                                                hotel.feature_color_palette && 'Themes',
                                                hotel.feature_custom_logo && 'Logos',
                                                hotel.feature_custom_widget && 'Widgets'
                                            ].filter(Boolean);

                                            return (
                                                <motion.div
                                                    key={hotel.id}
                                                    whileHover={{ y: -5, scale: 1.01 }}
                                                    className="border border-border/80 shadow-sm hover:shadow-xl transition-all duration-300 rounded-2xl bg-background overflow-hidden p-6 flex flex-col justify-between h-[280px]"
                                                >
                                                    <div className="space-y-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-indigo-50/5 dark:bg-indigo-950/20 border border-indigo-50/20 dark:border-indigo-950/40 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                                                    <Building2 className="w-5 h-5" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <h4 
                                                                        className="font-bold text-sm text-foreground hover:text-indigo-600 cursor-pointer transition-colors truncate"
                                                                        onClick={() => setSelectedWorkspaceHotel(hotel)}
                                                                    >
                                                                        {hotel.name}
                                                                    </h4>
                                                                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-[150px]">slug: {hotel.slug}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col gap-1 items-end shrink-0">
                                                                <Badge className={`rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider border shadow-none font-bold ${
                                                                    hotel.subscription?.plan?.toLowerCase() === 'enterprise' ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/40 dark:text-purple-400' :
                                                                    hotel.subscription?.plan?.toLowerCase() === 'premium' ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400' :
                                                                    hotel.subscription?.plan?.toLowerCase() === 'basic' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400' :
                                                                    'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900/50 dark:text-slate-400'
                                                                }`}>
                                                                    {hotel.subscription?.plan || 'Free'}
                                                                </Badge>
                                                                <Badge className={`rounded-lg px-1.5 py-0.2 text-[7px] uppercase tracking-wider border shadow-none font-bold ${
                                                                    hotel.is_active 
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                                                    : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400'
                                                                }`}>
                                                                    {hotel.is_active ? 'Active' : 'Locked'}
                                                                </Badge>
                                                            </div>
                                                        </div>

                                                        <div className="p-3 rounded-xl border border-border bg-muted/10 dark:bg-slate-900/20 space-y-1">
                                                            <div className="flex justify-between text-[11px]">
                                                                <span className="text-muted-foreground font-medium">Owner:</span>
                                                                <span className="font-bold text-foreground truncate max-w-[160px]">{hotel.owner_name !== 'N/A' ? hotel.owner_name : hotel.owner_email.split('@')[0]}</span>
                                                            </div>
                                                            <div className="flex justify-between text-[11px]">
                                                                <span className="text-muted-foreground font-medium">Staff Users:</span>
                                                                <span className="font-mono font-bold text-foreground">{users.filter(u => u.hotel_id === hotel.id).length} accounts</span>
                                                            </div>
                                                            <div className="flex justify-between text-[11px]">
                                                                <span className="text-muted-foreground font-medium">Active Features:</span>
                                                                <span className="font-bold text-indigo-650 dark:text-indigo-400">{activeFeatures.length} enabled</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="flex-1 h-9 text-xs rounded-xl font-bold border-border"
                                                            onClick={() => impersonateMutation.mutate(hotel.id)}
                                                            disabled={impersonateMutation.isPending}
                                                        >
                                                            <UserCheck className="w-3.5 h-3.5 mr-1" /> Impersonate
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="flex-1 h-9 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                                            onClick={() => setSelectedWorkspaceHotel(hotel)}
                                                        >
                                                            <Settings className="w-3.5 h-3.5 mr-1" /> Manage Hotel
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>



                    {/* Audit Logs Tab Content */}
                    
    </>
  );
}