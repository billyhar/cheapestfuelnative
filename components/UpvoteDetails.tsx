import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
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
  handle: string | null;
  first_name: string | null;
  avatar_url: string | null;
  created_at: string;
  isLoading?: boolean;
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
  
  // Use refs to track mounted state and prevent memory leaks
  const isMountedRef = useRef(true);
  const subscriptionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousUpvoteStateRef = useRef(hasUserUpvoted);
  const optimisticUpdateRef = useRef<UpvoteUser | null>(null);
  const skipNextUpdateRef = useRef(false);

  // Cleanup function to run on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Function to fetch upvote details
  const fetchUpvoteDetails = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // First get the upvotes
      const { data: upvotes, error: upvotesError } = await supabase
        .from('fuel_price_upvotes')
        .select('id, created_at, user_id')
        .eq('station_id', stationId)
        .eq('fuel_type', fuelType)
        .eq('price', currentPrice)
        .order('created_at', { ascending: false });

      if (upvotesError) throw upvotesError;

      // Then get the profiles for those users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, handle, first_name, avatar_url')
        .in('id', (upvotes || []).map(u => u.user_id));

      if (profilesError) throw profilesError;

      if (!isMountedRef.current) return;

      const profileMap = new Map(profiles?.map(p => [p.id, p]));
      
      let formattedUsers: UpvoteUser[] = (upvotes || [])
        .filter(upvote => profileMap.has(upvote.user_id))
        .map(upvote => {
          const profile = profileMap.get(upvote.user_id)!;
          return {
            id: upvote.user_id,
            handle: profile.handle,
            first_name: profile.first_name,
            avatar_url: profile.avatar_url,
            created_at: upvote.created_at
          };
        });

      // If we have an optimistic update and it's not in the list, add it
      if (optimisticUpdateRef.current && !formattedUsers.some(u => u.id === optimisticUpdateRef.current!.id)) {
        formattedUsers = [optimisticUpdateRef.current, ...formattedUsers];
      }

      setUpvoteUsers(formattedUsers);
    } catch (error) {
      if (!isMountedRef.current) return;
      setError('Failed to load upvote details');
      console.error('Error fetching upvote details:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [stationId, fuelType, currentPrice]);

  // Effect to handle optimistic updates when hasUserUpvoted changes
  useEffect(() => {
    // Skip if the state hasn't changed
    if (hasUserUpvoted === previousUpvoteStateRef.current) return;
    
    // Update the ref
    previousUpvoteStateRef.current = hasUserUpvoted;
    
    // If user is not logged in, don't do anything
    if (!user) return;
    
    // Handle optimistic update
    if (hasUserUpvoted) {
      // Add optimistic upvote
      const now = new Date().toISOString();
      const optimisticUser: UpvoteUser = {
        id: user.id,
        handle: user.user_metadata?.handle || null,
        first_name: user.user_metadata?.first_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        created_at: now,
        isLoading: true
      };
      
      // Store the optimistic update in the ref
      optimisticUpdateRef.current = optimisticUser;
      
      // Set the flag to skip the next real-time update
      skipNextUpdateRef.current = true;
      
      setUpvoteUsers(prev => {
        if (prev.some(u => u.id === user.id)) return prev;
        return [optimisticUser, ...prev];
      });
      
      // Try to fetch the user's profile data
      const fetchUserProfile = async () => {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('handle, first_name, avatar_url')
            .eq('id', user.id)
            .single();
            
          if (profileError) throw profileError;
          
          if (!isMountedRef.current) return;
          
          // Update the optimistic user with the fetched profile data
          optimisticUser.handle = profileData?.handle || null;
          optimisticUser.first_name = profileData?.first_name || null;
          optimisticUser.avatar_url = profileData?.avatar_url || null;
          optimisticUser.isLoading = false;
          
          // Update the optimistic update ref
          optimisticUpdateRef.current = optimisticUser;
          
          // Update the UI
          setUpvoteUsers(prev => {
            const updated = [...prev];
            const index = updated.findIndex(u => u.id === user.id);
            if (index !== -1) {
              updated[index] = optimisticUser;
            }
            return updated;
          });
        } catch (error) {
          console.error('Error fetching user profile:', error);
          if (!isMountedRef.current) return;
          
          // Mark as not loading even if there was an error
          optimisticUser.isLoading = false;
          
          // Update the UI
          setUpvoteUsers(prev => {
            const updated = [...prev];
            const index = updated.findIndex(u => u.id === user.id);
            if (index !== -1) {
              updated[index] = optimisticUser;
            }
            return updated;
          });
        }
      };
      
      fetchUserProfile();
    } else {
      // Remove optimistic upvote
      optimisticUpdateRef.current = null;
      setUpvoteUsers(prev => prev.filter(u => u.id !== user.id));
    }
  }, [hasUserUpvoted, user]);

  // Effect to load upvote details when expanded
  useEffect(() => {
    if (isExpanded) {
      fetchUpvoteDetails();
    }
  }, [isExpanded, fetchUpvoteDetails]);

  // Effect to handle real-time updates with debounce
  useEffect(() => {
    if (!isExpanded) return;
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Clear any existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }
    
    const debouncedFetch = () => {
      // If we're skipping the next update, reset the flag and return
      if (skipNextUpdateRef.current) {
        skipNextUpdateRef.current = false;
        return;
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && isExpanded) {
          fetchUpvoteDetails();
        }
      }, 1000); // 1 second debounce
    };

    // Set up the subscription
    subscriptionRef.current = supabase
      .channel('upvotes_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fuel_price_upvotes',
          filter: `station_id=eq.${stationId} AND fuel_type=eq.${fuelType} AND price=eq.${currentPrice}`
        },
        debouncedFetch
      )
      .subscribe();

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
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
                    {user.isLoading ? (
                      <View className="flex-row items-center">
                        <ActivityIndicator size="small" color="#ef4444" />
                        <Text className="text-sm text-gray-500 ml-2">Loading...</Text>
                      </View>
                    ) : (
                      <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.handle || 'Anonymous'}
                      </Text>
                    )}
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimeAgo(user.created_at)}
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