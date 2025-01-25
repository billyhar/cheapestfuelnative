import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../components/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfilePictureSetup() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    const checkNewUser = async () => {
      const isNewUser = await AsyncStorage.getItem('isNewUser');
      if (!isNewUser) {
        // If not a new user, redirect to tabs
        router.replace('/(tabs)');
      }
    };
    
    checkNewUser();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadImage = async () => {
    if (!image) return null;

    const response = await fetch(image);
    const blob = await response.blob();
    const fileExt = image.split('.').pop();
    const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('avatars')
      .upload(filePath, blob);

    if (uploadError) throw uploadError;

    return filePath;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      let avatarUrl = null;
      if (image) {
        avatarUrl = await uploadImage();
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user?.id,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        });

      if (updateError) throw updateError;

      await refreshUser();
      // Remove new user flag after completing the setup
      await AsyncStorage.removeItem('isNewUser');
      router.push('/(tabs)');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white p-4">
      <View className="flex-1 justify-center items-center">
        <Text className="text-2xl font-bold text-center mb-8">
          Add a Profile Picture
        </Text>
        <Text className="text-gray-600 text-center mb-8">
          This step is optional. You can always add or change your picture later.
        </Text>

        <TouchableOpacity
          onPress={pickImage}
          className="mb-8"
        >
          {image ? (
            <Image
              source={{ uri: image }}
              className="w-32 h-32 rounded-full"
            />
          ) : (
            <View className="w-32 h-32 rounded-full bg-gray-200 items-center justify-center">
              <MaterialIcons name="add-a-photo" size={40} color="#666" />
            </View>
          )}
        </TouchableOpacity>

        <View className="w-full space-y-4">
          {error ? (
            <Text className="text-red-500 text-center">{error}</Text>
          ) : null}

          <Button
            onPress={handleSubmit}
            loading={loading}
          >
            {image ? 'Save Profile Picture' : 'Skip for Now'}
          </Button>
        </View>
      </View>
    </View>
  );
}
