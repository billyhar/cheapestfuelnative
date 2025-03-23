import React, { useEffect, useState, useRef } from 'react';
import { Link, Tabs, useNavigation, usePathname } from 'expo-router';
import { Pressable, Image, View, Text, Platform } from 'react-native';
import { useColorScheme } from 'react-native';
import { AppTheme } from '../../constants/BrandAssets';
import { Ionicons, AntDesign, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useClientOnlyValue } from '../../components/useClientOnlyValue';
import * as Notifications from 'expo-notifications';
import { useLocalSearchParams } from 'expo-router';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const [refreshCounter, setRefreshCounter] = useState(0);
  const lastRefreshTimeRef = useRef<number>(0);
  const minimumRefreshInterval = 3000; // 3 seconds between refreshes

  // Clear any redirects or setup mode flags when tabs are loaded
  useEffect(() => {
    const loadAccountData = async () => {
      try {
        await AsyncStorage.removeItem('setup_mode');
        await AsyncStorage.removeItem('redirect_after_auth');
      } catch (error) {
        console.error('Error clearing setup/redirect flags:', error);
      }
    };
    
    loadAccountData();
  }, [pathname]); // Re-run when pathname changes (tab changes)
  
  // Setup notification handler
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);
  
  console.log('Tab Layout:', { 
    pathname,
    hasUser: !!user, 
    userId: user?.id,
    email: user?.email
  });

  // Handle tab presses to trigger account refresh when selecting the account tab
  const handleTabPress = (tabName: string) => {
    if (tabName === 'Account') {
      console.log('Tab press: Account tab');
      
      // Skip refresh if authentication is still initializing
      if (isLoading) {
        console.log('Skipping refresh - auth is still initializing');
        return;
      }
      
      // Skip refresh if we're already on the account tab to prevent extra refreshes
      if (pathname === '/Account') {
        console.log('Already on account tab, skipping extra refresh');
        return;
      }
      
      // Add throttling to prevent refresh loops
      const now = Date.now();
      if (now - lastRefreshTimeRef.current < minimumRefreshInterval) {
        console.log(`Skipping refresh - too soon (${now - lastRefreshTimeRef.current}ms since last refresh)`);
        return;
      }
      
      // Update last refresh time
      lastRefreshTimeRef.current = now;
      
      // Use a single refresh key instead of timestamp to avoid multiple refreshes
      return { refresh: '1' };
    }
    return undefined;
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1B75BA',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
        },
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          headerTitle: () => (
            <View className="items-center justify-center">
              <Image
                source={require('../../assets/images/CheapestFuel.png')}
                className="h-[30px]"
                resizeMode="contain"
              />
            </View>
          ),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              size={24} 
              name={focused ? "location" : "location-outline"} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          headerTitle: 'Fuel Stats',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              size={24} 
              name={focused ? "bar-chart" : "bar-chart-outline"} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="Account"
        options={{
          title: 'Account',
          headerTitle: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              size={24} 
              name={focused ? "person-circle" : "person-circle-outline"} 
              color={color} 
            />
          ),
        }}
        listeners={{
          tabPress: () => handleTabPress('Account')
        }}
        initialParams={{ refresh: refreshCounter.toString() }}
      />
    </Tabs>
  );
}
