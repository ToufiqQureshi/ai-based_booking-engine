// Login Page
// ==========================================
// 🔗 CONNECTION REPORT (Impact Analysis)
// ==========================================
// 1. Ye file kisko use karti hai? (Dependencies)
//    - src/contexts/AuthContext.tsx -> (login function yahan se aata hai)
//    - src/components/ui/* -> (Design wale buttons aur inputs)
//
// 2. Ye file kisko call karti hai? (Action)
//    - Jab user login karega, ye 'AuthContext' ko bolega -> wo 'auth.ts' ko bolega -> wo Backend ko bolega.
//
// 3. Iske baad kahan jayenge? (Navigation)
//    - Success hone par -> '/dashboard' (Dashboard.tsx)
// ==========================================

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
import { Turnstile } from '@marsidev/react-turnstile';
import { useToast } from '@/core/hooks/use-toast';
import { isSuperAdminSubdomain } from '@/core/utils/subdomain';

// Ye Rules hain (Validation Schema)
// Agar user ne galat email dala, toh ye Zod library error degi.
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Hook 1: Auth Context se 'login' function udhar liya
  const { login, isLoading } = useAuth();

  // Hook 2: Page change karne ke liye
  const navigate = useNavigate();
  const { toast } = useToast();
  const isSuperAdmin = isSuperAdminSubdomain();

  // Hook 3: Form handling (React Hook Form)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    if (!captchaToken && import.meta.env.VITE_TURNSTILE_SITE_KEY) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please complete the CAPTCHA',
      });
      return;
    }

    try {
      await login({ email: data.email, password: data.password, captchaToken: captchaToken || undefined });

      toast({
        title: isSuperAdmin ? 'Master Dashboard Access' : 'Welcome back!',
        description: isSuperAdmin 
          ? 'Authenticated for Global Administration.' 
          : 'You have successfully logged in.',
      });

      // Redirect based on entry point
      navigate(isSuperAdmin ? '/' : '/dashboard');
    } catch (error) {
      // 4. Agar error aaya (jaise galat password)


      const errorMessage = error instanceof Error ? error.message : 'Unknown error';



      toast({
        variant: 'destructive',
        title: 'Login failed',
        // Backend/Supabase se specific error message dikhao
        description: errorMessage.includes('401') || errorMessage.includes('Invalid login credentials')
          ? 'Invalid email or password'
          : errorMessage || 'Server not reachable',
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
          <h1 className="text-2xl font-bold tracking-tight">
            {isSuperAdmin ? 'Staybooker Master Control' : 'Staybooker'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin ? 'Global Platform Administration' : 'Multi-tenant hotel management platform'}
          </p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">
              {isSuperAdmin ? 'Admin Sign in' : 'Sign in'}
            </CardTitle>
            <CardDescription>
              {isSuperAdmin ? 'Enter master credentials to access global settings' : 'Enter your credentials to access your dashboard'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
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

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
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
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
                </div>

                {import.meta.env.VITE_TURNSTILE_SITE_KEY && (
                  <div className="flex justify-center my-4">
                    <Turnstile
                      siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onError={() => setCaptchaToken(null)}
                      onExpire={() => setCaptchaToken(null)}
                    />
                  </div>
                )}
              </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className={`w-full ${isSuperAdmin ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100' : ''}`} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  isSuperAdmin ? 'Master Access Login' : 'Sign in'
                )}
              </Button>
              
              {!isSuperAdmin && (
                <div className="space-y-4">
                  <p className="text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{' '}
                    <Link to="/signup" className="font-medium text-primary hover:underline">
                      Create account
                    </Link>
                  </p>
                  <p className="text-center text-xs text-muted-foreground">
                    By signing in, you agree to our{' '}
                    <Link to="/terms-of-service" className="text-primary hover:underline">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy-policy" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>
                  </p>
                </div>
              )}

              {isSuperAdmin && (
                <p className="text-center text-[10px] text-muted-foreground font-medium uppercase tracking-widest pt-4">
                  Proprietary System - Authorized Access Only
                </p>
              )}
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

export default LoginPage;
