import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface PriceNotificationRecord {
  station_id: string;
  previous_price: number;
  new_price: number;
  fuel_type: string;
}

interface UserPreference {
  user_id: string;
  notifications_enabled: boolean;
}

interface Station {
  name: string;
  brand: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';

console.log('Starting edge function with config:', {
  SUPABASE_URL: !!SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
  EXPO_ACCESS_TOKEN: !!EXPO_ACCESS_TOKEN
});

// Function to send push notification via Expo
async function sendExpoNotification(pushToken: string, notification: any) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EXPO_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      to: pushToken,
      title: notification.alert.title,
      body: notification.alert.body,
      data: notification.payload,
      sound: 'default'
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Expo push request failed: ${response.status} ${text}`);
  }

  return response;
}

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if this is a test request
    const url = new URL(req.url);
    if (url.pathname.endsWith('/test')) {
      console.log('Received test request');
      const { station_id, user_id } = await req.json();
      console.log('Test request params:', { station_id, user_id });

      // Get the station details
      const { data: station, error: stationError } = await supabase
        .from('favorite_stations')
        .select('station_name, station_brand')
        .eq('station_id', station_id)
        .single();

      if (stationError) {
        console.error('Error fetching station:', stationError);
        throw new Error('Station not found');
      }

      // Get user's push token
      const { data: pushToken, error: tokenError } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', user_id)
        .single();

      if (tokenError) {
        console.error('Error fetching push token:', tokenError);
        throw new Error('Push token not found');
      }

      console.log('Found push token:', pushToken);

      // Create test notification
      const notification = {
        alert: {
          title: 'Test Price Alert',
          body: `Test notification for ${station.station_brand} ${station.station_name}`
        },
        payload: {
          station_id,
          type: 'test'
        }
      };

      console.log('Sending test notification:', notification);

      // Send test notification
      const result = await sendExpoNotification(pushToken.token, notification);
      console.log('Test notification result:', result);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Test notification sent',
        result: await result.text()
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle regular price change notifications
    const { record } = await req.json();
    const { station_id, previous_price, new_price, fuel_type } = record;

    // Get all users who have notifications enabled for this station
    const { data: favorites, error: favoritesError } = await supabase
      .from('favorite_stations')
      .select('user_id')
      .eq('station_id', station_id)
      .eq('notifications_enabled', true);

    if (favoritesError) {
      console.error('Error fetching favorites:', favoritesError);
      throw favoritesError;
    }

    if (!favorites || favorites.length === 0) {
      return new Response('No users to notify', { status: 200 });
    }

    // Get the station details
    const { data: station, error: stationError } = await supabase
      .from('favorite_stations')
      .select('station_name, station_brand')
      .eq('station_id', station_id)
      .single();

    if (stationError) {
      console.error('Error fetching station:', stationError);
      throw new Error('Station not found');
    }

    // Get push tokens for all users
    const { data: pushTokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', favorites.map(f => f.user_id));

    if (tokensError) {
      console.error('Error fetching push tokens:', tokensError);
      throw tokensError;
    }

    if (!pushTokens || pushTokens.length === 0) {
      return new Response('No push tokens found', { status: 200 });
    }

    // Send notifications
    const notification = {
      alert: {
        title: `Price ${new_price < previous_price ? 'Drop' : 'Increase'} Alert!`,
        body: `${station.station_brand} ${station.station_name} ${fuel_type} price has ${
          new_price < previous_price ? 'dropped to' : 'increased to'
        } £${(new_price / 100).toFixed(2)}`
      },
      payload: {
        station_id,
        fuel_type
      }
    };

    const results = await Promise.all(
      pushTokens.map(token => sendExpoNotification(token.token, notification))
    );

    console.log('Notification results:', results);

    return new Response(JSON.stringify({
      success: true,
      message: 'Notifications sent successfully',
      results: await Promise.all(results.map(r => r.text()))
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in price-notifications function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}); 