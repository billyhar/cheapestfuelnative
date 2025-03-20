import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Pressable, StyleSheet, RefreshControl, Linking } from 'react-native';
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

const FuelStatsCards: React.FC<FuelStatsCardsProps> = ({ stats, onStationSelect, refreshControl }) => {
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
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      onScrollBeginDrag={() => setIsPulling(true)}
      onScrollEndDrag={() => setIsPulling(false)}
    >
      {isPulling && (
        <Text style={styles.lastUpdatedText}>
          Last updated {formatTimeAgo(lastUpdated)}
        </Text>
      )}

      {/* Fuel Type Selector */}
      <View style={styles.fuelTypeContainer}>
        <TouchableOpacity 
          style={[styles.fuelTypeButton, selectedFuelType === 'E10' && styles.selectedFuelType]}
          onPress={() => setSelectedFuelType('E10')}
        >
          <Ionicons 
            name="water-outline" 
            size={18} 
            color={selectedFuelType === 'E10' ? AppTheme.colors.primary : '#6B7280'} 
          />
          <Text style={[styles.fuelTypeText, selectedFuelType === 'E10' && styles.selectedFuelTypeText]}>
            Petrol (E10)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.fuelTypeButton, selectedFuelType === 'B7' && styles.selectedFuelType]}
          onPress={() => setSelectedFuelType('B7')}
        >
          <Ionicons 
            name="water" 
            size={18} 
            color={selectedFuelType === 'B7' ? AppTheme.colors.primary : '#6B7280'} 
          />
          <Text style={[styles.fuelTypeText, selectedFuelType === 'B7' && styles.selectedFuelTypeText]}>
            Diesel (B7)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Nearby Stations Card */}
      {userLocation && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Nearby Stations</Text>
            <View style={styles.cardHeaderActions}>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={async () => {
                  const location = await Location.getCurrentPositionAsync({});
                  setUserLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                  });
                }}
              >
                <Ionicons name="refresh" size={20} color={AppTheme.colors.primary} />
              </TouchableOpacity>
              <View style={styles.radiusSelector}>
                {[2, 5, 10].map(radius => (
                  <TouchableOpacity
                    key={radius}
                    style={[
                      styles.radiusButton,
                      selectedRadius === radius && styles.selectedRadiusButton
                    ]}
                    onPress={() => setSelectedRadius(radius)}
                  >
                    <Text style={[
                      styles.radiusButtonText,
                      selectedRadius === radius && styles.selectedRadiusButtonText
                    ]}>
                      {radius}km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {getNearbyStations().map((station, index) => (
            <TouchableOpacity
              key={station.site_id}
              style={styles.nearbyStationItem}
              onPress={() => onStationSelect(station)}
            >
              <Image 
                source={BrandLogos[station.brand] || require('../assets/default-fuel-logo.png')}
                style={styles.nearbyStationLogo}
                resizeMode="contain"
              />
              <View style={styles.nearbyStationDetails}>
                <Text style={styles.nearbyStationName}>{station.brand}</Text>
                <Text style={styles.nearbyStationAddress} numberOfLines={1}>{station.address}</Text>
                <Text style={styles.nearbyStationDistance}>
                  {station.distance.toFixed(1)}km away
                </Text>
              </View>
              <View style={styles.nearbyStationPrice}>
                <Text style={styles.nearbyStationPriceValue}>
                  {formatPrice(selectedFuelType === 'E10' ? station.prices.E10! : station.prices.B7!)}
                </Text>
                <TouchableOpacity 
                  style={styles.directionsButtonSmall}
                  onPress={() => openDirections(station)}
                >
                  <Ionicons name="navigate" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* National Average Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>National Average</Text>
        <View style={styles.averagePriceContainer}>
          <View style={styles.averagePriceBox}>
            <Text style={styles.averagePriceLabel}>
              {selectedFuelType === 'E10' ? 'Petrol (E10)' : 'Diesel (B7)'}
            </Text>
            <Text style={styles.averagePriceValue}>
              {formatPrice(selectedFuelType === 'E10' ? stats.averagePrice.E10 : stats.averagePrice.B7)}
            </Text>
          </View>
        </View>
      </View>

      {/* Top 50 Stations Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top 50 Cheapest Stations</Text>
        <View style={[styles.top50Container, !showAllTop50 && styles.top50ContainerCollapsed]}>
          {getTop50Stations().map((station, index) => (
            <TouchableOpacity
              key={station.site_id}
              style={[
                styles.top50Item,
                index === 0 && styles.top50HeroItem
              ]}
              onPress={() => onStationSelect(station)}
            >
              {index === 0 ? (
                <>
                  <View style={styles.top50HeroContent}>
                    <View style={styles.top50HeroHeader}>
                      <View style={styles.top50HeroRank}>
                        <Text style={styles.top50HeroRankText}>#1</Text>
                      </View>
                      <Image 
                        source={BrandLogos[station.brand] || require('../assets/default-fuel-logo.png')}
                        style={styles.top50HeroLogo}
                        resizeMode="contain"
                      />
                      <View style={styles.top50HeroDetails}>
                        <Text style={styles.top50HeroName}>{station.brand}</Text>
                        <Text style={styles.top50HeroAddress} numberOfLines={1}>{station.address}</Text>
                      </View>
                    </View>
                    <View style={styles.top50HeroPrice}>
                      <View style={styles.top50HeroPriceBox}>
                        <Text style={styles.top50HeroPriceLabel}>Price</Text>
                        <Text style={styles.top50HeroPriceValue}>
                          {formatPrice(station.price)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.top50Rank}>
                    <Text style={styles.top50RankText}>#{index + 1}</Text>
                  </View>
                  <Image 
                    source={BrandLogos[station.brand] || require('../assets/default-fuel-logo.png')}
                    style={styles.top50Logo}
                    resizeMode="contain"
                  />
                  <View style={styles.top50Details}>
                    <Text style={styles.top50Name}>{station.brand}</Text>
                    <Text style={styles.top50Address} numberOfLines={1}>{station.address}</Text>
                  </View>
                  <View style={styles.top50Price}>
                    <Text style={styles.top50PriceValue}>
                      {formatPrice(station.price)}
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          ))}
          {!showAllTop50 && <View style={styles.gradientOverlay} />}
        </View>
        <TouchableOpacity 
          style={styles.showMoreButton}
          onPress={() => setShowAllTop50(!showAllTop50)}
        >
          <Text style={styles.showMoreText}>
            {showAllTop50 ? 'Show Less' : 'Show More'}
          </Text>
          <Ionicons 
            name={showAllTop50 ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color={AppTheme.colors.primary} 
          />
        </TouchableOpacity>
      </View>

      {/* Region Selector Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cheapest regions</Text>
        
        <View style={[styles.regionListContainer, !showAllRegions && styles.regionListCollapsed]}>
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
                style={[
                  styles.regionItem,
                  index === 0 && styles.regionHeroItem
                ]}
              >
                {index === 0 ? (
                  <>
                    <View style={styles.regionHeroContent}>
                      <View style={styles.regionHeroHeader}>
                        <View style={styles.regionHeroRank}>
                          <Text style={styles.regionHeroRankText}>#1</Text>
                        </View>
                        <View style={styles.regionHeroDetails}>
                          <Text style={styles.regionHeroName}>{city.city}</Text>
                        </View>
                      </View>
                      <View style={styles.regionHeroPrice}>
                        <View style={styles.regionHeroPriceBox}>
                          <Text style={styles.regionHeroPriceLabel}>Price</Text>
                          <Text style={styles.regionHeroPriceValue}>
                            {formatPrice(selectedFuelType === 'E10' ? city.cheapestE10 : city.cheapestB7)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.regionRank}>
                      <Text style={styles.regionRankText}>#{index + 1}</Text>
                    </View>
                    <Text style={styles.regionItemName}>{city.city}</Text>
                    <View style={styles.regionItemPrices}>
                      <Text style={styles.regionItemPrice}>
                        {formatPrice(selectedFuelType === 'E10' ? city.cheapestE10 : city.cheapestB7)}
                      </Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>
            ))}
          {!showAllRegions && <View style={styles.gradientOverlay} />}
        </View>

        <TouchableOpacity 
          style={styles.showMoreButton}
          onPress={() => setShowAllRegions(!showAllRegions)}
        >
          <Text style={styles.showMoreText}>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Region</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton} 
                onPress={() => setShowRegionPicker(false)}
              >
                <Ionicons name="close" size={24} color={AppTheme.colors.primary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.regionListContainer}>
              {stats.cityPrices
                .sort((a, b) => a.city.localeCompare(b.city))
                .map((city) => (
                  <Pressable
                    key={city.city}
                    style={[
                      styles.regionItem,
                      selectedRegion?.city === city.city && styles.selectedRegionItem
                    ]}
                    onPress={() => {
                      setSelectedRegion(city);
                      setShowRegionPicker(false);
                    }}
                  >
                    <Text style={styles.regionItemName}>{city.city}</Text>
                    <View style={styles.regionItemPrices}>
                      <Text style={styles.regionItemPrice}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  fuelTypeContainer: {
    flexDirection: 'row',
    backgroundColor: AppTheme.colors.card,
    borderRadius: 12,
    marginBottom: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  fuelTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  selectedFuelType: {
    backgroundColor: `${AppTheme.colors.primary}10`,
  },
  fuelTypeText: {
    fontWeight: '600',
    marginLeft: 6,
    color: '#6B7280',
  },
  selectedFuelTypeText: {
    color: AppTheme.colors.primary,
  },
  card: {
    backgroundColor: AppTheme.colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppTheme.colors.primary,
    marginRight: 2,
  },
  stationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stationLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
  },
  stationDetails: {
    flex: 1,
  },
  stationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  stationAddress: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  priceBox: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: AppTheme.colors.primary,
  },
  savingsBox: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
  },
  savingsLabel: {
    fontSize: 14,
    color: '#065F46',
    marginBottom: 4,
  },
  savingsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  averagePriceContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  averagePriceBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  averagePriceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  averagePriceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  fuelTypeSmall: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  regionName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  regionPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  regionPriceBox: {
    flex: 1,
  },
  regionPriceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: AppTheme.colors.primary,
    marginBottom: 4,
  },
  regionPriceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  findNearbyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  findNearbyText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginRight: 6,
  },
  noRegionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: AppTheme.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalCloseButton: {
    padding: 4,
  },
  regionListContainer: {
    marginTop: 8,
  },
  regionListCollapsed: {
    maxHeight: 300,
    overflow: 'hidden',
  },
  selectedRegionDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  regionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  selectedRegionItem: {
    backgroundColor: '#F0F9FF',
  },
  regionItemName: {
    fontSize: 16,
    color: '#1F2937',
  },
  regionItemPrices: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  regionItemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: AppTheme.colors.primary,
    marginRight: 8,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.colors.primary,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  directionsButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 6,
  },
  directionsButtonSmall: {
    backgroundColor: AppTheme.colors.primary,
    padding: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  radiusSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  radiusButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  selectedRadiusButton: {
    backgroundColor: AppTheme.colors.primary,
  },
  radiusButtonText: {
    fontSize: 12,
    color: '#6B7280',
  },
  selectedRadiusButtonText: {
    color: '#FFFFFF',
  },
  nearbyStationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  nearbyStationLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  nearbyStationDetails: {
    flex: 1,
  },
  nearbyStationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  nearbyStationAddress: {
    fontSize: 12,
    color: '#6B7280',
  },
  nearbyStationDistance: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  nearbyStationPrice: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nearbyStationPriceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: AppTheme.colors.primary,
  },
  top50Container: {
    marginTop: 12,
  },
  top50ContainerCollapsed: {
    maxHeight: 500,
    overflow: 'hidden',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: AppTheme.colors.card,
    opacity: 0.8,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppTheme.colors.primary,
    marginRight: 4,
  },
  top50Item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  top50Rank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  top50RankText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  top50Logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  top50Details: {
    flex: 1,
  },
  top50Name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  top50Address: {
    fontSize: 12,
    color: '#6B7280',
  },
  top50Price: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  top50PriceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: AppTheme.colors.primary,
  },
  top50HeroItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 8,
    padding: 16,
  },
  top50HeroContent: {
    width: '100%',
  },
  top50HeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  top50HeroRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  top50HeroRankText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  top50HeroLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  top50HeroDetails: {
    flex: 1,
  },
  top50HeroName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  top50HeroAddress: {
    fontSize: 14,
    color: '#6B7280',
  },
  top50HeroPrice: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  top50HeroPriceBox: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  top50HeroPriceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  top50HeroPriceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: AppTheme.colors.primary,
  },
  regionHeroItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 8,
    padding: 16,
  },
  regionHeroContent: {
    width: '100%',
  },
  regionHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  regionHeroRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  regionHeroRankText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  regionHeroDetails: {
    flex: 1,
  },
  regionHeroName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  regionHeroPrice: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  regionHeroPriceBox: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  regionHeroPriceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  regionHeroPriceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: AppTheme.colors.primary,
  },
  regionRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  regionRankText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
});

export default FuelStatsCards; 