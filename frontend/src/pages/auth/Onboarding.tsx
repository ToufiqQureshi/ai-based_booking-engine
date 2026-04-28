
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const onboardingSchema = z.object({
  hotelName: z.string().min(2, 'Hotel name must be at least 2 characters'),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

export function OnboardingPage() {
  const { setUser, setHotel } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    navigate('/dashboard');
  }, [navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
  });

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true);
    try {
      const response = await authApi.onboarding(data.hotelName);
      setUser(response.user);
      setHotel(response.hotel as any);
      
      toast({
        title: 'Setup complete!',
        description: 'Your hotel has been initialized.',
      });
      navigate('/dashboard');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Setup failed',
        description: error instanceof Error ? error.message : 'Something went wrong.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Complete Your Setup</h1>
          <p className="text-sm text-muted-foreground">
            Just one more step to start managing your hotel
          </p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Hotel Information</CardTitle>
            <CardDescription>
              Enter your hotel's name to initialize your dashboard
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hotelName">Hotel Name</Label>
                <Input
                  id="hotelName"
                  type="text"
                  placeholder="The Grand Hotel"
                  {...register('hotelName')}
                  className={errors.hotelName ? 'border-destructive' : ''}
                />
                {errors.hotelName && (
                  <p className="text-xs text-destructive">{errors.hotelName.message}</p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default OnboardingPage;
