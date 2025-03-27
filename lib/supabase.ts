import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

const supabaseUrl = 'https://mrogvgehlhhzfysypxos.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb2d2Z2VobGhoemZ5c3lweG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MzgwMjMsImV4cCI6MjA1MzAxNDAyM30.jn12ZlXuaCF26cM_fKgHi8FKeMC-arGbsRtumrImSPw';

let isInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce'
  },
});

/**
 * Enhanced function to ensure Supabase is initialized
 * This will handle session initialization and token refresh
 */
export const ensureSupabaseInitialized = async (): Promise<boolean> => {
  // If already initialized, return success
  if (isInitialized) {
    return true;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start new initialization
  initializationPromise = (async () => {
    try {
      console.log('[Supabase] Starting initialization...');
      
      // First check if we have a session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[Supabase] Session error:', sessionError);
        return false;
      }

      // If we have a session, verify and refresh if needed
      if (session) {
        console.log('[Supabase] Found existing session, verifying...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('[Supabase] User verification error:', userError);
          return false;
        }

        if (!user) {
          console.log('[Supabase] Session exists but no user, refreshing...');
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('[Supabase] Session refresh error:', refreshError);
            return false;
          }
        }
      }

      isInitialized = true;
      console.log('[Supabase] Initialization successful');
      return true;
    } catch (error) {
      console.error('[Supabase] Initialization error:', error);
      return false;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
};

// Function to reset initialization state (for testing/debugging)
export const resetSupabaseInitialization = () => {
  isInitialized = false;
  initializationPromise = null;
  console.log('[Supabase] Initialization state reset');
};

// Immediately try to initialize on import
ensureSupabaseInitialized().catch(err => 
  console.error('[Supabase] Background initialization failed:', err)
); 