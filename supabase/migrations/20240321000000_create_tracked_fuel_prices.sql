-- Create tracked_fuel_prices table
CREATE TABLE tracked_fuel_prices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    site_id TEXT NOT NULL,
    brand TEXT NOT NULL,
    fuel_type TEXT NOT NULL CHECK (fuel_type IN ('E10', 'B7')),
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, site_id, fuel_type)
);

-- Add RLS policies
ALTER TABLE tracked_fuel_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tracked fuel prices"
    ON tracked_fuel_prices
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tracked fuel prices"
    ON tracked_fuel_prices
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracked fuel prices"
    ON tracked_fuel_prices
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tracked fuel prices"
    ON tracked_fuel_prices
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX tracked_fuel_prices_user_id_idx ON tracked_fuel_prices(user_id);
CREATE INDEX tracked_fuel_prices_site_id_idx ON tracked_fuel_prices(site_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tracked_fuel_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_tracked_fuel_prices_updated_at
    BEFORE UPDATE ON tracked_fuel_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_tracked_fuel_prices_updated_at(); 