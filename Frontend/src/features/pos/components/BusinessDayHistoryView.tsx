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
import { Ionicons } from '@expo/vector-icons';
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
  const openDaysCount = days.filter((d) => d.dayStatus === 'OPEN').length;
  const closedDaysCount = days.filter((d) => d.dayStatus === 'CLOSED').length;

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
      {/* ============================================================== */}
      {/* 1. TOP HEADER ROW WITH EMBLEM & ACTIONS */}
      {/* ============================================================== */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.historyEmblem}>
            <Ionicons name="time" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.titleCol}>
            <View style={styles.titleWithLiveBadge}>
              <Text style={styles.pageTitle}>Business Day History</Text>
              <View style={styles.liveAuditBadge}>
                <View style={styles.liveAuditDot} />
                <Text style={styles.liveAuditText}>LIVE MSSQL AUDIT</Text>
              </View>
            </View>
            <Text style={styles.pageSubtitle}>
              Immutable shift records, sales telemetry, and completed wash orders
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadHistory} activeOpacity={0.7}>
            <Ionicons name="refresh" size={16} color="#0F172A" />
            <Text style={styles.refreshBtnText}>Sync Logs</Text>
          </TouchableOpacity>

          {onBackToOrders && (
            <TouchableOpacity style={styles.backBtn} onPress={onBackToOrders} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
              <Text style={styles.backBtnText}>Back to Dashboard</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ============================================================== */}
      {/* 2. TOP SUMMARY KPI CARDS (HIGH-IMPACT TELEMETRY ROW) */}
      {/* ============================================================== */}
      <View style={styles.kpiGrid}>
        {/* Card 1: Total Business Days */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeaderRow}>
            <Text style={styles.kpiLabel}>TOTAL BUSINESS DAYS</Text>
            <View style={[styles.kpiIconSquare, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="calendar-outline" size={17} color="#2563EB" />
            </View>
          </View>
          <Text style={styles.kpiValue}>{days.length}</Text>
          <View style={styles.kpiFooterRow}>
            <Ionicons name="shield-checkmark-outline" size={12} color="#94A3B8" />
            <Text style={styles.kpiHint}>Logged in CarWashDayMaster</Text>
          </View>
        </View>

        {/* Card 2: Lifetime Washes */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeaderRow}>
            <Text style={styles.kpiLabel}>LIFETIME WASHES</Text>
            <View style={[styles.kpiIconSquare, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="car-sport-outline" size={17} color="#7C3AED" />
            </View>
          </View>
          <Text style={styles.kpiValue}>{totalHistoricalWashes}</Text>
          <View style={styles.kpiFooterRow}>
            <Ionicons name="checkmark-done-circle-outline" size={12} color="#10B981" />
            <Text style={styles.kpiHint}>Total completed wash orders</Text>
          </View>
        </View>

        {/* Card 3: Cumulative Revenue (HERO SHOWSTOPPER CARD) */}
        <View style={styles.kpiCardHero}>
          <View style={styles.kpiHeaderRow}>
            <Text style={styles.kpiLabelHero}>CUMULATIVE REVENUE</Text>
            <View style={styles.kpiIconSquareHero}>
              <Ionicons name="wallet-outline" size={17} color="#10B981" />
            </View>
          </View>
          <Text style={styles.kpiValueHero}>${totalHistoricalSales.toFixed(2)}</Text>
          <View style={styles.kpiFooterRow}>
            <View style={styles.heroPulseDot} />
            <Text style={styles.kpiHintHero}>Combined gross wash sales</Text>
          </View>
        </View>

        {/* Card 4: Avg Revenue / Day */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeaderRow}>
            <Text style={styles.kpiLabel}>AVG REVENUE / DAY</Text>
            <View style={[styles.kpiIconSquare, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="trending-up-outline" size={17} color="#EA580C" />
            </View>
          </View>
          <Text style={styles.kpiValue}>
            ${days.length > 0 ? (totalHistoricalSales / days.length).toFixed(2) : '0.00'}
          </Text>
          <View style={styles.kpiFooterRow}>
            <Ionicons name="stats-chart-outline" size={12} color="#EA580C" />
            <Text style={styles.kpiHint}>Average throughput per shift</Text>
          </View>
        </View>
      </View>

      {/* ============================================================== */}
      {/* 3. SEGMENTED FILTER TABS */}
      {/* ============================================================== */}
      <View style={styles.filterBar}>
        <View style={styles.filterSegmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, statusFilter === 'ALL' && styles.segmentBtnActive]}
            onPress={() => setStatusFilter('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, statusFilter === 'ALL' && styles.segmentTextActive]}>
              All Days ({days.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, statusFilter === 'OPEN' && styles.segmentBtnActiveOpen]}
            onPress={() => setStatusFilter('OPEN')}
            activeOpacity={0.8}
          >
            <View style={[styles.segmentDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.segmentText, statusFilter === 'OPEN' && styles.segmentTextActiveOpen]}>
              Active Open ({openDaysCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, statusFilter === 'CLOSED' && styles.segmentBtnActive]}
            onPress={() => setStatusFilter('CLOSED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, statusFilter === 'CLOSED' && styles.segmentTextActive]}>
              Closed Days ({closedDaysCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ============================================================== */}
      {/* 4. DAYS LIST / MASS CARDS */}
      {/* ============================================================== */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#E60012" />
          <Text style={styles.loadingText}>Fetching historical business days from SQL Server...</Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={24} color="#DC2626" />
          <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadHistory} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Retry Sync</Text>
          </TouchableOpacity>
        </View>
      ) : filteredDays.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="file-tray-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No business day records found</Text>
          <Text style={styles.emptySubtitle}>Start a business day from POS to record wash operations</Text>
        </View>
      ) : (
        <View style={styles.daysList}>
          {filteredDays.map((day) => {
            const isOpen = day.dayStatus === 'OPEN';
            return (
              <View
                key={day.dayId}
                style={[styles.dayCard, isOpen ? styles.dayCardOpen : styles.dayCardClosed]}
              >
                {/* Header row of Day Card */}
                <View style={styles.dayCardHeader}>
                  <View style={styles.dayBadgeRow}>
                    {isOpen ? (
                      <View style={styles.activePillBadge}>
                        <View style={styles.pulseGreenDot} />
                        <Text style={styles.activePillText}>DAY #{day.dayId} (ACTIVE)</Text>
                      </View>
                    ) : (
                      <View style={styles.closedPillBadge}>
                        <Text style={styles.closedPillText}>DAY #{day.dayId}</Text>
                      </View>
                    )}

                    <View style={styles.dateLabelRow}>
                      <Ionicons name="calendar" size={16} color={isOpen ? '#059669' : '#475569'} />
                      <Text style={[styles.dayDateTitle, isOpen && { color: '#064E3B' }]}>
                        {formatDate(day.businessDate)}
                      </Text>
                    </View>
                  </View>

                  {/* Actions cluster */}
                  <View style={styles.dayActions}>
                    <TouchableOpacity
                      style={styles.viewOrdersBtn}
                      onPress={() => handleOpenDayOrders(day)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="receipt-outline" size={15} color="#FFFFFF" />
                      <Text style={styles.viewOrdersBtnText}>View Orders ({day.totalOrders})</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.summaryBtn}
                      onPress={() => setSelectedDayForSummary(day)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="pie-chart-outline" size={15} color="#0F172A" />
                      <Text style={styles.summaryBtnText}>Day Summary</Text>
                    </TouchableOpacity>

                    {onSelectDayToViewInOrders && (
                      <TouchableOpacity
                        style={styles.inspectInPosBtn}
                        onPress={() => onSelectDayToViewInOrders(day)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="speedometer-outline" size={15} color="#FFFFFF" />
                        <Text style={styles.inspectInPosBtnText}>Inspect in Dashboard ➜</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Day Details Grid: 4 Polished Telemetry Tiles */}
                <View style={styles.dayDetailsGrid}>
                  {/* Tile 1: Total Washes */}
                  <View style={[styles.tileBox, { borderColor: '#BAE6FD', backgroundColor: '#F0F9FF' }]}>
                    <View style={styles.tileHeader}>
                      <Ionicons name="car-sport-outline" size={15} color="#0284C7" />
                      <Text style={[styles.tileLabel, { color: '#0369A1' }]}>TOTAL WASHES</Text>
                    </View>
                    <Text style={styles.tileValue}>{day.totalOrders}</Text>
                    <Text style={styles.tileSub}>Orders placed</Text>
                  </View>

                  {/* Tile 2: Total Sales */}
                  <View style={[styles.tileBox, { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }]}>
                    <View style={styles.tileHeader}>
                      <Ionicons name="wallet-outline" size={15} color="#059669" />
                      <Text style={[styles.tileLabel, { color: '#047857' }]}>TOTAL SALES</Text>
                    </View>
                    <Text style={[styles.tileValue, { color: '#059669' }]}>
                      ${Number(day.totalSales || 0).toFixed(2)}
                    </Text>
                    <Text style={styles.tileSub}>Paid wash orders</Text>
                  </View>

                  {/* Tile 3: Payment Mix */}
                  <View style={[styles.tileBox, { borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }]}>
                    <View style={styles.tileHeader}>
                      <Ionicons name="card-outline" size={15} color="#7C3AED" />
                      <Text style={[styles.tileLabel, { color: '#6D28D9' }]}>PAYMENT MIX</Text>
                    </View>
                    <View style={styles.tileMixRow}>
                      <Text style={styles.tileMixText}>
                        Cash: <Text style={styles.tileMixBold}>${Number(day.cashSales || 0).toFixed(2)}</Text>
                      </Text>
                    </View>
                    <View style={styles.tileMixRow}>
                      <Text style={styles.tileMixText}>
                        Card/Online:{' '}
                        <Text style={styles.tileMixBold}>
                          ${(Number(day.cardSales || 0) + Number(day.onlineSales || 0)).toFixed(2)}
                        </Text>
                      </Text>
                    </View>
                  </View>

                  {/* Tile 4: Timing & Operator */}
                  <View style={[styles.tileBox, { borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }]}>
                    <View style={styles.tileHeader}>
                      <Ionicons name="time-outline" size={15} color="#EA580C" />
                      <Text style={[styles.tileLabel, { color: '#C2410C' }]}>TIMING & OPERATOR</Text>
                    </View>
                    <Text style={styles.tileTimeText} numberOfLines={1}>
                      Started: {formatTime(day.startedDate)} by {day.startedBy || 'Cashier'}
                    </Text>
                    <Text style={styles.tileTimeText} numberOfLines={1}>
                      {day.endedDate ? (
                        `Ended: ${formatTime(day.endedDate)} by ${day.endedBy || 'Cashier'}`
                      ) : (
                        <Text style={{ color: '#059669', fontWeight: '800' }}>🟢 Active • Still Open</Text>
                      )}
                    </Text>
                  </View>
                </View>

                {day.closingRemarks ? (
                  <View style={styles.remarksRow}>
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color="#64748B" />
                    <Text style={styles.remarksLabel}>Remarks: </Text>
                    <Text style={styles.remarksText}>{day.closingRemarks}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: ORDERS IN SELECTED DAY (PREMIUM TABLE VIEW) */}
      {/* ============================================================== */}
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
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
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
                  <Ionicons name="close" size={20} color="#475569" />
                </TouchableOpacity>
              </View>

              {/* Search & Filter */}
              <View style={styles.modalSearchRow}>
                <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search order number, license plate, customer name, or service package..."
                  placeholderTextColor="#94A3B8"
                  value={orderSearch}
                  onChangeText={setOrderSearch}
                />
                {orderSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setOrderSearch('')}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Orders Table */}
              {loadingOrders ? (
                <View style={styles.modalLoadingBox}>
                  <ActivityIndicator size="large" color="#E60012" />
                  <Text style={styles.loadingText}>Fetching day orders from SQL Server...</Text>
                </View>
              ) : filteredOrders.length === 0 ? (
                <View style={styles.modalEmptyBox}>
                  <Ionicons name="search" size={36} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No matching orders found</Text>
                  <Text style={styles.emptySubtitle}>No records match your filter criteria for this day.</Text>
                </View>
              ) : (
                <ScrollView style={styles.ordersTableScroll}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.thCell, { flex: 1.2 }]}>ORDER NO</Text>
                    <Text style={[styles.thCell, { flex: 1.5 }]}>CUSTOMER</Text>
                    <Text style={[styles.thCell, { flex: 1.2 }]}>VEHICLE PLATE</Text>
                    <Text style={[styles.thCell, { flex: 1.5 }]}>PACKAGE</Text>
                    <Text style={[styles.thCell, { flex: 1 }]}>AMOUNT</Text>
                    <Text style={[styles.thCell, { flex: 1.2 }]}>PAYMENT</Text>
                    <Text style={[styles.thCell, { flex: 1 }]}>STATUS</Text>
                  </View>

                  {filteredOrders.map((ord, idx) => {
                    const isPaid = (ord.paymentStatus || '').toUpperCase() === 'PAID';
                    const isEven = idx % 2 === 0;
                    return (
                      <View key={ord.orderId} style={[styles.tableRow, isEven && styles.tableRowEven]}>
                        <Text style={[styles.tdCellBold, { flex: 1.2 }]}>{ord.orderNo}</Text>
                        <Text style={[styles.tdCell, { flex: 1.5 }]} numberOfLines={1}>
                          {ord.customerName}
                        </Text>
                        <View style={{ flex: 1.2 }}>
                          <View style={styles.plateBadge}>
                            <Text style={styles.plateBadgeText}>{ord.vehicleNumber}</Text>
                          </View>
                        </View>
                        <Text style={[styles.tdCell, { flex: 1.5 }]} numberOfLines={1}>
                          {ord.packageName}
                        </Text>
                        <Text style={[styles.tdCellBold, { flex: 1, color: '#059669' }]}>
                          ${Number(ord.totalAmount || 0).toFixed(2)}
                        </Text>
                        <View style={{ flex: 1.2 }}>
                          <View style={[styles.payBadge, isPaid ? styles.payPaid : styles.payPending]}>
                            <Text style={[styles.payBadgeText, isPaid ? styles.payPaidText : styles.payPendingText]}>
                              {ord.payMode || 'CASH'} • {ord.paymentStatus}
                            </Text>
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.statusCell}>
                            {ord.statusName || (ord.statusCode === 70 ? 'CLOSED' : ord.statusCode === 60 ? 'COMPLETED' : 'IN_SERVICE')}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}

              {/* Modal Footer */}
              <View style={styles.modalFooter}>
                <Text style={styles.modalFooterSummary}>
                  Showing {filteredOrders.length} of {dayOrders.length} orders
                </Text>
                <TouchableOpacity
                  style={styles.modalDoneBtn}
                  onPress={() => setSelectedDayForOrders(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalDoneBtnText}>Close Window</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: DAY SUMMARY DETAILS (FINANCIAL RECONCILIATION) */}
      {/* ============================================================== */}
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
                <View style={{ gap: 4 }}>
                  <Text style={styles.modalTitle}>Day #{selectedDayForSummary.dayId} Financial Summary</Text>
                  <Text style={styles.modalSubtitle}>
                    Business Date: {formatDate(selectedDayForSummary.businessDate)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedDayForSummary(null)}
                >
                  <Ionicons name="close" size={20} color="#475569" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.summaryModalBody}>
                {/* Section 1: Operational Times */}
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

                {/* Section 2: Orders & Sales */}
                <View style={styles.summarySection}>
                  <Text style={styles.summarySectionTitle}>Orders & Sales</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Total Wash Orders:</Text>
                    <Text style={styles.summaryRowValueBold}>{selectedDayForSummary.totalOrders}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Total Gross Sales:</Text>
                    <Text style={[styles.summaryRowValueBold, { color: '#059669' }]}>
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

                {/* Section 3: Tender Collection Breakdown */}
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

                {/* Section 4: Cash Drawer Reconciliation */}
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
                              ? '#DC2626'
                              : '#059669',
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
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalDoneBtnText}>Close Summary</Text>
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
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
  },

  /* 1. HEADER ROW */
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    minWidth: 280,
  },
  historyEmblem: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#ED0712',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #EF4444 0%, #DC2626 50%, #991B1B 100%)',
          boxShadow: '0 8px 18px rgba(237, 7, 18, 0.28)',
        } as any)
      : { elevation: 4 }),
  },
  titleCol: {
    flex: 1,
  },
  titleWithLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  liveAuditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  liveAuditDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
    backgroundColor: '#10B981',
  },
  liveAuditText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.6,
  },
  pageSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any) : {}),
  },
  refreshBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any) : {}),
  },
  backBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* 2. KPI TELEMETRY GRID */
  kpiGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    ...(Platform.OS === 'web' ? ({ transition: 'transform 0.15s ease' } as any) : {}),
  },
  kpiCardHero: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.35)',
        } as any)
      : {}),
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiIconSquare: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIconSquareHero: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#064E3B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  kpiLabelHero: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  kpiValueHero: {
    fontSize: 30,
    fontWeight: '900',
    color: '#10B981',
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  kpiFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  kpiHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  kpiHintHero: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  heroPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },

  /* 3. SEGMENTED FILTER BAR */
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 20,
  },
  filterSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 5,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any) : {}),
  },
  segmentBtnActive: {
    backgroundColor: '#0F172A',
  },
  segmentBtnActiveOpen: {
    backgroundColor: '#059669',
  },
  segmentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  segmentTextActiveOpen: {
    color: '#FFFFFF',
  },

  /* 4. DAYS LIST / CARDS */
  daysList: {
    gap: 18,
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
  },
  dayCardOpen: {
    borderColor: '#10B981',
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.12)',
        } as any)
      : {}),
  },
  dayCardClosed: {
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#64748B',
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    flexWrap: 'wrap',
    gap: 14,
  },
  dayBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  activePillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pulseGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  activePillText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  closedPillBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  closedPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dayDateTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  dayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  viewOrdersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8.5,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any) : {}),
  },
  viewOrdersBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  summaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8.5,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any) : {}),
  },
  summaryBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  inspectInPosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#ED0712',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 8.5,
    shadowColor: '#ED0712',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: '0 4px 14px rgba(237, 7, 18, 0.3)',
        } as any)
      : {}),
  },
  inspectInPosBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  /* 4.1 DAY METRIC TILES */
  dayDetailsGrid: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  tileBox: {
    flex: 1,
    minWidth: 170,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  tileLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tileValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  tileSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  tileMixRow: {
    marginTop: 2,
  },
  tileMixText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  tileMixBold: {
    fontWeight: '800',
    color: '#0F172A',
  },
  tileTimeText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600',
    marginTop: 2,
  },
  remarksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
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

  /* 5. LOADING / ERROR / EMPTY */
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    gap: 14,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '700',
  },
  retryBtn: {
    backgroundColor: '#ED0712',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 60,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 13.5,
    color: '#64748B',
  },

  /* 6. MODALS STYLING */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  ordersModalCard: {
    width: '95%',
    maxWidth: 1050,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  summaryModalCard: {
    width: '92%',
    maxWidth: 680,
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
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
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeOpen: {
    backgroundColor: '#DCFCE7',
  },
  badgeClosed: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgeTextOpen: {
    color: '#15803D',
  },
  badgeTextClosed: {
    color: '#475569',
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    padding: 0,
  },
  modalLoadingBox: {
    padding: 60,
    alignItems: 'center',
    gap: 12,
  },
  modalEmptyBox: {
    padding: 50,
    alignItems: 'center',
    gap: 8,
  },
  ordersTableScroll: {
    maxHeight: 460,
    marginTop: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
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
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  tableRowEven: {
    backgroundColor: '#F8FAFC',
  },
  tdCellBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  tdCell: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  plateBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  plateBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  payBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  payPaid: {
    backgroundColor: '#DCFCE7',
  },
  payPending: {
    backgroundColor: '#FEF3C7',
  },
  payBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  payPaidText: {
    color: '#15803D',
  },
  payPendingText: {
    color: '#B45309',
  },
  statusCell: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
    marginTop: 12,
  },
  modalFooterSummary: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  modalDoneBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  modalDoneBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* 6.1 DAY SUMMARY MODAL BODY */
  summaryModalBody: {
    marginTop: 16,
  },
  summarySection: {
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summarySectionTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5.5,
  },
  summaryRowLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryRowValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  summaryRowValueBold: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '900',
  },
});
