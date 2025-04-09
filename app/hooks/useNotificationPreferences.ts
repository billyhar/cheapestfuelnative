import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export const useNotificationPreferences = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);

  // Fetch existing preferences
  const fetchPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('favorite_stations')
        .select('station_id, notifications_enabled')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching notification preferences:', error);
        return;
      }

      const prefs: { [key: string]: boolean } = {};
      data?.forEach(item => {
        prefs[item.station_id] = item.notifications_enabled || false;
      });
      setPreferences(prefs);
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchPreferences();
  }, [user]);

  // Add a refresh function that can be called from outside
  const refreshPreferences = async () => {
    setLoading(true);
    await fetchPreferences();
  };

  // Request permissions and register for notifications
  const requestPermissions = async () => {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return false;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  // Toggle notification for a specific station
  const toggleNotification = async (stationId: string) => {
    if (!user) return false;

    console.log('Toggling notification for station:', stationId);
    console.log('Current preferences:', preferences);

    try {
      // Get current state from database first
      const { data: currentState, error: fetchError } = await supabase
        .from('favorite_stations')
        .select('notifications_enabled')
        .eq('user_id', user.id)
        .eq('station_id', stationId)
        .single();

      if (fetchError) {
        console.error('Error fetching current state:', fetchError);
        return false;
      }

      if (!currentState) {
        console.error('Station not found in favorites');
        return false;
      }

      const newValue = !currentState.notifications_enabled;
      console.log('New value to set:', newValue);

      // Only request permissions if enabling notifications and they haven't been granted
      if (newValue) {
        const hasPermission = await requestPermissions();
        if (!hasPermission) {
          console.log('No notification permission');
          return false;
        }

        // Get device push token
        const devicePushToken = await Notifications.getExpoPushTokenAsync({
          projectId: "5654dcdd-46a4-4528-935f-75be868a01e8"
        });
        console.log('Got device push token:', devicePushToken);

        // First check if token already exists
        const { data: existingToken, error: checkError } = await supabase
          .from('push_tokens')
          .select('id')
          .eq('user_id', user.id)
          .eq('token', devicePushToken.data)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking existing token:', checkError);
          return false;
        }

        if (!existingToken) {
          // Only insert if token doesn't exist
          const { error: tokenError } = await supabase
            .from('push_tokens')
            .insert({
              user_id: user.id,
              token: devicePushToken.data,
              platform: Platform.OS,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (tokenError) {
            console.error('Error storing push token:', tokenError);
            return false;
          }
        }
      }

      // Update the notifications_enabled flag in favorite_stations
      const { error: updateError } = await supabase
        .from('favorite_stations')
        .update({
          notifications_enabled: newValue
        })
        .eq('user_id', user.id)
        .eq('station_id', stationId);

      if (updateError) {
        console.error('Error updating notification preference:', updateError);
        return false;
      }

      // Update local state after successful database update
      console.log('Updating local state with new value:', newValue);
      setPreferences(prev => {
        const newState = {
          ...prev,
          [stationId]: newValue
        };
        console.log('New preferences state:', newState);
        return newState;
      });

      return true;
    } catch (error) {
      console.error('Error toggling notification:', error);
      return false;
    }
  };

  // Check if notifications are enabled for a station
  const isNotificationEnabled = (stationId: string) => {
    return preferences[stationId] || false;
  };

  return {
    loading,
    isNotificationEnabled,
    toggleNotification,
    refreshPreferences
  };
}; 