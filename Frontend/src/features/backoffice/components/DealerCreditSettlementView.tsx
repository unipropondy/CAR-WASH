import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchAllDealers,
  fetchDealerOutstandingBills,
  settleDealerCreditPayment,
  fetchDealerPaymentHistory,
  fetchDealerPaymodes,
  PayModeOption,
  DealerRecord,
  DealerCreditBillItem,
  DealerPaymentRecord,
  SettleDealerCreditResult,
} from '../../../services/dealerApi';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';

type SubView = 'SETTLE' | 'HISTORY';

export const DealerCreditSettlementView: React.FC = () => {
  const { width } = useWindowDimensions();
  const isStacked = width < 980;

  const [dealers, setDealers] = useState<DealerRecord[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<number | null>(null);
  const [currentView, setCurrentView] = useState<SubView>('SETTLE');

  // Settlement Bills State
  const [loadingBills, setLoadingBills] = useState<boolean>(false);
  const [bills, setBills] = useState<DealerCreditBillItem[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);

  // Payment Form & Paymodes State (loaded from dbo.Paymode)
  const [paymodes, setPaymodes] = useState<PayModeOption[]>([]);
  const [loadingPaymodes, setLoadingPaymodes] = useState<boolean>(false);
  const [paymentAmountStr, setPaymentAmountStr] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Settlement Success Receipt Modal State
  const [settlementSuccess, setSettlementSuccess] = useState<SettleDealerCreditResult | null>(null);

  // Payment History State
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [paymentHistory, setPaymentHistory] = useState<DealerPaymentRecord[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<DealerPaymentRecord | null>(null);

  const selectedDealer = useMemo(() => {
    return dealers.find((d) => d.dealerId === selectedDealerId) || null;
  }, [dealers, selectedDealerId]);

  // Load Paymodes from dbo.Paymode table
  const loadPaymodes = async () => {
    try {
      setLoadingPaymodes(true);
      const modes = await fetchDealerPaymodes();
      const activeModes = (modes || []).filter((m) => m.active !== false);
      if (activeModes.length > 0) {
        setPaymodes(activeModes);
        setPaymentMode((prev) => {
          const exists = activeModes.some((m) => m.payMode.toUpperCase() === prev.toUpperCase());
          return exists ? prev : activeModes[0].payMode.toUpperCase();
        });
      }
    } catch (err: any) {
      console.warn('[DealerCreditSettlementView] loadPaymodes error:', err.message);
    } finally {
      setLoadingPaymodes(false);
    }
  };

  // Load Dealers List
  const loadDealers = async () => {
    try {
      const data = await fetchAllDealers(true);
      setDealers(data);
      if (data.length > 0 && selectedDealerId === null) {
        setSelectedDealerId(data[0].dealerId);
      }
    } catch (err: any) {
      console.warn('[DealerCreditSettlementView] loadDealers error:', err.message);
    }
  };

  useEffect(() => {
    loadDealers();
    loadPaymodes();
  }, []);

  // Load Outstanding Bills for Selected Dealer
  const loadBills = async (dealerId: number) => {
    try {
      setLoadingBills(true);
      const res = await fetchDealerOutstandingBills(dealerId);
      const fetchedBills = res.data || [];
      setBills(fetchedBills);

      // Auto-select all bills by default
      const allIds = fetchedBills.map((b) => b.orderId);
      setSelectedOrderIds(allIds);

      // Default payment amount to total outstanding of selected bills
      const totalOut = fetchedBills.reduce((acc, b) => acc + b.outstandingAmount, 0);
      setPaymentAmountStr(totalOut > 0 ? totalOut.toFixed(2) : '');
    } catch (err: any) {
      console.warn('[DealerCreditSettlementView] loadBills error:', err.message);
    } finally {
      setLoadingBills(false);
    }
  };

  // Load Payment History
  const loadPaymentHistoryData = async (dealerId?: number) => {
    try {
      setLoadingHistory(true);
      const data = await fetchDealerPaymentHistory(dealerId);
      setPaymentHistory(data);
    } catch (err: any) {
      console.warn('[DealerCreditSettlementView] loadPaymentHistory error:', err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedDealerId) {
      if (currentView === 'SETTLE') {
        loadBills(selectedDealerId);
      } else {
        loadPaymentHistoryData(selectedDealerId);
      }
    }
  }, [selectedDealerId, currentView]);

  // Toggle Single Bill Selection
  const toggleSelectBill = (orderId: number) => {
    setSelectedOrderIds((prev) => {
      const exists = prev.includes(orderId);
      const next = exists ? prev.filter((id) => id !== orderId) : [...prev, orderId];

      // Update default payment amount to match new selected total
      const selBills = bills.filter((b) => next.includes(b.orderId));
      const totalOut = selBills.reduce((sum, b) => sum + b.outstandingAmount, 0);
      setPaymentAmountStr(totalOut > 0 ? totalOut.toFixed(2) : '');
      return next;
    });
  };

  // Toggle Select All Bills
  const toggleSelectAll = () => {
    if (selectedOrderIds.length === bills.length) {
      setSelectedOrderIds([]);
      setPaymentAmountStr('');
    } else {
      const allIds = bills.map((b) => b.orderId);
      setSelectedOrderIds(allIds);
      const totalOut = bills.reduce((sum, b) => sum + b.outstandingAmount, 0);
      setPaymentAmountStr(totalOut.toFixed(2));
    }
  };

  // Calculate live totals
  const selectedBills = useMemo(() => {
    return bills.filter((b) => selectedOrderIds.includes(b.orderId));
  }, [bills, selectedOrderIds]);

  const selectedTotalOutstanding = useMemo(() => {
    return selectedBills.reduce((sum, b) => sum + b.outstandingAmount, 0);
  }, [selectedBills]);

  // Map paymode string to Ionicons icon
  const getPaymodeIcon = (mode: string): keyof typeof Ionicons.glyphMap => {
    const m = (mode || '').toUpperCase();
    if (m.includes('CASH')) return 'cash-outline';
    if (m.includes('CARD') || m.includes('CREDIT') || m.includes('DEBIT') || m.includes('VISA') || m.includes('MASTER')) return 'card-outline';
    if (m.includes('PAYNOW') || m.includes('QR') || m.includes('PAY') || m.includes('GRAB')) return 'qr-code-outline';
    if (m.includes('BANK') || m.includes('TRANSFER') || m.includes('WIRE') || m.includes('GIRO')) return 'business-outline';
    if (m.includes('CHEQUE') || m.includes('CHECK')) return 'receipt-outline';
    if (m.includes('NETS')) return 'phone-portrait-outline';
    return 'wallet-outline';
  };

  // Dynamic payment modes list from dbo.Paymode (with fallback)
  const availablePaymodes = useMemo(() => {
    if (paymodes && paymodes.length > 0) {
      return paymodes.map((pm) => ({
        id: pm.payMode.toUpperCase(),
        label: pm.description || pm.payMode,
        icon: getPaymodeIcon(pm.payMode),
      }));
    }
    return [
      { id: 'CASH', label: 'Cash', icon: 'cash-outline' as const },
      { id: 'CARD', label: 'Credit Card', icon: 'card-outline' as const },
      { id: 'PAYNOW', label: 'PayNow', icon: 'qr-code-outline' as const },
      { id: 'BANK_TRANSFER', label: 'Bank Transfer', icon: 'business-outline' as const },
      { id: 'CHEQUE', label: 'Cheque', icon: 'receipt-outline' as const },
    ];
  }, [paymodes]);

  // Real-time settlement distribution simulation
  const allocationSimulation = useMemo(() => {
    const payAmt = parseFloat(paymentAmountStr) || 0;
    let rem = payAmt;
    return selectedBills.map((b) => {
      const alloc = Math.min(b.outstandingAmount, Math.max(0, rem));
      rem = Math.max(0, rem - alloc);
      const newOut = Math.max(0, b.outstandingAmount - alloc);
      const newStatus = newOut <= 0.001 ? 'PAID / CLOSED' : 'PARTIALLY PAID';
      return {
        orderId: b.orderId,
        billNumber: b.billNumber,
        prevOutstanding: b.outstandingAmount,
        allocated: alloc,
        newOutstanding: newOut,
        newStatus,
      };
    });
  }, [selectedBills, paymentAmountStr]);

  // Execute Settlement
  const handleProcessSettlement = async () => {
    if (!selectedDealerId) {
      Alert.alert('Validation Error', 'Please select a dealer.');
      return;
    }
    if (selectedOrderIds.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one outstanding bill to settle.');
      return;
    }
    const payAmt = parseFloat(paymentAmountStr);
    if (!payAmt || isNaN(payAmt) || payAmt <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid positive payment amount.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await settleDealerCreditPayment({
        dealerId: selectedDealerId,
        paymentAmount: payAmt,
        paymentMode,
        referenceNo: referenceNo.trim() || undefined,
        remarks: remarks.trim() || undefined,
        selectedBillIds: selectedOrderIds,
        processedBy: 'BACKOFFICE',
      });

      setSettlementSuccess(res.data);
      // Reload bills after settlement
      loadBills(selectedDealerId);
      setReferenceNo('');
      setRemarks('');
    } catch (err: any) {
      Alert.alert('Settlement Error', err.message || 'Failed to process payment settlement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (dtStr?: string) => {
    if (!dtStr) return '-';
    try {
      const d = new Date(dtStr);
      return d.toLocaleDateString('en-SG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dtStr;
    }
  };

  return (
    <View style={styles.container}>
      {/* ── TOP DEALER SELECTOR ── */}
      <View style={styles.topSelectorCard}>
        <View style={styles.topSelectorHeader}>
          <Ionicons name="business" size={17} color="#D97706" />
          <Text style={styles.topSelectorLabel}>SELECT DEALER FOR SETTLEMENT</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dealerListScroll}>
          {dealers.map((d) => {
            const isSelected = selectedDealerId === d.dealerId;
            return (
              <TouchableOpacity
                key={d.dealerId}
                style={[styles.dealerOptionCard, isSelected && styles.dealerOptionCardSelected]}
                onPress={() => setSelectedDealerId(d.dealerId)}
                activeOpacity={0.85}
              >
                <View style={styles.dealerOptionTop}>
                  <Text style={[styles.dealerOptionName, isSelected && styles.dealerOptionNameSelected]}>
                    {d.dealerName}
                  </Text>
                  <View style={styles.codeTag}>
                    <Text style={styles.codeTagText}>{d.uniqueCode}</Text>
                  </View>
                </View>
                <Text style={styles.dealerOptionTerms}>{d.billingCycle || '30-Day Commercial Credit'}</Text>
                {d.contactPerson && (
                  <Text style={styles.dealerOptionContact}>Rep: {d.contactPerson} ({d.contactNumber || '-'})</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── NAVIGATION TABS: Settle vs Payment History ── */}
      <View style={styles.subTabsBar}>
        <TouchableOpacity
          style={[styles.subTabBtn, currentView === 'SETTLE' && styles.subTabBtnActive]}
          onPress={() => setCurrentView('SETTLE')}
        >
          <Ionicons name="card-outline" size={16} color={currentView === 'SETTLE' ? '#FFFFFF' : '#94A3B8'} />
          <Text style={[styles.subTabBtnText, currentView === 'SETTLE' && styles.subTabBtnTextActive]}>
            Settle Outstanding Bills ({bills.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, currentView === 'HISTORY' && styles.subTabBtnActive]}
          onPress={() => setCurrentView('HISTORY')}
        >
          <Ionicons name="receipt-outline" size={16} color={currentView === 'HISTORY' ? '#FFFFFF' : '#94A3B8'} />
          <Text style={[styles.subTabBtnText, currentView === 'HISTORY' && styles.subTabBtnTextActive]}>
            Payment Receipts & History
          </Text>
        </TouchableOpacity>
      </View>

      {/* ══════════════════════════════════════════════════════════
          VIEW 1: SETTLE OUTSTANDING BILLS
         ══════════════════════════════════════════════════════════ */}
      {currentView === 'SETTLE' && (
        <View style={[styles.mainSplitLayout, isStacked && styles.mainSplitLayoutStacked]}>
          {/* LEFT: UNPAID BILLS TABLE */}
          <View style={[styles.leftBillsSection, isStacked && styles.leftBillsSectionStacked]}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>
                  Unpaid & Partially Paid Bills ({bills.length})
                </Text>
                <Text style={styles.sectionSub}>
                  Select one or multiple bills to apply payment.
                </Text>
              </View>

              {bills.length > 0 && (
                <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
                  <Ionicons
                    name={selectedOrderIds.length === bills.length ? 'checkbox' : 'square-outline'}
                    size={16}
                    color={RED_BAY_COLORS.primary}
                  />
                  <Text style={styles.selectAllBtnText}>
                    {selectedOrderIds.length === bills.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {loadingBills ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
                <Text style={styles.loadingText}>Fetching outstanding bills...</Text>
              </View>
            ) : bills.length === 0 ? (
              <View style={styles.centerContainer}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#22C55E" />
                <Text style={styles.allClearTitle}>All Clear! No Outstanding Bills</Text>
                <Text style={styles.allClearSub}>
                  {selectedDealer?.dealerName} has no pending or partially paid invoices.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.billsListScroll} showsVerticalScrollIndicator={true}>
                {bills.map((item) => {
                  const isChecked = selectedOrderIds.includes(item.orderId);
                  const isPartial = item.creditStatus === 'PARTIALLY_PAID';

                  return (
                    <TouchableOpacity
                      key={item.orderId}
                      style={[styles.billItemCard, isChecked && styles.billItemCardSelected]}
                      onPress={() => toggleSelectBill(item.orderId)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.billItemCheckRow}>
                        <View style={[styles.checkboxBox, isChecked && styles.checkboxBoxSelected]}>
                          {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.billItemTopLine}>
                            <Text style={styles.billItemNumber}>{item.billNumber}</Text>
                            <View style={[styles.miniStatusTag, isPartial ? styles.partialTag : styles.pendingTag]}>
                              <Text style={[styles.miniStatusTagText, isPartial ? styles.partialTagText : styles.pendingTagText]}>
                                {isPartial ? 'PARTIALLY PAID' : 'PENDING'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.billItemDate}>{formatDateTime(item.orderDateTime)}</Text>
                        </View>
                      </View>

                      <View style={styles.billItemDetailsGrid}>
                        <View style={styles.billDetailCol}>
                          <Text style={styles.billDetailLabel}>Vehicle</Text>
                          <View style={styles.plateMini}>
                            <Text style={styles.plateMiniText}>{item.vehicleNumber}</Text>
                          </View>
                        </View>
                        <View style={styles.billDetailCol}>
                          <Text style={styles.billDetailLabel}>Package</Text>
                          <Text style={styles.billDetailVal} numberOfLines={1}>{item.selectedPackage}</Text>
                        </View>
                        <View style={[styles.billDetailCol, { alignItems: 'flex-end' }]}>
                          <Text style={styles.billDetailLabel}>Total / Paid</Text>
                          <Text style={styles.billDetailVal}>${item.totalAmount.toFixed(2)} / <Text style={{ color: '#22C55E' }}>${item.paidAmount.toFixed(2)}</Text></Text>
                        </View>
                        <View style={[styles.billDetailCol, { alignItems: 'flex-end' }]}>
                          <Text style={styles.billDetailLabel}>Outstanding</Text>
                          <Text style={styles.billDetailValBold}>${item.outstandingAmount.toFixed(2)}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* RIGHT: SETTLEMENT PAYMENT FORM */}
          <View style={[styles.rightPaymentSection, isStacked && styles.rightPaymentSectionStacked]}>
            <View style={styles.paymentCard}>
              {/* Card Header */}
              <View style={styles.paymentCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="wallet-outline" size={18} color="#22C55E" />
                  <Text style={styles.paymentCardTitle}>Payment Settlement Entry</Text>
                </View>
                {loadingPaymodes && (
                  <ActivityIndicator size="small" color="#22C55E" />
                )}
              </View>

              {/* Scrollable Form Body */}
              <ScrollView
                style={styles.paymentCardBodyScroll}
                contentContainerStyle={styles.paymentCardBodyContent}
                showsVerticalScrollIndicator={true}
              >
                {/* Summary of Selection */}
                <View style={styles.paymentSummaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Selected Bills:</Text>
                    <Text style={styles.summaryVal}>{selectedOrderIds.length} of {bills.length}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Selected Outstanding:</Text>
                    <Text style={styles.summaryValBold}>${selectedTotalOutstanding.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Payment Amount Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabelRow}>
                    <Text style={styles.inputLabel}>
                      Payment Amount ($) <Text style={{ color: RED_BAY_COLORS.primary }}>*</Text>
                    </Text>
                    {selectedTotalOutstanding > 0 && (
                      <TouchableOpacity
                        style={styles.payFullChip}
                        onPress={() => setPaymentAmountStr(selectedTotalOutstanding.toFixed(2))}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="sparkles" size={11} color="#22C55E" />
                        <Text style={styles.payFullChipText}>Pay Full (${selectedTotalOutstanding.toFixed(2)})</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.amountInputBox}>
                    <Text style={styles.currencySymbol}>$</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                      placeholderTextColor="#64748B"
                      value={paymentAmountStr}
                      onChangeText={setPaymentAmountStr}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Payment Mode Selector */}
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabelRow}>
                    <Text style={styles.inputLabel}>Select Payment Mode</Text>
                  </View>
                  <View style={styles.modesRow}>
                    {availablePaymodes.map((m) => {
                      const isM = paymentMode === m.id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.modeBtn, isM && styles.modeBtnActive]}
                          onPress={() => setPaymentMode(m.id)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={m.icon as any}
                            size={14}
                            color={isM ? '#22C55E' : '#94A3B8'}
                          />
                          <Text style={[styles.modeBtnText, isM && styles.modeBtnTextActive]}>
                            {m.label}
                          </Text>
                          {isM && (
                            <Ionicons name="checkmark-circle" size={13} color="#22C55E" style={{ marginLeft: 2 }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Reference & Remarks */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Reference / Transaction No. (Optional)</Text>
                  <TextInput
                    style={styles.textInputBox}
                    placeholder="e.g. UEN PayNow Ref / Auth Code / Cheque #"
                    placeholderTextColor="#64748B"
                    value={referenceNo}
                    onChangeText={setReferenceNo}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Notes / Remarks (Optional)</Text>
                  <TextInput
                    style={styles.textInputBox}
                    placeholder="e.g. November monthly commercial settlement"
                    placeholderTextColor="#64748B"
                    value={remarks}
                    onChangeText={setRemarks}
                  />
                </View>

                {/* Live Allocation Preview */}
                {allocationSimulation.length > 0 && parseFloat(paymentAmountStr) > 0 && (
                  <View style={styles.allocationBox}>
                    <Text style={styles.allocationTitle}>SETTLEMENT ALLOCATION PREVIEW</Text>
                    <View style={styles.allocationListContainer}>
                      {allocationSimulation.map((sim, sIdx) => (
                        <View key={sIdx} style={styles.simRow}>
                          <Text style={styles.simBill}>{sim.billNumber}</Text>
                          <Text style={styles.simAlloc}>-${sim.allocated.toFixed(2)}</Text>
                          <Text style={[styles.simStatus, sim.newStatus.includes('CLOSED') ? { color: '#22C55E' } : { color: '#38BDF8' }]}>
                            {sim.newStatus} (Rem: ${sim.newOutstanding.toFixed(2)})
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Pinned Bottom Submit Button */}
              <View style={styles.paymentCardFooter}>
                <TouchableOpacity
                  style={[
                    styles.settleSubmitBtn,
                    (selectedOrderIds.length === 0 || !parseFloat(paymentAmountStr) || isSubmitting) && styles.settleSubmitBtnDisabled,
                  ]}
                  onPress={handleProcessSettlement}
                  disabled={selectedOrderIds.length === 0 || !parseFloat(paymentAmountStr) || isSubmitting}
                  activeOpacity={0.88}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                      <Text style={styles.settleSubmitBtnText}>
                        Process Settlement (${(parseFloat(paymentAmountStr) || 0).toFixed(2)})
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════
          VIEW 2: PAYMENT HISTORY & SETTLEMENT RECEIPTS
         ══════════════════════════════════════════════════════════ */}
      {currentView === 'HISTORY' && (
        <View style={styles.historyTableCard}>
          <View style={styles.historyHeader}>
            <View>
              <Text style={styles.sectionTitle}>Payment Settlement Receipts</Text>
              <Text style={styles.sectionSub}>Audit trail of dealer collections and bill settlements.</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => selectedDealerId && loadPaymentHistoryData(selectedDealerId)}
            >
              <Ionicons name="refresh" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {loadingHistory ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
              <Text style={styles.loadingText}>Loading payment history...</Text>
            </View>
          ) : paymentHistory.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="receipt-outline" size={44} color="#64748B" />
              <Text style={styles.emptyTitle}>No Payment Receipts Found</Text>
              <Text style={styles.emptySub}>No settlement receipts recorded for this dealer yet.</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 520 }}>
              {paymentHistory.map((rec) => (
                <View key={rec.paymentId} style={styles.receiptCard}>
                  <View style={styles.receiptTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={styles.receiptBadge}>
                        <Ionicons name="document-text" size={14} color="#38BDF8" />
                        <Text style={styles.receiptBadgeText}>{rec.receiptNo}</Text>
                      </View>
                      <Text style={styles.receiptModeTag}>{rec.paymentMode}</Text>
                    </View>
                    <Text style={styles.receiptAmount}>+${rec.paymentAmount.toFixed(2)}</Text>
                  </View>

                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaText}>Date: {formatDateTime(rec.paymentDate)}</Text>
                    <Text style={styles.receiptMetaText}>Processed By: {rec.processedBy}</Text>
                    {rec.referenceNo && rec.referenceNo !== '-' && (
                      <Text style={styles.receiptMetaText}>Ref: {rec.referenceNo}</Text>
                    )}
                  </View>

                  {/* Settled Bills Breakdown */}
                  {rec.settledBills && rec.settledBills.length > 0 && (
                    <View style={styles.receiptBillsBox}>
                      <Text style={styles.receiptBillsTitle}>APPLIED SETTLEMENT BREAKDOWN:</Text>
                      {rec.settledBills.map((b, bIdx) => (
                        <View key={bIdx} style={styles.receiptBillRow}>
                          <Text style={styles.receiptBillNo}>{b.billNumber}</Text>
                          <Text style={styles.receiptBillAlloc}>Allocated: <Text style={{ color: '#22C55E', fontWeight: '800' }}>${b.allocatedAmount.toFixed(2)}</Text></Text>
                          <Text style={styles.receiptBillStatus}>Remaining: ${b.newOutstanding.toFixed(2)} ({b.billStatusAfterPayment})</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* ── SETTLEMENT SUCCESS RECEIPT MODAL ── */}
      {settlementSuccess && (
        <Modal
          visible={Boolean(settlementSuccess)}
          transparent
          animationType="fade"
          onRequestClose={() => setSettlementSuccess(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.successModalHeader}>
                <View style={styles.successModalIcon}>
                  <Ionicons name="checkmark-done" size={28} color="#22C55E" />
                </View>
                <Text style={styles.successModalTitle}>Payment Settlement Successful</Text>
                <Text style={styles.successModalSub}>Receipt No: {settlementSuccess.receiptNo}</Text>
              </View>

              <ScrollView style={styles.successModalBody}>
                <View style={styles.successSummaryBox}>
                  <View style={styles.successRow}>
                    <Text style={styles.successLabel}>Dealer Account</Text>
                    <Text style={styles.successValBold}>{settlementSuccess.dealerName}</Text>
                  </View>
                  <View style={styles.successRow}>
                    <Text style={styles.successLabel}>Settled Amount</Text>
                    <Text style={[styles.successValBold, { color: '#22C55E', fontSize: 17 }]}>
                      ${settlementSuccess.paymentAmount.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.successRow}>
                    <Text style={styles.successLabel}>Payment Mode</Text>
                    <Text style={styles.successValBold}>{settlementSuccess.paymentMode}</Text>
                  </View>
                  <View style={styles.successRow}>
                    <Text style={styles.successLabel}>Date & Time</Text>
                    <Text style={styles.successVal}>{formatDateTime(settlementSuccess.paymentDate)}</Text>
                  </View>
                  {settlementSuccess.referenceNo && (
                    <View style={styles.successRow}>
                      <Text style={styles.successLabel}>Reference</Text>
                      <Text style={styles.successVal}>{settlementSuccess.referenceNo}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.successBillsHeading}>BILLS SETTLED IN THIS TRANSACTION:</Text>
                {settlementSuccess.settledBills.map((b, bIdx) => (
                  <View key={bIdx} style={styles.successBillItem}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.successBillNo}>{b.orderNo}</Text>
                      <Text style={styles.successBillAlloc}>+${b.allocatedAmount.toFixed(2)} applied</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={styles.successBillOut}>Prev: ${b.previousOutstanding.toFixed(2)} → New: ${b.newOutstanding.toFixed(2)}</Text>
                      <View style={[styles.miniStatusTag, b.isClosed ? styles.paidTag : styles.partialTag]}>
                        <Text style={[styles.miniStatusTagText, b.isClosed ? styles.paidTagText : styles.partialTagText]}>
                          {b.isClosed ? 'PAID / CLOSED' : 'PARTIALLY PAID'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.successModalFooter}>
                <TouchableOpacity
                  style={styles.successDoneBtn}
                  onPress={() => setSettlementSuccess(null)}
                >
                  <Text style={styles.successDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    backgroundColor: '#0A0A0A',
  },
  topSelectorCard: {
    backgroundColor: '#161616',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    marginBottom: 10,
  },
  topSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  topSelectorLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  dealerListScroll: {
    flexDirection: 'row',
    gap: 10,
  },
  dealerOptionCard: {
    width: 210,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
  },
  dealerOptionCardSelected: {
    backgroundColor: 'rgba(255,26,26,0.12)',
    borderColor: RED_BAY_COLORS.primary,
  },
  dealerOptionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  dealerOptionName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
  },
  dealerOptionNameSelected: {
    color: '#FFFFFF',
  },
  codeTag: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  codeTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#38BDF8',
  },
  dealerOptionTerms: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  dealerOptionContact: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  subTabsBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  subTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  subTabBtnActive: {
    backgroundColor: 'rgba(255,26,26,0.18)',
    borderColor: RED_BAY_COLORS.primary,
  },
  subTabBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  subTabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  mainSplitLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 0,
  },
  mainSplitLayoutStacked: {
    flexDirection: 'column',
    overflow: 'visible',
  },
  leftBillsSection: {
    flex: 1.15,
    backgroundColor: '#161616',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  leftBillsSectionStacked: {
    flex: undefined,
    height: 380,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  selectAllBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  billsListScroll: {
    flex: 1,
  },
  billItemCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 10,
    marginBottom: 8,
  },
  billItemCardSelected: {
    borderColor: 'rgba(56,189,248,0.5)',
    backgroundColor: 'rgba(56,189,248,0.06)',
  },
  billItemCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxSelected: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  billItemTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billItemNumber: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  billItemDate: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  miniStatusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniStatusTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  pendingTag: {
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  pendingTagText: {
    color: '#F59E0B',
  },
  partialTag: {
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  partialTagText: {
    color: '#3B82F6',
  },
  paidTag: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  paidTagText: {
    color: '#22C55E',
  },
  billItemDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  billDetailCol: {
    flex: 1,
  },
  billDetailLabel: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  billDetailVal: {
    fontSize: 11,
    color: '#E2E8F0',
    marginTop: 2,
  },
  billDetailValBold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
    marginTop: 2,
  },
  plateMini: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  plateMiniText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  rightPaymentSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  rightPaymentSectionStacked: {
    flex: undefined,
    minHeight: 520,
  },
  paymentCard: {
    flex: 1,
    backgroundColor: '#161616',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#161616',
  },
  paymentCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  paymentCardBodyScroll: {
    flex: 1,
  },
  paymentCardBodyContent: {
    padding: 12,
    gap: 10,
  },
  paymentSummaryBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  summaryVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryValBold: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#F59E0B',
  },
  inputGroup: {
    marginBottom: 2,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  payFullChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  payFullChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#22C55E',
  },
  paymodeDbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56,189,248,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
  },
  paymodeDbBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  amountInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 7,
    paddingHorizontal: 10,
    height: 40,
  },
  currencySymbol: {
    fontSize: 15,
    fontWeight: '800',
    color: '#22C55E',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modeBtnActive: {
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderColor: '#22C55E',
  },
  modeBtnText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: '#22C55E',
    fontWeight: '800',
  },
  textInputBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 7,
    paddingHorizontal: 9,
    height: 36,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  allocationBox: {
    backgroundColor: 'rgba(56,189,248,0.06)',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
    padding: 8,
  },
  allocationTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  allocationListContainer: {
    maxHeight: 110,
    overflow: 'hidden',
  },
  simRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  simBill: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  simAlloc: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#22C55E',
  },
  simStatus: {
    fontSize: 10,
    fontWeight: '700',
  },
  paymentCardFooter: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(22,22,22,0.98)',
  },
  settleSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 8,
    ...makeShadow('#22C55E', { width: 0, height: 3 }, 0.25, 6, 2),
  },
  settleSubmitBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.5,
  },
  settleSubmitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  historyTableCard: {
    flex: 1,
    backgroundColor: '#161616',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  refreshBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 8,
    borderRadius: 6,
  },
  receiptCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    marginBottom: 10,
  },
  receiptTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  receiptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(56,189,248,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  receiptBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#38BDF8',
  },
  receiptModeTag: {
    fontSize: 11,
    color: '#94A3B8',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '700',
  },
  receiptAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#22C55E',
  },
  receiptMetaRow: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 4,
  },
  receiptMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  receiptBillsBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  receiptBillsTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
  },
  receiptBillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  receiptBillNo: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  receiptBillAlloc: {
    fontSize: 11,
    color: '#94A3B8',
  },
  receiptBillStatus: {
    fontSize: 11,
    color: '#64748B',
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  allClearTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },
  allClearSub: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#161616',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  successModalHeader: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  successModalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  successModalSub: {
    fontSize: 12.5,
    color: '#38BDF8',
    fontWeight: '700',
    marginTop: 2,
  },
  successModalBody: {
    padding: 18,
    maxHeight: 380,
  },
  successSummaryBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 14,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  successLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  successVal: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  successValBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  successBillsHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  successBillItem: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  successBillNo: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  successBillAlloc: {
    fontSize: 12,
    fontWeight: '800',
    color: '#22C55E',
  },
  successBillOut: {
    fontSize: 11,
    color: '#64748B',
  },
  successModalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  successDoneBtn: {
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  successDoneBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

