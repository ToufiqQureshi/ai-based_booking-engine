import { Edit, Trash2, Package, Check, Tag } from 'lucide-react';
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
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-primary/10">
      <CardHeader className="p-0 relative">
        <div className="h-32 bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center">
          <Package className="h-12 w-12 text-primary/40 group-hover:scale-110 transition-transform duration-300" />
        </div>
        <div className="absolute top-2 right-2 flex gap-1">
          <Badge className={cn(pkg.is_active ? "bg-green-500/10 text-green-600 border-green-200" : "bg-gray-100 text-gray-500")}>
            {pkg.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
            <Tag className="h-3 w-3 mr-1" />
            Package
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg line-clamp-1">{pkg.name}</h3>
          <span className="text-primary font-bold text-lg">
            +{formatCurrency(pkg.price_adjustment)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[40px]">
          {pkg.description || 'No description provided.'}
        </p>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inclusions</p>
          <div className="flex flex-wrap gap-2">
            {(pkg.package_items || []).slice(0, 3).map((item, idx) => (
              <Badge key={idx} variant="outline" className="text-[10px] font-normal py-0">
                <Check className="h-2 w-2 mr-1 text-green-500" />
                {item}
              </Badge>
            ))}
            {(pkg.package_items || []).length > 3 && (
              <Badge variant="outline" className="text-[10px] font-normal py-0">
                +{(pkg.package_items || []).length - 3} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex justify-end gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(pkg)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(pkg.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
