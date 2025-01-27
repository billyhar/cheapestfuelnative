import React, { useState, useEffect } from 'react';
import { AuthContext, AuthContextType } from './AuthContext';
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
import { useRouter } from '../hooks/useRouter';
import { usePathname } from 'expo-router';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isProfileSetupMode, setIsProfileSetupMode] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const checkAndSetProfileSetupMode = async (profileData: Profile | null) => {
    console.log('Checking profile setup mode:', {
      hasProfile: !!profileData,
      handle: profileData?.handle,
      avatar_url: profileData?.avatar_url
    });

    if (!profileData || !profileData.handle || !profileData.avatar_url) {
      console.log('Profile incomplete - enabling setup mode');
      setIsProfileSetupMode(true);
      await AsyncStorage.setItem('isProfileSetupMode', 'true');
      return true;
    } else {
      console.log('Profile complete - disabling setup mode');
      setIsProfileSetupMode(false);
      await AsyncStorage.removeItem('isProfileSetupMode');
      return false;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        // Load persisted states first
        const [storedIsNewUser, storedIsProfileSetupMode] = await Promise.all([
          AsyncStorage.getItem('isNewUser'),
          AsyncStorage.getItem('isProfileSetupMode')
        ]);

        console.log('Stored states:', { storedIsNewUser, storedIsProfileSetupMode });
        
        if (storedIsNewUser === 'true') {
          setIsNewUser(true);
        }
        if (storedIsProfileSetupMode === 'true') {
          setIsProfileSetupMode(true);
        }
        
        if (session?.user) {
          console.log('User session found, fetching profile...');
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            if (profileError.code === 'PGRST116') {
              console.log('No profile found - setting up new user');
              setIsNewUser(true);
              setIsProfileSetupMode(true);
              await Promise.all([
                AsyncStorage.setItem('isNewUser', 'true'),
                AsyncStorage.setItem('isProfileSetupMode', 'true')
              ]);
            } else {
              console.error('Error fetching profile:', profileError);
            }
          } else if (profileData) {
            setProfile(profileData);
            await checkAndSetProfileSetupMode(profileData);
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, {
        userId: session?.user?.id,
        isNewUser,
        isProfileSetupMode
      });
      
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
              console.log('No profile found - starting profile setup');
              setIsNewUser(true);
              setIsProfileSetupMode(true);
              await Promise.all([
                AsyncStorage.setItem('isNewUser', 'true'),
                AsyncStorage.setItem('isProfileSetupMode', 'true')
              ]);
              
              if (!pathname?.includes('/auth/handle')) {
                console.log('Redirecting to handle setup (new user)');
                router.replace('/auth/handle');
              }
            } else {
              throw profileError;
            }
          } else if (profileData) {
            setProfile(profileData);
            const needsSetup = await checkAndSetProfileSetupMode(profileData);
            
            if (needsSetup && !pathname?.includes('/auth/handle')) {
              console.log('Redirecting to handle setup (incomplete profile)');
              router.replace('/auth/handle');
            }
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out - clearing states');
        setProfile(null);
        setIsNewUser(false);
        setIsProfileSetupMode(false);
        await Promise.all([
          AsyncStorage.removeItem('isNewUser'),
          AsyncStorage.removeItem('isProfileSetupMode'),
          AsyncStorage.removeItem('profile')
        ]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]);

  const signIn = async (email: string): Promise<void> => {
    try {
      const redirectUrl = Linking.createURL('auth/callback');
      console.log('=== Sign In Debug Log ===');
      console.log('Email:', email);
      console.log('Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        },
      });

      console.log('Sign in response:', { data, error });

      if (error) {
        console.error('Sign in error:', error);
        throw error;
      }

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
      console.log('Starting sign out process');
      setIsLoading(true);

      // Clear all auth-related storage
      await AsyncStorage.multiRemove([
        'supabase.auth.token',
        'isNewUser',
        'user',
        'profile',
        'isProfileSetupMode'
      ]);

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase sign out error:', error);
        throw error;
      }

      console.log('Successfully signed out from Supabase');

      // Clear all state
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsNewUser(false);
      setIsProfileSetupMode(false);

      // Navigation will be handled by the root layout's auth state change effect
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
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

  const refreshUser = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          setProfile(null);
        } else {
          setProfile(profileData);
        }
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startProfileSetup = async () => {
    setIsProfileSetupMode(true);
    await AsyncStorage.setItem('isProfileSetupMode', 'true');
    router.push('/auth/handle');
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    isNewUser,
    isProfileSetupMode,
    signIn,
    signOut,
    updateProfile,
    uploadAvatar,
    startProfileSetup,
    setIsNewUser,
    pickImage,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
