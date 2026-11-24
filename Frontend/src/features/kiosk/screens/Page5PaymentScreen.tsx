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
import { KioskBackground } from '../components/KioskBackground';
import { PaymentMode, VehicleOption, ServiceCategory, ServicePackage, CustomerDetails } from '../types/kiosk.types';
import { fetchPaymodes, PayModeOption, CreatedOrderResponse } from '../../../services/carwashOrderApi';
import { processYeahPayPayment } from '../../../services/yeahpayApi';
import { getCachedGstRate, getCachedCompanySettings } from '../../../services/companySettingsApi';
import { buildValidSgQrString } from '../../../utils/sgqr';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { getVehicleImageSource } from './Page2VehicleScreen';
import { useKioskResponsive } from '../utils/useKioskResponsive';

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
  savedOrder?: CreatedOrderResponse | null;
  onPaymentProcessingChange?: (isProcessing: boolean) => void;
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
  savedOrder,
  onPaymentProcessingChange,
}) => {
  const { 
    isTallKiosk, 
    isLandscape, 
    isLandscapeShort, 
    contentMaxWidth, 
    horizontalPadding, 
    paymodeCols, 
    scale, 
    scaleFont, 
    scaleSize, 
    clamp, 
    width,
    height 
  } = useKioskResponsive();

  const qrDimension = Math.min(Math.max(Math.round(height * 0.22), 150), 200);

  const isVeryNarrow = width < 480;
  const paymodeCardWidth = isVeryNarrow 
    ? '100%' 
    : paymodeCols === 3 
      ? '31.5%' 
      : '48.5%';

  const dynamicPayCardMinHeight = scaleSize(142, 115, 220);
  const dynamicPayIconBoxSize = scaleSize(52, 42, 74);
  const dynamicPayTitleFont = scaleFont(15.5, 13, 21);

  const [paymodes, setPaymodes] = useState<PayModeOption[]>([]);
  const [loadingPaymodes, setLoadingPaymodes] = useState<boolean>(true);
  const [paymodeError, setPaymodeError] = useState<string>('');

  const [selectedMode, setSelectedMode] = useState<string | undefined>(
    typeof initialPaymentMode === 'string' ? initialPaymentMode : undefined
  );
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    onPaymentProcessingChange?.(isProcessing);
  }, [isProcessing, onPaymentProcessingChange]);

  // Totals - Strictly GST Exclusive pricing calculation
  const baseAmount = savedOrder?.packagePrice != null ? Number(savedOrder.packagePrice) : selectedPackage.price;
  const gstPercent = savedOrder?.gstPercent != null ? Number(savedOrder.gstPercent) : getCachedGstRate();
  const gstAmount = savedOrder?.gstAmount != null ? Number(savedOrder.gstAmount) : Number(((baseAmount * (gstPercent / 100))).toFixed(2));
  const total = savedOrder?.totalAmount != null ? Number(savedOrder.totalAmount) : Number((baseAmount + gstAmount).toFixed(2));

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

  // YeahPay Terminal Modal States
  const [terminalModalVisible, setTerminalModalVisible] = useState(false);
  const [terminalStatus, setTerminalStatus] = useState<'WAITING' | 'SUCCESS' | 'ERROR'>('WAITING');
  const [terminalMessage, setTerminalMessage] = useState('');
  const [activePayMode, setActivePayMode] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [countdownSeconds, setCountdownSeconds] = useState<number>(180);

  useEffect(() => {
    let timer: any = null;
    if (terminalModalVisible && terminalStatus === 'WAITING') {
      timer = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setTerminalStatus('ERROR');
            setTerminalMessage('Terminal payment waiting time expired (3 minutes). Please retry or choose Cash.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [terminalModalVisible, terminalStatus]);

  const executeTerminalPayment = async (mode: string, deviceSN?: string, deviceSalt?: string) => {
    const isCard = mode.trim().toUpperCase().includes('CARD');
    const payModeKey: 'YEAHPAY_CARD' | 'YEAHPAY_QR' = isCard ? 'YEAHPAY_CARD' : 'YEAHPAY_QR';
    const modeObj = paymodes.find(p => p.payMode.trim().toUpperCase() === mode.trim().toUpperCase());
    const effectiveDeviceSn = deviceSN || modeObj?.deviceSN;
    const effectiveSalt = deviceSalt || modeObj?.deviceSalt;

    // Check if merchant has an official registered PayNow UEN in settings
    const registeredUen = getCachedCompanySettings()?.GSTNo?.trim();
    if (!isCard && registeredUen && registeredUen.length >= 8) {
      const validSgQr = buildValidSgQrString({
        uen: registeredUen,
        amount: total,
        orderRef: orderNo || savedOrder?.orderNo || 'RB-001',
        merchantName: getCachedCompanySettings()?.CompanyName || 'REDBAY CAR WASH',
      });
      if (validSgQr) {
        setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(validSgQr)}`);
      } else {
        setQrCodeUrl('');
      }
    } else {
      // In YeahPay terminal flow, the physical terminal displays the real PayNow QR on its own screen
      setQrCodeUrl('');
    }

    setCountdownSeconds(180);
    setTerminalModalVisible(true);
    setTerminalStatus('WAITING');
    setTerminalMessage(
      isCard
        ? 'Please present and tap or insert your card on the terminal...'
        : 'Please scan the PayNow QR code on the payment terminal screen...'
    );

    try {
      const orderId = savedOrder?.orderId || 0;
      const res = await processYeahPayPayment({
        orderId,
        payMode: payModeKey,
        amount: total,
        cashierName: 'KIOSK',
        deviceSn: effectiveDeviceSn,
        salt: effectiveSalt,
        timeoutMs: 180000,
      });

      if (res.qrImageUrl) {
        setQrCodeUrl(res.qrImageUrl);
      } else if (res.qrCode && res.qrCode.startsWith('http')) {
        setQrCodeUrl(res.qrCode);
      } else if (res.qrCode) {
        setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(res.qrCode)}`);
      }

      if (res.success || res.code === 0) {
        setTerminalStatus('SUCCESS');
        setTerminalMessage('✅ Payment Approved! Preparing your wash receipt...');
        setTimeout(async () => {
          setTerminalModalVisible(false);
          await onConfirmPayment(mode);
        }, 1200);
      } else {
        setTerminalStatus('ERROR');
        let errMsg = res.msg || res.message || 'Payment failed on terminal';
        if (res.code === -1027) errMsg = 'Transaction was cancelled on the terminal.';
        if (res.code === -1028 || res.code === -1008) errMsg = 'Terminal transaction timed out.';
        setTerminalMessage(errMsg);
      }
    } catch (err: any) {
      setTerminalStatus('ERROR');
      setTerminalMessage(err.message || 'Could not communicate with payment terminal.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModeSelect = async (pm: PayModeOption | string) => {
    if (isProcessing) return;
    const modeName = typeof pm === 'string' ? pm : pm.payMode;
    const modeObj = typeof pm === 'string' 
      ? paymodes.find(p => p.payMode.trim().toUpperCase() === pm.trim().toUpperCase()) 
      : pm;

    setSelectedMode(modeName);
    setActivePayMode(modeName);

    // ONLY when YeahPayEnabled === 1 (or true) use YeahPay terminal / QR flow
    const isYeahPay = Boolean(modeObj?.yeahPayEnabled);

    if (isYeahPay) {
      setIsProcessing(true);
      await executeTerminalPayment(modeName, modeObj?.deviceSN, modeObj?.deviceSalt);
    } else {
      // Normal flow (Cash, standard Counter Card, Member, Fleet Credit, etc.)
      setIsProcessing(true);
      try {
        await onConfirmPayment(modeName);
      } catch (err: any) {
        setIsProcessing(false);
        Alert.alert('Payment Error', err?.message || 'Payment failed to process');
      }
    }
  };

  const getPaymodeMeta = (pm: PayModeOption | string) => {
    const payMode = typeof pm === 'string' ? pm : pm.payMode;
    const isYeahPay = typeof pm === 'object' ? Boolean(pm.yeahPayEnabled) : false;
    const upper = payMode.trim().toUpperCase();

    if (isYeahPay) {
      if (upper.includes('CARD')) {
        return {
          iconName: 'card-outline' as any,
          badgeBg: '#F3E8FF',
          badgeColor: '#7C3AED',
          subtitle: 'YeahPay Terminal Card',
        };
      }
      return {
        iconName: 'qr-code-outline' as any,
        badgeBg: '#FCE7F3',
        badgeColor: '#BE185D',
        subtitle: 'YeahPay PayNow SGQR',
      };
    }

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
    if (upper.includes('CARD')) {
      return {
        iconName: 'card-outline' as any,
        badgeBg: '#F1F5F9',
        badgeColor: '#334155',
        subtitle: 'Credit / Debit Card',
      };
    }
    return {
      iconName: 'wallet-outline' as any,
      badgeBg: '#F8FAFC',
      badgeColor: '#64748B',
      subtitle: 'Counter Payment',
    };
  };

  const isWalkIn = !customerDetails?.vehicleNumber || customerDetails.vehicleNumber === 'WALK-IN';
  const vehicleImgSource = getVehicleImageSource(vehicle);

  return (
    <View style={styles.container}>
      <KioskBackground />
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

      {/* Main Content Area - RESPONSIVE & BALANCED */}
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
        <View style={[styles.portraitContainer, { maxWidth: contentMaxWidth, width: '100%' }]}>
          {/* Order Summary Strip (Responsive Full-Width) */}
          <View style={[styles.summaryBar, isTallKiosk && styles.summaryBarTall]}>
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
                  ${total.toFixed(2)}
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
                  const meta = getPaymodeMeta(pm);

                  return (
                    <TouchableOpacity
                      key={pm.position || pm.payMode}
                      style={[
                        styles.paymentOptionCard,
                        { width: paymodeCardWidth, minHeight: dynamicPayCardMinHeight },
                        isTallKiosk && styles.paymentOptionCardTall,
                        isLandscapeShort && styles.paymentOptionCardShort,
                        isSelected && styles.paymentOptionCardSelected,
                        isProcessing && !isSelected && styles.paymentOptionCardDisabled,
                      ]}
                      onPress={() => handleModeSelect(pm)}
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
                      <View style={[styles.payIconBox, { width: dynamicPayIconBoxSize, height: dynamicPayIconBoxSize, backgroundColor: meta.badgeBg }]}>
                        <Ionicons name={meta.iconName} size={isTallKiosk ? 34 : 28} color={meta.badgeColor} />
                      </View>

                      {/* Centered Details: Title */}
                      <View style={styles.payDetailsCol}>
                        <Text style={[styles.payModeTitle, { fontSize: dynamicPayTitleFont }, isSelected && styles.payModeTitleSelected]}>
                          {pm.payMode}
                        </Text>
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
          {isProcessing && !terminalModalVisible && (
            <View style={styles.processingBanner}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.processingBannerText}>
                Authorizing payment with {selectedMode}... Please wait.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ================= YEAHPAY TERMINAL POPUP MODAL ================= */}
      <Modal visible={terminalModalVisible} animationType="fade" transparent>
        <View style={styles.terminalOverlay}>
          <View style={[styles.terminalContainer, { maxHeight: Math.min(height * 0.94, 740) }]}>
            {/* 1. Fixed Header */}
            <View style={styles.terminalHeader}>
              <View style={styles.terminalHeaderLeft}>
                <View style={styles.terminalRedPuck} />
                <View>
                  <Text style={styles.terminalHeaderTitle}>
                    {activePayMode.toUpperCase().includes('CARD') ? 'YeahPay Card Terminal' : 'YeahPay PayNow SGQR'}
                  </Text>
                  <Text style={styles.terminalHeaderSubtitle}>
                    Order #{orderNo || savedOrder?.orderNo || 'RB-001'} • {isWalkIn ? 'WALK-IN' : customerDetails.vehicleNumber}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.terminalCloseBtn} 
                onPress={() => {
                  setTerminalModalVisible(false);
                  setIsProcessing(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.terminalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 2. Scrollable Modal Content */}
            <ScrollView 
              style={styles.terminalScrollView} 
              contentContainerStyle={styles.terminalScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Amount Display Box */}
              <View style={styles.terminalAmountBox}>
                <Text style={styles.terminalAmountLabel}>TOTAL AMOUNT DUE</Text>
                <Text style={styles.terminalAmountValue}>${total.toFixed(2)}</Text>
                <Text style={styles.terminalAmountPackage}>
                  {selectedPackage.name} • {vehicle.name}
                </Text>
              </View>

              {/* Terminal Flow Illustration */}
              {activePayMode.toUpperCase().includes('CARD') ? (
                <View style={styles.terminalIllustrationBox}>
                  <View style={[styles.terminalIconCircle, { backgroundColor: '#F3E8FF' }]}>
                    <Ionicons name="card" size={44} color="#7C3AED" />
                  </View>
                  <Text style={styles.terminalInstructTitle}>Please Look at Payment Terminal</Text>
                  <Text style={styles.terminalInstructBody}>
                    Present your Visa, Mastercard, NETS FlashPay card, or mobile phone (Apple Pay / Google Pay) and tap on the terminal.
                  </Text>
                </View>
              ) : qrCodeUrl ? (
                <View style={styles.payNowQrBox}>
                  {/* Official PayNow Top Banner */}
                  <View style={styles.payNowBrandHeader}>
                    <View style={styles.payNowBrandTitleRow}>
                      <Text style={styles.payNowBrandText}>PayNow</Text>
                      <View style={styles.sgQrBadge}>
                        <Text style={styles.sgQrBadgeText}>SGQR</Text>
                      </View>
                    </View>
                    <Text style={styles.payNowUenSub}>
                      UEN: {getCachedCompanySettings()?.GSTNo || 'REGISTERED UEN'} • {(getCachedCompanySettings()?.CompanyName || 'REDBAY CAR WASH').toUpperCase()}
                    </Text>
                  </View>

                  {/* Clean, authentic High-Resolution PayNow QR Code */}
                  <View style={[styles.qrCodeWrapper, { width: qrDimension, height: qrDimension }]}>
                    <Image
                      source={{ uri: qrCodeUrl }}
                      style={styles.qrCodeImage}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={styles.terminalInstructTitle}>Scan to Pay ${total.toFixed(2)}</Text>
                  <Text style={styles.payNowScanHint}>
                    Open DBS PayLah!, OCBC, UOB, GrabPay or any SG bank app
                  </Text>

                  {/* Supported Banks Row */}
                  <View style={styles.supportedBanksRow}>
                    <View style={styles.bankPill}><Text style={styles.bankPillText}>PayLah!</Text></View>
                    <View style={styles.bankPill}><Text style={styles.bankPillText}>OCBC</Text></View>
                    <View style={styles.bankPill}><Text style={styles.bankPillText}>UOB</Text></View>
                    <View style={styles.bankPill}><Text style={styles.bankPillText}>GrabPay</Text></View>
                  </View>
                </View>
              ) : (
                <View style={styles.terminalIllustrationBox}>
                  <View style={[styles.terminalIconCircle, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="qr-code" size={44} color="#ED0712" />
                  </View>
                  <Text style={styles.terminalInstructTitle}>Scan PayNow QR on the Terminal</Text>
                  <Text style={styles.terminalInstructBody}>
                    Look at the screen on your payment terminal. The terminal is displaying the dynamic PayNow / SGQR code. Scan with DBS PayLah!, OCBC, UOB, or your banking app.
                  </Text>
                  <View style={styles.supportedBanksRow}>
                    <View style={styles.bankPill}><Text style={styles.bankPillText}>PayLah!</Text></View>
                    <View style={styles.bankPill}><Text style={styles.bankPillText}>OCBC</Text></View>
                    <View style={styles.bankPill}><Text style={styles.bankPillText}>UOB</Text></View>
                    <View style={styles.bankPill}><Text style={styles.bankPillText}>GrabPay</Text></View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* 3. Pinned Bottom Footer with Status & Action Buttons */}
            <View style={styles.terminalFooter}>
              {/* Status Badge */}
              <View style={[
                styles.terminalStatusStrip,
                terminalStatus === 'WAITING' && styles.terminalStatusWaiting,
                terminalStatus === 'SUCCESS' && styles.terminalStatusSuccess,
                terminalStatus === 'ERROR' && styles.terminalStatusError
              ]}>
                {terminalStatus === 'WAITING' && (
                  <ActivityIndicator size="small" color="#B45309" style={{ marginRight: 8 }} />
                )}
                {terminalStatus === 'SUCCESS' && (
                  <Ionicons name="checkmark-circle" size={18} color="#059669" style={{ marginRight: 6 }} />
                )}
                {terminalStatus === 'ERROR' && (
                  <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                )}
                <Text style={[
                  styles.terminalStatusText,
                  terminalStatus === 'WAITING' && { color: '#B45309' },
                  terminalStatus === 'SUCCESS' && { color: '#059669' },
                  terminalStatus === 'ERROR' && { color: '#DC2626' }
                ]}>
                  {terminalStatus === 'WAITING'
                    ? `Waiting for payment on terminal... (${countdownSeconds}s)`
                    : terminalMessage}
                </Text>
              </View>

              {/* Actions Footer */}
              <View style={styles.terminalActionsRow}>
                {terminalStatus === 'ERROR' ? (
                  <>
                    <TouchableOpacity 
                      style={styles.terminalCancelBtn}
                      onPress={() => {
                        setTerminalModalVisible(false);
                        setIsProcessing(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.terminalCancelText}>Cancel & Choose Cash</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.terminalRetryBtn}
                      onPress={() => executeTerminalPayment(activePayMode)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.terminalRetryText}>Retry on Terminal</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity 
                    style={styles.terminalCancelBtn}
                    onPress={() => {
                      setTerminalModalVisible(false);
                      setIsProcessing(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.terminalCancelText}>Cancel & Choose Cash</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  scrollContentTall: {
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  portraitContainer: {
    width: '100%',
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
  summaryBarTall: {
    padding: 24,
    borderRadius: 26,
    gap: 16,
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
  paymentOptionCard3Col: {
    width: '31.8%',
  },
  paymentOptionCardTall: {
    minHeight: 200,
    borderRadius: 26,
    paddingVertical: 28,
    paddingHorizontal: 18,
    gap: 16,
    ...makeShadow('#000000', { width: 0, height: 8 }, 0.08, 16, 4),
  },
  paymentOptionCardShort: {
    minHeight: 110,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 6,
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

  /* ================= YEAHPAY TERMINAL POPUP MODAL STYLES ================= */
  terminalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  terminalContainer: {
    width: '94%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...makeShadow('#000000', { width: 0, height: 12 }, 0.35, 24, 12),
  },
  terminalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: RED_BAY_COLORS.secondary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: RED_BAY_COLORS.primary,
  },
  terminalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  terminalRedPuck: {
    width: 5,
    height: 28,
    borderRadius: 3,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  terminalHeaderTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  terminalHeaderSubtitle: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600',
  },
  terminalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  terminalCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  terminalScrollView: {
    flexGrow: 0,
  },
  terminalScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 10,
  },
  terminalAmountBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  terminalAmountLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  terminalAmountValue: {
    fontSize: 26,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
    marginVertical: 2,
  },
  terminalAmountPackage: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  terminalIllustrationBox: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  terminalIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  terminalInstructTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  terminalInstructBody: {
    fontSize: 12.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  terminalFooter: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  terminalStatusStrip: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  terminalStatusWaiting: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  terminalStatusSuccess: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  terminalStatusError: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  terminalStatusText: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    flex: 1,
  },
  terminalActionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  terminalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalCancelText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#475569',
  },
  terminalRetryBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: RED_BAY_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalRetryText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  /* ================= PAYNOW SGQR CODE STYLES ================= */
  payNowQrBox: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: '#7B1147',
    ...makeShadow('#7B1147', { width: 0, height: 4 }, 0.12, 10, 4),
  },
  payNowBrandHeader: {
    width: '100%',
    backgroundColor: '#7B1147',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 6,
  },
  payNowBrandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payNowBrandText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  sgQrBadge: {
    backgroundColor: '#ED0712',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sgQrBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  payNowUenSub: {
    fontSize: 9.5,
    color: '#FCE7F3',
    fontWeight: '700',
    marginTop: 2,
  },
  qrCodeWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1.5,
    borderColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    ...makeShadow('#000000', { width: 0, height: 3 }, 0.12, 6, 2),
  },
  qrCodeImage: {
    width: '100%',
    height: '100%',
  },
  payNowScanHint: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 4,
  },
  supportedBanksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 2,
  },
  bankPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  bankPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#334155',
  },
});
