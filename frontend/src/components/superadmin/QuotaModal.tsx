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

export function QuotaModal(props: any) {
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
<Dialog open={!!selectedQuotaHotel} onOpenChange={(open) => !open && setSelectedQuotaHotel(null)}>
                    <DialogContent className="max-w-md bg-background p-8 rounded-3xl border border-border shadow-2xl">
                        <DialogHeader className="space-y-2">
                            <div className="w-12 h-12 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center border border-purple-500/20 mb-2">
                                <SlidersHorizontal className="w-6 h-6" />
                            </div>
                            <DialogTitle className="text-xl font-bold text-foreground">Enterprise Quotas & Usage Limits</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground font-medium">
                                Configure dedicated messaging credits and AI agent interaction caps for <span className="font-bold text-foreground">{selectedQuotaHotel?.name}</span>.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 my-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp Notification Credits
                                </label>
                                <Input
                                    type="number"
                                    className="h-12 bg-muted/30 border-border rounded-xl font-bold text-foreground focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 focus-visible:border-primary"
                                    value={whatsappCredits}
                                    onChange={(e) => setWhatsappCredits(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Zap className="w-3.5 h-3.5 text-amber-500" /> SMS Dispatch Credits
                                </label>
                                <Input
                                    type="number"
                                    className="h-12 bg-muted/30 border-border rounded-xl font-bold text-foreground focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 focus-visible:border-primary"
                                    value={smsCredits}
                                    onChange={(e) => setSmsCredits(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <BrainCircuit className="w-3.5 h-3.5 text-indigo-500" /> AI Agent Interaction Limit
                                </label>
                                <Input
                                    type="number"
                                    className="h-12 bg-muted/30 border-border rounded-xl font-bold text-foreground focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 focus-visible:border-primary"
                                    value={aiUsageLimit}
                                    onChange={(e) => setAiUsageLimit(e.target.value)}
                                />
                            </div>
                        </div>

                        <DialogFooter className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 rounded-xl h-12 font-bold hover:bg-muted/30"
                                onClick={() => setSelectedQuotaHotel(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 rounded-xl h-12 bg-primary hover:bg-primary/95 text-primary-foreground font-bold shadow-lg shadow-primary/5 dark:shadow-none transition-all"
                                disabled={updateQuotaMutation.isPending}
                                onClick={() => {
                                    if (!selectedQuotaHotel) return;
                                    updateQuotaMutation.mutate({
                                        id: selectedQuotaHotel.id,
                                        data: {
                                            whatsapp_credits: parseInt(whatsappCredits, 10) || 0,
                                            sms_credits: parseInt(smsCredits, 10) || 0,
                                            ai_usage_limit: parseInt(aiUsageLimit, 10) || 0,
                                        }
                                    });
                                }}
                            >
                                Save Enterprise Limits
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
    </>
  );
}