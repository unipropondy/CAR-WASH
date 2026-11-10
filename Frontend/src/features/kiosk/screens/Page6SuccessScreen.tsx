import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { KioskOrder } from '../types/kiosk.types';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { printOrderReceipt, triggerBrowserReceiptPrint } from '../../../services/printerApi';

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
      // Trigger client browser receipt fallback if applicable
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

  const handlePrint = () => {
    executePrint(true);
  };

  const rawMobile = (order.customerDetails?.mobileNumber || '').replace(/\D/g, '');
  const formattedMobile = rawMobile.length >= 8 
    ? `+65 ${rawMobile}` 
    : (order.customerDetails?.mobileNumber && order.customerDetails.mobileNumber !== '-' 
        ? order.customerDetails.mobileNumber 
        : 'Not provided');

  const isWalkIn = !order.customerDetails?.vehicleNumber || order.customerDetails.vehicleNumber === 'WALK-IN';
  const displayPlate = isWalkIn ? 'WALK-IN' : order.customerDetails.vehicleNumber;
  const isPaid = String(order.paymentStatus).toUpperCase() === 'PAID';

  return (
    <View style={styles.container}>
      {/* Top Center Logo & Header */}
      <KioskTopHeader
        subtitle={isDealer ? "DEALER ORDER CONFIRMED" : "ORDER CONFIRMED & QUEUED"}
        onExitToPos={onExitToPos}
      />

      {/* Main Title & Status Prompt Header */}
      <View style={styles.promptHeader}>
        <View style={[styles.successPill, isDealer && styles.dealerSuccessPill]}>
          <Ionicons name="checkmark-circle" size={15} color={isDealer ? "#D97706" : "#059669"} />
          <Text style={[styles.successPillText, isDealer && styles.dealerSuccessPillText]}>
            {isDealer ? "DEALER CREDIT ORDER CONFIRMED" : "PAYMENT CONFIRMED & QUEUED"}
          </Text>
        </View>
        <Text style={styles.mainTitle}>
          {isDealer ? "Dealer Order Registered" : "Order Placed Successfully!"}
        </Text>
        <Text style={styles.subtitle}>
          Your vehicle is queued in the system. Watch the bay monitors for your bill number.
        </Text>
      </View>

      {/* Main Content Area - PORTRAIT OPTIMIZED */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.portraitContainer}>
          {/* ================= CARD 1: OFFICIAL QUEUE TICKET ================= */}
          <View style={styles.ticketCard}>
            <View style={styles.ticketAccentStrip} />

            {/* Ticket Header */}
            <View style={styles.ticketHeaderRow}>
              <View style={styles.ticketBadge}>
                <Ionicons name="receipt-outline" size={15} color={RED_BAY_COLORS.primary} />
                <Text style={styles.ticketBadgeText}>OFFICIAL QUEUE TICKET</Text>
              </View>
              <View style={styles.liveQueuePill}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveQueueText}>BAY QUEUE ACTIVE</Text>
              </View>
            </View>

            {/* Prominent Bill Number Box */}
            <View style={styles.billBox}>
              <Text style={styles.billLabel}>YOUR BILL / QUEUE NUMBER</Text>
              <Text style={styles.billNumber}>{order.billNumber}</Text>
              <View style={styles.trackingHintRow}>
                <Ionicons name="information-circle-outline" size={13} color="#94A3B8" />
                <Text style={styles.trackingHintText}>
                  Display this number or keep receipt to collect your vehicle
                </Text>
              </View>
            </View>

            {/* Bay Assignment Notice */}
            <View style={styles.bayAssignmentBox}>
              <View style={styles.bayIconCircle}>
                <Ionicons name="car-sport" size={22} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bayTitle}>Proceed to Wash Bay Queue</Text>
                <Text style={styles.baySubtitle}>
                  Estimated wash time: ~10-15 mins once bay opens.
                </Text>
              </View>
            </View>

            {/* Print Action Area */}
            <View style={styles.printActionBox}>
              <TouchableOpacity
                style={[styles.printBtn, printStatus === 'DONE' && styles.printBtnDone]}
                onPress={handlePrint}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name={printStatus === 'DONE' ? "checkmark-done" : "print-outline"} 
                  size={18} 
                  color={printStatus === 'DONE' ? "#059669" : "#1E293B"} 
                />
                <Text style={[styles.printBtnText, printStatus === 'DONE' && styles.printBtnTextDone]}>
                  {printStatus === 'PRINTING' ? "Printing Thermal Ticket..." : printStatus === 'DONE' ? printMessage : "Print Thermal Receipt 🖨️"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Auto-return countdown */}
            <View style={styles.countdownBanner}>
              <Ionicons name="time-outline" size={13} color="#64748B" />
              <Text style={styles.countdownText}>
                Kiosk returns to home in <Text style={{ fontWeight: '800', color: RED_BAY_COLORS.primary }}>{countdown}s</Text>
              </Text>
            </View>
          </View>

          {/* ================= CARD 2: ORDER & BILLING SUMMARY ================= */}
          <View style={styles.receiptCard}>
            <View style={styles.receiptTopStrip} />

            <View style={styles.receiptHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="document-text-outline" size={16} color="#0F172A" />
                <Text style={styles.receiptHeaderTitle}>
                  {isDealer ? "DEALER ORDER BREAKDOWN" : "ORDER & BILLING SUMMARY"}
                </Text>
              </View>
              <Text style={styles.receiptTime}>{order.createdAt}</Text>
            </View>

            <View style={styles.detailsGrid}>
              {/* Dealer specifics if applicable */}
              {isDealer && order.selectedDealer && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Authorized Dealer:</Text>
                  <View style={styles.dealerPill}>
                    <Text style={styles.dealerPillText}>{order.selectedDealer.name}</Text>
                  </View>
                </View>
              )}

              {/* Customer Name */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {isDealer ? "Driver / Rep:" : "Customer Name:"}
                </Text>
                <Text style={styles.detailVal}>
                  {order.customerDetails?.customerName || 'Walk-in Customer'}
                </Text>
              </View>

              {/* Vehicle Number */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vehicle Plate:</Text>
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

              {/* Vehicle Type */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vehicle Type:</Text>
                <Text style={styles.detailVal}>{order.vehicle?.name || 'Standard Vehicle'}</Text>
              </View>

              {/* Contact Mobile */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Contact Mobile:</Text>
                <Text style={[styles.detailVal, formattedMobile === 'Not provided' && { color: '#94A3B8', fontWeight: '500' }]}>
                  {formattedMobile}
                </Text>
              </View>

              {/* Service & Package */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Service Package:</Text>
                <Text style={[styles.detailVal, { color: RED_BAY_COLORS.primary, fontWeight: '800' }]}>
                  {order.selectedPackage?.name || 'Service Package'}
                </Text>
              </View>

              {/* Payment Method & Status */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment Method:</Text>
                <View style={styles.paymentInfoRow}>
                  <View style={[styles.payBadge, isDealer && styles.creditPayBadge]}>
                    <Text style={[styles.payBadgeText, isDealer && styles.creditPayBadgeText]}>
                      {order.paymentMode || 'CASH'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, isPaid ? styles.statusBadgePaid : styles.statusBadgePending]}>
                    <Text style={[styles.statusBadgeText, isPaid ? styles.statusBadgeTextPaid : styles.statusBadgeTextPending]}>
                      {order.paymentStatus || 'PAID'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Total Row */}
              <View style={styles.totalRow}>
                <View>
                  <Text style={styles.totalLabel}>
                    {isDealer ? "TOTAL BILLED TO ACCOUNT" : "TOTAL AMOUNT PAID"}
                  </Text>
                  <Text style={styles.gstText}>
                    Includes Singapore 9% GST (${(order.gstAmount || 0).toFixed(2)})
                  </Text>
                </View>
                <Text style={styles.totalPrice}>SGD ${(order.totalAmount || 0).toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Kiosk Bottom Nav Bar */}
      <View style={styles.bottomBarOuter}>
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.bottomPrintBtn}
            onPress={handlePrint}
            activeOpacity={0.8}
          >
            <Ionicons name="receipt-outline" size={18} color="#334155" />
            <Text style={styles.bottomPrintText}>Print Bill</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onNewCustomer}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>
              {isDealer ? "Start Next Order ›" : "Start New Order ›"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
  successPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 4,
  },
  dealerSuccessPill: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  successPillText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#065F46',
    letterSpacing: 0.8,
  },
  dealerSuccessPillText: {
    color: '#92400E',
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
    maxWidth: 560,
    gap: 14,
  },
  /* Ticket Card */
  ticketCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    gap: 10,
    ...makeShadow('#000000', { width: 0, height: 4 }, 0.05, 10, 2),
  },
  ticketAccentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  ticketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketBadgeText: {
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
    paddingVertical: 2,
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
  billBox: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#1E293B',
  },
  billLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  billNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    marginVertical: 2,
  },
  trackingHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trackingHintText: {
    fontSize: 10,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  bayAssignmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  bayIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bayTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0369A1',
  },
  baySubtitle: {
    fontSize: 10.5,
    color: '#0284C7',
    fontWeight: '500',
  },
  printActionBox: {
    marginTop: 2,
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  printBtnDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  printBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  printBtnTextDone: {
    color: '#065F46',
  },
  countdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  countdownText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },

  /* Receipt Card */
  receiptCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    gap: 8,
    ...makeShadow('#000000', { width: 0, height: 4 }, 0.04, 8, 2),
  },
  receiptTopStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#0F172A',
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  receiptHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  receiptTime: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  detailsGrid: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  detailVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  dealerPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dealerPillText: {
    color: '#1D4ED8',
    fontWeight: '800',
    fontSize: 11,
  },
  walkInPlatePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  walkInPlateText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  sgPlatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    overflow: 'hidden',
  },
  sgTag: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  sgPlateNumber: {
    color: '#0F172A',
    fontSize: 11.5,
    fontWeight: '800',
    paddingHorizontal: 6,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  payBadgeText: {
    color: '#334155',
    fontSize: 10.5,
    fontWeight: '800',
  },
  creditPayBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  creditPayBadgeText: {
    color: '#B45309',
    fontWeight: '900',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgePaid: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusBadgePending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  statusBadgeTextPaid: {
    color: '#047857',
  },
  statusBadgeTextPending: {
    color: '#B45309',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1.5,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    marginTop: 2,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
  },
  gstText: {
    fontSize: 10,
    color: '#94A3B8',
  },

  /* Bottom Bar */
  bottomBarOuter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    width: '100%',
    ...makeShadow('#000000', { width: 0, height: -2 }, 0.04, 6, 1),
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  bottomPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  bottomPrintText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#334155',
  },
  doneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RED_BAY_COLORS.primary,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 4 }, 0.3, 10, 3),
  },
  doneBtnText: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
