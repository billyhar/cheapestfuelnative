import React, { useEffect, useState, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator, Image, Platform, Linking, Animated } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { FuelPriceService, FuelStation } from '../services/FuelPriceService';
import { BrandLogos } from '../constants/BrandAssets';

// Initialize Mapbox configuration
Mapbox.setWellKnownTileServer('mapbox');
Mapbox.setAccessToken('pk.eyJ1IjoiY2hvbmthbW9ua2EiLCJhIjoiY201OXM3ZHI3MDRhaTJqczZwNGdqcjUyMCJ9.5s5gHVZdgIyswhtkFYbevQ');

interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: string;
    price?: number;
    color: string;
    brand: string;
    address: string;
    postcode: string;
    prices: {
      E10?: number;
      B7?: number;
    };
  };
}

interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

const PriceThresholds = {
  E10: {
    cheap: 135,
    expensive: 145
  },
  B7: {
    cheap: 140,
    expensive: 150
  }
};

const FuelPriceMap = () => {
  const [fuelStations, setFuelStations] = useState<FuelStation[]>([]);
  const [filteredStations, setFilteredStations] = useState<FuelStation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedStation, setSelectedStation] = useState<FuelStation | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const mapRef = useRef<Mapbox.MapView | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<number[] | null>(null);
  const [currentZoom, setCurrentZoom] = useState(9);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedStation) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11
      }).start();
    }
  }, [selectedStation]);

  const fetchData = async (forceRefresh: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const service = FuelPriceService.getInstance();
      const stations = await service.fetchFuelPrices(
        (progress) => setLoadingProgress(progress * 100),
        forceRefresh
      );
      
      setFuelStations(stations);
      setFilteredStations(stations);
      setLastUpdated(service.getLastUpdated());
      
      // Calculate price stats from all stations
      const prices = {
        E10: stations.map(s => s.prices.E10).filter(p => p) as number[],
        B7: stations.map(s => s.prices.B7).filter(p => p) as number[]
      };

      setPriceStats({
        E10: {
          min: Math.min(...prices.E10),
          max: Math.max(...prices.E10)
        },
        B7: {
          min: Math.min(...prices.B7),
          max: Math.max(...prices.B7)
        }
      });
    } catch (error: any) {
      console.error('Error fetching fuel prices:', error);
      setError(error.message || 'Failed to fetch fuel prices');
    } finally {
      setLoading(false);
      setLoadingProgress(0);
    }
  };

  const filterStationsInBounds = () => {
    if (!currentBounds) return;
    
    const [west, south, east, north] = currentBounds;
    
    // Add padding to the bounds (about 5km)
    const padding = 0.05;
    const paddedBounds = {
      north: north + padding,
      south: south - padding,
      east: east + padding,
      west: west - padding
    };

    // First filter by bounds
    const inBoundsStations = fuelStations.filter(station => 
      station.location.latitude <= paddedBounds.north &&
      station.location.latitude >= paddedBounds.south &&
      station.location.longitude <= paddedBounds.east &&
      station.location.longitude >= paddedBounds.west
    );

    // Then limit based on zoom level
    let maxStations = 1000;
    if (currentZoom < 8) maxStations = 20;
    else if (currentZoom < 10) maxStations = 50;
    else if (currentZoom < 12) maxStations = 100;
    else if (currentZoom < 14) maxStations = 200;

    // If we need to limit stations, prioritize the cheapest ones
    let finalStations = inBoundsStations;
    if (inBoundsStations.length > maxStations) {
      finalStations = inBoundsStations
        .sort((a, b) => {
          const priceA = a.prices.E10 || a.prices.B7 || Infinity;
          const priceB = b.prices.E10 || b.prices.B7 || Infinity;
          return priceA - priceB;
        })
        .slice(0, maxStations);
    }

    setFilteredStations(finalStations);
    setShowSearchArea(false);
  };

  const getPriceColor = (prices: FuelStation['prices']): string => {
    const e10Price = prices.E10;
    const b7Price = prices.B7;

    if (!e10Price && !b7Price) return '#808080'; // Gray for no prices

    // Check E10 first
    if (e10Price) {
      if (e10Price <= PriceThresholds.E10.cheap) return '#4CAF50'; // Green
      if (e10Price >= PriceThresholds.E10.expensive) return '#F44336'; // Red
      return '#FFA726'; // Orange
    }

    // If no E10, check B7
    if (b7Price) {
      if (b7Price <= PriceThresholds.B7.cheap) return '#4CAF50'; // Green
      if (b7Price >= PriceThresholds.B7.expensive) return '#F44336'; // Red
      return '#FFA726'; // Orange
    }

    return '#808080'; // Gray as fallback
  };

  const formatPrice = (price: number | undefined): string => {
    if (!price) return 'N/A';
    const pounds = (price / 100).toFixed(2);
    return `£${pounds}`;
  };

  const formatLastUpdated = (dateStr: string) => {
    const date = new Date(dateStr.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderAnnotations = () => {
    const geojson = {
      type: 'FeatureCollection',
      features: filteredStations
        .filter(station => {
          return (
            typeof station.location.longitude === 'number' &&
            typeof station.location.latitude === 'number' &&
            !isNaN(station.location.longitude) &&
            !isNaN(station.location.latitude)
          );
        })
        .map(station => ({
          type: 'Feature',
          properties: {
            id: station.site_id,
            price: station.prices.E10 || station.prices.B7 || 999,
            color: getPriceColor(station.prices)
          },
          geometry: {
            type: 'Point',
            coordinates: [station.location.longitude, station.location.latitude]
          }
        }))
    };

    return (
      <Mapbox.ShapeSource
        id="stationsSource"
        shape={geojson}
        cluster={true}
        clusterMaxZoom={11}
        clusterRadius={50}
        clusterProperties={{
          sum: ['+', ['get', 'price']],
          point_count: ['get', 'point_count']
        }}
        onPress={e => {
          const feature = e.features[0];
          if (feature && !feature.properties.cluster) {
            const station = fuelStations.find(s => s.site_id === feature.properties.id);
            if (station) {
              setSelectedStation(station);
            }
          }
        }}
      >
        {/* Render clusters */}
        <Mapbox.CircleLayer
          id="clusters"
          filter={['has', 'point_count']}
          style={{
            circleColor: [
              'step',
              ['/', ['get', 'sum'], ['get', 'point_count']], // Average price
              '#4CAF50', // Green for cheap
              140,       // If average price >= 140
              '#FF9800', // Orange for medium
              150,       // If average price >= 150
              '#F44336'  // Red for expensive
            ],
            circleRadius: [
              'step',
              ['get', 'point_count'],
              20,  // Default radius
              10,  // Then radius = 25
              25,  // If point_count >= 50
              50,  // Then radius = 30
              30
            ],
            circleOpacity: 0.84,
            circleStrokeWidth: 2,
            circleStrokeColor: 'white'
          }}
        />

        {/* Render cluster count */}
        <Mapbox.SymbolLayer
          id="cluster-count"
          filter={['has', 'point_count']}
          style={{
            textField: ['get', 'point_count'],
            textSize: 14,
            textColor: '#FFFFFF',
            textAllowOverlap: true,
            textIgnorePlacement: true
          }}
        />

        {/* Render individual stations */}
        <Mapbox.CircleLayer
          id="unclustered-points"
          filter={['!', ['has', 'point_count']]}
          style={{
            circleColor: ['get', 'color'],
            circleRadius: 12,
            circleStrokeWidth: 2,
            circleStrokeColor: 'white'
          }}
        />

        <Mapbox.SymbolLayer
          id="unclustered-labels"
          filter={['!', ['has', 'point_count']]}
          style={{
            textField: '£',
            textSize: 12,
            textColor: '#FFFFFF',
            textAllowOverlap: true,
            textIgnorePlacement: true
          }}
        />
      </Mapbox.ShapeSource>
    );
  };

  const [priceStats, setPriceStats] = useState<{
    E10: { min: number; max: number };
    B7: { min: number; max: number };
  }>({
    E10: { min: 0, max: 0 },
    B7: { min: 0, max: 0 }
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="bg-white shadow-sm">
        <View className="flex-row justify-between items-center px-4 py-2">
          <Text className="text-base font-medium text-gray-900">
            {loading ? `Loading... ${loadingProgress.toFixed(0)}%` : 'Fuel Prices'}
          </Text>
          {lastUpdated && (
            <Text className="text-sm text-gray-500">
              Last updated: {formatLastUpdated(lastUpdated)}
            </Text>
          )}
          <TouchableOpacity 
            className="p-2 rounded-full bg-blue-50" 
            onPress={() => fetchData(true)}
          >
            <Text className="text-blue-600 text-lg">↻</Text>
          </TouchableOpacity>
        </View>

        {priceStats.E10.min > 0 && (
          <Text className="text-sm text-gray-600 px-4 pb-2">
            E10: {formatPrice(priceStats.E10.min)} - {formatPrice(priceStats.E10.max)} | 
            Diesel: {formatPrice(priceStats.B7.min)} - {formatPrice(priceStats.B7.max)}
          </Text>
        )}
      </View>

      <View className="flex-1 relative">
        <Mapbox.MapView
          ref={mapRef}
          style={{ flex: 1 }}
          styleURL="mapbox://styles/mapbox/streets-v12"
          logoEnabled={false}
          compassEnabled={true}
          pitchEnabled={false}
          zoomEnabled={true}
          scrollEnabled={true}
          rotateEnabled={true}
          onMapIdle={e => {
            if (e.properties.bounds && e.properties.zoomLevel) {
              setCurrentBounds(e.properties.bounds);
              setCurrentZoom(e.properties.zoomLevel);
              setShowSearchArea(true);
            }
          }}
          onPress={() => setSelectedStation(null)}
        >
          <Mapbox.Camera
            defaultSettings={{
              centerCoordinate: [-1.4868, 52.3914],
              zoomLevel: 9
            }}
            animationMode="none"
          />
          
          {renderAnnotations()}

          {showSearchArea && (
            <TouchableOpacity
              className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 px-4 py-2 rounded-full shadow-lg"
              onPress={() => {
                if (currentBounds) {
                  filterStationsInBounds();
                }
              }}
            >
              <Text className="text-white font-semibold">Search This Area</Text>
            </TouchableOpacity>
          )}
          
          {loading && (
            <View className="absolute inset-0 bg-white/80 items-center justify-center">
              <ActivityIndicator size="large" color="#007AFF" />
              <Text className="mt-2 text-base text-gray-700">{loadingProgress.toFixed(0)}% Complete</Text>
            </View>
          )}
        </Mapbox.MapView>

        {selectedStation && (
          <Animated.View 
            className="absolute bottom-0 left-0 right-0 bg-white"
            style={{
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [300, 0]
                })
              }]
            }}
          >
            <View className="px-4 pt-4 pb-8">
              {/* Header */}
              <View className="flex-row items-center mb-4">
                <Image 
                  source={BrandLogos[selectedStation.brand] || BrandLogos.default}
                  className="w-12 h-12 mr-3"
                  resizeMode="contain"
                />
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-gray-900">{selectedStation.brand}</Text>
                  <Text className="text-base text-gray-600 mt-1">{selectedStation.address}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedStation(null)}
                  className="h-8 w-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Text className="text-lg text-gray-500">×</Text>
                </TouchableOpacity>
              </View>

              {/* Price Info */}
              <View className="flex-row justify-between bg-gray-50 rounded-2xl p-4 mb-4">
                {selectedStation.prices.E10 && (
                  <View className="flex-1">
                    <Text className="text-base text-gray-600 mb-1">Petrol (E10)</Text>
                    <Text className="text-2xl font-bold text-gray-900">
                      £{(selectedStation.prices.E10 / 100).toFixed(2)}
                    </Text>
                  </View>
                )}
                {selectedStation.prices.B7 && (
                  <View className="flex-1 ml-6">
                    <Text className="text-base text-gray-600 mb-1">Diesel</Text>
                    <Text className="text-2xl font-bold text-gray-900">
                      £{(selectedStation.prices.B7 / 100).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Directions Button */}
              <TouchableOpacity
                className="bg-blue-500 rounded-2xl p-4 flex-row items-center justify-center"
                onPress={() => {
                  const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
                  const latLng = `${selectedStation.location.latitude},${selectedStation.location.longitude}`;
                  const label = selectedStation.brand;
                  const url = Platform.select({
                    ios: `${scheme}${label}@${latLng}`,
                    android: `${scheme}${latLng}(${label})`
                  });
                  Linking.openURL(url);
                }}
              >
                <Text className="text-white font-semibold text-lg">Get Directions</Text>
              </TouchableOpacity>

              <Text className="text-sm text-gray-400 text-center mt-4">
                {selectedStation.postcode}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default FuelPriceMap;
