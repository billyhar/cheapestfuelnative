import React, { useState, useEffect, useRef } from 'react';
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

  // Use ref to prevent multiple refreshUser calls from running simultaneously
  const isRefreshingUserRef = useRef(false);

  const checkAndSetProfileSetupMode = async (profileData: Profile | null) => {
    console.log('Checking profile setup mode:', {
      hasProfile: !!profileData,
      handle: profileData?.handle,
      avatar_url: profileData?.avatar_url
    });

    // Get current state first
    const storedIsProfileSetupMode = await AsyncStorage.getItem('isProfileSetupMode');
    const currentPath = pathname || '';
    
    // If we're already in the tabs section, don't redirect for profile setup
    // This prevents navigation loops
    if (currentPath.includes('/(tabs)')) {
      console.log('Already in tabs, not redirecting for profile setup');
      return false;
    }
    
    // If we're already in the handle or profile-picture screens, don't change setup mode
    if (currentPath.includes('/auth/handle') || currentPath.includes('/auth/profile-picture')) {
      console.log('Already in profile setup flow, not changing setup mode');
      return !!storedIsProfileSetupMode;
    }
    
    // Check if the profile is complete
    const isProfileComplete = profileData && profileData.handle && profileData.avatar_url;
    
    // If profile is complete, ensure setup mode is disabled
    if (isProfileComplete) {
      console.log('Profile complete - disabling setup mode');
      setIsProfileSetupMode(false);
      await AsyncStorage.removeItem('isProfileSetupMode');
      await AsyncStorage.removeItem('isNewUser');
      return false;
    }
    
    // Only set setup mode if profile is incomplete and we're not in tabs
    console.log('Profile incomplete - enabling setup mode');
    setIsProfileSetupMode(true);
    await AsyncStorage.setItem('isProfileSetupMode', 'true');
    return true;
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Session result:', { hasSession: !!session, userId: session?.user?.id });
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
        
        // Always set isProfileSetupMode based on AsyncStorage
        setIsProfileSetupMode(storedIsProfileSetupMode === 'true');
        
        if (session?.user) {
          console.log('User session found, fetching profile...');
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          console.log('Initial profile fetch result:', { 
            found: !!profileData, 
            error: profileError?.code,
            handle: profileData?.handle
          });

          if (profileError) {
            if (profileError.code === 'PGRST116') {
              console.log('No profile found - setting up new user');
              setIsNewUser(true);
              setIsProfileSetupMode(true);
              await Promise.all([
                AsyncStorage.setItem('isNewUser', 'true'),
                AsyncStorage.setItem('isProfileSetupMode', 'true')
              ]);
              
              // Automatically create profile with handle
              try {
                console.log('Automatically creating profile during initialization');
                const handle = await generateUniqueHandle();
                console.log('Generated handle during initialization:', handle);
                
                const { data: newProfile, error: createError } = await supabase
                  .from('profiles')
                  .insert({ 
                    id: session.user.id, 
                    handle: handle,
                    updated_at: new Date().toISOString() 
                  })
                  .select()
                  .single();
                  
                if (createError) {
                  console.error('Error creating profile during initialization:', createError);
                } else {
                  console.log('Profile created during initialization:', newProfile);
                  setProfile(newProfile);
                }
              } catch (createError) {
                console.error('Error in profile creation during initialization:', createError);
              }
            } else {
              console.error('Error fetching profile:', profileError);
            }
          } else if (profileData) {
            console.log('Found profile during initialization:', profileData);
            
            // If profile exists but handle is null, update it
            if (!profileData.handle) {
              try {
                console.log('Existing profile has null handle, updating during initialization');
                const handle = await generateUniqueHandle();
                console.log('Generated handle for existing profile:', handle);
                
                const { data: updatedProfile, error: updateError } = await supabase
                  .from('profiles')
                  .update({ 
                    handle: handle,
                    updated_at: new Date().toISOString() 
                  })
                  .eq('id', session.user.id)
                  .select()
                  .single();
                  
                if (updateError) {
                  console.error('Error updating profile with handle during initialization:', updateError);
                  setProfile(profileData); // Still use original profile
                } else {
                  console.log('Profile updated during initialization:', updatedProfile);
                  setProfile(updatedProfile);
                }
              } catch (updateError) {
                console.error('Error in handle generation during initialization:', updateError);
                setProfile(profileData); // Still use original profile
              }
            } else {
              setProfile(profileData);
            }
            
            // Only check profile setup mode if we're not already in the setup flow
            const currentPath = pathname || '';
            if (!currentPath.includes('/auth/handle') && !currentPath.includes('/auth/profile-picture')) {
              await checkAndSetProfileSetupMode(profileData);
            }
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
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session);
        setUser(session?.user ?? null);
        await refreshUser();
      }
      
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        await AsyncStorage.removeItem('isNewUser');
        await AsyncStorage.removeItem('isProfileSetupMode');
      }
    });

    // Handle deep linking
    const handleDeepLink = ({ url }: { url: string }) => {
      if (url.includes('auth/callback')) {
        // Handle the auth callback
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            refreshUser();
          }
        });
      }
    };

    // Set up deep link listeners
    Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string) => {
    try {
      const redirectUrl = Linking.createURL('auth/callback');
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });
      
      if (error) throw error;
      
      Alert.alert(
        'Check your email',
        'We sent you a login link. Be sure to check your spam too.'
      );
    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear local storage
      await AsyncStorage.multiRemove([
        'isNewUser',
        'isProfileSetupMode',
        'auth_callback_in_progress'
      ]);
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const updateProfile = async (newProfile: Partial<Profile>): Promise<void> => {
    try {
      setIsLoading(true);

      if (!user?.id) {
        throw new Error('User not found');
      }

      if (newProfile.handle) {
        const { data: existingHandle, error: handleCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('handle', newProfile.handle)
          .neq('id', user.id)
          .single();

        if (handleCheckError && handleCheckError.code !== 'PGRST116') {
          throw handleCheckError;
        }

        if (existingHandle) {
          throw new Error('Handle already taken');
        }
      }

      const updates: Partial<Profile> = {
        ...newProfile,
        updated_at: new Date().toISOString(),
      };

      // Check if profile exists first
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      let operation;
      if (checkError && checkError.code === 'PGRST116') {
        // Profile doesn't exist, use insert
        operation = supabase
          .from('profiles')
          .insert({ id: user.id, ...updates })
          .select();
      } else {
        // Profile exists, use update
        operation = supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select();
      }

      const { data, error } = await operation.single();

      if (error) throw error;
      
      console.log('Profile updated successfully:', data);
      setProfile(data);
      
      return data;
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update profile');
      throw error;
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
      const filePath = fileName;

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

  const refreshUser = async () => {
    if (isRefreshingUserRef.current) return;
    isRefreshingUserRef.current = true;

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) return;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const handle = await generateUniqueHandle();
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            handle,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) throw createError;
        setProfile(newProfile);
        setIsNewUser(true);
        setIsProfileSetupMode(true);
      } else if (profileError) {
        throw profileError;
      } else {
        setProfile(profile);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    } finally {
      isRefreshingUserRef.current = false;
    }
  };

  const startProfileSetup = async () => {
    // Instead of redirecting to handle screen, just refresh the user's profile
    // which will trigger the auto-generation if needed
    await refreshUser();
    
    // Navigate to edit profile directly if they want to change their auto-generated handle
    router.push('/auth/edit-profile');
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    signIn,
    signInWithGoogle: async (): Promise<void> => {
      try {
        const redirectUrl = Linking.createURL('auth/callback');
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });
        
        if (error) throw error;
        if (data?.url) {
          await Linking.openURL(data.url);
        }
      } catch (error) {
        console.error('Google sign in error:', error);
        Alert.alert('Error', error instanceof Error ? error.message : 'An error occurred');
      }
    },
    signInWithApple: async (): Promise<void> => {
      try {
        const redirectUrl = Linking.createURL('auth/callback');
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          },
        });
        
        if (error) throw error;
        if (data?.url) {
          await Linking.openURL(data.url);
        }
      } catch (error) {
        console.error('Apple sign in error:', error);
        Alert.alert('Error', error instanceof Error ? error.message : 'An error occurred');
      }
    },
    signOut,
    updateProfile,
    uploadAvatar,
    setProfile,
    pickImage,
    refreshUser,
    
    // signInWithGitHub: async (): Promise<void> => {
    //   try {
    //     const redirectUrl = Linking.createURL('auth/callback');
    //     const { data, error } = await supabase.auth.signInWithOAuth({
    //       provider: 'github',
    //       options: {
    //         redirectTo: redirectUrl,
    //       },
    //     });
        
    //     if (error) throw error;
    //     if (data?.url) {
    //       await Linking.openURL(data.url);
    //     }
    //   } catch (error) {
    //     console.error('GitHub sign in error:', error);
    //     Alert.alert('Error', error instanceof Error ? error.message : 'An error occurred');
    //   }
    // },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

async function generateUniqueHandle(): Promise<string> {
  // Generate base handle "fueler" plus random number between 1000-9999
  const baseHandle = 'fueler';
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const candidateHandle = `${baseHandle}${randomNum}`;
  
  // Check if handle already exists
  const { data } = await supabase
    .from('profiles')
    .select('handle')
    .eq('handle', candidateHandle)
    .single();
    
  if (data) {
    // Handle exists, try again with a different number
    return generateUniqueHandle();
  }
  
  return candidateHandle;
}
