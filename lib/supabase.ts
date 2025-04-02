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
  try {
    if (isInitialized) return true;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Supabase initialization timeout')), 10000);
        });

        const initPromise = async () => {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;

          if (session) {
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) throw refreshError;
          }

          // Simple connection test
          const { error: testError } = await supabase.from('profiles').select('count').single();
          if (testError) throw testError;

          return true;
        };

        await Promise.race([initPromise(), timeoutPromise]);
        isInitialized = true;
        return true;
      } catch (error) {
        console.error('[Supabase] Initialization failed:', error);
        return false;
      } finally {
        initializationPromise = null;
      }
    })();

    return initializationPromise;
  } catch (error) {
    console.error('[Supabase] Fatal initialization error:', error);
    return false;
  }
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