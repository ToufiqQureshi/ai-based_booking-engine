import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    ShieldCheck, 
    Building2, 
    User as UserIcon, 
    CreditCard, 
    Zap, 
    Bot, 
    TrendingUp, 
    CheckCircle2, 
    XCircle,
    Search,
    RefreshCw,
    ExternalLink,
    MoreVertical
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from '@/components/ui/use-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';

interface HotelAdminData {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    owner_email: string;
    owner_name: string;
    feature_ai_agent: boolean;
    feature_guest_bot: boolean;
    feature_rate_shopper: boolean;
    subscription: {
        plan: string;
        status: string;
        end_date: string | null;
    } | null;
}

export default function SuperAdminDashboard() {
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: hotels = [], isLoading, refetch } = useQuery<HotelAdminData[]>({
        queryKey: ['superadmin-hotels'],
        queryFn: () => apiClient.get('/superadmin/hotels'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => 
            apiClient.patch(`/superadmin/hotels/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['superadmin-hotels'] });
            toast({ title: 'Updated', description: 'Hotel configuration saved successfully.' });
        }
    });

    const filteredHotels = hotels.filter(h => 
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.owner_email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleFeature = (hotelId: string, feature: string, currentValue: boolean) => {
        updateMutation.mutate({
            id: hotelId,
            data: { [feature]: !currentValue }
        });
    };

    const toggleActive = (hotelId: string, currentStatus: boolean) => {
        updateMutation.mutate({
            id: hotelId,
            data: { is_active: !currentStatus }
        });
    };

    if (isLoading) return <div className="p-8 flex items-center justify-center">Loading Master Dashboard...</div>;

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                            <ShieldCheck className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900">Master Control</h1>
                            <p className="text-slate-500 font-medium italic">Global Platform Administration</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => refetch()} className="gap-2">
                        <RefreshCw className="w-4 h-4" /> Sync Data
                    </Button>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 font-bold">
                        Export Report
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total Hotels', value: hotels.length, icon: Building2, color: 'bg-blue-500' },
                    { label: 'Active Subscriptions', value: hotels.filter(h => h.subscription?.status === 'active').length, icon: CheckCircle2, color: 'bg-emerald-500' },
                    { label: 'AI Features Active', value: hotels.filter(h => h.feature_ai_agent).length, icon: Bot, color: 'bg-indigo-500' },
                    { label: 'Pending Expiries', value: 0, icon: Zap, color: 'bg-orange-500' },
                ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                        <CardContent className="p-6 relative">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                    <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
                                </div>
                                <div className={`p-4 rounded-2xl ${stat.color} text-white shadow-lg transform group-hover:scale-110 transition-transform`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Table */}
            <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="border-b bg-slate-50/50 p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-xl font-bold">Hotel Management</CardTitle>
                            <CardDescription>Manage feature access, subscriptions and hotel status.</CardDescription>
                        </div>
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                                placeholder="Search by hotel name or email..." 
                                className="pl-10 bg-white border-slate-200"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <Table>
                    <TableHeader className="bg-slate-50/30">
                        <TableRow>
                            <TableHead className="font-bold py-4">Hotel Details</TableHead>
                            <TableHead className="font-bold">Subscription</TableHead>
                            <TableHead className="font-bold">AI Assistant</TableHead>
                            <TableHead className="font-bold">Guest Bot</TableHead>
                            <TableHead className="font-bold">Rate Shopper</TableHead>
                            <TableHead className="font-bold text-right">Status</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredHotels.map((hotel) => (
                            <TableRow key={hotel.id} className="hover:bg-slate-50/50 transition-colors">
                                <TableCell className="py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400">
                                            {hotel.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 flex items-center gap-2">
                                                {hotel.name}
                                                <a href={`/book/${hotel.slug}`} target="_blank" rel="noreferrer">
                                                    <ExternalLink className="w-3 h-3 text-slate-400 hover:text-indigo-600" />
                                                </a>
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium">{hotel.owner_email}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <Badge className={`w-fit mb-1 font-bold ${
                                            hotel.subscription?.status === 'active' 
                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200' 
                                            : 'bg-red-100 text-red-700 hover:bg-red-100 border-red-200'
                                        }`}>
                                            {hotel.subscription?.plan || 'Free'}
                                        </Badge>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {hotel.subscription?.end_date ? `Expires: ${format(new Date(hotel.subscription.end_date), 'dd MMM yyyy')}` : 'No Expiry'}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Switch 
                                        checked={hotel.feature_ai_agent} 
                                        onCheckedChange={() => toggleFeature(hotel.id, 'feature_ai_agent', hotel.feature_ai_agent)}
                                        className="data-[state=checked]:bg-indigo-600"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Switch 
                                        checked={hotel.feature_guest_bot} 
                                        onCheckedChange={() => toggleFeature(hotel.id, 'feature_guest_bot', hotel.feature_guest_bot)}
                                        className="data-[state=checked]:bg-indigo-600"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Switch 
                                        checked={hotel.feature_rate_shopper} 
                                        onCheckedChange={() => toggleFeature(hotel.id, 'feature_rate_shopper', hotel.feature_rate_shopper)}
                                        className="data-[state=checked]:bg-indigo-600"
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Badge variant={hotel.is_active ? "outline" : "destructive"} className={hotel.is_active ? "text-emerald-600 border-emerald-200 bg-emerald-50 font-bold" : "font-bold"}>
                                        {hotel.is_active ? 'ACTIVE' : 'LOCKED'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="w-4 h-4 text-slate-400" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => toggleActive(hotel.id, hotel.is_active)}>
                                                {hotel.is_active ? <XCircle className="mr-2 w-4 h-4 text-red-500" /> : <CheckCircle2 className="mr-2 w-4 h-4 text-emerald-500" />}
                                                {hotel.is_active ? 'Disable Account' : 'Enable Account'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <CreditCard className="mr-2 w-4 h-4" /> Manage Subscription
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-red-600 focus:text-red-700">
                                                Delete Hotel Data
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
