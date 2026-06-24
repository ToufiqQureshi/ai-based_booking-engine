// Signup Page - Hotel Owner Registration
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Building2, Loader2 } from 'lucide-react';
import { useAuth } from '@/core/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/core/hooks/use-toast';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  hotelName: z.string().min(2, 'Hotel name must be at least 2 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signup, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    try {
      await signup({
        name: data.name,
        email: data.email,
        password: data.password,
        hotel_name: data.hotelName,
      });
      toast({
        title: 'Account created!',
        description: 'Welcome to your dashboard.',
      });
      navigate('/login');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Signup failed',
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Branding */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden shadow-md">
            <img src="/logo.png" alt="Staybooker Logo" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Staybooker</h1>
          <p className="text-sm text-muted-foreground">
            Start managing your hotel in minutes
          </p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Hotel Owner Registration</CardTitle>
            <CardDescription>
              Fill in your details to get started
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Smith"
                  autoComplete="name"
                  {...register('name')}
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="owner@hotel.com"
                  autoComplete="email"
                  {...register('email')}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Hotel Name */}
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

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...register('password')}
                    className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {errors.password ? (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    At least 8 characters with uppercase and number
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...register('confirmPassword')}
                    className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-2">
                By signing up, you agree to our{' '}
                <Link to="/terms-of-service" className="text-primary hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy-policy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </p>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        {/* Compliance Footer */}
        <footer className="mt-8 text-center text-xs text-muted-foreground w-full max-w-md">
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 mb-2">
            <Link to="/privacy-policy" className="hover:text-primary hover:underline transition-colors">Privacy Policy</Link>
            <span className="text-muted-foreground/30">•</span>
            <Link to="/terms-of-service" className="hover:text-primary hover:underline transition-colors">Terms of Service</Link>
            <span className="text-muted-foreground/30">•</span>
            <Link to="/refund-policy" className="hover:text-primary hover:underline transition-colors">Refund Policy</Link>
            <span className="text-muted-foreground/30">•</span>
            <Link to="/cookie-policy" className="hover:text-primary hover:underline transition-colors">Cookie Policy</Link>
            <span className="text-muted-foreground/30">•</span>
            <Link to="/contact-us" className="hover:text-primary hover:underline transition-colors">Contact Us</Link>
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            © {new Date().getFullYear()} Staybooker by Revmerito. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default SignupPage;
