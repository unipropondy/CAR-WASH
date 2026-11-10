import { Platform, ViewStyle } from 'react-native';

export interface ShadowOptions {
  color?: string;
  offset?: { width: number; height: number };
  opacity?: number;
  radius?: number;
  elevation?: number;
}

export function getShadowStyle({
  color = '#000000',
  offset = { width: 0, height: 2 },
  opacity = 0.25,
  radius = 4,
  elevation = 2,
}: ShadowOptions = {}): ViewStyle {
  if (Platform.OS === 'web') {
    if (opacity === 0) {
      return { boxShadow: 'none' } as any;
    }

    let shadowColorStr = color;
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      const fullHex =
        hex.length === 3
          ? hex.split('').map((c) => c + c).join('')
          : hex;
      const r = parseInt(fullHex.substring(0, 2), 16) || 0;
      const g = parseInt(fullHex.substring(2, 4), 16) || 0;
      const b = parseInt(fullHex.substring(4, 6), 16) || 0;
      shadowColorStr = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${shadowColorStr}`,
    } as any;
  }

  return {
    shadowColor: color,
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  };
}

export function makeShadow(
  color: string = '#000000',
  offset: { width: number; height: number } = { width: 0, height: 2 },
  opacity: number = 0.25,
  radius: number = 4,
  elevation: number = 2
): ViewStyle {
  return getShadowStyle({ color, offset, opacity, radius, elevation });
}

