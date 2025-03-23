import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Station } from '../types/station';
import { AppTheme } from '../constants/BrandAssets';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { BrandLogos } from '../constants/BrandAssets';

interface StationCardProps {
  station: Station;
  onFavoritePress: () => void;
  isFavorite: boolean;
  isDeleting?: boolean;
}

const StationCard: React.FC<StationCardProps> = ({ station, onFavoritePress, isFavorite, isDeleting = false }) => {
  const swipeableRef = useRef<Swipeable>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isDeleting) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isDeleting]);

  const openMapsApp = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station.brand} ${station.address}`)}`;
    Linking.openURL(url);
  };

  const handleDelete = () => {
    swipeableRef.current?.close();
    onFavoritePress();
  };

  const renderRightActions = () => {
    return (
      <View className="w-20 h-full">
        <TouchableOpacity
          className="bg-red-500 justify-center items-center w-full h-full"
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>
    );
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

  const getLowestPrice = () => {
    const e10Price = station.prices.E10 || Infinity;
    const b7Price = station.prices.B7 || Infinity;
    return Math.min(e10Price, b7Price);
  };

  const getPriceLabel = () => {
    const e10Price = station.prices.E10 || Infinity;
    const b7Price = station.prices.B7 || Infinity;
    if (e10Price < b7Price) return 'E10';
    if (b7Price < e10Price) return 'B7';
    return 'E10/B7';
  };

  const lowestPrice = getLowestPrice();
  const priceLabel = getPriceLabel();

  return (
    <Animated.View 
      className="w-full"
      style={{
        opacity: fadeAnim,
        transform: [{
          scale: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.8, 1],
          })
        }],
      }}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
        rightThreshold={40}
      >
        <View className="mt-4">
          <View className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-2 mx-4">
            <View className="flex-row items-start">
              <Image 
                source={typeof getBrandLogo(station.brand) === 'string' 
                  ? { uri: getBrandLogo(station.brand) } 
                  : getBrandLogo(station.brand)}
                className="w-12 h-12 mr-3"
                resizeMode="contain"
              />
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  {station.name}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  {station.brand}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {station.address}
                </Text>
              </View>
              <View className="items-end">
                {station.prices.E10 && (
                  <View className="items-end mb-1">
                    <Text className="text-xs text-gray-500">Petrol</Text>
                    <Text className="text-lg font-bold text-green-600">
                      £{(station.prices.E10 / 100).toFixed(2)}
                    </Text>
                  </View>
                )}
                {station.prices.B7 && (
                  <View className="items-end">
                    <Text className="text-xs text-gray-500">Diesel</Text>
                    <Text className="text-lg font-bold text-gray-900">
                      £{(station.prices.B7 / 100).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View className="flex-row justify-between items-center mt-4">
              <Text className="text-xs text-gray-400 dark:text-gray-500">
                Last updated: {new Date(station.last_updated).toLocaleString()}
              </Text>
              <TouchableOpacity
                onPress={openMapsApp}
                className="flex-row items-center bg-blue-50 dark:bg-gray-700 px-3 py-1 rounded-full"
              >
                <Ionicons name="navigate-outline" size={16} color={AppTheme.colors.primary} />
                <Text className="text-sm text-primary ml-1">Directions</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Swipeable>
    </Animated.View>
  );
};

export default StationCard; 