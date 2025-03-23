import React from 'react';
import { Image, View, Text } from 'react-native';
import { getProfileAvatarUrl } from '../lib/utils';

interface ProfileAvatarProps {
  avatarPath?: string | null;
  size?: number;
  showFallback?: boolean;
  fallbackText?: string;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  avatarPath = null,
  size = 40,
  showFallback = true,
  fallbackText = 'U',
}) => {
  const avatarUrl = getProfileAvatarUrl(avatarPath);

  if (!avatarUrl && !showFallback) {
    return null;
  }

  return (
    <View 
      className="rounded-full overflow-hidden"
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          className="w-full h-full"
          onError={(e) => console.error('Avatar load error:', e.nativeEvent.error)}
        />
      ) : showFallback ? (
        <View className="w-full h-full bg-blue-100 items-center justify-center">
          <Text className="text-blue-500 font-bold">
            {fallbackText.charAt(0).toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}; 