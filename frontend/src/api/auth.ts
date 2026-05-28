// Auth API Service - Supabase Registration
import { apiClient } from './client';
import { User } from '@/types/api';
import { supabase } from '@/lib/supabase';

export interface RegisterResponse {
  message: string;
  user: User;
  hotel?: any;
}

export const authApi = {
  /**
   * Supabase signup ke baad, backend me hotel aur user profile banane ke liye.
   */
  register: async (name: string, hotelName: string): Promise<RegisterResponse> => {
    return apiClient.post<RegisterResponse>('/auth/register', {
      name,
      hotel_name: hotelName,
    });
  },

  /**
   * Unified Registration - Auth aur Profile ek saath backend se.
   */
  registerFull: async (data: any): Promise<RegisterResponse> => {
    return apiClient.post<RegisterResponse>('/auth/register-full', data);
  },

  /**
   * Onboarding - Hotel setup after signup/login.
   */
  onboarding: async (hotelName: string): Promise<RegisterResponse> => {
    return apiClient.post<RegisterResponse>('/auth/onboarding', {
      name: '', // Required by schema but not used
      hotel_name: hotelName,
    });
  },

  /**
   * Current user profile backend database se nikalne ke liye.
   */
  getCurrentUser: async (): Promise<User> => {
    return apiClient.get<User>('/users/me');
  },

  /**
   * Request password reset email using Supabase.
   */
  forgotPassword: async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  /**
   * Reset password using the verification token/code and set a new password.
   */
  resetPassword: async (token: string, password: string): Promise<void> => {
    // Try verifying via OTP token_hash first (implicit flow recovery)
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'recovery',
    });

    if (otpError) {
      // Fallback to exchanging code for session (PKCE/code flow)
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(token);
      if (exchangeError) {
        throw new Error(otpError.message || exchangeError.message || 'Verification failed');
      }
    }

    // Now update user password since the session is established
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      throw updateError;
    }
  },
};



export default authApi;
