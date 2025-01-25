import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AuthProvider } from '../contexts/AuthProvider';
import { useAuth } from '../contexts/AuthContext';
import 'react-native-reanimated';
import { useColorScheme } from '@/components/useColorScheme';

import "../global.css";

export {
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const RootLayoutNav = () => {
  const { user, loading } = useAuth();
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    console.log('Auth state:', { user: !!user, inAuthGroup, segments });

    if (user && inAuthGroup) {
      // Redirect to tabs if user is signed in and in auth group
      router.replace('/(tabs)');
    } else if (!user && !inAuthGroup) {
      // Redirect to auth if user is not signed in and not in auth group
      router.replace('/auth');
    }
  }, [user, loading, segments]);

  if (loading) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen 
          name="auth" 
          options={{ 
            headerShown: false,
            animation: 'none'
          }} 
        />
        <Stack.Screen 
          name="auth/callback" 
          options={{ 
            headerShown: false,
            animation: 'none'
          }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            animation: 'none'
          }} 
        />
      </Stack>
    </ThemeProvider>
  );
};

const RootLayout = () => {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
};

RootLayout.displayName = 'RootLayout';
export default RootLayout;
