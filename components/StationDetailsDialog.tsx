import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Platform, Linking, Animated, ActionSheetIOS, Alert, ScrollView, Pressable } from 'react-native';
import { FuelStation } from '../services/FuelPriceService';
import { BrandLogos } from '../constants/BrandAssets';
import { PriceHistoryGraph } from '../app/components/PriceHistoryGraph';
import { ErrorBoundary } from 'react-error-boundary';

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
  const [selectedFuelType, setSelectedFuelType] = useState<'E10' | 'B7'>(
    station.prices.E10 ? 'E10' : 'B7'
  );
  
  // Create a ref for the scrollView so we can access it directly
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Function to directly handle tab button presses
  const handleFuelTypeChange = (fuelType: 'E10' | 'B7') => {
    setSelectedFuelType(fuelType);
    // Scroll to top when switching tabs to avoid any scroll position issues
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
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
    <Animated.View 
      className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl"
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
        }),
        maxHeight: '80%' // Limit height to prevent overflow
      }}
    >
      <ScrollView 
        ref={scrollViewRef}
        bounces={false} 
        className="pb-6"
        contentContainerStyle={{ paddingBottom: 20 }} // Add extra padding at bottom
      >
        <View className="px-4 pt-4 pb-8">
          {/* Handle bar for better UX */}
          <View className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
          
          {/* Header */}
          <View className="flex-row items-top mb-4">
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
            <Pressable 
              onPress={onClose}
              className="h-12 w-12 rounded-full bg-gray-100 items-center justify-center pb-1"
            >
              <Text className="text-3xl text-gray-500">×</Text>
            </Pressable>
          </View>

          {/* Segmented Control for Fuel Type - Simplified to avoid navigation context issues */}
          {station.prices.E10 && station.prices.B7 && (
            <View className="flex-row bg-gray-100 rounded-full p-1 mb-4">
              <Pressable
                className={`flex-1 py-2 px-4 rounded-full ${
                  selectedFuelType === 'E10' ? 'bg-white' : ''
                }`}
                onPress={() => handleFuelTypeChange('E10')}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                    shadowColor: selectedFuelType === 'E10' ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: selectedFuelType === 'E10' ? 0.2 : 0,
                    shadowRadius: selectedFuelType === 'E10' ? 2 : 0,
                    elevation: selectedFuelType === 'E10' ? 2 : 0
                  }
                ]}
              >
                <Text
                  className={`text-center font-medium ${
                    selectedFuelType === 'E10' ? 'text-blue-600' : 'text-gray-600'
                  }`}
                >
                  Petrol (E10)
                </Text>
              </Pressable>
              
              <Pressable
                className={`flex-1 py-2 px-4 rounded-full ${
                  selectedFuelType === 'B7' ? 'bg-white' : ''
                }`}
                onPress={() => handleFuelTypeChange('B7')}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                    shadowColor: selectedFuelType === 'B7' ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: selectedFuelType === 'B7' ? 0.2 : 0,
                    shadowRadius: selectedFuelType === 'B7' ? 2 : 0,
                    elevation: selectedFuelType === 'B7' ? 2 : 0
                  }
                ]}
              >
                <Text
                  className={`text-center font-medium ${
                    selectedFuelType === 'B7' ? 'text-blue-600' : 'text-gray-600'
                  }`}
                >
                  Diesel (B7)
                </Text>
              </Pressable>
            </View>
          )}

          {/* Current Price Info */}
          <View className="bg-gray-50 rounded-2xl p-4 mb-4">
            <Text className="text-base text-gray-600 mb-1">
              {selectedFuelType === 'E10' ? 'Petrol (E10)' : 'Diesel (B7)'}
            </Text>
            <Text className="text-3xl font-bold text-gray-900">
              £{((selectedFuelType === 'E10' ? station.prices.E10 || 0 : station.prices.B7 || 0) / 100).toFixed(2)}
            </Text>
          </View>

          {/* Price History Graph */}
          <ErrorBoundary 
            fallbackRender={() => (
              <View className="bg-gray-50 rounded-2xl p-4">
                <Text className="text-center text-gray-600">
                  Unable to load price history
                </Text>
              </View>
            )}
            onError={(error) => console.error("PriceHistoryGraph error:", error)}
          >
            <PriceHistoryGraph 
              siteId={station.site_id} 
              fuelType={selectedFuelType === 'E10' ? 'e10' : 'b7'} 
            />
          </ErrorBoundary>

          {/* Last Updated */}
          <Text className="text-sm text-gray-500 text-center mb-4 mt-2">
            Last updated: {formatLastUpdated(station.last_updated ?? null)}
          </Text>

          {/* Directions Button */}
          <Pressable
            className="bg-brand rounded-2xl p-4 flex-row items-center justify-center"
            onPress={handleGetDirections}
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.8 : 1
              }
            ]}
          >
            <Text className="text-white font-semibold text-lg">Get Directions</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Animated.View>
  );
};

export default StationDetailsDialog;
