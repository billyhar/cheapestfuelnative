import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSignIn = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    
    setIsLoading(true);
    try {
      await signIn(email);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center p-4 bg-white">
      <View className="items-left mb-12">
        <Text className="text-3xl text-black text-left font-bold mb-2">
          CheapestFuel
        </Text>
        <Text className="text-gray-600 text-left text-lg">
          Find the best fuel prices near you
        </Text>
      </View>

      <TextInput
        className="bg-gray-100 text-black p-4 rounded-lg mb-4 text-lg"
        placeholder="Enter your email"
        placeholderTextColor="#6B6678"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isLoading}
      />
      
      <TouchableOpacity
        className={`bg-blue-500 p-4 rounded-lg ${isLoading ? 'opacity-50' : ''}`}
        onPress={handleSignIn}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text className="text-white text-center font-bold text-lg">
            Continue with Email
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
} 