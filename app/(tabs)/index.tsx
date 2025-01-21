import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { View } from '@/components/Themed';
import FuelPriceMap from '@/components/FuelPriceMap';
import IntroModal from '@/components/IntroModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAS_SEEN_INTRO = 'HAS_SEEN_INTRO';

export default function TabOneScreen() {
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    checkFirstTimeUser();
  }, []);

  const checkFirstTimeUser = async () => {
    try {
      const hasSeenIntro = await AsyncStorage.getItem(HAS_SEEN_INTRO);
      if (!hasSeenIntro) {
        setShowIntro(true);
      }
    } catch (error) {
      console.error('Error checking first time user:', error);
    }
  };

  const handleCloseIntro = async () => {
    try {
      await AsyncStorage.setItem(HAS_SEEN_INTRO, 'true');
      setShowIntro(false);
    } catch (error) {
      console.error('Error saving intro state:', error);
    }
  };

  return (
    <View style={styles.container}>
      <FuelPriceMap />
      <IntroModal visible={showIntro} onClose={handleCloseIntro} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
