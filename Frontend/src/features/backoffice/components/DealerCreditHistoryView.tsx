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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchDealerCreditHistory,
  fetchAllDealers,
  getCachedDealers,
  DealerRecord,
  DealerCreditBillItem,
  DealerCreditSummary,
} from '../../../services/dealerApi';
import { formatSgDateTime } from '../../../services/timeService';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';

export interface DealerCreditHistoryViewProps {
  theme?: 'dark' | 'light';
}

export const DealerCreditHistoryView: React.FC<DealerCreditHistoryViewProps> = ({
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const styles = useMemo(() => getStyles(isLight), [isLight]);
  const cachedInitialDealers = useMemo(() => getCachedDealers(), []);
  const [dealers, setDealers] = useState<DealerRecord[]>(cachedInitialDealers);
  const [selectedDealerId, setSelectedDealerId] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [bills, setBills] = useState<DealerCreditBillItem[]>([]);
  const [summary, setSummary] = useState<DealerCreditSummary>({
    totalCreditSales: 0,
    totalPaidAmount: 0,
    totalOutstandingAmount: 0,
    totalBillsCount: 0,
  });

  // Detail Modal State
  const [selectedBill, setSelectedBill] = useState<DealerCreditBillItem | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dealersData, creditData] = await Promise.all([
        fetchAllDealers(true),
        fetchDealerCreditHistory({
          dealerId: selectedDealerId,
          status: statusFilter,
          search: searchQuery.trim(),
        }),
      ]);
      setDealers(dealersData);
      setBills(creditData.data || []);
      setSummary(creditData.summary || {
        totalCreditSales: 0,
        totalPaidAmount: 0,
        totalOutstandingAmount: 0,
        totalBillsCount: 0,
      });
    } catch (err: any) {
      console.warn('[DealerCreditHistoryView] Load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDealerId, statusFilter]);

  const handleSearchSubmit = () => {
    loadData();
  };

  const formatDateTime = (dtStr?: string) => {
    if (!dtStr) return '-';
    return formatSgDateTime(dtStr);
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || 'PENDING').toUpperCase();
    if (s === 'PAID') {
      return {
        bg: 'rgba(34,197,94,0.12)',
        border: 'rgba(34,197,94,0.35)',
        text: '#22C55E',
        label: 'PAID',
        icon: 'checkmark-circle' as const,
      };
    }
    if (s === 'PARTIALLY_PAID') {
      return {
        bg: 'rgba(59,130,246,0.12)',
        border: 'rgba(59,130,246,0.35)',
        text: '#38BDF8',
        label: 'PARTIALLY PAID',
        icon: 'time' as const,
      };
    }
    return {
      bg: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.35)',
      text: '#F59E0B',
      label: 'PENDING',
      icon: 'alert-circle' as const,
    };
  };

  return (
    <View style={styles.container}>
      {/* ── TOP KPI SUMMARY CARDS ── */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, styles.kpiCardSales]}>
          <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(255,26,26,0.14)' }]}>
            <Ionicons name="receipt-outline" size={20} color={RED_BAY_COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kpiLabel}>TOTAL CREDIT SALES</Text>
            <Text style={styles.kpiValue}>${summary.totalCreditSales.toFixed(2)}</Text>
            <Text style={styles.kpiSub}>{summary.totalBillsCount} credit bills</Text>
          </View>
        </View>

        <View style={[styles.kpiCard, styles.kpiCardPaid]}>
          <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(34,197,94,0.14)' }]}>
            <Ionicons name="checkmark-done-circle-outline" size={20} color="#22C55E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kpiLabel}>TOTAL PAID / SETTLED</Text>
            <Text style={[styles.kpiValue, { color: '#22C55E' }]}>${summary.totalPaidAmount.toFixed(2)}</Text>
            <Text style={styles.kpiSub}>Settled into cash/bank</Text>
          </View>
        </View>

        <View style={[styles.kpiCard, styles.kpiCardOutstanding]}>
          <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(245,158,11,0.14)' }]}>
            <Ionicons name="hourglass-outline" size={20} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kpiLabel}>TOTAL OUTSTANDING</Text>
            <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>${summary.totalOutstandingAmount.toFixed(2)}</Text>
            <Text style={styles.kpiSub}>Pending dealer collections</Text>
          </View>
        </View>
      </View>

      {/* ── UNIFIED FILTER & CONTROL CARD ── */}
      <View style={styles.filterCard}>
        {/* Row 1: Dealer Selector */}
        <View style={styles.dealerFilterRow}>
          <View style={styles.dealerFilterLabel}>
            <Ionicons name="business" size={13} color="#D97706" />
            <Text style={styles.dealerFilterLabelText}>DEALER:</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
            <TouchableOpacity
              style={[styles.filterPill, !selectedDealerId && styles.filterPillActive]}
              onPress={() => setSelectedDealerId(undefined)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterPillText, !selectedDealerId && styles.filterPillTextActive]}>
                All Dealers ({dealers.length})
              </Text>
            </TouchableOpacity>

            {dealers.map((d) => {
              const isAct = selectedDealerId === d.dealerId;
              return (
                <TouchableOpacity
                  key={d.dealerId}
                  style={[styles.filterPill, isAct && styles.filterPillActive]}
                  onPress={() => setSelectedDealerId(d.dealerId)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterPillText, isAct && styles.filterPillTextActive]}>
                    {d.dealerName}
                  </Text>
                  <View style={[styles.pillCodeTag, isAct && styles.pillCodeTagActive]}>
                    <Text style={[styles.pillCodeText, isAct && styles.pillCodeTextActive]}>
                      {d.uniqueCode}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Row 2: Status Filter Segmented Buttons & Search Input */}
        <View style={styles.controlsRow}>
          {/* Status Segmented Tabs */}
          <View style={styles.statusSegment}>
            {[
              { id: 'ALL', label: 'All Status', dotColor: '#94A3B8' },
              { id: 'PENDING', label: 'Pending', dotColor: '#F59E0B' },
              { id: 'PARTIALLY_PAID', label: 'Partially Paid', dotColor: '#38BDF8' },
              { id: 'PAID', label: 'Paid', dotColor: '#22C55E' },
            ].map((st) => {
              const active = statusFilter === st.id;
              return (
                <TouchableOpacity
                  key={st.id}
                  style={[styles.statusTabBtn, active && styles.statusTabBtnActive]}
                  onPress={() => setStatusFilter(st.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.statusDot, { backgroundColor: st.dotColor }]} />
                  <Text style={[styles.statusTabBtnText, active && styles.statusTabBtnTextActive]}>
                    {st.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Search Box & Refresh */}
          <View style={styles.searchAndRefresh}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={15} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search bill#, plate, dealer..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchSubmit}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); loadData(); }}>
                  <Ionicons name="close-circle" size={15} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.refreshBtn} onPress={loadData} activeOpacity={0.8}>
              <Ionicons name="refresh" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── CREDIT HISTORY DATA TABLE (STREAMLINED & ELEGANT) ── */}
      <View style={styles.tableCard}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
            <Text style={styles.loadingText}>Loading dealer credit ledger...</Text>
          </View>
        ) : bills.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="folder-open-outline" size={44} color="#64748B" />
            <Text style={styles.emptyTitle}>No Credit Transactions Found</Text>
            <Text style={styles.emptySub}>No orders match the selected dealer, status, or search query.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.horizontalScroll}>
            <View style={styles.tableInnerWrapper}>
              {/* Header */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, { width: 160 }]}>Bill No & Date</Text>
                <Text style={[styles.th, { width: 170 }]}>Dealer Account</Text>
                <Text style={[styles.th, { width: 180 }]}>Vehicle & Package</Text>
                <Text style={[styles.th, { width: 95, textAlign: 'right' }]}>Total</Text>
                <Text style={[styles.th, { width: 95, textAlign: 'right' }]}>Paid</Text>
                <Text style={[styles.th, { width: 110, textAlign: 'right' }]}>Outstanding</Text>
                <Text style={[styles.th, { width: 130, textAlign: 'center' }]}>Credit Status</Text>
                <Text style={[styles.th, { width: 95, textAlign: 'center' }]}>Action</Text>
              </View>

              {/* Rows */}
              <ScrollView style={styles.tableBodyScroll} showsVerticalScrollIndicator={true}>
                {bills.map((item, idx) => {
                  const b = getStatusBadge(item.creditStatus);
                  const isEven = idx % 2 === 0;

                  return (
                    <TouchableOpacity
                      key={item.orderId}
                      style={[styles.tableRow, isEven && styles.tableRowEven]}
                      onPress={() => setSelectedBill(item)}
                      activeOpacity={0.8}
                    >
                      {/* Bill Number & Date */}
                      <View style={{ width: 160 }}>
                        <Text style={styles.billNumberText}>
                          {item.billNumber}
                        </Text>
                        <Text style={styles.cellSubText}>
                          {formatDateTime(item.orderDateTime)}
                        </Text>
                      </View>

                      {/* Dealer Name & Code */}
                      <View style={{ width: 170 }}>
                        <Text style={styles.cellBold} numberOfLines={1}>
                          {item.dealerName}
                        </Text>
                        <View style={styles.dealerCodeTag}>
                          <Text style={styles.dealerCodeTagText}>{item.dealerCode}</Text>
                        </View>
                      </View>

                      {/* Vehicle Plate & Package */}
                      <View style={{ width: 180 }}>
                        <View style={styles.plateTag}>
                          <Text style={styles.plateText}>{item.vehicleNumber}</Text>
                        </View>
                        <Text style={styles.cellSubText} numberOfLines={1}>
                          {item.selectedPackage} ({item.vehicleType})
                        </Text>
                      </View>

                      {/* Total Amount */}
                      <Text style={[styles.cellBold, { width: 95, textAlign: 'right' }]}>
                        ${item.totalAmount.toFixed(2)}
                      </Text>

                      {/* Paid Amount */}
                      <Text style={[styles.cellPaid, { width: 95, textAlign: 'right' }]}>
                        ${item.paidAmount.toFixed(2)}
                      </Text>

                      {/* Outstanding Amount */}
                      <View style={{ width: 110, alignItems: 'flex-end' }}>
                        <Text
                          style={[
                            styles.cellOutstanding,
                            item.outstandingAmount > 0 ? styles.cellOutstandingDue : styles.cellOutstandingZero,
                          ]}
                        >
                          ${item.outstandingAmount.toFixed(2)}
                        </Text>
                      </View>

                      {/* Credit Status Badge */}
                      <View style={{ width: 130, alignItems: 'center' }}>
                        <View style={[styles.statusBadge, { backgroundColor: b.bg, borderColor: b.border }]}>
                          <Ionicons name={b.icon} size={11} color={b.text} style={{ marginRight: 4 }} />
                          <Text style={[styles.statusBadgeText, { color: b.text }]}>{b.label}</Text>
                        </View>
                      </View>

                      {/* Action: View Details */}
                      <View style={{ width: 95, alignItems: 'center' }}>
                        <TouchableOpacity
                          style={styles.viewBtn}
                          onPress={() => setSelectedBill(item)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="eye-outline" size={13} color="#38BDF8" />
                          <Text style={styles.viewBtnText}>Details</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>
        )}
      </View>

      {/* ── INDIVIDUAL BILL DETAIL MODAL ── */}
      {selectedBill && (
        <Modal
          visible={Boolean(selectedBill)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedBill(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.modalIconBox}>
                    <Ionicons name="document-text" size={20} color={RED_BAY_COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Credit Bill Details: {selectedBill.billNumber}</Text>
                    <Text style={styles.modalSubtitle}>Order Date: {formatDateTime(selectedBill.orderDateTime)}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedBill(null)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Body */}
              <ScrollView style={styles.modalScroll}>
                {/* Dealer Info Section */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionHeading}>DEALER & VEHICLE PROFILE</Text>
                  <View style={styles.modalGrid2}>
                    <View style={styles.modalItem}>
                      <Text style={styles.modalLabel}>Dealer Name</Text>
                      <Text style={styles.modalValBold}>{selectedBill.dealerName}</Text>
                    </View>
                    <View style={styles.modalItem}>
                      <Text style={styles.modalLabel}>Dealer Code</Text>
                      <Text style={styles.modalVal}>{selectedBill.dealerCode}</Text>
                    </View>
                    <View style={styles.modalItem}>
                      <Text style={styles.modalLabel}>Vehicle Plate</Text>
                      <View style={[styles.plateTag, { alignSelf: 'flex-start' }]}>
                        <Text style={styles.plateText}>{selectedBill.vehicleNumber}</Text>
                      </View>
                    </View>
                    <View style={styles.modalItem}>
                      <Text style={styles.modalLabel}>Vehicle Type</Text>
                      <Text style={styles.modalVal}>{selectedBill.vehicleType}</Text>
                    </View>
                  </View>
                </View>

                {/* Service Details */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionHeading}>WASH PACKAGE & ADD-ONS</Text>
                  <View style={styles.modalGrid2}>
                    <View style={styles.modalItem}>
                      <Text style={styles.modalLabel}>Selected Package</Text>
                      <Text style={styles.modalValBold}>{selectedBill.selectedPackage}</Text>
                    </View>
                    <View style={styles.modalItem}>
                      <Text style={styles.modalLabel}>Additional Services</Text>
                      <Text style={styles.modalVal}>{selectedBill.additionalServices || 'None'}</Text>
                    </View>
                  </View>
                </View>

                {/* Financial Breakdown */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionHeading}>BILL SETTLEMENT FINANCIALS</Text>
                  <View style={styles.modalFinancialBox}>
                    <View style={styles.financialRow}>
                      <Text style={styles.finLabel}>Total Bill Amount</Text>
                      <Text style={styles.finVal}>${selectedBill.totalAmount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.financialRow}>
                      <Text style={styles.finLabel}>Paid / Settled Amount</Text>
                      <Text style={[styles.finVal, { color: '#22C55E' }]}>${selectedBill.paidAmount.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.financialRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 6 }]}>
                      <Text style={styles.finLabelBold}>Outstanding Balance Due</Text>
                      <Text style={[styles.finValBold, { color: selectedBill.outstandingAmount > 0 ? '#F59E0B' : '#22C55E' }]}>
                        ${selectedBill.outstandingAmount.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Applied Payments History */}
                {selectedBill.payments && selectedBill.payments.length > 0 && (
                  <View style={styles.modalSectionCard}>
                    <Text style={styles.modalSectionHeading}>SETTLEMENT RECEIPTS APPLIED TO THIS BILL</Text>
                    {selectedBill.payments.map((p, pIdx) => (
                      <View key={pIdx} style={styles.receiptItem}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.receiptNoText}>{p.receiptNo}</Text>
                          <Text style={styles.receiptAllocText}>+${p.allocatedAmount.toFixed(2)}</Text>
                        </View>
                        <Text style={styles.receiptDateText}>
                          Date: {formatDateTime(p.paymentDate)} • Mode: {p.paymentMode} • By: {p.processedBy || 'Backoffice'}
                        </Text>
                        {p.referenceNo && (
                          <Text style={styles.receiptRefText}>Ref: {p.referenceNo}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              {/* Modal Footer */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setSelectedBill(null)}
                >
                  <Text style={styles.modalCloseButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const getStyles = (isLight: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    padding: isLight ? 0 : 14,
    backgroundColor: isLight ? 'transparent' : '#0A0A0A',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  /* KPI Stat Cards */
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: isLight ? '#FFFFFF' : '#161616',
    borderRadius: isLight ? 14 : 12,
    borderWidth: 1,
    borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...(isLight && Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' } as any)
      : isLight
      ? { elevation: 2 }
      : {}),
  },
  kpiCardSales: {
    borderLeftWidth: 3.5,
    borderLeftColor: RED_BAY_COLORS.primary,
  },
  kpiCardPaid: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#22C55E',
  },
  kpiCardOutstanding: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#F59E0B',
  },
  kpiIconBox: {
    width: 38,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
    color: isLight ? '#0F172A' : '#FFFFFF',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },

  /* Filter Card */
  filterCard: {
    backgroundColor: isLight ? '#FFFFFF' : '#161616',
    borderRadius: isLight ? 14 : 12,
    borderWidth: 1,
    borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
    padding: 10,
    marginBottom: 12,
    gap: 10,
    ...(isLight && Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' } as any)
      : isLight
      ? { elevation: 2 }
      : {}),
  },
  dealerFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dealerFilterLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 4,
  },
  dealerFilterLabelText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: isLight ? '#0F172A' : '#D97706',
    letterSpacing: 0.5,
  },
  pillScroll: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
  },
  filterPillActive: {
    backgroundColor: isLight ? '#FEF2F2' : 'rgba(255,26,26,0.18)',
    borderColor: RED_BAY_COLORS.primary,
  },
  filterPillText: {
    fontSize: 11.5,
    color: isLight ? '#64748B' : '#94A3B8',
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: isLight ? '#ED0712' : '#FFFFFF',
    fontWeight: '800',
  },
  pillCodeTag: {
    backgroundColor: isLight ? '#EFF6FF' : 'rgba(255,255,255,0.08)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  pillCodeTagActive: {
    backgroundColor: isLight ? '#DBEAFE' : 'rgba(255,255,255,0.18)',
  },
  pillCodeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: isLight ? '#1D4ED8' : '#38BDF8',
  },
  pillCodeTextActive: {
    color: isLight ? '#1D4ED8' : '#FFFFFF',
  },

  /* Controls Row: Status Segment & Search */
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.05)',
  },
  statusSegment: {
    flexDirection: 'row',
    backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.03)',
    borderRadius: 7,
    padding: 3,
    borderWidth: 1,
    borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  statusTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  statusTabBtnActive: {
    backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.12)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: isLight ? '#64748B' : '#94A3B8',
  },
  statusTabBtnTextActive: {
    color: isLight ? '#0F172A' : '#FFFFFF',
    fontWeight: '800',
  },
  searchAndRefresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.1)',
    paddingHorizontal: 9,
    height: 34,
    gap: 6,
    width: 250,
  },
  searchInput: {
    flex: 1,
    color: isLight ? '#0F172A' : '#FFFFFF',
    fontSize: 11.5,
  },
  refreshBtn: {
    backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.08)',
    padding: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.1)',
  },

  /* Streamlined Table Card */
  tableCard: {
    flex: 1,
    backgroundColor: isLight ? '#FFFFFF' : '#161616',
    borderRadius: isLight ? 14 : 12,
    borderWidth: 1,
    borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    ...(isLight && Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' } as any)
      : isLight
      ? { elevation: 2 }
      : {}),
  },
  horizontalScroll: {
    flex: 1,
  },
  tableInnerWrapper: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.035)',
    borderBottomWidth: 1,
    borderBottomColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  th: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableBodyScroll: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.04)',
  },
  tableRowEven: {
    backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.015)',
  },
  billNumberText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: isLight ? '#1D4ED8' : '#38BDF8',
  },
  cellBold: {
    fontSize: 12.5,
    fontWeight: '800',
    color: isLight ? '#0F172A' : '#FFFFFF',
  },
  cellSubText: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  dealerCodeTag: {
    backgroundColor: isLight ? '#EFF6FF' : 'rgba(255,255,255,0.06)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  dealerCodeTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: isLight ? '#1D4ED8' : '#94A3B8',
  },
  plateTag: {
    backgroundColor: isLight ? '#F1F5F9' : '#0F172A',
    borderWidth: 1,
    borderColor: isLight ? '#CBD5E1' : '#334155',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  plateText: {
    color: isLight ? '#0F172A' : '#F8FAFC',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  cellPaid: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#22C55E',
  },
  cellOutstanding: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  cellOutstandingDue: {
    color: '#F59E0B',
  },
  cellOutstandingZero: {
    color: '#22C55E',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isLight ? '#EFF6FF' : 'rgba(56,189,248,0.1)',
    borderWidth: 1,
    borderColor: isLight ? '#BFDBFE' : 'rgba(56,189,248,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewBtnText: {
    fontSize: 10.5,
    color: isLight ? '#1D4ED8' : '#38BDF8',
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12.5,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: isLight ? '#0F172A' : '#FFFFFF',
    marginTop: 6,
  },
  emptySub: {
    fontSize: 11.5,
    color: '#64748B',
  },

  /* Detail Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '90%',
    backgroundColor: isLight ? '#FFFFFF' : '#161616',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    ...(isLight && Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 30px rgba(15, 23, 42, 0.12)' } as any)
      : isLight
      ? { elevation: 6 }
      : {}),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)',
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: isLight ? '#FEF2F2' : 'rgba(255,26,26,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: isLight ? '#0F172A' : '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    padding: 16,
  },
  modalSectionCard: {
    backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.06)',
    padding: 14,
    marginBottom: 12,
  },
  modalSectionHeading: {
    fontSize: 10.5,
    fontWeight: '800',
    color: isLight ? '#0F172A' : '#D97706',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  modalGrid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modalItem: {
    minWidth: '45%',
    flex: 1,
  },
  modalLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalVal: {
    fontSize: 12,
    color: isLight ? '#0F172A' : '#E2E8F0',
    marginTop: 2,
  },
  modalValBold: {
    fontSize: 12.5,
    fontWeight: '800',
    color: isLight ? '#0F172A' : '#FFFFFF',
    marginTop: 2,
  },
  modalFinancialBox: {
    backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  finLabel: {
    fontSize: 11.5,
    color: '#64748B',
  },
  finVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: isLight ? '#0F172A' : '#FFFFFF',
  },
  finLabelBold: {
    fontSize: 12,
    fontWeight: '800',
    color: isLight ? '#0F172A' : '#FFFFFF',
  },
  finValBold: {
    fontSize: 14,
    fontWeight: '900',
  },
  receiptItem: {
    backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.05)',
    padding: 10,
    marginBottom: 6,
  },
  receiptNoText: {
    fontSize: 12,
    fontWeight: '800',
    color: isLight ? '#1D4ED8' : '#38BDF8',
  },
  receiptAllocText: {
    fontSize: 12,
    fontWeight: '800',
    color: isLight ? '#059669' : '#22C55E',
  },
  receiptDateText: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  receiptRefText: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  modalFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)',
    alignItems: 'flex-end',
  },
  modalCloseButton: {
    backgroundColor: isLight ? '#ED0712' : 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 7,
  },
  modalCloseButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
