import { View, Text, TouchableOpacity, Image, Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function AccountScreen() {
  const { signOut, user, profile, isProfileSetupMode } = useAuth();
  console.log("Account Screen Profile:", profile);
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getAvatarUrl = () => {
    if (!profile?.avatar_url) {
      console.log("Avatar URL is null or profile is undefined");
      return null;
    }
    const avatarUrlWithCacheBust = `${profile.avatar_url}?ts=${Date.now()}`;
    console.log("Generated Avatar URL:", avatarUrlWithCacheBust);
    return avatarUrlWithCacheBust;
  };

  const navigateToEdit = (section?: string) => {
    router.push('/auth/edit-profile');
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header Section */}
      <View className="bg-blue-500 pt-12 pb-8 px-5 rounded-b-3xl shadow-md">
        <View className="items-center">
        <TouchableOpacity
            onPress={() => navigateToEdit('profile-picture')}
            className="mb-4"
          >
            {getAvatarUrl() ? (
              <Image
                source={{ uri: getAvatarUrl() || undefined }}
                className="w-24 h-24 rounded-full border-4 border-white"
                onError={(error) => console.log("Image loading error:", error.nativeEvent)}
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-blue-400 items-center justify-center border-4 border-white">
                <MaterialIcons name="person" size={40} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold mb-1">
            {profile?.handle || 'Set handle'}
          </Text>
          <Text className="text-blue-100">{user?.email}</Text>
        </View>
      </View>

      {/* Settings Section */}
      <View className="p-5 space-y-4">
        <TouchableOpacity
          onPress={() => navigateToEdit()}
          className="flex-row items-center justify-between bg-white p-4 mb-4 rounded-xl border border-gray-200"
        >
          <View className="flex-row items-center">
            <Ionicons name="person-outline" size={24} color="#1B75BA" />
            <Text className="ml-3 font-medium text-gray-900">
              Edit Profile
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#1B75BA" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogout}
          disabled={isLoggingOut}
          className={`flex-row items-center justify-between ${isLoggingOut ? 'bg-gray-100' : 'bg-red-50'} p-4 rounded-xl`}
        >
          <View className="flex-row items-center">
            <MaterialIcons name="logout" size={24} color={isLoggingOut ? '#9CA3AF' : '#EF4444'} />
            <Text className={`ml-3 font-medium ${isLoggingOut ? 'text-gray-400' : 'text-red-500'}`}>
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Text>
          </View>
          {!isLoggingOut && <MaterialIcons name="chevron-right" size={24} color="#EF4444" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}
