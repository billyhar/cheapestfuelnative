import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

interface UpvoteDetailsProps {
  stationId: string;
  fuelType: 'E10' | 'B7';
}

interface UpvoteUser {
  id: string;
  handle: string | null;
  first_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface UpvoteResponse {
  id: string;
  created_at: string;
  user: {
    id: string;
    username: string | null;
  };
}

const UpvoteDetails: React.FC<UpvoteDetailsProps> = ({ stationId, fuelType }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [upvoteUsers, setUpvoteUsers] = useState<UpvoteUser[]>([]);
  const [lastUpvoteTime, setLastUpvoteTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUpvoteDetails = async () => {
    setIsLoading(true);
    try {
      // First, get all upvotes for this station and fuel type
      const { data: upvotesData, error: upvotesError } = await supabase
        .from('fuel_price_upvotes')
        .select('id, created_at, user_id')
        .eq('station_id', stationId)
        .eq('fuel_type', fuelType)
        .order('created_at', { ascending: false });

      if (upvotesError) throw upvotesError;

      if (!upvotesData || upvotesData.length === 0) {
        setUpvoteUsers([]);
        setLastUpvoteTime(null);
        return;
      }

      // Then, get all the profiles for these users
      const userIds = upvotesData.map(upvote => upvote.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, handle, first_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user IDs to profiles for easy lookup
      const profilesMap = new Map(
        profilesData?.map(profile => [profile.id, profile]) || []
      );

      // Combine the data
      const formattedUsers = upvotesData.map(upvote => ({
        id: upvote.user_id,
        handle: profilesMap.get(upvote.user_id)?.handle || 'anonymous',
        first_name: profilesMap.get(upvote.user_id)?.first_name || null,
        avatar_url: profilesMap.get(upvote.user_id)?.avatar_url || null,
        created_at: upvote.created_at
      }));

      setUpvoteUsers(formattedUsers);
      if (formattedUsers.length > 0) {
        setLastUpvoteTime(formattedUsers[0].created_at);
      }
    } catch (error) {
      console.error('Error fetching upvote details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      fetchUpvoteDetails();
    }
  }, [isExpanded, stationId, fuelType]);

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
        className="flex-row items-center space-x-1"
      >
        <Text className="text-sm text-blue-500">
          {isExpanded ? 'Hide details' : 'Show upvote details'}
        </Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#1d9ecb"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View className="mt-2">
          <ScrollView className="max-h-32">
            {isLoading ? (
              <Text className="text-sm text-gray-500">Loading...</Text>
            ) : upvoteUsers.length > 0 ? (
              upvoteUsers.map((user) => (
                <View key={user.id} className="flex-row items-center space-x-2 py-1">
                  <Ionicons name="person-circle-outline" size={16} color="#6b7280" />
                  <View className="flex-1">
                    <Text className="text-sm text-gray-600">
                      @{user.handle}
                    </Text>
                    {user.first_name && (
                      <Text className="text-xs text-gray-400">{user.first_name}</Text>
                    )}
                  </View>
                  <Text className="text-xs text-gray-400">
                    {formatTimeAgo(user.created_at)}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="text-sm text-gray-500">No upvotes yet</Text>
            )}
          </ScrollView>
          <View className="bg-blue-50 p-3 mt-2 rounded-lg mb-3">
            <View className="flex-row items-start space-x-2">
              <Text className="text-sm text-blue-700 flex-1">
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