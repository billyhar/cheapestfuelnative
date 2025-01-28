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
  const { user, profile, isNewUser, isProfileSetupMode } = useAuth();

  useEffect(() => {
    console.log('[HandleScreen] Mounted with state:', {
      handle,
      isLoading,
      hasProfile: !!profile,
      isNewUser,
      isProfileSetupMode,
      userId: user?.id
    });

    if (profile?.handle) {
      setHandle(profile.handle);
    }

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

  const validateHandle = async (handle: string): Promise<string> => {
    if (handle.length < 3) {
      return 'Handle must be at least 3 characters';
    }
    if (handle.length > 15) {
      return 'Handle must be less than 15 characters';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(handle)) {
      return 'Handle can only contain letters, numbers, and underscores';
    }

    // Check if handle is already taken
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('handle', handle)
      .neq('id', user?.id ?? '')
      .single();

    if (error && error.code !== 'PGRST116') {
      return 'Error checking handle availability';
    }

    if (data) {
      return 'Handle is already taken';
    }

    return '';
  };

  const handleSubmit = async (): Promise<void> => {
    try {
      if (!user?.id) {
        console.error('[HandleScreen] No user ID found');
        setError('User not found. Please try logging in again.');
        return;
      }

      console.log('[HandleScreen] Submitting handle:', {
        handle,
        userId: user?.id,
        isNewUser,
        isProfileSetupMode
      });
      
      setIsLoading(true);
      setError('');

      // Force profile setup mode for new users
      if (isNewUser) {
        console.log('[HandleScreen] Setting profile setup mode for new user');
        await AsyncStorage.setItem('isProfileSetupMode', 'true');
      }

      const validationError = await validateHandle(handle);
      if (validationError) {
        console.log('[HandleScreen] Validation error:', validationError);
        setError(validationError);
        setIsLoading(false);
        return;
      }

      console.log('[HandleScreen] Creating/updating profile...');
      const { data: profile, error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          handle,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (updateError) {
        console.error('[HandleScreen] Profile update error:', updateError);
        throw updateError;
      }

      console.log('[HandleScreen] Profile updated:', profile);

      // Always proceed to profile picture for new profiles
      console.log('[HandleScreen] Navigating to profile picture setup');
      router.replace('/auth/profile-picture');
    } catch (error) {
      console.error('[HandleScreen] Submit error:', error);
      setError(error instanceof Error ? error.message : 'Failed to save handle');
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
