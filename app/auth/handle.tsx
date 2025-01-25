import { View, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Button } from '../../components/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HandleSetup() {
  const [handle, setHandle] = useState('');
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

  const handleSubmit = async () => {
    if (!handle.trim()) {
      setError('Handle is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user?.id,
          handle: handle.trim(),
          updated_at: new Date().toISOString(),
        });

      if (updateError) throw updateError;

      await refreshUser();
      router.push('/auth/profile-picture');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white p-4">
      <View className="flex-1 justify-center">
        <Text className="text-2xl font-bold text-center mb-8">
          Choose Your Handle
        </Text>
        <Text className="text-gray-600 text-center mb-8">
          This is how other users will identify you. Choose something unique!
        </Text>
        
        <View className="space-y-4">
          <TextInput
            className="bg-gray-100 p-4 rounded-lg"
            placeholder="Enter your handle (e.g. john123)"
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />
          
          {error ? (
            <Text className="text-red-500 text-center">{error}</Text>
          ) : null}
          
          <Button
            onPress={handleSubmit}
            loading={loading}
          >
            Continue to Profile Picture
          </Button>
        </View>
      </View>
    </View>
  );
}
