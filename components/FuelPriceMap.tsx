import React, { useEffect, useState, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
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

export default function FuelPriceMap() {
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

  useEffect(() => {
    fetchData();
  }, []);

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
    // Create GeoJSON features with price data for clustering
    const features: GeoJSONFeature[] = filteredStations
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
          color: getPriceColor(station.prices),
          brand: station.brand,
          address: station.address,
          postcode: station.postcode,
          prices: station.prices
        }
      }));

    const geojson: GeoJSONCollection = {
      type: 'FeatureCollection',
      features
    };

    return (
      <>
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

        {/* Add a separate source for handling clicks */}
        <Mapbox.ShapeSource
          id="stationsClickSource"
          shape={geojson}
          cluster={false}
        >
          <Mapbox.CircleLayer
            id="station-click-layer"
            style={{
              circleRadius: 12,
              circleOpacity: 0
            }}
            onPress={e => {
              const feature = e.features[0];
              if (feature) {
                const station = fuelStations.find(s => s.site_id === feature.properties.id);
                if (station) {
                  setSelectedStation(station);
                }
              }
            }}
          />
        </Mapbox.ShapeSource>

        {selectedStation && (
          <Mapbox.MarkerView
            coordinate={[selectedStation.location.longitude, selectedStation.location.latitude]}
            anchor={{x: 0.5, y: 0}}
          >
            <View className="bg-white rounded-lg shadow-lg p-3 mb-2">
              <View className="flex-row items-center mb-2">
                <Image 
                  source={BrandLogos[selectedStation.brand] || BrandLogos.default}
                  className="w-6 h-6 mr-2"
                />
                <Text className="font-bold flex-1">{selectedStation.brand}</Text>
                <TouchableOpacity 
                  onPress={() => setSelectedStation(null)}
                  className="ml-2"
                >
                  <Text className="text-gray-500">✕</Text>
                </TouchableOpacity>
              </View>
              
              <Text className="text-gray-600 mb-1">{selectedStation.address}</Text>
              <Text className="text-gray-500 text-sm mb-2">{selectedStation.postcode}</Text>
              
              <View className="flex-row justify-between mt-1">
                {selectedStation.prices.E10 && (
                  <View>
                    <Text className="text-sm text-gray-500">E10</Text>
                    <Text className="font-bold">£{selectedStation.prices.E10.toFixed(1)}p</Text>
                  </View>
                )}
                {selectedStation.prices.B7 && (
                  <View>
                    <Text className="text-sm text-gray-500">Diesel</Text>
                    <Text className="font-bold">£{selectedStation.prices.B7.toFixed(1)}p</Text>
                  </View>
                )}
              </View>
            </View>
          </Mapbox.MarkerView>
        )}
      </>
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
      
      <View className="flex-1">
        <Mapbox.MapView
          ref={mapRef}
          style={{ flex: 1, minHeight: 500 }}
          styleURL="mapbox://styles/mapbox/streets-v12"
          compassEnabled={true}
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
      </View>
    </SafeAreaView>
  );
}
