import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { ShieldCheck, FileText, CheckCircle2, XCircle, Clock, AlertTriangle, Plus, RefreshCw, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_STYLES: Record<string, string> = {
    verified:   'bg-emerald-100 text-emerald-700 border-emerald-200',
    in_review:  'bg-amber-100 text-amber-700 border-amber-200',
    submitted:  'bg-blue-100 text-blue-700 border-blue-200',
    incomplete: 'bg-muted text-muted-foreground border-border',
    rejected:   'bg-red-100 text-red-700 border-red-200',
    approved:   'bg-emerald-100 text-emerald-700 border-emerald-200',
    pending:    'bg-amber-100 text-amber-700 border-amber-200',
};

const DOC_TYPES = ['PAN', 'GST', 'AADHAAR', 'BANK_PROOF', 'OWNERSHIP_PROOF', 'OTHER'];

export function KycTab() {
    const qc = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
    const [rejectDocId, setRejectDocId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [showAddDoc, setShowAddDoc] = useState(false);
    const [newDoc, setNewDoc] = useState({ doc_type: 'PAN', doc_number: '', doc_url: '', file_name: '' });

    const { data: overview } = useQuery<any>({
        queryKey: ['kyc-overview'],
        queryFn: () => apiClient.get('/superadmin/kyc/overview'),
    });

    const { data: profiles = [], isLoading, refetch } = useQuery<any[]>({
        queryKey: ['kyc-profiles', statusFilter],
        queryFn: () => apiClient.get('/superadmin/kyc/profiles' + (statusFilter ? `?status_filter=${statusFilter}` : '')),
    });

    const { data: detail } = useQuery<any>({
        queryKey: ['kyc-detail', selectedHotelId],
        queryFn: () => apiClient.get(`/superadmin/kyc/hotels/${selectedHotelId}`),
        enabled: !!selectedHotelId,
    });

    const approveMutation = useMutation({
        mutationFn: (docId: string) => apiClient.post(`/superadmin/kyc/documents/${docId}/approve`, {}),
        onSuccess: () => {
            toast.success('Document approved');
            qc.invalidateQueries({ queryKey: ['kyc-detail'] });
            qc.invalidateQueries({ queryKey: ['kyc-profiles'] });
            qc.invalidateQueries({ queryKey: ['kyc-overview'] });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: (data: { docId: string; reason: string }) =>
            apiClient.post(`/superadmin/kyc/documents/${data.docId}/reject`, { reason: data.reason }),
        onSuccess: () => {
            toast.success('Document rejected');
            setRejectDocId(null);
            setRejectReason('');
            qc.invalidateQueries({ queryKey: ['kyc-detail'] });
            qc.invalidateQueries({ queryKey: ['kyc-profiles'] });
            qc.invalidateQueries({ queryKey: ['kyc-overview'] });
        },
    });

    const deleteDocMutation = useMutation({
        mutationFn: (docId: string) => apiClient.delete(`/superadmin/kyc/documents/${docId}`),
        onSuccess: () => {
            toast.success('Document removed');
            qc.invalidateQueries({ queryKey: ['kyc-detail'] });
            qc.invalidateQueries({ queryKey: ['kyc-profiles'] });
        },
    });

    const addDocMutation = useMutation({
        mutationFn: () => apiClient.post(`/superadmin/kyc/hotels/${selectedHotelId}/documents`, newDoc),
        onSuccess: () => {
            toast.success('Document added');
            setShowAddDoc(false);
            setNewDoc({ doc_type: 'PAN', doc_number: '', doc_url: '', file_name: '' });
            qc.invalidateQueries({ queryKey: ['kyc-detail'] });
        },
        onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to add document'),
    });

    const overviewCounts = overview?.by_status || {};

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-foreground">KYC Verification</h2>
                    <p className="text-sm text-muted-foreground">
                        {overview?.total_hotels ?? 0} hotels · {overview?.pending_docs ?? 0} docs pending review
                    </p>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 font-semibold h-9" onClick={() => refetch()}>
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { key: 'verified',   icon: ShieldCheck,    label: 'Verified',   color: 'text-emerald-600 bg-emerald-50' },
                    { key: 'in_review',  icon: Clock,          label: 'In Review',  color: 'text-amber-600 bg-amber-50' },
                    { key: 'submitted',  icon: FileText,       label: 'Submitted',  color: 'text-blue-600 bg-blue-50' },
                    { key: 'incomplete', icon: AlertTriangle,  label: 'Incomplete', color: 'text-muted-foreground bg-muted' },
                    { key: 'rejected',   icon: XCircle,        label: 'Rejected',   color: 'text-red-600 bg-red-50' },
                ].map(s => (
                    <button key={s.key} onClick={() => setStatusFilter(statusFilter === s.key ? '' : s.key)}
                        className={cn(
                            'p-4 rounded-2xl border bg-background text-left transition-all',
                            statusFilter === s.key ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-border hover:border-muted-foreground/30'
                        )}>
                        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-2', s.color)}>
                            <s.icon className="w-4 h-4" />
                        </div>
                        <p className="text-2xl font-black text-foreground">{overviewCounts[s.key] ?? 0}</p>
                        <p className="text-xs text-muted-foreground font-semibold">{s.label}</p>
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="border border-border rounded-2xl overflow-hidden bg-background">
                <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Hotels {statusFilter && `· filtered: ${statusFilter}`}</p>
                    {statusFilter && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setStatusFilter('')}>Clear</Button>
                    )}
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/10">
                            <th className="text-left py-2 pl-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hotel</th>
                            <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                            <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Docs</th>
                            <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">Updated</th>
                            <th className="text-right py-2 pr-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Loading…</td></tr>
                        ) : profiles.length === 0 ? (
                            <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No KYC profiles yet</td></tr>
                        ) : profiles.map((p: any) => (
                            <tr key={p.hotel_id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                                <td className="py-3 pl-5">
                                    <p className="font-bold text-foreground text-sm">{p.hotel_name}</p>
                                    <p className="text-[10px] font-mono text-muted-foreground">{p.hotel_slug}</p>
                                </td>
                                <td className="py-3 px-3">
                                    <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border", STATUS_STYLES[p.overall_status])}>
                                        {p.overall_status}
                                    </Badge>
                                </td>
                                <td className="py-3 px-3 text-xs">
                                    <span className="text-emerald-600 font-bold">{p.docs_approved}</span>
                                    <span className="text-muted-foreground"> / {p.docs_submitted}</span>
                                    {p.docs_rejected > 0 && <span className="text-red-600 font-bold"> · {p.docs_rejected} rej</span>}
                                </td>
                                <td className="py-3 px-3 hidden md:table-cell text-xs text-muted-foreground">
                                    {p.updated_at ? format(new Date(p.updated_at), 'dd MMM, HH:mm') : '—'}
                                </td>
                                <td className="py-3 pr-5 text-right">
                                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg gap-1.5" onClick={() => setSelectedHotelId(p.hotel_id)}>
                                        <Eye className="w-3 h-3" /> Review
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            <Dialog open={!!selectedHotelId} onOpenChange={(open) => !open && setSelectedHotelId(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-indigo-600" />
                            KYC Review · {detail?.profile?.legal_business_name || 'Hotel'}
                        </DialogTitle>
                    </DialogHeader>

                    {detail && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border">
                                <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border", STATUS_STYLES[detail.profile.overall_status])}>
                                    {detail.profile.overall_status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                    {detail.profile.docs_approved} approved · {detail.profile.docs_submitted} submitted
                                </span>
                            </div>

                            {/* Business Info */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div><span className="text-muted-foreground">PAN:</span> <span className="font-mono font-semibold">{detail.profile.pan_number || '—'}</span></div>
                                <div><span className="text-muted-foreground">GST:</span> <span className="font-mono font-semibold">{detail.profile.gst_number || '—'}</span></div>
                                <div><span className="text-muted-foreground">Owner:</span> <span className="font-semibold">{detail.profile.owner_full_name || '—'}</span></div>
                                <div><span className="text-muted-foreground">Phone:</span> <span className="font-mono">{detail.profile.owner_phone || '—'}</span></div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Documents</p>
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowAddDoc(true)}>
                                        <Plus className="w-3 h-3" /> Add Document
                                    </Button>
                                </div>
                                {detail.documents.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-6">No documents submitted yet</p>
                                ) : (
                                    <div className="space-y-2">
                                        {detail.documents.map((d: any) => (
                                            <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
                                                    <FileText className="w-4 h-4 text-indigo-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-foreground">{d.doc_type}{d.doc_number && ` · ${d.doc_number}`}</p>
                                                    {d.file_name && <p className="text-[10px] text-muted-foreground truncate">{d.file_name}</p>}
                                                    {d.rejection_reason && <p className="text-[10px] text-red-600 mt-0.5">Rejected: {d.rejection_reason}</p>}
                                                </div>
                                                <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border", STATUS_STYLES[d.status])}>
                                                    {d.status}
                                                </Badge>
                                                <div className="flex items-center gap-1">
                                                    {d.doc_url && (
                                                        <a href={d.doc_url} target="_blank" rel="noopener noreferrer">
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><Eye className="w-3.5 h-3.5" /></Button>
                                                        </a>
                                                    )}
                                                    {d.status !== 'approved' && (
                                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600" onClick={() => approveMutation.mutate(d.id)}>
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    {d.status !== 'rejected' && (
                                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => setRejectDocId(d.id)}>
                                                            <XCircle className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
                                                        onClick={() => { if (confirm('Delete this document?')) deleteDocMutation.mutate(d.id); }}>
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Reject Reason Modal */}
            <Dialog open={!!rejectDocId} onOpenChange={(open) => !open && setRejectDocId(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Reject Document</DialogTitle></DialogHeader>
                    <Textarea placeholder="Reason for rejection (visible to hotelier)..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={4} />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRejectDocId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => rejectDocId && rejectMutation.mutate({ docId: rejectDocId, reason: rejectReason || 'Did not meet criteria' })}>Reject</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Doc Modal */}
            <Dialog open={showAddDoc} onOpenChange={setShowAddDoc}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Type</Label>
                            <Select value={newDoc.doc_type} onValueChange={(v) => setNewDoc({ ...newDoc, doc_type: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Document Number</Label>
                            <Input value={newDoc.doc_number} onChange={e => setNewDoc({ ...newDoc, doc_number: e.target.value })} placeholder="ABCDE1234F" />
                        </div>
                        <div>
                            <Label className="text-xs">Document URL *</Label>
                            <Input value={newDoc.doc_url} onChange={e => setNewDoc({ ...newDoc, doc_url: e.target.value })} placeholder="https://..." />
                        </div>
                        <div>
                            <Label className="text-xs">File Name</Label>
                            <Input value={newDoc.file_name} onChange={e => setNewDoc({ ...newDoc, file_name: e.target.value })} placeholder="pan-card.pdf" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowAddDoc(false)}>Cancel</Button>
                        <Button onClick={() => addDocMutation.mutate()} disabled={!newDoc.doc_url}>Add</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
