import { StyleSheet, View, Text } from 'react-native';
import { AppTheme } from '../../constants/BrandAssets';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Coming soon!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppTheme.colors.text,
    marginBottom: AppTheme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: AppTheme.colors.text,
    opacity: 0.7,
  },
});
