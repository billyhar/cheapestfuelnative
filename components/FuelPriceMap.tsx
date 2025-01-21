import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator, Image, Platform, Linking, Animated, Easing, StyleSheet } from 'react-native';
import Mapbox, {CircleLayerStyle, SymbolLayerStyle, UserLocation, MapState} from '@rnmapbox/maps';
import type { OnPressEvent } from '@rnmapbox/maps';
import { FuelPriceService, FuelStation } from '../services/FuelPriceService';
import { BrandLogos } from '../constants/BrandAssets';
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';


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

const formatLastUpdated = (timestamp: string | null): string => {
  try {
    if (!timestamp) {
      return 'Unknown';
    }
    
    const date = new Date(timestamp);
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

const FuelPriceMap: React.FC = () => {
  const [fuelStations, setFuelStations] = useState<FuelStation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedStation, setSelectedStation] = useState<FuelStation | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [currentZoom, setCurrentZoom] = useState(9);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [priceStats, setPriceStats] = useState<PriceStats>({
    E10: { min: 0, max: 0 },
    B7: { min: 0, max: 0 }
  });
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  // London coordinates: -0.1276, 51.5074
  const defaultLocation: [number, number] = [-0.1276, 51.5074];

  useEffect(() => {
    // Initial data fetch with force refresh to ensure we get fresh data
    fetchData(true);
    
    // Set up refresh interval
    const refreshInterval = setInterval(() => {
      fetchData(true);
    }, 15 * 60 * 1000); // Refresh every 15 minutes

    return () => clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    requestLocationPermission();
  }, []);

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
    try {
      const service = FuelPriceService.getInstance();
      const stations = await service.fetchFuelPrices(
        (progress) => setLoadingProgress(progress),
        forceRefresh
      );
      
      setFuelStations(stations);
      const lastUpdatedTime = service.getLastUpdated();
      setLastUpdated(lastUpdatedTime);
      
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

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
  };

  const handleLocationPress = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access location was denied');
        return;
      }

      setLoading(true);

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const { latitude, longitude } = location.coords;
      const coordinates: [number, number] = [longitude, latitude];
      setCurrentLocation(coordinates);
      
      // Ensure the camera ref exists and update it
      if (mapRef.current && cameraRef.current) {
        try {
          await cameraRef.current.flyTo(coordinates, 1000);
          await cameraRef.current.zoomTo(15, 1000);
        } catch (err) {
          console.error('Camera update error:', err);
        }
      }
    } catch (err) {
      console.error('Location error:', err);
      setError('Error getting location');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLocationUpdate = useCallback((location: any) => {
    if (location.coords) {
      setUserLocation([location.coords.longitude, location.coords.latitude]);
    }
  }, []);

  const handleMapIdle = useCallback((state: MapState) => {
    if (state.properties?.zoom) {
      setCurrentZoom(state.properties.zoom);
    }
  }, []);

  const handleMapPress = useCallback(() => {
    setSelectedStation(null);
  }, []);

  const renderAnnotations = () => {
    const geojson: GeoJSONCollection = {
      type: 'FeatureCollection',
      features: fuelStations
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
      circleRadius: 32,
      circleStrokeWidth: 2,
      circleStrokeColor: 'white',

    };

    const unclusteredLabelStyle: SymbolLayerStyle = {
      textField: ['format',
        '£', { 'font-scale': 0.8 },
        ['number-format', 
          ['/', ['round', ['*', ['/', ['get', 'price'], 100], 100]], 100],
          { 'min-fraction-digits': 2, 'max-fraction-digits': 2, 'locale': 'en-GB' }
        ], 
        { 'font-scale': 1.2, 'text-font': ['DIN Offc Pro Black', 'Arial Unicode MS Bold'] }
      ],
      textSize: 13,
      textColor: '#FFFFFF',
      textAllowOverlap: true,
      textIgnorePlacement: true,
      textPadding: 24,
    };

    return (
      <Mapbox.ShapeSource
        id="stationsSource"
        shape={geojson}
        cluster={true}
        clusterMaxZoomLevel={14}
        clusterRadius={50}
        clusterProperties={{
          sum: ['+', ['get', 'price']],
          point_count: ['get', 'point_count']
        }}
        onPress={useCallback((e: OnPressEvent) => {
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
    <SafeAreaView style={styles.container}>
      <Mapbox.MapView
        ref={mapRef}
        style={styles.map}
        onPress={handleMapPress}
        onMapIdle={handleMapIdle}
        compassEnabled={true}
        compassPosition={{ top: Platform.OS === 'ios' ? 650 : 600, left: 16 }}
        compassViewPosition={1}
        compassViewMargins={{ x: 16, y: Platform.OS === 'ios' ? 650 : 600 }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          zoomLevel={11}
          centerCoordinate={currentLocation || defaultLocation}
        />
        <UserLocation 
          visible={locationPermission}
          onUpdate={handleLocationUpdate}
          minDisplacement={10}
        />
        {renderAnnotations()}
      </Mapbox.MapView>

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading fuel prices ⛽️</Text>
        </View>
      )}

      {/* Station details */}
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
      
      {userLocation && (
        <TouchableOpacity
          className="absolute top-16 right-4 bg-white p-3 rounded-full shadow-lg"
          onPress={() => {
            if (userLocation && cameraRef.current) {
              cameraRef.current.setCamera({
                centerCoordinate: userLocation,
                zoomLevel: 14,
                animationDuration: 1000
              });
            }
          }}
        >
          <Ionicons name="navigate" size={24} color="blue" />
        </TouchableOpacity>
      )}
      
      {/* Last updated info */}
      {lastUpdated && (
        <View style={styles.lastUpdatedContainer}>
          <Text style={styles.lastUpdatedText}>
            Last updated: {formatLastUpdated(lastUpdated)}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  lastUpdatedContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 40 : 80,
    left: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#666',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
  },
});

export default FuelPriceMap;
