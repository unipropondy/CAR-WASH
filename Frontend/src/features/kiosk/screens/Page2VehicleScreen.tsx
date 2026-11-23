import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Image, 
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { KioskBackground } from '../components/KioskBackground';
import { VehicleOption, DealerOption } from '../types/kiosk.types';
import { fetchVehicleTypes, getCachedVehicleTypes } from '../../../services/vehicleApi';
import { resolveApiUrl } from '../../../services/apiConfig';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { useKioskResponsive } from '../utils/useKioskResponsive';

interface Page2VehicleScreenProps {
  initialVehicle?: VehicleOption;
  isDealer?: boolean;
  dealer?: DealerOption;
  initialVehicleNumber?: string;
  onContinue: (vehicle: VehicleOption, vehicleTypeId?: number, vehicleDetails?: { vehicleNumber: string; remarks?: string }) => void;
  onBack: () => void;
  onExitToPos?: () => void;
}

interface VehicleMeta {
  badge: string;
  badgeBg: string;
  badgeColor: string;
  accentColor: string;
  iconName: any;
  sizeLabel: string;
}

const VEHICLE_METAS: Record<string, VehicleMeta> = {
  sedan: {
    badge: 'SEDAN',
    badgeBg: '#EFF6FF',
    badgeColor: '#1D4ED8',
    accentColor: '#2563EB',
    iconName: 'car-sport',
    sizeLabel: 'Standard 4-Door',
  },
  suv: {
    badge: 'SUV',
    badgeBg: '#FEF3C7',
    badgeColor: '#B45309',
    accentColor: '#D97706',
    iconName: 'car',
    sizeLabel: 'Crossover & SUV',
  },
  mpv: {
    badge: 'MPV',
    badgeBg: '#ECFDF5',
    badgeColor: '#047857',
    accentColor: '#059669',
    iconName: 'bus-outline',
    sizeLabel: '7-Seater Family',
  },
  'big mpv': {
    badge: 'BIG MPV',
    badgeBg: '#F3E8FF',
    badgeColor: '#6B21A8',
    accentColor: '#7C3AED',
    iconName: 'bus',
    sizeLabel: 'Alphard / Large Van',
  },
  hatchback: {
    badge: 'HATCHBACK',
    badgeBg: '#F0FDFA',
    badgeColor: '#0F766E',
    accentColor: '#0D9488',
    iconName: 'car-sport-outline',
    sizeLabel: 'Compact 5-Door',
  },
  coupe: {
    badge: 'COUPE',
    badgeBg: '#FEF2F2',
    badgeColor: '#B91C1C',
    accentColor: '#DC2626',
    iconName: 'speedometer-outline',
    sizeLabel: 'Sports 2-Door',
  },
};

const VEHICLE_LOCAL_ASSETS: Record<string, any> = {
  sedan: require('../../../../assets/images/vehicles/sedan.png'),
  suv: require('../../../../assets/images/vehicles/suv.png'),
  mpv: require('../../../../assets/images/vehicles/mpv.png'),
  'big mpv': require('../../../../assets/images/vehicles/big_mpv.png'),
  big_mpv: require('../../../../assets/images/vehicles/big_mpv.png'),
  hatchback: require('../../../../assets/images/vehicles/hatchback.png'),
  coupe: require('../../../../assets/images/vehicles/coupe.png'),
};

export function getVehicleImageSource(item?: VehicleOption | null, hasLoadFailed: boolean = false): any {
  if (!item) return null;
  const code = (item.vehicleTypeCode || '').toLowerCase().trim();
  const name = (item.name || '').toLowerCase().trim();

  // If network image failed or not provided, return local asset immediately
  if (hasLoadFailed || !item.imageUrl) {
    if (VEHICLE_LOCAL_ASSETS[code]) return VEHICLE_LOCAL_ASSETS[code];
    if (VEHICLE_LOCAL_ASSETS[name]) return VEHICLE_LOCAL_ASSETS[name];
    for (const [k, src] of Object.entries(VEHICLE_LOCAL_ASSETS)) {
      if (code.includes(k) || name.includes(k) || k.replace('_', ' ') === name) return src;
    }
  }

  // If item has a server/network imageUrl
  if (item.imageUrl && !hasLoadFailed) {
    const resolved = resolveApiUrl(item.imageUrl);
    if (resolved) {
      return { uri: resolved };
    }
  }

  if (VEHICLE_LOCAL_ASSETS[code]) return VEHICLE_LOCAL_ASSETS[code];
  if (VEHICLE_LOCAL_ASSETS[name]) return VEHICLE_LOCAL_ASSETS[name];
  for (const [k, src] of Object.entries(VEHICLE_LOCAL_ASSETS)) {
    if (code.includes(k) || name.includes(k) || k.replace('_', ' ') === name) return src;
  }
  return null;
}

function getVehicleMeta(name: string): VehicleMeta {
  const key = (name || '').toLowerCase().trim();
  for (const [k, meta] of Object.entries(VEHICLE_METAS)) {
    if (key.includes(k)) return meta;
  }
  return {
    badge: 'STANDARD',
    badgeBg: '#F1F5F9',
    badgeColor: '#475569',
    accentColor: RED_BAY_COLORS.primary,
    iconName: 'car-sport',
    sizeLabel: 'Standard Vehicle',
  };
}

export const Page2VehicleScreen: React.FC<Page2VehicleScreenProps> = ({
  initialVehicle,
  isDealer = false,
  dealer,
  initialVehicleNumber = '',
  onContinue,
  onBack,
  onExitToPos,
}) => {
  const { 
    isTallKiosk, 
    isLandscape, 
    isLandscapeShort, 
    contentMaxWidth, 
    horizontalPadding, 
    vehicleCols, 
    scale, 
    scaleFont, 
    scaleSize, 
    clamp, 
    width 
  } = useKioskResponsive();

  const isVeryNarrow = width < 480;
  const cardWidthPercent = isVeryNarrow 
    ? '47%' 
    : vehicleCols === 3 
      ? '30.5%' 
      : '47%';

  const dynamicImageShowcaseHeight = scaleSize(125, 105, 150);
  const dynamicVehicleImgHeight = scaleSize(115, 95, 135);
  const dynamicVehicleNameFont = scaleFont(16.5, 15, 20);
  const dynamicSizeHintFont = scaleFont(11.5, 10.5, 13);

  const initialVehicles = getCachedVehicleTypes();
  const [vehicles, setVehicles] = useState<VehicleOption[]>(initialVehicles);
  const [loading, setLoading] = useState<boolean>(initialVehicles.length === 0);
  const [error, setError] = useState<string>('');

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | undefined>(() => {
    if (initialVehicle) return initialVehicle;
    if (isDealer && initialVehicles.length > 0) return initialVehicles[0];
    return undefined;
  });
  const [selectedVehicleTypeId, setSelectedVehicleTypeId] = useState<number | undefined>(() => {
    if (initialVehicle?.vehicleTypeId) return initialVehicle.vehicleTypeId;
    if (isDealer && initialVehicles.length > 0) return initialVehicles[0].vehicleTypeId;
    return undefined;
  });
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const loadVehicles = async () => {
    try {
      if (vehicles.length === 0) {
        setLoading(true);
      }
      setError('');
      const data = await fetchVehicleTypes();
      if (data && data.length > 0) {
        setVehicles(data);

        if (initialVehicle) {
          const found = data.find(
            (v: VehicleOption) => v.vehicleTypeId === initialVehicle.vehicleTypeId || v.id === initialVehicle.id
          );
          if (found) {
            setSelectedVehicle(found);
            setSelectedVehicleTypeId(found.vehicleTypeId);
          }
        } else if (isDealer && !selectedVehicle && data.length > 0) {
          setSelectedVehicle(data[0]);
          setSelectedVehicleTypeId(data[0].vehicleTypeId);
        }
      }
    } catch (err: any) {
      if (vehicles.length === 0) {
        setError(err?.message || 'Failed to load vehicle types from server.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const [isNavigating, setIsNavigating] = useState(false);

  const handleSelect = (vehicle: VehicleOption) => {
    setSelectedVehicle(vehicle);
    setSelectedVehicleTypeId(vehicle.vehicleTypeId);

    if (isNavigating) return;
    setIsNavigating(true);
    // Single-Click Auto Navigation: proceed directly to package selection for both customer and dealer
    onContinue(vehicle, vehicle.vehicleTypeId);
  };

  return (
    <View style={styles.container}>
      <KioskBackground />
      {/* Top Center Logo & Header */}
      <KioskTopHeader
        subtitle={isDealer ? "DEALER STEP 1: VEHICLE TYPE" : "STEP 1 OF 5: VEHICLE TYPE"}
        screenName="VehicleSelectionScreen.tsx"
        onExitToPos={onExitToPos}
        onBack={onBack}
        backLabel="Back"
      />

      {/* Main Title & Prompt Header */}
      <View style={[styles.promptHeader, isTallKiosk && styles.promptHeaderTall]}>
        <Text style={[styles.mainTitle, isTallKiosk && styles.mainTitleTall]}>{isDealer ? "Select Vehicle Type" : "Select Your Vehicle Type"}</Text>
        <Text style={[styles.subtitle, isTallKiosk && styles.subtitleTall]}>
          {isDealer 
            ? "Choose the vehicle category for commercial account billing."
            : "Choose the category matching your vehicle. Pricing is tailored accordingly."}
        </Text>
        <View style={styles.titleUnderlineAccent} />
      </View>

      {/* Content Area - Optimized for PORTRAIT MODE & TABLETS */}
      {loading && vehicles.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
          <Text style={styles.loadingText}>Loading vehicle categories...</Text>
        </View>
      ) : error && vehicles.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadVehicles} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent, 
            { paddingHorizontal: horizontalPadding }, 
            isTallKiosk && styles.scrollContentTall
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.portraitGrid, isTallKiosk && styles.portraitGridTall, { maxWidth: contentMaxWidth, width: '100%' }]}>
            {vehicles.map((item) => {
              const isSelected = selectedVehicleTypeId === item.vehicleTypeId;
              const meta = getVehicleMeta(item.name);
              const imgSource = getVehicleImageSource(item, Boolean(failedImages[String(item.vehicleTypeId)]));
              const hasDescription = Boolean(
                item.description &&
                item.description.trim() !== '' &&
                item.description.trim() !== '-'
              );

              return (
                <TouchableOpacity
                  key={item.vehicleTypeId}
                  style={[
                    styles.vehicleCard,
                    { width: cardWidthPercent },
                    isTallKiosk && styles.vehicleCardTall,
                    isLandscapeShort && styles.vehicleCardShort,
                    isSelected && styles.vehicleCardSelected,
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.88}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  {/* Body: Vehicle Image Showcase */}
                  <View style={[
                    styles.imageShowcase, 
                    { height: dynamicImageShowcaseHeight },
                    isTallKiosk && styles.imageShowcaseTall,
                    isLandscapeShort && styles.imageShowcaseShort,
                    isSelected && styles.imageShowcaseSelected
                  ]}>
                    {imgSource ? (
                      <Image
                        source={imgSource}
                        style={[
                          styles.vehicleImage,
                          { height: dynamicVehicleImgHeight },
                          isTallKiosk && styles.vehicleImageTall,
                          isLandscapeShort && styles.vehicleImageShort
                        ]}
                        resizeMode="contain"
                        onError={() => {
                          setFailedImages((prev) => ({ ...prev, [String(item.vehicleTypeId)]: true }));
                        }}
                      />
                    ) : (
                      <View style={[
                        styles.iconBox, 
                        isTallKiosk && styles.iconBoxTall,
                        isSelected && styles.iconBoxSelected
                      ]}>
                        <Ionicons
                          name={meta.iconName}
                          size={isTallKiosk ? 52 : 38}
                          color={isSelected ? RED_BAY_COLORS.primary : meta.accentColor}
                        />
                      </View>
                    )}
                  </View>

                  {/* Info: Name & Select Action */}
                  <View style={styles.cardInfo}>
                    <Text style={[
                      styles.vehicleName, 
                      { fontSize: dynamicVehicleNameFont },
                      isTallKiosk && styles.vehicleNameTall,
                      isLandscapeShort && styles.vehicleNameShort,
                      isSelected && styles.vehicleNameSelected,
                    ]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {hasDescription ? (
                      <Text style={[
                        styles.vehicleSizeHint,
                        { fontSize: dynamicSizeHintFont },
                        isTallKiosk && styles.vehicleSizeHintTall
                      ]} numberOfLines={1}>
                        {item.description!.trim()}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  promptHeader: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    width: '100%',
  },
  promptHeaderTall: {
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  titleUnderlineAccent: {
    width: 44,
    height: 4,
    backgroundColor: '#E11D48',
    borderRadius: 2,
    marginTop: 10,
  },
  stepBadge: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 14,
    marginBottom: 4,
  },
  stepBadgeText: {
    color: RED_BAY_COLORS.primary,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  mainTitleTall: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
  subtitleTall: {
    fontSize: 15,
    marginTop: 4,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '700',
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: RED_BAY_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  scrollContentTall: {
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  portraitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 18,
    rowGap: 20,
    width: '100%',
  },
  portraitGridTall: {
    gap: 22,
    rowGap: 22,
  },
  vehicleCard: {
    width: '30.5%',
    minWidth: 160,
    aspectRatio: 0.96,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    ...makeShadow('#0F172A', { width: 0, height: 6 }, 0.08, 14, 2),
  },
  vehicleCard3Col: {
    width: '30.5%',
  },
  vehicleCardTall: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
    ...makeShadow('#0F172A', { width: 0, height: 8 }, 0.10, 16, 3),
  },
  vehicleCardShort: {
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 16,
  },
  vehicleCardSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 8 }, 0.28, 18, 4),
  },
  cardSelectedStrip: {
    display: 'none',
  },
  imageShowcase: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    padding: 0,
    marginBottom: 4,
  },
  imageShowcaseTall: {
    marginBottom: 8,
  },
  imageShowcaseShort: {
    marginBottom: 2,
  },
  imageShowcaseSelected: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  vehicleImage: {
    width: '92%',
    height: 115,
  },
  vehicleImageTall: {
    height: 130,
  },
  vehicleImageShort: {
    height: 95,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxTall: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  iconBoxSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  cardInfo: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
  },
  vehicleName: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  vehicleNameTall: {
    fontSize: 18,
    letterSpacing: 0.3,
  },
  vehicleNameShort: {
    fontSize: 14.5,
  },
  vehicleNameSelected: {
    color: RED_BAY_COLORS.primary,
  },
  selectBtn: {
    backgroundColor: RED_BAY_COLORS.primary,
    paddingVertical: 7,
    paddingHorizontal: 22,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    minWidth: 88,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 2 }, 0.18, 6, 1),
  },
  selectBtnSelected: {
    backgroundColor: '#B91C1C',
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 3 }, 0.25, 8, 2),
  },
  selectBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  vehicleSizeHint: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 4,
  },
  vehicleSizeHintTall: {
    fontSize: 12,
    lineHeight: 15,
    marginTop: 2,
  },
  dealerBannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 8,
    gap: 6,
  },
  dealerBannerText: {
    fontSize: 12,
    color: '#92400E',
  },
  dealerBannerBold: {
    fontWeight: '800',
    color: '#78350F',
  },
  dealerCreditTermText: {
    color: '#B45309',
    fontWeight: '700',
  },
});
