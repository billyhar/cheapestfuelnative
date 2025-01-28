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
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const handleAuth = async () => {
      try {
        setIsLoading(true);
        setStatus('Starting authentication...');
        console.log('=== Auth Callback Debug Log ===');
        console.log('Params:', JSON.stringify(params, null, 2));
        console.log('Segments:', segments);

        // Set a timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.log('Session exchange timeout - redirecting to handle setup');
            router.replace('/auth/handle');
          }
        }, 5000); // 5 second timeout

        let session;
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
          console.log('Attempting to exchange deep link code for session...');
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(
            parsedURL.queryParams.code as string
          );
          
          if (sessionError) {
            console.error('Deep link session exchange error:', sessionError);
            throw sessionError;
          }
          if (!data?.session) {
            console.error('No session data received from deep link');
            throw new Error('No session data received');
          }
          
          session = data.session;
          console.log('Session established via deep link:', { userId: session.user.id });
        } else {
          setStatus('Exchanging code for session...');
          console.log('Attempting to exchange params code for session:', code);
          
          try {
            const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(
              code as string
            );
            
            if (sessionError) {
              console.error('Params session exchange error:', sessionError);
              throw sessionError;
            }
            if (!data?.session) {
              console.error('No session data received from params');
              throw new Error('No session data received');
            }
            
            session = data.session;
            console.log('Session established via params:', { userId: session.user.id });
          } catch (exchangeError) {
            console.error('Error during code exchange:', exchangeError);
            // If exchange fails, try to get current session
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession) {
              console.log('Found existing session, proceeding with that');
              session = currentSession;
            } else {
              throw exchangeError;
            }
          }
        }

        // Clear the timeout since we got a response
        clearTimeout(timeoutId);

        if (!isMounted) return;

        // Check if user profile exists
        setStatus('Checking user profile...');
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        console.log('Profile check result:', { 
          hasProfile: !!profile, 
          profileError: profileError?.code,
          userId: session.user.id 
        });

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Profile fetch error:', profileError);
          throw profileError;
        }

        console.log('Profile status:', profile ? 'Found' : 'Not found');
        
        // If this is a new user (no profile or no handle)
        if (!profile || !profile.handle) {
          console.log('New user detected, setting up profile...');
          // Clear any existing profile data
          if (profile && !profile.handle) {
            console.log('Removing incomplete profile...');
            await supabase
              .from('profiles')
              .delete()
              .eq('id', session.user.id);
          }
          
          // Set both flags for new user setup
          await Promise.all([
            AsyncStorage.setItem('isNewUser', 'true'),
            AsyncStorage.setItem('isProfileSetupMode', 'true'),
            AsyncStorage.removeItem('profile') // Clear any cached profile
          ]);

          console.log('Setup flags set, redirecting to handle setup');
          if (isMounted) {
            router.replace('/auth/handle');
          }
        } else {
          console.log('Existing user detected, redirecting to main app');
          // Clear both flags for existing user
          await Promise.all([
            AsyncStorage.removeItem('isNewUser'),
            AsyncStorage.removeItem('isProfileSetupMode'),
          ]);
          
          if (isMounted) {
            router.replace('/(tabs)');
          }
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Authentication failed');
          // Add a delay before redirecting on error
          setTimeout(() => {
            if (isMounted) {
              router.replace('/auth');
            }
          }, 2000);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
        clearTimeout(timeoutId);
      }
    };

    handleAuth();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
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
