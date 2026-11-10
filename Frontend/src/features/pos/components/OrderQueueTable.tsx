import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
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
  onAssignOrder: (order: PosOrder) => void;
  onViewOrder: (order: PosOrder) => void;
  onPayOrder: (order: PosOrder) => void;
  onStartOrder?: (order: PosOrder) => void;
  onCompleteOrder?: (order: PosOrder) => void;
  onCloseOrder?: (order: PosOrder) => void;
  onViewHistory?: (order: PosOrder) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const OrderQueueTable: React.FC<OrderQueueTableProps> = ({
  orders,
  searchQuery = '',
  onAssignOrder,
  onViewOrder,
  onPayOrder,
  onStartOrder,
  onCompleteOrder,
  onCloseOrder,
  onViewHistory,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterTabKey>('ALL');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Helper functions for payment status logic:
  // 1. CASH: Payment status is PENDING until confirmed
  // 2. Non-CASH (Card, PayNow, Online, Member, Credit): Automatically Paid / Waiting
  const isOrderPendingPayment = (o: PosOrder) => {
    if (o.paymentStatus === 'PAID') return false;
    return (
      (o.statusCode != null && (o.statusCode === 10 || o.statusCode === 20)) ||
      o.paymentStatus === 'PENDING'
    );
  };

  const isOrderPaidWaiting = (o: PosOrder) => {
    if (isOrderPendingPayment(o)) return false;
    const code = o.statusCode ?? (o.status === 'WAITING_ASSIGN' ? 30 : 20);
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

  const getCustomerAvatarColor = (name: string) => {
    const n = (name || '').trim().toLowerCase();
    if (n.includes('loki')) return '#4F46E5'; // Indigo
    if (n.includes('rachel')) return '#0D9488'; // Teal
    if (n.includes('bryan')) return '#EA580C'; // Orange
    if (n.includes('marcus')) return '#059669'; // Emerald
    const colors = ['#4F46E5', '#0D9488', '#EA580C', '#059669', '#2563EB', '#7C3AED'];
    let hash = 0;
    for (let i = 0; i < n.length; i++) {
      hash = n.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
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
  const [now, setNow] = useState<number>(() => Date.now());

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
      setNow(Date.now());
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
      const p = new Date(order.createdDate).getTime();
      if (!isNaN(p)) startMs = p;
    }
    if (startMs === null && order.createdAt) {
      const p = new Date(order.createdAt).getTime();
      if (!isNaN(p)) {
        startMs = p;
      } else {
        const match = order.createdAt.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (match) {
          const d = new Date();
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
        const p = new Date(endCandidate).getTime();
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
    if (!orderNo) return '0000';
    const str = String(orderNo).trim();
    return str.length >= 4 ? str.slice(-4) : str.padStart(4, '0');
  };

  return (
    <View style={styles.cardContainer}>
      {/* ================= 7 FILTER PILLS AT TOP OF CARD ================= */}
      <View style={styles.filterPillsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
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

      {/* ================= DATA TABLE ================= */}
      <View style={styles.tableWrapper}>
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

        {/* Table Body Rows - Fixed to show exactly 7 records with inner scroll */}
        <ScrollView
          style={styles.tableBody}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
        >
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No matching orders</Text>
              <Text style={styles.emptyText}>
                No orders found under {activeFilter.replace(/_/g, ' ')}.
              </Text>
            </View>
          ) : (
            filteredOrders.map((order, idx) => {
              const code =
                order.statusCode ??
                (order.status === 'WAITING_ASSIGN'
                  ? 30
                  : order.status === 'IN_SERVICE'
                  ? 50
                  : 20);
              const isPending = isOrderPendingPayment(order);
              const isPaid = !isPending && (order.paymentStatus === 'PAID' || code >= 30);
              const isPaidWaiting = isOrderPaidWaiting(order);
              const isInService =
                code === 40 ||
                code === 50 ||
                order.status === 'ASSIGNED_TO_BAY' ||
                order.status === 'IN_WASH';
              const isCompleted = code === 60 || order.status === 'COMPLETED';

              const pkgStyle = getPackageBadgeStyle(order.packageName);
              const isHovered = hoveredRow === order.id;
              const { text: waitTextDisplay, minutes: waitMins } = getOrderWaitTime(order, now);
              const isOverdue = waitMins > 40;

              return (
                <View
                  key={order.id || order.orderNumber || idx}
                  style={[
                    styles.tableRow,
                    isHovered ? styles.tableRowHover : null,
                    isOverdue ? styles.tableRowOverdue : null,
                  ]}
                  // @ts-ignore
                  onMouseEnter={() => setHoveredRow(order.id)}
                  // @ts-ignore
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {/* 1. ORDER NO: Monospace ID Chip with last 4 digits */}
                  <View style={{ width: '10%', justifyContent: 'center' }}>
                    <View style={styles.orderIdChip}>
                      <Text style={styles.orderIdText} numberOfLines={1}>
                        {formatOrderNo(order.orderNumber)}
                      </Text>
                    </View>
                  </View>

                  {/* 2. NAME: Colored Avatar + Name */}
                  <View style={[styles.customerCell, { width: '15%' }]}>
                    <View
                      style={[
                        styles.customerAvatar,
                        { backgroundColor: getCustomerAvatarColor(order.customerName) },
                      ]}
                    >
                      <Text style={styles.customerAvatarText}>
                        {(order.customerName || 'CU').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.customerNameText} numberOfLines={1}>
                      {order.customerName || 'Customer'}
                    </Text>
                  </View>

                  {/* 3. VEHICLE: Dark Plate Pill */}
                  <View style={[styles.vehicleCell, { width: '12%' }]}>
                    <View style={styles.platePill}>
                      <Text style={styles.plateText} numberOfLines={1}>
                        {order.vehiclePlate}
                      </Text>
                    </View>
                  </View>

                  {/* 4. PACKAGE: Colored Pill + CAR WASH */}
                  <View style={{ width: '17%', justifyContent: 'center', paddingRight: 8, overflow: 'hidden' }}>
                    <View style={[styles.packagePill, pkgStyle.pill]}>
                      <Text style={[styles.packagePillText, pkgStyle.text]} numberOfLines={1} ellipsizeMode="tail">
                        {order.packageName}
                      </Text>
                    </View>
                    <Text style={styles.carWashLabel}>CAR WASH</Text>
                  </View>

                  {/* 5. AMOUNT: Bold $ 15.00 + CREDIT / CASH */}
                  <View style={{ width: '11%', justifyContent: 'center' }}>
                    <Text style={styles.amountBoldText} numberOfLines={1}>
                      $ {order.totalAmount.toFixed(2)}
                    </Text>
                    <Text style={styles.cashTagText}>
                      {order.payMode || 'CASH'}
                    </Text>
                  </View>

                  {/* 6. PAYMENT: Green Paid Badge or Amber Pending Badge */}
                  <View style={{ width: '11%', justifyContent: 'center' }}>
                    {isPaid ? (
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
                    ) : (isPaid && code < 50) ? (
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

                  {/* 9. ACTION: View Button + Clock */}
                  <View style={[styles.actionCell, { width: '8%' }]}>
                    <TouchableOpacity
                      style={styles.viewBtn}
                      onPress={() => onViewOrder(order)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.viewBtnText}>View</Text>
                    </TouchableOpacity>

                    {onViewHistory && (
                      <TouchableOpacity
                        style={styles.historyBtn}
                        onPress={() => onViewHistory(order)}
                        activeOpacity={0.7}
                      >
                        <IconClock size={14} color="#94A3B8" strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
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
    height: 428,
    maxHeight: 428,
    ...(Platform.OS === 'web'
      ? ({
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
        } as any)
      : {}),
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
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
  // ORDER Column
  orderIdChip: {
    backgroundColor: '#F1F4F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIdText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  // CUSTOMER Column
  customerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  customerNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  // VEHICLE Column
  vehicleCell: {
    justifyContent: 'center',
  },
  platePill: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  plateText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
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
  // PAYMENT Column
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
    cursor: 'pointer',
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
