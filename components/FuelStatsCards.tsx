import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Pressable } from 'react-native';
import { FuelStation } from '../services/FuelPriceService';
import { BrandLogos } from '../constants/BrandAssets';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface FuelStats {
  fuelStations: FuelStation[];
  cheapestUK: {
    price: number;
    station: string;
    location: string;
    fuelType: 'E10' | 'B7';
    stationData: FuelStation | null;
  };
  averagePrice: {
    E10: number;
    B7: number;
  };
  cityPrices: {
    city: string;
    cheapestE10: number;
    cheapestB7: number;
  }[];
}

interface FuelStatsCardsProps {
  stats: FuelStats;
  onStationSelect: (station: FuelStation) => void;
}

type CheapestStation = {
  price: number;
  station: string;
  location: string;
  fuelType: 'E10' | 'B7';
  stationData: FuelStation;
};

const formatPrice = (price: number): string => {
  return `£${(price / 100).toFixed(2)}`;
};

const FuelStatsCards: React.FC<FuelStatsCardsProps> = ({ stats, onStationSelect }) => {
  const [selectedFuelType, setSelectedFuelType] = useState<'E10' | 'B7'>('E10');
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<{
    city: string;
    cheapestE10: number;
    cheapestB7: number;
  } | null>(null);

  // Set default region to London (using any London postcode area)
  useEffect(() => {
    const londonRegions = ['N', 'NW', 'W', 'WC', 'E', 'EC', 'SE', 'SW'];
    const londonPrice = stats.cityPrices.find(price => 
      londonRegions.some(prefix => price.city.startsWith(prefix))
    );
    if (londonPrice) {
      setSelectedRegion(londonPrice);
    }
  }, [stats.cityPrices]);

  const getCheapestForFuelType = () => {
    return stats.fuelStations?.reduce<CheapestStation | null>((cheapest, station) => {
      const price = selectedFuelType === 'E10' ? station.prices.E10 : station.prices.B7;
      if (price && (!cheapest?.price || price < cheapest.price)) {
        return {
          price,
          station: station.brand,
          location: station.address,
          fuelType: selectedFuelType,
          stationData: station
        };
      }
      return cheapest;
    }, null) || stats.cheapestUK;
  };

  const cheapestStation = getCheapestForFuelType();

  return (
    <ScrollView 
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4 pb-8"
      showsVerticalScrollIndicator={false}
    >
      {/* Fuel Type Selector */}
      <View className="bg-white rounded-2xl shadow-sm mb-4 p-2">
        <View className="flex-row">
          <TouchableOpacity 
            className={`flex-1 py-3 rounded-xl ${selectedFuelType === 'E10' ? 'bg-blue-50' : ''}`}
            onPress={() => setSelectedFuelType('E10')}
          >
            <Text className={`text-center font-semibold ${selectedFuelType === 'E10' ? 'text-blue-600' : 'text-gray-600'}`}>
              Petrol (E10)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 py-3 rounded-xl ${selectedFuelType === 'B7' ? 'bg-blue-50' : ''}`}
            onPress={() => setSelectedFuelType('B7')}
          >
            <Text className={`text-center font-semibold ${selectedFuelType === 'B7' ? 'text-blue-600' : 'text-gray-600'}`}>
              Diesel (B7)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Cheapest in UK Card */}
      {cheapestStation && (
        <TouchableOpacity 
          className="bg-white rounded-2xl shadow-sm p-4 mb-4"
          onPress={() => cheapestStation.stationData && onStationSelect(cheapestStation.stationData)}
        >
          <Text className="text-lg font-bold text-gray-900 mb-3">Cheapest in UK</Text>
          <View className="flex-row items-center mb-3">
            <Image 
              source={BrandLogos[cheapestStation.station] || require('../assets/default-fuel-logo.png')}
              className="w-12 h-12 rounded-full mr-3"
              resizeMode="contain"
            />
            <View className="flex-1">
              <Text className="text-2xl font-bold text-blue-600">
                {formatPrice(cheapestStation.price)}
              </Text>
              <Text className="text-sm text-gray-600">{cheapestStation.station}</Text>
            </View>
          </View>
          <Text className="text-sm text-gray-500">{cheapestStation.location}</Text>
        </TouchableOpacity>
      )}

      {/* Average Price Card */}
      <View className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <Text className="text-lg font-bold text-gray-900 mb-3">National Average</Text>
        <Text className="text-2xl font-bold text-blue-600">
          {formatPrice(selectedFuelType === 'E10' ? stats.averagePrice.E10 : stats.averagePrice.B7)}
        </Text>
      </View>

      {/* Region Selector Card */}
      <TouchableOpacity 
        className="bg-white rounded-2xl shadow-sm p-4"
        onPress={() => setShowRegionPicker(true)}
      >
        <Text className="text-lg font-bold text-gray-900 mb-3">Regional Prices</Text>
        {selectedRegion ? (
          <>
            <Text className="text-base font-semibold text-gray-900 mb-1">
              {selectedRegion.city}
            </Text>
            <Text className="text-2xl font-bold text-blue-600">
              {formatPrice(selectedFuelType === 'E10' ? selectedRegion.cheapestE10 : selectedRegion.cheapestB7)}
            </Text>
          </>
        ) : (
          <Text className="text-gray-600">Select a region to view prices</Text>
        )}
      </TouchableOpacity>

      {/* Region Picker Modal */}
      <Modal
        visible={showRegionPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRegionPicker(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl">
            <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
              <Text className="text-xl font-bold">Select Region</Text>
              <TouchableOpacity onPress={() => setShowRegionPicker(false)}>
                <Text className="text-blue-600 text-lg">Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView className="max-h-96 p-4">
              {stats.cityPrices
                .sort((a, b) => a.city.localeCompare(b.city))
                .map((city) => (
                  <Pressable
                    key={city.city}
                    className={`p-4 border-b border-gray-100 ${
                      selectedRegion?.city === city.city ? 'bg-blue-50' : ''
                    }`}
                    onPress={() => {
                      setSelectedRegion(city);
                      setShowRegionPicker(false);
                    }}
                  >
                    <Text className="text-lg font-semibold">{city.city}</Text>
                    <Text className="text-blue-600 text-xl">
                      {formatPrice(selectedFuelType === 'E10' ? city.cheapestE10 : city.cheapestB7)}
                    </Text>
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