import React, { createContext, useContext } from 'react';

// Dark theme is the only theme — locked permanently.
interface ThemeContextValue {
  isDark: true;
}

const ThemeContext = createContext<ThemeContextValue>({ isDark: true });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always dark — apply class once on mount, never toggle.
  React.useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('srims_theme', 'dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark: true }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
