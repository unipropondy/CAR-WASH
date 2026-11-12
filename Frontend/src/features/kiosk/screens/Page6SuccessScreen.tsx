import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Platform,
  Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { KioskOrder } from '../types/kiosk.types';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { printOrderReceipt, triggerBrowserReceiptPrint } from '../../../services/printerApi';
import { getVehicleImageSource } from './Page2VehicleScreen';

interface Page6SuccessScreenProps {
  order: KioskOrder;
  onNewCustomer: () => void;
  onExitToPos?: () => void;
}

export const Page6SuccessScreen: React.FC<Page6SuccessScreenProps> = ({
  order,
  onNewCustomer,
  onExitToPos,
}) => {
  const [printStatus, setPrintStatus] = useState<'IDLE' | 'PRINTING' | 'DONE' | 'ERROR'>('PRINTING');
  const [printMessage, setPrintMessage] = useState<string>('Auto-printing receipt...');
  const [countdown, setCountdown] = useState<number>(30);
  const hasAutoPrintedRef = useRef<boolean>(false);

  const isDealer = order.userType === 'DEALER';

  // Automatic Receipt Printing upon successful order placement
  const executePrint = async (isManual = false) => {
    setPrintStatus('PRINTING');
    setPrintMessage(isManual ? 'Printing bill ticket...' : 'Auto-printing receipt on configured printer...');
    try {
      const res = await printOrderReceipt(order);
      setPrintStatus('DONE');
      if (res.printer) {
        setPrintMessage(`✓ Receipt printed via ${res.printer} (${res.ip || 'LAN'}:${res.port || 9100})`);
      } else {
        setPrintMessage('✓ Bill ticket printed successfully!');
      }
    } catch (err: any) {
      console.warn('Auto print receipt fallback:', err?.message);
      triggerBrowserReceiptPrint(order);
      setPrintStatus('DONE');
      setPrintMessage('✓ Bill ticket printed via station receipt printer');
    }
  };

  useEffect(() => {
    if (!hasAutoPrintedRef.current) {
      hasAutoPrintedRef.current = true;
      executePrint(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onNewCustomer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onNewCustomer]);

  const rawMobile = (order.customerDetails?.mobileNumber || '').replace(/\D/g, '');
  const formattedMobile = rawMobile.length >= 8 
    ? `+65 ${rawMobile}` 
    : (order.customerDetails?.mobileNumber && order.customerDetails.mobileNumber !== '-' 
        ? order.customerDetails.mobileNumber 
        : 'Not provided');

  const isWalkIn = !order.customerDetails?.vehicleNumber || order.customerDetails.vehicleNumber === 'WALK-IN';
  const displayPlate = isWalkIn ? 'WALK-IN' : order.customerDetails.vehicleNumber;
  const isPaid = String(order.paymentStatus).toUpperCase() === 'PAID';
  const vehicleImgSource = getVehicleImageSource(order.vehicle);

  return (
    <View style={styles.container}>
      {/* Top Center Logo & Header */}
      <KioskTopHeader
        subtitle={isDealer ? "DEALER ORDER CONFIRMED" : "ORDER CONFIRMED & QUEUED"}
        screenName="Page6SuccessScreen.tsx"
        onExitToPos={onExitToPos}
      />

      {/* Main Title & Status Prompt Header */}
      <View style={styles.promptHeader}>
        <Text style={styles.mainTitle}>
          {isDealer ? "Dealer Order Registered" : "Order Placed Successfully!"}
        </Text>
        <View style={styles.titleUnderlineAccent} />
      </View>

      {/* Main Content Area - PORTRAIT OPTIMIZED */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.portraitContainer}>
          {/* THE UNIFIED DIGITAL QUEUE PASS */}
          <View style={styles.unifiedPassCard}>
            <View style={styles.passTopAccent} />

            {/* TOP TICKET SECTION: QUEUE NUMBER HERO */}
            <View style={styles.passHeroSection}>
              <View style={styles.passHeaderRow}>
                <View style={styles.passBadge}>
                  <Ionicons name="receipt" size={14} color={RED_BAY_COLORS.primary} />
                  <Text style={styles.passBadgeText}>OFFICIAL QUEUE PASS</Text>
                </View>
                <View style={styles.liveQueuePill}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.liveQueueText}>BAY QUEUE ACTIVE</Text>
                </View>
              </View>

              {/* Pedestal with Bill / Queue Number */}
              <View style={styles.billPedestal}>
                <Text style={styles.billPedestalLabel}>YOUR BILL / QUEUE NUMBER</Text>
                <Text style={styles.billPedestalNumber}>{order.billNumber}</Text>
                <View style={styles.billHintRow}>
                  <Ionicons name="information-circle-outline" size={13} color="#94A3B8" />
                  <Text style={styles.billHintText}>
                    Keep your receipt or quote this number at Bay #01
                  </Text>
                </View>
              </View>
            </View>

            {/* Serrated Perforated Divider */}
            <View style={styles.perforationContainer}>
              <View style={styles.notchLeft} />
              <View style={styles.perforationLine} />
              <View style={styles.notchRight} />
            </View>

            {/* BOTTOM SECTION: VEHICLE & ORDER BREAKDOWN */}
            <View style={styles.passBodySection}>
              {/* Showroom Vehicle & Package Spotlight */}
              <View style={styles.vehicleSpotlight}>
                <View style={styles.vehicleImageBox}>
                  {vehicleImgSource ? (
                    <Image
                      source={vehicleImgSource}
                      style={styles.vehicleImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons name="car-sport" size={28} color={RED_BAY_COLORS.primary} />
                  )}
                </View>
                <View style={styles.vehicleInfoCol}>
                  <Text style={styles.spotlightPkgName}>{order.selectedPackage?.name || 'Wash Service'}</Text>
                  <Text style={styles.spotlightVehType}>{order.vehicle?.name || 'Standard Vehicle'}</Text>
                  <View style={styles.plateRow}>
                    {isWalkIn ? (
                      <View style={styles.walkInPlatePill}>
                        <Text style={styles.walkInPlateText}>WALK-IN</Text>
                      </View>
                    ) : (
                      <View style={styles.sgPlatePill}>
                        <Text style={styles.sgTag}>SG</Text>
                        <Text style={styles.sgPlateNumber}>{displayPlate}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Meta Details Grid */}
              <View style={styles.metaGrid}>
                {isDealer && order.selectedDealer && (
                  <>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Authorized Dealer</Text>
                      <Text style={[styles.metaValue, { color: '#D97706', fontWeight: '800' }]}>
                        {order.selectedDealer.name}
                      </Text>
                    </View>
                    <View style={styles.metaDivider} />
                  </>
                )}

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{isDealer ? "Driver / Rep" : "Customer Name"}</Text>
                  <Text style={styles.metaValue}>{order.customerDetails?.customerName || 'Walk-in Customer'}</Text>
                </View>
                <View style={styles.metaDivider} />

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Contact Mobile</Text>
                  <Text style={[styles.metaValue, formattedMobile === 'Not provided' && { color: '#94A3B8', fontWeight: '500' }]}>
                    {formattedMobile}
                  </Text>
                </View>
                <View style={styles.metaDivider} />

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Payment</Text>
                  <View style={styles.paymentBadgesRow}>
                    <View style={[styles.payModePill, isDealer && styles.creditPayModePill]}>
                      <Text style={[styles.payModePillText, isDealer && styles.creditPayModePillText]}>
                        {order.paymentMode || 'CASH'}
                      </Text>
                    </View>
                    <View style={[styles.paidPill, !isPaid && styles.pendingPill]}>
                      <Ionicons 
                        name={isPaid ? "checkmark-circle" : "time-outline"} 
                        size={12} 
                        color={isPaid ? "#059669" : "#D97706"} 
                      />
                      <Text style={[styles.paidPillText, !isPaid && styles.pendingPillText]}>
                        {order.paymentStatus || 'PAID'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Total Banner */}
              <View style={styles.totalBanner}>
                <View>
                  <Text style={styles.totalBannerLabel}>
                    {isDealer ? "TOTAL BILLED TO ACCOUNT" : "TOTAL AMOUNT PAID"}
                  </Text>
                  <Text style={styles.totalBannerGst}>
                    Includes Singapore 9% GST (${(order.gstAmount || 0).toFixed(2)})
                  </Text>
                </View>
                <Text style={styles.totalBannerPrice}>SGD ${(order.totalAmount || 0).toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Centered Start New Order Button */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onNewCustomer}
            activeOpacity={0.88}
          >
            <Text style={styles.actionBtnText}>Start New Order</Text>
          </TouchableOpacity>

          {/* Auto return countdown */}
          <View style={styles.autoReturnRow}>
            <Ionicons name="time-outline" size={13} color="#94A3B8" />
            <Text style={styles.autoReturnText}>
              Kiosk returns to home in <Text style={styles.countdownHighlight}>{countdown}s</Text>
            </Text>
          </View>
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
  mainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  titleUnderlineAccent: {
    width: 36,
    height: 3,
    backgroundColor: RED_BAY_COLORS.primary,
    borderRadius: 2,
    marginTop: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexGrow: 1,
  },
  portraitContainer: {
    width: '100%',
    maxWidth: 540,
    gap: 14,
  },

  /* Unified Pass Card */
  unifiedPassCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.06, 14, 3),
  },
  passTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  passHeroSection: {
    padding: 18,
    gap: 12,
  },
  passHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  passBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  passBadgeText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  liveQueuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveQueueText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.5,
  },
  billPedestal: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#1E293B',
    ...makeShadow('#000000', { width: 0, height: 4 }, 0.15, 8, 2),
  },
  billPedestalLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1.4,
  },
  billPedestalNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.8,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    marginVertical: 2,
  },
  billHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  billHintText: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
  },

  /* Perforation Line & Notches */
  perforationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    marginHorizontal: -1.5,
    position: 'relative',
  },
  notchLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginLeft: -10,
    borderRightWidth: 1.5,
    borderRightColor: '#E2E8F0',
  },
  perforationLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginHorizontal: 8,
  },
  notchRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginRight: -10,
    borderLeftWidth: 1.5,
    borderLeftColor: '#E2E8F0',
  },

  /* Pass Body Breakdown */
  passBodySection: {
    padding: 18,
    paddingTop: 10,
    gap: 12,
  },
  vehicleSpotlight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  vehicleImageBox: {
    width: 86,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    overflow: 'hidden',
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
  },
  vehicleInfoCol: {
    flex: 1,
    gap: 2,
  },
  spotlightPkgName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  spotlightVehType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  sgPlatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 6,
    overflow: 'hidden',
  },
  sgTag: {
    backgroundColor: RED_BAY_COLORS.primary,
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    letterSpacing: 0.5,
  },
  sgPlateNumber: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 2,
    letterSpacing: 0.8,
  },
  walkInPlatePill: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  walkInPlateText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  /* Meta Grid */
  metaGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  metaLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  metaDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  paymentBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payModePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  creditPayModePill: {
    backgroundColor: '#FEF3C7',
  },
  payModePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  creditPayModePillText: {
    color: '#92400E',
  },
  paidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  paidPillText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.5,
  },
  pendingPill: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  pendingPillText: {
    color: '#B45309',
  },

  /* Total Banner */
  totalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#FFE4E6',
  },
  totalBannerLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#9F1239',
    letterSpacing: 0.6,
  },
  totalBannerGst: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#BE123C',
    marginTop: 2,
  },
  totalBannerPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
    letterSpacing: 0.3,
  },

  /* Action Button & Countdown */
  actionBtn: {
    width: '100%',
    backgroundColor: RED_BAY_COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 6 }, 0.25, 12, 3),
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  autoReturnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  autoReturnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  countdownHighlight: {
    color: RED_BAY_COLORS.primary,
    fontWeight: '800',
  },
});
