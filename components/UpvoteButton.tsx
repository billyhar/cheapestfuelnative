import React, { useState, useEffect, useCallback } from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface UpvoteButtonProps {
  stationId: string;
  fuelType: 'E10' | 'B7';
  onUpvoteChange?: (count: number) => void;
  currentPrice: number;
}

const UpvoteButton: React.FC<UpvoteButtonProps> = ({
  stationId,
  fuelType,
  onUpvoteChange,
  currentPrice,
}) => {
  const { user } = useAuth();
  const [isUpvoted, setIsUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const checkUpvoteStatus = useCallback(async () => {
    if (!user || typeof currentPrice !== 'number' || !Number.isInteger(currentPrice)) return;

    try {
      const { data, error } = await supabase
        .from('fuel_price_upvotes')
        .select('id')
        .eq('user_id', user.id)
        .eq('station_id', stationId)
        .eq('fuel_type', fuelType)
        .eq('price', currentPrice)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setIsUpvoted(!!data);
    } catch (error) {
      console.error('Error checking upvote status:', error);
    }
  }, [user, stationId, fuelType, currentPrice]);

  const fetchUpvoteCount = useCallback(async () => {
    if (typeof currentPrice !== 'number' || !Number.isInteger(currentPrice)) return;

    try {
      const { count, error } = await supabase
        .from('fuel_price_upvotes')
        .select('*', { count: 'exact' })
        .eq('station_id', stationId)
        .eq('fuel_type', fuelType)
        .eq('price', currentPrice);

      if (error) throw error;
      
      const newCount = count || 0;
      setUpvoteCount(newCount);
      if (onUpvoteChange) {
        onUpvoteChange(newCount);
      }
    } catch (error) {
      console.error('Error fetching upvote count:', error);
    }
  }, [stationId, fuelType, currentPrice, onUpvoteChange]);

  useEffect(() => {
    if (user) {
      checkUpvoteStatus();
      fetchUpvoteCount();
    }
  }, [user, checkUpvoteStatus, fetchUpvoteCount]);

  // Effect to handle real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('upvotes_button_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fuel_price_upvotes',
          filter: `station_id=eq.${stationId} AND fuel_type=eq.${fuelType} AND price=eq.${currentPrice}`
        },
        () => {
          fetchUpvoteCount();
          checkUpvoteStatus();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, stationId, fuelType, currentPrice, fetchUpvoteCount, checkUpvoteStatus]);

  const handleUpvote = async () => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to upvote fuel prices.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (isLoading || typeof currentPrice !== 'number' || !Number.isInteger(currentPrice)) return;

    setIsLoading(true);
    // Optimistically update the UI
    const newUpvoted = !isUpvoted;
    const newCount = upvoteCount + (newUpvoted ? 1 : -1);
    setIsUpvoted(newUpvoted);
    setUpvoteCount(newCount);
    if (onUpvoteChange) {
      onUpvoteChange(newCount);
    }

    try {
      if (newUpvoted) {
        const { error } = await supabase
          .from('fuel_price_upvotes')
          .insert([
            {
              user_id: user.id,
              station_id: stationId,
              fuel_type: fuelType,
              price: currentPrice,
            },
          ]);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('fuel_price_upvotes')
          .delete()
          .eq('user_id', user.id)
          .eq('station_id', stationId)
          .eq('fuel_type', fuelType)
          .eq('price', currentPrice);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling upvote:', error);
      // Revert optimistic update on error
      setIsUpvoted(!newUpvoted);
      setUpvoteCount(upvoteCount);
      if (onUpvoteChange) {
        onUpvoteChange(upvoteCount);
      }
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
    <TouchableOpacity
      onPress={handleUpvote}
      disabled={isLoading}
      className={`flex-row items-center space-x-2 px-4 py-2 rounded-full ${
        isUpvoted ? 'bg-red-100' : 'bg-gray-100'
      }`}
    >
      <Ionicons
        name={isUpvoted ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
        size={24}
        color={isUpvoted ? '#ef4444' : '#6b7280'}
      />
      <Text
        className={`text-base font-medium ${
          isUpvoted ? 'text-red-500' : 'text-gray-600'
        }`}
      >
        {upvoteCount}
      </Text>
    </TouchableOpacity>
  );
};

export default UpvoteButton; 