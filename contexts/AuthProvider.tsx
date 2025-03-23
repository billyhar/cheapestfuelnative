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
      console.log('Auth state changed:', event, {
        userId: session?.user?.id,
        isNewUser,
        isProfileSetupMode,
        pathname
      });
      
      setSession(session);
      setUser(session?.user ?? null);

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
        console.log('🔐 Auth event requires profile refresh:', event);
        
        try {
          // For SIGNED_IN specifically, ensure profile with handle exists
          if (event === 'SIGNED_IN') {
            console.log('🔐 SIGNED_IN detected, ensuring profile exists immediately');
            
            // Check if profile exists
            const { data: existingProfile, error: checkError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();
              
            console.log('🔐 Profile check result:', existingProfile?.handle || 'not found');
              
            // Create profile if it doesn't exist or has null handle
            if (!existingProfile || !existingProfile.handle) {
              console.log('🔐 Profile missing or has no handle, creating now');
              
              // Generate handle
              const baseHandle = 'fueler';
              const randomNum = Math.floor(1000 + Math.random() * 9000);
              const handle = `${baseHandle}${randomNum}`;
              
              console.log('🔐 Generated handle:', handle);
              
              // If profile exists but has no handle, update it
              if (existingProfile) {
                console.log('🔐 Updating existing profile with handle');
                const { data: updatedProfile, error: updateError } = await supabase
                  .from('profiles')
                  .update({ 
                    handle: handle,
                    is_handle_auto_generated: true,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', session.user.id)
                  .select()
                  .single();
                  
                if (updateError) {
                  console.error('🔐 Error updating profile with handle:', updateError);
                } else {
                  console.log('🔐 Successfully updated profile with handle:', updatedProfile);
                  setProfile(updatedProfile);
                }
              } else {
                // Create new profile with handle
                console.log('🔐 Creating brand new profile with handle');
                const { data: newProfile, error: insertError } = await supabase
                  .from('profiles')
                  .insert({
                    id: session.user.id,
                    handle: handle,
                    is_handle_auto_generated: true,
                    updated_at: new Date().toISOString()
                  })
                  .select()
                  .single();
                  
                if (insertError) {
                  console.error('🔐 Error creating profile with handle:', insertError);
                  
                  // Fallback - try insert without returning
                  console.log('🔐 Trying fallback profile creation');
                  await supabase
                    .from('profiles')
                    .insert({
                      id: session.user.id,
                      handle: handle,
                      is_handle_auto_generated: true,
                      updated_at: new Date().toISOString()
                    });
                    
                  // Verify by fetching separately
                  const { data: verifiedProfile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                    
                  if (verifiedProfile) {
                    console.log('🔐 Verified fallback profile creation:', verifiedProfile);
                    setProfile(verifiedProfile);
                  }
                } else if (newProfile) {
                  console.log('🔐 Successfully created new profile with handle:', newProfile);
                  setProfile(newProfile);
                }
              }
            } else {
              console.log('🔐 Profile with handle already exists:', existingProfile);
              setProfile(existingProfile);
            }
            
            // Flag initial login
            await AsyncStorage.setItem('initial_login', 'true');
          } else {
            // For other events just use the standard refresh
            await refreshUser();
          }
        } catch (error) {
          console.error('Error handling auth event:', error);
          
          // If there was an error during SIGNED_IN, still try to refresh user as fallback
          if (event === 'SIGNED_IN') {
            try {
              console.log('🔐 Error during profile creation, trying refreshUser as fallback');
              await refreshUser();
            } catch (fallbackError) {
              console.error('🔐 Fallback refreshUser also failed:', fallbackError);
            }
          }
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

      // Set flag immediately before any async operations
      await AsyncStorage.setItem('just_signed_out', 'true');
      
      // Clear all auth-related storage including last_processed_code flag we added
      await AsyncStorage.multiRemove([
        'supabase.auth.token',
        'isNewUser',
        'user',
        'profile',
        'isProfileSetupMode',
        'last_processed_code' // Add this to clear our auth code cache
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
      
      // In case of error, make sure the flag is still set
      await AsyncStorage.setItem('just_signed_out', 'true');
    } finally {
      setIsLoading(false);
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

  const refreshUser = async (): Promise<void> => {
    // Skip if already refreshing to prevent race conditions
    if (isRefreshingUserRef.current) {
      console.log('Skip refreshUser - already in progress');
      return;
    }
    
    // Set flag to indicate refresh is in progress
    isRefreshingUserRef.current = true;
    
    try {
      console.log('↻ Refreshing user data');
      
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Error getting session during refresh:', sessionError);
        return;
      }
      
      if (!session || !session.user) {
        console.log('↻ No active session during refresh, clearing user data');
        setUser(null);
        setProfile(null);
        return;
      }
      
      // Update user state
      setUser(session.user);
      
      // First check if this is an initial login session and needs a prioritized profile creation
      const initialLogin = await AsyncStorage.getItem('initial_login');
      if (initialLogin === 'true') {
        console.log('↻ Initial login detected during refresh, prioritizing profile creation');
        
        // Check for existing profile with direct query (no single() to avoid PGRST116 errors)
        const { data: existingProfiles } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id);
          
        if (!existingProfiles || existingProfiles.length === 0) {
          console.log('↻ No profile found during initial login refresh, creating immediately');
          
          // Generate a unique handle for the new user
          const baseHandle = 'fueler';
          const randomNum = Math.floor(1000 + Math.random() * 9000);
          const handle = `${baseHandle}${randomNum}`;
          
          // Create the profile with auto-generated handle - don't use single() as it can cause errors
          const { data: newProfiles, error: createError } = await supabase
            .from('profiles')
            .insert({ 
              id: session.user.id, 
              handle,
              avatar_url: null,
              is_handle_auto_generated: true,
              updated_at: new Date().toISOString() 
            })
            .select();
            
            if (createError) {
              console.error('↻ Error creating profile during initial login:', createError);
            } else if (newProfiles && newProfiles.length > 0) {
              console.log('↻ Profile created successfully during initial login');
              setProfile(newProfiles[0]);
              
              // Clear initial login flag after successful profile creation
              await AsyncStorage.removeItem('initial_login');
              return; // Exit early as we've already set the profile
            }
        } else if (existingProfiles.length > 0) {
          console.log('↻ Found existing profile during initial login refresh');
          setProfile(existingProfiles[0]);
          
          // Clear initial login flag after successful profile retrieval
          await AsyncStorage.removeItem('initial_login');
          return; // Exit early as we've already set the profile
        }
      }
      
      console.log('↻ Fetching profile for user:', session.user.id);
      
      // Attempt to fetch profile with retry mechanism
      let fetchAttempts = 0;
      let profile = null;
      let createAttempts = 0;
      
      while (fetchAttempts < 2 && !profile) {
        fetchAttempts++;
        
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          if (error) {
            // If profile doesn't exist, create one
            if (error.code === 'PGRST116') {
              console.log(`↻ Profile not found (attempt ${fetchAttempts}), need to create one`);
              
              // Try to create profile with retries
              while (createAttempts < 3 && !profile) {
                createAttempts++;
                console.log(`↻ Creating profile (attempt ${createAttempts})`);
                
                try {
                  // Generate a unique handle
                  const baseHandle = 'fueler';
                  const randomNum = Math.floor(1000 + Math.random() * 9000);
                  const handle = `${baseHandle}${randomNum}`;
                  
                  console.log(`↻ Generated handle: ${handle} for user: ${session.user.id}`);
                  
                  // Create profile with auto-generated handle
                  const { data: newProfile, error: createError } = await supabase
                    .from('profiles')
                    .insert({ 
                      id: session.user.id, 
                      handle: handle,
                      avatar_url: null,
                      is_handle_auto_generated: true,
                      updated_at: new Date().toISOString() 
                    })
                    .select()
                    .single();
                    
                  if (createError) {
                    console.error(`↻ Error creating profile (attempt ${createAttempts}):`, createError);
                    
                    // Wait between retries
                    if (createAttempts < 3) {
                      console.log('↻ Waiting before retry...');
                      await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                  } else {
                    console.log('↻ Profile created successfully:', newProfile);
                    profile = newProfile;
                    break;
                  }
                } catch (createError) {
                  console.error(`↻ Unexpected error creating profile (attempt ${createAttempts}):`, createError);
                  
                  if (createAttempts < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                }
              }
              
              if (!profile && createAttempts >= 3) {
                console.error('↻ Failed to create profile after multiple attempts');
              }
            } else {
              console.error('↻ Error fetching profile:', error);
              
              // Wait before retry
              if (fetchAttempts < 2) {
                console.log('↻ Waiting before retry...');
                await new Promise(resolve => setTimeout(resolve, 800));
              }
            }
          } else {
            console.log('↻ Profile fetched successfully');
            profile = data;
          }
        } catch (fetchError) {
          console.error(`↻ Unexpected error fetching profile (attempt ${fetchAttempts}):`, fetchError);
          
          if (fetchAttempts < 2) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        }
      }
      
      // Update profile state
      setProfile(profile);
      
      console.log('↻ User refresh complete', { 
        hasUser: !!session.user,
        hasProfile: !!profile
      });
      
    } catch (error) {
      console.error('Error in refreshUser:', error);
    } finally {
      // Clear flag when done
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
