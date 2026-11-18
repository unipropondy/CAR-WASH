import { useWindowDimensions } from 'react-native';

export interface KioskResponsive {
  // Viewport geometry
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  isLandscape: boolean;
  orientation: 'portrait' | 'landscape';

  // Device classification flags
  isReferenceKiosk: boolean; // Reference display: 10.4" x 18.7", ~9:16 portrait
  isTallKiosk: boolean;      // Any tall portrait kiosk or tablet (aspectRatio <= 0.65 or height >= 900)
  isTablet: boolean;         // Tablet screen (iPad, Galaxy Tab, etc.)
  isCompact: boolean;        // Narrow phone or compact display (< 560px)
  isVeryNarrow: boolean;     // Extremely narrow display (< 380px)
  isLandscapeShort: boolean; // Landscape with limited vertical height (< 620px)
  isLargeKiosk: boolean;     // Large screen kiosk (1080p, 1440p, or 4K)

  // Fluid scaling factors (reference-derived)
  scale: number;             // Primary scale multiplier (1.0 = standard, ~1.35-1.4 on 1080p kiosk)
  fontScale: number;         // Typography multiplier
  spacingScale: number;      // Spacing / padding multiplier

  // Layout bounds & dimensions (uses FULL screen area without dead black/grey borders)
  contentMaxWidth: number;
  horizontalPadding: number;
  headerHeight: number;
  navHeight: number;
  availableHeight: number;

  // Responsive Grid column counts
  vehicleCols: number;
  categoryCols: number;
  packageCols: number;
  dealerCols: number;
  paymodeCols: number;

  // Fluid utility functions
  clamp: (val: number, min: number, max: number) => number;
  scaleFont: (base: number, min?: number, max?: number) => number;
  scaleSpacing: (base: number, min?: number, max?: number) => number;
  scaleSize: (base: number, min?: number, max?: number) => number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function useKioskResponsive(): KioskResponsive {
  const { width, height } = useWindowDimensions();

  const isPortrait = height >= width;
  const isLandscape = width > height;
  const orientation = isPortrait ? 'portrait' : 'landscape';
  const aspectRatio = height > 0 ? width / height : 0.5625;

  // 10.4" x 18.7" Reference Display: Aspect Ratio ~ 0.556 (9:16)
  const isReferenceKiosk = isPortrait && aspectRatio >= 0.50 && aspectRatio <= 0.64;

  // Tall kiosk portrait displays: 1080x1920, 1200x1920, or any display where height >= 920 in portrait
  const isTallKiosk = isPortrait && (height >= 920 || aspectRatio <= 0.64);

  // Large kiosk screens (tall portrait >= 1050 or high-res landscape >= 1200 or width >= 900)
  const isLargeKiosk = isTallKiosk || (isLandscape && width >= 1200) || (width >= 960);

  // Tablet displays: iPads, Galaxy Tabs (768x1024, 800x1280, 1024x768, 1280x800)
  const isTablet =
    (Math.min(width, height) >= 580 && Math.max(width, height) <= 1400) && !isReferenceKiosk;

  // Compact / narrow displays
  const isCompact = width < 560;
  const isVeryNarrow = width < 380;

  // Short landscape screens: tablets or laptops with low vertical viewport
  const isLandscapeShort = isLandscape && height < 620;

  // Fluid continuous scaling based on the reference layout (10.4" x 18.7" portrait kiosk ~ 1080x1920 / 768x1366 base)
  const baseWidth = isPortrait ? 768 : 1200;
  const baseHeight = isPortrait ? 1366 : 768;

  const scaleW = width / baseWidth;
  const scaleH = height / baseHeight;
  const rawScale = isPortrait
    ? (scaleW * 0.55 + scaleH * 0.45)
    : (scaleH * 0.55 + scaleW * 0.45);

  const scale = clamp(rawScale, 0.85, 1.45);
  const fontScale = clamp(isPortrait ? width / 760 : height / 720, 0.85, 1.40);
  const spacingScale = clamp(scale, 0.80, 1.45);

  // Helper scaling methods
  const scaleFont = (base: number, min?: number, max?: number) => {
    const calculated = Math.round(base * fontScale);
    return clamp(calculated, min ?? Math.round(base * 0.8), max ?? Math.round(base * 1.5));
  };

  const scaleSpacing = (base: number, min?: number, max?: number) => {
    const calculated = Math.round(base * spacingScale);
    return clamp(calculated, min ?? Math.round(base * 0.75), max ?? Math.round(base * 1.6));
  };

  const scaleSize = (base: number, min?: number, max?: number) => {
    const calculated = Math.round(base * scale);
    return clamp(calculated, min ?? Math.round(base * 0.8), max ?? Math.round(base * 1.5));
  };

  // Full Screen Utilization: Avoid unnecessary empty spaces on left/right/top/bottom
  let contentMaxWidth = width;
  if (isLandscape) {
    // In landscape, utilize full width while avoiding extreme wide-stretching on ultra-wide monitors
    contentMaxWidth = Math.min(width, Math.max(1280, width * 0.96));
  } else {
    // In portrait kiosk / tablet, use the full width of the screen!
    contentMaxWidth = width;
  }

  const horizontalPadding = clamp(Math.round(width * 0.03), 14, 32);

  // Dynamic header and footer heights
  const headerHeight = clamp(Math.round(height * 0.055), isLandscapeShort ? 56 : 72, 110);
  const navHeight = clamp(Math.round(height * 0.052), isLandscapeShort ? 50 : 66, 96);
  const availableHeight = Math.max(height - headerHeight - navHeight, 300);

  // Adaptive Grid Column Calculations
  // For vehicles (6 types total: Sedan, SUV, MPV, Big MPV, Hatchback, Coupe):
  // 3 columns forms an evenly balanced 3x2 grid with NO empty gap on Row 2
  let vehicleCols = 2;
  if (isLandscape) {
    vehicleCols = width >= 768 ? 3 : 2;
  } else {
    vehicleCols = width >= 900 ? 3 : 2;
  }

  let categoryCols = 2;
  if (isLandscape) {
    categoryCols = width >= 768 ? 3 : 2;
  } else {
    categoryCols = width >= 800 ? 3 : 2;
  }

  let packageCols = 2;
  if (isLandscape) {
    packageCols = width >= 768 ? 3 : 2;
  } else {
    packageCols = width >= 800 ? 3 : 2;
  }

  let dealerCols = 2;
  if (isLandscape) {
    dealerCols = width >= 768 ? 3 : 2;
  } else {
    dealerCols = width >= 800 ? 3 : 2;
  }

  let paymodeCols = 2;
  if (isLandscape) {
    paymodeCols = width >= 960 ? 3 : 2;
  } else {
    paymodeCols = width >= 800 ? 3 : 2;
  }

  return {
    width,
    height,
    aspectRatio,
    isPortrait,
    isLandscape,
    orientation,
    isReferenceKiosk,
    isTallKiosk,
    isTablet,
    isCompact,
    isVeryNarrow,
    isLandscapeShort,
    isLargeKiosk,
    scale,
    fontScale,
    spacingScale,
    contentMaxWidth,
    horizontalPadding,
    headerHeight,
    navHeight,
    availableHeight,
    vehicleCols,
    categoryCols,
    packageCols,
    dealerCols,
    paymodeCols,
    clamp,
    scaleFont,
    scaleSpacing,
    scaleSize,
  };
}
