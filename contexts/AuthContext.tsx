import { createContext, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '../types/profile';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isNewUser: boolean;
  isProfileSetupMode: boolean;
  setIsNewUser: (value: boolean) => void;
  setIsProfileSetupMode: (value: boolean) => void;
  setProfile: (profile: Profile | null) => void;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  uploadAvatar: (uri: string) => Promise<string | null>;
  startProfileSetup: () => Promise<void>;
  pickImage: () => Promise<string | null>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isNewUser: false,
  isProfileSetupMode: false,
  setIsNewUser: () => {},
  setIsProfileSetupMode: () => {},
  setProfile: () => {},
  signIn: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
  uploadAvatar: async () => null,
  startProfileSetup: async () => {},
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
