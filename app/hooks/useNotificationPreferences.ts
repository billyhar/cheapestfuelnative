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

      if (error) throw error;

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
    fetchPreferences();
  }, [user]);

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

    // Optimistically update the UI
    const newValue = !preferences[stationId];
    setPreferences(prev => ({
      ...prev,
      [stationId]: newValue
    }));

    try {
      // Only request permissions if enabling notifications and they haven't been granted
      if (newValue) {
        const hasPermission = await requestPermissions();
        if (!hasPermission) {
          // Revert optimistic update if permissions weren't granted
          setPreferences(prev => ({
            ...prev,
            [stationId]: !newValue
          }));
          console.log('No notification permission');
          return false;
        }

        // Get device push token
        const devicePushToken = await Notifications.getDevicePushTokenAsync();
        console.log('Got device push token:', devicePushToken);

        // First check if token already exists
        const { data: existingToken, error: checkError } = await supabase
          .from('push_tokens')
          .select('id')
          .eq('user_id', user.id)
          .eq('token', devicePushToken.data)
          .single();

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
            // Revert optimistic update if token storage failed
            setPreferences(prev => ({
              ...prev,
              [stationId]: !newValue
            }));
            console.error('Error storing push token:', tokenError);
            throw tokenError;
          }
        }
      }

      // Update the notifications_enabled flag in favorite_stations
      const { error } = await supabase
        .from('favorite_stations')
        .update({
          notifications_enabled: newValue
        })
        .eq('user_id', user.id)
        .eq('station_id', stationId);

      if (error) {
        // Revert optimistic update if the update failed
        setPreferences(prev => ({
          ...prev,
          [stationId]: !newValue
        }));
        console.error('Error updating notification preference:', error);
        throw error;
      }

      return true;
    } catch (error) {
      // Revert optimistic update on any other error
      setPreferences(prev => ({
        ...prev,
        [stationId]: !newValue
      }));
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
    toggleNotification
  };
}; 