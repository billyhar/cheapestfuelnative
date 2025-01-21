import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FuelStation } from '../services/FuelPriceService';

export type RootStackParamList = {
  '(tabs)': undefined;
  Map: {
    selectedStation?: FuelStation;
    centerOn?: {
      latitude: number;
      longitude: number;
    };
  };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = 
  NativeStackScreenProps<RootStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
} 