import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Alert } from 'react-native';

interface UpvoteButtonProps {
  stationId: string;
  fuelType: 'E10' | 'B7';
  onUpvoteChange?: (count: number) => void;
}

const UpvoteButton: React.FC<UpvoteButtonProps> = ({
  stationId,
  fuelType,
  onUpvoteChange,
}) => {
  const { user } = useAuth();
  const [isUpvoted, setIsUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpvoteTime, setLastUpvoteTime] = useState<string | null>(null);

  const formatTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  useEffect(() => {
    if (user) {
      checkUpvoteStatus();
      fetchUpvoteCount();
    }
  }, [user, stationId, fuelType]);

  const checkUpvoteStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('fuel_price_upvotes')
        .select('id')
        .eq('user_id', user.id)
        .eq('station_id', stationId)
        .eq('fuel_type', fuelType)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setIsUpvoted(!!data);
    } catch (error) {
      console.error('Error checking upvote status:', error);
    }
  };

  const fetchUpvoteCount = async () => {
    try {
      const { count, error } = await supabase
        .from('fuel_price_upvotes')
        .select('created_at', { count: 'exact' })
        .eq('station_id', stationId)
        .eq('fuel_type', fuelType)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      // Get the latest upvote time
      const { data: latestUpvote } = await supabase
        .from('fuel_price_upvotes')
        .select('created_at')
        .eq('station_id', stationId)
        .eq('fuel_type', fuelType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setUpvoteCount(count || 0);
      setLastUpvoteTime(latestUpvote?.created_at || null);
    } catch (error) {
      console.error('Error fetching upvote count:', error);
    }
  };

  const handleUpvote = async () => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to upvote fuel prices.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    try {
      if (isUpvoted) {
        const { error } = await supabase
          .from('fuel_price_upvotes')
          .delete()
          .eq('user_id', user.id)
          .eq('station_id', stationId)
          .eq('fuel_type', fuelType);

        if (error) throw error;
        setIsUpvoted(false);
        setUpvoteCount(prev => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase
          .from('fuel_price_upvotes')
          .insert([
            {
              user_id: user.id,
              station_id: stationId,
              fuel_type: fuelType,
            },
          ]);

        if (error) throw error;
        setIsUpvoted(true);
        setUpvoteCount(prev => prev + 1);
      }
      
      if (onUpvoteChange) {
        onUpvoteChange(isUpvoted ? upvoteCount - 1 : upvoteCount + 1);
      }
    } catch (error) {
      console.error('Error toggling upvote:', error);
      Alert.alert(
        'Error',
        'Failed to update upvote status. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="items-end">
      <TouchableOpacity
        onPress={handleUpvote}
        disabled={isLoading}
        className={`flex-row items-center space-x-2 px-4 py-2 rounded-full ${
          isUpvoted ? 'bg-blue-100' : 'bg-gray-100'
        }`}
      >
        <Ionicons
          name={isUpvoted ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
          size={24}
          color={isUpvoted ? '#3b82f6' : '#6b7280'}
        />
        <Text
          className={`text-base font-medium ${
            isUpvoted ? 'text-blue-600' : 'text-gray-600'
          }`}
        >
          {upvoteCount}
        </Text>
      </TouchableOpacity>
      {upvoteCount > 0 && lastUpvoteTime && (
        <Text className="text-xs text-gray-500 mt-1">
          Last upvoted {formatTimeAgo(lastUpvoteTime)}
        </Text>
      )}
    </View>
  );
};

export default UpvoteButton; 