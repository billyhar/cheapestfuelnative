import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

// Initialize Supabase client with service role
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface FuelPrice {
  site_id: string;
  brand: string;
  e10_price: number | null;
  b7_price: number | null;
  e5_price: number | null;
  sdv_price: number | null;
}

Deno.serve(async () => {
  try {
    console.log(`[${new Date().toISOString()}] Fuel prices fetch started`);
    
    // Define your fuel API endpoints based on your app's data sources
    const apiEndpoints = [
      {
        url: 'https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json',
        brand: 'Sainsburys',
        transform: (data: any): FuelPrice[] => {
          return data.stations?.map((station: any) => ({
            site_id: `sainsburys-${station.site_id}`,
            brand: 'Sainsburys',
            e10_price: station.prices?.E10 || null,
            b7_price: station.prices?.B7 || null,
            e5_price: station.prices?.E5 || null,
            sdv_price: station.prices?.SDV || null
          })) || [];
        }
      },
      {
        url: 'https://www.tesco.com/fuel_prices/fuel_prices_data.json',
        brand: 'Tesco',
        transform: (data: any): FuelPrice[] => {
          return data.stations?.map((station: any) => ({
            site_id: `tesco-${station.site_id}`,
            brand: 'Tesco',
            e10_price: station.prices?.E10 || null,
            b7_price: station.prices?.B7 || null,
            e5_price: station.prices?.E5 || null,
            sdv_price: station.prices?.SDV || null
          })) || [];
        }
      },
      {
        url: 'https://moto-way.com/fuel-price/fuel_prices.json',
        brand: 'Moto',
        transform: (data: any): FuelPrice[] => {
          return data.stations?.map((station: any) => ({
            site_id: `moto-${station.site_id}`,
            brand: 'Moto',
            e10_price: station.prices?.E10 || null,
            b7_price: station.prices?.B7 || null,
            e5_price: station.prices?.E5 || null,
            sdv_price: station.prices?.SDV || null
          })) || [];
        }
      },
      {
        url: 'https://fuel.motorfuelgroup.com/fuel_prices_data.json',
        brand: 'MFG',
        transform: (data: any): FuelPrice[] => {
          return data.stations?.map((station: any) => ({
            site_id: `mfg-${station.site_id}`,
            brand: 'MFG',
            e10_price: station.prices?.E10 || null,
            b7_price: station.prices?.B7 || null,
            e5_price: station.prices?.E5 || null,
            sdv_price: station.prices?.SDV || null
          })) || [];
        }
      },
      {
        url: 'https://www.rontec-servicestations.co.uk/fuel-prices/data/fuel_prices_data.json',
        brand: 'Rontec',
        transform: (data: any): FuelPrice[] => {
          return data.stations?.map((station: any) => ({
            site_id: `rontec-${station.site_id}`,
            brand: 'Rontec',
            e10_price: station.prices?.E10 || null,
            b7_price: station.prices?.B7 || null,
            e5_price: station.prices?.E5 || null,
            sdv_price: station.prices?.SDV || null
          })) || [];
        }
      },
      {
        url: 'https://applegreenstores.com/fuel-prices/data.json',
        brand: 'Applegreen',
        transform: (data: any): FuelPrice[] => {
          return data.stations?.map((station: any) => ({
            site_id: `applegreen-${station.site_id}`,
            brand: 'Applegreen',
            e10_price: station.prices?.E10 || null,
            b7_price: station.prices?.B7 || null,
            e5_price: station.prices?.E5 || null,
            sdv_price: station.prices?.SDV || null
          })) || [];
        }
      },
      {
        url: 'https://fuelprices.esso.co.uk/latestdata.json',
        brand: 'Esso',
        transform: (data: any): FuelPrice[] => {
          return data.stations?.map((station: any) => ({
            site_id: `esso-${station.site_id}`,
            brand: 'Esso',
            e10_price: station.prices?.E10 || null,
            b7_price: station.prices?.B7 || null,
            e5_price: station.prices?.E5 || null,
            sdv_price: station.prices?.SDV || null
          })) || [];
        }
      },
      {
        url: 'https://jetlocal.co.uk/fuel_prices_data.json',
        brand: 'Jet',
        transform: (data: any): FuelPrice[] => {
          return data.stations?.map((station: any) => ({
            site_id: `jet-${station.site_id}`,
            brand: 'Jet',
            e10_price: station.prices?.E10 || null,
            b7_price: station.prices?.B7 || null,
            e5_price: station.prices?.E5 || null,
            sdv_price: station.prices?.SDV || null
          })) || [];
        }
      },
      {
        url: 'https://www.sgnretail.uk/files/data/SGN_daily_fuel_prices.json',
        brand: 'SGN',
        transform: (data: any): FuelPrice[] => {
          return data.stations?.map((station: any) => ({
            site_id: `sgn-${station.site_id}`,
            brand: 'SGN',
            e10_price: station.prices?.E10 || null,
            b7_price: station.prices?.B7 || null,
            e5_price: station.prices?.E5 || null,
            sdv_price: station.prices?.SDV || null
          })) || [];
        }
      }
    ];
    
    // Fetch from all endpoints and combine results
    let allFuelPrices: FuelPrice[] = [];
    
    for (const api of apiEndpoints) {
      try {
        const response = await fetch(api.url);
        if (!response.ok) {
          console.error(`API error: ${response.status} from ${api.url}`);
          continue;
        }
        const data = await response.json();
        const prices = api.transform(data);
        allFuelPrices = [...allFuelPrices, ...prices];
      } catch (apiError) {
        console.error(`Failed to fetch from ${api.url}:`, apiError);
        // Continue with other APIs if one fails
      }
    }
    
    // Transform the data to match your schema
    const fuelPrices: FuelPrice[] = allFuelPrices;
    
    // Get the latest prices from the database to compare
    const { data: latestPrices, error: fetchError } = await supabase
      .from('latest_fuel_prices')
      .select('site_id, fuel_type, price');
    
    if (fetchError) throw fetchError;
    
    // Create a map of latest prices for easy comparison
    const latestPriceMap = new Map();
    latestPrices?.forEach(item => {
      latestPriceMap.set(`${item.site_id}_${item.fuel_type}`, item.price);
    });
    
    // Prepare records for historical_fuel_prices - only store changed prices
    const timestamp = new Date().toISOString();
    const historicalRecords = [];
    const latestRecords = [];
    
    for (const station of fuelPrices) {
      // Process each fuel type separately
      const fuelTypes = [
        { type: 'E10', price: station.e10_price },
        { type: 'B7', price: station.b7_price },
        { type: 'E5', price: station.e5_price },
        { type: 'SDV', price: station.sdv_price }
      ];
      
      for (const { type, price } of fuelTypes) {
        if (price === null) continue;
        
        const key = `${station.site_id}_${type}`;
        const currentPrice = latestPriceMap.get(key);
        
        // Only record history if price changed
        if (currentPrice !== price) {
          historicalRecords.push({
            site_id: station.site_id,
            brand: station.brand,
            fuel_type: type,
            price: price,
            recorded_at: timestamp
          });
          
          // Update latest price record
          latestRecords.push({
            site_id: station.site_id,
            brand: station.brand,
            fuel_type: type,
            price: price,
            updated_at: timestamp
          });
        }
      }
    }
    
    // Only insert if we have changes
    let historicalError = null;
    if (historicalRecords.length > 0) {
      const { error } = await supabase
        .from('historical_fuel_prices')
        .insert(historicalRecords);
      historicalError = error;
    }
    
    // Upsert to latest_fuel_prices table
    let latestError = null;
    if (latestRecords.length > 0) {
      try {
        const { error } = await supabase
          .from('latest_fuel_prices')
          .upsert(latestRecords, { 
            onConflict: 'site_id,fuel_type',
            ignoreDuplicates: true
          });
        latestError = error;
      } catch (err) {
        console.error('Error during upsert:', err);
        latestError = { message: 'Error during upsert operation' };
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      changes: historicalRecords.length,
      historicalError: historicalError?.message,
      latestError: latestError?.message
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});