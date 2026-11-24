import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const resolveColor = (color?: string, fallback: string = '#0F172A'): string => {
  if (!color || color === 'currentColor') return fallback;
  return color;
};

// Helper to render pure vector SVG on Web and crisp fallback on native
const renderSvg = (
  size: number,
  viewBox: string,
  paths: Array<{ d: string; fill?: string; stroke?: string; strokeWidth?: number; strokeLinecap?: 'round' | 'butt'; strokeLinejoin?: 'round' | 'miter' }>,
  nativeIcon?: React.ReactNode
) => {
  if (Platform.OS === 'web') {
    return React.createElement(
      'svg',
      {
        width: size,
        height: size,
        viewBox,
        style: { display: 'inline-block', verticalAlign: 'middle' },
      },
      paths.map((p, i) =>
        React.createElement('path', {
          key: i,
          d: p.d,
          fill: p.fill || 'none',
          stroke: p.stroke || 'currentColor',
          strokeWidth: p.strokeWidth ?? 2,
          strokeLinecap: p.strokeLinecap || 'round',
          strokeLinejoin: p.strokeLinejoin || 'round',
        })
      )
    );
  }

  // Native rendering: use vector icon
  if (nativeIcon) {
    return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>{nativeIcon}</View>;
  }

  return <View style={{ width: size, height: size }} />;
};

// 1. Orders / Clipboard Icon
export const IconClipboard: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#0F172A');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', stroke: c, strokeWidth },
      { d: 'M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z', stroke: c, strokeWidth },
      { d: 'M9 12h6', stroke: c, strokeWidth },
      { d: 'M9 16h6', stroke: c, strokeWidth },
    ],
    <Ionicons name="clipboard-outline" size={size} color={c} />
  );
};

// 2. Bays / Car Wash Bay Icon
export const IconCarWashBay: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#0F172A');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M3 21h18', stroke: c, strokeWidth },
      { d: 'M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14', stroke: c, strokeWidth },
      { d: 'M9 9h6', stroke: c, strokeWidth },
      { d: 'M8 17h8', stroke: c, strokeWidth },
      { d: 'M10 13h4', stroke: c, strokeWidth },
    ],
    <MaterialCommunityIcons name="car-wash" size={size} color={c} />
  );
};

// 3. Customers / Users Icon
export const IconUsers: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#0F172A');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', stroke: c, strokeWidth },
      { d: 'M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', stroke: c, strokeWidth },
      { d: 'M22 21v-2a4 4 0 0 0-3-3.87', stroke: c, strokeWidth },
      { d: 'M16 3.13a4 4 0 0 1 0 7.75', stroke: c, strokeWidth },
    ],
    <Ionicons name="people-outline" size={size} color={c} />
  );
};

// 4. Reports / Bar Chart Icon
export const IconReports: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#0F172A');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M18 20V10', stroke: c, strokeWidth },
      { d: 'M12 20V4', stroke: c, strokeWidth },
      { d: 'M6 20v-6', stroke: c, strokeWidth },
      { d: 'M3 20h18', stroke: c, strokeWidth },
    ],
    <Ionicons name="bar-chart-outline" size={size} color={c} />
  );
};

// 5. Settings / Gear Icon
export const IconSettings: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#0F172A');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', stroke: c, strokeWidth },
      { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z', stroke: c, strokeWidth },
    ],
    <Ionicons name="settings-outline" size={size} color={c} />
  );
};

// 6. Sleek Modern Vehicle / Automobile Icon
export const IconAutomobile: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#0F172A');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H7c-.8 0-1.5.4-1.9 1L3.2 11.4C2.5 12 2 12.9 2 14v2c0 .6.4 1 1 1h2', stroke: c, strokeWidth },
      { d: 'M7 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', stroke: c, strokeWidth, fill: c },
      { d: 'M17 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', stroke: c, strokeWidth, fill: c },
      { d: 'M5 12h14', stroke: c, strokeWidth },
    ],
    <Ionicons name="car-sport-outline" size={size} color={c} />
  );
};

// 7. Checkmark Icon
export const IconCheck: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2.5 }) => {
  const c = resolveColor(color, '#10B981');
  return renderSvg(
    size,
    '0 0 24 24',
    [{ d: 'M20 6L9 17l-5-5', stroke: c, strokeWidth }],
    <Ionicons name="checkmark" size={size} color={c} />
  );
};

// 8. Clock / Time Icon
export const IconClock: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#64748B');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', stroke: c, strokeWidth },
      { d: 'M12 6v6l4 2', stroke: c, strokeWidth },
    ],
    <Ionicons name="time-outline" size={size} color={c} />
  );
};

// 9. Hourglass Icon
export const IconHourglass: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#F59E0B');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M5 22h14', stroke: c, strokeWidth },
      { d: 'M5 2h14', stroke: c, strokeWidth },
    ],
    <Ionicons name="hourglass-outline" size={size} color={c} />
  );
};

// 10. Water Droplet / Service Icon
export const IconDroplet: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#0284C7');
  return renderSvg(
    size,
    '0 0 24 24',
    [{ d: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z', stroke: c, strokeWidth, fill: c }],
    <Ionicons name="water" size={size} color={c} />
  );
};

// 11. Search Icon
export const IconSearch: React.FC<IconProps> = ({ size = 18, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#94A3B8');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', stroke: c, strokeWidth },
      { d: 'M21 21l-4.35-4.35', stroke: c, strokeWidth },
    ],
    <Ionicons name="search" size={size} color={c} />
  );
};

// 12. Sun / Day Mode Icon
export const IconSun: React.FC<IconProps> = ({ size = 18, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#F59E0B');
  return renderSvg(
    size,
    '0 0 24 24',
    [{ d: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', stroke: c, strokeWidth }],
    <Ionicons name="sunny-outline" size={size} color={c} />
  );
};

// 13. Notification Bell Icon
export const IconBell: React.FC<IconProps> = ({ size = 18, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#334155');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', stroke: c, strokeWidth },
      { d: 'M13.73 21a2 2 0 0 1-3.46 0', stroke: c, strokeWidth },
    ],
    <Ionicons name="notifications-outline" size={size} color={c} />
  );
};

// 14. Hamburger Menu Icon
export const IconMenu: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#FFFFFF');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M3 12h18', stroke: c, strokeWidth },
      { d: 'M3 6h18', stroke: c, strokeWidth },
      { d: 'M3 18h18', stroke: c, strokeWidth },
    ],
    <Ionicons name="menu" size={size} color={c} />
  );
};

// 15. More Vertical Dots Icon
export const IconMoreVertical: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => {
  const c = resolveColor(color, '#64748B');
  return renderSvg(
    size,
    '0 0 24 24',
    [{ d: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', stroke: c, strokeWidth: 2, fill: c }],
    <Ionicons name="ellipsis-vertical" size={size} color={c} />
  );
};

// 16. Grid Icon
export const IconGrid: React.FC<IconProps> = ({ size = 18, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#FFFFFF');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M3 3h7v7H3z', stroke: c, strokeWidth, fill: c },
      { d: 'M14 3h7v7H14z', stroke: c, strokeWidth, fill: c },
      { d: 'M14 14h7v7H14z', stroke: c, strokeWidth, fill: c },
      { d: 'M3 14h7v7H3z', stroke: c, strokeWidth, fill: c },
    ],
    <Ionicons name="grid-outline" size={size} color={c} />
  );
};

// 17. Summary Card 1: Total Orders
export const IconSummaryTotalOrders: React.FC<IconProps> = ({ size = 22, color = '#FFFFFF', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#FFFFFF');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z', stroke: c, strokeWidth, fill: c },
      { d: 'M16 4h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1', stroke: c, strokeWidth },
    ],
    <Ionicons name="receipt-outline" size={size} color={c} />
  );
};

// 18. Summary Card 2: Completed Badge
export const IconSummaryCompletedBadge: React.FC<IconProps> = ({ size = 22, color = '#FFFFFF', strokeWidth = 2.2 }) => {
  const c = resolveColor(color, '#FFFFFF');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M9 12l2 2 4-4', stroke: c, strokeWidth: 2.6 },
    ],
    <Ionicons name="checkmark-done-circle-outline" size={size} color={c} />
  );
};

// 19. Summary Card 3: In Service Car Wash
export const IconSummaryInServiceCarWash: React.FC<IconProps> = ({ size = 22, color = '#FFFFFF', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#FFFFFF');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M5 11.5h14a1.5 1.5 0 0 1 1.5 1.5v3.5a1 1 0 0 1-1 1h-.5v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2H9v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2H4.5a1 1 0 0 1-1-1V13a1.5 1.5 0 0 1 1.5-1.5z', stroke: c, strokeWidth },
    ],
    <MaterialCommunityIcons name="car-wash" size={size} color={c} />
  );
};

// 20. Summary Card 4: Pending Hourglass
export const IconSummaryPendingHourglass: React.FC<IconProps> = ({ size = 22, color = '#FFFFFF', strokeWidth = 2.2 }) => {
  const c = resolveColor(color, '#FFFFFF');
  return renderSvg(
    size,
    '0 0 24 24',
    [
      { d: 'M5 3h14', stroke: c, strokeWidth },
      { d: 'M5 21h14', stroke: c, strokeWidth },
    ],
    <Ionicons name="hourglass-outline" size={size} color={c} />
  );
};

// ================= BAY OVERVIEW VEHICLE RENDERS (WITH WATER SPLASH) =================

// Helper to render complex SVG elements on Web and sleek native card badge on Android/iOS
const renderComplexSvg = (
  width: number | string,
  height: number | string,
  viewBox: string,
  children: React.ReactNode,
  nativeFallback?: React.ReactNode
) => {
  if (Platform.OS === 'web') {
    return React.createElement(
      'svg',
      {
        width,
        height,
        viewBox,
        style: { display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' },
      },
      children
    );
  }
  return nativeFallback || <View style={{ width: typeof width === 'number' ? width : 120, height: typeof height === 'number' ? height : 60 }} />;
};

// 21. Bay 1: Glossy Black 3D SUV with Pink/Red Water Splash
export const VehicleSplashBlackSuv: React.FC<{ width?: number | string; height?: number | string }> = ({
  width = 136,
  height = 68,
}) => {
  const nativeBadge = (
    <View style={vehicleStyles.badgeContainer}>
      <View style={[vehicleStyles.iconCircle, { backgroundColor: '#18181B' }]}>
        <Ionicons name="car-sport" size={28} color="#FFFFFF" />
      </View>
      <View style={vehicleStyles.waterDroplets}>
        <Ionicons name="water" size={12} color="#EF4444" />
        <Ionicons name="sparkles" size={10} color="#F59E0B" />
      </View>
    </View>
  );

  const children = [
    React.createElement('ellipse', { key: 'shd', cx: '80', cy: '62', rx: '62', ry: '6', fill: '#0F172A', opacity: 0.35 }),
    React.createElement('circle', { key: 'rw1', cx: '118', cy: '53', r: '12', fill: '#09090B' }),
    React.createElement('circle', { key: 'fw1', cx: '44', cy: '53', r: '12', fill: '#09090B' }),
    React.createElement('path', {
      key: 'body',
      d: 'M22 45l4-12c2-5 6-7 12-8l34-4c6-1 12-4 16-9l12-1c4 0 8 2 12 5l18 11c6 3 10 9 10 16v7c0 2-2 4-4 4h-4a13 13 0 0 0-24 0H56a13 13 0 0 0-24 0h-6c-2 0-4-2-4-5v-4z',
      fill: '#18181B',
      stroke: '#3F3F46',
      strokeWidth: 1.2,
    }),
  ];

  return renderComplexSvg(width, height, '0 0 160 74', children, nativeBadge);
};

// 22. Bay 2: Sporty White 3D Sedan with Pink/Red Water Splash
export const VehicleSplashWhiteSedan: React.FC<{ width?: number | string; height?: number | string }> = ({
  width = 136,
  height = 68,
}) => {
  const nativeBadge = (
    <View style={vehicleStyles.badgeContainer}>
      <View style={[vehicleStyles.iconCircle, { backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#CBD5E1' }]}>
        <Ionicons name="car-sport" size={28} color="#0F172A" />
      </View>
      <View style={vehicleStyles.waterDroplets}>
        <Ionicons name="water" size={12} color="#3B82F6" />
        <Ionicons name="sparkles" size={10} color="#10B981" />
      </View>
    </View>
  );

  const children = [
    React.createElement('ellipse', { key: 'shd', cx: '80', cy: '62', rx: '62', ry: '6', fill: '#0F172A', opacity: 0.3 }),
    React.createElement('circle', { key: 'rw1', cx: '118', cy: '53', r: '12', fill: '#09090B' }),
    React.createElement('circle', { key: 'fw1', cx: '44', cy: '53', r: '12', fill: '#09090B' }),
    React.createElement('path', {
      key: 'body',
      d: 'M22 47l4-9c2-5 7-7 14-8l34-3c7-1 14-4 19-9l15-2c5 0 9 2 13 6l16 10c5 3 8 8 8 14v8c0 2-2 3-4 3h-4a13 13 0 0 0-24 0H56a13 13 0 0 0-24 0h-6c-2 0-4-1-4-4v-5z',
      fill: '#F8FAFC',
      stroke: '#CBD5E1',
      strokeWidth: 1.2,
    }),
  ];

  return renderComplexSvg(width, height, '0 0 160 74', children, nativeBadge);
};

// 23. Bay 3: Metallic Blue 3D Crossover/SUV with Pink/Red Water Splash
export const VehicleSplashBlueSuv: React.FC<{ width?: number | string; height?: number | string }> = ({
  width = 136,
  height = 68,
}) => {
  const nativeBadge = (
    <View style={vehicleStyles.badgeContainer}>
      <View style={[vehicleStyles.iconCircle, { backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#93C5FD' }]}>
        <Ionicons name="car-sport" size={28} color="#2563EB" />
      </View>
      <View style={vehicleStyles.waterDroplets}>
        <Ionicons name="water" size={12} color="#0284C7" />
        <Ionicons name="sparkles" size={10} color="#F59E0B" />
      </View>
    </View>
  );

  const children = [
    React.createElement('ellipse', { key: 'shd', cx: '80', cy: '62', rx: '62', ry: '6', fill: '#0F172A', opacity: 0.35 }),
    React.createElement('path', {
      key: 'body',
      d: 'M22 46l4-11c2-5 6-7 13-8l34-3c6-1 13-4 17-9l13-1c4 0 8 2 12 5l17 10c5 3 9 8 9 15v7c0 2-2 4-4 4h-4a13 13 0 0 0-24 0H56a13 13 0 0 0-24 0h-6c-2 0-4-2-4-4v-5z',
      fill: '#2563EB',
      stroke: '#1D4ED8',
      strokeWidth: 1.2,
    }),
  ];

  return renderComplexSvg(width, height, '0 0 160 74', children, nativeBadge);
};

// 24. Bay 4 & 5: Available Circle Badge with Sparkles ✨ and Front Car Silhouette
export const VehicleAvailableSparkle: React.FC<{ size?: number }> = ({ size = 68 }) => {
  const nativeBadge = (
    <View style={vehicleStyles.availableContainer}>
      <View style={vehicleStyles.availableCircle}>
        <Ionicons name="car-outline" size={26} color="#94A3B8" />
      </View>
      <View style={vehicleStyles.sparkleRow}>
        <Ionicons name="sparkles" size={12} color="#CBD5E1" />
      </View>
    </View>
  );

  const children = [
    React.createElement('circle', { key: 'circle', cx: '40', cy: '40', r: '28', fill: '#F1F5F9' }),
    React.createElement('path', {
      key: 'car',
      d: 'M29 44l2.5-7a2 2 0 0 1 1.9-1.3h13.2a2 2 0 0 1 1.9 1.3l2.5 7h1c.8 0 1.5.7 1.5 1.5v6c0 .8-.7 1.5-1.5 1.5h-1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2H34v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2h-1c-.8 0-1.5-.7-1.5-1.5v-6c0-.8.7-1.5 1.5-1.5h1z',
      fill: '#94A3B8',
    }),
  ];

  return renderComplexSvg(size, size, '0 0 80 80', children, nativeBadge);
};

// ==========================================
// LOGIN & OTHER DEDICATED ICONS
// ==========================================

// 25. User Silhouette Icon
export const IconUserOutline: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#0F172A');
  return renderSvg(
    size,
    '0 0 24 24',
    [{ d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', stroke: c, strokeWidth }],
    <Ionicons name="person-outline" size={size} color={c} />
  );
};

// 26. Padlock / Lock Icon
export const IconLockOutline: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#0F172A');
  return renderSvg(
    size,
    '0 0 24 24',
    [{ d: 'M7 11V7a5 5 0 0 1 10 0v4', stroke: c, strokeWidth }],
    <Ionicons name="lock-closed-outline" size={size} color={c} />
  );
};

// 27. Eye Outline (Show Password)
export const IconEye: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#64748B');
  return renderSvg(
    size,
    '0 0 24 24',
    [{ d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: c, strokeWidth }],
    <Ionicons name="eye-outline" size={size} color={c} />
  );
};

// 28. Eye Off (Hide Password)
export const IconEyeOff: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  const c = resolveColor(color, '#64748B');
  return renderSvg(
    size,
    '0 0 24 24',
    [{ d: 'M1 1l22 22', stroke: c, strokeWidth }],
    <Ionicons name="eye-off-outline" size={size} color={c} />
  );
};

// 29. Bold Arrow Right
export const IconArrowRight: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2.5 }) => {
  const c = resolveColor(color, '#FFFFFF');
  return renderSvg(
    size,
    '0 0 24 24',
    [{ d: 'M5 12h14', stroke: c, strokeWidth }],
    <Ionicons name="arrow-forward" size={size} color={c} />
  );
};

// 30. Water Droplet with Sparkle
export const IconWaterDropSparkle: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.8 }) => {
  const c = resolveColor(color, '#0284C7');
  return renderSvg(
    size,
    '0 0 24 24',
    [{ d: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z', stroke: c, strokeWidth }],
    <MaterialCommunityIcons name="water-check-outline" size={size} color={c} />
  );
};

// 31. Shield with Checkmark
export const IconShieldCheckmark: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.8 }) => {
  const c = resolveColor(color, '#10B981');
  return renderSvg(
    size,
    '0 0 24 24',
    [{ d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', stroke: c, strokeWidth }],
    <Ionicons name="shield-checkmark-outline" size={size} color={c} />
  );
};

// 32. Eco Leaf Outline
export const IconEcoLeaf: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.8 }) => {
  const c = resolveColor(color, '#10B981');
  return renderSvg(
    size,
    '0 0 24 24',
    [{ d: 'M11 20A7 7 0 0 1 4 13C4 8.5 7.5 4 13.5 3c2.5 0 6.5.5 6.5.5s-.5 4-1.5 6.5c-1.5 3.5-4 6-7.5 7z', stroke: c, strokeWidth }],
    <Ionicons name="leaf-outline" size={size} color={c} />
  );
};

const vehicleStyles = StyleSheet.create({
  badgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 4,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
        }),
  },
  waterDroplets: {
    position: 'absolute',
    top: 0,
    right: 28,
    flexDirection: 'row',
    gap: 2,
  },
  availableContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  availableCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sparkleRow: {
    position: 'absolute',
    top: 2,
    right: 26,
  },
});
