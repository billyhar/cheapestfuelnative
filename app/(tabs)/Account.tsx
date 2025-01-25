import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function AccountScreen() {
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <View className="flex-1 items-center justify-center p-5">
      <Text className="text-2xl font-bold mb-8">Account</Text>
      {user && (
        <View className="mb-4">
          <Text className="text-lg text-gray-700">Logged in as:</Text>
          <Text className="text-lg font-semibold text-black">{user.email}</Text>
          <Text className="text-sm text-gray-500">User ID: {user.id}</Text>
        </View>
      )}
      <TouchableOpacity 
        className="bg-red-500 px-6 py-3 rounded-lg active:bg-red-600"
        onPress={handleLogout}
      >
        <Text className="text-white font-semibold text-base">Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
