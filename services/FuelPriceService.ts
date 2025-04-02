import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, ensureSupabaseInitialized } from '../lib/supabase';

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
  },
  {
    url: 'https://applegreenstores.com/fuel-prices/data.json',
    brand: 'Applegreen',
    transformResponse: (data: APIResponse): DataSourceResponse => ({
      stations: data.stations.map(station => ({
        address: station.address,
        brand: 'Applegreen',
        location: station.location,
        postcode: station.postcode,
        prices: station.prices,
        site_id: `applegreen-${station.site_id}`,
        last_updated: data.last_updated
      })),
      last_updated: data.last_updated
    })
  },
  {
    url: 'https://fuelprices.esso.co.uk/latestdata.json',
    brand: 'Esso',
    transformResponse: (data: APIResponse): DataSourceResponse => ({
      stations: data.stations.map(station => ({
        address: station.address,
        brand: 'Esso',
        location: station.location,
        postcode: station.postcode,
        prices: station.prices,
        site_id: `esso-${station.site_id}`,
        last_updated: data.last_updated
      })),
      last_updated: data.last_updated
    })
  },
  {
    url: 'https://jetlocal.co.uk/fuel_prices_data.json',
    brand: 'Jet',
    transformResponse: (data: APIResponse): DataSourceResponse => ({
      stations: data.stations.map(station => ({
        address: station.address,
        brand: 'Jet',
        location: station.location,
        postcode: station.postcode,
        prices: station.prices,
        site_id: `jet-${station.site_id}`,
        last_updated: data.last_updated
      })),
      last_updated: data.last_updated
    })
  },
  {
    url: 'https://www.sgnretail.uk/files/data/SGN_daily_fuel_prices.json',
    brand: 'SGN',
    transformResponse: (data: APIResponse): DataSourceResponse => ({
      stations: data.stations.map(station => ({
        address: station.address,
        brand: 'SGN',
        location: station.location,
        postcode: station.postcode,
        prices: station.prices,
        site_id: `sgn-${station.site_id}`,
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
  private initializationRetries: number = 0;
  private readonly MAX_INIT_RETRIES = 3;

  private constructor() {
    // Initialize Supabase when service is created
    this.initializeSupabase();
  }

  private async initializeSupabase(retryCount = 0): Promise<void> {
    try {
      console.log('[FuelPriceService] Initializing Supabase...');
      const success = await ensureSupabaseInitialized();
      
      if (!success && retryCount < this.MAX_INIT_RETRIES) {
        console.log(`[FuelPriceService] Initialization failed, retrying (${retryCount + 1}/${this.MAX_INIT_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.initializeSupabase(retryCount + 1);
      }
      
      console.log('[FuelPriceService] Initialization complete');
    } catch (error) {
      console.error('[FuelPriceService] Initialization error:', error);
    }
  }

  static getInstance(): FuelPriceService {
    if (!FuelPriceService.instance) {
      FuelPriceService.instance = new FuelPriceService();
    }
    return FuelPriceService.instance;
  }

  // Add new method to ensure initialization
  private async ensureInitialized(): Promise<boolean> {
    try {
      if (this.initializationRetries >= this.MAX_INIT_RETRIES) {
        console.log('[FuelPriceService] Max initialization retries reached');
        return false;
      }
      
      const success = await ensureSupabaseInitialized();
      if (!success) {
        this.initializationRetries++;
        console.log(`[FuelPriceService] Initialization attempt ${this.initializationRetries} failed`);
        return false;
      }
      
      this.initializationRetries = 0;
      return true;
    } catch (error) {
      console.error('[FuelPriceService] Error ensuring initialization:', error);
      return false;
    }
  }

  private async loadFromCache(): Promise<FuelStation[] | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp, lastUpdated } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          this.cachedData = data;
          this.lastFetchTime = timestamp;
          this.lastUpdated = lastUpdated;
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
          timestamp: Date.now(),
          lastUpdated: this.lastUpdated
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
          
          // Validate the timestamp
          if (result.last_updated) {
            const date = new Date(result.last_updated);
            if (!isNaN(date.getTime())) {
              if (!latestUpdate || new Date(result.last_updated) > new Date(latestUpdate)) {
                latestUpdate = result.last_updated;
              }
            }
          }
          
          allStations.push(...result.stations);
          onProgress?.((index + 1) / totalSources);
        } catch (error) {
          console.error(`Error fetching from ${source.brand}:`, error);
        }
      });

      await Promise.all(fetchPromises);

      // If no API provided a last_updated timestamp, use the current time
      const currentTime = new Date().toISOString();
      this.lastUpdated = latestUpdate || currentTime;
      
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

  // Update getHistoricalPrices to use the new initialization check
  async getHistoricalPrices(
    siteId: string,
    fuelType?: string,
    days: number = 7
  ): Promise<{
    e10: { price: number; recorded_at: string }[];
    b7: { price: number; recorded_at: string }[];
    e5: { price: number; recorded_at: string }[];
    sdv: { price: number; recorded_at: string }[];
  }> {
    try {
      // Ensure Supabase is initialized with retries
      const initialized = await this.ensureInitialized();
      if (!initialized) {
        throw new Error('Failed to initialize Supabase after multiple attempts');
      }
      
      console.log(`[FuelPriceService] Fetching price history for site ${siteId}`);
      
      const query = supabase
        .from('historical_fuel_prices')
        .select('fuel_type, price, recorded_at')
        .eq('site_id', siteId)
        .gte('recorded_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('recorded_at', { ascending: true });
      
      if (fuelType) {
        query.eq('fuel_type', fuelType.toUpperCase());
      }

      const { data, error } = await query;

      if (error) {
        console.error('[FuelPriceService] Query error:', error);
        throw error;
      }

      console.log(`[FuelPriceService] Retrieved ${data?.length || 0} price history records`);

      const historicalData = {
        e10: [] as { price: number; recorded_at: string }[],
        b7: [] as { price: number; recorded_at: string }[],
        e5: [] as { price: number; recorded_at: string }[],
        sdv: [] as { price: number; recorded_at: string }[]
      };

      data?.forEach(record => {
        const type = record.fuel_type.toLowerCase() as keyof typeof historicalData;
        if (type in historicalData) {
          historicalData[type].push({
            price: record.price,
            recorded_at: record.recorded_at
          });
        }
      });

      return historicalData;
    } catch (error) {
      console.error('[FuelPriceService] Error fetching historical prices:', error);
      return {
        e10: [],
        b7: [],
        e5: [],
        sdv: []
      };
    }
  }

  async getLatestPrices(): Promise<FuelStation[]> {
    try {
      // Ensure Supabase is initialized before querying
      await ensureSupabaseInitialized();
      
      console.log('[FuelPriceService] Fetching latest prices');
      
      // Get all the latest prices from the latest_fuel_prices table
      const { data, error } = await supabase
        .from('latest_fuel_prices')
        .select('*');

      if (error) {
        console.error('[FuelPriceService] Query error:', error);
        throw error;
      }

      console.log(`[FuelPriceService] Retrieved ${data?.length || 0} latest price records`);

      // Convert the flat structure back to FuelStation format
      const stationMap = new Map();
      
      data?.forEach(record => {
        if (!stationMap.has(record.site_id)) {
          stationMap.set(record.site_id, {
            site_id: record.site_id,
            brand: record.brand,
            prices: {},
            // Add other required fields with placeholder values
            address: '',
            location: { latitude: 0, longitude: 0 },
            postcode: ''
          });
        }
        
        const station = stationMap.get(record.site_id);
        station.prices[record.fuel_type] = record.price;
      });
      
      return Array.from(stationMap.values());
    } catch (error) {
      console.error('[FuelPriceService] Error fetching latest prices:', error);
      // Fallback to API call if needed
      return this.fetchFuelPrices();
    }
  }
}
