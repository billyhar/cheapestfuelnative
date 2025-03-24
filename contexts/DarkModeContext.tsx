import React, { createContext, useContext } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { ColorSchemeName } from 'react-native';

interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  systemColorScheme: ColorSchemeName;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

export const DarkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const darkMode = useDarkMode();

  return (
    <DarkModeContext.Provider value={darkMode}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkModeContext = () => {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkModeContext must be used within a DarkModeProvider');
  }
  return context;
}; 