import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PostgrestError } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HandleScreen() {
  const [handle, setHandle] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();
  const { 
    user, 
    profile, 
    isNewUser, 
    isProfileSetupMode, 
    updateProfile, 
    setProfile,
    setIsProfileSetupMode,
    refreshUser
  } = useAuth();

  // Debug log
  console.log('[HandleScreen] Component rendered with:', {
    userId: user?.id,
    hasProfile: !!profile,
    profileId: profile?.id,
    profileHandle: profile?.handle,
    isNewUser,
    isProfileSetupMode
  });

  useEffect(() => {
    const initializeScreen = async () => {
      console.log('[HandleScreen] Mounted with state:', {
        handle,
        isLoading,
        hasProfile: !!profile,
        isNewUser,
        isProfileSetupMode,
        userId: user?.id
      });

      // Always ensure we're in setup mode when on this screen
      console.log('[HandleScreen] Setting profile setup mode to true');
      await AsyncStorage.setItem('isProfileSetupMode', 'true');
      setIsProfileSetupMode(true);
      
      if (profile?.handle) {
        setHandle(profile.handle);
      }
    };

    initializeScreen();

    return () => {
      console.log('[HandleScreen] Unmounting');
    };
  }, []);

  useEffect(() => {
    console.log('[HandleScreen] Profile or setup mode changed:', {
      hasProfile: !!profile,
      isProfileSetupMode,
      handle: profile?.handle
    });
  }, [profile, isProfileSetupMode]);

  useEffect(() => {
    console.log('[HandleScreen] Handle changed:', handle);
  }, [handle]);

  useEffect(() => {
    console.log('[HandleScreen] Error changed:', error);
  }, [error]);

  useEffect(() => {
    console.log('[HandleScreen] Is loading changed:', isLoading);
  }, [isLoading]);

  useEffect(() => {
    // Only navigate if we have a complete profile and we're not coming from a fresh render
    if (profile?.handle && isProfileSetupMode && !isLoading) {
      console.log('[HandleScreen] Profile has handle and in setup mode - navigating to profile picture');
      setTimeout(() => {
        router.replace('/auth/profile-picture');
      }, 500);
    }
  }, [profile?.handle, isProfileSetupMode, isLoading]);

  // Direct navigation function
  const navigateToProfilePicture = () => {
    console.log('[HandleScreen] Directly navigating to profile picture screen');
    try {
      // Try the router approach
      router.replace('/auth/profile-picture');
    } catch (error) {
      console.error('[HandleScreen] Navigation error:', error);
      // Try again after a short delay
      setTimeout(() => {
        try {
          router.replace('/auth/profile-picture');
        } catch (innerError) {
          console.error('[HandleScreen] Second navigation attempt failed:', innerError);
        }
      }, 500);
    }
  };

  const validateHandle = async (handle: string): Promise<string | null> => {
    if (!handle) return 'Username is required';
    if (handle.length < 3) return 'Username must be at least 3 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(handle)) return 'Only letters, numbers and underscores allowed';

    // Check handle availability
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('handle', handle)
        .neq('id', user?.id)
        .single();

      if (data) return 'Username is already taken';
      if (error && error.code !== 'PGRST116') throw error;
      
      return null;
    } catch (error) {
      console.error('Handle validation error:', error);
      return 'Error checking username availability';
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!user?.id) {
      setError('User not found. Please try logging in again.');
      return;
    }

    if (!handle.trim()) {
      setError('Username is required');
      return;
    }

    try {
      // Set loading state
      setIsLoading(true);
      setError('');
      
      // Ensure we're in profile setup mode
      setIsProfileSetupMode(true);
      await AsyncStorage.setItem('isProfileSetupMode', 'true');

      // Validate handle
      const validationError = await validateHandle(handle);
      if (validationError) {
        setError(validationError);
        setIsLoading(false);
        return;
      }

      // Use updateProfile from context instead of direct Supabase call
      console.log('[HandleScreen] Updating profile with handle:', handle);
      try {
        await updateProfile({ handle: handle.trim() });
        console.log('[HandleScreen] Profile updated successfully');
        
        // Refresh user data to ensure we have the latest profile
        await refreshUser();
        
        // Clear loading state
        setIsLoading(false);
        
        // Navigate directly to profile picture screen
        console.log('[HandleScreen] Navigating directly to profile picture screen');
        navigateToProfilePicture();
      } catch (updateError) {
        console.error('[HandleScreen] Profile update error:', updateError);
        throw updateError;
      }
    } catch (error) {
      console.error('[HandleScreen] Error:', error);
      setError(error instanceof Error ? 
        error.message.replace('handle', 'username') :
        'Failed to save username. Please try again.'
      );
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose your handle</Text>
      <Text style={styles.subtitle}>
        This is your unique identifier that others will use to find you
      </Text>

      <TextInput
        style={styles.input}
        value={handle}
        onChangeText={setHandle}
        placeholder="Enter your handle"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={() => {
          if (isLoading) return; // Prevent multiple clicks
          console.log('[HandleScreen] Continue button pressed');
          handleSubmit();
        }}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Saving...' : 'Continue'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16,
  },
  error: {
    color: 'red',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
