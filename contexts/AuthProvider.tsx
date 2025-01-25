import React, { useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { supabase } from '../lib/supabase';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PropsWithChildren } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '../types/profile';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as Linking from 'expo-linking';
import { EMAIL_APPS } from '../constants/EmailApps';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.error('Error fetching profile:', profileError);
            if (profileError.code === 'PGRST116') {
              // No profile found, create one
              setIsNewUser(true);
              const { error: insertError } = await supabase
                .from('profiles')
                .insert([{ id: session.user.id }]);
              
              if (insertError) {
                console.error('Error creating profile:', insertError);
                throw insertError;
              }
            } else {
              throw profileError;
            }
          } else if (profileData) {
            setProfile(profileData);
            setIsNewUser(false);
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
          // Don't throw here - we want to keep the session even if profile fetch fails
          setProfile(null);
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setIsNewUser(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string): Promise<void> => {
    try {
      const redirectUrl = Linking.createURL('auth/callback');
      console.log('Using redirect URL:', redirectUrl);

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      Alert.alert(
        'Check your email',
        'We sent you a magic link to sign in',
        [
          ...EMAIL_APPS.map(app => ({
            text: app.name,
            style: 'default' as const,
            onPress: async () => {
              const canOpen = await Linking.canOpenURL(app.scheme);
              if (canOpen) {
                await Linking.openURL(app.scheme);
              } else if ('fallbackUrl' in app && app.fallbackUrl) {
                await Linking.openURL(app.fallbackUrl);
              }
            },
          })),
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setProfile(null);
      await AsyncStorage.removeItem('supabase.auth.token');
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (newProfile: Partial<Profile>): Promise<void> => {
    try {
      setIsLoading(true);

      if (newProfile.handle) {
        const { data: existingHandle } = await supabase
          .from('profiles')
          .select('id')
          .eq('handle', newProfile.handle)
          .neq('id', user?.id)
          .single();

        if (existingHandle) {
          throw new Error('Handle already taken');
        }
      }

      const updates: Partial<Profile> = {
        ...newProfile,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user?.id)
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async (): Promise<string | null> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      return result.assets[0].uri;
    }
    return null;
  };

  const uploadAvatar = async (uri: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const fileExt = uri.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode((base64 as string).split(',')[1]), {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading: isLoading,
        isNewUser,
        setIsNewUser,
        signIn,
        signOut,
        updateProfile,
        pickImage,
        uploadAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
