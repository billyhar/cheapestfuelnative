import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getAvatarPublicUrl } from '../../lib/utils';

export default function EditProfileScreen() {
  const { user, profile, updateProfile } = useAuth();
  const router = useRouter();
  const [handle, setHandle] = useState(profile?.handle || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const loadAvatarUrl = async () => {
      if (profile?.avatar_url) {
        const url = await getAvatarPublicUrl(profile.avatar_url);
        setAvatarUrl(url);
      }
    };
    loadAvatarUrl();
  }, [profile?.avatar_url]);

  useEffect(() => {
    setHasChanges(handle !== profile?.handle);
  }, [handle, profile?.handle]);

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
        await updateProfile({ avatar_url: result.assets[0].uri });
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to update profile picture');
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
      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Edit Profile',
          headerShown: true,
          headerBackTitle: 'Back',
          headerRight: () => (
            <TouchableOpacity 
              onPress={handleSave} 
              disabled={isLoading || !hasChanges}
              className={`mr-4 ${(!hasChanges || isLoading) ? 'opacity-50' : ''}`}
            >
              <Text className={`text-blue-500 font-semibold text-lg`}>
                {isLoading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          ),
        }} 
      />
      <View className="flex-1 bg-white">
        {/* Content */}
        <View className="flex-1">
          {/* Profile Picture Section */}
          <View className="items-center py-8 border-b border-gray-200">
            <TouchableOpacity 
              onPress={pickImage}
              disabled={isLoading}
              className="relative"
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  className="w-32 h-32 rounded-full border-4 border-blue-500"
                />
              ) : (
                <View className="w-32 h-32 rounded-full bg-blue-100 items-center justify-center border-4 border-blue-500">
                  <MaterialIcons name="person" size={50} color="#1B75BA" />
                </View>
              )}
              <View className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-2 border-2 border-white">
                <MaterialIcons name="camera-alt" size={20} color="white" />
              </View>
            </TouchableOpacity>
            <Text className="text-blue-500 font-medium mt-4">Change Profile Picture</Text>
          </View>

          {/* Handle Section */}
          <View className="p-6">
            <Text className="text-sm text-gray-500 mb-2">Handle</Text>
            <TextInput
              value={handle}
              onChangeText={setHandle}
              placeholder="Enter your handle"
              className="text-lg border-b border-gray-200 pb-2"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
            />
            <Text className="text-sm text-gray-400 mt-1">
              {handle.length}/30 characters
            </Text>
          </View>

          {/* Email Section (Read-only) */}
          <View className="p-6 border-t border-gray-200">
            <Text className="text-sm text-gray-500 mb-2">Email</Text>
            <Text className="text-lg text-gray-900">{user?.email}</Text>
          </View>
        </View>
      </View>
    </>
  );
}