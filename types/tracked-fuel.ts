export type FuelType = 'E10' | 'B7';

export interface TrackedFuelPrice {
    id: string;
    user_id: string;
    site_id: string;
    brand: string;
    fuel_type: FuelType;
    price: number;
    created_at: string;
    updated_at: string;
}

export interface CreateTrackedFuelPrice {
    site_id: string;
    brand: string;
    fuel_type: FuelType;
    price: number;
} 