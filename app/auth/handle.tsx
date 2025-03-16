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
  const { user, profile, isNewUser, isProfileSetupMode, updateProfile, setProfile } = useAuth();

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

      // If we don't have a profile or handle, ensure we're in setup mode
      if (!profile?.handle) {
        console.log('[HandleScreen] No profile/handle found - ensuring setup mode');
        await AsyncStorage.setItem('isProfileSetupMode', 'true');
      }

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
    if (profile?.handle && isProfileSetupMode) {
      console.log('[HandleScreen] Profile has handle and in setup mode - navigating to profile picture');
      router.replace('/auth/profile-picture');
    }
  }, [profile?.handle, isProfileSetupMode]);

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
    try {
      console.log('[HandleScreen] Starting handle submission');
      
      if (!user?.id) {
        console.error('[HandleScreen] No user ID found');
        setError('User not found. Please try logging in again.');
        return;
      }

      setIsLoading(true);
      setError('');

      const validationError = await validateHandle(handle);
      if (validationError) {
        setError(validationError);
        setIsLoading(false);
        return;
      }

      console.log('[HandleScreen] Upserting profile with handle:', handle);
      const { data, error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          handle: handle.trim(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (updateError) throw updateError;

      console.log('[HandleScreen] Profile updated successfully with handle:', handle);
      
      if (data) {
        setProfile(data);
      }
      
      router.replace('/auth/profile-picture');
    } catch (error) {
      console.error('[HandleScreen] Error updating profile:', error);
      setError(error instanceof Error ? 
        error.message.replace('handle', 'username') :
        'Failed to save username. Please try again.'
      );
    } finally {
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
        onPress={handleSubmit}
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
