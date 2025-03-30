import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function useSupabaseReady() {
  const { user, isLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const initializationRef = useRef({ attempts: 0, lastAttempt: 0 });

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    let cooldown = false;

    const checkReadiness = async () => {
      if (!isMounted || cooldown || !user || isLoading) return;
      cooldown = true;

      try {
        // Add delay between lock acquisitions
        await new Promise(resolve => setTimeout(resolve, 500));

        const [sessionCheck, userCheck, dbCheck] = await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.getUser(),
          supabase.from('profiles').select('id').eq('id', user.id).single()
        ]);

        const allValid = 
          !sessionCheck.error &&
          !userCheck.error &&
          sessionCheck.data.session?.user?.id === user.id &&
          !dbCheck.error;

        if (allValid) {
          console.log('[useSupabaseReady] Full readiness confirmed');
          setIsReady(true);
          return;
        }

        throw new Error('Readiness checks failed');
      } catch (error) {
        initializationRef.current.attempts++;
        
        if (initializationRef.current.attempts >= 5) {
          console.log('[useSupabaseReady] Forcing ready state after max attempts');
          setIsReady(true);
          return;
        }

        // Schedule next check with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, initializationRef.current.attempts), 5000);
        timeoutId = setTimeout(checkReadiness, delay);
      } finally {
        if (isMounted) {
          cooldown = false;
          // Schedule next check with longer delay
          timeoutId = setTimeout(checkReadiness, 1000);
        }
      }
    };

    // Start initial check
    timeoutId = setTimeout(checkReadiness, 1000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [user, isLoading]);

  return isReady;
}

