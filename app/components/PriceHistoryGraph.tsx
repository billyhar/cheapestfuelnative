import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { format, parseISO } from 'date-fns';
import { FuelPriceService } from '../../services/FuelPriceService';

interface PriceHistoryGraphProps {
  siteId: string;
  fuelType: 'e10' | 'b7' | 'e5' | 'sdv';
}

const screenWidth = Dimensions.get('window').width - 40; // Padding on both sides

export function PriceHistoryGraph({ siteId, fuelType }: PriceHistoryGraphProps) {
  const [priceHistory, setPriceHistory] = useState<Array<{ price: number; recorded_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use useCallback to memoize the function to prevent unnecessary rerenders
  const loadPriceHistory = useCallback(async () => {
    try {
      setLoading(true);
      // Use the FuelPriceService to fetch historical prices from Supabase
      const fuelService = FuelPriceService.getInstance();
      const history = await fuelService.getHistoricalPrices(siteId, fuelType);
      
      // Get the appropriate price history array based on fuel type
      const prices = history[fuelType];
      setPriceHistory(prices);
    } catch (err) {
      console.error('Failed to load price history:', err);
      setError('Failed to load price history');
    } finally {
      setLoading(false);
    }
  }, [siteId, fuelType]);
  
  useEffect(() => {
    loadPriceHistory();
  }, [loadPriceHistory]);

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
      <TouchableWithoutFeedback onPress={loadPriceHistory}>
        <View className="h-[220px] justify-center items-center bg-red-50 rounded-2xl">
          <Text className="text-red-600 text-base">{error}</Text>
          <Text className="text-red-400 text-xs mt-2">Tap to retry</Text>
        </View>
      </TouchableWithoutFeedback>
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

  // Format the price for display (convert from pence to pounds if needed)
  const formatPriceForDisplay = (price: number) => {
    // If price is likely in pence (over 100), convert to pounds
    return price > 100 ? price / 100 : price;
  };

  const chartData = {
    labels: priceHistory.map(item => format(parseISO(item.recorded_at), 'dd MMM')),
    datasets: [
      {
        data: priceHistory.map(item => formatPriceForDisplay(item.price)),
        color: (opacity = 1) => `rgba(0, 119, 255, ${opacity})`, // Blue
        strokeWidth: 3
      }
    ]
  };

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 2,
    color: (opacity = 1) => `rgba(0, 119, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: '#0077FF'
    },
    propsForBackgroundLines: {
      strokeDasharray: '5, 5',
      strokeWidth: 1
    }
  };

  const getMinMaxPrices = () => {
    const prices = priceHistory.map(item => formatPriceForDisplay(item.price));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    // Add buffer to make chart more visually pleasing
    return { 
      min: min - (max - min) * 0.1, 
      max: max + (max - min) * 0.1 
    };
  };

  const { min, max } = getMinMaxPrices();
  
  // Get current price and initial price for stats
  const currentPrice = formatPriceForDisplay(priceHistory[priceHistory.length - 1].price);
  const initialPrice = formatPriceForDisplay(priceHistory[0].price);
  const priceDifference = currentPrice - initialPrice;
  const percentChange = (priceDifference / initialPrice) * 100;
  
  const isPriceUp = priceDifference > 0;

  return (
    <View className="bg-white p-4 rounded-2xl my-2 shadow-sm">
      <Text className="font-bold text-lg mb-4 text-gray-800">Price History</Text>
      
      <View className="flex-row justify-between mb-4">
        <View className="flex-1">
          <Text className="text-sm text-gray-500 mb-1">Current</Text>
          <Text className="text-lg font-bold">£{currentPrice.toFixed(2)}</Text>
        </View>
        
        <View className="flex-1">
          <Text className="text-sm text-gray-500 mb-1">Change</Text>
          <Text className={`text-lg font-bold ${isPriceUp ? 'text-red-500' : 'text-green-500'}`}>
            {isPriceUp ? '+' : ''}{priceDifference.toFixed(2)} ({isPriceUp ? '+' : ''}{percentChange.toFixed(1)}%)
          </Text>
        </View>
      </View>
      
      <LineChart
        data={chartData}
        width={screenWidth}
        height={220}
        chartConfig={chartConfig}
        bezier
        style={{
          marginVertical: 8,
          borderRadius: 16
        }}
        yAxisSuffix="p"
        fromZero={false}
        formatYLabel={(value) => `£${Number(value).toFixed(2)}`}
      />
      
      <Text className="text-center text-xs text-gray-400 mt-4">
        Data updated daily from official sources
      </Text>
    </View>
  );
} 