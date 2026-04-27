// Auth Context - Real API Integration
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Hotel, LoginRequest, SignupRequest } from '@/types/api';
import { authApi } from '@/api/auth';
import { apiClient, tokenStorage } from '@/api/client';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  hotel: Hotel | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  signup: (data: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
  setHotel: (hotel: Hotel) => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        tokenStorage.setTokens({
          access_token: session.access_token,
          refresh_token: session.refresh_token || '',
          token_type: 'Bearer',
          expires_in: session.expires_in || 3600,
        });

        try {
          const currentUser = await authApi.getCurrentUser();
          setUser(currentUser);

          try {
            const hotelData = await apiClient.get<Hotel>('/hotels/me');
            setHotel(hotelData);
          } catch {
            // Silently fail
          }
        } catch (err) {
          console.warn('Backend unreachable on init, using Supabase session fallback:', err);
          // Set minimal user from session — don't sign out
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            role: 'OWNER' as any,
            hotel_id: '',
            created_at: session.user.created_at,
            updated_at: session.user.updated_at || session.user.created_at,
          });
        }
      }
      setIsLoading(false);
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        tokenStorage.setTokens({
          access_token: session.access_token,
          refresh_token: session.refresh_token || '',
          token_type: 'Bearer',
          expires_in: session.expires_in || 3600,
        });
      } else {
        tokenStorage.clearTokens();
        setUser(null);
        setHotel(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) throw error;
      if (!data.session) throw new Error('No session created');

      tokenStorage.setTokens({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token || '',
        token_type: 'Bearer',
        expires_in: data.session.expires_in || 3600,
      });

      // Try to get full user profile from backend — but don't block login if it fails
      // This handles cases where backend API URL is misconfigured or unreachable
      try {
        const currentUser = await authApi.getCurrentUser();
        setUser(currentUser);
      } catch (backendErr) {
        console.warn('Backend user fetch failed, using Supabase session data:', backendErr);
        // Set minimal user from Supabase session so app can proceed
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
          role: 'OWNER' as any,
          hotel_id: '',
          created_at: data.user.created_at,
          updated_at: data.user.updated_at || data.user.created_at,
        });
      }

      // Hotel fetch — always non-blocking
      try {
        const hotelData = await apiClient.get<Hotel>('/hotels/me');
        setHotel(hotelData);
      } catch {
        // Silently fail — DashboardLayout will redirect to onboarding if needed
      }
    } finally {
      setIsLoading(false);
    }
  }, []);


  const signup = useCallback(async (data: SignupRequest) => {
    setIsLoading(true);
    try {
      // 1. Supabase Auth me user create karo (Industry Standard)
      // Postgres Trigger will automatically create the profile in 'users' table
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Signup failed');

      // 2. Token save karo (agar session mila)
      if (authData.session) {
        tokenStorage.setTokens({
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token || '',
          token_type: 'Bearer',
          expires_in: authData.session.expires_in || 3600,
        });
        
        // Profile check backend se
        try {
          const currentUser = await authApi.getCurrentUser();
          setUser(currentUser);
          
          if (currentUser.hotel_id) {
             const hotelData = await apiClient.get<Hotel>('/hotels/me');
             setHotel(hotelData);
          }
        } catch {
          // Profile might be being created by trigger, or hotel not yet set
          // DashboardLayout will handle the redirect to /onboarding
        }
      } else {
        // Confirmation required case
        toast({
          title: 'Signup successful',
          description: 'Please check your email to confirm your account before logging in.',
        });
      }
      
      toast({
        title: 'Welcome!',
        description: 'Account created successfully.',
      });
      
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : 'Signup failed';
       toast({
         variant: 'destructive',
         title: 'Signup failed',
         description: errorMessage,
       });
       throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);



  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore errors
    } finally {
      setUser(null);
      setHotel(null);
      tokenStorage.clearTokens();
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        hotel,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        setHotel,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
