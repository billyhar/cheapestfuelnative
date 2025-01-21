import React, { useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { supabase } from '../lib/supabase';
import { Alert, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PropsWithChildren } from 'react';
import { Session, User } from '@supabase/supabase-js';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  const handleDeepLink = async (url: string) => {
    if (!url) return;
    console.log('Handling deep link:', url);
    
    try {
      setIsLoading(true);
      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get('code');
      
      if (code) {
        console.log('Found auth code:', code);
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error('Session exchange error:', error);
          return;
        }
        
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
          
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.session.user.id)
            .single();
            
          setProfile(profileData || null);
        }
      }
    } catch (error) {
      console.error('Deep link handling error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, !!session);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (event === 'SIGNED_IN' && session) {
        // Check if this is a new user by looking for their profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (!profileData) {
          // This is a new user
          setIsNewUser(true);
          // Create their profile
          await supabase
            .from('profiles')
            .insert([{ id: session.user.id }]);
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', !!session);
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('Deep link received:', url);
      handleDeepLink(url);
    });

    Linking.getInitialURL().then(url => {
      console.log('Initial URL:', url);
      if (url) handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  const signIn = async (email: string): Promise<void> => {
    try {
      const redirectTo = Platform.select({
        ios: 'cheapestfuel://login',
        android: 'cheapestfuel://login'
      });
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      await AsyncStorage.removeItem('supabase.auth.token');
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (newProfile: any): Promise<void> => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .update(newProfile)
        .eq('id', user?.id);
      
      if (error) throw error;
      setProfile(data.profiles[0] || null);
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading: isLoading,
      signIn,
      signOut,
      updateProfile,
      isNewUser,
      setIsNewUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}; 