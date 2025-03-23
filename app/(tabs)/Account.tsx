import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Image, SafeAreaView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { Profile } from '../../types/profile';
import { ProfileAvatar } from '@/components/ProfileAvatar';


export default function AccountScreen() {
  const { user, profile: authProfile, signOut, refreshUser } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [dismissedCustomizePrompt, setDismissedCustomizePrompt] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [localProfile, setLocalProfile] = useState<Profile | null>(null);
  const [emergencyCreationAttempted, setEmergencyCreationAttempted] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const params = useLocalSearchParams();
  
  // Refs for tracking state
  const initialLoadCompleteRef = useRef(false);
  const isCreatingProfileRef = useRef(false);
  const lastRefreshTimeRef = useRef<number>(0);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const forceLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshAttemptsRef = useRef(0);
  
  // Function to safely fetch profile directly from database
  const fetchProfileDirectly = useCallback(async () => {
    if (!user) return null;
    
    try {
      console.log('🔍 Directly fetching profile for:', user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (error) {
        console.log('🔍 Error fetching profile directly:', error.code);
        return null;
      }
      
      console.log('🔍 Found profile directly:', data?.handle);
      return data;
    } catch (error) {
      console.error('🔍 Unexpected error during direct profile fetch:', error);
      return null;
    }
  }, [user]);
  
  // Function to create profile directly if needed
  const createProfileIfNeeded = useCallback(async () => {
    if (!user) return null;
    
    // Limit attempts
    if (refreshAttemptsRef.current > 2) {
      console.log('🔧 Too many attempts, skipping profile creation');
      return null;
    }
    
    if (isCreatingProfileRef.current) {
      console.log('🔧 Profile creation already in progress, skipping');
      return null;
    }
    
    try {
      isCreatingProfileRef.current = true;
      console.log('🔧 Creating profile for:', user.id);
      
      // Create new profile with handle and default avatar
      const baseHandle = 'fueler';
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const handle = `${baseHandle}${randomNum}`;
      
      // Default avatar path in Supabase storage
      const defaultAvatarPath = 'defaults/default-avatar.png'; // Make sure this exists in your Supabase storage
      
      try {
        console.log('🔧 Creating profile with handle:', handle);
        const { data, error } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            handle,
            is_handle_auto_generated: true,
            avatar_url: defaultAvatarPath,
            updated_at: new Date().toISOString()
          })
          .select();
          
        if (error) {
          console.error('🔧 Error creating profile:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          console.log('🔧 Successfully created profile:', data[0]);
          return data[0];
        }
      } catch (error) {
        // Try simpler insert as fallback
        console.log('🔧 Trying fallback profile creation');
        await supabase
          .from('profiles')
          .insert({
            id: user.id,
            handle,
            is_handle_auto_generated: true,
            avatar_url: defaultAvatarPath,
            updated_at: new Date().toISOString()
          });
        
        // Verify it worked
        await new Promise(resolve => setTimeout(resolve, 500));
        const verifyProfile = await fetchProfileDirectly();
        if (verifyProfile) {
          console.log('🔧 Verified profile creation:', verifyProfile);
          return verifyProfile;
        }
      }
      
      return null;
    } catch (error) {
      console.error('🔧 Unexpected error during profile creation:', error);
      return null;
    } finally {
      isCreatingProfileRef.current = false;
    }
  }, [user, fetchProfileDirectly]);

  // Function to refresh profile data with throttling
  const refreshProfileData = useCallback(async () => {
    refreshAttemptsRef.current += 1;
    if (refreshAttemptsRef.current > 3) {
      console.log(`⏱️ Skipping refresh - too many attempts (${refreshAttemptsRef.current})`);
      setIsLoadingProfile(false);
      return;
    }
    
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < 3000) {
      console.log('⏱️ Skipping refresh - too soon since last refresh');
      return;
    }
    
    lastRefreshTimeRef.current = now;
    setIsLoadingProfile(true);
    
    try {
      console.log('🔄 Refreshing profile data');
      
      // Try auth context refresh
      try {
        await refreshUser();
      } catch (error) {
        console.error('Error in refreshUser:', error);
      }
      
      // Try direct fetch
      const directProfile = await fetchProfileDirectly();
      if (directProfile) {
        setLocalProfile(directProfile);
        setIsLoadingProfile(false);
        return;
      }
      
      // Try create if needed
      if (!directProfile && user && refreshAttemptsRef.current <= 2) {
        const createdProfile = await createProfileIfNeeded();
        if (createdProfile) {
          setLocalProfile(createdProfile);
        }
      }
    } catch (error) {
      console.error('🔄 Error refreshing profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [refreshUser, fetchProfileDirectly, createProfileIfNeeded, user]);
  
  // Preload profile from auth context
  useEffect(() => {
    if (authProfile) {
      setLocalProfile(authProfile);
      console.log('Using auth profile immediately:', authProfile.handle);
    }
  }, [authProfile]);

  // Force exit from loading state after 2 seconds
  useEffect(() => {
    if (isLoadingProfile) {
      forceLoadTimeoutRef.current = setTimeout(() => {
        console.log('🚨 FORCE EXIT from loading state after 2 seconds');
        setIsLoadingProfile(false);
      }, 2000);
      
      return () => {
        if (forceLoadTimeoutRef.current) clearTimeout(forceLoadTimeoutRef.current);
      };
    }
  }, [isLoadingProfile]);

  // Initial load when component mounts
  useEffect(() => {
    if (initialLoadCompleteRef.current) return;
    
    initialLoadCompleteRef.current = true;
    console.log('📱 Account screen mounted, initializing');
    
    const initializeProfile = async () => {
      try {
        // Try auth context first
        if (authProfile) {
          console.log('📱 Using existing auth profile:', authProfile.handle);
          setLocalProfile(authProfile);
          return;
        } 
        
        // Try direct fetch
        const directProfile = await fetchProfileDirectly();
        if (directProfile) {
          console.log('📱 Using direct profile:', directProfile.handle);
          setLocalProfile(directProfile);
          return;
        }
        
        // Try create if needed
        if (!authProfile && !directProfile && user) {
          console.log('📱 No profile found, creating one');
          
          try {
            const createdProfile = await createProfileIfNeeded();
            if (createdProfile) {
              console.log('📱 Created new profile:', createdProfile.handle);
              setLocalProfile(createdProfile);
              return;
            }
          } catch (err) {
            console.error('Error creating profile:', err);
          }
        }
      } catch (error) {
        console.error('📱 Error in initial profile load:', error);
      }
    };
    
    initializeProfile();
  }, [user, authProfile, fetchProfileDirectly, createProfileIfNeeded]);
  
  // Process param-based refreshes
  useEffect(() => {
    if (refreshAttemptsRef.current > 2) {
      console.log('Ignoring refresh parameter - too many attempts already');
      return;
    }
    
    if (params.refresh && user && !isLoadingProfile) {
      console.log('📱 Refresh parameter detected:', params.refresh);
      refreshProfileData();
    }
  }, [params.refresh, refreshProfileData, user, isLoadingProfile]);

  // Check if user has dismissed customize prompt
  useEffect(() => {
    const checkDismissedPrompt = async () => {
      try {
        const dismissed = await AsyncStorage.getItem('dismissedCustomizePrompt');
        if (dismissed === 'true') {
          setDismissedCustomizePrompt(true);
        }
      } catch (error) {
        console.error('Error checking dismissed prompt:', error);
      }
    };
    
    checkDismissedPrompt();
  }, []);

  const dismissCustomizePrompt = async () => {
    try {
      await AsyncStorage.setItem('dismissedCustomizePrompt', 'true');
      setDismissedCustomizePrompt(true);
    } catch (error) {
      console.error('Error setting dismissed prompt:', error);
    }
  };

  // Get the effective profile
  const effectiveProfile = localProfile || authProfile;
  
  // Check if handle is auto-generated
  const isAutoGeneratedHandle = useMemo(() => {
    return effectiveProfile?.is_handle_auto_generated === true || 
           (effectiveProfile?.handle && effectiveProfile.handle.startsWith('fueler'));
  }, [effectiveProfile]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      console.log('Logging out via Account screen');
      await AsyncStorage.setItem('just_signed_out', 'true');
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getAvatarUrl = () => {
    if (!effectiveProfile?.avatar_url) {
      return null;
    }

    // If it's already a full URL, use it directly
    if (effectiveProfile.avatar_url.startsWith('http')) {
      return effectiveProfile.avatar_url;
    }

    // Otherwise, construct the Supabase storage URL
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(effectiveProfile.avatar_url);
    
    return data?.publicUrl || null;
  };

  const navigateToEdit = () => {
    router.push('/auth/edit-profile');
  };

  // Get the display handle - use actual generated handle whenever possible
  const getDisplayHandle = () => {
    if (effectiveProfile?.handle) {
      return effectiveProfile.handle;
    }
    
    // Fallback to a fueler handle if we can generate one
    if (user) {
      return `fueler${Math.floor(1000 + Math.random() * 9000)}`;
    }
    
    return 'User';
  };

  // Loading state
  if (isLoadingProfile) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1B75BA" />
          <Text className="mt-4 text-gray-700">Loading profile...</Text>
          <TouchableOpacity 
            onPress={() => {
              setIsLoadingProfile(false);
              setShowPlaceholder(true);
            }}
            className="mt-6 py-2 px-4"
          >
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // One-time emergency profile creation attempt
  if (!effectiveProfile && user && !emergencyCreationAttempted && !showPlaceholder) {
    setEmergencyCreationAttempted(true);
    console.log('One-time emergency profile creation attempt');
    
    createProfileIfNeeded().then(profile => {
      if (profile) setLocalProfile(profile);
    });
    
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1B75BA" />
          <Text className="mt-4 text-lg text-gray-700">Setting up profile...</Text>
          <TouchableOpacity 
            onPress={() => setShowPlaceholder(true)}
            className="mt-6 py-2 px-4 bg-blue-500 rounded"
          >
            <Text className="text-white">Continue Anyway</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Use placeholder if needed, but still with real handle if possible
  if ((!effectiveProfile && user) || showPlaceholder) {
    const email = user?.email || 'user@example.com';
    const displayHandle = getDisplayHandle();
    
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="pt-6 px-6">
          <View className="flex-row items-center gap-4">
            <ProfileAvatar 
              avatarPath={effectiveProfile?.avatar_url}
              size={56}
              fallbackText={displayHandle}
            />
            <View className="flex-1">
              <Text className="text-lg font-semibold">{displayHandle}</Text>
              <Text className="text-gray-500 text-sm">{email}</Text>
            </View>
            <TouchableOpacity 
              onPress={navigateToEdit}
              className="bg-blue-500 px-4 py-2 rounded"
            >
              <Text className="text-white">Edit</Text>
            </TouchableOpacity>
          </View>
          
          <View className="mt-8">
            <TouchableOpacity
              onPress={handleLogout}
              className="bg-red-50 p-4 rounded-xl flex-row items-center"
            >
              <MaterialIcons name="logout" size={24} color="#EF4444" />
              <Text className="ml-3 font-medium text-red-500">Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Regular profile view
  const displayHandle = effectiveProfile?.handle || 'User';

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Main Content */}
      <View className="flex-1 px-6 pt-6">
        {/* Profile Header */}
        <View className="flex-row items-center mb-6">
          <ProfileAvatar 
            avatarPath={effectiveProfile?.avatar_url}
            size={64}
            fallbackText={displayHandle}
          />
          <View className="flex-1 ml-4">
            <Text className="text-xl font-bold">{displayHandle}</Text>
            <Text className="text-gray-500">{user?.email}</Text>
            {isAutoGeneratedHandle && !dismissedCustomizePrompt && (
              <TouchableOpacity 
                onPress={navigateToEdit}
                className="mt-1"
              >
                {/* <Text className="text-blue-500 text-sm">Customize your handle</Text> */}
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            onPress={navigateToEdit}
            className="bg-blue-500 px-4 py-2 rounded"
          >
            <Text className="text-white">Edit</Text>
          </TouchableOpacity>
        </View>
        
        {/* Auto-generated Handle Prompt */}
        {isAutoGeneratedHandle && !dismissedCustomizePrompt && (
          <View className="bg-blue-50 p-4 mt-6 rounded-lg border border-blue-200">
            <View className="flex-row justify-between">
              <View className="flex-row items-center flex-1">
                <Ionicons name="information-circle-outline" size={20} color="#1B75BA" />
                <Text className="ml-2 text-blue-700 flex-1">
                  You have an auto-generated username. Customise it in your profile settings.
                </Text>
              </View>
              <TouchableOpacity onPress={dismissCustomizePrompt}>
                <Ionicons name="close" size={18} color="#1B75BA" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* Actions */}
        <View className="mt-8">
          <TouchableOpacity
            onPress={navigateToEdit}
            className="bg-white p-4 mb-4 rounded-xl border border-gray-200 flex-row items-center"
          >
            <Ionicons name="person-outline" size={24} color="#1B75BA" />
            <Text className="ml-3 font-medium text-gray-900 flex-1">Edit Profile</Text>
            <MaterialIcons name="chevron-right" size={24} color="#1B75BA" />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleLogout}
            disabled={isLoggingOut}
            className={`flex-row items-center bg-red-50 p-4 rounded-xl ${isLoggingOut ? 'opacity-50' : ''}`}
          >
            <MaterialIcons name="logout" size={24} color={isLoggingOut ? '#9CA3AF' : '#EF4444'} />
            <Text className={`ml-3 font-medium flex-1 ${isLoggingOut ? 'text-gray-400' : 'text-red-500'}`}>
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Text>
            {!isLoggingOut && <MaterialIcons name="chevron-right" size={24} color="#EF4444" />}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

