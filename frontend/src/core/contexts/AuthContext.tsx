// Auth Context - Real API Integration
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Hotel, LoginRequest } from '@/core/types/api';
import { authApi } from '@/core/api/auth';
import { apiClient, tokenStorage } from '@/core/api/client';
import { supabase } from '@/core/lib/supabase';
import { useToast } from '@/core/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  hotel: Hotel | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest & { captchaToken?: string }) => Promise<void>;
  logout: () => Promise<void>;
  setHotel: (hotel: Hotel) => void;
  setUser: (user: User | null) => void;
  refreshHotel: () => Promise<void>;
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
      try {
        // Guard against unconfigured Supabase in CI/Dev to prevent hang
        // We check for both presence and the literal string 'undefined' which can happen in some build setups
        const sbUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!sbUrl || sbUrl === 'undefined' || sbUrl === '') {
          console.warn('Supabase URL missing, skipping auth init');
          setIsLoading(false);
          return;
        }

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
          } catch (err: any) {
            if (err && err.status === 403) {
              console.error('User or Hotel is deactivated on backend:', err);
              if (err.message === 'User is deactivated') {
                setUser({
                  id: session.user.id,
                  email: session.user.email || '',
                  name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                  role: 'OWNER' as any,
                  hotel_id: '',
                  is_active: false,
                  created_at: session.user.created_at,
                  updated_at: session.user.updated_at || session.user.created_at,
                });
                return;
              } else if (err.message === 'Hotel is deactivated') {
                setUser({
                  id: session.user.id,
                  email: session.user.email || '',
                  name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                  role: 'OWNER' as any,
                  hotel_id: '',
                  is_active: true,
                  created_at: session.user.created_at,
                  updated_at: session.user.updated_at || session.user.created_at,
                });
                setHotel({
                  id: '',
                  name: session.user.user_metadata?.hotel_name || 'My Hotel',
                  slug: '',
                  is_active: false,
                  address: { city: '', country: '' },
                  contact: {},
                  settings: {
                    currency: 'INR',
                    timezone: 'UTC',
                    check_in_time: '14:00',
                    check_out_time: '12:00',
                  },
                  photos: [],
                  amenities: [],
                  created_at: session.user.created_at,
                  updated_at: session.user.created_at,
                });
                return;
              }
            }
            console.warn('Backend unreachable on init, using Supabase session fallback:', err);
            // Set minimal user from session — don't sign out
            const admin_emails = ["tech.revmerito@gmail.com", "techrevmerito@gmail.com"];
            const userEmail = session.user.email?.toLowerCase() || '';
            const fallbackRole = admin_emails.includes(userEmail) ? 'SUPER_ADMIN' : 'OWNER';
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
              role: fallbackRole as any,
              hotel_id: '',
              created_at: session.user.created_at,
              updated_at: session.user.updated_at || session.user.created_at,
            });
          }
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        tokenStorage.setTokens({
          access_token: session.access_token,
          refresh_token: session.refresh_token || '',
          token_type: 'Bearer',
          expires_in: session.expires_in || 3600,
        });
        if (event === 'PASSWORD_RECOVERY') {
          if (window.location.pathname !== '/reset-password') {
            window.location.href = '/reset-password';
          }
        }
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

  // Listen for user or hotel deactivation events from API client
  useEffect(() => {
    const handleUserDeactivated = () => {
      setUser((prev) => prev ? { ...prev, is_active: false } : null);
    };
    const handleHotelDeactivated = () => {
      setHotel((prev) => prev ? { ...prev, is_active: false } : null);
    };

    window.addEventListener('user-deactivated', handleUserDeactivated);
    window.addEventListener('hotel-deactivated', handleHotelDeactivated);
    return () => {
      window.removeEventListener('user-deactivated', handleUserDeactivated);
      window.removeEventListener('hotel-deactivated', handleHotelDeactivated);
    };
  }, []);

  const login = useCallback(async (credentials: LoginRequest & { captchaToken?: string }) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
        options: credentials.captchaToken ? {
          captchaToken: credentials.captchaToken,
        } : undefined,
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
        const admin_emails = ["tech.revmerito@gmail.com", "techrevmerito@gmail.com"];
        const userEmail = data.user.email?.toLowerCase() || '';
        const fallbackRole = admin_emails.includes(userEmail) ? 'SUPER_ADMIN' : 'OWNER';

        setUser({
          id: data.user.id,
          email: data.user.email || '',
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
          role: fallbackRole as any,
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



  const refreshHotel = useCallback(async () => {
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      const hotelData = await apiClient.get<Hotel>('/hotels/me');
      setHotel(hotelData);
    } catch {
      // silently fail
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
        logout,
        setHotel,
        setUser,
        refreshHotel,
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
