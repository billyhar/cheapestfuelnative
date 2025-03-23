export interface Station {
  id: string;
  name: string;
  brand: string;
  address: string;
  latitude: number;
  longitude: number;
  prices: {
    E10?: number;
    B7?: number;
  };
  last_updated: string;
} 