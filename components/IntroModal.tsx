import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';

interface IntroModalProps {
  visible: boolean;
  onClose: () => void;
}

const IntroModal: React.FC<IntroModalProps> = ({ visible, onClose }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50">
        <View className="flex-1 bg-white mt-[60px] rounded-t-[20px] p-5 shadow-lg">
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-4xl font-bold text-left my-5 text-brand">
              Welcome to CheapestFuel UK! ⛽️
            </Text>
            
            <Text className="text-lg font-bold mt-4 mb-2 text-black">
              What is CheapestFuel?
            </Text>
            <Text className="text-base leading-6 text-gray-700 mb-3">
              CheapestFuel helps you find the lowest fuel prices near you. We collect real-time data from major fuel retailers across the UK to help you save money on your fuel purchases.
            </Text>

            <Text className="text-lg font-bold mt-4 mb-2 text-black">
              Our Data Sources
            </Text>
            <Text className="text-base leading-6 text-gray-700 mb-3">
              We utilize official fuel price data from various UK retailers through the government's fuel price API initiative. This data is provided as part of the UK government's commitment to price transparency.
            </Text>

            <Text className="text-base leading-6 text-gray-700 mb-3">
             Data is updated periodically by individual retailers. I can't guarantee the accuracy of the data.
            </Text>

            <Text className="text-lg font-bold mt-4 mb-2 text-black">
              Participating Retailers
            </Text>
            <Text className="text-base leading-6 text-gray-700 mb-3">
              • Asda{'\n'}
              • BP{'\n'}
              • Morrisons{'\n'}
              • Sainsbury's{'\n'}
              • Tesco{'\n'}
              • Esso{'\n'}
              • Texaco{'\n'}
              • And more!
            </Text>

            <TouchableOpacity
              onPress={() => Linking.openURL('https://www.gov.uk/guidance/access-fuel-price-data')}
            >
              <Text className="text-base text-brand underline my-3">
                Learn more about the data initiative
              </Text>
            </TouchableOpacity>

            <Text className="text-sm italic text-gray-500 mt-4 mb-6 text-center">
              Special thanks to all participating fuel retailers for their commitment to price transparency and helping UK consumers make informed decisions.
            </Text>

            <TouchableOpacity
              className="bg-brand rounded-xl py-4 mt-2 mb-5"
              onPress={onClose}
            >
              <Text className="text-white font-bold text-center text-lg">
                Get Started
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
      <StatusBar style="light" />
    </Modal>
  );
};

export default IntroModal; 