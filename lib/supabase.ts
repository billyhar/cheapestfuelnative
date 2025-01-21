import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

const supabaseUrl = 'https://mrogvgehlhhzfysypxos.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb2d2Z2VobGhoemZ5c3lweG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MzgwMjMsImV4cCI6MjA1MzAxNDAyM30.jn12ZlXuaCF26cM_fKgHi8FKeMC-arGbsRtumrImSPw';

const redirectUrl = Linking.createURL('auth/callback');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    onAuthStateChange: (event, session) => {
      console.log('Supabase auth event:', event, session);
    }
  },
}); 