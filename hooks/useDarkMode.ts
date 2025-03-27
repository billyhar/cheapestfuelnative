import { useColorScheme } from 'react-native';
import { useEffect, useState } from 'react';

export const useDarkMode = () => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');

  useEffect(() => {
    setIsDarkMode(systemColorScheme === 'dark');
  }, [systemColorScheme]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  return {
    isDarkMode,
    toggleDarkMode,
    systemColorScheme,
  };
}; 