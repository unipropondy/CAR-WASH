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
import { VehicleOption } from '../types/kiosk.types';
import { fetchVehicleTypes } from '../../../services/vehicleApi';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';

interface Page2VehicleScreenProps {
  initialVehicle?: VehicleOption;
  onContinue: (vehicle: VehicleOption, vehicleTypeId?: number) => void;
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

export function getVehicleImageSource(item?: VehicleOption | null): any {
  if (!item) return null;
  if (item.imageUrl && item.hasImage) {
    return { uri: item.imageUrl };
  }
  const code = (item.vehicleTypeCode || '').toLowerCase().trim();
  const name = (item.name || '').toLowerCase().trim();
  if (VEHICLE_LOCAL_ASSETS[code]) return VEHICLE_LOCAL_ASSETS[code];
  if (VEHICLE_LOCAL_ASSETS[name]) return VEHICLE_LOCAL_ASSETS[name];
  for (const [k, src] of Object.entries(VEHICLE_LOCAL_ASSETS)) {
    if (code.includes(k) || name.includes(k)) return src;
  }
  if (item.imageUrl) {
    return { uri: item.imageUrl };
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
  onContinue,
  onBack,
  onExitToPos,
}) => {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | undefined>(initialVehicle);
  const [selectedVehicleTypeId, setSelectedVehicleTypeId] = useState<number | undefined>(
    initialVehicle?.vehicleTypeId
  );

  const loadVehicles = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchVehicleTypes();
      setVehicles(data);

      if (initialVehicle) {
        const found = data.find(
          (v: VehicleOption) => v.vehicleTypeId === initialVehicle.vehicleTypeId || v.id === initialVehicle.id
        );
        if (found) {
          setSelectedVehicle(found);
          setSelectedVehicleTypeId(found.vehicleTypeId);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load vehicle types from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const [isNavigating, setIsNavigating] = useState(false);

  const handleSelect = (vehicle: VehicleOption) => {
    if (isNavigating) return;
    setIsNavigating(true);
    setSelectedVehicle(vehicle);
    setSelectedVehicleTypeId(vehicle.vehicleTypeId);
    // Single-Click Auto Navigation: proceed immediately to next screen
    onContinue(vehicle, vehicle.vehicleTypeId);
  };

  return (
    <View style={styles.container}>
      {/* Top Center Logo & Header */}
      <KioskTopHeader
        subtitle="STEP 1 OF 5: VEHICLE TYPE"
        screenName="VehicleSelectionScreen.tsx"
        onExitToPos={onExitToPos}
        onBack={onBack}
        backLabel="Back"
      />

      {/* Main Title & Prompt Header */}
      <View style={styles.promptHeader}>
        <Text style={styles.mainTitle}>Select Your Vehicle Type</Text>
        <Text style={styles.subtitle}>
          Choose the category matching your vehicle. Pricing is tailored accordingly.
        </Text>
      </View>

      {/* Content Area - Optimized for PORTRAIT MODE */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
          <Text style={styles.loadingText}>Loading vehicle categories...</Text>
        </View>
      ) : error ? (
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.portraitGrid}>
            {vehicles.map((item) => {
              const isSelected = selectedVehicleTypeId === item.vehicleTypeId;
              const meta = getVehicleMeta(item.name);
              const imgSource = getVehicleImageSource(item);

              return (
                <TouchableOpacity
                  key={item.vehicleTypeId}
                  style={[
                    styles.vehicleCard,
                    isSelected && styles.vehicleCardSelected,
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.88}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  {/* Top Red Strip when selected */}
                  {isSelected && <View style={styles.cardSelectedStrip} />}

                  {/* Body: Vehicle Image Showcase with Pedestal */}
                  <View style={[styles.imageShowcase, isSelected && styles.imageShowcaseSelected]}>
                    {imgSource ? (
                      <Image
                        source={imgSource}
                        style={styles.vehicleImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
                        <Ionicons
                          name={meta.iconName}
                          size={38}
                          color={isSelected ? RED_BAY_COLORS.primary : meta.accentColor}
                        />
                      </View>
                    )}
                    <View style={styles.pedestalShadow} />
                  </View>

                  {/* Info: Name & Subtitle */}
                  <View style={styles.cardInfo}>
                    <Text style={[styles.vehicleName, isSelected && styles.vehicleNameSelected]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.vehicleSizeHint} numberOfLines={2}>
                      {item.description || meta.sizeLabel}
                    </Text>
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
    backgroundColor: '#F8FAFC',
  },
  promptHeader: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    width: '100%',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.03, 4, 1),
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
  subtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
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
  },
  scrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexGrow: 1,
  },
  portraitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
    width: '100%',
    maxWidth: 600,
  },
  vehicleCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 185,
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.06, 12, 3),
  },
  vehicleCardSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFFAFA',
    borderWidth: 2.5,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 8 }, 0.22, 16, 4),
  },
  cardSelectedStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  imageShowcase: {
    width: '100%',
    height: 104,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 6,
    marginBottom: 8,
  },
  imageShowcaseSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FEE2E2',
  },
  vehicleImage: {
    width: '100%',
    height: 90,
    zIndex: 2,
  },
  pedestalShadow: {
    position: 'absolute',
    bottom: 6,
    width: '75%',
    height: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.05)',
    zIndex: 1,
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
  iconBoxSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  cardInfo: {
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  vehicleName: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  vehicleNameSelected: {
    color: RED_BAY_COLORS.primary,
  },
  vehicleSizeHint: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: 4,
  },
});
