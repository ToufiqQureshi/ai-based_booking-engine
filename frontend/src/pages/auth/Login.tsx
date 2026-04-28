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
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

// Ye Rules hain (Validation Schema)
// Agar user ne galat email dala, toh ye Zod library error degi.
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  // Hook 1: Auth Context se 'login' function udhar liya
  const { login, isLoading } = useAuth();

  // Hook 2: Page change karne ke liye
  const navigate = useNavigate();
  const { toast } = useToast();

  // Hook 3: Form handling (React Hook Form)
  // Ye HTML form ka sara data sambhalta hai automatically.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Ye function TAB chalega jab user "Sign In" button dabayega
  const onSubmit = async (data: LoginFormData) => {
    try {
      // 1. Context wale login function ko call kiya
      // (Ye background mein API call karega)
      await login({ email: data.email, password: data.password });

      // 2. Agar sab sahi raha, toh user ko welcome message dikhao
      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
      });

      // 3. User ko Dashboard pe bhej do
      navigate('/dashboard');
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
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Hotel Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Multi-tenant hotel management platform
          </p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Enter your credentials to access your dashboard
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
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link to="/signup" className="font-medium text-primary hover:underline">
                  Create account
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>


      </div>
    </div>
  );
}

export default LoginPage;
