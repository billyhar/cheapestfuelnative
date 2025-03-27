import React, { useEffect, useState } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase, ensureSupabaseInitialized } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Super simple callback screen - no more complexity
export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const exchangeCode = async () => {
      try {
        const code = params?.code as string;
        
        if (!code) {
          console.log('No code in params, redirecting to auth');
          router.replace('/auth');
          return;
        }
        
        console.log('[Auth Callback] Starting code exchange process...');
        
        // Mark that we're in callback process
        await AsyncStorage.setItem('auth_callback_in_progress', 'true');
        
        // First ensure Supabase is initialized
        const initialized = await ensureSupabaseInitialized();
        if (!initialized) {
          throw new Error('Failed to initialize Supabase');
        }
        
        // Exchange code for session
        await supabase.auth.exchangeCodeForSession(code);
        console.log('[Auth Callback] Code exchange complete');
        
        // Wait a moment for session to be fully established
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify session is active
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          throw new Error('Session verification failed after code exchange');
        }
        
        console.log('[Auth Callback] Session verified:', !!session);
        
        // Set flags for navigation
        await Promise.all([
          AsyncStorage.setItem('force_navigation', 'true'),
          AsyncStorage.setItem('initial_login', 'true')
        ]);
        
        // Clear callback flag
        await AsyncStorage.removeItem('auth_callback_in_progress');
        
        // Navigate to tabs
        router.replace('/(tabs)');
      } catch (err) {
        console.error('[Auth Callback] Error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        
        // Clear flags
        await Promise.all([
          AsyncStorage.removeItem('auth_callback_in_progress'),
          AsyncStorage.removeItem('force_navigation'),
          AsyncStorage.removeItem('initial_login')
        ]);
        
        setTimeout(() => router.replace('/auth'), 1000);
      }
    };
    
    exchangeCode();
  }, [params?.code, router]);

  return (
    <View className="flex-1 items-center justify-center p-5 bg-white">
      <View className="items-center w-full max-w-sm">
        {error ? (
          <>
            <Text className="text-red-500 text-center mb-4">{error}</Text>
            <Text className="text-gray-700 text-center">Redirecting to login...</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color="#1B75BA" />
            <Text className="mt-4 text-center text-gray-700 text-lg font-medium">
              Signing in...
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
