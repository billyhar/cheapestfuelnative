import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { useDarkModeContext } from '../../contexts/DarkModeContext';

export default function AccountScreen() {
  const { user, profile, signOut } = useAuth();
  const { isDarkMode } = useDarkModeContext();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  const navigateToEdit = () => {
    router.push('/auth/edit-profile');
  };

  return (
    <SafeAreaView className={`flex-1 ${isDarkMode ? 'bg-background-dark' : 'bg-background'}`}>
      <View className="flex-1 px-4">
        {/* Profile Header */}
        <View className={`mt-4 p-4 rounded-xl ${isDarkMode ? 'bg-surface-dark' : 'bg-surface'}`}>
          <View className="flex-row items-center gap-4">
            <ProfileAvatar
              size={80}
              avatarPath={profile?.avatar_url}
              fallbackText={profile?.handle || 'U'}
            />
            <View className="flex-1">
              <Text className={`text-xl font-semibold ${isDarkMode ? 'text-text-dark' : 'text-text'}`}>
                {profile?.handle || 'User'}
              </Text>
              <Text className={`mt-1 ${isDarkMode ? 'text-textSecondary-dark' : 'text-textSecondary'}`}>
                {user?.email}
              </Text>
            </View>
            <TouchableOpacity
              onPress={navigateToEdit}
              className="bg-blue-500 px-4 py-2 rounded"
            >
              <Text className="text-white font-semibold">Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="mt-6 space-y-4">
          <TouchableOpacity
            onPress={handleLogout}
            disabled={isLoggingOut}
            className={`flex-row items-center justify-center p-4 rounded-xl ${
              isDarkMode ? 'bg-error-dark' : 'bg-error'
            }`}
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
        </View>
      </View>
    </SafeAreaView>
  );
}

