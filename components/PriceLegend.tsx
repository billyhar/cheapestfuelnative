import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PriceLegend = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  const toggleExpand = () => {
    const toValue = isExpanded ? 0 : 1;
    Animated.timing(slideAnim, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setIsExpanded(!isExpanded);
  };

  return (
    <View className="absolute right-4 top-4">
      <TouchableOpacity
        onPress={toggleExpand}
        className="bg-white rounded-full shadow-lg p-3 flex-row items-center"
      >
        <Text className="text-gray-700 font-medium mr-2">Price Key</Text>
        <Ionicons 
          name={isExpanded ? "chevron-down" : "chevron-up"} 
          size={20} 
          color="#666"
        />
      </TouchableOpacity>

      <Animated.View
        className="bg-white rounded-2xl shadow-lg p-3 mt-2"
        style={{
          opacity: slideAnim,
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
            })
          }],
          display: isExpanded ? 'flex' : 'none'
        }}
      >
        <Text className="text-sm font-semibold mb-2">Price Guide</Text>
        <View className="space-y-2">
          <View className="flex-row items-center">
            <View className="w-4 h-4 rounded-full bg-[#4CAF50] mr-2" />
            <Text className="text-sm text-gray-700">Below £1.40</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-4 h-4 rounded-full bg-[#FF9800] mr-2" />
            <Text className="text-sm text-gray-700">£1.40 - £1.50</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-4 h-4 rounded-full bg-[#F44336] mr-2" />
            <Text className="text-sm text-gray-700">Above £1.50</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

export default PriceLegend; 