import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Modal, 
  ActivityIndicator,
  Alert,
  Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { PaymentMode, VehicleOption, ServiceCategory, ServicePackage, CustomerDetails } from '../types/kiosk.types';
import { fetchPaymodes, PayModeOption } from '../../../services/carwashOrderApi';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { getVehicleImageSource } from './Page2VehicleScreen';

interface Page5PaymentScreenProps {
  vehicle: VehicleOption;
  category: ServiceCategory;
  selectedPackage: ServicePackage;
  customerDetails: CustomerDetails;
  initialPaymentMode?: PaymentMode;
  onConfirmPayment: (mode: PaymentMode) => void;
  onBack: () => void;
  onExitToPos?: () => void;
  orderNo?: string;
}

export const Page5PaymentScreen: React.FC<Page5PaymentScreenProps> = ({
  vehicle,
  category,
  selectedPackage,
  customerDetails,
  initialPaymentMode,
  onConfirmPayment,
  onBack,
  onExitToPos,
  orderNo,
}) => {
  const [paymodes, setPaymodes] = useState<PayModeOption[]>([]);
  const [loadingPaymodes, setLoadingPaymodes] = useState<boolean>(true);
  const [paymodeError, setPaymodeError] = useState<string>('');

  const [selectedMode, setSelectedMode] = useState<string | undefined>(
    typeof initialPaymentMode === 'string' ? initialPaymentMode : undefined
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // Totals
  const total = selectedPackage.price;
  const gstPercent = selectedPackage.gstPercent || 9;
  const gstAmount = Number(((total * (gstPercent / 100)) / (1 + (gstPercent / 100))).toFixed(2));

  // Load payment modes from dbo.Paymode
  const loadPaymodes = async () => {
    try {
      setLoadingPaymodes(true);
      setPaymodeError('');
      const data = await fetchPaymodes();
      setPaymodes(data);
    } catch (err: any) {
      setPaymodeError(err?.message || 'Failed to load payment modes from server.');
    } finally {
      setLoadingPaymodes(false);
    }
  };

  useEffect(() => {
    loadPaymodes();
  }, []);

  const handleModeSelect = async (mode: string) => {
    if (isProcessing) return;
    setSelectedMode(mode);
    setIsProcessing(true);
    try {
      // Single-Click Auto Navigation: proceed directly according to existing payment workflow
      await onConfirmPayment(mode);
    } catch (err: any) {
      setIsProcessing(false);
      Alert.alert('Payment Error', err?.message || 'Payment failed to process');
    }
  };

  const getPaymodeMeta = (payMode: string) => {
    const upper = payMode.trim().toUpperCase();
    if (upper === 'CASH') {
      return {
        iconName: 'cash-outline' as any,
        badgeBg: '#ECFDF5',
        badgeColor: '#059669',
        subtitle: 'Cash at Counter / Machine',
      };
    }
    if (upper === 'MEMBER') {
      return {
        iconName: 'person-circle-outline' as any,
        badgeBg: '#EFF6FF',
        badgeColor: '#2563EB',
        subtitle: 'Member Card Balance',
      };
    }
    if (upper === 'CREDIT') {
      return {
        iconName: 'business-outline' as any,
        badgeBg: '#FEF3C7',
        badgeColor: '#D97706',
        subtitle: 'Fleet Credit Account',
      };
    }
    return {
      iconName: 'card-outline' as any,
      badgeBg: '#F3E8FF',
      badgeColor: '#7C3AED',
      subtitle: 'Card / PayNow QR',
    };
  };

  const isWalkIn = !customerDetails?.vehicleNumber || customerDetails.vehicleNumber === 'WALK-IN';
  const vehicleImgSource = getVehicleImageSource(vehicle);

  return (
    <View style={styles.container}>
      {/* Top Center Logo & Header */}
      <KioskTopHeader
        subtitle="STEP 4 OF 5: PAYMENT"
        screenName="PaymentScreen.tsx"
        onExitToPos={onExitToPos}
        onBack={onBack}
        backLabel="Details"
      />

      {/* Main Title & Prompt Header */}
      <View style={styles.promptHeader}>
        <Text style={styles.mainTitle}>Select Payment Method</Text>
        <View style={styles.titleUnderlineAccent} />
      </View>

      {/* Main Content Area - PORTRAIT OPTIMIZED */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.portraitContainer}>
          {/* Order Summary Strip (Portrait Full-Width) */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryTopStrip} />
            <View style={styles.summaryBarTop}>
              {/* Showroom Vehicle Image Thumbnail */}
              <View style={styles.summaryVehicleImageBox}>
                {vehicleImgSource ? (
                  <Image
                    source={vehicleImgSource}
                    style={styles.summaryVehicleImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons name="car-sport" size={24} color={RED_BAY_COLORS.primary} />
                )}
              </View>

              <View style={{ flex: 1, paddingLeft: 6 }}>
                <Text style={styles.summaryLabel}>PACKAGE & VEHICLE</Text>
                <Text style={styles.summaryPkgName}>{selectedPackage.name}</Text>
                <Text style={styles.summarySub}>{vehicle.name} • {category.title}</Text>
              </View>

              <View style={styles.summaryPriceBox}>
                <Text style={styles.summaryPrice}>
                  {selectedPackage.currencyCode || 'SGD'} ${total.toFixed(2)}
                </Text>
                <Text style={styles.summaryGst}>
                  {selectedPackage.isTaxInclusive ? 'Incl. 9% GST' : '+ 9% GST'}
                </Text>
              </View>
            </View>

            <View style={styles.summaryBarDivider} />

            <View style={styles.summaryBarBottom}>
              <View style={styles.vehiclePlateRow}>
                <Text style={styles.plateLabel}>Vehicle:</Text>
                <View style={styles.plateTag}>
                  <Text style={styles.plateTagText}>
                    {isWalkIn ? 'WALK-IN' : customerDetails.vehicleNumber}
                  </Text>
                </View>
              </View>

              {customerDetails?.customerName && customerDetails.customerName !== 'Walk-in Customer' && (
                <View style={styles.customerInfoBlock}>
                  <Text style={styles.customerNameTag}>
                    👤 {customerDetails.customerName}
                  </Text>
                  {customerDetails.mobileNumber && customerDetails.mobileNumber !== '-' && (
                    <Text style={styles.customerMobileTag}>
                      • 📞 +65 {customerDetails.mobileNumber}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* DYNAMIC PAYMENT OPTIONS (PORTRAIT VERTICAL STACK) */}
          {loadingPaymodes ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
              <Text style={styles.loadingText}>Loading payment options...</Text>
            </View>
          ) : paymodeError ? (
            <View style={styles.centerBox}>
              <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
              <Text style={styles.errorText}>{paymodeError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadPaymodes} activeOpacity={0.8}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.paymentSection}>
              <Text style={styles.sectionHeaderTitle}>CHOOSE PAYMENT METHOD</Text>

              <View style={styles.paymentGrid}>
                {paymodes.map((pm) => {
                  const isSelected = selectedMode === pm.payMode;
                  const meta = getPaymodeMeta(pm.payMode);

                  return (
                    <TouchableOpacity
                      key={pm.position || pm.payMode}
                      style={[
                        styles.paymentOptionCard,
                        isSelected && styles.paymentOptionCardSelected,
                        isProcessing && !isSelected && styles.paymentOptionCardDisabled,
                      ]}
                      onPress={() => handleModeSelect(pm.payMode)}
                      disabled={isProcessing}
                      activeOpacity={0.88}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      {isSelected && <View style={styles.paymentSelectedStrip} />}

                      {isSelected && (
                        <View style={styles.activePill}>
                          {isProcessing ? (
                            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 4 }} />
                          ) : (
                            <Ionicons name="checkmark" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                          )}
                          <Text style={styles.activePillText}>
                            {isProcessing ? 'AUTHORIZING' : 'SELECTED'}
                          </Text>
                        </View>
                      )}

                      {/* Centered Icon */}
                      <View style={[styles.payIconBox, { backgroundColor: meta.badgeBg }]}>
                        <Ionicons name={meta.iconName} size={28} color={meta.badgeColor} />
                      </View>

                      {/* Centered Details: Title & Subtitle */}
                      <View style={styles.payDetailsCol}>
                        <Text style={[styles.payModeTitle, isSelected && styles.payModeTitleSelected]}>
                          {pm.payMode}
                        </Text>
                        <Text style={styles.paySubtitle} numberOfLines={1}>{meta.subtitle}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Bay Queue Assurance Notice */}
          <View style={styles.queueNoticePill}>
            <Ionicons name="flash-outline" size={16} color="#059669" />
            <Text style={styles.queueNoticeText}>
              Once payment is authorized, your car will immediately be queued into Station #01 bay tracking.
            </Text>
          </View>

          {/* Real-time processing banner */}
          {isProcessing && (
            <View style={styles.processingBanner}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.processingBannerText}>
                Authorizing payment with {selectedMode}... Please wait.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    width: '100%',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.03, 4, 1),
  },
  titleUnderlineAccent: {
    width: 44,
    height: 3,
    borderRadius: 2,
    backgroundColor: RED_BAY_COLORS.primary,
    marginTop: 6,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexGrow: 1,
  },
  portraitContainer: {
    width: '100%',
    maxWidth: 700,
    gap: 14,
    alignItems: 'center',
  },
  /* Order Summary Bar */
  summaryBar: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.05, 12, 3),
  },
  summaryTopStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  summaryBarTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryVehicleImageBox: {
    width: 82,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    overflow: 'hidden',
  },
  summaryVehicleImage: {
    width: '100%',
    height: '100%',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  summaryPkgName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  summarySub: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  summaryPriceBox: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  summaryPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
    letterSpacing: 0.3,
  },
  summaryGst: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 1,
  },
  summaryBarDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  summaryBarBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehiclePlateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plateLabel: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  plateTag: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  plateTagText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  customerInfoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  customerNameTag: {
    fontSize: 11.5,
    color: '#334155',
    fontWeight: '700',
  },
  customerMobileTag: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },

  /* Payment Section & 2-Column Responsive Grid */
  paymentSection: {
    width: '100%',
    gap: 12,
  },
  sectionHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.6,
    paddingLeft: 4,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    width: '100%',
  },
  paymentOptionCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 142,
    gap: 12,
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.05, 12, 3),
  },
  paymentOptionCardSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFFDFD',
    borderWidth: 2.5,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 8 }, 0.22, 16, 4),
  },
  paymentSelectedStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  payCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  payIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payCardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payDetailsCol: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  payTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payModeTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  payModeTitleSelected: {
    color: RED_BAY_COLORS.primary,
  },
  activePill: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RED_BAY_COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 2 }, 0.25, 4, 1),
  },
  activePillText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  paySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
    textAlign: 'center',
  },
  payDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  payBottomRow: {
    width: '100%',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBottomRowSelected: {
    backgroundColor: '#FEE2E2',
  },
  paySelectHint: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  paySelectHintSelected: {
    color: RED_BAY_COLORS.primary,
    fontWeight: '800',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  radioCircleSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  radioDotEmpty: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  queueNoticePill: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  queueNoticeText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '600',
    flex: 1,
    lineHeight: 15,
  },
  centerBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
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

  paymentOptionCardDisabled: {
    opacity: 0.45,
  },
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '100%',
    marginTop: 6,
    ...makeShadow('#000000', { width: 0, height: 4 }, 0.25, 8, 3),
  },
  processingBannerText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
