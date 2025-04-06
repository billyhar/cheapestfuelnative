import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Super simple callback screen - no more complexity
export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Set flag that we're processing a callback
        await AsyncStorage.setItem('auth_callback_in_progress', 'true');
        
        const code = params?.code as string;
        if (!code) {
          console.error('No code found in callback');
          router.replace('/auth');
          return;
        }

        // Check if we've already processed this code
        const lastProcessedCode = await AsyncStorage.getItem('last_processed_code');
        if (lastProcessedCode === code) {
          console.log('Code already processed, skipping');
          router.replace('/');
          return;
        }

        await supabase.auth.exchangeCodeForSession(code);
        
        // Store the processed code
        await AsyncStorage.setItem('last_processed_code', code);
        
        // Clear the callback flag
        await AsyncStorage.removeItem('auth_callback_in_progress');
        
        router.replace('/');
      } catch (error) {
        console.error('Error in auth callback:', error);
        await AsyncStorage.removeItem('auth_callback_in_progress');
        router.replace('/auth');
      }
    };

    handleCallback();
  }, [params?.code]);

  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator size="large" />
    </View>
  );
}
