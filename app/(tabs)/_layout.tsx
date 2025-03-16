import React from 'react';
import { Link, Tabs } from 'expo-router';
import { Pressable, Image, View } from 'react-native';
import { useColorScheme } from 'react-native';
import { AppTheme } from '../../constants/BrandAssets';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1B75BA',
        tabBarInactiveTintColor: '#818589',
        tabBarStyle: {
          backgroundColor: AppTheme.colors.card,
          borderTopColor: '#E5E7EB',
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: AppTheme.colors.card,
        },
        headerTintColor: AppTheme.colors.text,
        headerShadowVisible: false,
      }}>
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
      />
    </Tabs>
  );
}
