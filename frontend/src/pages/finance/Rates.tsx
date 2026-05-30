// Rates Page - Rate Plans Management (Real API)
import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, MoreHorizontal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { RatePlanDialog } from '@/components/rates/RatePlanDialog';
import { apiClient } from '@/api/client';
import { RatePlan } from '@/types/api';
import { useToast } from '@/hooks/use-toast';
import { PageShell } from '@/components/layout/PageShell';

const mealPlanLabels: Record<string, string> = {
  EP: 'European Plan (Room Only)',
  CP: 'Continental Plan (Breakfast)',
  MAP: 'Modified American Plan (Bkfst + Meal)',
  AP: 'American Plan (All Meals)',
};

export function RatesPage() {
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<RatePlan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const fetchRatePlans = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.get<RatePlan[]>('/rates/plans');
      setRatePlans(data);
    } catch (error) {
      console.error('Failed to fetch rate plans:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load rate plans.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRatePlans();
  }, []);

  const handleCreate = () => {
    setSelectedPlan(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (plan: RatePlan) => {
    setSelectedPlan(plan);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (isDeleting || !confirm('Are you sure you want to delete this rate plan?')) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/rates/plans/${id}`);
      toast({
        title: 'Rate Plan Deleted',
        description: 'Rate plan has been removed.',
      });
      setRatePlans(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete rate plan.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading rate plans...</span>
      </div>
    );
  }

  return (
    <PageShell
      title="Rate Plans"
      subtitle="Configure your pricing strategies and rate plans"
      actions={
        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 h-9 px-5 text-sm font-semibold" onClick={handleCreate}>
          <Plus className="h-4 w-4" /> Add Rate Plan
        </Button>
      }
    >
      <RatePlanDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={selectedPlan}
        onSuccess={fetchRatePlans}
      />

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search rate plans..." className="pl-10" />
        </div>
      </div>

      {/* Rate Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Rate Plans</CardTitle>
          <CardDescription>
            Manage your rate plans and their cancellation policies
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ratePlans.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No rate plans found. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Meal Plan</TableHead>
                  <TableHead>Cancellation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ratePlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{plan.name}</p>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{mealPlanLabels[plan.meal_plan] || plan.meal_plan}</Badge>
                    </TableCell>
                    <TableCell>
                      {plan.is_refundable ? (
                        <span className="text-sm">
                          Free cancellation up to {plan.cancellation_hours}h before
                        </span>
                      ) : (
                        <span className="text-sm text-destructive">Non-refundable</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {plan.is_active ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(plan)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(plan.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

export default RatesPage;
