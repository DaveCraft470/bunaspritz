export const colors = {
  white: '#FFFFFF',

  green50: '#EAFBF0',
  green100: '#CFF7DE',
  green200: '#9FEFBE',
  green300: '#6FE39A',
  green400: '#3EDC78',
  green500: '#1FD460', // canonical brand green, sampled from the logo
  green600: '#17B84E',
  green700: '#0E9A3D',
  green800: '#0A7A30',

  black: '#0B0D0F', // map placeholder
  ink: '#14181C', // primary text
  inkMuted: '#66707A', // secondary text / inactive nav
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radii = {
  sm: 12,
  md: 20,
  lg: 28,
  xl: 36,
  badge: 36,
  pill: 999,
} as const;

export const shadows = {
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  glowGreen: {
    shadowColor: colors.green500,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
} as const;

export const typography = {
  fontFamily: {
    regular: 'Baloo2_400Regular',
    medium: 'Baloo2_500Medium',
    semibold: 'Baloo2_600SemiBold',
    bold: 'Baloo2_700Bold',
    extrabold: 'Baloo2_800ExtraBold',
    // Fredoka One is the classic thick, rounded "bubble letter" display face — reserved for the logo wordmark.
    logo: 'FredokaOne_400Regular',
  },
} as const;

// The floating glass buttons (nav islands, circle buttons, theme toggle) look
// the same regardless of scheme — real glass doesn't repaint itself when the
// room's lights change. Matching just the rgba *formula* between themes
// isn't enough on its own: translucent colors composite with whatever sits
// behind them, so the same rgba reads as muddy gray-green over the dark
// theme's near-black map and pale mint over the light theme's backdrop.
// These are fully opaque (solid hex, no alpha) so the backdrop can't leak
// through and change the result — same pixels regardless of theme.
export const glassButton = {
  top: '#FBFEFC',
  bottom: '#CFF3DE',
  border: '#EAF7EF',
  icon: colors.green700,
  iconInactive: colors.inkMuted,
} as const;

export type SchemeColors = {
  background: readonly [string, string];
  mapBase: string;
  mapRoad: string;
  mapPark: string;
  mapWater: string;
  mapBlock: string;
  mapBlockBorder: string;
  textPrimary: string;
  textSecondary: string;
  logoPrimary: string;
  logoAccent: string;
  statusBar: 'light' | 'dark';
  // Generic app-chrome tokens — used by screens (Messages, Profile, Settings)
  // that aren't the map, for their page/card/border surfaces.
  page: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  accent: string;
};

export const darkColors: SchemeColors = {
  background: ['#12171B', '#0B0D0F'],
  mapBase: colors.black,
  mapRoad: 'rgba(255,255,255,0.08)',
  mapPark: 'rgba(31,212,96,0.10)',
  mapWater: 'rgba(64,128,168,0.16)',
  mapBlock: 'rgba(255,255,255,0.05)',
  mapBlockBorder: 'rgba(255,255,255,0.06)',
  textPrimary: colors.white,
  textSecondary: 'rgba(255,255,255,0.75)',
  logoPrimary: colors.white,
  logoAccent: colors.green400,
  statusBar: 'light',
  page: '#12171B',
  surface: '#1A2420',
  surfaceMuted: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.12)',
  accent: colors.green400,
};

export const lightColors: SchemeColors = {
  background: [colors.white, colors.green50],
  mapBase: '#EFF8F2',
  mapRoad: 'rgba(20,24,28,0.12)',
  mapPark: 'rgba(31,212,96,0.24)',
  mapWater: 'rgba(64,128,168,0.24)',
  mapBlock: 'rgba(20,24,28,0.05)',
  mapBlockBorder: 'rgba(20,24,28,0.08)',
  textPrimary: colors.ink,
  textSecondary: colors.inkMuted,
  logoPrimary: colors.ink,
  logoAccent: colors.green700,
  statusBar: 'dark',
  page: '#F5FFF8',
  surface: colors.white,
  surfaceMuted: '#E2F8E9',
  border: '#CDEFD8',
  accent: '#078C3C',
};
