import { StyleSheet, View, SafeAreaView, RefreshControl, ActivityIndicator, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { AppTheme } from '../../constants/BrandAssets';
import FuelStatsCards from '../../components/FuelStatsCards';
import { useState, useEffect, useCallback } from 'react';
import { FuelPriceService, FuelStation } from '../../services/FuelPriceService';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ensureSupabaseInitialized } from '../../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, '(tabs)'>;

export default function StatsScreen({ navigation }: Props) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    fuelStations: [] as FuelStation[],
    cheapestUK: {
      price: 0,
      station: '',
      location: '',
      fuelType: 'E10' as 'E10' | 'B7',
      stationData: null as FuelStation | null,
      lastUpdated: new Date(),
    },
    averagePrice: {
      E10: 0,
      B7: 0,
    },
    cityPrices: [] as {
      city: string;
      cheapestE10: number;
      cheapestB7: number;
      lastUpdated: Date;
    }[],
  });

  // Initialize Supabase when component mounts
  useEffect(() => {
    const initSupabase = async () => {
      try {
        console.log('[Stats] Initializing Supabase...');
        await ensureSupabaseInitialized();
        console.log('[Stats] Supabase initialized successfully');
        fetchStats();
      } catch (error) {
        console.error('[Stats] Failed to initialize Supabase:', error);
        setError('Failed to initialize. Please try again');
        setIsLoading(false);
      }
    };
    
    initSupabase();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats().finally(() => setRefreshing(false));
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('[Stats] Fetching fuel prices...');
      const service = FuelPriceService.getInstance();
      const stations = await service.fetchFuelPrices();
      console.log(`[Stats] Successfully fetched ${stations.length} stations`);

      // Calculate statistics
      const cityMap = new Map<string, { E10: number[], B7: number[] }>();
      let totalE10 = 0;
      let totalB7 = 0;
      let countE10 = 0;
      let countB7 = 0;

      const getRegionName = (postcode: string) => {
        const prefix = postcode.substring(0, 2);
        const regions: { [key: string]: string } = {
          'AB': 'Aberdeen',
          'B': 'Birmingham',
          'BA': 'Bath',
          'BN': 'Brighton',
          'BR': 'Bromley',
          'BS': 'Bristol',
          'CB': 'Cambridge',
          'CF': 'Cardiff',
          'CH': 'Chester',
          'CM': 'Chelmsford',
          'CR': 'Croydon',
          'CT': 'Canterbury',
          'CV': 'Coventry',
          'DA': 'Dartford',
          'DD': 'Dundee',
          'DE': 'Derby',
          'DH': 'Durham',
          'DL': 'Darlington',
          'DN': 'Doncaster',
          'EH': 'Edinburgh',
          'EN': 'Enfield',
          'G': 'Glasgow',
          'GL': 'Gloucester',
          'GU': 'Guildford',
          'HA': 'Harrow',
          'HD': 'Huddersfield',
          'HG': 'Harrogate',
          'HP': 'Hemel Hempstead',
          'HR': 'Hereford',
          'IG': 'Ilford',
          'IP': 'Ipswich',
          'KT': 'Kingston',
          'L': 'Liverpool',
          'LA': 'Lancaster',
          'LE': 'Leicester',
          'LS': 'Leeds',
          'LU': 'Luton',
          'M': 'Manchester',
          'ME': 'Medway',
          'MK': 'Milton Keynes',
          'N': 'North London',
          'NE': 'Newcastle',
          'NG': 'Nottingham',
          'NN': 'Northampton',
          'NW': 'North West London',
          'OX': 'Oxford',
          'PE': 'Peterborough',
          'PO': 'Portsmouth',
          'RG': 'Reading',
          'RH': 'Redhill',
          'RM': 'Romford',
          'S': 'Sheffield',
          'SE': 'South East London',
          'SG': 'Stevenage',
          'SK': 'Stockport',
          'SL': 'Slough',
          'SM': 'Sutton',
          'SN': 'Swindon',
          'SO': 'Southampton',
          'SP': 'Salisbury',
          'SR': 'Sunderland',
          'SS': 'Southend',
          'ST': 'Stoke',
          'SW': 'South West London',
          'TN': 'Tonbridge',
          'TW': 'Twickenham',
          'UB': 'Uxbridge',
          'W': 'West London',
          'WA': 'Warrington',
          'WC': 'Central London',
          'WD': 'Watford',
          'WF': 'Wakefield',
          'WN': 'Wigan',
          'WR': 'Worcester',
          'WS': 'Walsall',
          'WV': 'Wolverhampton',
          'YO': 'York',
        };
        return regions[prefix] || 'Other';
      };

      stations.forEach(station => {
        // Get region from postcode (first two characters)
        const prefix = station.postcode.substring(0, 2);
        const region = getRegionName(prefix);
        
        if (!cityMap.has(region)) {
          cityMap.set(region, { E10: [], B7: [] });
        }

        if (station.prices.E10) {
          cityMap.get(region)?.E10.push(station.prices.E10);
          totalE10 += station.prices.E10;
          countE10++;
        }
        if (station.prices.B7) {
          cityMap.get(region)?.B7.push(station.prices.B7);
          totalB7 += station.prices.B7;
          countB7++;
        }
      });

      // Find cheapest station
      let cheapestStation: FuelStation | null = null;
      let cheapestPrice = Infinity;
      let cheapestFuelType: 'E10' | 'B7' = 'E10';

      for (const station of stations) {
        if (station.prices.E10 && station.prices.E10 < cheapestPrice) {
          cheapestPrice = station.prices.E10;
          cheapestStation = station;
          cheapestFuelType = 'E10';
        }
        if (station.prices.B7 && station.prices.B7 < cheapestPrice) {
          cheapestPrice = station.prices.B7;
          cheapestStation = station;
          cheapestFuelType = 'B7';
        }
      }

      // Convert city map to array and find cheapest prices
      const cityPrices = Array.from(cityMap.entries())
        .map(([city, prices]) => ({
          city,
          cheapestE10: prices.E10.length > 0 ? Math.min(...prices.E10) : 0,
          cheapestB7: prices.B7.length > 0 ? Math.min(...prices.B7) : 0,
          lastUpdated: new Date(),
        }))
        .filter(city => city.cheapestE10 > 0 || city.cheapestB7 > 0);
      
      setStats({
        fuelStations: stations,
        cheapestUK: {
          price: cheapestPrice !== Infinity ? cheapestPrice : 0,
          station: cheapestStation ? cheapestStation.brand : '',
          location: cheapestStation ? cheapestStation.address : '',
          fuelType: cheapestFuelType,
          stationData: cheapestStation,
          lastUpdated: new Date(cheapestStation?.last_updated || new Date()),
        },
        averagePrice: {
          E10: countE10 > 0 ? Math.round(totalE10 / countE10) : 0,
          B7: countB7 > 0 ? Math.round(totalB7 / countB7) : 0,
        },
        cityPrices,
      });
    } catch (error) {
      console.error('[Stats] Error fetching fuel prices:', error);
      setError('Failed to load fuel prices. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStationSelect = (station: FuelStation) => {
    router.push({
      pathname: '/(modals)/station-details',
      params: { station: JSON.stringify(station) }
    });
  };

  const retryFetch = () => {
    setError(null);
    fetchStats();
  };

  if (error) {
    return (
      <SafeAreaView style={[
        styles.container,
        colorScheme === 'dark' && styles.containerDark
      ]}>
        <StatusBar style={colorScheme === 'dark' ? "light" : "dark"} />
        <View style={styles.errorContainer}>
          <Text style={[
            styles.errorText,
            colorScheme === 'dark' && styles.textDark
          ]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retryFetch}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container,
      colorScheme === 'dark' && styles.containerDark
    ]}>
      <StatusBar style={colorScheme === 'dark' ? "light" : "dark"} />
      {isLoading && !refreshing ? (
        <View style={[
          styles.loadingContainer,
          colorScheme === 'dark' && styles.containerDark
        ]}>
          <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#60A5FA' : AppTheme.colors.primary} />
        </View>
      ) : (
        <FuelStatsCards 
          stats={stats} 
          onStationSelect={handleStationSelect}
          colorScheme={colorScheme}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colorScheme === 'dark' ? '#60A5FA' : AppTheme.colors.primary]}
              tintColor={colorScheme === 'dark' ? '#60A5FA' : AppTheme.colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: AppTheme.colors.error || 'red',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  textDark: {
    color: '#F3F4F6',
  },
  retryButton: {
    backgroundColor: AppTheme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
