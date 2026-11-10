import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal 
} from 'react-native';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { PosOrder, PaymentMethodType } from '../../../types/pos.types';

interface PaymentModalProps {
  visible: boolean;
  order: PosOrder | null;
  onClose: () => void;
  onConfirmPayment: (orderId: string, method: PaymentMethodType) => void;
  currentLanguage: 'EN' | 'ZH';
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  order,
  onClose,
  onConfirmPayment,
  currentLanguage,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('YEAHPAY_QR');
  const [cashTendered, setCashTendered] = useState<number>(50.00);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!order) return null;

  const total = order.totalAmount;
  const changeDue = Math.max(0, cashTendered - total);

  const handlePay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onConfirmPayment(order.id, selectedMethod);
      onClose();
    }, 1200);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.redPuck} />
              <View>
                <Text style={styles.headerTitle}>
                  {currentLanguage === 'EN' ? 'CHECKOUT & PAYMENT' : '收银结账与支付'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  Order: {order.orderNumber} • Plate: {order.vehiclePlate}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Payment Method Selector */}
          <View style={styles.body}>
            <View style={styles.methodsRow}>
              {/* YeahPay PayNow QR */}
              <TouchableOpacity
                style={[styles.methodCard, selectedMethod === 'YEAHPAY_QR' && styles.methodCardActive]}
                onPress={() => setSelectedMethod('YEAHPAY_QR')}
                activeOpacity={0.8}
              >
                <Text style={styles.methodIcon}>📱</Text>
                <Text style={[styles.methodTitle, selectedMethod === 'YEAHPAY_QR' && styles.methodTitleActive]}>
                  YeahPay QR
                </Text>
                <Text style={styles.methodSub}>PayNow / SGQR</Text>
              </TouchableOpacity>

              {/* YeahPay Card Terminal */}
              <TouchableOpacity
                style={[styles.methodCard, selectedMethod === 'YEAHPAY_CARD' && styles.methodCardActive]}
                onPress={() => setSelectedMethod('YEAHPAY_CARD')}
                activeOpacity={0.8}
              >
                <Text style={styles.methodIcon}>💳</Text>
                <Text style={[styles.methodTitle, selectedMethod === 'YEAHPAY_CARD' && styles.methodTitleActive]}>
                  YeahPay Card
                </Text>
                <Text style={styles.methodSub}>Contactless / Chip</Text>
              </TouchableOpacity>

              {/* Cash */}
              <TouchableOpacity
                style={[styles.methodCard, selectedMethod === 'CASH' && styles.methodCardActive]}
                onPress={() => setSelectedMethod('CASH')}
                activeOpacity={0.8}
              >
                <Text style={styles.methodIcon}>💵</Text>
                <Text style={[styles.methodTitle, selectedMethod === 'CASH' && styles.methodTitleActive]}>
                  Cash
                </Text>
                <Text style={styles.methodSub}>SGD Notes</Text>
              </TouchableOpacity>
            </View>

            {/* Method Specific Display */}
            {selectedMethod === 'YEAHPAY_QR' && (
              <View style={styles.qrDisplayBox}>
                <View style={styles.qrPlaceholder}>
                  {/* Visual simulated QR */}
                  <View style={styles.simulatedQr}>
                    <View style={styles.qrCornerTL} />
                    <View style={styles.qrCornerTR} />
                    <View style={styles.qrCornerBL} />
                    <Text style={styles.qrCenterLogo}>RED BAY</Text>
                  </View>
                </View>
                <View style={styles.qrInstructions}>
                  <Text style={styles.qrInstructHeading}>Dynamic Singapore PayNow QR</Text>
                  <Text style={styles.qrInstructText}>
                    Scan using DBS PayLah!, OCBC, UOB, or any Singapore PayNow banking app.
                  </Text>
                  <View style={styles.qrTimerBadge}>
                    <Text style={styles.qrTimerText}>⏱ Auto-verifying Gateway Status...</Text>
                  </View>
                </View>
              </View>
            )}

            {selectedMethod === 'YEAHPAY_CARD' && (
              <View style={styles.cardTerminalBox}>
                <Text style={styles.terminalIcon}>📟</Text>
                <Text style={styles.terminalHeading}>YeahPay Smart Terminal Ready</Text>
                <Text style={styles.terminalSub}>
                  Present terminal to customer for Visa, Mastercard, NETS FlashPay, or Apple Pay.
                </Text>
                <View style={styles.terminalStatusPill}>
                  <Text style={styles.terminalStatusText}>Terminal #01: CONNECTED</Text>
                </View>
              </View>
            )}

            {selectedMethod === 'CASH' && (
              <View style={styles.cashBox}>
                <Text style={styles.cashSectionTitle}>Quick Cash Tendered (SGD):</Text>
                <View style={styles.quickCashButtons}>
                  {[total, 20, 50, 100].map((amt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.quickCashBtn, cashTendered === amt && styles.quickCashBtnActive]}
                      onPress={() => setCashTendered(amt)}
                    >
                      <Text style={[styles.quickCashText, cashTendered === amt && styles.quickCashTextActive]}>
                        ${amt.toFixed(0)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.changeDueBox}>
                  <Text style={styles.changeDueLabel}>Change Due to Customer:</Text>
                  <Text style={styles.changeDueAmount}>$ {changeDue.toFixed(2)}</Text>
                </View>
              </View>
            )}

            {/* Price Breakdown */}
            <View style={styles.breakdownBox}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Subtotal</Text>
                <Text style={styles.breakdownVal}>$ {order.subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Singapore GST (9.0%)</Text>
                <Text style={styles.breakdownVal}>$ {order.gstAmount.toFixed(2)}</Text>
              </View>
              <View style={[styles.breakdownRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>TOTAL SGD</Text>
                <Text style={styles.grandTotalVal}>$ {order.totalAmount.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>
                {currentLanguage === 'EN' ? 'Back' : '返回'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.confirmPayBtn, isProcessing && styles.confirmPayBtnDisabled]} 
              onPress={handlePay}
              disabled={isProcessing}
            >
              <Text style={styles.confirmPayBtnText}>
                {isProcessing ? 'VERIFYING...' : `CONFIRM $ ${order.totalAmount.toFixed(2)}`}
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
    backgroundColor: 'rgba(8, 8, 8, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '90%',
    maxWidth: 620,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...makeShadow('#000000', { width: 0, height: 10 }, 0.3, 20, 10),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: RED_BAY_COLORS.secondary,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 3,
    borderBottomColor: RED_BAY_COLORS.primary,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  redPuck: {
    width: 5,
    height: 28,
    backgroundColor: RED_BAY_COLORS.primary,
    borderRadius: 2.5,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1F1F23',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '800',
  },
  body: {
    padding: 20,
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  methodCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  methodCardActive: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFF1F2',
  },
  methodIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  methodTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#080808',
  },
  methodTitleActive: {
    color: RED_BAY_COLORS.primary,
  },
  methodSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  qrDisplayBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  qrPlaceholder: {
    width: 110,
    height: 110,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  simulatedQr: {
    width: '100%',
    height: '100%',
    backgroundColor: '#080808',
    borderRadius: 4,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCornerTL: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: RED_BAY_COLORS.primary,
  },
  qrCornerTR: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: RED_BAY_COLORS.primary,
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 18,
    height: 18,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: RED_BAY_COLORS.primary,
  },
  qrCenterLogo: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    backgroundColor: '#080808',
    paddingHorizontal: 2,
  },
  qrInstructions: {
    flex: 1,
  },
  qrInstructHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#080808',
    marginBottom: 4,
  },
  qrInstructText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  qrTimerBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  qrTimerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  cardTerminalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  terminalIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  terminalHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#080808',
  },
  terminalSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 320,
  },
  terminalStatusPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  terminalStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  cashBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  cashSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 10,
  },
  quickCashButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  quickCashBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  quickCashBtnActive: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  quickCashText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#080808',
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  changeDueLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  changeDueAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#059669',
  },
  breakdownBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#080808',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    paddingTop: 8,
    marginTop: 2,
  },
  grandTotalLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#080808',
  },
  grandTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  confirmPayBtn: {
    backgroundColor: RED_BAY_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmPayBtnDisabled: {
    opacity: 0.6,
  },
  confirmPayBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});

