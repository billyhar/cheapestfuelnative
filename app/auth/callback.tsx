import { useEffect, useState } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useSegments } from 'expo-router';
import { supabase } from '../../lib/supabase';
import * as Linking from 'expo-linking';

export default function AuthCallback() {
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleAuth = async () => {
      setIsLoading(true);
      console.log('Auth callback params:', params);
      console.log('Current segments:', segments);

      try {
        // Check if we have a code in the URL params
        const code = params?.code;
        if (!code) {
          console.log('No code in params, checking deep link URL');
          const url = await Linking.getInitialURL();
          console.log('Deep link URL:', url);
          
          if (!url) {
            throw new Error('No authentication code provided');
          }

          const parsedURL = Linking.parse(url);
          console.log('Parsed URL:', parsedURL);
          
          if (!parsedURL.queryParams?.code) {
            throw new Error('No authentication code in URL');
          }
          
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(
            parsedURL.queryParams.code as string
          );
          
          if (sessionError) throw sessionError;
          if (!data?.session) throw new Error('No session data received');
          
          console.log('Session established via deep link');
        } else {
          // Handle code from params
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(
            code as string
          );
          
          if (sessionError) throw sessionError;
          if (!data?.session) throw new Error('No session data received');
          
          console.log('Session established via params');
        }

        // Wait a moment for the auth state to update
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Force a navigation reset to tabs
        router.replace('/(tabs)');
      } catch (err) {
        console.error('Auth error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setTimeout(() => router.replace('/auth'), 2000);
      } finally {
        setIsLoading(false);
      }
    };

    handleAuth();
  }, [router, params, segments]);

  return (
    <View className="flex-1 items-center justify-center p-5 bg-white">
      {isLoading ? (
        <View className="items-center">
          <ActivityIndicator size="large" color="#0000ff" />
          <Text className="mt-4 text-center text-gray-700">Completing sign in...</Text>
        </View>
      ) : error ? (
        <View className="items-center">
          <Text className="text-red-500 text-center">{error}</Text>
          <Text className="mt-2 text-center text-gray-600">Redirecting back to sign in...</Text>
        </View>
      ) : null}
    </View>
  );
}
