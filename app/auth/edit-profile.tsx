import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { nanoid } from 'nanoid/non-secure';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { useDarkModeContext } from '../../contexts/DarkModeContext';

export default function EditProfileScreen() {
  const { user, profile, updateProfile, refreshUser } = useAuth();
  const { isDarkMode } = useDarkModeContext();
  const [handle, setHandle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Set initial handle value only on mount
  useEffect(() => {
    if (profile?.handle) {
      setHandle(profile.handle);
    }
  }, []); // Empty dependency array means this only runs once on mount

  // Update hasChanges whenever handle changes
  useEffect(() => {
    setHasChanges(handle !== profile?.handle);
  }, [handle, profile?.handle]);

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      setIsUploadingImage(true);
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      // Read the file
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert to binary
      const arrayBuffer = Buffer.from(base64, 'base64');

      // Generate unique filename
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${nanoid()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      // Upload to Supabase
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true
        });

      if (error) throw error;

      // Return just the path, not the full URL
      return filePath;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setIsLoading(true);
        const uri = result.assets[0].uri;
        const avatarPath = await uploadImage(uri);
        
        if (avatarPath) {
          await updateProfile({ avatar_url: avatarPath });
          await refreshUser();
          Alert.alert('Success', 'Profile picture updated successfully!');
        } else {
          Alert.alert('Error', 'Failed to upload image. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to update profile picture. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!handle.trim()) {
      Alert.alert('Error', 'Handle cannot be empty');
      return;
    }

    try {
      setIsLoading(true);
      await updateProfile({ handle: handle.trim() });
      await refreshUser();
      Alert.alert('Success', 'Profile updated successfully!');
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className={`flex-1 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Stack.Screen 
        options={{
          title: 'Edit Profile',
          headerShown: true,
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: isDarkMode ? '#111827' : '#fff',
          },
          headerTintColor: isDarkMode ? '#fff' : '#000',
          headerRight: () => (
            <TouchableOpacity 
              onPress={handleSave} 
              disabled={isLoading || !hasChanges}
              className={`mr-4 ${(!hasChanges || isLoading) ? 'opacity-50' : ''}`}
            >
              <Text className={`text-blue-500 font-semibold text-lg ${isDarkMode ? 'text-blue-400' : ''}`}>
                {isLoading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          ),
        }} 
      />
      <View className="flex-1">
        {/* Content */}
        <View className="flex-1">
          {/* Profile Picture Section */}
          <View className={`
            items-center py-8 border-b 
            ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}
            ${isDarkMode ? 'bg-gray-800' : 'bg-white'}
          `}>
            <TouchableOpacity 
              onPress={pickImage}
              disabled={isLoading || isUploadingImage}
              className="relative"
            >
              <ProfileAvatar 
                avatarPath={profile?.avatar_url}
                size={128}
                fallbackText={profile?.handle || 'F'}
              />
              <View className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-2 border-2 border-white dark:border-gray-800">
                <MaterialIcons name="camera-alt" size={20} color="white" />
              </View>
              {(isLoading || isUploadingImage) && (
                <View className="absolute inset-0 bg-black bg-opacity-50 rounded-full items-center justify-center">
                  <ActivityIndicator color="white" />
                </View>
              )}
            </TouchableOpacity>
            <Text className={`text-blue-500 dark:text-blue-400 font-medium mt-4`}>
              {isUploadingImage ? 'Uploading...' : 'Change Profile Picture'}
            </Text>
          </View>

          {/* Handle Section */}
          <View className={`p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Handle
            </Text>
            <TextInput
              value={handle}
              onChangeText={setHandle}
              placeholder="Enter your handle"
              placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
              className={`
                text-lg border-b pb-2
                ${isDarkMode ? 'text-white border-gray-700' : 'text-gray-900 border-gray-200'}
              `}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
            />
            <Text className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {handle.length}/30 characters
            </Text>
          </View>

          {/* Email Section (Read-only) */}
          <View className={`
            p-6 border-t
            ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}
          `}>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Email
            </Text>
            <Text className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {user?.email}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}