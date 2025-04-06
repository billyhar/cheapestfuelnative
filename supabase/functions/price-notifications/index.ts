import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { APNSProvider } from 'npm:@parse/node-apn';

interface PriceNotificationRecord {
  station_id: string;
  previous_price: number;
  new_price: number;
  fuel_type: string;
}

interface RequestEvent {
  record: PriceNotificationRecord;
}

interface UserPreference {
  user_id: string;
  notifications_enabled: { [key: string]: boolean };
}

interface Station {
  name: string;
  brand: string;
}

interface PushToken {
  token: string;
  platform: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APN_KEY_ID = Deno.env.get('APN_KEY_ID') ?? '';
const APN_TEAM_ID = Deno.env.get('APN_TEAM_ID') ?? '';
const APN_BUNDLE_ID = Deno.env.get('APN_BUNDLE_ID') ?? '';
const APN_KEY = Deno.env.get('APN_KEY') ?? '';

// Initialize APNs provider
const apnProvider = new APNSProvider({
  token: {
    key: APN_KEY,
    keyId: APN_KEY_ID,
    teamId: APN_TEAM_ID
  },
  production: true // Set to false for development
});

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the price notification record that triggered this function
    const { record } = (await req.json()) as RequestEvent;
    const { station_id, previous_price, new_price, fuel_type } = record;

    // Get all users who have notifications enabled for this station
    const { data: preferences } = await supabase
      .from('favorite_stations')
      .select('user_id')
      .eq('station_id', station_id)
      .eq('notifications_enabled', true);

    if (!preferences || preferences.length === 0) {
      return new Response('No users to notify', { status: 200 });
    }

    // Get the station details
    const { data: station } = await supabase
      .from('stations')
      .select('name, brand')
      .eq('id', station_id)
      .single();

    if (!station) {
      throw new Error('Station not found');
    }

    // Get push tokens for all users
    const { data: pushTokens } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .in('user_id', preferences.map(p => p.user_id));

    if (!pushTokens || pushTokens.length === 0) {
      return new Response('No push tokens found', { status: 200 });
    }

    // Filter iOS tokens
    const iosTokens = pushTokens
      .filter(token => token.platform === 'ios')
      .map(token => token.token);

    if (iosTokens.length > 0) {
      // Create notification payload
      const notification = {
        alert: {
          title: `Price ${new_price < previous_price ? 'Drop' : 'Increase'} Alert!`,
          body: `${station.brand} ${station.name} ${fuel_type} price has ${
            new_price < previous_price ? 'dropped to' : 'increased to'
          } £${(new_price / 100).toFixed(2)}`
        },
        payload: {
          station_id,
          fuel_type
        },
        topic: APN_BUNDLE_ID
      };

      // Send to all iOS devices
      const results = await Promise.all(
        iosTokens.map(token => apnProvider.send(notification, token))
      );

      console.log('APNs results:', results);
    }

    return new Response('Notifications sent successfully', { status: 200 });
  } catch (error) {
    console.error('Error in price-notifications function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      { status: 500 }
    );
  }
}); 