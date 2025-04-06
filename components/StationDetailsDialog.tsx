import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, Platform, Linking, Alert, ActionSheetIOS, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FuelStation } from '../services/FuelPriceService';
import { BrandLogos } from '../constants/BrandAssets';
import { PriceHistoryGraph } from '../app/components/PriceHistoryGraph';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import UpvoteButton from './UpvoteButton';
import UpvoteDetails from './UpvoteDetails';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop, BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';

const formatLastUpdated = (timestamp: string | null): string => {
  try {
    if (!timestamp) {
      return 'Unknown';
    }
    
    let date: Date;
    
    // Check if the timestamp is in DD/MM/YYYY HH:mm:ss format
    if (timestamp.includes('/')) {
      const [datePart, timePart] = timestamp.split(' ');
      const [day, month, year] = datePart.split('/');
      const [hours, minutes, seconds] = timePart.split(':');
      date = new Date(+year, +month - 1, +day, +hours, +minutes, +seconds);
    } else {
      // Handle ISO format as fallback
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) {
      return 'Unknown';
    }
    
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (e) {
    return 'Unknown';
  }
};

interface StationDetailsDialogProps {
  station: FuelStation;
}

const StationDetailsDialog: React.FC<StationDetailsDialogProps> = ({
  station,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [selectedFuelType, setSelectedFuelType] = useState<'E10' | 'B7'>(
    station.prices.E10 ? 'E10' : 'B7'
  );
  const [isUpvoted, setIsUpvoted] = useState(false);
  
  // ref
  const bottomSheetRef = useRef<BottomSheet>(null);

  // variables
  const snapPoints = ['100%'];

  // callbacks
  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      router.back();
    }
  }, [router]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      />
    ),
    []
  );

  useEffect(() => {
    if (user) {
      checkIfFavorite();
    }
  }, [user, station.site_id]);

  const checkIfFavorite = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('favorite_stations')
        .select('id')
        .eq('user_id', user.id)
        .eq('station_id', station.site_id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setIsFavorite(!!data);
      setFavoriteId(data?.id || null);
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  const toggleFavorite = async () => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to add stations to your favorites.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Optimistically update the UI state first
      const newFavoriteState = !isFavorite;
      setIsFavorite(newFavoriteState);

      if (!newFavoriteState && favoriteId) {
        const { error } = await supabase
          .from('favorite_stations')
          .delete()
          .eq('id', favoriteId);

        if (error) throw error;
        setFavoriteId(null);
      } else {
        // First check if the station is already favorited
        const { data: existingFavorite, error: checkError } = await supabase
          .from('favorite_stations')
          .select('id')
          .eq('user_id', user.id)
          .eq('station_id', station.site_id)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingFavorite) {
          setFavoriteId(existingFavorite.id);
          return;
        }

        // Convert the date to ISO format if it's in DD/MM/YYYY format
        let lastUpdated = station.last_updated;
        if (lastUpdated && lastUpdated.includes('/')) {
          const [datePart, timePart] = lastUpdated.split(' ');
          const [day, month, year] = datePart.split('/');
          const [hours, minutes, seconds] = timePart.split(':');
          lastUpdated = new Date(+year, +month - 1, +day, +hours, +minutes, +seconds).toISOString();
        }

        // Add new favorite
        const { data: newFavorite, error: insertError } = await supabase
          .from('favorite_stations')
          .insert([
            {
              user_id: user.id,
              station_id: station.site_id,
              station_name: station.brand,
              station_brand: station.brand,
              station_address: station.address,
              station_latitude: station.location.latitude,
              station_longitude: station.location.longitude,
              station_price: station.prices.E10 || 0,
              station_price_b7: station.prices.B7 || 0,
              station_last_updated: lastUpdated || new Date().toISOString(),
              notifications_enabled: false,
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;
        if (newFavorite) setFavoriteId(newFavorite.id);
      }
    } catch (error) {
      // Revert optimistic update on error
      setIsFavorite(!isFavorite);
      console.error('Error toggling favorite:', error);
      Alert.alert(
        'Error',
        'Failed to update favorite status. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Function to handle fuel type changes
  const handleFuelTypeChange = (fuelType: 'E10' | 'B7') => {
    setSelectedFuelType(fuelType);
  };

  const getBrandLogo = (brand: string) => {
    const normalizedBrand = brand.replace(/[^a-zA-Z]/g, '').toLowerCase();
    
    const brandMap: { [key: string]: string } = {
      'asda': 'ASDA',
      'bp': 'BP',
      'morrisons': 'Morrisons',
      'sainsburys': 'Sainsburys',
      'tesco': 'Tesco',
      'moto': 'Moto',
      'mfg': 'MFG',
      'rontec': 'Rontec',
      'shell': 'Shell',
      'esso': 'Esso',
      'texaco': 'Texaco',
      'jet': 'Jet'
    };

    const mappedBrand = brandMap[normalizedBrand] || brand;
    return BrandLogos[mappedBrand] || require('../assets/default-fuel-logo.png');
  };

  const openMapsApp = (app: 'apple' | 'google') => {
    const label = encodeURIComponent(station.brand);
    const latLng = `${station.location.latitude},${station.location.longitude}`;

    if (app === 'apple') {
      const url = `maps:0,0?q=${label}@${latLng}`;
      Linking.openURL(url);
    } else {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station.brand} ${station.address}`)}`;
      Linking.openURL(url);
    }
  };

  const handleGetDirections = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Apple Maps', 'Google Maps'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            openMapsApp('apple');
          } else if (buttonIndex === 2) {
            openMapsApp('google');
          }
        }
      );
    } else {
      // On Android, show an Alert dialog
      Alert.alert(
        'Choose Navigation App',
        'Select your preferred navigation app',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Google Maps',
            onPress: () => openMapsApp('google')
          }
        ]
      );
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-900 rounded-t-[20px]">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View className="px-4 pt-4 pb-8">
          <View className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
          
          <View className="flex-row items-start mb-4">
            <Image 
              source={typeof getBrandLogo(station.brand) === 'string' 
                ? { uri: getBrandLogo(station.brand) } 
                : getBrandLogo(station.brand)}
              className="w-12 h-12 mr-3"
              resizeMode="contain"
            />
            <View className="flex-1">
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">{station.brand}</Text>
              <Text className="text-base text-gray-600 dark:text-gray-400 mt-1">{station.address}</Text>
              <Text className="text-xs text-gray-600 dark:text-gray-400 mt-1">{station.postcode}</Text>
            </View>
            <View className="flex-row gap-2 items-center -mt-1">
              <TouchableOpacity 
                onPress={toggleFavorite}
                className="h-12 w-12 rounded-full bg-pink-100 dark:bg-pink-900 items-center justify-center mr-2"
              >
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isFavorite ? '#eb137e' : '#eb137e'}
                />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => router.back()}
                className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center pb-1"
              >
                <Text className="text-3xl text-gray-500 dark:text-gray-400">×</Text>
              </TouchableOpacity>
            </View>
          </View>

          {station.prices.E10 && station.prices.B7 && (
            <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-full p-1 mb-4">
              <TouchableOpacity
                className={`flex-1 py-2 px-4 rounded-full ${
                  selectedFuelType === 'E10' ? 'bg-white dark:bg-gray-700' : ''
                }`}
                onPress={() => handleFuelTypeChange('E10')}
                activeOpacity={0.7}
                style={{
                  shadowColor: selectedFuelType === 'E10' ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: selectedFuelType === 'E10' ? 0.2 : 0,
                  shadowRadius: selectedFuelType === 'E10' ? 2 : 0,
                  elevation: selectedFuelType === 'E10' ? 2 : 0
                }}
              >
                <Text
                  className={`text-center font-medium ${
                    selectedFuelType === 'E10' ? 'text-red-600 dark:text-red-200' : 'text-gray-600 dark:text-gray-100'
                  }`}
                >
                  Petrol (E10)
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className={`flex-1 py-2 px-4 rounded-full ${
                  selectedFuelType === 'B7' ? 'bg-white dark:bg-gray-700' : ''
                }`}
                onPress={() => handleFuelTypeChange('B7')}
                activeOpacity={0.7}
                style={{
                  shadowColor: selectedFuelType === 'B7' ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: selectedFuelType === 'B7' ? 0.2 : 0,
                  shadowRadius: selectedFuelType === 'B7' ? 2 : 0,
                  elevation: selectedFuelType === 'B7' ? 2 : 0
                }}
              >
                <Text
                  className={`text-center font-medium ${
                    selectedFuelType === 'B7' ? 'text-red-600 dark:text-red-200' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Diesel (B7)
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-4">
            <View className="flex-row justify-between items-start mb-4">
              <View className="flex-1 mr-4">
                <Text className="text-base text-gray-600 dark:text-gray-400 mb-1">
                  {selectedFuelType === 'E10' ? 'Petrol (E10)' : 'Diesel (B7)'}
                </Text>
                <Text className="text-3xl font-bold text-gray-900 dark:text-white">
                  £{((selectedFuelType === 'E10' ? station.prices.E10 || 0 : station.prices.B7 || 0) / 100).toFixed(2)}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {new Date().toLocaleDateString('en-GB', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </View>
              <UpvoteButton 
                stationId={station.site_id} 
                fuelType={selectedFuelType}
                onUpvoteChange={(upvoted) => setIsUpvoted(upvoted > 0)} 
                currentPrice={Math.round(selectedFuelType === 'E10' ? station.prices.E10 || 0 : station.prices.B7 || 0)}
              />
            </View>

            <View className="h-px bg-gray-200 dark:bg-gray-700 mb-3" />

            <UpvoteDetails 
              stationId={station.site_id} 
              fuelType={selectedFuelType}
              hasUserUpvoted={isUpvoted}
              currentPrice={Math.round(selectedFuelType === 'E10' ? station.prices.E10 || 0 : station.prices.B7 || 0)}
            />
          </View>

          <PriceHistoryGraph 
            siteId={station.site_id} 
            fuelType={selectedFuelType.toLowerCase() as 'e10' | 'b7' | 'e5' | 'sdv'} 
          />

          <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4 mt-2">
            Last updated: {formatLastUpdated(station.last_updated ?? null)}
          </Text>

          <TouchableOpacity
            className="bg-brand dark:bg-brand/80 rounded-2xl p-4 flex-row items-center justify-center"
            onPress={handleGetDirections}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-lg">Get Directions</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  scrollContent: {
    flexGrow: 1,
  },
};

export default StationDetailsDialog;