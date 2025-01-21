import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import * as Linking from 'expo-linking';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      console.log('Handling deep link:', url);
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
          router.replace('/(tabs)');
        } else {
          router.replace('/auth');
        }
      } catch (error) {
        console.error('Deep link handling error:', error);
        router.replace('/auth');
      }
    };

    // Handle initial URL
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink(url);
    });

    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <View className="flex-1 items-center justify-center">
      <Text>Completing sign in...</Text>
    </View>
  );
} 