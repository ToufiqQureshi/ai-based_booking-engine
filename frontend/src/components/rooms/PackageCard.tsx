import { Edit, Trash2, Package, Check, Tag, Sparkles, Plus, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RatePlan } from '@/types/api';
import { cn } from '@/lib/utils';

interface PackageCardProps {
  pkg: RatePlan;
  onEdit: (pkg: RatePlan) => void;
  onDelete: (id: string) => void;
}

export function PackageCard({ pkg, onEdit, onDelete }: PackageCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="overflow-hidden group hover:shadow-[0_20px_50px_rgba(124,58,237,0.15)] transition-all duration-500 border-none bg-white/70 backdrop-blur-xl rounded-[32px] ring-1 ring-violet-50/50 hover:ring-violet-100/50 relative">
      <CardHeader className="p-0 relative">
        <div className="h-32 bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 flex items-center justify-center relative overflow-hidden">
          {/* Decorative Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)]" />
          </div>
          
          <div className="w-16 h-16 rounded-[22px] bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xl border border-white/30 group-hover:scale-110 transition-transform duration-500">
            <Package className="h-8 w-8 text-white" />
          </div>
        </div>

        <div className="absolute top-4 right-4 flex gap-2">
            <div className={cn(
                "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] backdrop-blur-md shadow-lg flex items-center gap-1.5",
                pkg.is_active ? "bg-emerald-500/90 text-white" : "bg-slate-900/80 text-white"
            )}>
                {pkg.is_active && <div className="w-1 h-1 rounded-full bg-white animate-pulse" />}
                {pkg.is_active ? 'Active' : 'Paused'}
            </div>
            <div className="bg-white/20 backdrop-blur-md border border-white/30 text-white text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Premium
            </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-black text-indigo-950 tracking-tight group-hover:text-violet-600 transition-colors leading-none">{pkg.name}</h3>
        </div>
        
        <p className="text-xs font-medium text-indigo-400 line-clamp-2 mb-6 leading-relaxed">
          {pkg.description || 'Define a unique narrative for this luxury package to captivate guests.'}
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1 h-4 bg-violet-500 rounded-full" />
            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Premium Inclusions</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {(pkg.package_items || []).slice(0, 4).map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 bg-violet-50/50 border border-violet-100/30 px-3 py-1.5 rounded-xl transition-colors hover:bg-white group/item">
                <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-emerald-600" />
                </div>
                <span className="text-[10px] font-bold text-indigo-900/70 group-hover/item:text-violet-600">{item}</span>
              </div>
            ))}
            {(pkg.package_items || []).length > 4 && (
              <div className="px-3 py-1.5 rounded-xl bg-indigo-50/50 text-[10px] font-bold text-indigo-400">
                +{(pkg.package_items || []).length - 4} More
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-0 flex items-center justify-between">
        <div className="flex flex-col">
            <span className="text-[9px] uppercase font-black text-indigo-300 tracking-[0.2em] mb-1">Premium Yield</span>
            <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-violet-600 tracking-tighter">
                    +{formatCurrency(pkg.price_adjustment)}
                </span>
                <span className="text-[10px] font-bold text-indigo-300">/night</span>
            </div>
        </div>

        <div className="flex gap-2">
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-xl text-indigo-300 hover:text-violet-600 hover:bg-violet-50 border border-transparent hover:border-violet-100 transition-all" 
                onClick={() => onEdit(pkg)}
            >
                <Edit className="h-4 w-4" />
            </Button>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-xl text-indigo-300 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all" 
                onClick={() => onDelete(pkg.id)}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
            <Button 
                onClick={() => onEdit(pkg)}
                className="h-10 w-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 flex items-center justify-center p-0 group/btn"
            >
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
            </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
