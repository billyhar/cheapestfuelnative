import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

// Super simple callback screen - no more complexity
export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = params?.code as string;
        if (!code) {
          router.replace('/auth');
          return;
        }

        await supabase.auth.exchangeCodeForSession(code);
        router.replace('/');
      } catch (error) {
        console.error('Error in auth callback:', error);
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
