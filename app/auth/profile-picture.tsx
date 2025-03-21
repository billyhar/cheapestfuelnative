import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { PostgrestError } from '@supabase/supabase-js';
import { StorageError } from '@supabase/storage-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfilePictureScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();
  const { user, profile, isNewUser, isProfileSetupMode, updateProfile, setProfile } = useAuth();

  useEffect(() => {
    console.log('[ProfilePictureScreen] Mounted with state:', {
      hasImage: !!image,
      isLoading,
      hasProfile: !!profile,
      isNewUser,
      isProfileSetupMode,
      userId: user?.id
    });

    if (profile?.avatar_url) {
      setImage(profile.avatar_url);
    }

    return () => {
      console.log('[ProfilePictureScreen] Unmounting');
    };
  }, []);

  useEffect(() => {
    console.log('[ProfilePictureScreen] Profile or setup mode changed:', {
      hasProfile: !!profile,
      isProfileSetupMode,
      avatar_url: profile?.avatar_url
    });
  }, [profile, isProfileSetupMode]);

  useEffect(() => {
    console.log('[ProfilePictureScreen] Image changed:', !!image);
  }, [image]);

  useEffect(() => {
    console.log('[ProfilePictureScreen] Error changed:', error);
  }, [error]);

  useEffect(() => {
    console.log('[ProfilePictureScreen] Is loading changed:', isLoading);
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (!isProfileSetupMode) {
        setImage(null);
        setError('');
        setIsLoading(false);
      }
    };
  }, [isProfileSetupMode]);

  const pickImage = async (): Promise<void> => {
    try {
      console.log('[ProfilePictureScreen] Picking image');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      console.log('[ProfilePictureScreen] Image picker result:', {
        canceled: result.canceled,
        hasBase64: !!result.assets?.[0]?.base64
      });

      if (!result.canceled && result.assets[0].base64) {
        setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (err) {
      console.error('[ProfilePictureScreen] Error picking image:', err);
      setError('Error selecting image');
    }
  };

  const uploadImage = useCallback(async (): Promise<void> => {
    try {
      console.log('[ProfilePictureScreen] Starting image upload');
      
      if (!image) {
        console.log('[ProfilePictureScreen] No image selected');
        setError('Please select an image');
        return;
      }

      if (!user?.id) {
        console.log('[ProfilePictureScreen] No user ID found');
        setError('User not found');
        return;
      }

      setIsLoading(true);
      setError('');

      // Extract base64 data
      const base64Data = image.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid image data');
      }

      // Generate a unique filename
      const fileName = `${user.id}-${Date.now()}.jpg`;

      console.log('[ProfilePictureScreen] Uploading image to storage:', fileName);
      
      // Upload image
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(base64Data), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('[ProfilePictureScreen] Storage upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('[ProfilePictureScreen] Image uploaded, public URL:', publicUrl);

      // Use updateProfile from context instead of direct Supabase call
      try {
        await updateProfile({ avatar_url: publicUrl });
        console.log('[ProfilePictureScreen] Profile updated with avatar URL');
      } catch (updateError) {
        console.error('[ProfilePictureScreen] Profile update error:', updateError);
        throw updateError;
      }
      
      // Clear profile setup mode
      await Promise.all([
        AsyncStorage.removeItem('isProfileSetupMode'),
        AsyncStorage.removeItem('isNewUser')
      ]);
      console.log('[ProfilePictureScreen] Profile setup complete, redirecting to main app');
      
      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[ProfilePictureScreen] Error:', error);
      if (error instanceof StorageError) {
        setError(`Storage error: ${error.message}`);
      } else if (error instanceof PostgrestError) {
        setError(`Database error: ${error.message}`);
      } else {
        const err = error as Error;
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [image, user, router, updateProfile]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose your profile picture</Text>
      <Text style={styles.subtitle}>
        Add a profile picture so others can recognize you
      </Text>

      <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
        {image ? (
          <Image 
            source={{ uri: image }} 
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Tap to select image</Text>
          </View>
        )}
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={() => {
          console.log('[ProfilePictureScreen] Continue button pressed');
          uploadImage();
        }}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Saving...' : 'Continue'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  imageContainer: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    marginBottom: 30,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
  },
  placeholder: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: '#666',
    textAlign: 'center',
    padding: 10,
  },
  error: {
    color: 'red',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
