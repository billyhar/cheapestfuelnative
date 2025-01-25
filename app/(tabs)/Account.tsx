import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function AccountScreen() {
  const { signOut, user, profile } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getAvatarUrl = () => {
    if (!profile?.avatar_url) return null;
    return supabase.storage
      .from('avatars')
      .getPublicUrl(profile.avatar_url)
      .data.publicUrl;
  };

  const navigateToEdit = (screen: string) => {
    router.push(`/auth/${screen}`);
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
                source={{ uri: getAvatarUrl() }}
                className="w-24 h-24 rounded-full border-4 border-white"
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
          onPress={() => navigateToEdit('handle')}
          className="flex-row items-center justify-between bg-gray-50 p-4 rounded-xl"
        >
          <View className="flex-row items-center">
            <MaterialIcons name="edit" size={24} color="#4B5563" />
            <Text className="ml-3 text-gray-700 font-medium">Edit Handle</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#4B5563" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogout}
          className="flex-row items-center justify-between bg-red-50 p-4 rounded-xl"
        >
          <View className="flex-row items-center">
            <MaterialIcons name="logout" size={24} color="#EF4444" />
            <Text className="ml-3 text-red-500 font-medium">Logout</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
