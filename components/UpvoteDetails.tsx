import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface UpvoteDetailsProps {
  stationId: string;
  fuelType: 'E10' | 'B7';
  onUpvoteChange?: (count: number) => void;
  hasUserUpvoted?: boolean;
  currentPrice: number;
}

interface UpvoteUser {
  id: string;
  handle: string;
  first_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface FuelPriceUpvoteWithProfile {
  id: string;
  created_at: string;
  user_id: string;
  profiles: {
    id: string;
    handle: string | null;
    first_name: string | null;
    avatar_url: string | null;
  } | null;
}

const UpvoteDetails: React.FC<UpvoteDetailsProps> = ({ 
  stationId, 
  fuelType,
  onUpvoteChange,
  hasUserUpvoted = false,
  currentPrice
}) => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [upvoteUsers, setUpvoteUsers] = useState<UpvoteUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousUpvoteState, setPreviousUpvoteState] = useState(hasUserUpvoted);

  // Function to optimistically add the current user's upvote
  const addOptimisticUpvote = useCallback(async () => {
    if (!user) return;

    try {
      // Get the user's profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('handle, first_name')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      const now = new Date().toISOString();
      const optimisticUser: UpvoteUser = {
        id: user.id,
        handle: profileData?.handle || 'anonymous',
        first_name: profileData?.first_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        created_at: now
      };

      setUpvoteUsers(prev => {
        if (prev.some(u => u.id === user.id)) return prev;
        return [optimisticUser, ...prev];
      });
    } catch (error) {
      console.error('Error getting user profile for optimistic update:', error);
      // Fallback to basic optimistic update
      const now = new Date().toISOString();
      const optimisticUser: UpvoteUser = {
        id: user.id,
        handle: 'anonymous',
        first_name: null,
        avatar_url: null,
        created_at: now
      };

      setUpvoteUsers(prev => {
        if (prev.some(u => u.id === user.id)) return prev;
        return [optimisticUser, ...prev];
      });
    }
  }, [user]);

  // Function to optimistically remove the current user's upvote
  const removeOptimisticUpvote = useCallback(() => {
    if (!user) return;
    setUpvoteUsers(prev => prev.filter(u => u.id !== user.id));
  }, [user]);

  // Function to handle upvote removal
  const handleUpvoteRemoval = useCallback(async (userId: string) => {
    if (!user || user.id !== userId) return;

    try {
      // Optimistically remove from UI
      removeOptimisticUpvote();

      // Remove from database
      const { error: deleteError } = await supabase
        .from('fuel_price_upvotes')
        .delete()
        .eq('user_id', userId)
        .eq('station_id', stationId)
        .eq('fuel_type', fuelType)
        .eq('price', currentPrice);

      if (deleteError) throw deleteError;

      // Update upvote count
      const { count } = await supabase
        .from('fuel_price_upvotes')
        .select('*', { count: 'exact' })
        .eq('station_id', stationId)
        .eq('fuel_type', fuelType)
        .eq('price', currentPrice);

      if (onUpvoteChange) {
        onUpvoteChange(count || 0);
      }

    } catch (error) {
      console.error('Error removing upvote:', error);
      // Revert optimistic update
      await fetchUpvoteDetails();
      Alert.alert('Error', 'Failed to remove upvote. Please try again.');
    }
  }, [user, stationId, fuelType, currentPrice, onUpvoteChange, removeOptimisticUpvote]);

  const fetchUpvoteDetails = useCallback(async () => {
    if (!isExpanded) return;
    
    try {
      const { data: upvotesData, error: upvotesError } = await supabase
        .from('fuel_price_upvotes')
        .select('id, created_at, user_id')
        .eq('station_id', stationId)
        .eq('fuel_type', fuelType)
        .eq('price', currentPrice)
        .order('created_at', { ascending: false });

      if (upvotesError) throw upvotesError;

      if (!upvotesData || upvotesData.length === 0) {
        setUpvoteUsers([]);
        return;
      }

      const userIds = upvotesData.map(upvote => upvote.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, handle, first_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(
        (profilesData || []).map(profile => [profile.id, profile])
      );

      const formattedUsers = upvotesData.map(upvote => {
        const profile = profileMap.get(upvote.user_id);
        return {
          id: upvote.user_id,
          handle: profile?.handle || 'anonymous',
          first_name: profile?.first_name || null,
          avatar_url: profile?.avatar_url || null,
          created_at: upvote.created_at
        };
      });

      setUpvoteUsers(formattedUsers);
    } catch (error) {
      console.error('Error in fetchUpvoteDetails:', error);
      setError('Failed to load upvote details');
    }
  }, [isExpanded, stationId, fuelType, currentPrice]);

  // Effect to handle optimistic updates when hasUserUpvoted changes
  useEffect(() => {
    if (hasUserUpvoted === previousUpvoteState) return;
    
    const updateUpvoteState = async () => {
      if (hasUserUpvoted) {
        await addOptimisticUpvote();
      } else {
        removeOptimisticUpvote();
      }
      setPreviousUpvoteState(hasUserUpvoted);
    };

    updateUpvoteState();
  }, [hasUserUpvoted, previousUpvoteState, addOptimisticUpvote, removeOptimisticUpvote]);

  // Effect to fetch details when expanded
  useEffect(() => {
    if (isExpanded) {
      fetchUpvoteDetails();
    }
  }, [isExpanded, fetchUpvoteDetails]);

  // Effect to handle real-time updates
  useEffect(() => {
    if (!isExpanded) return;

    const channel = supabase
      .channel('upvotes_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fuel_price_upvotes',
          filter: `station_id=eq.${stationId} AND fuel_type=eq.${fuelType} AND price=eq.${currentPrice}`
        },
        () => {
          fetchUpvoteDetails();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [isExpanded, stationId, fuelType, currentPrice, fetchUpvoteDetails]);

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <View className="mt-2">
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        className="flex-row items-center justify-between py-1"
      >
        <Text className="text-sm text-red-500">
          {isExpanded ? 'Hide' : 'Show'} upvote details
        </Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#ef4444"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View className="mt-2">
          {error ? (
            <Text className="text-red-500 text-sm">{error}</Text>
          ) : upvoteUsers.length === 0 ? (
            <Text className="text-gray-500 text-sm">No upvotes yet</Text>
          ) : (
            <View className="space-y-2">
              {upvoteUsers.map((user) => (
                <View key={`${user.id}-${user.created_at}`} className="flex-row items-center mb-4">
                  <View className="w-8 h-8 rounded-full bg-gray-200 mr-2">
                    {user.avatar_url ? (
                      <Image
                        source={{ uri: user.avatar_url }}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
                        <Text className="text-gray-500 text-sm">
                          {user.handle?.[0]?.toUpperCase() || 'A'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-900">
                      {user.handle}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          <View className="bg-red-50 p-3 mt-2 rounded-lg mb-3">
            <View className="flex-row items-start space-x-2">
              <Text className="text-sm text-red-700 flex-1">
                Upvotes are reset when fuel prices are updated to ensure accuracy. Please upvote again if the price is still correct.
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default UpvoteDetails; 