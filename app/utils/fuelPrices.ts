export async function recordDailyPrices(stations: FuelStation[]) {
  const supabase = createClientComponentClient();
  
  const records = stations.flatMap(station => 
    station.fuelPrices.map(price => ({
      station_id: station.id,
      price: price.amount,
      fuel_type: price.fuelType,
      recorded_at: new Date()
    }))
  );

  const { error } = await supabase
    .from('historical_fuel_prices')
    .insert(records);

  if (error) {
    console.error('Failed to record fuel prices:', error);
    throw error;
  }
}

export async function getHistoricalPrices(stationId: string, fuelType: string) {
  const supabase = createClientComponentClient();
  
  const { data, error } = await supabase
    .from('historical_fuel_prices')
    .select('price, recorded_at')
    .eq('station_id', stationId)
    .eq('fuel_type', fuelType)
    .order('recorded_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch historical prices:', error);
    throw error;
  }

  return data;
} 