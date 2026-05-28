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

export function AddEmployeeModal(props: any) {
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
<Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    <DialogContent className="rounded-3xl border border-border bg-background shadow-2xl p-6 max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Add Employee Account</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground font-medium mt-1">
                                Create a new login credential directly registered under {selectedWorkspaceHotel?.name}.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                                    Full Name
                                </label>
                                <Input
                                    placeholder="John Doe"
                                    className="h-11 bg-muted/20 border-border rounded-xl font-medium text-foreground"
                                    value={addUserName}
                                    onChange={(e) => setAddUserName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                                    Email Address
                                </label>
                                <Input
                                    type="email"
                                    placeholder="john@example.com"
                                    className="h-11 bg-muted/20 border-border rounded-xl font-medium text-foreground"
                                    value={addUserEmail}
                                    onChange={(e) => setAddUserEmail(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                                    Password
                                </label>
                                <Input
                                    type="password"
                                    placeholder="Min 6 characters"
                                    className="h-11 bg-muted/20 border-border rounded-xl font-medium text-foreground"
                                    value={addUserPassword}
                                    onChange={(e) => setAddUserPassword(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                                    Role / Privilege Level
                                </label>
                                <Select value={addUserRole} onValueChange={setAddUserRole}>
                                    <SelectTrigger className="h-11 rounded-xl border-border bg-muted/20 font-bold text-foreground">
                                        <SelectValue placeholder="Select Role" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border bg-background">
                                        <SelectItem value="OWNER">Owner / General Manager</SelectItem>
                                        <SelectItem value="MANAGER">Manager / Department Head</SelectItem>
                                        <SelectItem value="STAFF">Basic Staff Member</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <DialogFooter className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 rounded-xl h-11 font-bold hover:bg-muted/30"
                                onClick={() => setIsAddUserOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold h-11 px-6 rounded-xl flex-1 transition-all"
                                disabled={createUserMutation.isPending}
                                onClick={() => {
                                    if (!addUserEmail || !addUserName || !addUserPassword) {
                                        toast({ title: 'Validation Alert', description: 'Please fill in all employee fields.', variant: 'destructive' });
                                        return;
                                    }
                                    if (selectedWorkspaceHotel) {
                                        createUserMutation.mutate({
                                            hotelId: selectedWorkspaceHotel.id,
                                            data: {
                                                email: addUserEmail,
                                                name: addUserName,
                                                password: addUserPassword,
                                                role: addUserRole
                                            }
                                        });
                                    }
                                }}
                            >
                                Create Account
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            
    </>
  );
}