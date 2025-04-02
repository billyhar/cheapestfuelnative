import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, Dimensions, TouchableOpacity, StyleSheet } from 'react-native';
import { 
  format, 
  parseISO, 
  subDays, 
  subMonths, 
  subYears, 
  subWeeks,
  addDays,
  addMonths,
  differenceInDays,
  differenceInMonths
} from 'date-fns';
import { FuelPriceService } from '../../services/FuelPriceService';
import { LineGraph } from 'react-native-graph';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface PriceHistoryGraphProps {
  siteId: string;
  fuelType: 'e10' | 'b7' | 'e5' | 'sdv';
}

type TimeRange = 'week' | 'month' | 'year' | 'all';

const screenWidth = Dimensions.get('window').width - 32; // Reduced side padding

// Add this interface near the top of the file
interface GraphPoint {
  value: number;
  date: Date;
}

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
      let filterDate = now;
      
      switch(timeRange) {
        case 'week':
          filterDate = subWeeks(now, 1);
          break;
        case 'month':
          filterDate = subMonths(now, 1);
          break;
        case 'year':
          filterDate = subYears(now, 1);
          break;
        case 'all':
          // Don't filter by date for 'all'
          setPriceHistory(prices);
          return;
      }
      
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

  // Calculate the reference price based on time range
  const getReferencePrice = () => {
    if (priceHistory.length === 0) return 0;
    
    const now = new Date();
    let referenceDate;
    
    switch(timeRange) {
      case 'week':
        referenceDate = subWeeks(now, 1);
        break;
      case 'month':
        referenceDate = subMonths(now, 1);
        break;
      case 'year':
        referenceDate = subYears(now, 1);
        break;
      case 'all':
        return formatPriceForDisplay(priceHistory[0].price);
    }
    
    // Find the closest price point before the reference date
    for (let i = priceHistory.length - 1; i >= 0; i--) {
      const priceDate = new Date(priceHistory[i].recorded_at);
      if (priceDate <= referenceDate) {
        return formatPriceForDisplay(priceHistory[i].price);
      }
    }
    
    // If no price found before reference date, use the oldest available price
    return formatPriceForDisplay(priceHistory[0].price);
  };

  // Update the graphPoints transformation to ensure we have a point for each day
  const graphPoints = useMemo((): GraphPoint[] => {
    if (priceHistory.length === 0) return [];

    // For week view, ensure we have all 7 days
    if (timeRange === 'week') {
      const endDate = new Date(priceHistory[priceHistory.length - 1].recorded_at);
      const startDate = subDays(endDate, 6);
      const dailyPoints: GraphPoint[] = [];
      
      // Create array of 7 days
      for (let i = 0; i <= 6; i++) {
        const currentDate = addDays(startDate, i);
        // Find the price for this day
        const priceForDay = priceHistory.find(p => 
          format(new Date(p.recorded_at), 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd')
        );
        
        // If we have a price for this day, use it
        // Otherwise, use the last known price
        const price = priceForDay 
          ? formatPriceForDisplay(priceForDay.price)
          : dailyPoints[dailyPoints.length - 1]?.value || formatPriceForDisplay(priceHistory[0].price);
        
        dailyPoints.push({
          value: price,
          date: currentDate
        });
      }
      return dailyPoints;
    }

    // For other views, use the existing points
    return priceHistory.map(point => ({
      value: formatPriceForDisplay(point.price),
      date: new Date(point.recorded_at)
    }));
  }, [priceHistory, timeRange]);

  // Add this helper function after the component imports
  const getVerticalGridLines = (timeRange: TimeRange, startDate: Date, endDate: Date) => {
    const lines: Date[] = [];
    
    switch(timeRange) {
      case 'week':
        // Create 7 evenly spaced lines for each day
        for (let i = 0; i <= 6; i++) {
          lines.push(subDays(endDate, 6 - i));
        }
        break;
      case 'month':
        // Create lines for each day (30/31 lines)
        const daysInRange = differenceInDays(endDate, startDate);
        for (let i = 0; i <= daysInRange; i++) {
          lines.push(addDays(startDate, i));
        }
        break;
      case 'year':
        // Create 12 lines for each month
        for (let i = 0; i <= 11; i++) {
          lines.push(addMonths(startDate, i));
        }
        break;
      case 'all':
        // Create lines for each month in the range
        const monthsInRange = differenceInMonths(endDate, startDate);
        for (let i = 0; i <= monthsInRange; i++) {
          lines.push(addMonths(startDate, i));
        }
        break;
    }
    return lines;
  };

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

  // Update the price buffer calculation to make changes even more visible
  const maxPrice = Math.max(...graphPoints.map(p => p.value));
  const minPrice = Math.min(...graphPoints.map(p => p.value));
  const graphPriceDifference = maxPrice - minPrice;

  // If the price difference is very small (less than 5p), create an artificial range
  const minPriceDifference = 0.05; // 5 pence minimum difference
  const effectivePriceDifference = Math.max(graphPriceDifference, minPriceDifference);

  // Calculate the midpoint of the price range
  const midPrice = (maxPrice + minPrice) / 2;

  // Create an expanded range around the midpoint
  const expandedMax = midPrice + (effectivePriceDifference / 2);
  const expandedMin = midPrice - (effectivePriceDifference / 2);

  // Keep the reference price difference calculation separate
  const referencePrice = getReferencePrice();
  const referencePriceDifference = currentPrice - referencePrice;
  const percentChange = referencePrice > 0 ? (referencePriceDifference / referencePrice) * 100 : 0;
  const isPriceUp = referencePriceDifference > 0;

  return (
    <GestureHandlerRootView style={styles.container}>
      <View className="bg-white p-4 rounded-2xl my-2 shadow-sm">
        <Text className="font-bold text-lg mb-4 text-gray-800">Price History</Text>      
        <View className="flex-row justify-between mb-4">
          <View className="flex-1">
            <Text className="text-sm text-gray-500 mb-1">Current</Text>
            <Text className="text-xl font-bold">
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
              {isPriceUp ? '+' : ''}{referencePriceDifference.toFixed(2)} ({isPriceUp ? '+' : ''}{percentChange.toFixed(1)}%)
            </Text>
          </View>
        </View>
        
        {/* Interactive price graph */}
        <View style={styles.graphWrapper}>
          <View style={styles.gridContainer}>
            {/* Horizontal grid lines aligned with price scale */}
            {Array.from({ length: 3 }).map((_, i) => (
              <View 
                key={`h-${i}`} 
                style={[
                  styles.horizontalGrid,
                  { bottom: `${((i + 1) / 3) * 100}%` }
                ]}
              />
            ))}
            
            {/* Vertical grid lines */}
            {timeRange === 'week' && graphPoints.map((_, i) => (
              <View
                key={`v-${i}`}
                style={[
                  styles.verticalGrid,
                  {
                    left: `${(i / 6) * 100}%`,
                  }
                ]}
              />
            ))}
          </View>
          
          <View style={styles.graphContainer}>
            <LineGraph
              points={graphPoints}
              animated={true}
              color="#EF4444"
              style={styles.graph}
              enablePanGesture={true}
              panGestureDelay={0}
              lineThickness={2}
              selectionDotShadowColor="rgba(239, 68, 68, 0.3)"
              gradientFillColors={[
                'rgba(239, 68, 68, 0.2)',
                'rgba(239, 68, 68, 0.05)'
              ]}
              range={{
                y: {
                  min: expandedMin,
                  max: expandedMax
                }
              }}
              verticalPadding={5} // Even less padding to maximize graph height
              onPointSelected={(point) => {
                setSelectedPrice(point.value);
                setSelectedDate(point.date);
              }}
              onGestureEnd={() => {
                if (priceHistory.length > 0) {
                  const latestPrice = priceHistory[priceHistory.length - 1];
                  setSelectedPrice(formatPriceForDisplay(latestPrice.price));
                  setSelectedDate(new Date(latestPrice.recorded_at));
                }
              }}
              TopAxisLabel={() => (
                <Text style={styles.axisLabel}>
                  £{expandedMax.toFixed(2)}
                </Text>
              )}
              BottomAxisLabel={() => (
                <Text style={styles.axisLabel}>
                  £{expandedMin.toFixed(2)}
                </Text>
              )}
            />
          </View>
        </View>

        {/* Time range buttons */}
        <View className="flex-row justify-between mt-4">
          {(['week', 'month', 'year', 'all'] as TimeRange[]).map((range) => (
            <TouchableOpacity
              key={range}
              onPress={() => {
                setTimeRange(range);
              }}
              activeOpacity={0.7}
              className={`px-4 py-2 rounded-full ${
                timeRange === range ? 'bg-red-500' : 'bg-red-100'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  timeRange === range ? 'text-white' : 'text-red-600'
                }`}
              >
                {range === 'week' ? '1W' : 
                 range === 'month' ? '1M' : 
                 range === 'year' ? '1Y' : 
                 'All'}
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
  graphWrapper: {
    height: 220,
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  gridContainer: {
    position: 'absolute',
    top: 20, // Match the graphContainer padding
    left: 8, // Match the graphContainer padding
    right: 8, // Match the graphContainer padding
    bottom: 20, // Match the graphContainer padding
    justifyContent: 'space-between',
  },
  horizontalGrid: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(229, 231, 235, 0.5)',
  },
  graphContainer: {
    height: '100%',
    paddingHorizontal: 8,
    paddingVertical: 20,
  },
  graph: {
    width: screenWidth - 16,
    height: 180,
  },
  axisLabel: {
    fontSize: 12,
    color: '#6B7280',
    paddingHorizontal: 4,
  },
  verticalGrid: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(229, 231, 235, 0.5)',
  },
}); 