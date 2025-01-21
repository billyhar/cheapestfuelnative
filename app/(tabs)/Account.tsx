import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function AccountScreen() {
  const { signOut } = useAuth();

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
      <TouchableOpacity 
        className="bg-red-500 px-6 py-3 rounded-lg active:bg-red-600"
        onPress={handleLogout}
      >
        <Text className="text-white font-semibold text-base">Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
