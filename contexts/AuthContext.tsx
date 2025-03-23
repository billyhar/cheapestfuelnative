import { createContext, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '../types/profile';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  setProfile: (profile: Profile | null) => void;
  signIn: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  uploadAvatar: (uri: string) => Promise<string | null>;
  pickImage: () => Promise<string | null>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  setProfile: () => {},
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
  uploadAvatar: async () => null,
  pickImage: async () => null,
  refreshUser: async () => {},
});

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
