import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Animated } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Station } from '../../types/station';
import StationCard from '../../components/StationCard';
import { useColorScheme } from 'react-native';
import { AppTheme } from '../../constants/BrandAssets';

interface FavoriteStation extends Station {
  favorite_id: string;
  isDeleting?: boolean;
}

export default function FavoritesScreen() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();

  const fetchFavorites = async () => {
    if (!user) return;

    try {
      const { data: favoritesData, error } = await supabase
        .from('favorite_stations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedFavorites = favoritesData.map(fav => ({
        id: fav.station_id,
        name: fav.station_name,
        brand: fav.station_brand,
        address: fav.station_address,
        latitude: fav.station_latitude,
        longitude: fav.station_longitude,
        prices: {
          E10: fav.station_price ? Number(fav.station_price) : undefined,
          B7: fav.station_price_b7 ? Number(fav.station_price_b7) : undefined,
          E5: undefined,
          SDV: undefined
        },
        last_updated: fav.station_last_updated,
        favorite_id: fav.id,
        isDeleting: false
      }));

      setFavorites(formattedFavorites);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [user]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchFavorites();
  }, []);

  const handleRemoveFavorite = async (favoriteId: string) => {
    try {
      // First, mark the item as deleting
      setFavorites(prev => prev.map(fav => 
        fav.favorite_id === favoriteId ? { ...fav, isDeleting: true } : fav
      ));

      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Then remove from Supabase
      const { error } = await supabase
        .from('favorite_stations')
        .delete()
        .eq('id', favoriteId);

      if (error) throw error;

      // Finally, remove from state
      setFavorites(prev => prev.filter(fav => fav.favorite_id !== favoriteId));
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={AppTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.favorite_id}
        renderItem={({ item }) => (
          <StationCard
            station={item}
            onFavoritePress={() => handleRemoveFavorite(item.favorite_id)}
            isFavorite={true}
            isDeleting={item.isDeleting}
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-gray-500 dark:text-gray-400 text-center">
              No favorite stations yet. Add some stations to your favorites to see them here!
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AppTheme.colors.primary}
            colors={[AppTheme.colors.primary]}
          />
        }
      />
    </View>
  );
} 