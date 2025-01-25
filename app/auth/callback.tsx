import { useEffect, useState } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useSegments } from 'expo-router';
import { supabase } from '../../lib/supabase';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AuthCallback() {
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string>('Initializing...');

  useEffect(() => {
    const handleAuth = async () => {
      setIsLoading(true);
      setStatus('Starting authentication...');
      console.log('=== Auth Callback Debug Log ===');
      console.log('Params:', JSON.stringify(params, null, 2));
      console.log('Segments:', segments);

      try {
        let session;
        // Check if we have a code in the URL params
        const code = params?.code;
        
        if (!code) {
          setStatus('Checking deep link...');
          console.log('No code in params, checking deep link URL');
          const url = await Linking.getInitialURL();
          console.log('Deep link URL:', url);
          
          if (!url) {
            throw new Error('No authentication code provided');
          }

          const parsedURL = Linking.parse(url);
          console.log('Parsed URL:', JSON.stringify(parsedURL, null, 2));
          
          if (!parsedURL.queryParams?.code) {
            throw new Error('No authentication code in URL');
          }
          
          setStatus('Exchanging code for session...');
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(
            parsedURL.queryParams.code as string
          );
          
          if (sessionError) {
            console.error('Session exchange error:', sessionError);
            throw sessionError;
          }
          if (!data?.session) {
            console.error('No session data received');
            throw new Error('No session data received');
          }
          
          session = data.session;
          console.log('Session established via deep link');
        } else {
          // Handle code from params
          setStatus('Exchanging code for session...');
          console.log('Using code from params:', code);
          
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(
            code as string
          );
          
          if (sessionError) {
            console.error('Session exchange error:', sessionError);
            throw sessionError;
          }
          if (!data?.session) {
            console.error('No session data received');
            throw new Error('No session data received');
          }
          
          session = data.session;
          console.log('Session established via params');
        }

        // Check if user profile exists
        setStatus('Checking user profile...');
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Profile fetch error:', profileError);
          throw profileError;
        }

        console.log('Profile status:', profile ? 'Found' : 'Not found');
        
        // Wait a moment for the auth state to update
        setStatus('Finalizing...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // If this is a new user (no profile or no handle)
        if (!profile || !profile.handle) {
          console.log('New user detected, redirecting to handle setup');
          await AsyncStorage.setItem('isNewUser', 'true');
          router.replace('/auth/handle');
        } else {
          console.log('Existing user detected, redirecting to main app');
          await AsyncStorage.removeItem('isNewUser');
          router.replace('/(tabs)');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setTimeout(() => router.replace('/auth'), 2000);
      } finally {
        setIsLoading(false);
      }
    };

    handleAuth();
  }, [router, params, segments]);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center p-5 bg-white">
        <Text className="text-red-500 text-center mb-4">{error}</Text>
        <Text className="text-gray-700 text-center">Redirecting to login...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center p-5 bg-white">
      <View className="items-center">
        <ActivityIndicator size="large" color="#0000ff" />
        <Text className="mt-4 text-center text-gray-700">{status}</Text>
      </View>
    </View>
  );
}
