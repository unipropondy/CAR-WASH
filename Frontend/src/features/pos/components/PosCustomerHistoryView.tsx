import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import {
  fetchCarWashOrders,
  fetchCarWashOrderHistory,
  ApiOrder,
  OrderStatusHistoryItem,
} from '../../../services/carwashOrderApi';

export interface PosCustomerHistoryViewProps {
  cashierName?: string;
  onBackToOrders?: () => void;
  onToggleSidebar?: () => void;
  searchQuery?: string;
}

export interface CustomerProfileSummary {
  customerKey: string;
  customerName: string;
  mobileNumber: string;
  orders: ApiOrder[];
  totalVisits: number;
  totalSpend: number;
  averageSpend: number;
  vehicles: Array<{ plate: string; type: string; count: number }>;
  lastVisitDate: string;
  latestPackage: string;
  latestBay?: number | null;
  preferredPayMode: string;
  isVIP: boolean;
  isRepeat: boolean;
}

type TabMode = 'ALL_CUSTOMERS' | 'REPEAT_CUSTOMERS' | 'ALL_WASHES';
type PeriodFilter = 'ALL' | 'THIS_MONTH' | 'THIS_WEEK' | 'TODAY';

const AVATAR_COLORS = [
  { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' }, // Blue
  { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' }, // Violet
  { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' }, // Red
  { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' }, // Emerald
  { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' }, // Amber
  { bg: '#FDF2F8', text: '#DB2777', border: '#FBCFE8' }, // Pink
  { bg: '#F0FDFA', text: '#0D9488', border: '#99F6E4' }, // Teal
];

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name: string): string {
  if (!name || !name.trim()) return 'CU';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatCurrency(amount?: number | null): string {
  if (amount == null || isNaN(amount)) return '$0.00';
  return `$${Number(amount).toFixed(2)}`;
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const PosCustomerHistoryView: React.FC<PosCustomerHistoryViewProps> = ({
  cashierName = 'Cashier',
  onBackToOrders,
  onToggleSidebar,
  searchQuery: initialSearch = '',
}) => {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<TabMode>('ALL_CUSTOMERS');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>(initialSearch);

  // Selected Customer Modal
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfileSummary | null>(null);
  const [customerModalVisible, setCustomerModalVisible] = useState<boolean>(false);

  // Selected Order Modal
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null);
  const [orderModalVisible, setOrderModalVisible] = useState<boolean>(false);
  const [orderHistoryTrail, setOrderHistoryTrail] = useState<OrderStatusHistoryItem[]>([]);
  const [loadingOrderHistory, setLoadingOrderHistory] = useState<boolean>(false);

  // Fetch orders with date='all' to populate complete customer history
  const loadOrders = async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const data = await fetchCarWashOrders('ALL', '', 'all');
      // Sort newest first
      const sorted = (data || []).sort(
        (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
      );
      setOrders(sorted);
    } catch (err: any) {
      console.warn('Failed to fetch historical car wash orders:', err);
      setErrorMessage(err?.message || 'Failed to load customer history data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders(false);
  }, []);

  // Filter orders by period
  const periodFilteredOrders = useMemo(() => {
    if (periodFilter === 'ALL') return orders;
    const now = new Date();

    return orders.filter((o) => {
      const orderDate = new Date(o.createdDate);
      if (isNaN(orderDate.getTime())) return true;

      if (periodFilter === 'TODAY') {
        return (
          orderDate.getDate() === now.getDate() &&
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        );
      }
      if (periodFilter === 'THIS_WEEK') {
        const diffMs = now.getTime() - orderDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      }
      if (periodFilter === 'THIS_MONTH') {
        return (
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  }, [orders, periodFilter]);

  // Aggregate into Customer Profiles
  const customerProfiles = useMemo<CustomerProfileSummary[]>(() => {
    const map = new Map<string, CustomerProfileSummary>();

    for (const order of periodFilteredOrders) {
      const rawName = (order.customerName || 'Walk-in Customer').trim();
      const rawMobile = (order.mobileNumber || '').trim();
      // Group by Name + Mobile (or just Name if mobile not provided)
      const key = `${rawName.toLowerCase()}::${rawMobile}`;

      if (!map.has(key)) {
        map.set(key, {
          customerKey: key,
          customerName: rawName,
          mobileNumber: rawMobile,
          orders: [order],
          totalVisits: 1,
          totalSpend: Number(order.totalAmount || 0),
          averageSpend: Number(order.totalAmount || 0),
          vehicles: [
            {
              plate: order.vehicleNumber || 'WALK-IN',
              type: order.vehicleTypeName || 'Sedan',
              count: 1,
            },
          ],
          lastVisitDate: order.createdDate,
          latestPackage: order.packageName || 'Wash Service',
          latestBay: order.bayId,
          preferredPayMode: (order.payMode || 'CASH').trim().toUpperCase(),
          isVIP: false,
          isRepeat: false,
        });
      } else {
        const item = map.get(key)!;
        item.orders.push(order);
        item.totalVisits += 1;
        item.totalSpend += Number(order.totalAmount || 0);

        // Update vehicle frequency
        const plate = order.vehicleNumber || 'WALK-IN';
        const vType = order.vehicleTypeName || 'Sedan';
        const existingVehicle = item.vehicles.find((v) => v.plate === plate);
        if (existingVehicle) {
          existingVehicle.count += 1;
        } else {
          item.vehicles.push({ plate, type: vType, count: 1 });
        }

        // Check if this order is more recent than currently recorded lastVisitDate
        if (new Date(order.createdDate) > new Date(item.lastVisitDate)) {
          item.lastVisitDate = order.createdDate;
          item.latestPackage = order.packageName || item.latestPackage;
          item.latestBay = order.bayId;
        }
      }
    }

    // Finalize metrics & flags
    const list = Array.from(map.values()).map((c) => {
      // Sort orders desc
      c.orders.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());

      c.averageSpend = c.totalVisits > 0 ? c.totalSpend / c.totalVisits : 0;
      c.isRepeat = c.totalVisits >= 2;
      c.isVIP = c.totalVisits >= 3;

      // Determine most frequent pay mode
      const payCounts: Record<string, number> = {};
      c.orders.forEach((o) => {
        const p = (o.payMode || 'CASH').trim().toUpperCase();
        payCounts[p] = (payCounts[p] || 0) + 1;
      });
      let maxP = 'CASH';
      let maxCnt = 0;
      Object.entries(payCounts).forEach(([k, v]) => {
        if (v > maxCnt) {
          maxCnt = v;
          maxP = k;
        }
      });
      c.preferredPayMode = maxP;

      return c;
    });

    // Default sort: highest spend, then most visits
    list.sort((a, b) => b.totalSpend - a.totalSpend || b.totalVisits - a.totalVisits);
    return list;
  }, [periodFilteredOrders]);

  // Search Filtering
  const filteredCustomers = useMemo(() => {
    let list = customerProfiles;
    if (activeTab === 'REPEAT_CUSTOMERS') {
      list = list.filter((c) => c.isRepeat);
    }

    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;

    return list.filter((c) => {
      const matchName = c.customerName.toLowerCase().includes(q);
      const matchMobile = c.mobileNumber.toLowerCase().includes(q);
      const matchVehicle = c.vehicles.some((v) => v.plate.toLowerCase().includes(q));
      const matchOrder = c.orders.some((o) => String(o.orderNo || '').toLowerCase().includes(q));
      return matchName || matchMobile || matchVehicle || matchOrder;
    });
  }, [customerProfiles, activeTab, searchTerm]);

  // Filtered Washes (for ALL_WASHES view)
  const filteredWashes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return periodFilteredOrders;

    return periodFilteredOrders.filter((o) => {
      const matchOrderNo = String(o.orderNo || '').toLowerCase().includes(q);
      const matchName = String(o.customerName || '').toLowerCase().includes(q);
      const matchPlate = String(o.vehicleNumber || '').toLowerCase().includes(q);
      const matchPhone = String(o.mobileNumber || '').toLowerCase().includes(q);
      const matchPackage = String(o.packageName || '').toLowerCase().includes(q);
      return matchOrderNo || matchName || matchPlate || matchPhone || matchPackage;
    });
  }, [periodFilteredOrders, searchTerm]);

  // Global KPIs across current dataset
  const totalCustomersCount = customerProfiles.length;
  const totalWashesCount = periodFilteredOrders.length;
  const totalRevenue = customerProfiles.reduce((acc, c) => acc + c.totalSpend, 0);
  const repeatCustomerCount = customerProfiles.filter((c) => c.isRepeat).length;
  const repeatRate = totalCustomersCount > 0 ? ((repeatCustomerCount / totalCustomersCount) * 100).toFixed(0) : '0';
  const averageCustomerSpend = totalCustomersCount > 0 ? totalRevenue / totalCustomersCount : 0;

  // View Customer History
  const handleOpenCustomerModal = (customer: CustomerProfileSummary) => {
    setSelectedCustomer(customer);
    setCustomerModalVisible(true);
  };

  // View Order Details
  const handleOpenOrderDetails = async (order: ApiOrder) => {
    setSelectedOrder(order);
    setOrderModalVisible(true);
    setLoadingOrderHistory(true);
    try {
      const trail = await fetchCarWashOrderHistory(order.orderId);
      setOrderHistoryTrail(trail || []);
    } catch (err) {
      console.warn('Failed to load status history trail:', err);
      setOrderHistoryTrail([]);
    } finally {
      setLoadingOrderHistory(false);
    }
  };

  const getStatusBadgeStyle = (statusCode?: number | null, paymentStatus?: string | null) => {
    if (statusCode === 70 || statusCode === 60) {
      return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', label: statusCode === 70 ? 'CLOSED' : 'COMPLETED' };
    }
    if (statusCode === 50) {
      return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'IN SERVICE' };
    }
    if (statusCode === 40 || statusCode === 30) {
      return { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE', label: 'PAID / QUEUE' };
    }
    if (statusCode === 80) {
      return { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA', label: 'CANCELLED' };
    }
    if (paymentStatus === 'PAID') {
      return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', label: 'PAID' };
    }
    return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', label: 'PENDING' };
  };

  const getPayModeStyle = (mode?: string | null) => {
    const m = (mode || 'CASH').trim().toUpperCase();
    switch (m) {
      case 'CASH':
        return { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' };
      case 'PAYNOW':
        return { bg: '#FDF2F8', text: '#DB2777', border: '#FBCFE8' };
      case 'MEMBER':
        return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
      case 'CREDIT':
        return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
      case 'CARD':
        return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      default:
        return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. TOP HEADER & METRIC SCORECARDS */}
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={styles.titleWithIcon}>
            <View style={styles.headerIconBox}>
              <Ionicons name="people" size={22} color="#ED0712" />
            </View>
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.pageTitle}>Customer History</Text>
                <View style={styles.liveBadge}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.liveBadgeText}>LIVE DIRECTORY</Text>
                </View>
              </View>
              <Text style={styles.pageSubtitle}>
                Lifetime car wash records, vehicle history, customer loyalty & spend logs
              </Text>
            </View>
          </View>

          {/* Right Header Actions */}
          <View style={styles.headerActionsRight}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => loadOrders(true)}
              activeOpacity={0.8}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <Feather name="refresh-cw" size={14} color="#0F172A" />
              )}
              <Text style={styles.refreshBtnText}>SYNC RECORDS</Text>
            </TouchableOpacity>

            {onBackToOrders && (
              <TouchableOpacity
                style={styles.backOrdersBtn}
                onPress={onBackToOrders}
                activeOpacity={0.8}
              >
                <Ionicons name="car-outline" size={15} color="#FFFFFF" />
                <Text style={styles.backOrdersBtnText}>ACTIVE ORDERS</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 2. FOUR KPI SCORECARDS */}
        <View style={styles.kpiGrid}>
          {/* Card 1: Total Unique Customers */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>TOTAL CUSTOMERS</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="people-outline" size={16} color="#2563EB" />
              </View>
            </View>
            <Text style={styles.kpiValue}>{totalCustomersCount}</Text>
            <Text style={styles.kpiFootnote}>Distinct customer profiles on record</Text>
          </View>

          {/* Card 2: Total Completed Washes */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>LIFETIME WASHES</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="water-outline" size={16} color="#059669" />
              </View>
            </View>
            <Text style={styles.kpiValue}>{totalWashesCount}</Text>
            <Text style={styles.kpiFootnote}>Total customer wash orders logged</Text>
          </View>

          {/* Card 3: Total Reconciled Revenue */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>LIFETIME SPEND</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#FFFBEB' }]}>
                <Ionicons name="cash-outline" size={16} color="#D97706" />
              </View>
            </View>
            <Text style={styles.kpiValue}>{formatCurrency(totalRevenue)}</Text>
            <Text style={styles.kpiFootnote}>Avg {formatCurrency(averageCustomerSpend)} per customer</Text>
          </View>

          {/* Card 4: Repeat Customer Loyalty */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>REPEAT CUSTOMERS</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="repeat-outline" size={16} color="#ED0712" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={styles.kpiValue}>{repeatCustomerCount}</Text>
              <Text style={styles.kpiValueSub}>({repeatRate}%)</Text>
            </View>
            <Text style={styles.kpiFootnote}>Customers with 2+ car wash visits</Text>
          </View>
        </View>
      </View>

      {/* 3. CONTROLS BAR: SEARCH & TABS */}
      <View style={styles.controlsBar}>
        {/* Navigation Tabs */}
        <View style={styles.tabGroup}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'ALL_CUSTOMERS' && styles.tabButtonActive]}
            onPress={() => setActiveTab('ALL_CUSTOMERS')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="people-outline"
              size={15}
              color={activeTab === 'ALL_CUSTOMERS' ? '#FFFFFF' : '#475569'}
            />
            <Text
              style={[styles.tabButtonText, activeTab === 'ALL_CUSTOMERS' && styles.tabButtonTextActive]}
            >
              All Customers ({customerProfiles.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'REPEAT_CUSTOMERS' && styles.tabButtonActive]}
            onPress={() => setActiveTab('REPEAT_CUSTOMERS')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="star-outline"
              size={15}
              color={activeTab === 'REPEAT_CUSTOMERS' ? '#FFFFFF' : '#475569'}
            />
            <Text
              style={[styles.tabButtonText, activeTab === 'REPEAT_CUSTOMERS' && styles.tabButtonTextActive]}
            >
              Repeat / VIP ({repeatCustomerCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'ALL_WASHES' && styles.tabButtonActive]}
            onPress={() => setActiveTab('ALL_WASHES')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="receipt-outline"
              size={15}
              color={activeTab === 'ALL_WASHES' ? '#FFFFFF' : '#475569'}
            />
            <Text
              style={[styles.tabButtonText, activeTab === 'ALL_WASHES' && styles.tabButtonTextActive]}
            >
              All Wash Records ({periodFilteredOrders.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Right Search Box & Period Filter */}
        <View style={styles.searchAndPeriodWrap}>
          {/* Search Input */}
          <View style={styles.searchInputWrap}>
            <Feather name="search" size={15} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by customer, phone, plate..."
              placeholderTextColor="#94A3B8"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={14} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          {/* Period Filter Pills */}
          <View style={styles.periodPillGroup}>
            {(['ALL', 'THIS_MONTH', 'THIS_WEEK', 'TODAY'] as PeriodFilter[]).map((p) => {
              const isActive = periodFilter === p;
              const labelMap: Record<PeriodFilter, string> = {
                ALL: 'All Time',
                THIS_MONTH: 'Month',
                THIS_WEEK: '7 Days',
                TODAY: 'Today',
              };
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodPill, isActive && styles.periodPillActive]}
                  onPress={() => setPeriodFilter(p)}
                >
                  <Text style={[styles.periodPillText, isActive && styles.periodPillTextActive]}>
                    {labelMap[p]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* 4. MAIN CONTENT LIST / TABLE */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#ED0712" />
          <Text style={styles.loadingText}>Loading customer records & wash history...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={32} color="#DC2626" />
          <Text style={styles.errorTitle}>Could not load customer history</Text>
          <Text style={styles.errorSubtitle}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadOrders(false)}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : activeTab === 'ALL_WASHES' ? (
        /* ================= ALL WASH ORDERS LEDGER TABLE ================= */
        <View style={styles.tableCard}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, { width: 85 }]}>ORDER NO</Text>
            <Text style={[styles.th, { flex: 1.4 }]}>CUSTOMER</Text>
            <Text style={[styles.th, { flex: 1.1 }]}>VEHICLE</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>PACKAGE</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>DATE & TIME</Text>
            <Text style={[styles.th, { width: 95 }]}>AMOUNT</Text>
            <Text style={[styles.th, { width: 95 }]}>PAYMENT</Text>
            <Text style={[styles.th, { width: 75 }]}>BAY</Text>
            <Text style={[styles.th, { width: 95 }]}>STATUS</Text>
            <Text style={[styles.th, { width: 80, textAlign: 'center' }]}>ACTION</Text>
          </View>

          <ScrollView style={styles.tableScrollView} showsVerticalScrollIndicator>
            {filteredWashes.length === 0 ? (
              <View style={styles.emptyTableBox}>
                <Ionicons name="search-outline" size={36} color="#CBD5E1" />
                <Text style={styles.emptyTableTitle}>No wash records found</Text>
                <Text style={styles.emptyTableSubtitle}>
                  {searchTerm ? `No results matching "${searchTerm}"` : 'No orders recorded for this period'}
                </Text>
              </View>
            ) : (
              filteredWashes.map((order, idx) => {
                const statusStyle = getStatusBadgeStyle(order.statusCode, order.paymentStatus);
                const payStyle = getPayModeStyle(order.payMode);
                const avatarStyle = getAvatarStyle(order.customerName || 'Walk-in');

                return (
                  <View
                    key={order.orderId || idx}
                    style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                  >
                    {/* Order No */}
                    <View style={{ width: 85 }}>
                      <View style={styles.orderPill}>
                        <Text style={styles.orderPillText}>#{order.orderNo || '0000'}</Text>
                      </View>
                    </View>

                    {/* Customer */}
                    <View style={{ flex: 1.4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={[
                          styles.tableMiniAvatar,
                          { backgroundColor: avatarStyle.bg, borderColor: avatarStyle.border },
                        ]}
                      >
                        <Text style={[styles.tableMiniAvatarText, { color: avatarStyle.text }]}>
                          {getInitials(order.customerName || 'Walk-in')}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tableCustomerName} numberOfLines={1}>
                          {order.customerName || 'Walk-in Customer'}
                        </Text>
                        <Text style={styles.tableCustomerPhone}>
                          {order.mobileNumber ? `📞 ${order.mobileNumber}` : 'Walk-in'}
                        </Text>
                      </View>
                    </View>

                    {/* Vehicle */}
                    <View style={{ flex: 1.1 }}>
                      <View style={styles.plateBadge}>
                        <Text style={styles.plateBadgeText}>
                          {order.vehicleNumber || 'WALK-IN'}
                        </Text>
                      </View>
                      <Text style={styles.vehicleTypeSub}>{order.vehicleTypeName || 'Car'}</Text>
                    </View>

                    {/* Package */}
                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.tablePackageName} numberOfLines={1}>
                        {order.packageName || 'Wash Service'}
                      </Text>
                      <Text style={styles.tablePackageCat}>
                        {order.serviceCategoryName || 'Car Wash'}
                      </Text>
                    </View>

                    {/* Date & Time */}
                    <View style={{ flex: 1.2 }}>
                      <Text style={styles.tableDateText}>{formatShortDate(order.createdDate)}</Text>
                      <Text style={styles.tableTimeSub}>
                        {new Date(order.createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    {/* Amount */}
                    <View style={{ width: 95 }}>
                      <Text style={styles.tableAmountText}>{formatCurrency(order.totalAmount)}</Text>
                      <Text style={styles.tableGstSub}>incl. GST</Text>
                    </View>

                    {/* Payment Mode */}
                    <View style={{ width: 95 }}>
                      <View
                        style={[
                          styles.payModePill,
                          { backgroundColor: payStyle.bg, borderColor: payStyle.border },
                        ]}
                      >
                        <Text style={[styles.payModeText, { color: payStyle.text }]}>
                          {(order.payMode || 'CASH').trim().toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {/* Bay */}
                    <View style={{ width: 75 }}>
                      {order.bayId ? (
                        <View style={styles.bayPill}>
                          <Ionicons name="water" size={11} color="#2563EB" />
                          <Text style={styles.bayPillText}>Bay {order.bayId}</Text>
                        </View>
                      ) : (
                        <Text style={styles.noBayText}>Unassigned</Text>
                      )}
                    </View>

                    {/* Status */}
                    <View style={{ width: 95 }}>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
                        ]}
                      >
                        <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                          {statusStyle.label}
                        </Text>
                      </View>
                    </View>

                    {/* Action */}
                    <View style={{ width: 80, alignItems: 'center' }}>
                      <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => handleOpenOrderDetails(order)}
                        activeOpacity={0.8}
                      >
                        <Feather name="eye" size={12} color="#0284C7" />
                        <Text style={styles.viewBtnText}>View</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : (
        /* ================= CUSTOMER PROFILES DIRECTORY VIEW ================= */
        <ScrollView style={styles.cardsScrollView} showsVerticalScrollIndicator>
          {filteredCustomers.length === 0 ? (
            <View style={styles.emptyTableBox}>
              <Ionicons name="people-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyTableTitle}>No customers found</Text>
              <Text style={styles.emptyTableSubtitle}>
                {searchTerm ? `No customer profiles matching "${searchTerm}"` : 'No customers recorded yet'}
              </Text>
            </View>
          ) : (
            <View style={styles.customerGrid}>
              {filteredCustomers.map((cust) => {
                const avatarStyle = getAvatarStyle(cust.customerName);
                const payStyle = getPayModeStyle(cust.preferredPayMode);

                return (
                  <View key={cust.customerKey} style={styles.customerCard}>
                    {/* Top Customer Info Row */}
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <View
                          style={[
                            styles.avatarBox,
                            { backgroundColor: avatarStyle.bg, borderColor: avatarStyle.border },
                          ]}
                        >
                          <Text style={[styles.avatarText, { color: avatarStyle.text }]}>
                            {getInitials(cust.customerName)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={styles.cardCustomerName} numberOfLines={1}>
                              {cust.customerName}
                            </Text>
                            {cust.isVIP ? (
                              <View style={styles.vipBadge}>
                                <Ionicons name="star" size={10} color="#B45309" />
                                <Text style={styles.vipBadgeText}>VIP LOYAL</Text>
                              </View>
                            ) : cust.isRepeat ? (
                              <View style={styles.repeatBadge}>
                                <Ionicons name="repeat" size={10} color="#1D4ED8" />
                                <Text style={styles.repeatBadgeText}>REPEAT</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.cardCustomerPhone}>
                            {cust.mobileNumber ? `📞 ${cust.mobileNumber}` : '👤 Walk-in Customer'}
                          </Text>
                        </View>
                      </View>

                      {/* Total Visits Pill */}
                      <View style={styles.visitsBadge}>
                        <Text style={styles.visitsBadgeCount}>{cust.totalVisits}</Text>
                        <Text style={styles.visitsBadgeLabel}>
                          {cust.totalVisits === 1 ? 'wash' : 'washes'}
                        </Text>
                      </View>
                    </View>

                    {/* Spend & Frequency Metrics */}
                    <View style={styles.cardMetricsRow}>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>TOTAL SPENT</Text>
                        <Text style={styles.metricValuePrimary}>{formatCurrency(cust.totalSpend)}</Text>
                      </View>
                      <View style={styles.metricDivider} />
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>AVG CHECK</Text>
                        <Text style={styles.metricValue}>{formatCurrency(cust.averageSpend)}</Text>
                      </View>
                      <View style={styles.metricDivider} />
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>LAST VISIT</Text>
                        <Text style={styles.metricValue}>{formatShortDate(cust.lastVisitDate)}</Text>
                      </View>
                    </View>

                    {/* Vehicle Plates Associated */}
                    <View style={styles.vehicleSection}>
                      <Text style={styles.sectionMiniLabel}>REGISTERED VEHICLES ({cust.vehicles.length})</Text>
                      <View style={styles.plateBadgeList}>
                        {cust.vehicles.map((v, i) => (
                          <View key={i} style={styles.custPlateBadge}>
                            <Ionicons name="car-sport" size={12} color="#0F172A" />
                            <Text style={styles.custPlateText}>{v.plate}</Text>
                            <Text style={styles.custPlateType}>• {v.type}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Footer Info & Action */}
                    <View style={styles.cardFooter}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.footerServiceLabel}>LATEST SERVICE</Text>
                        <Text style={styles.footerServiceName} numberOfLines={1}>
                          {cust.latestPackage}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.openHistoryBtn}
                        onPress={() => handleOpenCustomerModal(cust)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="time-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.openHistoryBtnText}>Wash History ›</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ================= MODAL 1: CUSTOMER COMPLETE HISTORY MODAL ================= */}
      <Modal
        visible={customerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customerHistoryModalCard}>
            {selectedCustomer && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={[
                        styles.modalAvatarBox,
                        {
                          backgroundColor: getAvatarStyle(selectedCustomer.customerName).bg,
                          borderColor: getAvatarStyle(selectedCustomer.customerName).border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalAvatarText,
                          { color: getAvatarStyle(selectedCustomer.customerName).text },
                        ]}
                      >
                        {getInitials(selectedCustomer.customerName)}
                      </Text>
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.modalCustomerTitle}>
                          {selectedCustomer.customerName}
                        </Text>
                        {selectedCustomer.isVIP && (
                          <View style={styles.vipBadge}>
                            <Ionicons name="star" size={10} color="#B45309" />
                            <Text style={styles.vipBadgeText}>VIP CUSTOMER</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.modalCustomerSubtitle}>
                        {selectedCustomer.mobileNumber
                          ? `Phone: ${selectedCustomer.mobileNumber}`
                          : 'Walk-in Customer'}{' '}
                        • Total {selectedCustomer.totalVisits} Wash Visits
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setCustomerModalVisible(false)}
                  >
                    <Feather name="x" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Customer Summary Highlight Bar */}
                <View style={styles.customerSummaryBar}>
                  <View style={styles.customerStatBox}>
                    <Text style={styles.custStatLabel}>TOTAL WASHES</Text>
                    <Text style={styles.custStatValue}>{selectedCustomer.totalVisits}</Text>
                  </View>
                  <View style={styles.custStatDivider} />
                  <View style={styles.customerStatBox}>
                    <Text style={styles.custStatLabel}>TOTAL SPENT</Text>
                    <Text style={[styles.custStatValue, { color: '#ED0712' }]}>
                      {formatCurrency(selectedCustomer.totalSpend)}
                    </Text>
                  </View>
                  <View style={styles.custStatDivider} />
                  <View style={styles.customerStatBox}>
                    <Text style={styles.custStatLabel}>AVG CHECK (AOV)</Text>
                    <Text style={styles.custStatValue}>
                      {formatCurrency(selectedCustomer.averageSpend)}
                    </Text>
                  </View>
                  <View style={styles.custStatDivider} />
                  <View style={styles.customerStatBox}>
                    <Text style={styles.custStatLabel}>PREFERRED PAY</Text>
                    <Text style={styles.custStatValue}>
                      {selectedCustomer.preferredPayMode}
                    </Text>
                  </View>
                </View>

                {/* Wash History Timeline Title */}
                <View style={styles.timelineHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="calendar-outline" size={16} color="#ED0712" />
                    <Text style={styles.timelineTitle}>
                      Chronological Car Wash History ({selectedCustomer.orders.length} orders)
                    </Text>
                  </View>
                  <Text style={styles.timelineSub}>Sorted from newest to oldest</Text>
                </View>

                {/* Orders Timeline List */}
                <ScrollView style={styles.timelineScrollView} showsVerticalScrollIndicator>
                  {selectedCustomer.orders.map((order, idx) => {
                    const statusStyle = getStatusBadgeStyle(order.statusCode, order.paymentStatus);
                    const payStyle = getPayModeStyle(order.payMode);

                    return (
                      <View key={order.orderId || idx} style={styles.timelineEntry}>
                        {/* Left Track & Icon */}
                        <View style={styles.timelineLeftTrack}>
                          <View style={styles.timelineNodeDot}>
                            <Ionicons name="car-outline" size={12} color="#FFFFFF" />
                          </View>
                          {idx < selectedCustomer.orders.length - 1 && (
                            <View style={styles.timelineConnectingLine} />
                          )}
                        </View>

                        {/* Order History Details Card */}
                        <View style={styles.timelineCard}>
                          <View style={styles.timelineTopRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={styles.orderPill}>
                                <Text style={styles.orderPillText}>#{order.orderNo || '0000'}</Text>
                              </View>
                              <Text style={styles.timelineDateTime}>
                                {formatDateTime(order.createdDate)}
                              </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View
                                style={[
                                  styles.statusBadge,
                                  {
                                    backgroundColor: statusStyle.bg,
                                    borderColor: statusStyle.border,
                                  },
                                ]}
                              >
                                <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                                  {statusStyle.label}
                                </Text>
                              </View>

                              <TouchableOpacity
                                style={styles.inspectBtn}
                                onPress={() => handleOpenOrderDetails(order)}
                              >
                                <Feather name="eye" size={12} color="#0F172A" />
                                <Text style={styles.inspectBtnText}>Details</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Order Core Info */}
                          <View style={styles.timelineDetailsGrid}>
                            <View style={styles.timelineDetailCol}>
                              <Text style={styles.timelineLabel}>VEHICLE</Text>
                              <View style={styles.plateBadgeMini}>
                                <Text style={styles.plateBadgeMiniText}>
                                  {order.vehicleNumber || 'WALK-IN'}
                                </Text>
                              </View>
                              <Text style={styles.timelineSubText}>
                                {order.vehicleTypeName || 'Sedan'}
                              </Text>
                            </View>

                            <View style={[styles.timelineDetailCol, { flex: 1.5 }]}>
                              <Text style={styles.timelineLabel}>PACKAGE & SERVICE</Text>
                              <Text style={styles.timelineValueBold} numberOfLines={1}>
                                {order.packageName || 'Wash Service'}
                              </Text>
                              <Text style={styles.timelineSubText}>
                                {order.serviceCategoryName || 'Car Wash'}{' '}
                                {order.durationMinutes ? `• ~${order.durationMinutes} min` : ''}
                              </Text>
                            </View>

                            <View style={styles.timelineDetailCol}>
                              <Text style={styles.timelineLabel}>BAY</Text>
                              <Text style={styles.timelineValueBold}>
                                {order.bayId ? `Bay ${order.bayId}` : 'Unassigned'}
                              </Text>
                              <Text style={styles.timelineSubText}>
                                {order.bayStatus || 'Completed'}
                              </Text>
                            </View>

                            <View style={styles.timelineDetailCol}>
                              <Text style={styles.timelineLabel}>PAYMENT</Text>
                              <View
                                style={[
                                  styles.payModePillMini,
                                  {
                                    backgroundColor: payStyle.bg,
                                    borderColor: payStyle.border,
                                  },
                                ]}
                              >
                                <Text style={[styles.payModeTextMini, { color: payStyle.text }]}>
                                  {(order.payMode || 'CASH').trim().toUpperCase()}
                                </Text>
                              </View>
                              <Text style={styles.timelinePriceText}>
                                {formatCurrency(order.totalAmount)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 2: ORDER DETAILS INSPECTOR ================= */}
      <Modal
        visible={orderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOrderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.orderDetailsModalCard}>
            {selectedOrder && (
              <>
                {/* Header */}
                <View style={styles.modalHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.orderNumberBigPill}>
                      <Text style={styles.orderNumberBigText}>
                        #{selectedOrder.orderNo || '0000'}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.modalCustomerTitle}>Order #{selectedOrder.orderNo}</Text>
                      <Text style={styles.modalCustomerSubtitle}>
                        Created: {formatDateTime(selectedOrder.createdDate)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setOrderModalVisible(false)}
                  >
                    <Feather name="x" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator>
                  {/* Key Stats Bar */}
                  <View style={styles.orderKeyBar}>
                    <View style={styles.orderKeyCol}>
                      <Text style={styles.orderKeyLabel}>CUSTOMER</Text>
                      <Text style={styles.orderKeyVal}>
                        {selectedOrder.customerName || 'Walk-in'}
                      </Text>
                      <Text style={styles.orderKeySub}>
                        {selectedOrder.mobileNumber ? `📞 ${selectedOrder.mobileNumber}` : 'No phone'}
                      </Text>
                    </View>
                    <View style={styles.orderKeyCol}>
                      <Text style={styles.orderKeyLabel}>VEHICLE</Text>
                      <Text style={styles.orderKeyVal}>
                        {selectedOrder.vehicleNumber || 'WALK-IN'}
                      </Text>
                      <Text style={styles.orderKeySub}>
                        {selectedOrder.vehicleTypeName || 'Car'}
                      </Text>
                    </View>
                    <View style={styles.orderKeyCol}>
                      <Text style={styles.orderKeyLabel}>BAY</Text>
                      <Text style={styles.orderKeyVal}>
                        {selectedOrder.bayId ? `Bay ${selectedOrder.bayId}` : 'Unassigned'}
                      </Text>
                      <Text style={styles.orderKeySub}>
                        {selectedOrder.bayStatus || 'Available'}
                      </Text>
                    </View>
                    <View style={styles.orderKeyCol}>
                      <Text style={styles.orderKeyLabel}>TOTAL PAID</Text>
                      <Text style={[styles.orderKeyVal, { color: '#ED0712' }]}>
                        {formatCurrency(selectedOrder.totalAmount)}
                      </Text>
                      <Text style={styles.orderKeySub}>
                        via {(selectedOrder.payMode || 'CASH').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Financial Breakdown Card */}
                  <View style={styles.priceBreakdownCard}>
                    <Text style={styles.sectionHeaderTitle}>Pricing & Tax Breakdown</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>
                        {selectedOrder.packageName || 'Package Service'}
                      </Text>
                      <Text style={styles.priceVal}>
                        {formatCurrency(selectedOrder.packagePrice || selectedOrder.totalAmount)}
                      </Text>
                    </View>
                    {selectedOrder.gstAmount != null && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>GST ({selectedOrder.gstPercent || 9}%)</Text>
                        <Text style={styles.priceVal}>{formatCurrency(selectedOrder.gstAmount)}</Text>
                      </View>
                    )}
                    <View style={styles.priceDivider} />
                    <View style={styles.priceRow}>
                      <Text style={styles.priceTotalLabel}>Total Settled Amount</Text>
                      <Text style={styles.priceTotalVal}>
                        {formatCurrency(selectedOrder.totalAmount)}
                      </Text>
                    </View>
                  </View>

                  {/* Audit Trail / Lifecycle */}
                  <View style={styles.auditSection}>
                    <Text style={styles.sectionHeaderTitle}>Order Status Audit Trail</Text>
                    {loadingOrderHistory ? (
                      <ActivityIndicator size="small" color="#ED0712" style={{ marginVertical: 14 }} />
                    ) : orderHistoryTrail.length === 0 ? (
                      <Text style={styles.noHistoryText}>No status transition logs recorded</Text>
                    ) : (
                      <View style={styles.trailList}>
                        {orderHistoryTrail.map((h, i) => (
                          <View key={h.historyId || i} style={styles.trailItem}>
                            <View style={styles.trailDot} />
                            <View style={{ flex: 1 }}>
                              <View style={styles.trailTopRow}>
                                <Text style={styles.trailStatusName}>
                                  {h.newStatusName || `Code ${h.newStatusCode}`}
                                </Text>
                                <Text style={styles.trailTime}>
                                  {formatDateTime(h.changedDate)}
                                </Text>
                              </View>
                              <Text style={styles.trailRemarks}>
                                {h.remarks || 'Status update logged'} • By {h.changedBy || 'System'}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    backgroundColor: '#F8FAFC',
  },

  /* HEADER & KPI SCORECARDS */
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' } as any)
      : { elevation: 2 }),
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    flexWrap: 'wrap',
    gap: 12,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ED0712',
  },
  liveBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#ED0712',
    letterSpacing: 0.5,
  },
  pageSubtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  headerActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  backOrdersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ED0712',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  backOrdersBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  /* KPI GRID */
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 170,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  kpiIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  kpiValueSub: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  kpiFootnote: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 3,
  },

  /* CONTROLS BAR */
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  tabGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#0F172A',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  searchAndPeriodWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    height: 36,
    width: 260,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  periodPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 2,
  },
  periodPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  periodPillActive: {
    backgroundColor: '#FEF2F2',
  },
  periodPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  periodPillTextActive: {
    color: '#ED0712',
    fontWeight: '800',
  },

  /* LOADING & ERROR */
  loadingBox: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  errorBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991B1B',
    marginTop: 8,
  },
  errorSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
    marginTop: 2,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 14,
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* CUSTOMER GRID & CARDS */
  cardsScrollView: {
    flex: 1,
  },
  customerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingBottom: 40,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: 'calc(33.333% - 10px)' as any,
    minWidth: 310,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)' } as any)
      : { elevation: 1 }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardCustomerName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardCustomerPhone: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  vipBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 0.3,
  },
  repeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  repeatBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1E40AF',
    letterSpacing: 0.3,
  },
  visitsBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  visitsBadgeCount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  visitsBadgeLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },

  /* Card Metrics Row */
  cardMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  metricValuePrimary: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#ED0712',
    marginTop: 1,
  },

  /* Vehicles Section */
  vehicleSection: {
    marginBottom: 12,
  },
  sectionMiniLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  plateBadgeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  custPlateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  custPlateText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  custPlateType: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },

  /* Card Footer */
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  footerServiceLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  footerServiceName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginTop: 1,
  },
  openHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ED0712',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
  },
  openHistoryBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* ALL WASHES TABLE */
  tableCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)' } as any)
      : { elevation: 1 }),
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  th: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  tableScrollView: {
    maxHeight: 520,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowAlt: {
    backgroundColor: '#FAFCFF',
  },
  orderPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orderPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0F172A',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  tableMiniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableMiniAvatarText: {
    fontSize: 10,
    fontWeight: '900',
  },
  tableCustomerName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  tableCustomerPhone: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  plateBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  plateBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  vehicleTypeSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  tablePackageName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  tablePackageCat: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  tableDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  tableTimeSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  tableAmountText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  tableGstSub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
  },
  payModePill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  payModeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  bayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  bayPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  noBayText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  viewBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0284C7',
  },
  emptyTableBox: {
    padding: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTableTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 8,
  },
  emptyTableSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },

  /* MODALS */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  customerHistoryModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    maxWidth: 780,
    maxHeight: '90%',
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)' } as any)
      : { elevation: 10 }),
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarText: {
    fontSize: 16,
    fontWeight: '900',
  },
  modalCustomerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalCustomerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customerStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  custStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  custStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  custStatValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  timelineScrollView: {
    maxHeight: 400,
    paddingRight: 6,
  },
  timelineEntry: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineLeftTrack: {
    width: 24,
    alignItems: 'center',
    marginRight: 10,
  },
  timelineNodeDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ED0712',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineConnectingLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#FEE2E2',
    marginVertical: 2,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  timelineDateTime: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  inspectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inspectBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineDetailsGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  timelineDetailCol: {
    flex: 1,
    minWidth: 110,
  },
  timelineLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  plateBadgeMini: {
    backgroundColor: '#0F172A',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  plateBadgeMiniText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  timelineValueBold: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineSubText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  payModePillMini: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  payModeTextMini: {
    fontSize: 9,
    fontWeight: '800',
  },
  timelinePriceText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ED0712',
    marginTop: 2,
  },

  /* ORDER DETAILS MODAL */
  orderDetailsModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)' } as any)
      : { elevation: 10 }),
  },
  orderNumberBigPill: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  orderNumberBigText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ED0712',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  orderKeyBar: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  orderKeyCol: {
    flex: 1,
  },
  orderKeyLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  orderKeyVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  orderKeySub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  priceBreakdownCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  priceVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },
  priceTotalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  priceTotalVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ED0712',
  },
  auditSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noHistoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  trailList: {
    gap: 10,
  },
  trailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  trailDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ED0712',
    marginTop: 4,
  },
  trailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trailStatusName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  trailTime: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  trailRemarks: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
});
