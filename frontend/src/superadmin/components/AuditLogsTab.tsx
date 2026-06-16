import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Search, Loader2, Building2, Plus, Shield, Users, Mail, Phone, Calendar, Globe, Trash2, CheckCircle2, Lock, Tag, MapPin, Edit, Settings2, BarChart3, Radio, RefreshCw, Smartphone, Key, Star, LayoutGrid, CheckSquare, XSquare, MessageSquare, ListFilter, PlayCircle, Filter, Download, Zap, UploadCloud, ChevronRight, Save, LayoutTemplate, Activity, AlertTriangle, ShieldCheck, FileText, Send, Eye, X, Crown, Clock, Copy, ArrowRight, UserCheck, CheckCircle, SlidersHorizontal, Settings, XCircle } from 'lucide-react';
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
import { cn } from '@/core/lib/utils';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';

export function AuditLogsTab() {
    const [auditSearchQuery, setAuditSearchQuery] = React.useState('');
    const [auditActionFilter, setAuditActionFilter] = React.useState('all');

    const { data: auditLogs = [], isLoading: isLoadingAudit, refetch: refetchAudit } = useQuery<any[]>({
        queryKey: ['superadmin-audit-logs'],
        queryFn: () => apiClient.get('/superadmin/audit-logs'),
    });

    const filteredAuditLogs = auditLogs.filter(log => {
        const matchesSearch =
            (log.description || '').toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
            (log.user_email || '').toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
            (log.action || '').toLowerCase().includes(auditSearchQuery.toLowerCase());

        const matchesAction = auditActionFilter === 'all' || (log.action || '').toUpperCase() === auditActionFilter.toUpperCase();

        return matchesSearch && matchesAction;
    });

    const uniqueAuditActions = Array.from(new Set(auditLogs.map(log => (log.action || '').toUpperCase()).filter(Boolean)));

  return (
    <>
<div>
                        <Card className="border-border shadow-sm rounded-2xl p-8 bg-background min-h-[400px]">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-foreground tracking-tight">Security Audit & Activity Trail</h3>
                                    <p className="text-sm text-muted-foreground font-medium mt-1">Immutable record of enterprise administration events and system modifications.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        className="rounded-xl border-border bg-background font-bold h-11 px-6 hover:bg-muted/30 transition-colors"
                                        onClick={() => refetchAudit()}
                                    >
                                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh Trail
                                    </Button>
                                </div>
                            </div>

                            {/* Audit Filter Panel */}
                            <div className="p-5 border border-border/80 bg-muted/15 rounded-2xl flex flex-wrap gap-4 items-center justify-between mb-6">
                                <div className="flex flex-wrap gap-4 items-center flex-1">
                                    {/* Keyword Search */}
                                    <div className="relative flex-1 min-w-[280px]">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground focus-within:text-primary transition-colors" />
                                        <input
                                            placeholder="Search by operator email, action or description..."
                                            className="bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-medium"
                                            value={auditSearchQuery}
                                            onChange={(e) => setAuditSearchQuery(e.target.value)}
                                        />
                                        {auditSearchQuery && (
                                            <button 
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                onClick={() => setAuditSearchQuery('')}
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Action Type Dropdown */}
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                                            Action Type:
                                        </label>
                                        <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                                            <SelectTrigger className="w-[180px] h-10 rounded-xl border-border bg-background text-xs font-bold text-foreground">
                                                <SelectValue placeholder="All Actions" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border bg-background">
                                                <SelectItem value="all">All Actions</SelectItem>
                                                {uniqueAuditActions.map((act) => (
                                                    <SelectItem key={act} value={act}>{act}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Reset Filter Button */}
                                {(auditSearchQuery !== '' || auditActionFilter !== 'all') && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setAuditSearchQuery('');
                                            setAuditActionFilter('all');
                                        }}
                                        className="h-10 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/10 rounded-xl px-4 flex items-center gap-1.5 border border-primary/20"
                                    >
                                        <XCircle className="w-4 h-4" /> Clear Logs Filter
                                    </Button>
                                )}
                            </div>

                            <div className="overflow-x-auto border border-border rounded-2xl">
                                <Table>
                                    <TableHeader className="bg-muted/30 border-b border-border">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 pl-6">Timestamp</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operator Email</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action Type</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description / Details</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-6">IP Address</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoadingAudit ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-64 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                                        <span className="text-sm font-bold text-muted-foreground animate-pulse">Loading Audit Logs...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredAuditLogs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-64 text-center text-muted-foreground font-bold italic">
                                                    No audit log trail matches your filters.
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredAuditLogs.map((log) => (
                                            <TableRow key={log.id} className="hover:bg-muted/15 transition-colors border-border">
                                                <TableCell className="py-4 pl-6 text-xs font-mono font-medium text-muted-foreground whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                                        {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm:ss')}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-bold text-foreground text-xs">
                                                    {log.user_email}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className="rounded-lg px-2.5 py-1 font-black text-[9px] uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-sm">
                                                        {log.action}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground font-medium max-w-md">
                                                    {log.description}
                                                </TableCell>
                                                <TableCell className="text-right pr-6 font-mono text-[11px] text-muted-foreground">
                                                    {log.ip_address}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    </div>

                     {/* Broadcasts Tab Content */}
                     
    </>
  );
}