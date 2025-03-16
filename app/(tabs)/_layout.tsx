import React from 'react';
import { Link, Tabs } from 'expo-router';
import { Pressable, Image, View, Text } from 'react-native';
import { useColorScheme } from 'react-native';
import { AppTheme } from '../../constants/BrandAssets';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1B75BA',
        tabBarInactiveTintColor: AppTheme.colors.text,
        tabBarStyle: {
          backgroundColor: AppTheme.colors.card,
          borderTopColor: AppTheme.colors.border,
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
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Image
                source={require('../../assets/images/CheapestFuel.png')}
                style={{ height: 30, resizeMode: 'contain' }}
              />
            </View>
          ),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons 
              size={28} 
              name={focused ? "map-marker-radius" : "map-marker-radius-outline"} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Statistics',
          headerTitle: 'Fuel Stats',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons 
              size={28} 
              name={focused ? "chart-bar" : "chart-bar"} 
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
            <MaterialCommunityIcons 
              size={28} 
              name={focused ? "account-circle" : "account-circle-outline"} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
