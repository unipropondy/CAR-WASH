import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { PosOrder } from '../../../types/pos.types';
import {
  IconCheck,
  IconHourglass,
  IconDroplet,
  IconAutomobile,
  IconClock,
} from '../../../components/common/AppIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { makeShadow } from '../../../theme/shadows';
import { getDbTimestampMs, parseToSgDate, getDbTime } from '../../../services/timeService';

export type FilterTabKey =
  | 'ALL'
  | 'PENDING_PAYMENT'
  | 'PAID_WAITING'
  | 'IN_SERVICE'
  | 'COMPLETED'
  | 'CLOSED'
  | 'CANCELLED';

interface OrderQueueTableProps {
  orders: PosOrder[];
  searchQuery?: string;
  currentFilter?: FilterTabKey;
  onFilterChange?: (filter: FilterTabKey) => void;
  onAssignOrder: (order: PosOrder) => void;
  onViewOrder: (order: PosOrder) => void;
  onPayOrder: (order: PosOrder) => void;
  onStartOrder?: (order: PosOrder) => void;
  onCompleteOrder?: (order: PosOrder) => void;
  onCloseOrder?: (order: PosOrder) => void;
  onCancelOrder?: (order: PosOrder) => void;
  onViewHistory?: (order: PosOrder) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

interface AvatarTheme {
  bg: string;
  text: string;
  border: string;
}

const AVATAR_THEMES: AvatarTheme[] = [
  { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' }, // Royal Blue
  { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' }, // Violet / Purple
  { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' }, // Tangerine
  { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' }, // Emerald
  { bg: '#FDF2F8', text: '#DB2777', border: '#FBCFE8' }, // Pink / Rose
  { bg: '#F0FDFA', text: '#0D9488', border: '#99F6E4' }, // Teal
  { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' }, // Amber
  { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' }, // Indigo
  { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' }, // Crimson
  { bg: '#F0F9FF', text: '#0284C7', border: '#BAE6FD' }, // Sky Blue
];

const getInitials = (name?: string): string => {
  if (!name || !name.trim()) return 'CU';
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    if (/^\d+$/.test(words[1]) && words[0].length >= 2) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || 'CU';
};

export const OrderQueueTable: React.FC<OrderQueueTableProps> = ({
  orders,
  searchQuery = '',
  currentFilter,
  onFilterChange,
  onAssignOrder,
  onViewOrder,
  onPayOrder,
  onStartOrder,
  onCompleteOrder,
  onCloseOrder,
  onCancelOrder,
  onViewHistory,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [internalFilter, setInternalFilter] = useState<FilterTabKey>(currentFilter || 'ALL');
  const activeFilter = currentFilter !== undefined ? currentFilter : internalFilter;
  const setActiveFilter = (filter: FilterTabKey) => {
    setInternalFilter(filter);
    onFilterChange?.(filter);
  };
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Helper to identify dealer / commercial account credit orders
  const isDealerOrder = (o: PosOrder): boolean => {
    return Boolean(
      (o.payMode && o.payMode.trim().toUpperCase() === 'CREDIT') ||
      o.paymentStatus === 'CREDIT' ||
      (o as any).isDealer ||
      (o as any).dealerId ||
      (o as any).DealerId ||
      (o as any).dealerName ||
      (o as any).DealerName ||
      (o.vehiclePlate && (o.vehiclePlate.includes('DLR-') || o.vehiclePlate.includes('FLEET'))) ||
      (o.customerName && (o.customerName.toUpperCase() === 'UNIPRO' || o.customerName.toUpperCase().includes('DEALER')))
    );
  };

  // Helper functions for payment status logic:
  // 1. Dealer / Account Credit: ALWAYS authorized on credit, never stuck in pending payment
  // 2. CASH: Payment status is PENDING until cashier collects payment
  // 3. Non-CASH (Card, PayNow, Online, Member, Credit): Automatically Paid / Waiting
  const isOrderPendingPayment = (o: PosOrder) => {
    if (o.statusCode === 80 || o.status === 'CANCELLED' || o.paymentStatus === 'CANCELLED') return false;
    if (isDealerOrder(o)) return false;
    if (o.paymentStatus === 'PAID') return false;
    return (
      (o.statusCode != null && (o.statusCode === 10 || o.statusCode === 20)) ||
      o.paymentStatus === 'PENDING'
    );
  };

  const isOrderPaidWaiting = (o: PosOrder) => {
    if (isOrderPendingPayment(o)) return false;
    const code = o.statusCode ?? (o.status === 'WAITING_ASSIGN' ? 30 : 20);
    if (isDealerOrder(o)) {
      return !o.assignedBayId && code < 50 && o.status !== 'IN_SERVICE' && o.status !== 'COMPLETED' && o.status !== 'CLOSED' && o.status !== 'CANCELLED';
    }
    return (
      (code === 30 || code === 40 || o.status === 'WAITING_ASSIGN') &&
      code !== 50 &&
      code !== 60 &&
      code !== 70 &&
      code !== 80
    );
  };

  // Badge Counts for 7 Filter Tabs
  const countAll = orders.length;
  const countPendingPayment = orders.filter(isOrderPendingPayment).length;
  const countPaidWaiting = orders.filter(isOrderPaidWaiting).length;
  const countInService = orders.filter(
    (o) => o.statusCode === 50 || o.status === 'IN_SERVICE'
  ).length;
  const countCompleted = orders.filter(
    (o) => o.statusCode === 60 || o.status === 'COMPLETED'
  ).length;
  const countClosed = orders.filter(
    (o) => o.statusCode === 70 || o.status === 'CLOSED'
  ).length;
  const countCancelled = orders.filter(
    (o) => o.statusCode === 80 || o.status === 'CANCELLED'
  ).length;

  // Filtered orders list based on active filter and navbar search query
  const filteredOrders = orders.filter((o) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.customerMobile && o.customerMobile.toLowerCase().includes(q)) ||
        (o.vehiclePlate && o.vehiclePlate.toLowerCase().includes(q)) ||
        (o.packageName && o.packageName.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'PENDING_PAYMENT') return isOrderPendingPayment(o);
    if (activeFilter === 'PAID_WAITING') return isOrderPaidWaiting(o);
    if (activeFilter === 'IN_SERVICE') return o.statusCode === 50 || o.status === 'IN_SERVICE';
    if (activeFilter === 'COMPLETED') return o.statusCode === 60 || o.status === 'COMPLETED';
    if (activeFilter === 'CLOSED') return o.statusCode === 70 || o.status === 'CLOSED';
    if (activeFilter === 'CANCELLED') return o.statusCode === 80 || o.status === 'CANCELLED';
    return true;
  });

  // Pagination State & Slice (10 orders per page, no scroll)
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page to 1 whenever filter tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery]);

  const totalOrders = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalOrders);
  const pagedOrders = filteredOrders.slice(startIndex, endIndex);

  const renderPagination = () => {
    if (totalOrders === 0) return null;

    return (
      <View style={styles.paginationContainer}>
        <View style={styles.paginationLeft}>
          <Text style={styles.paginationInfoText}>
            Showing <Text style={styles.paginationInfoBold}>{startIndex + 1}–{endIndex}</Text> of{' '}
            <Text style={styles.paginationInfoBold}>{totalOrders}</Text> orders
          </Text>
        </View>

        <View style={styles.paginationRight}>
          {/* Previous Button */}
          <TouchableOpacity
            style={[styles.pageNavBtn, currentPage === 1 && styles.pageNavBtnDisabled]}
            onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
          >
            <Ionicons
              name="chevron-back"
              size={15}
              color={currentPage === 1 ? '#94A3B8' : '#0F172A'}
            />
            <Text
              style={[
                styles.pageNavBtnText,
                currentPage === 1 && styles.pageNavBtnTextDisabled,
              ]}
            >
              Previous
            </Text>
          </TouchableOpacity>

          {/* Page Number Pills */}
          <View style={styles.pagePillsRow}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              if (
                totalPages > 6 &&
                Math.abs(page - currentPage) > 2 &&
                page !== 1 &&
                page !== totalPages
              ) {
                if (Math.abs(page - currentPage) === 3) {
                  return (
                    <Text key={`ellipsis-${page}`} style={styles.pageEllipsis}>
                      …
                    </Text>
                  );
                }
                return null;
              }

              const isActive = page === currentPage;
              return (
                <TouchableOpacity
                  key={page}
                  style={[
                    styles.pageNumberBtn,
                    isActive && styles.pageNumberBtnActive,
                  ]}
                  onPress={() => setCurrentPage(page)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.pageNumberText,
                      isActive && styles.pageNumberTextActive,
                    ]}
                  >
                    {page}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Next Button */}
          <TouchableOpacity
            style={[styles.pageNavBtn, currentPage === totalPages && styles.pageNavBtnDisabled]}
            onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Next page"
          >
            <Text
              style={[
                styles.pageNavBtnText,
                currentPage === totalPages && styles.pageNavBtnTextDisabled,
              ]}
            >
              Next
            </Text>
            <Ionicons
              name="chevron-forward"
              size={15}
              color={currentPage === totalPages ? '#94A3B8' : '#0F172A'}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getPackageBadgeStyle = (packageName: string) => {
    const lower = (packageName || '').toLowerCase();
    if (lower.includes('premium')) {
      return { pill: styles.pkgPremiumPill, text: styles.pkgPremiumText };
    }
    if (lower.includes('deluxe')) {
      return { pill: styles.pkgDeluxePill, text: styles.pkgDeluxeText };
    }
    return { pill: styles.pkgBasicPill, text: styles.pkgBasicText };
  };

  const getCustomerAvatarTheme = (name?: string, index?: number): AvatarTheme => {
    if (typeof index === 'number') {
      return AVATAR_THEMES[index % AVATAR_THEMES.length];
    }
    const n = (name || '').trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < n.length; i++) {
      hash = n.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_THEMES[Math.abs(hash) % AVATAR_THEMES.length];
  };

  const parseWaitMinutes = (waitTime?: string): number => {
    if (!waitTime) return 0;
    const lower = waitTime.toLowerCase();
    if (lower.includes('h')) {
      const parts = lower.split('h');
      const hours = parseInt(parts[0], 10) || 0;
      const mins = parseInt(parts[1], 10) || 0;
      return hours * 60 + mins;
    }
    return parseInt(waitTime, 10) || 0;
  };

  // Live ticking counter state for active orders (updates every 10 seconds)
  const [now, setNow] = useState<number>(() => getDbTimestampMs());

  useEffect(() => {
    // Only run the timer if there is at least one active order
    const hasActiveOrders = orders.some((o) => {
      const code = o.statusCode ?? 0;
      const isCompleted = code === 60 || o.status === 'COMPLETED';
      const isClosed = code === 70 || o.status === 'CLOSED';
      const isCancelled = code === 80 || o.status === 'CANCELLED';
      return !isCompleted && !isClosed && !isCancelled;
    });

    if (!hasActiveOrders) return;

    const interval = setInterval(() => {
      setNow(getDbTimestampMs());
    }, 10000);

    return () => clearInterval(interval);
  }, [orders]);

  /**
   * Calculate live or frozen wait time duration:
   * 1. Start timer immediately when order is placed (from createdDate/createdAt).
   * 2. Continue counting while order is active.
   * 3. Stop timer immediately when completed (code 60) or closed (code 70).
   * 4. Display final elapsed duration; never continue counting completed/closed orders.
   * 5. Persist across page refreshes.
   */
  const getOrderWaitTime = (
    order: PosOrder,
    currentTimestamp: number
  ): { text: string; minutes: number } => {
    const code = order.statusCode ?? 0;
    const isCompleted = code === 60 || order.status === 'COMPLETED';
    const isClosed = code === 70 || order.status === 'CLOSED';
    const isCancelled = code === 80 || order.status === 'CANCELLED';

    if (isCancelled) {
      return { text: '0 min', minutes: 0 };
    }

    // Determine start timestamp
    let startMs: number | null = null;
    if (order.createdDate) {
      const p = parseToSgDate(order.createdDate).getTime();
      if (!isNaN(p)) startMs = p;
    }
    if (startMs === null && order.createdAt) {
      const p = parseToSgDate(order.createdAt).getTime();
      if (!isNaN(p)) {
        startMs = p;
      } else {
        const match = order.createdAt.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (match) {
          const d = getDbTime();
          let hrs = parseInt(match[1], 10);
          const mins = parseInt(match[2], 10);
          const ampm = match[3]?.toUpperCase();
          if (ampm === 'PM' && hrs < 12) hrs += 12;
          if (ampm === 'AM' && hrs === 12) hrs = 0;
          d.setHours(hrs, mins, 0, 0);
          startMs = d.getTime();
        }
      }
    }

    // If order is completed or closed: timer is stopped and duration is final!
    if (isCompleted || isClosed) {
      let endMs: number | null = null;
      const endCandidate = order.closedDate || order.completedDate;
      if (endCandidate) {
        const p = parseToSgDate(endCandidate).getTime();
        if (!isNaN(p)) endMs = p;
      }

      if (startMs !== null && endMs !== null && endMs >= startMs) {
        const diffMins = Math.max(0, Math.floor((endMs - startMs) / 60000));
        let text = `${diffMins} min`;
        if (diffMins >= 60) {
          const hrs = Math.floor(diffMins / 60);
          const rem = diffMins % 60;
          text = `${hrs}h ${rem}m`;
        }
        return { text, minutes: diffMins };
      }

      // If exact endMs not available, use backend-calculated frozen waitTime
      if (order.waitTime) {
        return { text: order.waitTime, minutes: parseWaitMinutes(order.waitTime) };
      }

      return { text: '0 min', minutes: 0 };
    }

    // Active order: timer is ticking continuously
    if (startMs !== null) {
      const elapsedMs = Math.max(0, currentTimestamp - startMs);
      const diffMins = Math.floor(elapsedMs / 60000);
      let text = `${diffMins} min`;
      if (diffMins >= 60) {
        const hrs = Math.floor(diffMins / 60);
        const rem = diffMins % 60;
        text = `${hrs}h ${rem}m`;
      }
      return { text, minutes: diffMins };
    }

    if (order.waitTime) {
      return { text: order.waitTime, minutes: parseWaitMinutes(order.waitTime) };
    }

    return { text: '0 min', minutes: 0 };
  };

  const formatOrderNo = (orderNo?: string | number): string => {
    if (!orderNo) return '#0000';
    const clean = String(orderNo).trim().replace(/^#+/, '');
    const digits = clean.length >= 4 ? clean.slice(-4) : clean.padStart(4, '0');
    return `#${digits}`;
  };

  return (
    <View style={styles.cardContainer}>
      {/* ================= 7 FILTER PILLS AT TOP OF CARD ================= */}
      <View style={styles.filterPillsContainer}>
        <ScrollView
          horizontal
          nestedScrollEnabled={true}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.filterPillsRow}
        >
          {/* 1. All Orders */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'ALL' && styles.filterPillActive]}
            onPress={() => setActiveFilter('ALL')}
            activeOpacity={0.85}
          >
            <Text style={[styles.filterPillText, activeFilter === 'ALL' && styles.filterPillTextActive]}>
              All Orders
            </Text>
            <View style={[styles.filterCountBadge, activeFilter === 'ALL' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, activeFilter === 'ALL' && styles.filterCountTextActive]}>
                {countAll}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 2. Pending Payment */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'PENDING_PAYMENT' && styles.filterPillActive]}
            onPress={() => setActiveFilter('PENDING_PAYMENT')}
            activeOpacity={0.85}
          >
            <Text style={[styles.filterPillText, activeFilter === 'PENDING_PAYMENT' && styles.filterPillTextActive]}>
              Pending Payment
            </Text>
            <View style={[styles.filterCountBadge, activeFilter === 'PENDING_PAYMENT' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, activeFilter === 'PENDING_PAYMENT' && styles.filterCountTextActive]}>
                {countPendingPayment}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 3. Paid / Waiting */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'PAID_WAITING' && styles.filterPillActive]}
            onPress={() => setActiveFilter('PAID_WAITING')}
            activeOpacity={0.85}
          >
            <Text style={[styles.filterPillText, activeFilter === 'PAID_WAITING' && styles.filterPillTextActive]}>
              Paid / Waiting
            </Text>
            <View style={[styles.filterCountBadge, activeFilter === 'PAID_WAITING' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, activeFilter === 'PAID_WAITING' && styles.filterCountTextActive]}>
                {countPaidWaiting}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 4. In Service */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'IN_SERVICE' && styles.filterPillActive]}
            onPress={() => setActiveFilter('IN_SERVICE')}
            activeOpacity={0.85}
          >
            <Text style={[styles.filterPillText, activeFilter === 'IN_SERVICE' && styles.filterPillTextActive]}>
              In Service
            </Text>
            <View style={[styles.filterCountBadge, activeFilter === 'IN_SERVICE' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, activeFilter === 'IN_SERVICE' && styles.filterCountTextActive]}>
                {countInService}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 5. Completed */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'COMPLETED' && styles.filterPillActive]}
            onPress={() => setActiveFilter('COMPLETED')}
            activeOpacity={0.85}
          >
            <Text style={[styles.filterPillText, activeFilter === 'COMPLETED' && styles.filterPillTextActive]}>
              Completed
            </Text>
            <View style={[styles.filterCountBadge, activeFilter === 'COMPLETED' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, activeFilter === 'COMPLETED' && styles.filterCountTextActive]}>
                {countCompleted}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 6. Closed */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'CLOSED' && styles.filterPillActive]}
            onPress={() => setActiveFilter('CLOSED')}
            activeOpacity={0.85}
          >
            <Text style={[styles.filterPillText, activeFilter === 'CLOSED' && styles.filterPillTextActive]}>
              Closed
            </Text>
            <View style={[styles.filterCountBadge, activeFilter === 'CLOSED' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, activeFilter === 'CLOSED' && styles.filterCountTextActive]}>
                {countClosed}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 7. Cancelled */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'CANCELLED' && styles.filterPillActive]}
            onPress={() => setActiveFilter('CANCELLED')}
            activeOpacity={0.85}
          >
            <Text style={[styles.filterPillText, activeFilter === 'CANCELLED' && styles.filterPillTextActive]}>
              Cancelled
            </Text>
            <View style={[styles.filterCountBadge, activeFilter === 'CANCELLED' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, activeFilter === 'CANCELLED' && styles.filterCountTextActive]}>
                {countCancelled}
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ================= DATA VIEW (RESPONSIVE: CARDS ON MOBILE, TABLE ON TABLET/DESKTOP) ================= */}
      {isMobile ? (
        <View style={styles.mobileCardsList}>
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No matching orders</Text>
              <Text style={styles.emptyText}>
                No orders found under {activeFilter.replace(/_/g, ' ')}.
              </Text>
            </View>
          ) : (
            pagedOrders.map((order, idx) => {
              const code =
                order.statusCode ??
                (order.status === 'WAITING_ASSIGN'
                  ? 30
                  : order.status === 'IN_SERVICE'
                  ? 50
                  : 20);
              const isDealer = isDealerOrder(order);
              const isCancelled = order.statusCode === 80 || order.status === 'CANCELLED' || order.paymentStatus === 'CANCELLED' || code === 80;
              const isPending = !isCancelled && isOrderPendingPayment(order);
              const isPaid = !isCancelled && (isDealer || (!isPending && (order.paymentStatus === 'PAID' || (code >= 30 && code < 80))));
              const pkgStyle = getPackageBadgeStyle(order.packageName);
              const { text: waitTextDisplay, minutes: waitMins } = getOrderWaitTime(order, now);

              return (
                <TouchableOpacity
                  key={order.id || order.orderNumber || idx}
                  style={styles.mobileOrderCard}
                  onPress={() => onViewOrder(order)}
                  activeOpacity={0.8}
                >
                  {/* Top Row: Order # and Payment / Wait badges */}
                  <View style={styles.mobileCardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                      <Text style={styles.mobileOrderNo}>{formatOrderNo(order.orderNumber)}</Text>
                      <Text style={[styles.customerNameText, { flexShrink: 1 }]} numberOfLines={1}>
                        {order.packageName}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isCancelled ? (
                        <View style={styles.cancelledBadge}>
                          <Text style={styles.cancelledBadgeText}>✕ Cancelled</Text>
                        </View>
                      ) : isDealer ? (
                        <View style={styles.creditBadge}>
                          <Text style={styles.creditBadgeIcon}>🏢</Text>
                          <Text style={styles.creditBadgeText}>Credit</Text>
                        </View>
                      ) : isPaid ? (
                        <View style={styles.paidBadge}>
                          <Text style={styles.paidCheckmark}>✓</Text>
                          <Text style={styles.paidBadgeText}>Paid</Text>
                        </View>
                      ) : (
                        <View style={styles.pendingBadge}>
                          <IconHourglass size={11} color="#D97706" strokeWidth={2.2} />
                          <Text style={styles.pendingBadgeText}>Pending</Text>
                        </View>
                      )}
                      <Text
                        style={[
                          styles.waitText,
                          waitMins > 40
                            ? styles.waitTextRed
                            : waitMins >= 20
                            ? styles.waitTextAmber
                            : styles.waitTextNormal,
                        ]}
                      >
                        ⏱ {waitTextDisplay}
                      </Text>
                    </View>
                  </View>

                  {/* Customer & Vehicle Info */}
                  <View style={styles.mobileCardBody}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mobileCustomerName}>{order.customerName || 'Customer'}</Text>
                      <Text style={styles.mobileCustomerSub}>
                        {isDealer ? (
                          <Text style={styles.dealerSubText}>Dealer</Text>
                        ) : (
                          order.customerMobile || 'Walk-in'
                        )} • <Text style={styles.mobilePlateText}>{order.vehiclePlate}</Text>
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.amountBoldText}>${order.totalAmount.toFixed(2)}</Text>
                      <Text style={[styles.cashTagText, isDealer && styles.creditTagText]}>
                        {isDealer ? 'CREDIT' : (order.payMode || 'CASH')}
                      </Text>
                    </View>
                  </View>

                  {/* Bottom Actions Row: Bay badge / Assign & View */}
                  <View style={styles.mobileCardFooter}>
                    <View>
                      {order.assignedBayName || order.assignedBayId ? (
                        <View style={styles.bayBadge}>
                          <Text style={styles.bayWaterDrop}>💧</Text>
                          <Text style={styles.bayBadgeText}>
                            {order.assignedBayName || `Bay ${order.assignedBayId}`}
                          </Text>
                        </View>
                      ) : ((isPaid || isDealer) && code < 50) ? (
                        <TouchableOpacity
                          style={styles.selectBayBtn}
                          onPress={() => onAssignOrder(order)}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel="Select Bay"
                        >
                          <Text style={styles.selectBayWaterDrop}>💧</Text>
                          <Text style={styles.selectBayBtnText}>Select Bay</Text>
                        </TouchableOpacity>
                      ) : isPending ? (
                        <View style={styles.awaitingPayContainer}>
                          <Text style={styles.awaitingPayText}>Awaiting Pay</Text>
                        </View>
                      ) : (
                        <Text style={styles.unassignedText}>—</Text>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      {isPending && (
                        <TouchableOpacity
                          style={styles.mobilePayNowBtn}
                          onPress={() => onPayOrder(order)}
                          activeOpacity={0.8}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel="Collect Payment"
                        >
                          <Ionicons name="card-outline" size={13} color="#FFFFFF" />
                          <Text style={styles.mobilePayNowBtnText}>Collect Now</Text>
                        </TouchableOpacity>
                      )}
                      {onCancelOrder && isPending && (
                        <TouchableOpacity
                          style={styles.cancelActionBtn}
                          onPress={() => onCancelOrder(order)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          accessibilityLabel="Cancel Order"
                        >
                          <Ionicons name="close" size={15} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                      {onViewHistory && (
                        <TouchableOpacity
                          style={styles.historyBtn}
                          onPress={() => onViewHistory(order)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <IconClock size={14} color="#94A3B8" strokeWidth={2} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => onViewOrder(order)}
                        activeOpacity={0.85}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.viewBtnText}>View Details</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          {renderPagination()}
        </View>
      ) : (
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          style={{ width: '100%' }}
          contentContainerStyle={{ minWidth: '100%' }}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.tableWrapper, width < 960 && { minWidth: 880 }]}>
            {/* Table Column Headers */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { width: '10%' }]}>ORDER NO</Text>
              <Text style={[styles.th, { width: '15%' }]}>NAME</Text>
              <Text style={[styles.th, { width: '12%' }]}>VEHICLE</Text>
              <Text style={[styles.th, { width: '17%' }]}>PACKAGE</Text>
              <Text style={[styles.th, { width: '11%' }]}>AMOUNT</Text>
              <Text style={[styles.th, { width: '11%' }]}>PAYMENT</Text>
              <Text style={[styles.th, { width: '10%' }]}>BAY</Text>
              <Text style={[styles.th, { width: '6%' }]}>WAIT</Text>
              <Text style={[styles.th, { width: '8%', textAlign: 'center' }]}>ACTION</Text>
            </View>

            {/* Table Body Rows - 10 orders per page without inner scroll */}
            <View style={styles.tableBody}>
              {filteredOrders.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No matching orders</Text>
                  <Text style={styles.emptyText}>
                    No orders found under {activeFilter.replace(/_/g, ' ')}.
                  </Text>
                </View>
              ) : (
                pagedOrders.map((order, idx) => {
                  const code =
                    order.statusCode ??
                    (order.status === 'WAITING_ASSIGN'
                      ? 30
                      : order.status === 'IN_SERVICE'
                      ? 50
                      : 20);
                  const isDealer = isDealerOrder(order);
                  const isCancelled = order.statusCode === 80 || order.status === 'CANCELLED' || order.paymentStatus === 'CANCELLED' || code === 80;
                  const isPending = !isCancelled && isOrderPendingPayment(order);
                  const isPaid = !isCancelled && (isDealer || (!isPending && (order.paymentStatus === 'PAID' || (code >= 30 && code < 80))));
                  const pkgStyle = getPackageBadgeStyle(order.packageName);
                  const isHovered = hoveredRow === order.id;
                  const { text: waitTextDisplay, minutes: waitMins } = getOrderWaitTime(order, now);
                  const isOverdue = waitMins > 40;

                  return (
                    <TouchableOpacity
                      key={order.id || order.orderNumber || idx}
                      style={[
                        styles.tableRow,
                        isHovered ? styles.tableRowHover : null,
                        isOverdue ? styles.tableRowOverdue : null,
                        Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null,
                      ]}
                      onPress={() => onViewOrder(order)}
                      activeOpacity={0.78}
                      // @ts-ignore
                      onMouseEnter={() => setHoveredRow(order.id)}
                      // @ts-ignore
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {/* 1. ORDER NO: Monospace ID without background box */}
                      <View style={{ width: '10%', justifyContent: 'center' }}>
                        <Text style={styles.orderIdText} numberOfLines={1}>
                          {formatOrderNo(order.orderNumber)}
                        </Text>
                      </View>

                      {/* 2. NAME: Modern Soft-Tinted Avatar + Name + Subtitle */}
                      <View style={[styles.customerCell, { width: '15%' }]}>
                        {(() => {
                          const avatarTheme = getCustomerAvatarTheme(order.customerName, idx);
                          return (
                            <>
                              <View
                                style={[
                                  styles.customerAvatar,
                                  {
                                    backgroundColor: avatarTheme.bg,
                                    borderColor: avatarTheme.border,
                                  },
                                ]}
                              >
                                <Text style={[styles.customerAvatarText, { color: avatarTheme.text }]}>
                                  {getInitials(order.customerName)}
                                </Text>
                              </View>
                              <View style={styles.customerInfoBlock}>
                                <Text style={styles.customerNameText} numberOfLines={1}>
                                  {(!order.customerName || order.customerName.trim().toLowerCase() === 'walk-in customer' || order.customerName.trim().toLowerCase() === 'walk in customer' || order.customerName.trim().toLowerCase() === 'walk-in' || order.customerName.trim().toLowerCase() === 'walk in' || order.customerName.trim().toLowerCase() === 'walkin') ? 'Walk-in' : order.customerName}
                                </Text>
                                <Text
                                  style={[styles.customerSubText, isDealer && styles.dealerSubText]}
                                  numberOfLines={1}
                                >
                                  {isDealer ? 'Dealer' : (order.customerMobile ? order.customerMobile : 'Walk-in')}
                                </Text>
                              </View>
                            </>
                          );
                        })()}
                      </View>

                      {/* 3. VEHICLE: Plate without background box */}
                      <View style={[styles.vehicleCell, { width: '12%' }]}>
                        <Text style={styles.plateText} numberOfLines={1}>
                          {order.vehiclePlate}
                        </Text>
                      </View>

                      {/* 4. PACKAGE: Clean bold text matching Customer/Dealer font + CAR WASH */}
                      <View style={{ width: '17%', justifyContent: 'center', paddingRight: 8, overflow: 'hidden' }}>
                        <Text style={styles.customerNameText} numberOfLines={1} ellipsizeMode="tail">
                          {order.packageName}
                        </Text>
                        <Text style={styles.carWashLabel}>CAR WASH</Text>
                      </View>

                      {/* 5. AMOUNT: Bold $ 15.00 + CREDIT / CASH */}
                      <View style={{ width: '11%', justifyContent: 'center' }}>
                        <Text style={styles.amountBoldText} numberOfLines={1}>
                          $ {order.totalAmount.toFixed(2)}
                        </Text>
                        <Text style={[styles.cashTagText, isDealer && styles.creditTagText]}>
                          {isDealer ? 'CREDIT' : (order.payMode || 'CASH')}
                        </Text>
                      </View>

                      {/* 6. PAYMENT: Cancelled / Credit / Paid / Pay Now Button */}
                      <View style={{ width: '11%', justifyContent: 'center' }}>
                        {isCancelled ? (
                          <View style={styles.cancelledBadge}>
                            <Text style={styles.cancelledBadgeText}>✕ Cancelled</Text>
                          </View>
                        ) : isDealer ? (
                          <View style={styles.creditBadge}>
                            <Text style={styles.creditBadgeIcon}>🏢</Text>
                            <Text style={styles.creditBadgeText}>Credit</Text>
                          </View>
                        ) : isPaid ? (
                          <View style={styles.paidBadge}>
                            <Text style={styles.paidCheckmark}>✓</Text>
                            <Text style={styles.paidBadgeText}>Paid</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.payNowBtn}
                            onPress={() => onPayOrder(order)}
                            activeOpacity={0.8}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel="Collect Payment"
                          >
                            <Ionicons name="card-outline" size={13} color="#FFFFFF" />
                            <Text style={styles.payNowBtnText}>Collect Now</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* 7. BAY: Blue Waterdrop Badge or Select Bay Button */}
                      <View style={{ width: '10%', justifyContent: 'center' }}>
                        {order.assignedBayName || order.assignedBayId ? (
                          <View style={styles.bayBadge}>
                            <Text style={styles.bayWaterDrop}>💧</Text>
                            <Text style={styles.bayBadgeText}>
                              {order.assignedBayName || `Bay ${order.assignedBayId}`}
                            </Text>
                          </View>
                        ) : (!isCancelled && (isPaid || isDealer) && code < 50) ? (
                          <TouchableOpacity
                            style={styles.selectBayBtn}
                            onPress={() => onAssignOrder(order)}
                            activeOpacity={0.8}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel="Select Bay"
                          >
                            <Text style={styles.selectBayWaterDrop}>💧</Text>
                            <Text style={styles.selectBayBtnText}>Select Bay</Text>
                          </TouchableOpacity>
                        ) : isPending ? (
                          <View style={styles.awaitingPayContainer}>
                            <Text style={styles.awaitingPayText}>Awaiting Pay</Text>
                          </View>
                        ) : (
                          <Text style={styles.unassignedText}>—</Text>
                        )}
                      </View>

                      {/* 8. WAIT: Wait duration */}
                      <View style={{ width: '6%', justifyContent: 'center' }}>
                        <Text
                          style={[
                            styles.waitText,
                            waitMins > 40
                              ? styles.waitTextRed
                              : waitMins >= 20
                              ? styles.waitTextAmber
                              : styles.waitTextNormal,
                          ]}
                        >
                          {waitTextDisplay}
                        </Text>
                      </View>

                      {/* 9. ACTION: View Button + Cancel + Clock */}
                      <View style={[styles.actionCell, { width: '8%' }]}>
                        <TouchableOpacity
                          style={styles.viewBtn}
                          onPress={() => onViewOrder(order)}
                          activeOpacity={0.85}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.viewBtnText}>View</Text>
                        </TouchableOpacity>

                        {onCancelOrder && isPending && (
                          <TouchableOpacity
                            style={styles.cancelActionBtn}
                            onPress={() => onCancelOrder(order)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityLabel="Cancel Order"
                          >
                            <Ionicons name="close" size={14} color="#DC2626" />
                          </TouchableOpacity>
                        )}

                        {onViewHistory && (
                          <TouchableOpacity
                            style={styles.historyBtn}
                            onPress={() => onViewHistory(order)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <IconClock size={14} color="#94A3B8" strokeWidth={2} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {/* Pagination Controls */}
            {renderPagination()}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
        } as any)
      : { elevation: 3 }),
  },
  // Filter Pills
  filterPillsContainer: {
    marginBottom: 20,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  filterCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  filterCountBadgeActive: {
    backgroundColor: '#1E293B',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  filterCountTextActive: {
    color: '#FFFFFF',
  },
  // Table
  tableWrapper: {
    width: '100%',
  },
  // Mobile Cards List
  mobileCardsList: {
    gap: 12,
    width: '100%',
  },
  mobileOrderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    gap: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' } as any)
      : { elevation: 2 }),
  },
  mobileCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  mobileOrderNo: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  mobileCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  mobileCustomerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  mobileCustomerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  mobilePlateText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  mobileCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    marginBottom: 8,
  },
  th: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  tableBody: {
    minHeight: 180,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  tableRowHover: {
    backgroundColor: '#F8FAFC',
  },
  tableRowOverdue: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#ED0712',
  },
  // Pagination Controls
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 10,
  },
  paginationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paginationInfoText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
  },
  paginationInfoBold: {
    fontWeight: '800',
    color: '#0F172A',
  },
  paginationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  pageNavBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#F1F5F9',
    opacity: 0.5,
  },
  pageNavBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  pageNavBtnTextDisabled: {
    color: '#94A3B8',
  },
  pagePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageNumberBtn: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pageNumberBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  pageNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  pageNumberTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  pageEllipsis: {
    fontSize: 13,
    color: '#94A3B8',
    paddingHorizontal: 4,
  },
  // ORDER Column
  orderIdChip: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  // CUSTOMER Column
  customerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    paddingRight: 6,
  },
  customerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  customerAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  customerInfoBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  customerNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  customerSubText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1.5,
  },
  dealerSubText: {
    color: '#2563EB',
    fontWeight: '700',
  },
  // VEHICLE Column
  vehicleCell: {
    justifyContent: 'center',
  },
  platePill: {
    alignSelf: 'flex-start',
  },
  plateText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  vehicleModelText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },
  // PACKAGE Column
  packagePill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  packagePillText: {
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
  },
  pkgDeluxePill: {
    backgroundColor: '#FEF3C7',
  },
  pkgDeluxeText: {
    color: '#92400E',
  },
  pkgPremiumPill: {
    backgroundColor: '#FEE2E2',
  },
  pkgPremiumText: {
    color: '#B91C1C',
  },
  pkgBasicPill: {
    backgroundColor: '#DBEAFE',
  },
  pkgBasicText: {
    color: '#1D4ED8',
  },
  carWashLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginTop: 3,
  },
  // AMOUNT Column
  amountBoldText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  cashTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  creditTagText: {
    color: '#2563EB',
    fontWeight: '900',
  },
  // PAYMENT Column
  creditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  creditBadgeIcon: {
    fontSize: 10,
  },
  creditBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  paidBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  cancelledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelledBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  // BAY Column
  bayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  bayBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  selectBayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    cursor: 'pointer' as any,
  },
  selectBayWaterDrop: {
    fontSize: 11,
  },
  selectBayBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ED0712',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 8,
    alignSelf: 'flex-start',
    ...makeShadow('#ED0712', { width: 0, height: 2 }, 0.25, 4, 2),
  },
  payNowBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  mobilePayNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ED0712',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    ...makeShadow('#ED0712', { width: 0, height: 2 }, 0.25, 4, 2),
  },
  mobilePayNowBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  awaitingPayContainer: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  awaitingPayText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#B45309',
  },
  unassignedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    paddingLeft: 8,
  },
  // WAIT Column
  waitText: {
    fontSize: 11,
    fontWeight: '800',
  },
  waitTextNormal: {
    color: '#64748B',
  },
  waitTextAmber: {
    color: '#D97706',
  },
  waitTextRed: {
    color: '#DC2626',
  },
  // ACTION Column
  actionCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  payBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 46,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  payBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  assignBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  assignBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  closeBtn: {
    backgroundColor: '#475569',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  doneBtn: {
    backgroundColor: '#059669',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    cursor: 'pointer',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  paidCheckmark: {
    fontSize: 12,
    fontWeight: '900',
    color: '#059669',
    marginRight: 2,
  },
  bayWaterDrop: {
    fontSize: 11,
    marginRight: 2,
  },
  viewBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 16,
    cursor: 'pointer',
  },
  viewBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 12,
  },
  historyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cancelActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  // Empty
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
});
