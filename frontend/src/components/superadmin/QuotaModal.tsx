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
                                <Sliders className="w-6 h-6" />
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
                                disabled={updateQuotasMutation.isPending}
                                onClick={() => {
                                    if (!selectedQuotaHotel) return;
                                    updateQuotasMutation.mutate({
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

                            {/* Hotel Detail Sheet (Drawer) */}
                            <Sheet open={!!detailHotel} onOpenChange={(open) => !open && setDetailHotel(null)}>
                                <SheetContent className="w-full sm:max-w-lg bg-background border-l border-border p-0 shadow-2xl flex flex-col h-full overflow-hidden">
                                    {activeDetailHotel && (
                                        <>
                                            <div className="p-6 border-b border-border bg-muted/20 backdrop-blur-md flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-indigo-50/5 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-50/20 shadow-sm">
                                                        <Building2 className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <SheetTitle className="text-lg font-black text-foreground tracking-tight">{activeDetailHotel.name}</SheetTitle>
                                                        <SheetDescription className="text-xs font-mono text-indigo-600 font-bold mt-0.5">slug: {activeDetailHotel.slug}</SheetDescription>
                                                    </div>
                                                </div>
                                                <Badge className={`rounded-lg px-2.5 py-1 font-black text-[9px] uppercase tracking-widest border ${
                                                    activeDetailHotel.is_active 
                                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 shadow-sm font-bold' 
                                                    : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 font-bold'
                                                }`}>
                                                    {activeDetailHotel.is_active ? 'Active' : 'Locked'}
                                                </Badge>
                                            </div>

                                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                                {/* Owner Details */}
                                                <div className="space-y-3">
                                                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Ownership & Contact</h4>
                                                    <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-2">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">Owner Name:</span>
                                                            <span className="font-bold text-foreground">{activeDetailHotel.owner_name}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">Owner Email:</span>
                                                            <span className="font-mono text-foreground font-semibold">{activeDetailHotel.owner_email}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Subscription Details */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Subscription & Plan</h4>
                                                        <Button 
                                                            variant="link" 
                                                            className="text-xs text-indigo-600 font-bold p-0 h-auto"
                                                            onClick={() => {
                                                                setSelectedSubHotel(activeDetailHotel);
                                                                setSubPlanName(activeDetailHotel.subscription?.plan || 'Basic');
                                                                setSubStatus(activeDetailHotel.subscription?.status || 'active');
                                                                setSubEndDate(activeDetailHotel.subscription?.end_date ? format(new Date(activeDetailHotel.subscription.end_date), 'yyyy-MM-dd') : '');
                                                            }}
                                                        >
                                                            Modify Plan
                                                        </Button>
                                                    </div>
                                                    <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-3">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-muted-foreground font-medium">Current Plan:</span>
                                                            <Badge className="font-bold uppercase tracking-wider">
                                                                {activeDetailHotel.subscription?.plan || 'None'}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-muted-foreground font-medium">Status:</span>
                                                            <Badge variant="outline" className="font-bold uppercase tracking-wider text-[10px]">
                                                                {activeDetailHotel.subscription?.status || 'inactive'}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">End Date:</span>
                                                            <span className="font-semibold text-foreground">
                                                                {activeDetailHotel.subscription?.end_date 
                                                                    ? format(new Date(activeDetailHotel.subscription.end_date), 'dd MMMM yyyy') 
                                                                    : 'Lifetime'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Quotas & Credit Limits */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Resource Quotas</h4>
                                                        <Button 
                                                            variant="link" 
                                                            className="text-xs text-indigo-600 font-bold p-0 h-auto"
                                                            onClick={() => {
                                                                setSelectedQuotaHotel(activeDetailHotel);
                                                                setWhatsappCredits(activeDetailHotel.subscription?.whatsapp_credits?.toString() || '1000');
                                                                setSmsCredits(activeDetailHotel.subscription?.sms_credits?.toString() || '1000');
                                                                setAiUsageLimit(activeDetailHotel.subscription?.ai_usage_limit?.toString() || '50000');
                                                            }}
                                                        >
                                                            Adjust Limits
                                                        </Button>
                                                    </div>
                                                    <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-3">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">WhatsApp Credits:</span>
                                                            <span className="font-bold text-foreground font-mono">{activeDetailHotel.subscription?.whatsapp_credits ?? 0}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">SMS Credits:</span>
                                                            <span className="font-bold text-foreground font-mono">{activeDetailHotel.subscription?.sms_credits ?? 0}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">AI Usage Limit:</span>
                                                            <span className="font-bold text-foreground font-mono">{activeDetailHotel.subscription?.ai_usage_limit ?? 0}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Feature Controls (7 Toggles) */}
                                                <div className="space-y-4">
                                                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Feature Lock Controls</h4>
                                                    <div className="space-y-3">
                                                        {[
                                                            { title: 'AI Assistant', desc: 'Core reservation AI agent and booking support chatbot.', key: 'feature_ai_agent', val: activeDetailHotel.feature_ai_agent },
                                                            { title: 'Guest AI Agent', desc: 'Guest interaction bots for whatsapp, widget and post-stay followups.', key: 'feature_guest_bot', val: activeDetailHotel.feature_guest_bot },
                                                            { title: 'Rate Shopper', desc: 'Allows properties to track competitors pricing dynamically.', key: 'feature_rate_shopper', val: activeDetailHotel.feature_rate_shopper },
                                                            { title: 'New Booking Button', desc: 'Ability to manually add reservations directly from the calendar.', key: 'feature_new_booking', val: activeDetailHotel.feature_new_booking },
                                                            { title: 'Color Palette Customizer', desc: 'Design customization controls for custom theme builder.', key: 'feature_color_palette', val: activeDetailHotel.feature_color_palette },
                                                            { title: 'Custom Logo Uploader', desc: 'Allows hotels to brand the booking engine with their own logo.', key: 'feature_custom_logo', val: activeDetailHotel.feature_custom_logo },
                                                            { title: 'Custom Widget integration', desc: 'Script block access and embedding tags for external hotel websites.', key: 'feature_custom_widget', val: activeDetailHotel.feature_custom_widget },
                                                        ].map((feat) => (
                                                            <div key={feat.key} className="flex items-center justify-between p-3 rounded-xl border border-border/80 hover:bg-muted/10 transition-colors">
                                                                <div className="space-y-0.5 max-w-[80%]">
                                                                    <p className="text-sm font-bold text-foreground">{feat.title}</p>
                                                                    <p className="text-[10px] text-muted-foreground leading-normal font-medium">{feat.desc}</p>
                                                                </div>
                                                                <Switch
                                                                    checked={feat.val}
                                                                    onCheckedChange={() => toggleFeature(activeDetailHotel.id, feat.key, feat.val)}
                                                                    className="data-[state=checked]:bg-indigo-600"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6 border-t border-border bg-muted/10 flex gap-3">
                                                <Button
                                                    className="flex-1 rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                                    onClick={() => impersonateMutation.mutate(activeDetailHotel.id)}
                                                    disabled={impersonateMutation.isPending}
                                                >
                                                    <UserCheck className="w-4 h-4 mr-2" /> Impersonate Hotelier
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="rounded-xl h-11 border-border font-bold hover:bg-muted/30"
                                                    onClick={() => setDetailHotel(null)}
                                                >
                                                    Close Profile
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </SheetContent>
                            </Sheet>

                {/* Subscription Plan Modal */}
                
    </>
  );
}