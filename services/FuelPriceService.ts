import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FuelStation {
  address: string;
  brand: string;
  location: {
    latitude: number;
    longitude: number;
  };
  postcode: string;
  prices: {
    B7?: number;  // Diesel
    E10?: number; // Regular unleaded
    E5?: number;  // Premium unleaded
    SDV?: number; // Super diesel
  };
  site_id: string;
  last_updated?: string;
}

interface APIResponse {
  last_updated?: string;
  stations: any[];
}

interface DataSourceResponse {
  stations: FuelStation[];
  last_updated?: string;
}

interface FuelDataSource {
  url: string;
  brand: string;
  transformResponse: (data: APIResponse) => DataSourceResponse;
}

const CACHE_EXPIRY = 15 * 60 * 1000; // 15 minutes
const CACHE_KEY = 'FUEL_PRICES_CACHE';

const dataSources: FuelDataSource[] = [
  {
    url: 'https://storelocator.asda.com/fuel_prices_data.json',
    brand: 'ASDA',
    transformResponse: (data: APIResponse): DataSourceResponse => ({
      stations: data.stations.map(station => ({
        address: station.address,
        brand: 'ASDA',
        location: station.location,
        postcode: station.postcode,
        prices: station.prices,
        site_id: `asda-${station.site_id}`,
        last_updated: data.last_updated
      })),
      last_updated: data.last_updated
    })
  },
  {
    url: 'https://www.bp.com/en_gb/united-kingdom/home/fuelprices/fuel_prices_data.json',
    brand: 'BP',
    transformResponse: (data: APIResponse): DataSourceResponse => ({
      stations: data.stations.map(station => ({
        address: station.address,
        brand: 'BP',
        location: station.location,
        postcode: station.postcode,
        prices: station.prices,
        site_id: `bp-${station.site_id}`,
        last_updated: data.last_updated
      })),
      last_updated: data.last_updated
    })
  },
  {
    url: 'https://www.morrisons.com/fuel-prices/fuel.json',
    brand: 'Morrisons',
    transformResponse: (data: APIResponse): DataSourceResponse => ({
      stations: data.stations.map(station => ({
        address: station.address,
        brand: 'Morrisons',
        location: station.location,
        postcode: station.postcode,
        prices: station.prices,
        site_id: `morrisons-${station.site_id}`,
        last_updated: data.last_updated
      })),
      last_updated: data.last_updated
    })
  },
  {
    url: 'https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json',
    brand: 'Sainsburys',
    transformResponse: (data: APIResponse): DataSourceResponse => ({
      stations: data.stations.map(station => ({
        address: station.address,
        brand: 'Sainsburys',
        location: station.location,
        postcode: station.postcode,
        prices: station.prices,
        site_id: `sainsburys-${station.site_id}`,
        last_updated: data.last_updated
      })),
      last_updated: data.last_updated
    })
  },
  {
    url: 'https://www.tesco.com/fuel_prices/fuel_prices_data.json',
    brand: 'Tesco',
    transformResponse: (data: APIResponse): DataSourceResponse => ({
      stations: data.stations.map(station => ({
        address: station.address,
        brand: 'Tesco',
        location: station.location,
        postcode: station.postcode,
        prices: station.prices,
        site_id: `tesco-${station.site_id}`,
        last_updated: data.last_updated
      })),
      last_updated: data.last_updated
    })
  },
  {
    url: 'https://moto-way.com/fuel-price/fuel_prices.json',
    brand: 'Moto',
    transformResponse: (data: APIResponse): DataSourceResponse => ({
      stations: data.stations.map(station => ({
        address: station.address,
        brand: 'Moto',
        location: station.location,
        postcode: station.postcode,
        prices: station.prices,
        site_id: `moto-${station.site_id}`,
        last_updated: data.last_updated
      })),
      last_updated: data.last_updated
    })
  },
  {
    url: 'https://fuel.motorfuelgroup.com/fuel_prices_data.json',
    brand: 'MFG',
    transformResponse: (data: APIResponse): DataSourceResponse => ({
      stations: data.stations.map(station => ({
        address: station.address,
        brand: 'MFG',
        location: station.location,
        postcode: station.postcode,
        prices: station.prices,
        site_id: `mfg-${station.site_id}`,
        last_updated: data.last_updated
      })),
      last_updated: data.last_updated
    })
  },
  {
    url: 'https://www.rontec-servicestations.co.uk/fuel-prices/data/fuel_prices_data.json',
    brand: 'Rontec',
    transformResponse: (data: APIResponse): DataSourceResponse => ({
      stations: data.stations.map(station => ({
        address: station.address,
        brand: 'Rontec',
        location: station.location,
        postcode: station.postcode,
        prices: station.prices,
        site_id: `rontec-${station.site_id}`,
        last_updated: data.last_updated
      })),
      last_updated: data.last_updated
    })
  }
];

export class FuelPriceService {
  private static instance: FuelPriceService;
  private lastFetchTime: number = 0;
  private isFetching: boolean = false;
  private cachedData: FuelStation[] = [];
  private lastUpdated: string | null = null;

  private constructor() {}

  static getInstance(): FuelPriceService {
    if (!FuelPriceService.instance) {
      FuelPriceService.instance = new FuelPriceService();
    }
    return FuelPriceService.instance;
  }

  private async loadFromCache(): Promise<FuelStation[] | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          this.cachedData = data;
          this.lastFetchTime = timestamp;
          return data;
        }
      }
      return null;
    } catch (error) {
      console.error('Error loading from cache:', error);
      return null;
    }
  }

  private async saveToCache(data: FuelStation[]) {
    try {
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          data,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }

  async fetchFuelPrices(
    onProgress?: (progress: number) => void,
    forceRefresh: boolean = false
  ): Promise<FuelStation[]> {
    if (!forceRefresh && Date.now() - this.lastFetchTime < CACHE_EXPIRY) {
      return this.cachedData;
    }

    if (this.isFetching) {
      return this.cachedData;
    }

    this.isFetching = true;

    try {
      const cachedData = await this.loadFromCache();
      if (cachedData && !forceRefresh) {
        return cachedData;
      }

      const allStations: FuelStation[] = [];
      const totalSources = dataSources.length;
      let latestUpdate: string | null = null;
      
      const fetchPromises = dataSources.map(async (source, index) => {
        try {
          const response = await axios.get(source.url, { timeout: 10000 });
          const result = source.transformResponse(response.data);
          if (result.last_updated) {
            if (!latestUpdate || new Date(result.last_updated) > new Date(latestUpdate)) {
              latestUpdate = result.last_updated;
            }
          }
          allStations.push(...result.stations);
          onProgress?.((index + 1) / totalSources);
        } catch (error) {
          console.error(`Error fetching from ${source.brand}:`, error);
        }
      });

      await Promise.all(fetchPromises);

      this.lastUpdated = latestUpdate;
      this.cachedData = allStations;
      this.lastFetchTime = Date.now();
      await this.saveToCache(allStations);

      return allStations;
    } finally {
      this.isFetching = false;
    }
  }

  getLastFetchTime(): number {
    return this.lastFetchTime;
  }

  getLastUpdated(): string | null {
    return this.lastUpdated;
  }
}
