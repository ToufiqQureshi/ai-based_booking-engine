import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Search, Loader2, Building2, Plus, Shield, Users, Mail, Phone, Calendar, Globe, Trash2, CheckCircle2, Lock, Tag, MapPin, Edit, Settings2, BarChart3, Radio, RefreshCw, Smartphone, Key, Star, LayoutGrid, CheckSquare, XSquare, MessageSquare, ListFilter, PlayCircle, Filter, Download, Zap, UploadCloud, ChevronRight, Save, LayoutTemplate, Activity, AlertTriangle, ShieldCheck, FileText, Send, Eye, X, Crown, Clock, Copy, ArrowRight, UserCheck, CheckCircle, SlidersHorizontal, Settings, BrainCircuit, TrendingUp, Sliders, Sparkles } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

export function PlanFeaturesTab() {
    const queryClient = useQueryClient();
    const [editedPlanFeatures, setEditedPlanFeatures] = useState<Record<string, Record<string, boolean>>>({});

    const { data: planFeatures = {}, isLoading: isLoadingPlanFeatures } = useQuery<Record<string, Record<string, boolean>>>({
        queryKey: ['superadmin-plan-features'],
        queryFn: () => apiClient.get('/superadmin/plan-features')
    });

    useEffect(() => {
        if (planFeatures && Object.keys(planFeatures).length > 0) {
            setEditedPlanFeatures(planFeatures);
        }
    }, [planFeatures]);

    const updatePlanFeaturesMutation = useMutation({
        mutationFn: (data: Record<string, Record<string, boolean>>) =>
            apiClient.post('/superadmin/plan-features', data),
        onSuccess: () => {
            toast.success("Global plan-to-feature matrix saved and active properties synced.");
            queryClient.invalidateQueries({ queryKey: ['superadmin-plan-features'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to update plan features matrix.");
        }
    });

  return (
    <>
<div>
                        <Card className="border-border shadow-sm overflow-hidden rounded-2xl bg-background">
                            <CardHeader className="border-b border-border bg-slate-50/40 p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                                            <Crown className="w-5 h-5 text-amber-500" /> Plan Features Allocation Matrix
                                        </CardTitle>
                                        <CardDescription className="text-xs text-muted-foreground font-medium mt-1">
                                            Define which features are unlocked by default for each subscription tier. Saving updates will instantly sync all active properties matching these plans.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        onClick={() => updatePlanFeaturesMutation.mutate(editedPlanFeatures)}
                                        disabled={updatePlanFeaturesMutation.isPending || Object.keys(editedPlanFeatures).length === 0}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all flex items-center gap-2"
                                    >
                                        {updatePlanFeaturesMutation.isPending ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" /> Saving Matrix...
                                            </>
                                        ) : (
                                            <>
                                                <ShieldCheck className="w-4 h-4" /> Save Configuration Matrix
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>

                            <div className="p-6">
                                {isLoadingPlanFeatures ? (
                                    <div className="flex flex-col items-center justify-center p-20 gap-4">
                                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                        <p className="text-xs font-semibold text-muted-foreground">Loading Matrix Configuration...</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border border-border rounded-xl">
                                        <Table>
                                            <TableHeader className="bg-muted/30 border-b border-border">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="w-[380px] text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 pl-6">
                                                        System Feature Controls
                                                    </TableHead>
                                                    {['Free', 'Basic', 'Premium', 'Enterprise'].map((plan) => (
                                                        <TableHead key={plan} className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={cn(
                                                                    "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                                                    plan === 'Enterprise' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400' :
                                                                    plan === 'Premium' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' :
                                                                    plan === 'Basic' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
                                                                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                                                )}>
                                                                    {plan} Plan
                                                                </span>
                                                            </div>
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {[
                                                    { key: 'feature_ai_agent', name: 'AI Reservation Agent', desc: 'Auto-pilot booking assistant & email responder.', icon: BrainCircuit, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/20' },
                                                    { key: 'feature_guest_bot', name: 'Guest Bot & Widgets', desc: 'Live chat widget and customer care automated flows.', icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/20' },
                                                    { key: 'feature_rate_shopper', name: 'Rate Shopper Engine', desc: 'Track competitors pricing updates in real-time.', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
                                                    { key: 'feature_new_booking', name: 'Manual Calendar Bookings', desc: 'Let hoteliers create reservations from calendar directly.', icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20' },
                                                    { key: 'feature_color_palette', name: 'Color Customizer Theme Builder', desc: 'Tailor brand styles, primary colors, and button radii.', icon: Sliders, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' },
                                                    { key: 'feature_custom_logo', name: 'Custom Logo Branding', desc: 'Swap default Staybooker logos with property branding.', icon: Sparkles, color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-950/20' },
                                                    { key: 'feature_custom_widget', name: 'Widget Custom Embedding', desc: 'Generate JS embedding snippet block for hotel websites.', icon: Globe, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950/20' }
                                                ].map((feat) => (
                                                    <TableRow key={feat.key} className="hover:bg-muted/5 transition-colors border-b border-border last:border-0">
                                                        <TableCell className="py-4 pl-6">
                                                            <div className="flex items-start gap-3">
                                                                <div className={cn("p-2.5 rounded-xl shrink-0 border border-border", feat.bg, feat.color)}>
                                                                    <feat.icon className="w-4 h-4" />
                                                                </div>
                                                                <div className="space-y-0.5">
                                                                    <p className="font-bold text-sm text-foreground">{feat.name}</p>
                                                                    <p className="text-[11px] text-muted-foreground font-medium leading-relaxed max-w-[280px]">
                                                                        {feat.desc}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        {['Free', 'Basic', 'Premium', 'Enterprise'].map((plan) => {
                                                            const isChecked = editedPlanFeatures[plan]?.[feat.key] || false;
                                                            return (
                                                                <TableCell key={plan} className="text-center">
                                                                    <div className="flex justify-center items-center">
                                                                        <Switch
                                                                            checked={isChecked}
                                                                            onCheckedChange={(checked) => {
                                                                                setEditedPlanFeatures(prev => ({
                                                                                    ...prev,
                                                                                    [plan]: {
                                                                                        ...prev[plan],
                                                                                        [feat.key]: checked
                                                                                    }
                                                                                }));
                                                                            }}
                                                                            className="data-[state=checked]:bg-indigo-600 scale-105"
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
                                )}
                            </div>
                        </Card>
                    </div>
                
    </>
  );
}