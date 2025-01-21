import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import { Pressable, Image, View } from 'react-native';
import { useColorScheme } from 'react-native';
import { AppTheme } from '../../constants/BrandAssets';
import Ionicons from '@expo/vector-icons/Ionicons';
import Logo from '../../assets/images/CheapestFuel.png';
// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: 3 }} {...props} />;
}

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
          tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "map" : "map-outline"} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Statistics',
          headerTitle: 'Fuel Stats',
          tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "bar-chart" : "bar-chart-outline"} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Account"
        options={{
          title: 'Account',
          headerTitle: 'Account',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="person-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
