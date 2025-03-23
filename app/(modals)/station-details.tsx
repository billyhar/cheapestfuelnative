import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import StationDetailsDialog from '@/components/StationDetailsDialog';
import { useEffect } from 'react';

export default function StationDetailsModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Handle the case where we don't have station data
  useEffect(() => {
    if (!params.station) {
      router.back();
    }
  }, [params.station]);

  if (!params.station) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <StationDetailsDialog
        station={JSON.parse(params.station as string)}
      />
    </View>
  );
} 