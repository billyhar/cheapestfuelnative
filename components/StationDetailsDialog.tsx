import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform, Linking, Animated } from 'react-native';
import { FuelStation } from '../services/FuelPriceService';
import { BrandLogos } from '../constants/BrandAssets';

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
  onClose: () => void;
  slideAnim: Animated.Value;
}

const StationDetailsDialog: React.FC<StationDetailsDialogProps> = ({
  station,
  onClose,
  slideAnim,
}) => {
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

  return (
    <Animated.View 
      className="absolute bottom-0 left-0 right-0 bg-white"
      style={{
        transform: [{
          translateY: slideAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [300, 0]
          })
        }],
        opacity: slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1]
        })
      }}
    >
      <View className="px-4 pt-4 pb-8">
        {/* Header */}
        <View className="flex-row items-center mb-4">
          <Image 
            source={typeof getBrandLogo(station.brand) === 'string' 
              ? { uri: getBrandLogo(station.brand) } 
              : getBrandLogo(station.brand)}
            className="w-12 h-12 mr-3"
            resizeMode="contain"
          />
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-900">{station.brand}</Text>
            <Text className="text-base text-gray-600 mt-1">{station.address}</Text>
            <Text className="text-xs text-gray-600 mt-1">{station.postcode}</Text>
          </View>
          <TouchableOpacity 
            onPress={onClose}
            className="h-12 w-12 rounded-full bg-gray-100 items-center justify-center pb-1"
          >
            <Text className="text-3xl text-gray-500">×</Text>
          </TouchableOpacity>
        </View>

        {/* Price Info */}
        <View className="flex-row justify-between bg-gray-50 rounded-2xl p-4 mb-4">
          {station.prices.E10 && (
            <View className="flex-1">
              <Text className="text-base text-gray-600 mb-1">Petrol (E10)</Text>
              <Text className="text-2xl font-bold text-gray-900">
                £{(station.prices.E10 / 100).toFixed(2)}
              </Text>
            </View>
          )}
          {station.prices.B7 && (
            <View className="flex-1 ml-6">
              <Text className="text-base text-gray-600 mb-1">Diesel</Text>
              <Text className="text-2xl font-bold text-gray-900">
                £{(station.prices.B7 / 100).toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Last Updated */}
        <Text className="text-sm text-gray-500 text-center mb-4">
          Last updated: {formatLastUpdated(station.last_updated ?? null)}
        </Text>

        {/* Directions Button */}
        <TouchableOpacity
          className="bg-blue-500 rounded-2xl p-4 flex-row items-center justify-center"
          onPress={() => {
            const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
            const latLng = `${station.location.latitude},${station.location.longitude}`;
            const label = station.brand;
            const url = Platform.select({
              ios: `${scheme}${label}@${latLng}`,
              android: `${scheme}${latLng}(${label})`
            });
            if (url) {
              Linking.openURL(url);
            }
          }}
        >
          <Text className="text-white font-semibold text-lg">Get Directions</Text>
        </TouchableOpacity>

      </View>
    </Animated.View>
  );
};

export default StationDetailsDialog;
