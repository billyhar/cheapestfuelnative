import { View, ActivityIndicator } from 'react-native';

export function SplashScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator size="large" />
    </View>
  );
} 