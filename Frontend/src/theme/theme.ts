import { RED_BAY_COLORS } from './colors';

export const RED_BAY_BRAND = {
  name: 'RED BAY CAR WASH',
  nameZh: '红湾专业洗车',
  tagline: 'DRIVE IN. SHINE OUT.',
  taglineZh: '驶入如初 · 闪耀出行',
  address: '48 Toh Guan Road East, Singapore 608586',
  unit: '#01-121 (Centre Lane)',
  contactPrimary: '9027 7786',
  contactSecondary: '9859 4496',
  operatingHours: '10 AM – 12 AM (Midnight)',
  currency: 'SGD',
  currencySymbol: '$',
  defaultGstRate: 9.0, // Configurable Singapore GST 9%
};

export const RED_BAY_THEME = {
  colors: RED_BAY_COLORS,
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  shadows: {
    card: '0 4px 12px rgba(8, 8, 8, 0.05)',
    cardHover: '0 8px 24px rgba(8, 8, 8, 0.10)',
    primaryGlow: '0 4px 16px rgba(242, 13, 32, 0.35)',
    darkElevation: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
  },
  racingAccents: {
    checkeredPattern: 'repeating-conic-gradient(#080808 0% 25%, #1A1A1A 0% 50%) 50% / 16px 16px',
    carbonTexture: 'linear-gradient(135deg, #141414 25%, transparent 25%) -8px 0, linear-gradient(225deg, #141414 25%, transparent 25%) -8px 0, linear-gradient(315deg, #141414 25%, transparent 25%), linear-gradient(45deg, #141414 25%, transparent 25%)',
  },
};

