import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
} from 'react-native-svg';
import { RED_BAY_COLORS } from '../../../theme/colors';

export const KioskBackground: React.FC = () => {
  const { width, height } = useWindowDimensions();

  // Dynamic heights for responsive rendering
  const topSwooshHeight = Math.min(Math.max(height * 0.055, 45), 75);
  const bottomWavesHeight = Math.min(Math.max(height * 0.16, 120), 220);

  return (
    <View style={styles.backgroundLayer} pointerEvents="none">
      {/* 1. Base Off-White / Soft Light Canvas */}
      <View style={styles.canvasBase} />

      {/* 2. Top Arching Red Swoosh */}
      <Svg
        width={width}
        height={topSwooshHeight}
        style={styles.topSvg}
      >
        <Defs>
          <LinearGradient id="kioskTopRedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#BE123C" stopOpacity="1" />
            <Stop offset="30%" stopColor={RED_BAY_COLORS.primary} stopOpacity="1" />
            <Stop offset="70%" stopColor="#EF4444" stopOpacity="1" />
            <Stop offset="100%" stopColor="#BE123C" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Path
          d={`M 0,0 L ${width},0 L ${width},${topSwooshHeight * 0.45} Q ${width * 0.5},${topSwooshHeight} 0,${topSwooshHeight * 0.45} Z`}
          fill="url(#kioskTopRedGrad)"
        />
      </Svg>

      {/* 3. Bottom Layered Racing Wave Swooshes (Red on Charcoal) */}
      <Svg
        width={width}
        height={bottomWavesHeight}
        style={styles.bottomSvg}
      >
        <Defs>
          <LinearGradient id="kioskBottomRedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#BE123C" stopOpacity="1" />
            <Stop offset="45%" stopColor={RED_BAY_COLORS.primary} stopOpacity="1" />
            <Stop offset="100%" stopColor="#F43F5E" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="kioskBottomDarkGrad" x1="0%" y1="0%" x2="100%" y2="50%">
            <Stop offset="0%" stopColor="#0B0F19" stopOpacity="0.95" />
            <Stop offset="50%" stopColor="#1E293B" stopOpacity="0.98" />
            <Stop offset="100%" stopColor="#090D16" stopOpacity="0.95" />
          </LinearGradient>
        </Defs>

        {/* Charcoal / Asphalt Wave Layer */}
        <Path
          d={`M -20,${bottomWavesHeight * 0.65} Q ${width * 0.28},${bottomWavesHeight * 0.95} ${width + 20},${bottomWavesHeight * 0.45} L ${width + 20},${bottomWavesHeight + 10} L -20,${bottomWavesHeight + 10} Z`}
          fill="url(#kioskBottomDarkGrad)"
        />

        {/* Dynamic Racing Red Swoosh Wave */}
        <Path
          d={`M -20,${bottomWavesHeight * 0.42} Q ${width * 0.48},${bottomWavesHeight * 1.05} ${width + 20},${bottomWavesHeight * 0.35} L ${width + 20},${bottomWavesHeight + 10} L -20,${bottomWavesHeight + 10} Z`}
          fill="url(#kioskBottomRedGrad)"
        />

        {/* White Accent Highlight Stripe */}
        <Path
          d={`M -20,${bottomWavesHeight * 0.42} Q ${width * 0.48},${bottomWavesHeight * 1.05} ${width + 20},${bottomWavesHeight * 0.35}`}
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeOpacity="0.9"
          fill="none"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: 'hidden',
  },
  canvasBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFC',
  },
  topSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  bottomSvg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
});
