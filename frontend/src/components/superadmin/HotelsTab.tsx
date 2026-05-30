import { motion } from 'framer-motion';
import { Building2, Settings, UserCheck, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Hotel {
    id: string;
    name: string;
    slug: string;
    owner_name: string;
    owner_email: string;
    is_active: boolean;
    subscription: any;
}

interface HotelsTabProps {
    hotels: Hotel[];
    users: any[];
    onSelectHotel: (hotel: Hotel) => void;
    onImpersonate: (id: string) => void;
    isImpersonating: boolean;
}

export const HotelsTab = ({ hotels, users, onSelectHotel, onImpersonate, isImpersonating }: HotelsTabProps) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hotels.map((hotel) => {
                const hotelUsers = users.filter(u => u.hotel_id === hotel.id);
                return (
                    <motion.div
                        key={hotel.id}
                        whileHover={{ y: -5, scale: 1.01 }}
                        className="border border-border/80 shadow-sm hover:shadow-xl transition-all duration-300 rounded-2xl bg-background overflow-hidden p-6 flex flex-col justify-between h-[280px]"
                    >
                        <div className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-50/5 dark:bg-indigo-950/20 border border-indigo-50/20 dark:border-indigo-950/40 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4
                                            className="font-bold text-sm text-foreground hover:text-indigo-600 cursor-pointer transition-colors truncate"
                                            onClick={() => onSelectHotel(hotel)}
                                        >
                                            {hotel.name}
                                        </h4>
                                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-[150px]">slug: {hotel.slug}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 items-end shrink-0">
                                    <Badge className="rounded-lg px-2 py-0.5 text-[8px] uppercase tracking-wider border shadow-none font-bold">
                                        {hotel.subscription?.plan || 'Free'}
                                    </Badge>
                                    <Badge className={`rounded-lg px-1.5 py-0.2 text-[7px] uppercase tracking-wider border shadow-none font-bold ${
                                        hotel.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                                    }`}>
                                        {hotel.is_active ? 'Active' : 'Locked'}
                                    </Badge>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl border border-border bg-muted/10 dark:bg-slate-900/20 space-y-1">
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground font-medium">Owner:</span>
                                    <span className="font-bold text-foreground truncate max-w-[160px]">{hotel.owner_name !== 'N/A' ? hotel.owner_name : hotel.owner_email.split('@')[0]}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground font-medium">Staff Users:</span>
                                    <span className="font-mono font-bold text-foreground">{hotelUsers.length} accounts</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-9 text-xs rounded-xl font-bold border-border"
                                onClick={() => onImpersonate(hotel.id)}
                                disabled={isImpersonating}
                            >
                                <UserCheck className="w-3.5 h-3.5 mr-1" /> Impersonate
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 h-9 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                onClick={() => onSelectHotel(hotel)}
                            >
                                <Settings className="w-3.5 h-3.5 mr-1" /> Manage
                            </Button>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
};
