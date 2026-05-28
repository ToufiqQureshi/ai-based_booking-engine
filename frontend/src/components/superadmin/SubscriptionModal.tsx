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

export function SubscriptionModal(props: any) {
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
<Dialog open={!!selectedSubHotel} onOpenChange={(open) => !open && setSelectedSubHotel(null)}>
                    <DialogContent className="max-w-md bg-background p-8 rounded-3xl border border-border shadow-2xl">
                        <DialogHeader className="space-y-2">
                            <div className="w-12 h-12 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/20 mb-2">
                                <CreditCard className="w-6 h-6" />
                            </div>
                            <DialogTitle className="text-xl font-bold text-foreground">Modify Subscription Plan</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground font-medium">
                                Alter current billing plan configuration and cycle settings for <span className="font-bold text-foreground">{selectedSubHotel?.name}</span>.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 my-6">
                            {/* Plan Name Selector */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                                    Subscription tier
                                </label>
                                <Select value={subPlanName} onValueChange={setSubPlanName}>
                                    <SelectTrigger className="h-12 rounded-xl border-border bg-muted/30 font-bold text-foreground">
                                        <SelectValue placeholder="Select Plan Tier" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border bg-background">
                                        <SelectItem value="Free">Free / Trial Plan</SelectItem>
                                        <SelectItem value="Basic">Basic Plan</SelectItem>
                                        <SelectItem value="Premium">Premium Plan</SelectItem>
                                        <SelectItem value="Enterprise">Enterprise Tier</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Plan Status Selector */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                                    Plan Status
                                </label>
                                <Select value={subStatus} onValueChange={setSubStatus}>
                                    <SelectTrigger className="h-12 rounded-xl border-border bg-muted/30 font-bold text-foreground">
                                        <SelectValue placeholder="Select Plan Status" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border bg-background">
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="trialing">Trialing</SelectItem>
                                        <SelectItem value="grace_period">Grace Period</SelectItem>
                                        <SelectItem value="inactive">Inactive / Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Plan End Date */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Subscription End Date
                                </label>
                                <Input
                                    type="date"
                                    className="h-12 bg-muted/30 border-border rounded-xl font-bold text-foreground"
                                    value={subEndDate}
                                    onChange={(e) => setSubEndDate(e.target.value)}
                                />
                                <span className="text-[10px] text-muted-foreground font-medium block">Leave empty for infinite lifetime access.</span>
                            </div>
                        </div>

                        <DialogFooter className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 rounded-xl h-12 font-bold hover:bg-muted/30"
                                onClick={() => setSelectedSubHotel(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 rounded-xl h-12 bg-primary hover:bg-primary/95 text-primary-foreground font-bold shadow-lg shadow-primary/5 dark:shadow-none transition-all"
                                disabled={updateSubscriptionMutation.isPending}
                                onClick={() => {
                                    if (!selectedSubHotel) return;
                                    updateSubscriptionMutation.mutate({
                                        id: selectedSubHotel.id,
                                        data: {
                                            plan_name: subPlanName,
                                            status: subStatus,
                                            end_date: subEndDate ? new Date(subEndDate).toISOString() : null
                                        }
                                    });
                                }}
                            >
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Add User Dialog */}
                
    </>
  );
}