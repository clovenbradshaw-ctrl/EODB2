import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface Theme {
  mode: 'light' | 'dark';

  // Backgrounds
  bg: string;
  bgCard: string;
  bgHover: string;
  bgMuted: string;
  bgActive: string;

  // Text
  text: string;
  textHeading: string;
  textSecondary: string;
  textMuted: string;

  // Borders
  border: string;
  borderLight: string;
  borderDivider: string;

  // Accent (blue)
  accent: string;
  accentBg: string;
  accentBorder: string;

  // Danger (pink/red)
  danger: string;
  dangerBg: string;
  dangerBorder: string;
  dangerText: string;

  // Success (green)
  success: string;
  successBg: string;
  successBorder: string;
  successText: string;

  // Warning (orange)
  warning: string;
  warningBg: string;
  warningBorder: string;
  warningText: string;

  // Purple
  purple: string;
  purpleBg: string;
  purpleBorder: string;

  // Teal/green accent
  teal: string;
  tealBg: string;
  tealBorder: string;

  // Gold/brown accent
  gold: string;
  goldBg: string;
  goldBorder: string;

  // Login page
  loginBg: string;
  loginCard: string;
  loginInput: string;
  loginBorder: string;
  loginText: string;
  loginTextDim: string;

  // Shadows
  shadow: string;
  shadowOverlay: string;
  shadowPanel: string;

  // Status pill colors
  statusActive: { bg: string; color: string; border: string };
  statusArchived: { bg: string; color: string; border: string };
  statusPending: { bg: string; color: string; border: string };

  // Badges
  badgeSharedBg: string;
  badgeSharedText: string;
  badgePrivateBg: string;
  badgePrivateText: string;

  // Scrollbar
  scrollThumb: string;
  scrollThumbHover: string;

  // Bar fill gradient
  barBg: string;
  barFill: string;
}

// Re-skin: the light theme is mapped onto the design-system tokens in
// src/styles/design-system.css (--bg / --surface / --ink / --accent …),
// so every component that reads `theme.*` or a `makeStyles` value adopts
// the warm-paper + indigo palette without any structural change.
export const lightTheme: Theme = {
  mode: 'light',

  bg: '#fbfaf6',
  bgCard: '#ffffff',
  bgHover: '#f5f3ec',
  bgMuted: '#f5f3ec',
  bgActive: '#ecedfb',

  text: '#3a3833',
  textHeading: '#1c1b18',
  textSecondary: '#6b6960',
  textMuted: '#93908a',

  border: '#e8e4d8',
  borderLight: '#efece3',
  borderDivider: '#d6d1c2',

  accent: '#4f55c9',
  accentBg: '#ecedfb',
  accentBorder: '#d6d8f4',

  danger: '#b13a48',
  dangerBg: '#f8dfe2',
  dangerBorder: '#e9c2c8',
  dangerText: '#b13a48',

  success: '#2f8a5d',
  successBg: '#e3f1e8',
  successBorder: '#bfe0cd',
  successText: '#2f7d54',

  warning: '#b07415',
  warningBg: '#f7ecd1',
  warningBorder: '#e9d6ab',
  warningText: '#8a5b0d',

  purple: '#6e4cc4',
  purpleBg: '#ece6f8',
  purpleBorder: '#d9d0ee',

  teal: '#2a7d8c',
  tealBg: '#dcecef',
  tealBorder: '#bedde2',

  gold: '#8b6834',
  goldBg: '#faf5ed',
  goldBorder: '#e5d5b8',

  loginBg: '#0a0a0a',
  loginCard: '#1a1a1a',
  loginInput: '#111',
  loginBorder: '#333',
  loginText: '#fff',
  loginTextDim: '#888',

  shadow: 'rgba(28,27,24,0.06)',
  shadowOverlay: 'rgba(28,27,24,0.32)',
  shadowPanel: '-4px 0 32px rgba(28,27,24,0.08)',

  statusActive: { bg: '#e3f1e8', color: '#2f7d54', border: '#bfe0cd' },
  statusArchived: { bg: '#efece3', color: '#93908a', border: '#d6d1c2' },
  statusPending: { bg: '#f7ecd1', color: '#8a5b0d', border: '#e9d6ab' },

  badgeSharedBg: '#ecedfb',
  badgeSharedText: '#2e3392',
  badgePrivateBg: '#f7ecd1',
  badgePrivateText: '#8a5b0d',

  scrollThumb: '#d6d1c2',
  scrollThumbHover: '#c4bda8',

  barBg: '#efece3',
  barFill: 'linear-gradient(90deg, #efece3, #b07415)',
};

export const darkTheme: Theme = {
  mode: 'dark',

  bg: '#0e1117',
  bgCard: '#161b22',
  bgHover: '#1c2333',
  bgMuted: '#1c2333',
  bgActive: '#1a2744',

  text: '#c9d1d9',
  textHeading: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#6e7681',

  border: '#30363d',
  borderLight: '#21262d',
  borderDivider: '#484f58',

  accent: '#58a6ff',
  accentBg: '#1a2744',
  accentBorder: '#264d80',

  danger: '#f078a0',
  dangerBg: '#2d1520',
  dangerBorder: '#5a2535',
  dangerText: '#f078a0',

  success: '#56d364',
  successBg: '#122117',
  successBorder: '#1a3a25',
  successText: '#56d364',

  warning: '#e3b341',
  warningBg: '#2a2015',
  warningBorder: '#4a3520',
  warningText: '#e3b341',

  purple: '#bc8cff',
  purpleBg: '#1e1530',
  purpleBorder: '#3d2860',

  teal: '#39d98a',
  tealBg: '#0f2418',
  tealBorder: '#1a3e2a',

  gold: '#d9a54a',
  goldBg: '#1e1a10',
  goldBorder: '#4a3820',

  loginBg: '#0e1117',
  loginCard: '#161b22',
  loginInput: '#0d1117',
  loginBorder: '#30363d',
  loginText: '#e6edf3',
  loginTextDim: '#5a6370',

  shadow: 'rgba(0,0,0,0.4)',
  shadowOverlay: 'rgba(0,0,0,0.6)',
  shadowPanel: '-4px 0 24px rgba(0,0,0,0.3)',

  statusActive: { bg: '#122117', color: '#56d364', border: '#1a3a25' },
  statusArchived: { bg: '#1c2333', color: '#5a6370', border: '#30363d' },
  statusPending: { bg: '#2a2015', color: '#e3b341', border: '#4a3520' },

  badgeSharedBg: '#1a2744',
  badgeSharedText: '#58a6ff',
  badgePrivateBg: '#2a2015',
  badgePrivateText: '#e3b341',

  scrollThumb: '#30363d',
  scrollThumbHover: '#484f58',

  barBg: '#1c2333',
  barFill: 'linear-gradient(90deg, #1c2333, #e3b341)',
};

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('eo-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const theme = mode === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    localStorage.setItem('eo-theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  function toggleTheme() {
    setMode((m) => (m === 'light' ? 'dark' : 'light'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Parse a hex color string to extract its HSL hue (0–360).
 * Returns null if the string is not a valid 6-digit hex color.
 */
function hexToHue(hex: string): number | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }
  return Math.round(h * 360);
}

/**
 * Generate subtle role-specific background color overrides.
 * Uses the role's defined hex color to tint the app background,
 * giving a clear but unobtrusive "you are in role X" signal.
 * Slightly stronger saturation than spaceBackgroundTint so it reads
 * over the space tint when both are active.
 */
export function roleBackgroundTint(
  roleColor: string | undefined | null,
  mode: 'light' | 'dark',
): { bg: string; bgCard: string; bgMuted: string; border: string } | null {
  if (!roleColor) return null;
  const hue = hexToHue(roleColor);
  if (hue === null) return null;
  if (mode === 'light') {
    return {
      bg: `hsl(${hue}, 15%, 97%)`,
      bgCard: `hsl(${hue}, 12%, 99%)`,
      bgMuted: `hsl(${hue}, 12%, 95%)`,
      border: `hsl(${hue}, 20%, 90%)`,
    };
  }
  return {
    bg: `hsl(${hue}, 12%, 7%)`,
    bgCard: `hsl(${hue}, 10%, 9%)`,
    bgMuted: `hsl(${hue}, 10%, 12%)`,
    border: `hsl(${hue}, 20%, 18%)`,
  };
}

/**
 * Generate subtle space-specific background color overrides.
 * Each space gets a unique but very subtle tint derived from its name,
 * so users can visually distinguish which space they're in.
 */
export function spaceBackgroundTint(spaceName: string | null, mode: 'light' | 'dark'): {
  bg: string;
  bgCard: string;
  bgMuted: string;
} | null {
  if (!spaceName) return null;

  // Simple hash from space name to get a consistent hue
  let hash = 0;
  for (let i = 0; i < spaceName.length; i++) {
    hash = spaceName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;

  if (mode === 'light') {
    return {
      bg: `hsl(${hue}, 12%, 97%)`,
      bgCard: `hsl(${hue}, 10%, 99%)`,
      bgMuted: `hsl(${hue}, 10%, 95%)`,
    };
  } else {
    return {
      bg: `hsl(${hue}, 10%, 7%)`,
      bgCard: `hsl(${hue}, 8%, 9%)`,
      bgMuted: `hsl(${hue}, 8%, 12%)`,
    };
  }
}
