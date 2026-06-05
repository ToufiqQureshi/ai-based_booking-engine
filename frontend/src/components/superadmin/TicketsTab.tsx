import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Ticket, AlertTriangle, Inbox, CheckCircle2, RefreshCw, Send, UserCheck, Lock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

const STATUS_STYLES: Record<string, string> = {
    open:               'bg-blue-100 text-blue-700 border-blue-200',
    in_progress:        'bg-amber-100 text-amber-700 border-amber-200',
    awaiting_customer:  'bg-purple-100 text-purple-700 border-purple-200',
    resolved:           'bg-emerald-100 text-emerald-700 border-emerald-200',
    closed:             'bg-muted text-muted-foreground border-border',
};

const PRIORITY_STYLES: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700 border-red-200',
    high:   'bg-orange-100 text-orange-700 border-orange-200',
    normal: 'bg-blue-100 text-blue-700 border-blue-200',
    low:    'bg-muted text-muted-foreground border-border',
};

export function TicketsTab({ hotels = [], admins = [] }: { hotels?: any[]; admins?: any[] }) {
    const qc = useQueryClient();
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [openTicketId, setOpenTicketId] = useState<string | null>(null);
    const [reply, setReply] = useState('');
    const [isInternal, setIsInternal] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [newTicket, setNewTicket] = useState({
        hotel_id: '', subject: '', description: '', category: 'general', priority: 'normal'
    });

    const { data: summary } = useQuery<any>({
        queryKey: ['tickets-summary'],
        queryFn: () => apiClient.get('/superadmin/tickets/summary'),
    });

    const { data: tickets = [], refetch } = useQuery<any[]>({
        queryKey: ['tickets', statusFilter, priorityFilter],
        queryFn: () => {
            const params = new URLSearchParams();
            if (statusFilter) params.set('status_filter', statusFilter);
            if (priorityFilter) params.set('priority', priorityFilter);
            const qs = params.toString();
            return apiClient.get('/superadmin/tickets' + (qs ? `?${qs}` : ''));
        },
    });

    const { data: detail } = useQuery<any>({
        queryKey: ['ticket-detail', openTicketId],
        queryFn: () => apiClient.get(`/superadmin/tickets/${openTicketId}`),
        enabled: !!openTicketId,
    });

    const replyMutation = useMutation({
        mutationFn: () => apiClient.post(`/superadmin/tickets/${openTicketId}/reply`, { body: reply, is_internal_note: isInternal }),
        onSuccess: () => {
            toast.success(isInternal ? 'Internal note added' : 'Reply sent');
            setReply('');
            setIsInternal(false);
            qc.invalidateQueries({ queryKey: ['ticket-detail'] });
            qc.invalidateQueries({ queryKey: ['tickets'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: any) => apiClient.patch(`/superadmin/tickets/${openTicketId}`, data),
        onSuccess: () => {
            toast.success('Ticket updated');
            qc.invalidateQueries({ queryKey: ['ticket-detail'] });
            qc.invalidateQueries({ queryKey: ['tickets'] });
            qc.invalidateQueries({ queryKey: ['tickets-summary'] });
        },
    });

    const assignMutation = useMutation({
        mutationFn: (assignedTo: string) => apiClient.post(`/superadmin/tickets/${openTicketId}/assign`, { assigned_to: assignedTo || null }),
        onSuccess: () => {
            toast.success('Ticket assigned');
            qc.invalidateQueries({ queryKey: ['ticket-detail'] });
            qc.invalidateQueries({ queryKey: ['tickets'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (ticketId: string) => apiClient.delete(`/superadmin/tickets/${ticketId}`),
        onSuccess: () => {
            toast.success('Ticket deleted');
            setOpenTicketId(null);
            qc.invalidateQueries({ queryKey: ['tickets'] });
            qc.invalidateQueries({ queryKey: ['tickets-summary'] });
        },
        onError: (err: any) => toast.error(err?.message || 'Could not delete ticket'),
    });

    const createMutation = useMutation({
        mutationFn: () => apiClient.post('/superadmin/tickets', newTicket),
        onSuccess: () => {
            toast.success('Ticket created');
            setShowNew(false);
            setNewTicket({ hotel_id: '', subject: '', description: '', category: 'general', priority: 'normal' });
            qc.invalidateQueries({ queryKey: ['tickets'] });
            qc.invalidateQueries({ queryKey: ['tickets-summary'] });
        },
    });

    const byStatus = summary?.by_status || {};
    const totalOpen = (byStatus.open || 0) + (byStatus.in_progress || 0) + (byStatus.awaiting_customer || 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-foreground">Support Tickets</h2>
                    <p className="text-sm text-muted-foreground">
                        {totalOpen} open · {summary?.unassigned ?? 0} unassigned · {summary?.sla_breach ?? 0} SLA breach
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-xl gap-1.5 h-9">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </Button>
                    <Button size="sm" onClick={() => setShowNew(true)} className="rounded-xl gap-1.5 h-9 bg-indigo-600 hover:bg-indigo-700">
                        <Ticket className="w-3.5 h-3.5" /> New Ticket
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { key: 'open',              icon: Inbox,          label: 'Open' },
                    { key: 'in_progress',       icon: RefreshCw,      label: 'In Progress' },
                    { key: 'awaiting_customer', icon: UserCheck,      label: 'Awaiting' },
                    { key: 'resolved',          icon: CheckCircle2,   label: 'Resolved' },
                    { key: 'closed',            icon: Lock,           label: 'Closed' },
                ].map(s => (
                    <button key={s.key} onClick={() => setStatusFilter(statusFilter === s.key ? '' : s.key)}
                        className={cn(
                            'p-3 rounded-2xl border bg-background text-left transition-all',
                            statusFilter === s.key ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-border hover:border-muted-foreground/30'
                        )}>
                        <s.icon className="w-4 h-4 text-muted-foreground mb-1.5" />
                        <p className="text-xl font-black text-foreground">{byStatus[s.key] ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground font-semibold">{s.label}</p>
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2">
                <Select value={priorityFilter || 'all'} onValueChange={(v) => setPriorityFilter(v === 'all' ? '' : v)}>
                    <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All priorities" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All priorities</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                </Select>
                {(statusFilter || priorityFilter) && (
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setStatusFilter(''); setPriorityFilter(''); }}>Clear filters</Button>
                )}
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-background">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/10">
                            <th className="text-left py-2 pl-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ticket</th>
                            <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">From</th>
                            <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Priority</th>
                            <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                            <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">Created</th>
                            <th className="text-right py-2 pr-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tickets.length === 0 ? (
                            <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No tickets match these filters</td></tr>
                        ) : tickets.map((t: any) => {
                            const slaBreached = t.sla_due_at && new Date(t.sla_due_at) < new Date() && !['resolved', 'closed'].includes(t.status);
                            return (
                                <tr key={t.id} className={cn("border-b border-border/60 hover:bg-muted/20 transition-colors cursor-pointer", slaBreached && "bg-red-50/40 dark:bg-red-950/10")}
                                    onClick={() => setOpenTicketId(t.id)}>
                                    <td className="py-3 pl-5">
                                        <p className="font-bold text-foreground text-sm">{t.subject}</p>
                                        <p className="text-[10px] font-mono text-muted-foreground">{t.ticket_number} · {t.category}</p>
                                    </td>
                                    <td className="py-3 px-3 text-xs">
                                        <p className="font-semibold">{t.raised_by_email}</p>
                                        {slaBreached && <p className="text-[10px] text-red-600 font-bold">⏰ SLA breach</p>}
                                    </td>
                                    <td className="py-3 px-3">
                                        <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border", PRIORITY_STYLES[t.priority])}>
                                            {t.priority}
                                        </Badge>
                                    </td>
                                    <td className="py-3 px-3">
                                        <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border", STATUS_STYLES[t.status])}>
                                            {t.status.replace('_', ' ')}
                                        </Badge>
                                    </td>
                                    <td className="py-3 px-3 hidden md:table-cell text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                                    </td>
                                    <td className="py-3 pr-5 text-right text-[10px] text-muted-foreground">
                                        {t.assigned_to_email ? <span title={t.assigned_to_email}>👤 assigned</span> : 'Unassigned'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Ticket Detail */}
            <Dialog open={!!openTicketId} onOpenChange={(open) => !open && setOpenTicketId(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    {detail && (
                        <>
                            <DialogHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <DialogTitle className="text-base">{detail.ticket.subject}</DialogTitle>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {detail.ticket.ticket_number} · from {detail.ticket.raised_by_email}
                                            {detail.hotel && ` · ${detail.hotel.name}`}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border", PRIORITY_STYLES[detail.ticket.priority])}>
                                            {detail.ticket.priority}
                                        </Badge>
                                        <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border", STATUS_STYLES[detail.ticket.status])}>
                                            {detail.ticket.status.replace('_', ' ')}
                                        </Badge>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="flex items-center gap-2 pb-2 border-b border-border">
                                <Select value={detail.ticket.status} onValueChange={(v) => updateMutation.mutate({ status: v })}>
                                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="open">Open</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="awaiting_customer">Awaiting Customer</SelectItem>
                                        <SelectItem value="resolved">Resolved</SelectItem>
                                        <SelectItem value="closed">Closed</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={detail.ticket.priority} onValueChange={(v) => updateMutation.mutate({ priority: v })}>
                                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="low">Low</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={detail.ticket.assigned_to || 'unassigned'} onValueChange={(v) => assignMutation.mutate(v === 'unassigned' ? '' : v)}>
                                    <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder="Assign…" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {admins.filter(a => a.role === 'SUPER_ADMIN').map((a: any) => (
                                            <SelectItem key={a.id} value={a.id}>{a.name || a.email}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 max-h-72 overflow-y-auto py-2">
                                {detail.messages.map((m: any) => (
                                    <div key={m.id} className={cn(
                                        'p-3 rounded-xl border',
                                        m.is_internal_note ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200' :
                                        m.author_type === 'super_admin' ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200' :
                                        'bg-muted/30 border-border'
                                    )}>
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-xs font-bold text-foreground">
                                                {m.author_name || m.author_email}
                                                {m.is_internal_note && <Badge className="ml-2 text-[8px] bg-amber-100 text-amber-700">internal note</Badge>}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">{format(new Date(m.created_at), 'dd MMM, HH:mm')}</p>
                                        </div>
                                        <p className="text-sm text-foreground whitespace-pre-wrap">{m.body}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2 pt-2 border-t border-border">
                                <Textarea placeholder="Type your reply…" value={reply} onChange={e => setReply(e.target.value)} rows={3} />
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-xs">
                                        <Switch checked={isInternal} onCheckedChange={setIsInternal} /> Internal note (not sent to hotelier)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                if (window.confirm(`Delete ticket ${detail.ticket.ticket_number}? This permanently removes it and its messages.`)) {
                                                    deleteMutation.mutate(detail.ticket.id);
                                                }
                                            }}
                                            disabled={deleteMutation.isPending}
                                            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </Button>
                                        <Button size="sm" onClick={() => replyMutation.mutate()} disabled={!reply.trim()} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
                                            <Send className="w-3.5 h-3.5" /> Send
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* New Ticket */}
            <Dialog open={showNew} onOpenChange={setShowNew}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>New Ticket</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Hotel (optional)</Label>
                            <Select value={newTicket.hotel_id || 'none'} onValueChange={(v) => setNewTicket({ ...newTicket, hotel_id: v === 'none' ? '' : v })}>
                                <SelectTrigger><SelectValue placeholder="No hotel" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No hotel</SelectItem>
                                    {hotels.map((h: any) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Subject *</Label>
                            <Input value={newTicket.subject} onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })} />
                        </div>
                        <div>
                            <Label className="text-xs">Description *</Label>
                            <Textarea value={newTicket.description} onChange={e => setNewTicket({ ...newTicket, description: e.target.value })} rows={4} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Category</Label>
                                <Select value={newTicket.category} onValueChange={(v) => setNewTicket({ ...newTicket, category: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general">General</SelectItem>
                                        <SelectItem value="billing">Billing</SelectItem>
                                        <SelectItem value="technical">Technical</SelectItem>
                                        <SelectItem value="integration">Integration</SelectItem>
                                        <SelectItem value="account">Account</SelectItem>
                                        <SelectItem value="bug">Bug</SelectItem>
                                        <SelectItem value="feature_request">Feature Request</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs">Priority</Label>
                                <Select value={newTicket.priority} onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="low">Low</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
                        <Button onClick={() => createMutation.mutate()} disabled={!newTicket.subject || !newTicket.description} className="bg-indigo-600 hover:bg-indigo-700">Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
