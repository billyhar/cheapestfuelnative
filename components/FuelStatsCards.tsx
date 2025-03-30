import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Pressable, StyleSheet, RefreshControl, Linking, ColorSchemeName } from 'react-native';
import { FuelStation } from '../services/FuelPriceService';
import { BrandLogos, AppTheme } from '../constants/BrandAssets';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

interface FuelStats {
  fuelStations: FuelStation[];
  cheapestUK: {
    price: number;
    station: string;
    location: string;
    fuelType: 'E10' | 'B7';
    stationData: FuelStation | null;
    lastUpdated: Date;
  };
  averagePrice: {
    E10: number;
    B7: number;
  };
  cityPrices: {
    city: string;
    cheapestE10: number;
    cheapestB7: number;
    lastUpdated: Date;
  }[];
}

interface FuelStatsCardsProps {
  stats: FuelStats;
  onStationSelect: (station: FuelStation) => void;
  refreshControl?: React.ReactElement;
  colorScheme?: ColorSchemeName;
}

type CheapestStation = {
  price: number;
  station: string;
  location: string;
  fuelType: 'E10' | 'B7';
  stationData: FuelStation;
  lastUpdated: Date;
};

const formatPrice = (price: number): string => {
  return `£${(price / 100).toFixed(2)}`;
};

const FuelStatsCards: React.FC<FuelStatsCardsProps> = ({ stats, onStationSelect, refreshControl, colorScheme }) => {
  const [selectedFuelType, setSelectedFuelType] = useState<'E10' | 'B7'>('E10');
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<{
    city: string;
    cheapestE10: number;
    cheapestB7: number;
    lastUpdated: Date;
  } | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedRadius, setSelectedRadius] = useState(2); // Default 2km
  const [showAllTop50, setShowAllTop50] = useState(false);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isPulling, setIsPulling] = useState(false);

  // Request location permission and get user's location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    })();
  }, []);

  // Set default region to London
  useEffect(() => {
    const londonRegions = ['N', 'NW', 'W', 'WC', 'E', 'EC', 'SE', 'SW'];
    const londonPrice = stats.cityPrices.find(price => 
      londonRegions.some(prefix => price.city.startsWith(prefix))
    );
    if (londonPrice) {
      setSelectedRegion(londonPrice);
    }
  }, [stats.cityPrices]);

  // Update lastUpdated when refreshControl is triggered
  useEffect(() => {
    if (refreshControl?.props.refreshing) {
      setLastUpdated(new Date());
    }
  }, [refreshControl?.props.refreshing]);

  const getCheapestForFuelType = () => {
    return stats.fuelStations?.reduce<CheapestStation | null>((cheapest, station) => {
      const price = selectedFuelType === 'E10' ? station.prices.E10 : station.prices.B7;
      if (price && (!cheapest?.price || price < cheapest.price)) {
        return {
          price,
          station: station.brand,
          location: station.address,
          fuelType: selectedFuelType,
          stationData: station,
          lastUpdated: station.last_updated ? new Date(station.last_updated) : new Date()
        };
      }
      return cheapest;
    }, null) || {
      ...stats.cheapestUK,
      lastUpdated: stats.cheapestUK.lastUpdated || new Date()
    };
  };

  const cheapestStation = getCheapestForFuelType();
  
  const calculateSavings = () => {
    if (!cheapestStation) return 0;
    const avgPrice = selectedFuelType === 'E10' ? stats.averagePrice.E10 : stats.averagePrice.B7;
    return avgPrice - cheapestStation.price;
  };
  
  const savings = calculateSavings();

  const getNearbyStations = () => {
    if (!userLocation || !cheapestStation?.stationData) return [];
    
    const stations = stats.fuelStations
      .filter(station => {
        const price = selectedFuelType === 'E10' ? station.prices.E10 : station.prices.B7;
        return price !== null;
      })
      .map(station => ({
        ...station,
        distance: calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          station.location.latitude,
          station.location.longitude
        )
      }))
      .filter(station => station.distance <= selectedRadius)
      .sort((a, b) => {
        const priceA = selectedFuelType === 'E10' ? a.prices.E10! : a.prices.B7!;
        const priceB = selectedFuelType === 'E10' ? b.prices.E10! : b.prices.B7!;
        return priceA - priceB;
      })
      .slice(0, 3);

    return stations;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const toRad = (value: number): number => {
    return value * Math.PI / 180;
  };

  const openDirections = (station: FuelStation) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(station.address)}`;
    Linking.openURL(url);
  };

  const getTop50Stations = () => {
    return stats.fuelStations
      .filter(station => {
        const price = selectedFuelType === 'E10' ? station.prices.E10 : station.prices.B7;
        return price !== null;
      })
      .map(station => ({
        ...station,
        price: selectedFuelType === 'E10' ? station.prices.E10! : station.prices.B7!
      }))
      .sort((a, b) => a.price - b.price)
      .slice(0, 50);
  };

  const formatTimeAgo = (date: Date | undefined | null): string => {
    if (!date) return 'Unknown time';
    
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days}d ago`;
    }
  };

  return (
    <ScrollView 
      className={`flex-1 ${colorScheme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}
      contentContainerClassName="p-4 pb-8"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      onScrollBeginDrag={() => setIsPulling(true)}
      onScrollEndDrag={() => setIsPulling(false)}
    >
      {isPulling && (
        <Text className="text-xs text-center mb-2 text-gray-500 dark:text-gray-400">
          Last updated {formatTimeAgo(lastUpdated)}
        </Text>
      )}

      {/* Fuel Type Selector */}
      <View className="flex-row bg-white dark:bg-gray-800 rounded-xl p-1 mb-4 border border-gray-200 dark:border-gray-700">
        {['E10', 'B7'].map(fuelType => (
          <TouchableOpacity 
            key={fuelType}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-lg ${
              selectedFuelType === fuelType ? 'bg-red-50 dark:bg-red-900/60' : ''
            }`}
            onPress={() => setSelectedFuelType(fuelType as 'E10' | 'B7')}
          >
            <Ionicons 
              name={fuelType === 'E10' ? "water-outline" : "water"} 
              size={18} 
              color={selectedFuelType === fuelType ? AppTheme.colors.primary : '#6B7280'} 
            />
            <Text className={`ml-2 font-semibold ${
              selectedFuelType === fuelType 
                ? 'text-red-600 dark:text-white' 
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {fuelType === 'E10' ? 'Petrol (E10)' : 'Diesel (B7)'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Nearby Stations Card */}
      {userLocation && (
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 border border-gray-200 dark:border-gray-700">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              Nearby Stations
            </Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1">
                {[2, 5, 10].map(radius => (
                  <TouchableOpacity
                    key={radius}
                    className={`px-2 py-1 rounded-md ${
                      selectedRadius === radius ? 'bg-red-500' : ''
                    }`}
                    onPress={() => setSelectedRadius(radius)}
                  >
                    <Text className={`text-sm font-semibold ${
                      selectedRadius === radius ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {radius}km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {getNearbyStations().map((station) => (
            <TouchableOpacity
              key={station.site_id}
              className="flex-row items-center p-3 border-b border-gray-200 dark:border-gray-700"
              onPress={() => onStationSelect(station)}
            >
              <Image 
                source={BrandLogos[station.brand] || require('../assets/default-fuel-logo.png')}
                className="w-12 h-12 rounded-full mr-3 bg-gray-100 dark:bg-gray-700"
                resizeMode="contain"
              />
              <View className="flex-1">
                <Text className="text-lg font-bold text-gray-900 dark:text-white">
                  {station.brand}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
                  {station.address}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  {station.distance.toFixed(1)}km away
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                  {formatPrice(selectedFuelType === 'E10' ? station.prices.E10! : station.prices.B7!)}
                </Text>
                <TouchableOpacity 
                  className="p-2 rounded-md bg-gray-100 dark:bg-gray-700"
                  onPress={() => openDirections(station)}
                >
                  <Ionicons name="navigate" size={16} color={AppTheme.colors.primary} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* National Average Card */}
      <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 border border-gray-200 dark:border-gray-700">
        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          National Average
        </Text>
        <View className="flex-row">
          <View className="flex-1 items-center p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mx-1">
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {selectedFuelType === 'E10' ? 'Petrol (E10)' : 'Diesel (B7)'}
            </Text>
            <Text className="text-xl font-bold text-gray-900 dark:text-white">
              {formatPrice(selectedFuelType === 'E10' ? stats.averagePrice.E10 : stats.averagePrice.B7)}
            </Text>
          </View>
        </View>
      </View>

      {/* Top 50 Stations Card */}
      <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 border border-gray-200 dark:border-gray-700">
        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          Top 50 Cheapest Stations
        </Text>
        <View className={!showAllTop50 ? 'max-h-[500px] overflow-hidden relative' : ''}>
          {getTop50Stations().map((station, index) => (
            <TouchableOpacity
              key={station.site_id}
              onPress={() => onStationSelect(station)}
              className={`${
                index === 0 
                  ? 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-2 p-4'
                  : 'border-b border-gray-200 dark:border-gray-700 p-3'
              }`}
            >
              {index === 0 ? (
                <View className="w-full">
                  <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 rounded-full bg-red-600 items-center justify-center mr-3">
                      <Text className="text-white font-bold">#1</Text>
                    </View>
                    <Image 
                      source={BrandLogos[station.brand] || require('../assets/default-fuel-logo.png')}
                      className="w-12 h-12 rounded-full mr-3"
                      resizeMode="contain"
                    />
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-gray-900 dark:text-white">
                        {station.brand}
                      </Text>
                      <Text className="text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
                        {station.address}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                    <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">Price</Text>
                    <Text className="text-2xl font-bold text-red-600 dark:text-red-500">
                      {formatPrice(station.price)}
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 items-center justify-center mr-3">
                    <Text className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                      #{index + 1}
                    </Text>
                  </View>
                  <Image 
                    source={BrandLogos[station.brand] || require('../assets/default-fuel-logo.png')}
                    className="w-8 h-8 rounded-full mr-3"
                    resizeMode="contain"
                  />
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900 dark:text-white">
                      {station.brand}
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
                      {station.address}
                    </Text>
                  </View>
                  <Text className="text-base font-semibold text-red-600 dark:text-red-500">
                    {formatPrice(station.price)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
          {!showAllTop50 && (
            <View className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-gray-800 to-transparent" />
          )}
        </View>
        
        <TouchableOpacity 
          className="flex-row items-center justify-center py-3"
          onPress={() => setShowAllTop50(!showAllTop50)}
        >
          <Text className="text-red-600 dark:text-red-500 font-semibold mr-1">
            {showAllTop50 ? 'Show Less' : 'Show More'}
          </Text>
          <Ionicons 
            name={showAllTop50 ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color={AppTheme.colors.primary} 
          />
        </TouchableOpacity>
      </View>

      {/* Region Selector */}
      <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 border border-gray-200 dark:border-gray-700">
        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          Cheapest regions
        </Text>
        
        <View className={!showAllRegions ? 'max-h-[300px] overflow-hidden relative' : ''}>
          {stats.cityPrices
            .filter(city => city.city !== 'Other')
            .sort((a, b) => {
              const priceA = selectedFuelType === 'E10' ? a.cheapestE10 : a.cheapestB7;
              const priceB = selectedFuelType === 'E10' ? b.cheapestE10 : b.cheapestB7;
              return priceA - priceB;
            })
            .slice(0, showAllRegions ? undefined : 10)
            .map((city, index) => (
              <TouchableOpacity
                key={city.city}
                className={`p-3 ${index === 0 ? 'bg-red-50 dark:bg-red-900/10 rounded-xl' : ''}`}
              >
                {index === 0 ? (
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center mb-4">
                      <View className="w-10 h-10 rounded-full bg-red-600 items-center justify-center mr-3">
                        <Text className="text-white font-bold">#1</Text>
                      </View>
                      <Text className="text-lg font-bold text-gray-900 dark:text-white">
                        {city.city}
                      </Text>
                    </View>
                    <View className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                      <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">Price</Text>
                      <Text className="text-2xl font-bold text-red-600 dark:text-red-500">
                        {formatPrice(selectedFuelType === 'E10' ? city.cheapestE10 : city.cheapestB7)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 items-center justify-center mr-3">
                      <Text className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                        #{index + 1}
                      </Text>
                    </View>
                    <Text className="flex-1 text-gray-900 dark:text-white">
                      {city.city}
                    </Text>
                    <Text className="text-base font-semibold text-red-600 dark:text-red-500">
                      {formatPrice(selectedFuelType === 'E10' ? city.cheapestE10 : city.cheapestB7)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          {!showAllRegions && (
            <View className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-gray-800 to-transparent" />
          )}
        </View>

        <TouchableOpacity 
          className="flex-row items-center justify-center py-3"
          onPress={() => setShowAllRegions(!showAllRegions)}
        >
          <Text className="text-red-600 dark:text-red-500 font-semibold mr-1">
            {showAllRegions ? 'Show Less' : 'Show More'}
          </Text>
          <Ionicons 
            name={showAllRegions ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color={AppTheme.colors.primary} 
          />
        </TouchableOpacity>
      </View>

      {/* Region Picker Modal */}
      <Modal
        visible={showRegionPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRegionPicker(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-gray-800 rounded-t-3xl">
            <View className="flex-row justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                Select Region
              </Text>
              <TouchableOpacity 
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-700"
                onPress={() => setShowRegionPicker(false)}
              >
                <Ionicons name="close" size={24} color={AppTheme.colors.primary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView className="max-h-[80%]">
              {stats.cityPrices
                .sort((a, b) => a.city.localeCompare(b.city))
                .map((city) => (
                  <Pressable
                    key={city.city}
                    className={`flex-row justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 ${
                      selectedRegion?.city === city.city ? 'bg-red-50 dark:bg-red-900/10' : ''
                    }`}
                    onPress={() => {
                      setSelectedRegion(city);
                      setShowRegionPicker(false);
                    }}
                  >
                    <Text className="text-base text-gray-900 dark:text-white">
                      {city.city}
                    </Text>
                    <View className="flex-row items-center">
                      <Text className="text-base font-semibold text-red-600 dark:text-red-500 mr-2">
                        {formatPrice(selectedFuelType === 'E10' ? city.cheapestE10 : city.cheapestB7)}
                      </Text>
                      {selectedRegion?.city === city.city && (
                        <Ionicons name="checkmark-circle" size={20} color={AppTheme.colors.primary} />
                      )}
                    </View>
                  </Pressable>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default FuelStatsCards; 