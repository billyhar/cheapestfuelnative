import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, AuthChangeEvent, Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

// Get the deep link URL for the current platform
const getAuthRedirectUrl = () => {
  // In development, we can use a localhost URL
  if (__DEV__) {
    if (Platform.OS === 'ios') return 'io.supabase.myapp://auth/callback';
    if (Platform.OS === 'android') return 'io.supabase.myapp://auth/callback';
  }
  return Linking.createURL('auth/callback');
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce'
  },
});

// Set up auth state change listener with proper typing
supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
  console.log('Supabase auth event:', event);
  console.log('Session state:', !!session);
});

// Initialize auth state
export const initializeAuth = async () => {
  try {
    // Get the URL that was used to open the app
    const url = await Linking.getInitialURL();
    if (url) {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    }
  } catch (error) {
    console.error('Error initializing auth:', error);
  }
};

let isInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

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