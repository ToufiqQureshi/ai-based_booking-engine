import { useState } from 'react';
import { useAuth } from '@/core/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/core/hooks/use-toast';
import { apiClient } from '@/core/api/client';
import { User, Lock, Mail, Phone, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/core/lib/supabase';

export default function ProfilePage() {
    const { user, setUser } = useAuth(); // Assuming setUser exists in AuthContext to update local state
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // We only support changing Name for now, as Email/Password require more security flow
    const [name, setName] = useState(user?.name || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await apiClient.patch('/users/me', { name });
            // Update local user context if refresh logic exists, or just warn user
            // Ideally auth context should broaden to allow updates
            toast({
                title: "Profile Updated",
                description: "Your profile information has been saved.",
            });
            // Reload to get fresh user data if context doesn't auto-update
            window.location.reload();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update profile.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
                <p className="text-muted-foreground">
                    Manage your personal account information
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Update your display name and contact details</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="pl-9 bg-muted"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Email cannot be changed contact support.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Update your password</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Current Password</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="password"
                                className="pl-9"
                                placeholder="••••••••"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>New Password</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="password"
                                className="pl-9"
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        disabled={isLoading || !currentPassword || !newPassword}
                        onClick={async () => {
                            setIsLoading(true);
                            try {
                                // 1. Verify current password by signing in
                                const { error: signInError } = await supabase.auth.signInWithPassword({
                                    email: user?.email || '',
                                    password: currentPassword,
                                });
                                if (signInError) throw new Error("Incorrect current password.");

                                // 2. Update with new password
                                const { error: updateError } = await supabase.auth.updateUser({
                                    password: newPassword
                                });
                                if (updateError) throw updateError;

                                toast({
                                    title: "Password Updated",
                                    description: "Your password has been changed successfully.",
                                });
                                setCurrentPassword('');
                                setNewPassword('');
                            } catch (error) {
                                toast({
                                    variant: "destructive",
                                    title: "Error",
                                    description: error instanceof Error ? error.message : "Failed to update password.",
                                });
                            } finally {
                                setIsLoading(false);
                            }
                        }}
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Change Password
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
