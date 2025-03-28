import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, Dimensions, TouchableOpacity, StyleSheet } from 'react-native';
import { format, parseISO, subDays, subMonths, subYears, subWeeks } from 'date-fns';
import { FuelPriceService } from '../../services/FuelPriceService';
import { LineGraph } from 'react-native-graph';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface PriceHistoryGraphProps {
  siteId: string;
  fuelType: 'e10' | 'b7' | 'e5' | 'sdv';
}

type TimeRange = 'week' | 'month' | 'year';

const screenWidth = Dimensions.get('window').width - 40; // Padding on both sides

export function PriceHistoryGraph({ siteId, fuelType }: PriceHistoryGraphProps) {
  const [priceHistory, setPriceHistory] = useState<Array<{ price: number; recorded_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Use useCallback to memoize the function to prevent unnecessary rerenders
  const loadPriceHistory = useCallback(async () => {
    try {
      setLoading(true);
      // Use the FuelPriceService to fetch historical prices from Supabase
      const fuelService = FuelPriceService.getInstance();
      const history = await fuelService.getHistoricalPrices(siteId, fuelType);
      
      // Get the appropriate price history array based on fuel type
      const prices = history[fuelType];
      
      // Filter prices based on time range
      const now = new Date();
      const filterDate = timeRange === 'week' 
        ? subWeeks(now, 1)
        : timeRange === 'month'
        ? subMonths(now, 1)
        : subYears(now, 1);
      
      const filteredPrices = prices.filter(price => 
        new Date(price.recorded_at) >= filterDate
      );
      
      setPriceHistory(filteredPrices);
    } catch (err) {
      console.error('Failed to load price history:', err);
      setError('Failed to load price history');
    } finally {
      setLoading(false);
    }
  }, [siteId, fuelType, timeRange]);
  
  useEffect(() => {
    loadPriceHistory();
  }, [loadPriceHistory]);

  // Format the price for display (convert from pence to pounds if needed)
  const formatPriceForDisplay = (price: number) => {
    // If price is likely in pence (over 100), convert to pounds
    return price > 100 ? price / 100 : price;
  };
  
  // Get current price and initial price for stats
  const currentPrice = priceHistory.length > 0 
    ? formatPriceForDisplay(priceHistory[priceHistory.length - 1].price)
    : 0;
  const initialPrice = priceHistory.length > 0 
    ? formatPriceForDisplay(priceHistory[0].price)
    : 0;
  const priceDifference = currentPrice - initialPrice;
  const percentChange = initialPrice > 0 ? (priceDifference / initialPrice) * 100 : 0;
  
  const isPriceUp = priceDifference > 0;

  // Transform price history for the graph
  const graphPoints = priceHistory.map((point, index) => ({
    value: formatPriceForDisplay(point.price),
    date: new Date(point.recorded_at),
  }));

  if (loading) {
    return (
      <View className="h-[220px] justify-center items-center">
        <ActivityIndicator size="large" color="#0077FF" />
        <Text className="mt-2 text-sm text-gray-500">Loading price history...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="h-[220px] justify-center items-center bg-red-50 rounded-2xl">
        <Text className="text-red-600 text-base">{error}</Text>
        <Text className="text-red-400 text-xs mt-2">Tap to retry</Text>
      </View>
    );
  }

  if (priceHistory.length < 2) {
    return (
      <View className="h-[220px] justify-center items-center bg-gray-50 rounded-2xl p-4">
        <Text className="text-base text-gray-600 mb-2 text-center">Not enough price data available yet</Text>
        <Text className="text-sm text-gray-500 text-center">We'll show price trends as more data becomes available</Text>
      </View>
    );
  }

  const maxPrice = Math.max(...graphPoints.map(p => p.value));
  const minPrice = Math.min(...graphPoints.map(p => p.value));

  return (
    <GestureHandlerRootView style={styles.container}>
      <View className="bg-white p-4 rounded-2xl my-2 shadow-sm">
        <Text className="font-bold text-lg mb-4 text-gray-800">Price History</Text>      
        <View className="flex-row justify-between mb-4">
          <View className="flex-1">
            <Text className="text-sm text-gray-500 mb-1">Current</Text>
            <Text className="text-lg font-bold">
              £{selectedPrice !== null ? selectedPrice.toFixed(2) : currentPrice.toFixed(2)}
            </Text>
            {selectedDate && (
              <Text className="text-sm text-gray-500 mt-1">
                {format(selectedDate, 'd MMM yyyy')}
              </Text>
            )}
          </View>
          
          <View className="flex-1">
            <Text className="text-sm text-gray-500 mb-1">Change</Text>
            <Text className={`text-lg font-bold ${isPriceUp ? 'text-red-500' : 'text-green-500'}`}>
              {isPriceUp ? '+' : ''}{priceDifference.toFixed(2)} ({isPriceUp ? '+' : ''}{percentChange.toFixed(1)}%)
            </Text>
          </View>
        </View>
        
        {/* Interactive price graph */}
        <View style={styles.graphContainer}>
          <LineGraph
            points={graphPoints}
            animated={true}
            color="#0077FF"
            style={styles.graph}
            enablePanGesture={true}
            onPointSelected={(point) => {
              console.log('Point selected:', point);
              setSelectedPrice(point.value);
              setSelectedDate(point.date);
            }}
            onGestureEnd={() => {
              console.log('Gesture ended');
              setSelectedPrice(null);
              setSelectedDate(null);
            }}
            TopAxisLabel={() => (
              <Text style={styles.axisLabel}>
                £{maxPrice.toFixed(2)}
              </Text>
            )}
            BottomAxisLabel={() => (
              <Text style={styles.axisLabel}>
                £{minPrice.toFixed(2)}
              </Text>
            )}
          />
        </View>

        {/* Time range selector */}
        <View className="flex-row justify-between mt-4">
          {(['week', 'month', 'year'] as TimeRange[]).map((range) => (
            <TouchableOpacity
              key={range}
              onPress={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-full ${
                timeRange === range ? 'bg-red-500' : 'bg-red-100'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  timeRange === range ? 'text-white' : 'text-red-600'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  graphContainer: {
    height: 220,
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
  },
  graph: {
    width: screenWidth,
    height: 220,
  },
  axisLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
}); 