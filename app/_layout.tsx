import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useLocalSearchParams } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AuthProvider } from '../contexts/AuthProvider';
import { useAuth } from '../contexts/AuthContext';
import 'react-native-reanimated';
import { useColorScheme } from '@/components/useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import "../global.css";

export {
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const RootLayoutNav = () => {
  const { user, isLoading, profile } = useAuth();
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Clear navigation flags on mount
  useEffect(() => {
    const clearNavigationFlags = async () => {
      await Promise.all([
        AsyncStorage.removeItem('force_navigation'),
        AsyncStorage.removeItem('auth_callback_in_progress')
      ]);
      console.log('Navigation flags cleared on layout mount');
    };
    
    clearNavigationFlags();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;

    const checkNavigation = async () => {
      const inAuthGroup = segments[0] === 'auth';
      const isCallback = segments.join('/').includes('auth/callback');
      const currentPath = segments.join('/');
      const inEditProfile = currentPath.includes('auth/edit-profile');
      const inTabsAccount = currentPath.includes('(tabs)/Account');
      
      // Check for force navigation flag in AsyncStorage
      const forceNavigation = await AsyncStorage.getItem('force_navigation');
      const callbackInProgress = await AsyncStorage.getItem('auth_callback_in_progress');
      
      // Check for just signed out flag - priority over other checks
      const justSignedOut = await AsyncStorage.getItem('just_signed_out');
      if (justSignedOut === 'true') {
        console.log('Just signed out flag detected, navigating to auth');
        // Clear the flag first
        await AsyncStorage.removeItem('just_signed_out');
        
        // Use immediate navigation for sign out, with proper cleanup to prevent loops
        await Promise.all([
          AsyncStorage.removeItem('force_navigation'),
          AsyncStorage.removeItem('auth_callback_in_progress'),
          AsyncStorage.removeItem('last_processed_code'),
          AsyncStorage.removeItem('isProfileSetupMode') // Clear profile setup mode too
        ]);
        
        // IMPORTANT: This must be synchronous to avoid white screen
        console.log('Immediately navigating to auth after sign out');
        router.replace('/auth');
        return;
      }
      
      // Check for force param in URL
      const forceParam = params.force === 'true';
      
      console.log('Navigation state:', { 
        user: !!user, 
        inAuthGroup,
        segments,
        hasProfile: !!profile,
        currentPath,
        inEditProfile,
        inTabsAccount,
        isCallback,
        forceNavigation,
        forceParam,
        callbackInProgress,
        justSignedOut
      });

      // If we're already in the account tab, never redirect
      if (user && inTabsAccount) {
        console.log('Already in account tab with authenticated user, not redirecting');
        return;
      }

      // Special case for callback screen with authenticated user
      if (isCallback && user) {
        console.log('User is authenticated in callback screen - navigating to tabs');
        router.replace('/(tabs)');
        return;
      }

      // If there's a force flag (from AsyncStorage or URL), go to tabs immediately
      if (forceNavigation === 'true' || forceParam) {
        console.log('Force navigation detected - immediately going to tabs');
        // Clear flags first
        await Promise.all([
          AsyncStorage.removeItem('force_navigation'),
          AsyncStorage.removeItem('auth_callback_in_progress'),
          AsyncStorage.removeItem('just_signed_out')
        ]);
        
        // Use direct navigation to tabs
        router.replace('/(tabs)');
        return;
      }

      // Don't interfere with auth callback that's in progress ONLY if very recent
      if (isCallback && callbackInProgress === 'true') {
        console.log('In active callback flow, not redirecting');
        return;
      }

      // Add a safety timeout to clear callback in progress flag after 10 seconds
      // This prevents getting permanently stuck in the callback
      if (callbackInProgress === 'true') {
        setTimeout(async () => {
          console.log('Safety timeout: clearing callback in progress flag');
          await AsyncStorage.removeItem('auth_callback_in_progress');
        }, 10000);
      }

      // If we're already in edit profile, don't redirect
      if (inEditProfile) {
        console.log('In edit profile flow, not redirecting');
        return;
      }

      // Use setTimeout to ensure navigation happens after layout is complete
      setTimeout(() => {
        // If no user, redirect to auth
        if (!user && !inAuthGroup) {
          console.log('Redirecting to /auth: No user and not in auth group');
          router.replace('/auth');
          return;
        }

        // If user exists but in auth group (except specific exceptions), go to tabs
        if (user && inAuthGroup && !inEditProfile && !isCallback) {
          console.log('Redirecting to /(tabs): User authenticated and in auth group');
          router.replace('/(tabs)');
          return;
        }
        
        // Never redirect away from tabs if user is authenticated
        if (user && currentPath.includes('/(tabs)')) {
          console.log('Already in tabs with authenticated user, not redirecting');
          return;
        }
      }, 0);
    };
    
    checkNavigation();
  }, [user, isLoading, segments, profile, params]);

  if (isLoading) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
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
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

const RootLayout = () => {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
};

RootLayout.displayName = 'RootLayout';
export default RootLayout;
