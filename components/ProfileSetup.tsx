import React, { useState } from 'react';
import { View, TextInput, Button, Image, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export const ProfileSetup = () => {
  const { updateProfile, pickImage, uploadAvatar } = useAuth();
  const [handle, setHandle] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!handle.trim()) {
      Alert.alert('Error', 'Please enter a handle');
      return;
    }

    let avatarUrl = null;
    if (avatarUri) {
      avatarUrl = await uploadAvatar(avatarUri);
    }

    await updateProfile({
      handle: handle.trim(),
      ...(avatarUrl ? { avatar_url: avatarUrl } : {})
    });
  };

  const handleImagePick = async () => {
    const uri = await pickImage();
    if (uri) {
      setAvatarUri(uri);
    }
  };

  return (
    <View>
      {avatarUri && (
        <Image 
          source={{ uri: avatarUri }} 
          style={{ width: 100, height: 100, borderRadius: 50 }} 
        />
      )}
      <Button title="Pick Avatar" onPress={handleImagePick} />
      <TextInput
        value={handle}
        onChangeText={setHandle}
        placeholder="Enter your handle"
      />
      <Button title="Save Profile" onPress={handleSubmit} />
    </View>
  );
}; 