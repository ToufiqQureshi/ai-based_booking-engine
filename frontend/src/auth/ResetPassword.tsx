import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Loader2, Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Turnstile } from '@marsidev/react-turnstile';
import { useToast } from '@/core/hooks/use-toast';
import { authApi } from '@/core/api/auth';
import { supabase } from '@/core/lib/supabase';

const resetPasswordSchema = z.object({
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || searchParams.get('code');
    const navigate = useNavigate();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [hasActiveSession, setHasActiveSession] = useState(false);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);

    // Detect recovery/access token in URL hash fragment
    const hasHashSession = window.location.hash.includes('access_token=') || window.location.hash.includes('type=recovery');

    useEffect(() => {
        const checkSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
                setHasActiveSession(true);
            }
        };
        checkSession();

        // Listen for auth state change to capture session if it sets asynchronously
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                setHasActiveSession(true);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema),
    });

    const onSubmit = async (data: ResetPasswordFormData) => {
        if (!captchaToken && import.meta.env.VITE_TURNSTILE_SITE_KEY) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Please complete the CAPTCHA',
            });
            return;
        }

        setIsLoading(true);
        try {
            if (token) {
                // PKCE or traditional OTP token flow
                await authApi.resetPassword(token, data.password);
            } else if (hasHashSession || hasActiveSession) {
                // Implicit flow / active recovery session established by Supabase
                const { error: updateError } = await supabase.auth.updateUser({
                    password: data.password,
                });
                if (updateError) throw updateError;
            } else {
                throw new Error('Missing reset token or active session. Please request a new link.');
            }

            setIsSuccess(true);
            toast({
                title: 'Password reset successful',
                description: 'You can now login with your new password.',
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Reset failed',
                description: error instanceof Error ? error.message : 'Something went wrong.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const isLinkValid = !!token || hasHashSession || hasActiveSession;

    if (!isLinkValid) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
                <Card className="w-full max-w-md border-0 shadow-lg">
                    <CardHeader className="text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
                            <Lock className="h-6 w-6" />
                        </div>
                        <CardTitle>Invalid Link</CardTitle>
                        <CardDescription>
                            This password reset link is invalid or missing the token.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex flex-col space-y-4">
                        <Link to="/forgot-password" className="w-full">
                            <Button className="w-full">
                                Request New Link
                            </Button>
                        </Link>
                        <Link
                            to="/login"
                            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to sign in
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
            <div className="w-full max-w-md space-y-6">
                <div className="flex flex-col items-center space-y-2 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                        <Building2 className="h-8 w-8" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Hotel Dashboard</h1>
                </div>

                <Card className="border-0 shadow-lg">
                    {!isSuccess ? (
                        <>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-xl">Set new password</CardTitle>
                                <CardDescription>
                                    Please enter your new password below.
                                </CardDescription>
                            </CardHeader>
                            <form onSubmit={handleSubmit(onSubmit)}>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="password">New Password</Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            {...register('password')}
                                            className={errors.password ? 'border-destructive' : ''}
                                        />
                                        {errors.password && (
                                            <p className="text-xs text-destructive">{errors.password.message}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            placeholder="••••••••"
                                            {...register('confirmPassword')}
                                            className={errors.confirmPassword ? 'border-destructive' : ''}
                                        />
                                        {errors.confirmPassword && (
                                            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
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
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Resetting password...
                                            </>
                                        ) : (
                                            'Reset Password'
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
                                <CardTitle className="text-xl">Password Reset!</CardTitle>
                                <CardDescription>
                                    Your password has been successfully updated.
                                </CardDescription>
                            </CardHeader>
                            <CardFooter>
                                <Link to="/login" className="w-full">
                                    <Button className="w-full">
                                        Proceed to Login
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

export default ResetPasswordPage;
