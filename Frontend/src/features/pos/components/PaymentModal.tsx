import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal,
  ActivityIndicator,
  Alert 
} from 'react-native';
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
  const [cashTendered, setCashTendered] = useState<number>(50.00);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusPrompt, setStatusPrompt] = useState<string>('');

  if (!order) return null;

  const total = order.totalAmount;
  const changeDue = Math.max(0, cashTendered - total);
  const numericOrderId = order.orderId || parseInt(order.id, 10);

  const handlePay = async () => {
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
            {!isProcessing && (
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Payment Method Selector */}
          <View style={styles.body}>
            <View style={styles.methodsRow}>
              {/* YeahPay PayNow QR */}
              <TouchableOpacity
                style={[styles.methodCard, selectedMethod === 'YEAHPAY_QR' && styles.methodCardActive]}
                onPress={() => !isProcessing && setSelectedMethod('YEAHPAY_QR')}
                activeOpacity={0.8}
                disabled={isProcessing}
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
                onPress={() => !isProcessing && setSelectedMethod('YEAHPAY_CARD')}
                activeOpacity={0.8}
                disabled={isProcessing}
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
                onPress={() => !isProcessing && setSelectedMethod('CASH')}
                activeOpacity={0.8}
                disabled={isProcessing}
              >
                <Text style={styles.methodIcon}>💵</Text>
                <Text style={[styles.methodTitle, selectedMethod === 'CASH' && styles.methodTitleActive]}>
                  Cash
                </Text>
                <Text style={styles.methodSub}>Cash Notes</Text>
              </TouchableOpacity>
            </View>

            {/* In-Flight Terminal Notification */}
            {isProcessing && (
              <View style={styles.terminalProcessingBanner}>
                <ActivityIndicator size="small" color="#DC2626" style={{ marginRight: 10 }} />
                <Text style={styles.terminalProcessingText}>{statusPrompt}</Text>
              </View>
            )}

            {/* Method Specific Display */}
            {selectedMethod === 'YEAHPAY_QR' && (
              <View style={styles.qrDisplayBox}>
                <View style={styles.qrPlaceholder}>
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
                    Dispatches $ {order.totalAmount.toFixed(2)} prompt directly to YeahPay Smart Terminal.
                  </Text>
                  <View style={styles.qrTimerBadge}>
                    <Text style={styles.qrTimerText}>⏱ Terminal Connection Ready</Text>
                  </View>
                </View>
              </View>
            )}

            {selectedMethod === 'YEAHPAY_CARD' && (
              <View style={styles.cardTerminalBox}>
                <Text style={styles.terminalIcon}>📟</Text>
                <Text style={styles.terminalHeading}>YeahPay Smart Terminal Ready</Text>
                <Text style={styles.terminalSub}>
                  Present terminal to customer for Visa, Mastercard, NETS FlashPay, or Mobile NFC Pay.
                </Text>
                <View style={styles.terminalStatusPill}>
                  <Text style={styles.terminalStatusText}>Terminal: ONLINE & READY</Text>
                </View>
              </View>
            )}

            {selectedMethod === 'CASH' && (
              <View style={styles.cashBox}>
                <Text style={styles.cashSectionTitle}>Quick Cash Tendered:</Text>
                <View style={styles.quickCashButtons}>
                  {[total, 20, 50, 100].map((amt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.quickCashBtn, cashTendered === amt && styles.quickCashBtnActive]}
                      onPress={() => setCashTendered(amt)}
                      disabled={isProcessing}
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
                <Text style={styles.breakdownLabel}>Base Amount</Text>
                <Text style={styles.breakdownVal}>$ {(order.subtotal || order.totalAmount).toFixed(2)}</Text>
              </View>
              {(order.gstRate > 0 || order.gstAmount > 0) && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>GST ({order.gstRate ?? 0}%)</Text>
                  <Text style={styles.breakdownVal}>$ {order.gstAmount.toFixed(2)}</Text>
                </View>
              )}
              <View style={[styles.breakdownRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>TOTAL</Text>
                <Text style={styles.grandTotalVal}>$ {order.totalAmount.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={onClose}
              disabled={isProcessing}
            >
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
                {isProcessing ? 'COMMUNICATING...' : `CONFIRM $ ${order.totalAmount.toFixed(2)}`}
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
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    padding: 20,
    gap: 16,
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  methodCardActive: {
    backgroundColor: '#FEF2F2',
    borderColor: RED_BAY_COLORS.primary,
  },
  methodIcon: {
    fontSize: 26,
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
    textAlign: 'center',
  },
  terminalProcessingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  terminalProcessingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
  },
  qrDisplayBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    gap: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrPlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  simulatedQr: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderColor: '#080808',
    borderRadius: 4,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCornerTL: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 16,
    height: 16,
    backgroundColor: '#080808',
  },
  qrCornerTR: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    backgroundColor: '#080808',
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 16,
    height: 16,
    backgroundColor: '#080808',
  },
  qrCenterLogo: {
    fontSize: 8,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 2,
  },
  qrInstructions: {
    flex: 1,
    gap: 6,
  },
  qrInstructHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#080808',
  },
  qrInstructText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  qrTimerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  qrTimerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  cardTerminalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  terminalIcon: {
    fontSize: 32,
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
    maxWidth: 360,
  },
  terminalStatusPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  terminalStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  cashBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  cashSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  quickCashButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickCashBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  quickCashBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
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
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  changeDueLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
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
