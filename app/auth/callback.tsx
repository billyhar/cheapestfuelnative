import React, { useEffect, useState } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Super simple callback screen - no more complexity
export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Execute once
    const exchangeCode = async () => {
      try {
        // Get code from params
        const code = params?.code as string;
        
        if (!code) {
          console.log('No code in params, redirecting to auth');
          router.replace('/auth');
          return;
        }
        
        console.log('Exchanging code:', code);
        // Exchange code for session - this is all we need to do here
        // The onAuthStateChange listener in AuthProvider handles everything else
        await supabase.auth.exchangeCodeForSession(code);
        
        // Let the auth state change in AuthProvider handle navigation
        console.log('Code exchange complete, auth state change will handle navigation');
        
        // Mark force navigation flag to help Root Layout navigate
        await AsyncStorage.setItem('force_navigation', 'true');
        
        // Safety net: Force navigation after 2 seconds if nothing else works
        setTimeout(async () => {
          console.log('SAFETY NET: Forcing navigation to tabs after timeout');
          // Double-check session before navigating
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            // Force immediate navigation to tabs
            router.replace('/(tabs)');
          } else {
            router.replace('/auth');
          }
        }, 2000);
      } catch (err) {
        console.error('Auth error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
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
