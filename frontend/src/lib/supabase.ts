import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  const hostname = window.location.hostname;
  
  // Staging detection
  if (hostname.includes('staging')) {
    return {
      url: 'https://hfseqhjbggvrrcexvrdk.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmc2VxaGpiZ2d2cnJjZXh2cmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1Mzk4NTksImV4cCI6MjA5NjExNTg1OX0.-WepJ_ffDq8yHtlUHbE3lmhOkoE08IBshT5DuIYcat4'
    };
  }
  
  // Production detection
  if (hostname.includes('staybooker.ai')) {
    return {
      url: 'https://iupgzyilraahuwqnkgqq.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cGd6eWlscmFhaHV3cW5rZ3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTY3MTQsImV4cCI6MjA5MjA3MjcxNH0.THN18KXDYbmjZHMjS20bci1SQJz-xaskV75WM5MfXBw'
    };
  }

  // Local development / environment variable fallbacks
  return {
    url: import.meta.env.VITE_SUPABASE_URL || 'https://iupgzyilraahuwqnkgqq.supabase.co',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cGd6eWlscmFhaHV3cW5rZ3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTY3MTQsImV4cCI6MjA5MjA3MjcxNH0.THN18KXDYbmjZHMjS20bci1SQJz-xaskV75WM5MfXBw'
  };
};

const config = getSupabaseConfig();

export const supabase = createClient(config.url, config.anonKey);
