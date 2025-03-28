import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, ActivityIndicator, Alert, Dimensions, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, Animated, TouchableWithoutFeedback } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';

const { height } = Dimensions.get('window');

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { signIn } = useAuth();
  const videoRef = useRef(null);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setKeyboardVisible(true);
        Animated.spring(animatedHeight, {
          toValue: 1,
          useNativeDriver: false,
          tension: 65,
          friction: 10,
          delay: Platform.OS === 'ios' ? -50 : 0,
        }).start();
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        Animated.spring(animatedHeight, {
          toValue: 0,
          useNativeDriver: false,
          tension: 65,
          friction: 10,
        }).start();
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

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

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      // Handle error
      console.log('Video failed to load:', status.error);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const containerHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: ['45%', '75%']
  });

  return (
    <View className="flex-1">
      <Video
        ref={videoRef}
        source={require('../assets/authVid.mp4')}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
        }}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <Animated.View 
            style={{
              height: containerHeight,
            }}
            className="bg-white rounded-t-[40px] px-8 pt-12"
          >
            <View className="flex-1">
              <View className="mb-8">
                <Text className="text-3xl text-black text-left font-bold mb-2">
                  CheapestFuel
                </Text>
                <Text className="text-gray-600 text-left text-lg">
                  Find the best fuel prices near you
                </Text>
              </View>

              <TextInput
                className="bg-gray-100 text-black p-4 rounded-lg mb-8 text-lg"
                placeholder="Enter your email"
                placeholderTextColor="#6B6678"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
                autoFocus={false}
              />
              
              <TouchableOpacity
                className={`bg-[#FF3131] p-4 rounded-lg ${isLoading ? 'opacity-50' : ''}`}
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
          </Animated.View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
} 