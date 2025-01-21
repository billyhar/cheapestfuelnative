import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AppTheme } from '../constants/BrandAssets';

import "../global.css";

export {
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const colorScheme = useColorScheme();

  useEffect(() => {
    console.log('Auth State:', { user, loading });
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [user, loading]);

  if (loading) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {user === null ? (
          <Stack.Screen 
            name="auth" 
            options={{ 
              headerShown: false,
              animation: 'none',
              title: 'Sign In'
            }} 
          />
        ) : (
          <Stack.Screen 
            name="(tabs)" 
            options={{ 
              headerShown: false,
              animation: 'none',
              title: 'CheapestFuel'
            }} 
          />
        )}
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
