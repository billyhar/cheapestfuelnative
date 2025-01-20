import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import axios from 'axios';

// Initialize Mapbox configuration
Mapbox.setWellKnownTileServer('mapbox');
Mapbox.setAccessToken('pk.eyJ1IjoiY2hvbmthbW9ua2EiLCJhIjoiY201OXM3ZHI3MDRhaTJqczZwNGdqcjUyMCJ9.5s5gHVZdgIyswhtkFYbevQ');

interface FuelPrices {
  B7?: number;  // Diesel
  E10?: number; // Regular unleaded
  E5?: number;  // Premium unleaded
  SDV?: number; // Super diesel
}

interface FuelStation {
  address: string;
  brand: string;
  location: {
    latitude: number;
    longitude: number;
  };
  postcode: string;
  prices: FuelPrices;
  site_id: string;
}

interface APIResponse {
  last_updated?: string;
  stations: FuelStation[];
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
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<FuelStation | null>(null);
  const mapRef = useRef<Mapbox.MapView | null>(null);
  const [priceStats, setPriceStats] = useState<{
    E10: { min: number; max: number };
    B7: { min: number; max: number };
  }>({
    E10: { min: 0, max: 0 },
    B7: { min: 0, max: 0 }
  });

  useEffect(() => {
    const fetchFuelPrices = async () => {
      try {
        const response = await axios.get<APIResponse>('https://storelocator.asda.com/fuel_prices_data.json', {
          timeout: 5000
        });
        
        if (response.data?.stations && Array.isArray(response.data.stations)) {
          const stations = response.data.stations.filter(station => 
            station &&
            station.location &&
            typeof station.location.latitude === 'number' &&
            typeof station.location.longitude === 'number'
          );
          
          // Calculate price statistics
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
          
          setFuelStations(stations);
          if (response.data.last_updated) {
            setLastUpdated(response.data.last_updated);
          }
        } else {
          console.log('Invalid response structure:', response.data);
          setError('Invalid data format received from API');
        }
      } catch (error: any) {
        console.error('Error details:', error.response || error);
        setError(error.message || 'Failed to fetch fuel prices');
      }
    };

    fetchFuelPrices();
  }, []);

  const getPriceColor = (prices: FuelPrices): string => {
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
    return price ? `${price}p` : 'N/A';
  };

  const renderAnnotations = () => {
    const seenIds = new Set<string>();
    
    return fuelStations
      .filter(station => {
        if (seenIds.has(station.site_id)) {
          return false;
        }
        seenIds.add(station.site_id);
        return true;
      })
      .map((station) => (
        <Mapbox.MarkerView
          key={`${station.site_id}-${station.location.latitude}-${station.location.longitude}`}
          coordinate={[station.location.longitude, station.location.latitude]}
        >
          <TouchableOpacity
            onPress={() => setSelectedStation(station)}
            style={[styles.marker, { backgroundColor: getPriceColor(station.prices) }]}
          >
            <Text style={styles.markerText}>£</Text>
          </TouchableOpacity>
        </Mapbox.MarkerView>
      ));
  };

  const renderLegend = () => (
    <View style={styles.legend}>
      <View style={styles.legendRow}>
        <View style={[styles.legendMarker, { backgroundColor: '#4CAF50' }]} />
        <Text style={styles.legendText}>Cheap (E10 ≤ 135p, Diesel ≤ 140p)</Text>
      </View>
      <View style={styles.legendRow}>
        <View style={[styles.legendMarker, { backgroundColor: '#FFA726' }]} />
        <Text style={styles.legendText}>Average</Text>
      </View>
      <View style={styles.legendRow}>
        <View style={[styles.legendMarker, { backgroundColor: '#F44336' }]} />
        <Text style={styles.legendText}>Expensive (E10 ≥ 145p, Diesel ≥ 150p)</Text>
      </View>
    </View>
  );

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {lastUpdated && (
        <View style={styles.header}>
          <Text style={styles.headerText}>Last Updated: {lastUpdated}</Text>
          <Text style={styles.headerText}>
            E10: {formatPrice(priceStats.E10.min)} - {formatPrice(priceStats.E10.max)} | 
            Diesel: {formatPrice(priceStats.B7.min)} - {formatPrice(priceStats.B7.max)}
          </Text>
        </View>
      )}
      <View style={styles.mapContainer}>
        <Mapbox.MapView
          ref={mapRef}
          style={styles.map}
          styleURL="mapbox://styles/mapbox/streets-v12"
          compassEnabled={true}
          zoomEnabled={true}
          scrollEnabled={true}
          rotateEnabled={true}
        >
          <Mapbox.Camera
            defaultSettings={{
              centerCoordinate: [-1.4868, 52.3914], // Coventry coordinates
              zoomLevel: 9
            }}
          />
          {renderAnnotations()}
        </Mapbox.MapView>
        {renderLegend()}
        {selectedStation && (
          <View style={styles.stationInfo}>
            <View style={styles.stationHeader}>
              <Text style={styles.stationName}>{selectedStation.brand}</Text>
              <TouchableOpacity onPress={() => setSelectedStation(null)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.stationAddress}>{selectedStation.address}</Text>
            <Text style={styles.stationPostcode}>{selectedStation.postcode}</Text>
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>E10: {formatPrice(selectedStation.prices.E10)}</Text>
              <Text style={styles.priceText}>Diesel: {formatPrice(selectedStation.prices.B7)}</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  header: {
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  },
  marker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'red',
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  legend: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  legendMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'white',
  },
  legendText: {
    fontSize: 12,
    color: '#333',
  },
  stationInfo: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    left: 20,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  stationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
    padding: 4,
  },
  stationAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  stationPostcode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});
