import React from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
  G,
} from 'react-native-svg';
import { RED_BAY_COLORS } from '../../../theme/colors';

export const KioskBackground: React.FC = () => {
  const { width, height } = useWindowDimensions();

  // Dynamic sizing based on viewport
  const redOrbR = Math.min(width * 0.26, 195);
  const blackOrbR = Math.min(width * 0.32, 235);
  const topRedR = Math.min(width * 0.18, 130);
  const topBlackR = Math.min(width * 0.20, 145);
  const midRedR = Math.min(width * 0.11, 75);
  const midBlackR = Math.min(width * 0.08, 52);

  const roadWidthBottom = Math.min(width * 0.07, 44);
  const roadWidthTop = Math.min(width * 0.05, 32);

  return (
    <View style={styles.backgroundLayer} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
        <Defs>
          {/* 1. Base White-to-Cool-Grey Automotive Canvas */}
          <LinearGradient id="kioskSurfaceBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="25%" stopColor="#F8FAFC" stopOpacity="1" />
            <Stop offset="65%" stopColor="#F1F5F9" stopOpacity="1" />
            <Stop offset="100%" stopColor="#E2E8F0" stopOpacity="1" />
          </LinearGradient>

          {/* 2. Top Red Bay Racing Ambient Glow */}
          <RadialGradient id="topRedGlow" cx="50%" cy="0%" r="55%">
            <Stop offset="0%" stopColor={RED_BAY_COLORS.primary} stopOpacity="0.14" />
            <Stop offset="60%" stopColor={RED_BAY_COLORS.primary} stopOpacity="0.04" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>

          {/* 3. Rich Red Bay Racing Red Radial Orb (Darkened/Intensified) */}
          <RadialGradient id="redOrbGradDark" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={RED_BAY_COLORS.primary} stopOpacity="0.32" />
            <Stop offset="55%" stopColor={RED_BAY_COLORS.primary} stopOpacity="0.14" />
            <Stop offset="100%" stopColor={RED_BAY_COLORS.primary} stopOpacity="0" />
          </RadialGradient>

          {/* 4. Deep Pitch Black / Asphalt Radial Orb (Darkened/Intensified) */}
          <RadialGradient id="blackOrbGradDark" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#0B0F19" stopOpacity="0.26" />
            <Stop offset="60%" stopColor="#1E293B" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#080808" stopOpacity="0" />
          </RadialGradient>

          {/* 5. Asphalt Road Gradient */}
          <LinearGradient id="asphaltRoadGrad" x1="0%" y1="0%" x2="100%" y2="50%">
            <Stop offset="0%" stopColor="#0F172A" stopOpacity="0.30" />
            <Stop offset="50%" stopColor="#1E293B" stopOpacity="0.38" />
            <Stop offset="100%" stopColor="#0F172A" stopOpacity="0.28" />
          </LinearGradient>

          {/* 6. Top Road Track Gradient */}
          <LinearGradient id="topRoadGrad" x1="0%" y1="0%" x2="100%" y2="80%">
            <Stop offset="0%" stopColor="#1E293B" stopOpacity="0.22" />
            <Stop offset="50%" stopColor="#0F172A" stopOpacity="0.32" />
            <Stop offset="100%" stopColor="#1E293B" stopOpacity="0.20" />
          </LinearGradient>

          {/* 7. Red Racing Curb Gradient */}
          <LinearGradient id="redCurbGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={RED_BAY_COLORS.primary} stopOpacity="0.75" />
            <Stop offset="50%" stopColor={RED_BAY_COLORS.primary} stopOpacity="0.95" />
            <Stop offset="100%" stopColor={RED_BAY_COLORS.primary} stopOpacity="0.70" />
          </LinearGradient>

          {/* 8. Black Edge Curb Gradient */}
          <LinearGradient id="blackCurbGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#080808" stopOpacity="0.65" />
            <Stop offset="50%" stopColor="#1E293B" stopOpacity="0.80" />
            <Stop offset="100%" stopColor="#080808" stopOpacity="0.60" />
          </LinearGradient>
        </Defs>

        {/* --- Background Base Canvas --- */}
        <Rect width="100%" height="100%" fill="url(#kioskSurfaceBg)" />

        {/* --- Top Red Bay Red Ambient Flare --- */}
        <Rect width="100%" height="40%" fill="url(#topRedGlow)" />

        {/* ======================================================== */}
        {/* UPPER SIDE ROAD TRACK & CORNER ACCENTS                   */}
        {/* ======================================================== */}
        <G>
          {/* Upper Sweeping Asphalt Road Track */}
          <Path
            d={`M ${width * 0.45},-25 Q ${width * 0.78},${height * 0.15} ${width + 30},${height * 0.10}`}
            stroke="url(#topRoadGrad)"
            strokeWidth={roadWidthTop}
            fill="none"
          />
          {/* Upper Road Outer Red Racing Curb */}
          <Path
            d={`M ${width * 0.45 - 8},-25 Q ${width * 0.78 - 6},${height * 0.15 - roadWidthTop * 0.48} ${width + 30},${height * 0.10 - roadWidthTop * 0.48}`}
            stroke="url(#redCurbGrad)"
            strokeWidth="2.5"
            fill="none"
          />
          {/* Upper Road Center White Dashed Lane Line */}
          <Path
            d={`M ${width * 0.45},-25 Q ${width * 0.78},${height * 0.15} ${width + 30},${height * 0.10}`}
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeDasharray="12, 10"
            strokeOpacity="0.85"
            fill="none"
          />
          {/* Upper Road Inner Black Curb */}
          <Path
            d={`M ${width * 0.45 + 8},-25 Q ${width * 0.78 + 6},${height * 0.15 + roadWidthTop * 0.48} ${width + 30},${height * 0.10 + roadWidthTop * 0.48}`}
            stroke="url(#blackCurbGrad)"
            strokeWidth="2.2"
            fill="none"
          />

          {/* Upper-Left Red & Black Road Curve */}
          <Path
            d={`M -25,${height * 0.18} Q ${width * 0.16},${height * 0.13} ${width * 0.32},-25`}
            stroke="url(#topRoadGrad)"
            strokeWidth={roadWidthTop * 0.85}
            fill="none"
          />
          {/* Upper-Left White Dashed Line */}
          <Path
            d={`M -25,${height * 0.18} Q ${width * 0.16},${height * 0.13} ${width * 0.32},-25`}
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeDasharray="10, 8"
            strokeOpacity="0.80"
            fill="none"
          />
          {/* Upper-Left Red Edge Curb */}
          <Path
            d={`M -25,${height * 0.18 + roadWidthTop * 0.42} Q ${width * 0.16},${height * 0.13 + roadWidthTop * 0.42} ${width * 0.32 + 8},-25`}
            stroke={RED_BAY_COLORS.primary}
            strokeWidth="2.2"
            strokeOpacity="0.65"
            fill="none"
          />

          {/* Upper-Left Corner Accent Rings (Red & Black) */}
          <Circle cx={width * 0.05} cy={height * 0.06} r={topRedR} fill="url(#redOrbGradDark)" />
          <Circle
            cx={width * 0.05}
            cy={height * 0.06}
            r={topRedR * 0.82}
            stroke={RED_BAY_COLORS.primary}
            strokeWidth="2.2"
            strokeOpacity="0.55"
            fill="none"
          />
          <Circle
            cx={width * 0.05}
            cy={height * 0.06}
            r={topRedR * 0.55}
            stroke="#080808"
            strokeWidth="1.8"
            strokeOpacity="0.45"
            fill="none"
          />

          {/* Upper-Right Corner Accent Rings (Black & Red) */}
          <Circle cx={width * 0.94} cy={height * 0.05} r={topBlackR} fill="url(#blackOrbGradDark)" />
          <Circle
            cx={width * 0.94}
            cy={height * 0.05}
            r={topBlackR * 0.82}
            stroke="#080808"
            strokeWidth="2.4"
            strokeOpacity="0.55"
            fill="none"
          />
          <Circle
            cx={width * 0.94}
            cy={height * 0.05}
            r={topBlackR * 0.56}
            stroke={RED_BAY_COLORS.primary}
            strokeWidth="1.8"
            strokeOpacity="0.60"
            strokeDasharray="7, 5"
            fill="none"
          />
        </G>

        {/* ======================================================== */}
        {/* BOTTOM SIDE ROAD TRACK & CORNER ACCENTS                   */}
        {/* ======================================================== */}
        <G>
          {/* Sweeping Highway / Road Bed Across Bottom */}
          <Path
            d={`M -30,${height * 0.90} Q ${width * 0.45},${height * 0.77} ${width + 30},${height * 0.88}`}
            stroke="url(#asphaltRoadGrad)"
            strokeWidth={roadWidthBottom}
            fill="none"
          />

          {/* Road Outer Red Racing Curb */}
          <Path
            d={`M -30,${height * 0.90 - roadWidthBottom * 0.48} Q ${width * 0.45},${height * 0.77 - roadWidthBottom * 0.48} ${width + 30},${height * 0.88 - roadWidthBottom * 0.48}`}
            stroke="url(#redCurbGrad)"
            strokeWidth="3.0"
            fill="none"
          />

          {/* Center Road White Dashed Lane Dividers */}
          <Path
            d={`M -30,${height * 0.90} Q ${width * 0.45},${height * 0.77} ${width + 30},${height * 0.88}`}
            stroke="#FFFFFF"
            strokeWidth="3.0"
            strokeDasharray="16, 12"
            strokeOpacity="0.90"
            fill="none"
          />

          {/* Road Inner Black / Charcoal Curb */}
          <Path
            d={`M -30,${height * 0.90 + roadWidthBottom * 0.48} Q ${width * 0.45},${height * 0.77 + roadWidthBottom * 0.48} ${width + 30},${height * 0.88 + roadWidthBottom * 0.48}`}
            stroke="url(#blackCurbGrad)"
            strokeWidth="2.6"
            fill="none"
          />

          {/* Bottom-Left: Signature Red Bay Red Circles & Road Rings (Darkened) */}
          <Circle cx={width * 0.06} cy={height * 0.91} r={redOrbR} fill="url(#redOrbGradDark)" />
          {/* Outer Red Ring */}
          <Circle
            cx={width * 0.06}
            cy={height * 0.91}
            r={redOrbR * 0.82}
            stroke={RED_BAY_COLORS.primary}
            strokeWidth="2.8"
            strokeOpacity="0.65"
            fill="none"
          />
          {/* Inner Red Ring */}
          <Circle
            cx={width * 0.06}
            cy={height * 0.91}
            r={redOrbR * 0.58}
            stroke={RED_BAY_COLORS.primary}
            strokeWidth="2.0"
            strokeOpacity="0.50"
            fill="none"
          />
          {/* Innermost Black Accent Ring */}
          <Circle
            cx={width * 0.06}
            cy={height * 0.91}
            r={redOrbR * 0.35}
            stroke="#080808"
            strokeWidth="1.6"
            strokeOpacity="0.38"
            fill="none"
          />

          {/* Bottom-Right: Deep Pitch Black / Asphalt Rings (Darkened) */}
          <Circle cx={width * 0.93} cy={height * 0.89} r={blackOrbR} fill="url(#blackOrbGradDark)" />
          {/* Outer Black Ring */}
          <Circle
            cx={width * 0.93}
            cy={height * 0.89}
            r={blackOrbR * 0.82}
            stroke="#080808"
            strokeWidth="3.2"
            strokeOpacity="0.65"
            fill="none"
          />
          {/* Inner Black Ring */}
          <Circle
            cx={width * 0.93}
            cy={height * 0.89}
            r={blackOrbR * 0.56}
            stroke="#080808"
            strokeWidth="2.2"
            strokeOpacity="0.45"
            fill="none"
          />
          {/* Intersecting Red Racing Arc with dashes */}
          <Circle
            cx={width * 0.90}
            cy={height * 0.91}
            r={blackOrbR * 0.70}
            stroke={RED_BAY_COLORS.primary}
            strokeWidth="2.4"
            strokeOpacity="0.75"
            strokeDasharray="8, 6"
            fill="none"
          />

          {/* Mid-Left Red Accent Ring */}
          <Circle cx={width * 0.24} cy={height * 0.96} r={midRedR} fill="url(#redOrbGradDark)" />
          <Circle
            cx={width * 0.24}
            cy={height * 0.96}
            r={midRedR * 0.82}
            stroke={RED_BAY_COLORS.primary}
            strokeWidth="2.0"
            strokeOpacity="0.55"
            fill="none"
          />

          {/* Mid-Right Black Accent Ring */}
          <Circle cx={width * 0.80} cy={height * 0.97} r={midBlackR} fill="url(#blackOrbGradDark)" />
          <Circle
            cx={width * 0.80}
            cy={height * 0.97}
            r={midBlackR * 0.84}
            stroke="#080808"
            strokeWidth="2.0"
            strokeOpacity="0.45"
            fill="none"
          />
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F1F5F9',
    zIndex: 0,
    ...(Platform.OS === 'web'
      ? ({
          // Web multi-layer CSS background with darkened Red, White, and Black road styling
          backgroundImage:
            'radial-gradient(ellipse 90% 40% at 50% 0%, rgba(242, 13, 32, 0.10) 0%, rgba(255, 255, 255, 0) 65%), ' +
            'radial-gradient(circle at 6% 92%, rgba(242, 13, 32, 0.16) 0%, rgba(255, 255, 255, 0) 45%), ' +
            'radial-gradient(circle at 93% 89%, rgba(11, 15, 25, 0.15) 0%, rgba(255, 255, 255, 0) 48%), ' +
            'radial-gradient(circle at 5% 5%, rgba(242, 13, 32, 0.12) 0%, rgba(255, 255, 255, 0) 35%), ' +
            'radial-gradient(circle at 95% 5%, rgba(11, 15, 25, 0.12) 0%, rgba(255, 255, 255, 0) 38%), ' +
            'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 28%, #F1F5F9 75%, #E2E8F0 100%)',
        } as any)
      : {}),
  },
});
