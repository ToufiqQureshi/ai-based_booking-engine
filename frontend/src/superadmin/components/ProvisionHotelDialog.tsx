// ProvisionHotelDialog.tsx
// Superadmin "Add Hotel" dialog — creates hotel + sends Supabase invite email to owner.

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  User,
  Mail,
  CreditCard,
  Loader2,
  CheckCircle2,
  Send,
} from 'lucide-react';

interface ProvisionPayload {
  hotel_name: string;
  owner_name: string;
  owner_email: string;
  plan_name: string;
}

interface ProvisionResult {
  message: string;
  hotel_id: string;
  hotel_slug: string;
  owner_email: string;
  plan: string;
  subscription_end_date: string;
}

interface ProvisionHotelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLAN_OPTIONS = [
  { value: 'Basic',      label: 'Basic — ₹1,999/mo',      color: 'text-blue-600' },
  { value: 'Pro',        label: 'Pro — ₹4,999/mo',        color: 'text-purple-600' },
  { value: 'Enterprise', label: 'Enterprise — ₹49,999/yr', color: 'text-amber-600' },
];

export function ProvisionHotelDialog({ open, onOpenChange }: ProvisionHotelDialogProps) {
  const qc = useQueryClient();
  const [result, setResult] = useState<ProvisionResult | null>(null);

  const [form, setForm] = useState<ProvisionPayload>({
    hotel_name: '',
    owner_name: '',
    owner_email: '',
    plan_name: 'Basic',
  });

  const mutation = useMutation({
    mutationFn: (data: ProvisionPayload) =>
      apiClient.post<ProvisionResult>('/superadmin/hotels/provision', data),
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ['superadmin-hotels'] });
      qc.invalidateQueries({ queryKey: ['superadmin-users'] });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail ?? err?.message ?? 'Provisioning failed';
      toast.error(detail);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.hotel_name.trim() || !form.owner_name.trim() || !form.owner_email.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    mutation.mutate(form);
  };

  const handleClose = () => {
    setResult(null);
    setForm({ hotel_name: '', owner_name: '', owner_email: '', plan_name: 'Basic' });
    mutation.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {result ? (
          /* ── Success State ── */
          <div className="flex flex-col items-center gap-5 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold">Hotel Provisioned!</h3>
              <p className="text-sm text-muted-foreground">
                Invite email sent to{' '}
                <span className="font-semibold text-foreground">{result.owner_email}</span>.
                They'll set their password and access the dashboard.
              </p>
            </div>
            <div className="w-full rounded-lg border bg-muted/40 p-4 text-left text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hotel</span>
                <span className="font-semibold">{form.hotel_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slug</span>
                <span className="font-mono text-xs">{result.hotel_slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-semibold">{result.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valid Until</span>
                <span className="font-semibold">
                  {new Date(result.subscription_end_date).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
              </div>
            </div>
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          /* ── Form ── */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Add Hotel
              </DialogTitle>
              <DialogDescription>
                Creates the hotel, subscription &amp; sends a "Set Password" invite email to the owner via Supabase.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              {/* Hotel Name */}
              <div className="space-y-1.5">
                <Label htmlFor="ph-hotel-name" className="flex items-center gap-1.5 text-sm font-medium">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Hotel Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ph-hotel-name"
                  placeholder="The Grand Hyatt"
                  value={form.hotel_name}
                  onChange={e => setForm(f => ({ ...f, hotel_name: e.target.value }))}
                  required
                  autoFocus
                />
              </div>

              {/* Owner Name */}
              <div className="space-y-1.5">
                <Label htmlFor="ph-owner-name" className="flex items-center gap-1.5 text-sm font-medium">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Owner Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ph-owner-name"
                  placeholder="Rahul Sharma"
                  value={form.owner_name}
                  onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
                  required
                />
              </div>

              {/* Owner Email */}
              <div className="space-y-1.5">
                <Label htmlFor="ph-owner-email" className="flex items-center gap-1.5 text-sm font-medium">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Owner Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ph-owner-email"
                  type="email"
                  placeholder="owner@thehotel.com"
                  value={form.owner_email}
                  onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  A "Set Your Password" email will be sent to this address via Supabase.
                </p>
              </div>

              {/* Plan */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  Subscription Plan
                </Label>
                <Select
                  value={form.plan_name}
                  onValueChange={v => setForm(f => ({ ...f, plan_name: v }))}
                >
                  <SelectTrigger id="ph-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className={p.color + ' font-semibold'}>{p.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending} className="gap-2">
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Provisioning...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Create &amp; Send Invite
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ProvisionHotelDialog;
