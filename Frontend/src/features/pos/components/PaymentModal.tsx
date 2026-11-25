import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput,
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  ActivityIndicator, 
  Alert, 
  ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { PosOrder, PaymentMethodType } from '../../../types/pos.types';
import { processYeahPayPayment } from '../../../services/yeahpayApi';
import { updateOrderPayment } from '../../../services/carwashOrderApi';

interface PaymentModalProps {
  visible: boolean;
  order: PosOrder | null;
  onClose: () => void;
  onConfirmPayment: (orderId: string, method: PaymentMethodType) => void;
  currentLanguage?: 'EN' | 'ZH';
  cashierName?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  order,
  onClose,
  onConfirmPayment,
  currentLanguage = 'EN',
  cashierName = 'Cashier',
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('YEAHPAY_QR');
  const [cashTendered, setCashTendered] = useState<number>(50.0);
  const [cashInputStr, setCashInputStr] = useState<string>('50.00');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusPrompt, setStatusPrompt] = useState<string>('');

  useEffect(() => {
    if (visible && order) {
      const initAmt = Number(order.totalAmount || 0);
      setCashTendered(initAmt);
      setCashInputStr(initAmt.toFixed(2));
    }
  }, [visible, order?.id, order?.totalAmount]);

  if (!order) return null;

  const total = order.totalAmount;
  const isCashInsufficient = selectedMethod === 'CASH' && cashTendered < total - 0.001;
  const shortBy = Math.max(0, total - cashTendered);
  const changeDue = Math.max(0, cashTendered - total);
  const numericOrderId = order.orderId || parseInt(order.id, 10);

  const handleCashStrUpdate = (raw: string) => {
    // Allow digits and at most one decimal point with up to 2 decimal places
    let cleaned = raw.replace(/[^0-9.]/g, '');
    const dotIdx = cleaned.indexOf('.');
    if (dotIdx !== -1) {
      cleaned = cleaned.slice(0, dotIdx + 1) + cleaned.slice(dotIdx + 1).replace(/\./g, '');
      const parts = cleaned.split('.');
      if (parts[1] && parts[1].length > 2) {
        cleaned = `${parts[0]}.${parts[1].slice(0, 2)}`;
      }
    }
    if (cleaned.length > 8) {
      cleaned = cleaned.slice(0, 8);
    }
    setCashInputStr(cleaned);
    const parsed = parseFloat(cleaned);
    setCashTendered(Number.isFinite(parsed) ? parsed : 0);
  };

  const handleNumpadPress = (key: string) => {
    if (isProcessing) return;
    if (key === 'CLEAR') {
      setCashInputStr('');
      setCashTendered(0);
      return;
    }
    if (key === 'BACK') {
      const next = cashInputStr.slice(0, -1);
      setCashInputStr(next);
      const parsed = parseFloat(next);
      setCashTendered(Number.isFinite(parsed) ? parsed : 0);
      return;
    }
    // If current input is the auto-prefilled exact total (ends with .00 etc.) or 0, allow typing cleanly
    if (key === '.' && cashInputStr.includes('.')) return;
    const next = cashInputStr === '0' && key !== '.' ? key : `${cashInputStr}${key}`;
    handleCashStrUpdate(next);
  };

  const handlePay = async () => {
    if (selectedMethod === 'CASH' && cashTendered < total - 0.001) {
      Alert.alert(
        'Insufficient Cash Amount',
        `Cash tendered ($${cashTendered.toFixed(2)}) is less than the order total ($${total.toFixed(2)}). Please enter at least $${total.toFixed(2)}.`
      );
      return;
    }

    try {
      setIsProcessing(true);

      if (selectedMethod === 'CASH') {
        setStatusPrompt('Confirming Cash payment...');
        await updateOrderPayment(numericOrderId, {
          payMode: 'CASH',
          confirmPaid: true,
          changedBy: cashierName,
          remarks: `Cash tendered $${cashTendered.toFixed(2)}, change $${changeDue.toFixed(2)}`,
        });
      } else {
        // YeahPay Terminal Flow
        setStatusPrompt(
          selectedMethod === 'YEAHPAY_QR'
            ? '📱 Scan PayNow QR on terminal...'
            : '💳 Tap or Insert Card on terminal...'
        );

        await processYeahPayPayment({
          orderId: numericOrderId,
          payMode: selectedMethod as 'YEAHPAY_QR' | 'YEAHPAY_CARD',
          cashierName,
        });
      }

      onConfirmPayment(order.id, selectedMethod);
      onClose();
    } catch (err: any) {
      console.error('[Payment Error]:', err);
      Alert.alert(
        currentLanguage === 'EN' ? 'Payment Unsuccessful' : '支付未完成',
        err.message || 'Transaction could not be completed on the terminal.'
      );
    } finally {
      setIsProcessing(false);
      setStatusPrompt('');
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Top Brand Accent Line */}
          <View style={styles.topAccentBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="card" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.headerTitle}>
                  {currentLanguage === 'EN' ? 'Checkout & Payment' : '收银结账与支付'}
                </Text>
                <View style={styles.headerMetaRow}>
                  <View style={styles.orderNoPill}>
                    <Text style={styles.orderNoPillText}>#{order.orderNumber}</Text>
                  </View>
                  <View style={styles.platePill}>
                    <Ionicons name="car-outline" size={13} color="#94A3B8" style={{ marginRight: 4 }} />
                    <Text style={styles.platePillText}>{order.vehiclePlate || 'WALK-IN'}</Text>
                  </View>
                  {order.customerName ? (
                    <Text style={styles.customerNameText} numberOfLines={1}>
                      • {order.customerName}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {!isProcessing && (
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Body Content */}
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Step 1: Payment Method Tabs */}
            <Text style={styles.sectionHeading}>SELECT PAYMENT METHOD</Text>
            <View style={styles.methodsRow}>
              {/* YeahPay PayNow QR */}
              <TouchableOpacity
                style={[
                  styles.methodCard,
                  selectedMethod === 'YEAHPAY_QR' && styles.methodCardActive,
                ]}
                onPress={() => !isProcessing && setSelectedMethod('YEAHPAY_QR')}
                activeOpacity={0.8}
                disabled={isProcessing}
              >
                {selectedMethod === 'YEAHPAY_QR' && (
                  <View style={styles.cardActiveCheck}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                )}
                <View style={[styles.methodIconCircle, selectedMethod === 'YEAHPAY_QR' && styles.methodIconCircleActive]}>
                  <Ionicons 
                    name="qr-code-outline" 
                    size={22} 
                    color={selectedMethod === 'YEAHPAY_QR' ? RED_BAY_COLORS.primary : '#475569'} 
                  />
                </View>
                <Text style={[styles.methodTitle, selectedMethod === 'YEAHPAY_QR' && styles.methodTitleActive]}>
                  YeahPay QR
                </Text>
                <Text style={styles.methodSub}>PayNow / SGQR</Text>
              </TouchableOpacity>

              {/* YeahPay Card Terminal */}
              <TouchableOpacity
                style={[
                  styles.methodCard,
                  selectedMethod === 'YEAHPAY_CARD' && styles.methodCardActive,
                ]}
                onPress={() => !isProcessing && setSelectedMethod('YEAHPAY_CARD')}
                activeOpacity={0.8}
                disabled={isProcessing}
              >
                {selectedMethod === 'YEAHPAY_CARD' && (
                  <View style={styles.cardActiveCheck}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                )}
                <View style={[styles.methodIconCircle, selectedMethod === 'YEAHPAY_CARD' && styles.methodIconCircleActive]}>
                  <Ionicons 
                    name="card-outline" 
                    size={22} 
                    color={selectedMethod === 'YEAHPAY_CARD' ? RED_BAY_COLORS.primary : '#475569'} 
                  />
                </View>
                <Text style={[styles.methodTitle, selectedMethod === 'YEAHPAY_CARD' && styles.methodTitleActive]}>
                  YeahPay Card
                </Text>
                <Text style={styles.methodSub}>Contactless / Chip</Text>
              </TouchableOpacity>

              {/* Cash */}
              <TouchableOpacity
                style={[
                  styles.methodCard,
                  selectedMethod === 'CASH' && styles.methodCardActive,
                ]}
                onPress={() => !isProcessing && setSelectedMethod('CASH')}
                activeOpacity={0.8}
                disabled={isProcessing}
              >
                {selectedMethod === 'CASH' && (
                  <View style={styles.cardActiveCheck}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                )}
                <View style={[styles.methodIconCircle, selectedMethod === 'CASH' && styles.methodIconCircleActive]}>
                  <Ionicons 
                    name="cash-outline" 
                    size={22} 
                    color={selectedMethod === 'CASH' ? RED_BAY_COLORS.primary : '#475569'} 
                  />
                </View>
                <Text style={[styles.methodTitle, selectedMethod === 'CASH' && styles.methodTitleActive]}>
                  Cash
                </Text>
                <Text style={styles.methodSub}>Exact & Notes</Text>
              </TouchableOpacity>
            </View>

            {/* In-Flight Processing Banner */}
            {isProcessing && (
              <View style={styles.terminalProcessingBanner}>
                <ActivityIndicator size="small" color="#DC2626" style={{ marginRight: 10 }} />
                <Text style={styles.terminalProcessingText}>{statusPrompt}</Text>
              </View>
            )}

            {/* Dynamic Center Panel based on selected method */}
            {selectedMethod === 'YEAHPAY_QR' && (
              <View style={styles.qrDisplayBox}>
                {/* Visual Singapore PayNow / SGQR Card */}
                <View style={styles.qrVisualContainer}>
                  <View style={styles.payNowHeaderBar}>
                    <Text style={styles.payNowBrandText}>PayNow</Text>
                    <View style={styles.sgqrTag}>
                      <Text style={styles.sgqrTagText}>SGQR</Text>
                    </View>
                  </View>
                  
                  {/* Stylized QR Code Frame with Reticles */}
                  <View style={styles.qrCodeFrame}>
                    {/* 4 Corner Bracket Reticles */}
                    <View style={styles.qrReticleTL} />
                    <View style={styles.qrReticleTR} />
                    <View style={styles.qrReticleBL} />
                    <View style={styles.qrReticleBR} />
                    
                    {/* Inner QR Visual Matrix */}
                    <View style={styles.qrGridPattern}>
                      <View style={styles.qrCornerBlock} />
                      <View style={[styles.qrCornerBlock, { top: 0, right: 0 }]} />
                      <View style={[styles.qrCornerBlock, { bottom: 0, left: 0 }]} />
                      <View style={styles.qrCenterBadge}>
                        <Text style={styles.qrCenterBadgeText}>RED BAY</Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.qrAmountBadgeText}>$ {total.toFixed(2)}</Text>
                </View>

                {/* Instructions & Bank Network */}
                <View style={styles.qrInstructions}>
                  <View style={styles.terminalLivePill}>
                    <View style={styles.liveGreenDot} />
                    <Text style={styles.terminalLiveText}>TERMINAL READY FOR SCAN</Text>
                  </View>

                  <Text style={styles.qrInstructHeading}>Dynamic Singapore PayNow QR</Text>
                  <Text style={styles.qrInstructText}>
                    Dispatches an instant prompt of <Text style={{ fontWeight: '800', color: '#0F172A' }}>${total.toFixed(2)}</Text> to the YeahPay Smart Terminal.
                  </Text>

                  {/* Supported Banks */}
                  <View style={styles.supportedBanksRow}>
                    <View style={styles.bankPill}>
                      <Text style={styles.bankPillText}>DBS PayLah!</Text>
                    </View>
                    <View style={styles.bankPill}>
                      <Text style={styles.bankPillText}>OCBC</Text>
                    </View>
                    <View style={styles.bankPill}>
                      <Text style={styles.bankPillText}>UOB</Text>
                    </View>
                    <View style={styles.bankPill}>
                      <Text style={styles.bankPillText}>GrabPay</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {selectedMethod === 'YEAHPAY_CARD' && (
              <View style={styles.cardTerminalBox}>
                <View style={styles.cardTerminalIconCircle}>
                  <Ionicons name="card" size={32} color={RED_BAY_COLORS.primary} />
                </View>
                <Text style={styles.terminalHeading}>YeahPay Smart Terminal Ready</Text>
                <Text style={styles.terminalSub}>
                  Present the wireless terminal to the customer for Contactless Tap (PayWave / PayPass / Apple Pay) or Chip Insert.
                </Text>
                <View style={styles.cardBrandsRow}>
                  <View style={styles.cardBrandBadge}><Text style={styles.cardBrandText}>VISA</Text></View>
                  <View style={styles.cardBrandBadge}><Text style={styles.cardBrandText}>Mastercard</Text></View>
                  <View style={styles.cardBrandBadge}><Text style={styles.cardBrandText}>NETS FlashPay</Text></View>
                  <View style={styles.cardBrandBadge}><Text style={styles.cardBrandText}>NFC Pay</Text></View>
                </View>
                <View style={styles.terminalStatusPill}>
                  <View style={styles.liveGreenDot} />
                  <Text style={styles.terminalStatusText}>Terminal Online & Listening</Text>
                </View>
              </View>
            )}

            {selectedMethod === 'CASH' && (
              <View style={styles.cashBox}>
                <Text style={styles.cashSectionTitle}>QUICK CASH TENDERED</Text>
                <View style={styles.quickCashButtons}>
                  {[total, 30, 50, 100].map((amt, idx) => {
                    const isActive = Math.abs(cashTendered - amt) < 0.001;
                    const isBelowTotal = amt < total - 0.001;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.quickCashBtn,
                          isBelowTotal && styles.quickCashBtnLow,
                          isActive && (isBelowTotal ? styles.quickCashBtnError : styles.quickCashBtnActive),
                        ]}
                        onPress={() => {
                          setCashTendered(amt);
                          setCashInputStr(amt.toFixed(2));
                        }}
                        disabled={isProcessing}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.quickCashText,
                            isBelowTotal && { color: '#94A3B8' },
                            isActive && styles.quickCashTextActive,
                          ]}
                        >
                          {amt === total ? `Exact ($${amt.toFixed(2)})` : `$${amt.toFixed(0)}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom Cash Input + Touch Numpad */}
                <View style={styles.numpadSection}>
                  <View style={styles.cashInputRow}>
                    <Text style={styles.cashCurrencyPrefix}>$</Text>
                    <TextInput
                      style={styles.cashTextInput}
                      value={cashInputStr}
                      onChangeText={handleCashStrUpdate}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="#94A3B8"
                      editable={!isProcessing}
                    />
                    <TouchableOpacity
                      style={styles.cashClearChip}
                      onPress={() => handleNumpadPress('CLEAR')}
                      disabled={isProcessing}
                    >
                      <Text style={styles.cashClearChipText}>CLEAR</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.numpadGrid}>
                    {[
                      ['1', '2', '3'],
                      ['4', '5', '6'],
                      ['7', '8', '9'],
                      ['.', '0', 'BACK'],
                    ].map((row, rIdx) => (
                      <View key={rIdx} style={styles.numpadRow}>
                        {row.map((key) => (
                          <TouchableOpacity
                            key={key}
                            style={[styles.numpadKey, key === 'BACK' && styles.numpadKeyAction]}
                            onPress={() => handleNumpadPress(key)}
                            disabled={isProcessing}
                            activeOpacity={0.75}
                          >
                            {key === 'BACK' ? (
                              <Ionicons name="backspace-outline" size={20} color="#334155" />
                            ) : (
                              <Text style={styles.numpadKeyText}>{key}</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </View>
                </View>

                {/* Change Due or Insufficient Warning Highlight */}
                <View
                  style={[
                    styles.changeDueBox,
                    isCashInsufficient
                      ? styles.changeDueBoxInsufficient
                      : changeDue > 0 && styles.changeDueBoxPositive,
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text
                      style={[
                        styles.changeDueLabel,
                        isCashInsufficient && { color: '#DC2626' },
                      ]}
                    >
                      {isCashInsufficient ? 'Insufficient Cash Tendered' : 'Change Due to Customer'}
                    </Text>
                    <Text
                      style={[
                        styles.changeDueSub,
                        isCashInsufficient && { color: '#B91C1C', fontWeight: '600' },
                      ]}
                    >
                      {isCashInsufficient
                        ? `Tendered: $${cashTendered.toFixed(2)} • Short by $${shortBy.toFixed(2)}`
                        : `Tendered: $${cashTendered.toFixed(2)} - Total: $${total.toFixed(2)}`}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.changeDueAmount,
                      isCashInsufficient && { color: '#DC2626' },
                    ]}
                  >
                    {isCashInsufficient ? `-$ ${shortBy.toFixed(2)}` : `$ ${changeDue.toFixed(2)}`}
                  </Text>
                </View>
              </View>
            )}

            {/* Price Breakdown Receipt Card */}
            <View style={styles.breakdownBox}>
              <View style={styles.breakdownHeaderRow}>
                <Text style={styles.breakdownHeaderTitle}>PAYMENT BREAKDOWN</Text>
                <Text style={styles.breakdownPackageName}>{order.packageName || 'Standard Wash'}</Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Service Base Amount</Text>
                <Text style={styles.breakdownVal}>$ {(order.subtotal || order.totalAmount).toFixed(2)}</Text>
              </View>
              {(order.gstRate > 0 || order.gstAmount > 0) && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>GST ({order.gstRate ?? 9}%)</Text>
                  <Text style={styles.breakdownVal}>$ {order.gstAmount.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.grandTotalRow}>
                <View>
                  <Text style={styles.grandTotalLabel}>TOTAL AMOUNT DUE</Text>
                  <Text style={styles.grandTotalSub}>Inclusive of all service charges</Text>
                </View>
                <Text style={styles.grandTotalVal}>$ {total.toFixed(2)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={onClose}
              disabled={isProcessing}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.cancelBtnText}>
                {currentLanguage === 'EN' ? 'Cancel' : '取消'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.confirmPayBtn, (isProcessing || isCashInsufficient) && styles.confirmPayBtnDisabled]} 
              onPress={handlePay}
              disabled={isProcessing || isCashInsufficient}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.confirmPayBtnText}>
                {isProcessing
                  ? 'Processing Transaction...'
                  : isCashInsufficient
                    ? `Short by $ ${shortBy.toFixed(2)}`
                    : `Confirm & Pay $ ${total.toFixed(2)}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    ...makeShadow('#000000', { width: 0, height: 12 }, 0.25, 24, 10),
  },
  topAccentBar: {
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: RED_BAY_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  orderNoPill: {
    backgroundColor: 'rgba(237, 7, 18, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(237, 7, 18, 0.4)',
  },
  orderNoPillText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '800',
  },
  platePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  platePillText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  customerNameText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 140,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  scrollBody: {
    maxHeight: 520,
  },
  bodyContent: {
    padding: 20,
    gap: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    position: 'relative',
    ...makeShadow('#0F172A', { width: 0, height: 2 }, 0.04, 6, 1),
  },
  methodCardActive: {
    backgroundColor: '#FEF2F2',
    borderColor: RED_BAY_COLORS.primary,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 4 }, 0.15, 10, 2),
  },
  cardActiveCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: RED_BAY_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  methodIconCircleActive: {
    backgroundColor: '#FEE2E2',
  },
  methodTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  methodTitleActive: {
    color: RED_BAY_COLORS.primary,
  },
  methodSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  terminalProcessingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  terminalProcessingText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#B91C1C',
  },
  qrDisplayBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    gap: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrVisualContainer: {
    width: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    ...makeShadow('#0F172A', { width: 0, height: 4 }, 0.06, 8, 2),
  },
  payNowHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  payNowBrandText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#7C1B57', // PayNow purple/maroon
    letterSpacing: 0.2,
  },
  sgqrTag: {
    backgroundColor: '#ED0712',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  sgqrTagText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  qrCodeFrame: {
    width: 96,
    height: 96,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrReticleTL: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 14,
    height: 14,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: '#0F172A',
  },
  qrReticleTR: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#0F172A',
  },
  qrReticleBL: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    width: 14,
    height: 14,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: '#0F172A',
  },
  qrReticleBR: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#0F172A',
  },
  qrGridPattern: {
    width: 66,
    height: 66,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCornerBlock: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 16,
    height: 16,
    backgroundColor: '#0F172A',
    borderRadius: 2,
  },
  qrCenterBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: RED_BAY_COLORS.primary,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  qrCenterBadgeText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
  },
  qrAmountBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 8,
  },
  qrInstructions: {
    flex: 1,
    gap: 6,
  },
  terminalLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  terminalLiveText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  qrInstructHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  qrInstructText: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 17,
  },
  supportedBanksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  bankPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bankPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
  },
  cardTerminalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  cardTerminalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginBottom: 4,
  },
  terminalHeading: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  terminalSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 420,
  },
  cardBrandsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cardBrandBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cardBrandText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
  },
  terminalStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  terminalStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#166534',
  },
  cashBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  cashSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  quickCashButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickCashBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  quickCashBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  quickCashBtnLow: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  quickCashBtnError: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  numpadSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  cashInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 44,
    gap: 6,
  },
  cashCurrencyPrefix: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  cashTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    paddingVertical: 0,
  },
  cashClearChip: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  cashClearChipText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#334155',
  },
  numpadGrid: {
    gap: 6,
  },
  numpadRow: {
    flexDirection: 'row',
    gap: 6,
  },
  numpadKey: {
    flex: 1,
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#CBD5E1',
  },
  numpadKeyAction: {
    backgroundColor: '#E2E8F0',
    borderBottomColor: '#94A3B8',
  },
  numpadKeyText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  quickCashText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  quickCashTextActive: {
    color: '#FFFFFF',
  },
  changeDueBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  changeDueBoxPositive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  changeDueBoxInsufficient: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  changeDueLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  changeDueSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  changeDueAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#059669',
  },
  breakdownBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  breakdownHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  breakdownPackageName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  breakdownVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1.5,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  grandTotalSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  grandTotalVal: {
    fontSize: 22,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  confirmPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RED_BAY_COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 46,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 4 }, 0.25, 8, 2),
  },
  confirmPayBtnDisabled: {
    opacity: 0.6,
  },
  confirmPayBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
