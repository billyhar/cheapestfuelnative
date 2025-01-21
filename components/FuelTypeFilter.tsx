import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Animated } from 'react-native';

interface FuelTypeFilterProps {
  selectedFuelType: 'E10' | 'B7';
  onFuelTypeChange: (fuelType: 'E10' | 'B7') => void;
}

const FuelTypeFilter: React.FC<FuelTypeFilterProps> = ({
  selectedFuelType,
  onFuelTypeChange,
}) => {
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
    <View>
      <Animated.View
        className="absolute bottom-16 bg-white rounded-2xl shadow-lg w-40 overflow-hidden"
        style={{
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            })
          }],
          opacity: slideAnim,
          display: isExpanded ? 'flex' : 'none',
          right: 0,
        }}
      >
        <TouchableOpacity
          className={`p-4 flex-row items-center ${selectedFuelType === 'E10' ? 'bg-blue-50' : ''}`}
          onPress={() => {
            onFuelTypeChange('E10');
            toggleExpand();
          }}
        >
          <View className="w-4 h-4 rounded-full bg-green-500" />
          <Text className={`ml-2 ${selectedFuelType === 'E10' ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
            Petrol (E10)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`p-4 flex-row items-center ${selectedFuelType === 'B7' ? 'bg-blue-50' : ''}`}
          onPress={() => {
            onFuelTypeChange('B7');
            toggleExpand();
          }}
        >
          <View className="w-4 h-4 rounded-full bg-black" />
          <Text className={`ml-2 ${selectedFuelType === 'B7' ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
            Diesel (B7)
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <TouchableOpacity
        onPress={toggleExpand}
        className="bg-white rounded-full shadow-lg p-3 flex-row items-center mr-4"
      >
        <View 
          className={`w-4 h-4 rounded-full ${selectedFuelType === 'E10' ? 'bg-green-500' : 'bg-black'}`}
        />
        <Text className="ml-2 font-semibold text-gray-700">
          {selectedFuelType === 'E10' ? 'Petrol' : 'Diesel'}
        </Text>
        <Text className="ml-2 text-gray-400 rotate-90">›</Text>
      </TouchableOpacity>
    </View>
  );
};

export default FuelTypeFilter; 