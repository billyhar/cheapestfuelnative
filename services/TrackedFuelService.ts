import { supabase } from '../lib/supabase';
import { CreateTrackedFuelPrice, TrackedFuelPrice, FuelType } from '../types/tracked-fuel';

export class TrackedFuelService {
    private static instance: TrackedFuelService;

    private constructor() {}

    public static getInstance(): TrackedFuelService {
        if (!TrackedFuelService.instance) {
            TrackedFuelService.instance = new TrackedFuelService();
        }
        return TrackedFuelService.instance;
    }

    async trackFuelPrice(data: CreateTrackedFuelPrice): Promise<TrackedFuelPrice> {
        const { data: trackedPrice, error } = await supabase
            .from('tracked_fuel_prices')
            .upsert({
                site_id: data.site_id,
                brand: data.brand,
                fuel_type: data.fuel_type,
                price: data.price
            })
            .select()
            .single();

        if (error) throw error;
        return trackedPrice;
    }

    async untrackFuelPrice(site_id: string, fuel_type: FuelType): Promise<void> {
        const { error } = await supabase
            .from('tracked_fuel_prices')
            .delete()
            .match({ site_id, fuel_type });

        if (error) throw error;
    }

    async getTrackedFuelPrices(): Promise<TrackedFuelPrice[]> {
        const { data, error } = await supabase
            .from('tracked_fuel_prices')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    async isTracking(site_id: string, fuel_type: FuelType): Promise<boolean> {
        const { data, error } = await supabase
            .from('tracked_fuel_prices')
            .select('id')
            .match({ site_id, fuel_type })
            .maybeSingle();

        if (error) throw error;
        return !!data;
    }
} 