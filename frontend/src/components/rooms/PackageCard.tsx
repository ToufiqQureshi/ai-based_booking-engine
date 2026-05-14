import { Edit, Trash2, Package, Check, Sparkles, ArrowRight } from 'lucide-react';
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
    <Card className="overflow-hidden group hover:shadow-md transition-all duration-200 border border-slate-200 bg-white rounded-xl relative">
      <CardHeader className="p-0 relative">
        <div className="h-24 bg-slate-50 flex items-center justify-center relative overflow-hidden border-b border-slate-100">
          <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center shadow-sm border border-slate-100 group-hover:scale-105 transition-transform">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
        </div>

        <div className="absolute top-3 right-3 flex gap-2">
            <Badge variant={pkg.is_active ? "default" : "secondary"} className={cn(
                "text-[10px] font-bold px-2 py-0.5 border-none",
                pkg.is_active ? "bg-green-500 hover:bg-green-600" : "bg-slate-200 text-slate-600"
            )}>
                {pkg.is_active ? 'Active' : 'Paused'}
            </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{pkg.name}</h3>
        </div>
        
        <p className="text-xs font-medium text-slate-500 line-clamp-2 mb-5 min-h-[32px]">
          {pkg.description || 'No description provided for this package.'}
        </p>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Package Inclusions</p>
          
          <div className="flex flex-wrap gap-1.5">
            {(pkg.package_items || []).slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md">
                <Check className="h-3 w-3 text-green-600" />
                <span className="text-[10px] font-medium text-slate-600">{item}</span>
              </div>
            ))}
            {(pkg.package_items || []).length > 3 && (
              <div className="px-2 py-1 rounded-md bg-blue-50 text-[10px] font-bold text-blue-600">
                +{(pkg.package_items || []).length - 3} More
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-5 pt-0 flex items-center justify-between border-t border-slate-50 mt-2">
        <div className="flex flex-col pt-3">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Package Add-on</span>
            <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-blue-600">
                    +{formatCurrency(pkg.price_adjustment)}
                </span>
                <span className="text-[10px] font-medium text-slate-400">/night</span>
            </div>
        </div>

        <div className="flex gap-2 pt-3">
            <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 border-slate-200" 
                onClick={() => onEdit(pkg)}
            >
                <Edit className="h-4 w-4" />
            </Button>
            <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border-slate-200" 
                onClick={() => onDelete(pkg.id)}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
