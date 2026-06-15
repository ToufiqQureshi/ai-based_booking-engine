
import { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface PromoCode {
    id: string;
    code: string;
    name?: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
    start_date?: string;
    end_date?: string;
    max_usage?: number;
    current_usage: number;
    is_active: boolean;
    auto_apply?: boolean;
}

export function PromoManager() {
    const { hotel } = useAuth();
    const { toast } = useToast();
    const [promos, setPromos] = useState<PromoCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        discount_type: 'percentage',
        discount_value: '',
        start_date: '',
        end_date: '',
        max_usage: '',
        auto_apply: false,
    });

    const fetchPromos = async () => {
        if (!hotel) return;
        try {
            const data = await apiClient.get<PromoCode[]>(`/promos?hotel_id=${hotel.id}`);
            setPromos(data);
        } catch (error) {
            console.error('Failed to fetch promos:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPromos();
    }, [hotel]);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this coupon?')) return;
        try {
            await apiClient.delete(`/promos/${id}`);
            setPromos(prev => prev.filter(p => p.id !== id));
            toast({ title: 'Coupon deleted' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to delete' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hotel) return;
        setIsSubmitting(true);
        try {
            // Auto-apply deals need a name (banner label); coded coupons need a code.
            const generatedCode = formData.code.trim().toUpperCase()
                || `AUTO-${(formData.name || 'DEAL').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 16)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
            const payload = {
                hotel_id: hotel.id,
                code: generatedCode,
                name: formData.name || null,
                discount_type: formData.discount_type,
                discount_value: Number(formData.discount_value),
                start_date: formData.start_date || null,
                end_date: formData.end_date || null,
                max_usage: formData.max_usage ? Number(formData.max_usage) : null,
                auto_apply: formData.auto_apply,
            };

            const newPromo = await apiClient.post<PromoCode>('/promos', payload);
            setPromos(prev => [...prev, newPromo]);
            setIsDialogOpen(false);
            setFormData({
                code: '',
                name: '',
                discount_type: 'percentage',
                discount_value: '',
                start_date: '',
                end_date: '',
                max_usage: '',
                auto_apply: false,
            });
            toast({ title: formData.auto_apply ? 'Seasonal deal created' : 'Coupon created successfully' });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error creating coupon',
                description: error.response?.data?.detail || 'Something went wrong'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Promotions & Coupons</CardTitle>
                    <CardDescription>Manage discount codes for your guests</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" /> Create Coupon
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Coupon</DialogTitle>
                            <DialogDescription>Add a new discount code for bookings.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex items-start justify-between gap-3 rounded-lg border p-3 bg-muted/30">
                                <div className="space-y-0.5">
                                    <Label>Seasonal auto-apply deal</Label>
                                    <p className="text-[11px] text-muted-foreground">
                                        On: applies automatically within the dates, no code needed (shown as a banner).
                                        Off: classic coupon the guest types in.
                                    </p>
                                </div>
                                <Switch
                                    checked={formData.auto_apply}
                                    onCheckedChange={v => setFormData({ ...formData, auto_apply: v })}
                                />
                            </div>

                            {formData.auto_apply ? (
                                <div className="space-y-2">
                                    <Label>Deal Name (shown to guests)</Label>
                                    <Input
                                        placeholder="Summer Sale"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label>Coupon Code</Label>
                                    <Input
                                        placeholder="SUMMER20"
                                        value={formData.code}
                                        onChange={e => setFormData({ ...formData, code: e.target.value })}
                                        required
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select
                                        value={formData.discount_type}
                                        onValueChange={v => setFormData({ ...formData, discount_type: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                                            <SelectItem value="fixed_amount">Fixed Amount (₹)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Value</Label>
                                    <Input
                                        type="number"
                                        placeholder="20"
                                        value={formData.discount_value}
                                        onChange={e => setFormData({ ...formData, discount_value: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Date (Optional)</Label>
                                    <Input
                                        type="date"
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date (Optional)</Label>
                                    <Input
                                        type="date"
                                        value={formData.end_date}
                                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Usage Limit (Optional)</Label>
                                <Input
                                    type="number"
                                    placeholder="100"
                                    value={formData.max_usage}
                                    onChange={e => setFormData({ ...formData, max_usage: e.target.value })}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Create Coupon'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {promos.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        <Tag className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>No active coupons</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {promos.map(promo => (
                            <div key={promo.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 bg-green-100 text-green-700 rounded-full flex items-center justify-center">
                                        <Tag className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-lg">{promo.auto_apply ? (promo.name || promo.code) : promo.code}</h4>
                                            {promo.auto_apply && (
                                                <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px]">Auto · Seasonal</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {promo.discount_type === 'percentage' ? `${promo.discount_value}% OFF` : `₹${promo.discount_value} OFF`}
                                            {' • '}
                                            Used: {promo.current_usage} times
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right text-sm text-muted-foreground hidden md:block">
                                        {promo.end_date ? (
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" /> Expires: {promo.end_date}
                                            </div>
                                        ) : 'No Expiry'}
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(promo.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
