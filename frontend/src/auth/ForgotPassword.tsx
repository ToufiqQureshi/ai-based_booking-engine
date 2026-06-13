// Forgot Password Page
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Loader2, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { authApi } from '@/api/auth';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      // Real API call
      await authApi.forgotPassword(data.email);

      setSubmittedEmail(data.email);
      setIsSubmitted(true);
      toast({
        title: 'Email sent',
        description: 'Check your inbox for password reset instructions.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to send email',
        description: error instanceof Error ? error.message : 'Please try again later.',
      });
    } finally {
      setIsLoading(false);
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
        </div>

        <Card className="border-0 shadow-lg">
          {!isSubmitted ? (
            <>
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl">Reset your password</CardTitle>
                <CardDescription>
                  Enter your email address and we'll send you a link to reset your password
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="space-y-4">
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
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending email...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send reset link
                      </>
                    )}
                  </Button>
                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </Link>
                </CardFooter>
              </form>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">Check your email</CardTitle>
                <CardDescription>
                  We've sent a password reset link to
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="font-medium">{submittedEmail}</p>
                <p className="mt-4 text-sm text-muted-foreground">
                  Didn't receive the email? Check your spam folder or{' '}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setIsSubmitted(false)}
                  >
                    try again
                  </button>
                </p>
              </CardContent>
              <CardFooter>
                <Link to="/login" className="w-full">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to sign in
                  </Button>
                </Link>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
