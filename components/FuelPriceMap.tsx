import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator, Image, Platform, Linking, Animated, Easing } from 'react-native';
import Mapbox, {CircleLayerStyle, SymbolLayerStyle, UserLocation } from '@rnmapbox/maps';
import { FuelPriceService, FuelStation } from '../services/FuelPriceService';
import { BrandLogos } from '../constants/BrandAssets';
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox';

// Initialize Mapbox
Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

interface PriceStats {
  E10: { min: number; max: number };
  B7: { min: number; max: number };
}

interface Feature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: string;
    price: number;
    color: string;
    cluster?: boolean;
    point_count?: number;
  };
}

interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

interface MapboxFeature extends Feature {
  properties: Feature['properties'] & {
    cluster?: boolean;
    point_count?: number;
  };
}

interface MapboxFeatureEvent {
  features?: MapboxFeature[];
  coordinates: [number, number];
  point: [number, number];
}

interface MapboxMapIdleEvent {
  properties?: {
    bounds?: [number, number, number, number];
    zoomLevel?: number;
  };
}

const getPriceColor = (prices: FuelStation['prices']): string => {
  const price = prices.E10 || prices.B7 || 0;
  if (price === 0) return '#808080'; // Gray for no price
  if (price < 140) return '#4CAF50'; // Green for cheap
  if (price < 150) return '#FF9800'; // Orange for medium
  return '#F44336'; // Red for expensive
};

const formatPrice = (price: number): string => {
  return `£${(price / 100).toFixed(2)}`;
};

const formatLastUpdated = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

const FuelPriceMap: React.FC = () => {
  const [fuelStations, setFuelStations] = useState<FuelStation[]>([]);
  const [filteredStations, setFilteredStations] = useState<FuelStation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedStation, setSelectedStation] = useState<FuelStation | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<[number, number, number, number] | null>(null);
  const [currentZoom, setCurrentZoom] = useState(9);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [priceStats, setPriceStats] = useState<PriceStats>({
    E10: { min: 0, max: 0 },
    B7: { min: 0, max: 0 }
  });
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (selectedStation) {
      slideAnim.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease)
      }).start();
    }
  }, [selectedStation]);

  const fetchData = async (forceRefresh: boolean = false) => {
    setLoading(true);
    setError(null);
    setLastUpdated(null);
    try {
      const service = FuelPriceService.getInstance();
      const stations = await service.fetchFuelPrices(
        (progress) => setLoadingProgress(progress),
        forceRefresh
      );
      setFuelStations(stations);
      setFilteredStations(stations);
      const updatedTime = service.getLastUpdated();
      if (updatedTime) {
        setLastUpdated(updatedTime);
      }
      
      // Calculate price stats
      const stats: PriceStats = {
        E10: { min: Infinity, max: -Infinity },
        B7: { min: Infinity, max: -Infinity }
      };
      
      stations.forEach(station => {
        if (station.prices.E10) {
          stats.E10.min = Math.min(stats.E10.min, station.prices.E10);
          stats.E10.max = Math.max(stats.E10.max, station.prices.E10);
        }
        if (station.prices.B7) {
          stats.B7.min = Math.min(stats.B7.min, station.prices.B7);
          stats.B7.max = Math.max(stats.B7.max, station.prices.B7);
        }
      });
      
      // Handle case where no prices were found
      if (stats.E10.min === Infinity) stats.E10.min = 0;
      if (stats.E10.max === -Infinity) stats.E10.max = 0;
      if (stats.B7.min === Infinity) stats.B7.min = 0;
      if (stats.B7.max === -Infinity) stats.B7.max = 0;
      
      setPriceStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filterStationsInBounds = () => {
    if (!currentBounds) return;
    
    const [minLng, minLat, maxLng, maxLat] = currentBounds;
    
    const filtered = fuelStations.filter(station => {
      const { longitude, latitude } = station.location;
      return (
        longitude >= minLng &&
        longitude <= maxLng &&
        latitude >= minLat &&
        latitude <= maxLat
      );
    });
    
    setFilteredStations(filtered);
    setShowSearchArea(false);
  };

  // Helper function to get brand logo with fallback
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

  const renderAnnotations = () => {
    const geojson: GeoJSONCollection = {
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
          geometry: {
            type: 'Point',
            coordinates: [station.location.longitude, station.location.latitude]
          },
          properties: {
            id: station.site_id,
            price: station.prices.E10 || station.prices.B7 || 999,
            color: getPriceColor(station.prices)
          }
        }))
    };

    const circleLayerStyle: CircleLayerStyle = {
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
        20,   // Default radius
        10,   // If point_count >= 10
        25,   // Then radius = 25
        50,   // If point_count >= 50
        30    // Then radius = 30
      ],
      circleOpacity: 0.84,
      circleStrokeWidth: 2,
      circleStrokeColor: 'white'
    };

    const symbolLayerStyle: SymbolLayerStyle = {
      textField: ['get', 'point_count'],
      textSize: 14,
      textColor: '#FFFFFF',
      textAllowOverlap: true,
      textIgnorePlacement: true
    };

    const unclusteredPointStyle: CircleLayerStyle = {
      circleColor: ['get', 'color'],
      circleRadius: 12,
      circleStrokeWidth: 2,
      circleStrokeColor: 'white'
    };

    const unclusteredLabelStyle: SymbolLayerStyle = {
      textField: '£',
      textSize: 12,
      textColor: '#FFFFFF',
      textAllowOverlap: true,
      textIgnorePlacement: true
    };

    return (
      <Mapbox.ShapeSource
        id="stationsSource"
        shape={geojson}
        cluster={true}
        clusterMaxZoom={14}
        clusterRadius={50}
        clusterProperties={{
          sum: ['+', ['get', 'price']],
          point_count: ['get', 'point_count']
        }}
        onPress={useCallback((e: MapboxFeatureEvent) => {
          if (!e.features?.length) return;
          
          const feature = e.features[0];
          if (feature.properties?.cluster && feature.geometry?.coordinates) {
            const [longitude, latitude] = feature.geometry.coordinates;
            cameraRef.current?.setCamera({
              centerCoordinate: [longitude, latitude],
              zoomLevel: 14,
              animationDuration: 1000
            });
          } else {
            const station = fuelStations.find(s => s.site_id === feature.properties?.id);
            if (station) {
              setSelectedStation(station);
            }
          }
        }, [fuelStations])}
      >
        <Mapbox.CircleLayer
          id="clusters"
          filter={['has', 'point_count']}
          style={circleLayerStyle}
        />

        <Mapbox.SymbolLayer
          id="cluster-count"
          filter={['has', 'point_count']}
          style={symbolLayerStyle}
        />

        <Mapbox.CircleLayer
          id="unclustered-points"
          filter={['!', ['has', 'point_count']]}
          style={unclusteredPointStyle}
        />

        <Mapbox.SymbolLayer
          id="unclustered-labels"
          filter={['!', ['has', 'point_count']]}
          style={unclusteredLabelStyle}
        />
      </Mapbox.ShapeSource>
    );
  };

  const handleLocationPress = useCallback(() => {
    if (userLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: userLocation,
        zoomLevel: 14,
        animationDuration: 1000
      });
    }
  }, [userLocation]);

  const handleLocationUpdate = useCallback((location: any) => {
    if (location.coords) {
      setUserLocation([location.coords.longitude, location.coords.latitude]);
    }
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="bg-white shadow-sm">
        <View className="flex-row justify-between items-center px-4 py-2">
          <Text className="text-sm text-gray-500">
            {lastUpdated ? `Last updated: ${formatLastUpdated(lastUpdated)}` : ''}
          </Text>
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
          onMapIdle={useCallback((e: MapboxMapIdleEvent) => {
            if (e.properties?.bounds && e.properties?.zoomLevel) {
              setCurrentBounds(e.properties.bounds);
              setCurrentZoom(e.properties.zoomLevel);
              setShowSearchArea(true);
            }
          }, [])}
          onPress={() => setSelectedStation(null)}
        >
          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: [-1.4868, 52.3914],
              zoomLevel: 9
            }}
            animationMode="flyTo"
            animationDuration={1000}
          />
          
          <UserLocation 
            visible={true}
            onUpdate={handleLocationUpdate}
            minDisplacement={10}
          />
          
          {renderAnnotations()}

          {userLocation && (
            <TouchableOpacity
              className="absolute top-4 right-4 bg-white p-3 rounded-full shadow-lg"
              onPress={handleLocationPress}
            >
              <Text style={{ fontSize: 20 }}>📍</Text>
            </TouchableOpacity>
          )}
          
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
                  source={typeof getBrandLogo(selectedStation.brand) === 'string' 
                    ? { uri: getBrandLogo(selectedStation.brand) } 
                    : getBrandLogo(selectedStation.brand)}
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
                  if (url) {
                    Linking.openURL(url);
                  }
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
