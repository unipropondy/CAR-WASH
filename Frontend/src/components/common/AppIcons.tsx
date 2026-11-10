import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Helper to render pure vector SVG on Web and crisp fallback on native
const renderSvg = (
  size: number,
  viewBox: string,
  paths: Array<{ d: string; fill?: string; stroke?: string; strokeWidth?: number; strokeLinecap?: 'round' | 'butt'; strokeLinejoin?: 'round' | 'miter' }>
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

  // Fallback container
  return <View style={{ width: size, height: size }} />;
};

// 1. Orders / Clipboard Icon
export const IconClipboard: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', stroke: color, strokeWidth },
    { d: 'M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z', stroke: color, strokeWidth },
    { d: 'M9 12h6', stroke: color, strokeWidth },
    { d: 'M9 16h6', stroke: color, strokeWidth },
  ]);
};

// 2. Bays / Car Wash Bay Icon
export const IconCarWashBay: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M3 21h18', stroke: color, strokeWidth },
    { d: 'M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14', stroke: color, strokeWidth },
    { d: 'M9 9h6', stroke: color, strokeWidth },
    { d: 'M8 17h8', stroke: color, strokeWidth },
    { d: 'M10 13h4', stroke: color, strokeWidth },
  ]);
};

// 3. Customers / Users Icon
export const IconUsers: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', stroke: color, strokeWidth },
    { d: 'M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', stroke: color, strokeWidth },
    { d: 'M22 21v-2a4 4 0 0 0-3-3.87', stroke: color, strokeWidth },
    { d: 'M16 3.13a4 4 0 0 1 0 7.75', stroke: color, strokeWidth },
  ]);
};

// 4. Reports / Bar Chart Icon
export const IconReports: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M18 20V10', stroke: color, strokeWidth },
    { d: 'M12 20V4', stroke: color, strokeWidth },
    { d: 'M6 20v-6', stroke: color, strokeWidth },
    { d: 'M3 20h18', stroke: color, strokeWidth },
  ]);
};

// 5. Settings / Gear Icon
export const IconSettings: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z', stroke: color, strokeWidth },
    { d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', stroke: color, strokeWidth },
  ]);
};

// 6. Sleek Modern Vehicle / Automobile Icon (Crisp vector car silhouette)
export const IconAutomobile: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H7c-.8 0-1.5.4-1.9 1L3.2 11.4C2.5 12 2 12.9 2 14v2c0 .6.4 1 1 1h2', stroke: color, strokeWidth },
    { d: 'M7 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', stroke: color, strokeWidth, fill: color },
    { d: 'M17 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', stroke: color, strokeWidth, fill: color },
    { d: 'M5 12h14', stroke: color, strokeWidth },
  ]);
};

// 7. Checkmark Icon
export const IconCheck: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2.5 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M20 6L9 17l-5-5', stroke: color, strokeWidth },
  ]);
};

// 8. Clock / Time Icon
export const IconClock: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', stroke: color, strokeWidth },
    { d: 'M12 6v6l4 2', stroke: color, strokeWidth },
  ]);
};

// 9. Hourglass Icon
export const IconHourglass: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M5 22h14', stroke: color, strokeWidth },
    { d: 'M5 2h14', stroke: color, strokeWidth },
    { d: 'M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22', stroke: color, strokeWidth },
    { d: 'M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2', stroke: color, strokeWidth },
  ]);
};

// 10. Water Droplet / Service Icon
export const IconDroplet: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z', stroke: color, strokeWidth, fill: color },
  ]);
};

// 11. Search Icon
export const IconSearch: React.FC<IconProps> = ({ size = 18, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', stroke: color, strokeWidth },
    { d: 'M21 21l-4.35-4.35', stroke: color, strokeWidth },
  ]);
};

// 12. Sun / Day Mode Icon
export const IconSun: React.FC<IconProps> = ({ size = 18, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', stroke: color, strokeWidth },
    { d: 'M12 1v2', stroke: color, strokeWidth },
    { d: 'M12 21v2', stroke: color, strokeWidth },
    { d: 'M4.22 4.22l1.42 1.42', stroke: color, strokeWidth },
    { d: 'M18.36 18.36l1.42 1.42', stroke: color, strokeWidth },
    { d: 'M1 12h2', stroke: color, strokeWidth },
    { d: 'M21 12h2', stroke: color, strokeWidth },
    { d: 'M4.22 19.78l1.42-1.42', stroke: color, strokeWidth },
    { d: 'M18.36 5.64l1.42-1.42', stroke: color, strokeWidth },
  ]);
};

// 13. Notification Bell Icon
export const IconBell: React.FC<IconProps> = ({ size = 18, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', stroke: color, strokeWidth },
    { d: 'M13.73 21a2 2 0 0 1-3.46 0', stroke: color, strokeWidth },
  ]);
};

// 14. Hamburger Menu Icon
export const IconMenu: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M3 12h18', stroke: color, strokeWidth },
    { d: 'M3 6h18', stroke: color, strokeWidth },
    { d: 'M3 18h18', stroke: color, strokeWidth },
  ]);
};

// 15. More Vertical Dots Icon
export const IconMoreVertical: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', stroke: color, strokeWidth: 2, fill: color },
    { d: 'M12 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', stroke: color, strokeWidth: 2, fill: color },
    { d: 'M12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', stroke: color, strokeWidth: 2, fill: color },
  ]);
};

// 16. Grid Icon
export const IconGrid: React.FC<IconProps> = ({ size = 18, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M3 3h7v7H3z', stroke: color, strokeWidth, fill: color },
    { d: 'M14 3h7v7H14z', stroke: color, strokeWidth, fill: color },
    { d: 'M14 14h7v7H14z', stroke: color, strokeWidth, fill: color },
    { d: 'M3 14h7v7H3z', stroke: color, strokeWidth, fill: color },
  ]);
};

// 17. Summary Card 1: Total Orders - Clipboard with Checklist
export const IconSummaryTotalOrders: React.FC<IconProps> = ({ size = 22, color = '#FFFFFF', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    // Top Clip
    { d: 'M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z', stroke: color, strokeWidth, fill: color },
    // Board Outline
    { d: 'M16 4h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1', stroke: color, strokeWidth },
    // Bullet 1 & Line 1
    { d: 'M8.5 9h.01', stroke: color, strokeWidth: 3 },
    { d: 'M11.5 9h4.5', stroke: color, strokeWidth },
    // Bullet 2 & Line 2
    { d: 'M8.5 13h.01', stroke: color, strokeWidth: 3 },
    { d: 'M11.5 13h4.5', stroke: color, strokeWidth },
    // Bullet 3 & Line 3
    { d: 'M8.5 17h.01', stroke: color, strokeWidth: 3 },
    { d: 'M11.5 17h4.5', stroke: color, strokeWidth },
  ]);
};

// 18. Summary Card 2: Completed - Scalloped Verified Check Badge
export const IconSummaryCompletedBadge: React.FC<IconProps> = ({ size = 22, color = '#FFFFFF', strokeWidth = 2.2 }) => {
  return renderSvg(size, '0 0 24 24', [
    // Scalloped Badge Outline
    {
      d: 'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z',
      stroke: color,
      strokeWidth,
    },
    // Checkmark inside badge
    { d: 'M9 12l2 2 4-4', stroke: color, strokeWidth: 2.6 },
  ]);
};

// 19. Summary Card 3: In Service - Front Car with Wash Bubbles/Foam
export const IconSummaryInServiceCarWash: React.FC<IconProps> = ({ size = 22, color = '#FFFFFF', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    // Center Foam Bubble
    { d: 'M12 2.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z', stroke: color, strokeWidth: 1.8, fill: color },
    // Left Foam Bubble
    { d: 'M8 4.8a1 1 0 1 0 0 2 1 1 0 0 0 0-2z', stroke: color, strokeWidth: 1.8, fill: color },
    // Right Foam Bubble
    { d: 'M16 4.8a1 1 0 1 0 0 2 1 1 0 0 0 0-2z', stroke: color, strokeWidth: 1.8, fill: color },
    // Car Roof Slopes
    { d: 'M7 11.5l1.8-3.2a1 1 0 0 1 .9-.5h4.6a1 1 0 0 1 .9.5l1.8 3.2', stroke: color, strokeWidth },
    // Car Body
    { d: 'M5 11.5h14a1.5 1.5 0 0 1 1.5 1.5v3.5a1 1 0 0 1-1 1h-.5v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2H9v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2H4.5a1 1 0 0 1-1-1V13a1.5 1.5 0 0 1 1.5-1.5z', stroke: color, strokeWidth },
    // Windshield divider
    { d: 'M6.5 11.5h11', stroke: color, strokeWidth: 1.5 },
    // Left & Right Headlights
    { d: 'M6.5 14.8h.01', stroke: color, strokeWidth: 2.8 },
    { d: 'M17.5 14.8h.01', stroke: color, strokeWidth: 2.8 },
  ]);
};

// 20. Summary Card 4: Pending - Classic Hourglass
export const IconSummaryPendingHourglass: React.FC<IconProps> = ({ size = 22, color = '#FFFFFF', strokeWidth = 2.2 }) => {
  return renderSvg(size, '0 0 24 24', [
    // Top & Bottom Horizontal Plates
    { d: 'M5 3h14', stroke: color, strokeWidth },
    { d: 'M5 21h14', stroke: color, strokeWidth },
    // Glass Symmetrical Contour
    { d: 'M6 3v4a3 3 0 0 0 1 2.2L11 12l-4 2.8A3 3 0 0 0 6 17v4h12v-4a3 3 0 0 0-1-2.2L13 12l4-2.8A3 3 0 0 0 18 7V3H6z', stroke: color, strokeWidth },
  ]);
};

// ================= BAY OVERVIEW VEHICLE RENDERS (WITH WATER SPLASH) =================

// Helper to render complex SVG elements on Web
const renderComplexSvg = (
  width: number | string,
  height: number | string,
  viewBox: string,
  children: React.ReactNode
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
  return <View style={{ width: typeof width === 'number' ? width : 130, height: typeof height === 'number' ? height : 64 }} />;
};

// 21. Bay 1: Glossy Black 3D SUV with Pink/Red Water Splash
export const VehicleSplashBlackSuv: React.FC<{ width?: number | string; height?: number | string }> = ({
  width = 136,
  height = 68,
}) => {
  const children = [
    // Splash Water Droplets & Spray Backdrop
    React.createElement('path', {
      key: 'splash1',
      d: 'M18 42c-5-8-2-18 6-22 9-5 18 2 24 8 8-8 22-9 32-3 8-10 24-12 34-4 8-8 21-8 28 0 8 9 6 22-2 30-8 8-22 9-32 3-8 9-22 10-32 2-8 7-20 6-28-2-8-6-15-4-30-12z',
      fill: '#FEE2E2',
      opacity: 0.65,
    }),
    React.createElement('path', {
      key: 'splash_spray',
      d: 'M14 26a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM26 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM138 22a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM146 36a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 52a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM148 50a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
      fill: '#FCA5A5',
      opacity: 0.8,
    }),
    // Ground Shadow
    React.createElement('ellipse', { key: 'shd', cx: '80', cy: '62', rx: '62', ry: '6', fill: '#0F172A', opacity: 0.35 }),
    // Rear Wheel
    React.createElement('circle', { key: 'rw1', cx: '118', cy: '53', r: '12', fill: '#09090B' }),
    React.createElement('circle', { key: 'rw2', cx: '118', cy: '53', r: '7.5', fill: '#71717A' }),
    React.createElement('circle', { key: 'rw3', cx: '118', cy: '53', r: '3.5', fill: '#E2E8F0' }),
    // Front Wheel
    React.createElement('circle', { key: 'fw1', cx: '44', cy: '53', r: '12', fill: '#09090B' }),
    React.createElement('circle', { key: 'fw2', cx: '44', cy: '53', r: '7.5', fill: '#71717A' }),
    React.createElement('circle', { key: 'fw3', cx: '44', cy: '53', r: '3.5', fill: '#E2E8F0' }),
    // Car Main Body (Glossy Black Fortuner / Land Cruiser SUV silhouette)
    React.createElement('path', {
      key: 'body',
      d: 'M22 45l4-12c2-5 6-7 12-8l34-4c6-1 12-4 16-9l12-1c4 0 8 2 12 5l18 11c6 3 10 9 10 16v7c0 2-2 4-4 4h-4a13 13 0 0 0-24 0H56a13 13 0 0 0-24 0h-6c-2 0-4-2-4-5v-4z',
      fill: '#18181B',
      stroke: '#3F3F46',
      strokeWidth: 1.2,
    }),
    // Windshield & Glass
    React.createElement('path', {
      key: 'glass',
      d: 'M40 25l28-3c4 0 8-2 11-5l10-1c3 0 6 1 8 4l12 8c2 2 3 5 3 8H36c0-4 1-8 4-11z',
      fill: '#0F172A',
      stroke: '#38BDF8',
      strokeWidth: 0.8,
    }),
    // Windshield Sky Reflection Highlight
    React.createElement('path', {
      key: 'refl',
      d: 'M54 24l16-2 18 11-12 1-22-10z',
      fill: '#38BDF8',
      opacity: 0.35,
    }),
    // Front Grille & Chrome Badge
    React.createElement('path', { key: 'grille', d: 'M22 39h14v8H22z', fill: '#27272A', stroke: '#71717A', strokeWidth: 0.8 }),
    React.createElement('ellipse', { key: 'badge', cx: '29', cy: '43', rx: '3', ry: '2', fill: '#E2E8F0' }),
    // Headlights
    React.createElement('path', {
      key: 'hl',
      d: 'M23 35l9-2c2 0 4 1 5 3l-1 4-13-1v-4z',
      fill: '#F8FAFC',
      stroke: '#38BDF8',
      strokeWidth: 0.8,
    }),
    // Door Lines & Handles
    React.createElement('path', { key: 'lines', d: 'M70 29v22M96 28v23M58 37h6M84 36h6', stroke: '#27272A', strokeWidth: 1 }),
    // Roof Rail
    React.createElement('path', { key: 'rail', d: 'M62 13h34c2 0 4 1 5 3', stroke: '#A1A1AA', strokeWidth: 1.5, strokeLinecap: 'round' }),
  ];

  return renderComplexSvg(width, height, '0 0 160 74', children);
};

// 22. Bay 2: Sporty White 3D Sedan with Pink/Red Water Splash
export const VehicleSplashWhiteSedan: React.FC<{ width?: number | string; height?: number | string }> = ({
  width = 136,
  height = 68,
}) => {
  const children = [
    // Splash Water Droplets & Spray Backdrop
    React.createElement('path', {
      key: 'splash1',
      d: 'M16 40c-6-8-3-17 5-21 8-5 17 2 23 7 8-7 21-8 30-3 8-9 23-11 33-4 8-8 20-8 27 0 8 9 6 21-2 29-7 7-21 8-31 3-7 8-21 9-31 2-8 6-19 5-27-2-7-6-14-4-27-11z',
      fill: '#FEE2E2',
      opacity: 0.65,
    }),
    React.createElement('path', {
      key: 'splash_spray',
      d: 'M12 24a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM28 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM136 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM144 34a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10 50a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
      fill: '#FCA5A5',
      opacity: 0.8,
    }),
    // Ground Shadow
    React.createElement('ellipse', { key: 'shd', cx: '80', cy: '62', rx: '62', ry: '6', fill: '#0F172A', opacity: 0.3 }),
    // Rear Wheel
    React.createElement('circle', { key: 'rw1', cx: '118', cy: '53', r: '12', fill: '#09090B' }),
    React.createElement('circle', { key: 'rw2', cx: '118', cy: '53', r: '7.5', fill: '#CBD5E1' }),
    React.createElement('circle', { key: 'rw3', cx: '118', cy: '53', r: '3.5', fill: '#1E293B' }),
    // Front Wheel
    React.createElement('circle', { key: 'fw1', cx: '44', cy: '53', r: '12', fill: '#09090B' }),
    React.createElement('circle', { key: 'fw2', cx: '44', cy: '53', r: '7.5', fill: '#CBD5E1' }),
    React.createElement('circle', { key: 'fw3', cx: '44', cy: '53', r: '3.5', fill: '#1E293B' }),
    // White Sedan Body (BMW 3 Series Style)
    React.createElement('path', {
      key: 'body',
      d: 'M22 47l4-9c2-5 7-7 14-8l34-3c7-1 14-4 19-9l15-2c5 0 9 2 13 6l16 10c5 3 8 8 8 14v8c0 2-2 3-4 3h-4a13 13 0 0 0-24 0H56a13 13 0 0 0-24 0h-6c-2 0-4-1-4-4v-5z',
      fill: '#F8FAFC',
      stroke: '#CBD5E1',
      strokeWidth: 1.2,
    }),
    // Windshield & Glass
    React.createElement('path', {
      key: 'glass',
      d: 'M44 29l28-2c4 0 8-2 12-5l12-1c3 0 6 1 9 4l12 7c2 2 3 5 3 7H40c0-3 1-7 4-10z',
      fill: '#1E293B',
      stroke: '#94A3B8',
      strokeWidth: 0.8,
    }),
    // Glass Sky Reflection
    React.createElement('path', {
      key: 'refl',
      d: 'M58 28l16-2 16 9-10 1-22-8z',
      fill: '#60A5FA',
      opacity: 0.4,
    }),
    // Dual Kidney Grille
    React.createElement('path', { key: 'grille1', d: 'M23 41h6v7h-6z', fill: '#0F172A', stroke: '#64748B', strokeWidth: 0.8 }),
    React.createElement('path', { key: 'grille2', d: 'M31 41h6v7h-6z', fill: '#0F172A', stroke: '#64748B', strokeWidth: 0.8 }),
    // Headlights with Angel Eyes
    React.createElement('path', {
      key: 'hl',
      d: 'M24 37l10-2c2 0 4 1 5 3l-1 3-14 0v-4z',
      fill: '#FFFFFF',
      stroke: '#38BDF8',
      strokeWidth: 0.8,
    }),
    // Door Line & Handles
    React.createElement('path', { key: 'door', d: 'M74 32v19M100 31v20M62 39h6M88 38h6', stroke: '#E2E8F0', strokeWidth: 1.2 }),
  ];

  return renderComplexSvg(width, height, '0 0 160 74', children);
};

// 23. Bay 3: Metallic Blue 3D Crossover/SUV with Pink/Red Water Splash
export const VehicleSplashBlueSuv: React.FC<{ width?: number | string; height?: number | string }> = ({
  width = 136,
  height = 68,
}) => {
  const children = [
    // Splash Water Droplets & Spray Backdrop
    React.createElement('path', {
      key: 'splash1',
      d: 'M17 41c-5-8-2-17 6-21 9-5 18 2 24 7 8-7 22-8 31-3 8-9 23-11 34-4 8-8 21-8 28 0 8 9 6 21-2 29-8 8-22 9-32 3-8 9-22 10-32 2-8 7-20 6-28-2-8-6-15-4-29-11z',
      fill: '#FEE2E2',
      opacity: 0.65,
    }),
    React.createElement('path', {
      key: 'splash_spray',
      d: 'M13 25a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM27 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM137 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM145 35a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 51a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
      fill: '#FCA5A5',
      opacity: 0.8,
    }),
    // Ground Shadow
    React.createElement('ellipse', { key: 'shd', cx: '80', cy: '62', rx: '62', ry: '6', fill: '#0F172A', opacity: 0.35 }),
    // Rear Wheel
    React.createElement('circle', { key: 'rw1', cx: '118', cy: '53', r: '12', fill: '#09090B' }),
    React.createElement('circle', { key: 'rw2', cx: '118', cy: '53', r: '7.5', fill: '#94A3B8' }),
    React.createElement('circle', { key: 'rw3', cx: '118', cy: '53', r: '3.5', fill: '#2563EB' }),
    // Front Wheel
    React.createElement('circle', { key: 'fw1', cx: '44', cy: '53', r: '12', fill: '#09090B' }),
    React.createElement('circle', { key: 'fw2', cx: '44', cy: '53', r: '7.5', fill: '#94A3B8' }),
    React.createElement('circle', { key: 'fw3', cx: '44', cy: '53', r: '3.5', fill: '#2563EB' }),
    // Metallic Blue Crossover Body
    React.createElement('path', {
      key: 'body',
      d: 'M22 46l4-11c2-5 6-7 13-8l34-3c6-1 13-4 17-9l13-1c4 0 8 2 12 5l17 10c5 3 9 8 9 15v7c0 2-2 4-4 4h-4a13 13 0 0 0-24 0H56a13 13 0 0 0-24 0h-6c-2 0-4-2-4-4v-5z',
      fill: '#2563EB',
      stroke: '#1D4ED8',
      strokeWidth: 1.2,
    }),
    // Lower Black Cladding
    React.createElement('path', {
      key: 'cladding',
      d: 'M22 49h10a13 13 0 0 1 24 0h40a13 13 0 0 1 24 0h8v4h-8a13 13 0 0 0-24 0H56a13 13 0 0 0-24 0H22v-4z',
      fill: '#1E293B',
    }),
    // Windshield & Glass
    React.createElement('path', {
      key: 'glass',
      d: 'M42 27l28-2c4 0 8-2 11-5l11-1c3 0 6 1 9 4l12 7c2 2 3 5 3 8H38c0-4 1-8 4-11z',
      fill: '#0F172A',
      stroke: '#60A5FA',
      strokeWidth: 0.8,
    }),
    // Glass Sky Reflection
    React.createElement('path', {
      key: 'refl',
      d: 'M56 26l16-2 16 10-10 1-22-9z',
      fill: '#93C5FD',
      opacity: 0.45,
    }),
    // Honeycomb Front Grille
    React.createElement('path', { key: 'grille', d: 'M22 40h14v7H22z', fill: '#0F172A', stroke: '#64748B', strokeWidth: 0.8 }),
    React.createElement('circle', { key: 'badge', cx: '29', cy: '43.5', r: '2.5', fill: '#E2E8F0' }),
    // Headlights
    React.createElement('path', {
      key: 'hl',
      d: 'M23 36l9-2c2 0 4 1 5 3l-1 4-13-1v-4z',
      fill: '#F8FAFC',
      stroke: '#93C5FD',
      strokeWidth: 0.8,
    }),
    // Roof Rail
    React.createElement('path', { key: 'rail', d: 'M64 15h34c2 0 4 1 5 3', stroke: '#CBD5E1', strokeWidth: 1.5, strokeLinecap: 'round' }),
  ];

  return renderComplexSvg(width, height, '0 0 160 74', children);
};

// 24. Bay 4 & 5: Available Circle Badge with Sparkles ✨ and Front Car Silhouette
export const VehicleAvailableSparkle: React.FC<{ size?: number }> = ({ size = 68 }) => {
  const children = [
    // Soft Circle Base
    React.createElement('circle', { key: 'circle', cx: '40', cy: '40', r: '28', fill: '#F1F5F9' }),
    // Left Sparkle Star ✨
    React.createElement('path', {
      key: 'sp1',
      d: 'M18 20l1.8 3.5 3.5 1.8-3.5 1.8-1.8 3.5-1.8-3.5-3.5-1.8 3.5-1.8 1.8-3.5z',
      fill: '#94A3B8',
      opacity: 0.75,
    }),
    // Right Sparkle Star ✨
    React.createElement('path', {
      key: 'sp2',
      d: 'M62 25l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5 1.5-3z',
      fill: '#94A3B8',
      opacity: 0.75,
    }),
    // Front Car Silhouette
    React.createElement('path', {
      key: 'car',
      d: 'M29 44l2.5-7a2 2 0 0 1 1.9-1.3h13.2a2 2 0 0 1 1.9 1.3l2.5 7h1c.8 0 1.5.7 1.5 1.5v6c0 .8-.7 1.5-1.5 1.5h-1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2H34v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2h-1c-.8 0-1.5-.7-1.5-1.5v-6c0-.8.7-1.5 1.5-1.5h1z',
      fill: '#94A3B8',
    }),
    // Windshield Cutout
    React.createElement('path', {
      key: 'ws',
      d: 'M32 43l1.8-5h12.4l1.8 5H32z',
      fill: '#F1F5F9',
    }),
    // Headlights
    React.createElement('circle', { key: 'hl1', cx: '31.5', cy: '48.5', r: '1.5', fill: '#F1F5F9' }),
    React.createElement('circle', { key: 'hl2', cx: '48.5', cy: '48.5', r: '1.5', fill: '#F1F5F9' }),
  ];

  return renderComplexSvg(size, size, '0 0 80 80', children);
};

// ==========================================
// LOGIN SCREEN DEDICATED ICONS
// ==========================================

// 25. User Silhouette Icon
export const IconUserOutline: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', stroke: color, strokeWidth },
    { d: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', stroke: color, strokeWidth },
  ]);
};

// 26. Padlock / Lock Icon
export const IconLockOutline: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M7 11V7a5 5 0 0 1 10 0v4', stroke: color, strokeWidth },
    { d: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', stroke: color, strokeWidth },
    { d: 'M12 15v3', stroke: color, strokeWidth },
  ]);
};

// 27. Eye Outline (Show Password)
export const IconEye: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: color, strokeWidth },
    { d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', stroke: color, strokeWidth },
  ]);
};

// 28. Eye Off (Hide Password with slash)
export const IconEyeOff: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24', stroke: color, strokeWidth },
    { d: 'M1 1l22 22', stroke: color, strokeWidth },
  ]);
};

// 29. Bold Arrow Right
export const IconArrowRight: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2.5 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M5 12h14', stroke: color, strokeWidth },
    { d: 'M12 5l7 7-7 7', stroke: color, strokeWidth },
  ]);
};

// 30. Water Droplet with Sparkle (Premium Car Wash)
export const IconWaterDropSparkle: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.8 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z', stroke: color, strokeWidth },
    { d: 'M19 3l.6 1.4L21 5l-1.4.6L19 7l-.6-1.4L17 5l1.4-.6z', fill: color },
  ]);
};

// 31. Shield with Checkmark (Safe for All Vehicles)
export const IconShieldCheckmark: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.8 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', stroke: color, strokeWidth },
    { d: 'M9 12l2 2 4-4', stroke: color, strokeWidth },
  ]);
};

// 32. Eco Leaf Outline (Eco-Friendly Products)
export const IconEcoLeaf: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.8 }) => {
  return renderSvg(size, '0 0 24 24', [
    { d: 'M11 20A7 7 0 0 1 4 13C4 8.5 7.5 4 13.5 3c2.5 0 6.5.5 6.5.5s-.5 4-1.5 6.5c-1.5 3.5-4 6-7.5 7z', stroke: color, strokeWidth },
    { d: 'M2 22l10-10', stroke: color, strokeWidth },
  ]);
};


