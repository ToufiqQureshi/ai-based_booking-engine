import React, { useState } from 'react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

export function BroadcastsTab() {
    const queryClient = useQueryClient();
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastType, setBroadcastType] = useState('info');

    const { data: broadcasts = [], isLoading: isLoadingBroadcasts, refetch: refetchBroadcasts } = useQuery<any[]>({
        queryKey: ['broadcasts'],
        queryFn: () => apiClient.get('/broadcasts'),
    });

    const createBroadcastMutation = useMutation({
        mutationFn: (data: any) => apiClient.post('/superadmin/broadcasts', data),
        onSuccess: () => {
            toast.success("Platform broadcast published successfully!");
            setBroadcastTitle('');
            setBroadcastMessage('');
            queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to publish broadcast.");
        }
    });

    const deleteBroadcastMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/superadmin/broadcasts/${id}`),
        onSuccess: () => {
            toast.success("Broadcast deactivated and removed.");
            queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
        }
    });

  return (
    <>
<TabsContent value="broadcasts" className="mt-0">
                         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                             <Card className="border-border shadow-sm rounded-2xl p-8 bg-background lg:col-span-1 h-fit space-y-6">
                                 <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
                                         <Radio className="w-5 h-5 animate-pulse" />
                                     </div>
                                     <div>
                                         <h4 className="text-lg font-black text-foreground tracking-tight">New Broadcast Banner</h4>
                                         <p className="text-xs text-muted-foreground font-medium">Instantly alert all tenant dashboards.</p>
                                     </div>
                                 </div>

                                 {/* Predefined Quick Templates */}
                                 <div className="space-y-2">
                                     <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Quick Templates</label>
                                     <div className="grid grid-cols-2 gap-2">
                                         {[
                                             {
                                                 label: '🔧 Maintenance',
                                                 title: 'Scheduled System Maintenance',
                                                 msg: 'Staybooker services will undergo a scheduled maintenance window on Sunday at 02:00 UTC. Dashboard access may experience brief dropouts.',
                                                 type: 'warning'
                                             },
                                             {
                                                 label: '✨ New Feature',
                                                 title: 'New AI Voice Agent Released',
                                                 msg: 'We have updated our core reservation framework with real-time AI voice agents. Visit Settings > Integrations to provision yours.',
                                                 type: 'success'
                                             },
                                             {
                                                 label: '⚠️ Service Incident',
                                                 title: 'Rate Shopper Interruption',
                                                 msg: 'We are currently experiencing API rate throttling with global OTA search indexes. System operations are running at reduced frequency.',
                                                 type: 'warning'
                                             },
                                             {
                                                 label: '📢 Platform Update',
                                                 title: 'Core Engine Performance Boost',
                                                 msg: 'Our core database servers have been migrated to cloud compute clusters. Average API response times have decreased by 40%.',
                                                 type: 'info'
                                             }
                                         ].map((tpl, i) => (
                                             <button
                                                 key={i}
                                                 type="button"
                                                 className="py-2 px-3 border border-border rounded-xl text-left text-[10px] font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                                                 onClick={() => {
                                                     setBroadcastTitle(tpl.title);
                                                     setBroadcastMessage(tpl.msg);
                                                     setBroadcastType(tpl.type);
                                                 }}
                                             >
                                                 {tpl.label}
                                             </button>
                                         ))}
                                     </div>
                                 </div>

                                 <div className="space-y-5">
                                     <div>
                                         <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Banner Title</label>
                                         <Input
                                             placeholder="e.g. Scheduled System Upkeep"
                                             className="h-12 bg-muted/30 border-border rounded-xl font-medium focus:ring-2 focus:ring-primary/20"
                                             value={broadcastTitle}
                                             onChange={(e: any) => setBroadcastTitle(e.target.value)}
                                         />
                                     </div>

                                     <div>
                                         <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Announcement Message</label>
                                         <textarea
                                             placeholder="Provide complete maintenance windows or platform updates..."
                                             rows={4}
                                             className="w-full p-4 bg-muted/30 border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                                             value={broadcastMessage}
                                             onChange={(e: any) => setBroadcastMessage(e.target.value)}
                                         />
                                     </div>

                                     <div>
                                         <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Severity Classification</label>
                                         <div className="grid grid-cols-3 gap-3">
                                             {[
                                                 { label: 'Info', value: 'info', bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' },
                                                 { label: 'Warning', value: 'warning', bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
                                                 { label: 'Success', value: 'success', bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' }
                                             ].map((t) => (
                                                 <button
                                                     key={t.value}
                                                     type="button"
                                                     onClick={() => setBroadcastType(t.value)}
                                                     className={`py-3 px-4 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                                         broadcastType === t.value ? `${t.bg} shadow-md scale-105 ring-2 ring-primary/20` : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                                                     }`}
                                                 >
                                                     {t.value === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> : null}
                                                     {t.label}
                                                 </button>
                                             ))}
                                         </div>
                                     </div>

                                     {/* Real-time Banner Live Preview */}
                                     <div className="border border-dashed border-border rounded-xl p-4 bg-muted/15 space-y-2">
                                         <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block flex items-center gap-1.5">
                                             <Eye className="w-3.5 h-3.5 text-primary" /> Banner Live Preview
                                         </span>
                                         {broadcastTitle || broadcastMessage ? (
                                             <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                                                 broadcastType === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400' : broadcastType === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400'
                                             }`}>
                                                 <Radio className="w-5 h-5 animate-pulse flex-shrink-0 mt-0.5" />
                                                 <div className="space-y-1">
                                                     <h5 className="font-bold text-xs leading-none">{broadcastTitle || 'Preview Title'}</h5>
                                                     <p className="text-[11px] leading-relaxed font-medium opacity-90">{broadcastMessage || 'Preview Message...'}</p>
                                                 </div>
                                             </div>
                                         ) : (
                                             <div className="text-center py-6 text-muted-foreground italic text-xs font-medium">
                                                 Start typing or pick a template to see preview
                                             </div>
                                         )}
                                     </div>

                                     <Button
                                         className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-bold h-12 rounded-xl shadow-lg shadow-primary/5 dark:shadow-none transition-all gap-2"
                                         disabled={!broadcastTitle || !broadcastMessage || createBroadcastMutation.isPending}
                                         onClick={() => createBroadcastMutation.mutate({
                                             title: broadcastTitle,
                                             message: broadcastMessage,
                                             type: broadcastType
                                         })}
                                     >
                                         <Send className="w-4 h-4" /> Publish Global Broadcast
                                     </Button>
                                 </div>
                             </Card>

                             <Card className="border-border shadow-sm rounded-2xl p-8 bg-background lg:col-span-2 min-h-[400px]">
                                 <div className="flex items-center justify-between mb-8">
                                     <div>
                                         <h3 className="text-2xl font-black text-foreground tracking-tight">Active Platform Broadcasts</h3>
                                         <p className="text-sm text-muted-foreground font-medium mt-1">Manage global announcement banners appearing on all client interfaces.</p>
                                     </div>
                                     <Button
                                         variant="outline"
                                         className="rounded-xl border-border bg-background font-bold h-11 px-6 hover:bg-muted/30 transition-colors"
                                         onClick={() => refetchBroadcasts()}
                                     >
                                         <RefreshCw className="w-4 h-4 mr-2" /> Sync Banners
                                     </Button>
                                 </div>

                                 <div className="space-y-4">
                                     {isLoadingBroadcasts ? (
                                         <div className="h-64 flex flex-col items-center justify-center gap-3">
                                             <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                                             <span className="text-sm font-bold text-muted-foreground animate-pulse">Syncing Broadcast Channels...</span>
                                         </div>
                                     ) : broadcasts.length === 0 ? (
                                         <div className="h-64 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center p-8 bg-muted/15">
                                             <Radio className="w-12 h-12 text-muted-foreground/30 mb-3 animate-pulse" />
                                             <h5 className="text-base font-bold text-foreground">No Active Announcements</h5>
                                             <p className="text-xs text-muted-foreground font-medium max-w-sm mt-1">Create a broadcast banner using the control module to broadcast live alerts across the enterprise.</p>
                                         </div>
                                     ) : broadcasts.map((b: any) => (
                                         <div
                                             key={b.id}
                                             className={`p-6 rounded-2xl border flex items-start justify-between gap-6 transition-all shadow-sm hover:shadow-md ${
                                                 b.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20' : b.type === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-blue-500/5 border-blue-500/20'
                                             }`}
                                         >
                                             <div className="flex gap-4 items-start">
                                                 <div className={`p-3 rounded-2xl border ${
                                                     b.type === 'warning' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' : b.type === 'success' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                                                 }`}>
                                                     <Radio className="w-6 h-6 animate-pulse" />
                                                 </div>
                                                 <div className="space-y-1.5">
                                                     <div className="flex items-center gap-3">
                                                         <h4 className="text-base font-black text-foreground tracking-tight">{b.title}</h4>
                                                         <Badge className={`rounded-lg px-2.5 py-0.5 font-black text-[9px] uppercase tracking-wider ${
                                                             b.type === 'warning' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30' : b.type === 'success' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30'
                                                         }`}>
                                                             {b.type}
                                                         </Badge>
                                                     </div>
                                                     <p className="text-xs font-medium text-foreground leading-relaxed">{b.message}</p>
                                                     <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono pt-1">
                                                         <Clock className="w-3 h-3 text-muted-foreground" /> Broadcasted: {format(new Date(b.created_at), 'dd MMM yyyy, HH:mm')}
                                                     </div>
                                                 </div>
                                             </div>

                                             <Button
                                                 variant="ghost"
                                                 size="icon"
                                                 className="rounded-xl hover:bg-background hover:text-destructive hover:shadow-sm transition-all text-muted-foreground self-center"
                                                 onClick={() => {
                                                     if (confirm("Deactivate and remove this platform broadcast?")) {
                                                         deleteBroadcastMutation.mutate(b.id);
                                                     }
                                                 }}
                                             >
                                                 <Trash2 className="w-5 h-5" />
                                             </Button>
                                         </div>
                                     ))}
                                 </div>
                             </Card>
                         </div>
                     </TabsContent>

                    
    </>
  );
}