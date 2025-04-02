import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { useDarkModeContext } from '../../contexts/DarkModeContext';
import { supabase } from '@/lib/supabase';

export default function AccountScreen() {
  const { user, profile, signOut } = useAuth();
  const { isDarkMode } = useDarkModeContext();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await AsyncStorage.setItem('just_signed_out', 'true');
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              
              // Call Edge Function to delete account with auth header
              const { data, error } = await supabase.functions.invoke('delete-account', {
                body: { userId: user?.id },
                headers: {
                  Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                }
              });

              if (error) throw error;

              await AsyncStorage.setItem('just_signed_out', 'true');
              await signOut();
              
              Alert.alert('Success', 'Your account has been deleted.');
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert(
                'Error', 
                'Failed to delete account. Please try again or contact support.'
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const navigateToEdit = () => {
    router.push('/auth/edit-profile');
  };

  return (
    <SafeAreaView className={`flex-1 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <View className="flex-1 p-4">
        {/* Profile Header */}
        <View className={`mt-4 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700`}>
          <View className="flex-row items-center gap-4">
            <ProfileAvatar
              size={80}
              avatarPath={profile?.avatar_url}
              fallbackText={profile?.handle || 'U'}
            />
            <View className="flex-1 min-w-0">
              <Text className="text-xl font-semibold text-gray-900 dark:text-white">
                {profile?.handle || 'User'}
              </Text>
              <Text className="mt-1 text-gray-500 dark:text-gray-400 truncate">
                {user?.email}
              </Text>
            </View>
            <TouchableOpacity
              onPress={navigateToEdit}
              className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-semibold">Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Additional Account Info */}
        <View className="mt-6">
          <View className={`
            rounded-xl bg-white dark:bg-gray-800 
            border border-gray-200 dark:border-gray-700
            divide-y divide-gray-200 dark:divide-gray-700
          `}>
            <View className="p-4">
              <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Account Type
              </Text>
              <Text className="mt-1 text-lg text-gray-900 dark:text-white">
                Standard
              </Text>
            </View>
            <View className="p-4">
              <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Member Since
              </Text>
              <Text className="mt-1 text-lg text-gray-900 dark:text-white">
                {new Date(user?.created_at || '').toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Action Buttons */}
        <View className="mt-auto space-y-6">
          {/* Sign Out Button */}
          <TouchableOpacity
            onPress={handleLogout}
            disabled={isLoggingOut}
            className={`
              flex-row items-center justify-center p-4 rounded-xl mb-4
              ${isLoggingOut ? 'opacity-70' : ''}
              bg-red-500 dark:bg-red-600 
              active:bg-red-600 dark:active:bg-red-700
            `}
          >
            {isLoggingOut ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="logout" size={24} color="#FFFFFF" />
                <Text className="text-white font-semibold ml-2">Sign Out</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Delete Account Button */}
          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={isDeleting}
            className={`
              flex-row items-center justify-center p-4 rounded-xl mb-2
              ${isDeleting ? 'opacity-70' : ''}
              bg-white dark:bg-gray-800 
              active:bg-red-50 dark:active:bg-red-900/10
            `}
          >
            {isDeleting ? (
              <ActivityIndicator color={isDarkMode ? '#EF4444' : '#DC2626'} />
            ) : (
              <>
                <MaterialIcons 
                  name="delete-forever" 
                  size={24} 
                  color={isDarkMode ? '#EF4444' : '#DC2626'} 
                />
                <Text className="text-red-500 dark:text-red-600 font-semibold ml-2">
                  Delete Account
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

