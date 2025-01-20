import { StyleSheet } from 'react-native';
import { View } from '@/components/Themed';
import FuelPriceMap from '@/components/FuelPriceMap';

export default function TabOneScreen() {
  return (
    <View style={styles.container}>
      <FuelPriceMap />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
