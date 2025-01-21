import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export const AuthContext = createContext<{
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: {
    handle?: string;
    first_name?: string;
    avatar_url?: string;
  }) => Promise<void>;
}>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Ensure we start with no session
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        
        // Set up the auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          console.log('Auth state changed:', { session });
          setSession(session);
          setUser(session?.user ?? null);
        });

        // Initial loading complete
        setLoading(false);

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Auth initialization error:', error);
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const signIn = async (email: string) => {
    const redirectUrl = Linking.createURL('auth/callback');
    
    console.log('Signing in with redirect URL:', redirectUrl);
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: true,
      },
    });
    
    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setLoading(false);
  };

  const updateProfile = async (data: {
    handle?: string;
    first_name?: string;
    avatar_url?: string;
  }) => {
    if (!user) throw new Error('No user logged in');
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id);
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 