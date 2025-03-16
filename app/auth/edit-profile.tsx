import { View, Text, TextInput, TouchableOpacity, Image, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function ProfileEditScreen() {
  const { profile, updateProfile, pickImage, uploadAvatar } = useAuth();
  const router = useRouter();
  const [handle, setHandle] = useState(profile?.handle || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUri(profile.avatar_url);
    }
  }, [profile]);

  const handleImagePick = async () => {
    const uri = await pickImage();
    if (uri) {
      setAvatarUri(uri);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      
      let avatarUrl = profile?.avatar_url || null;
      if (avatarUri && avatarUri !== profile?.avatar_url) {
        avatarUrl = await uploadAvatar(avatarUri);
      }

      await updateProfile({
        handle: handle.trim(),
        ...(avatarUrl ? { avatar_url: avatarUrl } : {})
      });

      router.back();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white p-4">
      <TouchableOpacity 
        onPress={handleImagePick}
        className="items-center mb-8"
      >
        {avatarUri ? (
          <Image
            source={{ uri: `${avatarUri}?ts=${Date.now()}` }}
            className="w-32 h-32 rounded-full border-4 border-blue-500"
          />
        ) : (
          <View className="w-32 h-32 rounded-full bg-gray-200 items-center justify-center border-4 border-blue-500">
            <MaterialIcons name="add-a-photo" size={40} color="#3B82F6" />
          </View>
        )}
      </TouchableOpacity>

      <Text className="text-lg font-semibold mb-2">Handle</Text>
      <TextInput
        value={handle}
        onChangeText={setHandle}
        placeholder="Enter your handle"
        className="border border-gray-300 rounded-lg p-4 mb-6"
        autoCapitalize="none"
      />

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isLoading}
        className={`bg-blue-500 p-4 rounded-lg ${isLoading ? 'opacity-50' : ''}`}
      >
        <Text className="text-white text-center font-semibold">
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}