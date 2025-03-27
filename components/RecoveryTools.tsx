import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import { resetSupabaseInitialization, ensureSupabaseInitialized } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function RecoveryButton() {
  const [modalVisible, setModalVisible] = useState(false);

  const resetConnection = async () => {
    try {
      console.log('[Recovery] Resetting Supabase connection...');
      
      // Reset the initialization state
      resetSupabaseInitialization();
      
      // Then reinitialize
      await ensureSupabaseInitialized();
      
      console.log('[Recovery] Supabase reset complete');
      Alert.alert('Success', 'Connection reset successfully');
    } catch (error) {
      console.error('[Recovery] Reset error:', error);
      Alert.alert('Error', 'Failed to reset connection. Try again.');
    }
  };

  const clearCache = async () => {
    try {
      console.log('[Recovery] Clearing app cache...');
      
      // Get all keys (except session related keys that might break auth)
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(key => 
        !key.includes('supabase.auth') && 
        !key.includes('token')
      );
      
      // Remove cached data
      await AsyncStorage.multiRemove(keysToRemove);
      
      console.log(`[Recovery] Cleared ${keysToRemove.length} items from cache`);
      Alert.alert('Success', 'App cache cleared successfully');
    } catch (error) {
      console.error('[Recovery] Cache clear error:', error);
      Alert.alert('Error', 'Failed to clear cache. Try again.');
    }
  };

  // This button will only show after 3 taps (to prevent accidental triggering)
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);

  const handleTap = () => {
    const now = Date.now();
    const timeDiff = now - lastTapTime;
    
    // Reset tap count if more than 500ms between taps
    if (timeDiff > 500) {
      setTapCount(1);
    } else {
      setTapCount(prev => prev + 1);
    }
    
    setLastTapTime(now);
    
    // Show recovery tools after triple tap
    if (tapCount + 1 >= 3) {
      setModalVisible(true);
      setTapCount(0);
    }
  };

  return (
    <>
      <TouchableOpacity 
        onPress={handleTap}
        style={{ position: 'absolute', bottom: 10, right: 10, padding: 10, zIndex: 1000 }}
      >
        <Ionicons name="help-circle-outline" size={24} color="rgba(0,0,0,0.3)" />
      </TouchableOpacity>
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)'
        }}>
          <View style={{ 
            backgroundColor: 'white', 
            borderRadius: 10, 
            padding: 20,
            width: '80%',
            maxWidth: 400,
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 20 }}>
              Recovery Tools
            </Text>
            
            <Text style={{ textAlign: 'center', marginBottom: 20, color: '#666' }}>
              Use these tools if you're experiencing data loading issues
            </Text>
            
            <TouchableOpacity 
              onPress={resetConnection}
              style={{ 
                backgroundColor: '#0077FF', 
                padding: 15, 
                borderRadius: 8,
                width: '100%',
                alignItems: 'center',
                marginBottom: 10
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Reset Connection</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={clearCache}
              style={{ 
                backgroundColor: '#FF3B30', 
                padding: 15, 
                borderRadius: 8,
                width: '100%',
                alignItems: 'center',
                marginBottom: 20
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Clear App Cache</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setModalVisible(false)}
              style={{ 
                backgroundColor: '#E5E5EA', 
                padding: 10, 
                borderRadius: 8
              }}
            >
              <Text style={{ color: '#000' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
} 