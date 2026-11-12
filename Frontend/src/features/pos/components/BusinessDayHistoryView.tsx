import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { fetchDayHistory, DayMetrics } from '../../../services/dayManagementApi';
import { fetchCarWashOrders, ApiOrder } from '../../../services/carwashOrderApi';

interface DayHistoryItem {
  dayId: number;
  businessDate: string;
  dayStatus: 'OPEN' | 'CLOSED';
  openingCash: number;
  closingCash?: number | null;
  expectedCash?: number | null;
  cashDifference?: number | null;
  totalOrders: number;
  totalSales: number;
  totalCustomerSales: number;
  totalDealerSales: number;
  cashSales: number;
  cardSales: number;
  onlineSales: number;
  otherSales: number;
  totalCashIn: number;
  totalCashOut: number;
  totalRefunds: number;
  startedBy: string;
  startedDate: string;
  endedBy?: string | null;
  endedDate?: string | null;
  startRemarks?: string | null;
  closingRemarks?: string | null;
}

interface BusinessDayHistoryViewProps {
  onBackToOrders?: () => void;
  onSelectDayToViewInOrders?: (day: DayHistoryItem) => void;
}

export const BusinessDayHistoryView: React.FC<BusinessDayHistoryViewProps> = ({
  onBackToOrders,
  onSelectDayToViewInOrders,
}) => {
  const [days, setDays] = useState<DayHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');

  // Orders Modal State
  const [selectedDayForOrders, setSelectedDayForOrders] = useState<DayHistoryItem | null>(null);
  const [dayOrders, setDayOrders] = useState<ApiOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [orderSearch, setOrderSearch] = useState<string>('');

  // Day Summary Details Modal State
  const [selectedDayForSummary, setSelectedDayForSummary] = useState<DayHistoryItem | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetchDayHistory({ limit: 100 });
      setDays((res as any) || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load business day history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleOpenDayOrders = async (day: DayHistoryItem) => {
    setSelectedDayForOrders(day);
    setOrderSearch('');
    setLoadingOrders(true);
    try {
      const orders = await fetchCarWashOrders('ALL', '', '', day.dayId);
      setDayOrders(orders);
    } catch (err: any) {
      console.warn('Failed to load orders for day:', day.dayId, err);
      setDayOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const filteredDays = days.filter((d) => {
    if (statusFilter === 'OPEN') return d.dayStatus === 'OPEN';
    if (statusFilter === 'CLOSED') return d.dayStatus === 'CLOSED';
    return true;
  });

  const totalHistoricalSales = days.reduce((sum, d) => sum + Number(d.totalSales || 0), 0);
  const totalHistoricalWashes = days.reduce((sum, d) => sum + Number(d.totalOrders || 0), 0);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return dateStr;
    }
  };

  const filteredOrders = dayOrders.filter((o) => {
    if (!orderSearch.trim()) return true;
    const q = orderSearch.toLowerCase();
    return (
      (o.orderNo || '').toLowerCase().includes(q) ||
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.vehicleNumber || '').toLowerCase().includes(q) ||
      (o.packageName || '').toLowerCase().includes(q)
    );
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.pageTitle}>Business Day History</Text>
          <Text style={styles.pageSubtitle}>
            Complete record of past operational days, sales summaries, and customer wash orders
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadHistory} activeOpacity={0.7}>
            <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
          </TouchableOpacity>

          {onBackToOrders && (
            <TouchableOpacity style={styles.backBtn} onPress={onBackToOrders} activeOpacity={0.7}>
              <Text style={styles.backBtnText}>◀ Back to Dashboard</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Top Summary KPI Cards */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>TOTAL BUSINESS DAYS</Text>
          <Text style={styles.kpiValue}>{days.length}</Text>
          <Text style={styles.kpiHint}>Logged in CarWashDayMaster</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>LIFETIME WASHES</Text>
          <Text style={styles.kpiValue}>{totalHistoricalWashes}</Text>
          <Text style={styles.kpiHint}>Total completed wash orders</Text>
        </View>

        <View style={styles.kpiCardSales}>
          <Text style={styles.kpiLabelSales}>CUMULATIVE REVENUE</Text>
          <Text style={styles.kpiValueSales}>${totalHistoricalSales.toFixed(2)}</Text>
          <Text style={styles.kpiHintSales}>Combined gross sales</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>AVG REVENUE / DAY</Text>
          <Text style={styles.kpiValue}>
            ${days.length > 0 ? (totalHistoricalSales / days.length).toFixed(2) : '0.00'}
          </Text>
          <Text style={styles.kpiHint}>Average per business day</Text>
        </View>
      </View>

      {/* 3. Filters Bar */}
      <View style={styles.filterBar}>
        <View style={styles.filterPills}>
          <TouchableOpacity
            style={[styles.pill, statusFilter === 'ALL' && styles.pillActive]}
            onPress={() => setStatusFilter('ALL')}
          >
            <Text style={[styles.pillText, statusFilter === 'ALL' && styles.pillTextActive]}>
              All Days ({days.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, statusFilter === 'OPEN' && styles.pillActive]}
            onPress={() => setStatusFilter('OPEN')}
          >
            <Text style={[styles.pillText, statusFilter === 'OPEN' && styles.pillTextActive]}>
              Active Open ({days.filter((d) => d.dayStatus === 'OPEN').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, statusFilter === 'CLOSED' && styles.pillActive]}
            onPress={() => setStatusFilter('CLOSED')}
          >
            <Text style={[styles.pillText, statusFilter === 'CLOSED' && styles.pillTextActive]}>
              Closed Days ({days.filter((d) => d.dayStatus === 'CLOSED').length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. Days List / Table */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#E60012" />
          <Text style={styles.loadingText}>Loading business day history...</Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadHistory}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredDays.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No business day records found</Text>
          <Text style={styles.emptySubtitle}>Start a business day from POS to record wash operations</Text>
        </View>
      ) : (
        <View style={styles.daysList}>
          {filteredDays.map((day) => {
            const isOpen = day.dayStatus === 'OPEN';
            return (
              <View key={day.dayId} style={[styles.dayCard, isOpen && styles.dayCardOpen]}>
                {/* Header row of Day Card */}
                <View style={styles.dayCardHeader}>
                  <View style={styles.dayBadgeRow}>
                    <View style={[styles.statusBadge, isOpen ? styles.badgeOpen : styles.badgeClosed]}>
                      <View style={[styles.statusDot, isOpen ? styles.dotOpen : styles.dotClosed]} />
                      <Text style={[styles.statusBadgeText, isOpen ? styles.badgeTextOpen : styles.badgeTextClosed]}>
                        {isOpen ? `DAY #${day.dayId} (ACTIVE)` : `DAY #${day.dayId}`}
                      </Text>
                    </View>

                    <Text style={styles.dayDateTitle}>{formatDate(day.businessDate)}</Text>
                  </View>

                  <View style={styles.dayActions}>
                    <TouchableOpacity
                      style={styles.viewOrdersBtn}
                      onPress={() => handleOpenDayOrders(day)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.viewOrdersBtnText}>👁️ View Orders ({day.totalOrders})</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.summaryBtn}
                      onPress={() => setSelectedDayForSummary(day)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.summaryBtnText}>📊 Day Summary</Text>
                    </TouchableOpacity>

                    {onSelectDayToViewInOrders && (
                      <TouchableOpacity
                        style={styles.inspectInPosBtn}
                        onPress={() => onSelectDayToViewInOrders(day)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.inspectInPosBtnText}>Inspect in Dashboard ➜</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Day Details Grid */}
                <View style={styles.dayDetailsGrid}>
                  <View style={styles.dayMetricBox}>
                    <Text style={styles.dayMetricLabel}>TOTAL WASHES</Text>
                    <Text style={styles.dayMetricValue}>{day.totalOrders}</Text>
                    <Text style={styles.dayMetricSub}>Orders placed</Text>
                  </View>

                  <View style={styles.dayMetricBox}>
                    <Text style={styles.dayMetricLabel}>TOTAL SALES</Text>
                    <Text style={styles.dayMetricSalesValue}>${Number(day.totalSales || 0).toFixed(2)}</Text>
                    <Text style={styles.dayMetricSub}>Paid wash orders</Text>
                  </View>

                  <View style={styles.dayMetricBox}>
                    <Text style={styles.dayMetricLabel}>PAYMENT MIX</Text>
                    <Text style={styles.dayMetricMix}>
                      Cash: ${Number(day.cashSales || 0).toFixed(2)}
                    </Text>
                    <Text style={styles.dayMetricMix}>
                      Card/Online: ${(Number(day.cardSales || 0) + Number(day.onlineSales || 0)).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.dayMetricBox}>
                    <Text style={styles.dayMetricLabel}>TIMING & OPERATOR</Text>
                    <Text style={styles.dayMetricTimeText}>
                      Started: {formatTime(day.startedDate)} by {day.startedBy || 'Cashier'}
                    </Text>
                    <Text style={styles.dayMetricTimeText}>
                      Ended: {day.endedDate ? `${formatTime(day.endedDate)} by ${day.endedBy || 'Cashier'}` : 'Still Open'}
                    </Text>
                  </View>
                </View>

                {day.closingRemarks ? (
                  <View style={styles.remarksRow}>
                    <Text style={styles.remarksLabel}>Remarks: </Text>
                    <Text style={styles.remarksText}>{day.closingRemarks}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {/* ================= MODAL: ORDERS IN SELECTED DAY ================= */}
      {selectedDayForOrders && (
        <Modal
          visible={!!selectedDayForOrders}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedDayForOrders(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.ordersModalCard}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.modalTitle}>
                      Day #{selectedDayForOrders.dayId} Orders
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        selectedDayForOrders.dayStatus === 'OPEN' ? styles.badgeOpen : styles.badgeClosed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          selectedDayForOrders.dayStatus === 'OPEN'
                            ? styles.badgeTextOpen
                            : styles.badgeTextClosed,
                        ]}
                      >
                        {selectedDayForOrders.dayStatus}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.modalSubtitle}>
                    {formatDate(selectedDayForOrders.businessDate)} • {dayOrders.length} total orders recorded
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedDayForOrders(null)}
                >
                  <Text style={styles.modalCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Search & Filter */}
              <View style={styles.modalSearchRow}>
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search order number, plate, customer or package..."
                  placeholderTextColor="#94A3B8"
                  value={orderSearch}
                  onChangeText={setOrderSearch}
                />
              </View>

              {/* Orders Table */}
              {loadingOrders ? (
                <View style={styles.modalLoadingBox}>
                  <ActivityIndicator size="large" color="#E60012" />
                  <Text style={styles.loadingText}>Fetching day orders...</Text>
                </View>
              ) : filteredOrders.length === 0 ? (
                <View style={styles.modalEmptyBox}>
                  <Text style={styles.emptyTitle}>No orders found for Day #{selectedDayForOrders.dayId}</Text>
                </View>
              ) : (
                <ScrollView style={styles.ordersTableScroll}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.thCell, { flex: 1.2 }]}>ORDER NO</Text>
                    <Text style={[styles.thCell, { flex: 1.5 }]}>CUSTOMER</Text>
                    <Text style={[styles.thCell, { flex: 1.2 }]}>VEHICLE</Text>
                    <Text style={[styles.thCell, { flex: 1.5 }]}>PACKAGE</Text>
                    <Text style={[styles.thCell, { flex: 1 }]}>AMOUNT</Text>
                    <Text style={[styles.thCell, { flex: 1 }]}>PAYMENT</Text>
                    <Text style={[styles.thCell, { flex: 1 }]}>STATUS</Text>
                  </View>

                  {filteredOrders.map((ord) => {
                    const isPaid = (ord.paymentStatus || '').toUpperCase() === 'PAID';
                    return (
                      <View key={ord.orderId} style={styles.tableRow}>
                        <Text style={[styles.tdCellBold, { flex: 1.2 }]}>{ord.orderNo}</Text>
                        <Text style={[styles.tdCell, { flex: 1.5 }]} numberOfLines={1}>
                          {ord.customerName}
                        </Text>
                        <Text style={[styles.tdPlate, { flex: 1.2 }]}>{ord.vehicleNumber}</Text>
                        <Text style={[styles.tdCell, { flex: 1.5 }]} numberOfLines={1}>
                          {ord.packageName}
                        </Text>
                        <Text style={[styles.tdCellBold, { flex: 1, color: '#10B981' }]}>
                          ${Number(ord.totalAmount || 0).toFixed(2)}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.payBadge, isPaid ? styles.payPaid : styles.payPending]}>
                            {ord.payMode || 'CASH'} • {ord.paymentStatus}
                          </Text>
                        </View>
                        <Text style={[styles.statusCell, { flex: 1 }]}>
                          {ord.statusName || (ord.statusCode === 70 ? 'CLOSED' : ord.statusCode === 60 ? 'COMPLETED' : 'IN_SERVICE')}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              )}

              {/* Modal Footer */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalDoneBtn}
                  onPress={() => setSelectedDayForOrders(null)}
                >
                  <Text style={styles.modalDoneBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ================= MODAL: DAY SUMMARY DETAILS ================= */}
      {selectedDayForSummary && (
        <Modal
          visible={!!selectedDayForSummary}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedDayForSummary(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.summaryModalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Day #{selectedDayForSummary.dayId} Financial Summary</Text>
                  <Text style={styles.modalSubtitle}>
                    Business Date: {formatDate(selectedDayForSummary.businessDate)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedDayForSummary(null)}
                >
                  <Text style={styles.modalCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.summaryModalBody}>
                <View style={styles.summarySection}>
                  <Text style={styles.summarySectionTitle}>Operational Times</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Started Date/Time:</Text>
                    <Text style={styles.summaryRowValue}>
                      {selectedDayForSummary.startedDate
                        ? new Date(selectedDayForSummary.startedDate).toLocaleString()
                        : '-'}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Started By:</Text>
                    <Text style={styles.summaryRowValue}>{selectedDayForSummary.startedBy || 'Cashier'}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Ended Date/Time:</Text>
                    <Text style={styles.summaryRowValue}>
                      {selectedDayForSummary.endedDate
                        ? new Date(selectedDayForSummary.endedDate).toLocaleString()
                        : 'Active / Still Open'}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Closed By:</Text>
                    <Text style={styles.summaryRowValue}>{selectedDayForSummary.endedBy || '-'}</Text>
                  </View>
                </View>

                <View style={styles.summarySection}>
                  <Text style={styles.summarySectionTitle}>Orders & Sales</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Total Wash Orders:</Text>
                    <Text style={styles.summaryRowValueBold}>{selectedDayForSummary.totalOrders}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Total Gross Sales:</Text>
                    <Text style={[styles.summaryRowValueBold, { color: '#10B981' }]}>
                      ${Number(selectedDayForSummary.totalSales || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Customer Sales:</Text>
                    <Text style={styles.summaryRowValue}>
                      ${Number(selectedDayForSummary.totalCustomerSales || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Dealer Sales:</Text>
                    <Text style={styles.summaryRowValue}>
                      ${Number(selectedDayForSummary.totalDealerSales || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.summarySection}>
                  <Text style={styles.summarySectionTitle}>Tender Collection Breakdown</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Cash Collections:</Text>
                    <Text style={styles.summaryRowValue}>
                      ${Number(selectedDayForSummary.cashSales || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Card Collections:</Text>
                    <Text style={styles.summaryRowValue}>
                      ${Number(selectedDayForSummary.cardSales || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Online / QR Collections:</Text>
                    <Text style={styles.summaryRowValue}>
                      ${Number(selectedDayForSummary.onlineSales || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.summarySection}>
                  <Text style={styles.summarySectionTitle}>Cash Drawer Reconciliation</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Opening Cash:</Text>
                    <Text style={styles.summaryRowValue}>
                      ${Number(selectedDayForSummary.openingCash || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Closing Cash (Counted):</Text>
                    <Text style={styles.summaryRowValue}>
                      {selectedDayForSummary.closingCash != null
                        ? `$${Number(selectedDayForSummary.closingCash).toFixed(2)}`
                        : '-'}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Expected Drawer Cash:</Text>
                    <Text style={styles.summaryRowValue}>
                      {selectedDayForSummary.expectedCash != null
                        ? `$${Number(selectedDayForSummary.expectedCash).toFixed(2)}`
                        : '-'}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Cash Difference / Variance:</Text>
                    <Text
                      style={[
                        styles.summaryRowValueBold,
                        {
                          color:
                            Number(selectedDayForSummary.cashDifference || 0) < 0
                              ? '#E60012'
                              : '#10B981',
                        },
                      ]}
                    >
                      {selectedDayForSummary.cashDifference != null
                        ? `$${Number(selectedDayForSummary.cashDifference).toFixed(2)}`
                        : '$0.00'}
                    </Text>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalDoneBtn}
                  onPress={() => setSelectedDayForSummary(null)}
                >
                  <Text style={styles.modalDoneBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 16,
  },
  headerLeft: {
    flex: 1,
    minWidth: 260,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refreshBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  refreshBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  backBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiCardSales: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  kpiLabelSales: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 4,
  },
  kpiValueSales: {
    fontSize: 26,
    fontWeight: '800',
    color: '#10B981',
    marginVertical: 4,
  },
  kpiHint: {
    fontSize: 12,
    color: '#94A3B8',
  },
  kpiHintSales: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  pillActive: {
    backgroundColor: '#0F172A',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '600',
  },
  retryBtn: {
    backgroundColor: '#E60012',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 60,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
  },
  daysList: {
    gap: 16,
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  dayCardOpen: {
    borderColor: '#22C55E',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  dayBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  badgeOpen: {
    backgroundColor: '#DCFCE7',
  },
  badgeClosed: {
    backgroundColor: '#F1F5F9',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotOpen: {
    backgroundColor: '#16A34A',
  },
  dotClosed: {
    backgroundColor: '#64748B',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextOpen: {
    color: '#15803D',
  },
  badgeTextClosed: {
    color: '#475569',
  },
  dayDateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  dayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  viewOrdersBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  viewOrdersBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  summaryBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  summaryBtnText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 13,
  },
  inspectInPosBtn: {
    backgroundColor: '#E60012',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  inspectInPosBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  dayDetailsGrid: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    flexWrap: 'wrap',
  },
  dayMetricBox: {
    flex: 1,
    minWidth: 150,
  },
  dayMetricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  dayMetricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  dayMetricSalesValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
  },
  dayMetricSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  dayMetricMix: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    marginTop: 1,
  },
  dayMetricTimeText: {
    fontSize: 11,
    color: '#475569',
    marginTop: 1,
  },
  remarksRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  remarksLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  remarksText: {
    fontSize: 12,
    color: '#334155',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ordersModalCard: {
    width: '95%',
    maxWidth: 1000,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  summaryModalCard: {
    width: '90%',
    maxWidth: 650,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
  },
  summaryModalBody: {
    marginTop: 16,
  },
  summarySection: {
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summarySectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryRowLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryRowValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  summaryRowValueBold: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '800',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  modalSearchRow: {
    marginTop: 16,
    marginBottom: 12,
  },
  modalSearchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  modalLoadingBox: {
    padding: 50,
    alignItems: 'center',
    gap: 12,
  },
  modalEmptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  ordersTableScroll: {
    maxHeight: 450,
    marginTop: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 6,
  },
  thCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tdCell: {
    fontSize: 13,
    color: '#334155',
  },
  tdCellBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  tdPlate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E60012',
  },
  payBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  payPaid: {
    color: '#15803D',
    backgroundColor: '#DCFCE7',
  },
  payPending: {
    color: '#B45309',
    backgroundColor: '#FEF3C7',
  },
  statusCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  modalFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'flex-end',
  },
  modalDoneBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  modalDoneBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
