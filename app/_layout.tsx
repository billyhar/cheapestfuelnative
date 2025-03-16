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
  const { user, isLoading, isProfileSetupMode, profile } = useAuth();
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    const hasRequiredProfileFields = !!profile?.handle && !!profile?.avatar_url;
    const currentPath = segments.join('/');
    const inProfileSetup = currentPath.includes('auth/handle') || currentPath.includes('auth/profile-picture');
    const inEditProfile = currentPath.includes('auth/edit-profile');
    
    console.log('Navigation state:', { 
      user: !!user, 
      inAuthGroup, 
      segments, 
      isProfileSetupMode,
      hasProfile: !!profile,
      hasRequiredProfileFields,
      currentPath,
      inProfileSetup,
      inEditProfile
    });

    // If we're in the profile setup flow or edit profile, don't redirect
    if (inProfileSetup || inEditProfile) {
      console.log('In profile setup or edit profile flow, not redirecting');
      return;
    }

    if (!isLoading) {
      // Use setTimeout to ensure navigation happens after layout is complete
      setTimeout(() => {
        // If no user, redirect to auth
        if (!user && !inAuthGroup) {
          console.log('Redirecting to /auth: No user and not in auth group');
          router.replace('/auth');
          return;
        }

        // If user exists but no profile or missing required fields, force profile setup
        if (user && !hasRequiredProfileFields && !inAuthGroup && !inEditProfile) {
          console.log('Redirecting to /auth/handle: Missing required profile fields');
          router.replace('/auth/handle');
          return;
        }

        // If user exists, has profile, is in auth group, and not in setup mode, redirect to tabs
        if (user && hasRequiredProfileFields && inAuthGroup && !isProfileSetupMode && !inEditProfile) {
          console.log('Redirecting to /(tabs): User has complete profile');
          router.replace('/(tabs)');
          return;
        }
      }, 0);
    }
  }, [user, isLoading, segments, isProfileSetupMode, profile]);

  if (isLoading) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack 
        screenOptions={{ 
          headerShown: false,
          gestureEnabled: false // Disable swipe back gesture
        }}
      >
        <Stack.Screen 
          name="auth" 
          options={{ 
            headerShown: false,
            animation: 'none',
            gestureEnabled: false
          }} 
        />
        <Stack.Screen 
          name="auth/callback" 
          options={{ 
            headerShown: false,
            animation: 'none',
            gestureEnabled: false
          }} 
        />
        <Stack.Screen 
          name="auth/handle" 
          options={{ 
            headerShown: false,
            animation: 'none',
            gestureEnabled: false
          }} 
        />
        <Stack.Screen 
          name="auth/profile-picture" 
          options={{ 
            headerShown: false,
            animation: 'none',
            gestureEnabled: false
          }} 
        />
        <Stack.Screen 
          name="auth/edit-profile" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right',
            gestureEnabled: true
          }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            animation: 'none',
            gestureEnabled: false
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
