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
  useWindowDimensions,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import {
  fetchCarWashOrders,
  fetchCarWashOrderHistory,
  ApiOrder,
  OrderStatusHistoryItem,
} from '../../../services/carwashOrderApi';
import { formatSgDate, formatSgTime, formatSgDateTime } from '../../../services/timeService';

export interface PosCustomerHistoryViewProps {
  cashierName?: string;
  onBackToOrders?: () => void;
  onToggleSidebar?: () => void;
  searchQuery?: string;
  refreshTrigger?: number;
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
  isVIP?: boolean;
  isRepeat: boolean;
  isDealer: boolean;
  dealerId?: number | null;
  accountType: 'CUSTOMER' | 'DEALER';
}

export const isDealerOrder = (order: ApiOrder): boolean => {
  return Boolean(
    order.dealerId != null ||
    (order as any).DealerId != null ||
    (order.payMode && order.payMode.trim().toUpperCase() === 'CREDIT') ||
    order.paymentStatus === 'CREDIT' ||
    (order as any).isDealer ||
    (order.vehicleNumber && (order.vehicleNumber.includes('DLR-') || order.vehicleNumber.includes('FLEET'))) ||
    (order.customerName && (order.customerName.toUpperCase() === 'UNIPRO' || order.customerName.toUpperCase().includes('DEALER')))
  );
};

type TabMode = 'CUSTOMERS' | 'DEALERS' | 'ALL_CUSTOMERS' | 'REPEAT_CUSTOMERS' | 'ALL_WASHES';
type PeriodFilter = 'ALL' | 'YEARLY' | 'MONTHLY' | 'WEEKLY' | 'TODAY';

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
  return formatSgDateTime(dateStr);
}

function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  return formatSgDate(dateStr, {
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
  refreshTrigger,
}) => {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadOrders(true);
    }
  }, [refreshTrigger]);

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

  // Filter orders by period: Today, Weekly, Monthly, Yearly, All Time
  const periodFilteredOrders = useMemo(() => {
    if (periodFilter === 'ALL') return orders;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();

    // Start of Today (00:00:00)
    const startOfToday = new Date(currentYear, currentMonth, currentDate, 0, 0, 0, 0);

    // Weekly: Monday of current week or rolling 7 days
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const startOfWeek = new Date(currentYear, currentMonth, currentDate - dayOfWeek, 0, 0, 0, 0);
    const rolling7DaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    rolling7DaysAgo.setHours(0, 0, 0, 0);

    // Monthly: 1st day of current month
    const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);

    // Yearly: Jan 1st of current year
    const startOfYear = new Date(currentYear, 0, 1, 0, 0, 0, 0);

    return orders.filter((o) => {
      if (!o.createdDate) return true;
      const orderDate = new Date(o.createdDate);
      if (isNaN(orderDate.getTime())) return true;

      if (periodFilter === 'TODAY') {
        const isSameDay = (
          orderDate.getFullYear() === currentYear &&
          orderDate.getMonth() === currentMonth &&
          orderDate.getDate() === currentDate
        );
        const isWithin24Hours = (now.getTime() - orderDate.getTime()) <= 24 * 60 * 60 * 1000 && (now.getTime() - orderDate.getTime()) >= 0;
        return isSameDay || isWithin24Hours;
      }

      if (periodFilter === 'WEEKLY') {
        return orderDate >= startOfWeek || orderDate >= rolling7DaysAgo;
      }

      if (periodFilter === 'MONTHLY') {
        return (
          (orderDate.getFullYear() === currentYear && orderDate.getMonth() === currentMonth) ||
          orderDate >= startOfMonth
        );
      }

      if (periodFilter === 'YEARLY') {
        return orderDate.getFullYear() === currentYear || orderDate >= startOfYear;
      }

      return true;
    });
  }, [orders, periodFilter]);

  // Aggregate into Customer / Dealer Profiles
  const customerProfiles = useMemo<CustomerProfileSummary[]>(() => {
    const map = new Map<string, CustomerProfileSummary>();

    for (const order of periodFilteredOrders) {
      const isDealer = isDealerOrder(order);
      const rawName = (order.customerName || (isDealer ? 'Dealer Account' : 'Walk-in Customer')).trim();
      const rawMobile = (order.mobileNumber || '').trim();

      // For dealers: group by dealerId or dealer name so all fleet vehicles/washes group together
      // For retail customers: group by name + mobile
      const key = isDealer
        ? `dealer::${order.dealerId ? String(order.dealerId) : rawName.toLowerCase()}`
        : `customer::${rawName.toLowerCase()}::${rawMobile}`;

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
              plate: order.vehicleNumber || (isDealer ? 'DLR-FLEET' : 'WALK-IN'),
              type: order.vehicleTypeName || 'Sedan',
              count: 1,
            },
          ],
          lastVisitDate: order.createdDate,
          latestPackage: order.packageName || 'Wash Service',
          latestBay: order.bayId,
          preferredPayMode: isDealer ? 'CREDIT' : (order.payMode || 'CASH').trim().toUpperCase(),
          isVIP: false,
          isRepeat: false,
          isDealer,
          dealerId: order.dealerId || ((order as any).DealerId ?? null),
          accountType: isDealer ? 'DEALER' : 'CUSTOMER',
        });
      } else {
        const item = map.get(key)!;
        item.orders.push(order);
        item.totalVisits += 1;
        item.totalSpend += Number(order.totalAmount || 0);

        if (isDealer) {
          item.isDealer = true;
          item.accountType = 'DEALER';
        }

        // Update vehicle frequency
        const plate = order.vehicleNumber || (isDealer ? 'DLR-FLEET' : 'WALK-IN');
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
      c.orders.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
      c.averageSpend = c.totalVisits > 0 ? c.totalSpend / c.totalVisits : 0;
      c.isRepeat = c.totalVisits >= 2;

      if (!c.isDealer) {
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
      } else {
        c.preferredPayMode = 'CREDIT';
      }

      return c;
    });

    list.sort((a, b) => b.totalSpend - a.totalSpend || b.totalVisits - a.totalVisits);
    return list;
  }, [periodFilteredOrders]);

  // Counts for tabs & scorecards
  const customerOnlyCount = useMemo(() => customerProfiles.filter((c) => !c.isDealer).length, [customerProfiles]);
  const dealerOnlyCount = useMemo(() => customerProfiles.filter((c) => c.isDealer).length, [customerProfiles]);
  const repeatCustomerCount = useMemo(() => customerProfiles.filter((c) => c.isRepeat).length, [customerProfiles]);

  // Table filter state for ALL_WASHES view
  const [tableFilter, setTableFilter] = useState<'ALL' | 'CUSTOMERS' | 'DEALERS'>('ALL');

  // Search Filtering
  const filteredCustomers = useMemo(() => {
    let list = customerProfiles;
    if (activeTab === 'DEALERS') {
      list = list.filter((c) => c.isDealer);
    } else if (activeTab === 'CUSTOMERS') {
      list = list.filter((c) => !c.isDealer);
    } else if (activeTab === 'REPEAT_CUSTOMERS') {
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
    let list = periodFilteredOrders;
    if (tableFilter === 'DEALERS') {
      list = list.filter((o) => isDealerOrder(o));
    } else if (tableFilter === 'CUSTOMERS') {
      list = list.filter((o) => !isDealerOrder(o));
    }

    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;

    return list.filter((o) => {
      const matchOrderNo = String(o.orderNo || '').toLowerCase().includes(q);
      const matchName = String(o.customerName || '').toLowerCase().includes(q);
      const matchPlate = String(o.vehicleNumber || '').toLowerCase().includes(q);
      const matchPhone = String(o.mobileNumber || '').toLowerCase().includes(q);
      const matchPackage = String(o.packageName || '').toLowerCase().includes(q);
      return matchOrderNo || matchName || matchPlate || matchPhone || matchPackage;
    });
  }, [periodFilteredOrders, tableFilter, searchTerm]);

  // Global KPIs across current dataset
  const totalCustomersCount = customerProfiles.length;
  const totalWashesCount = periodFilteredOrders.length;
  const totalRevenue = customerProfiles.reduce((acc, c) => acc + c.totalSpend, 0);
  const repeatRate = totalCustomersCount > 0 ? ((repeatCustomerCount / totalCustomersCount) * 100).toFixed(0) : '0';
  const averageCustomerSpend = totalCustomersCount > 0 ? totalRevenue / totalCustomersCount : 0;

  // View Customer History
  const handleOpenCustomerModal = (customer: CustomerProfileSummary) => {
    setSelectedCustomer(customer);
    setCustomerModalVisible(true);
  };

  // Complete lifetime orders for the selected customer/dealer in modal
  const selectedCustomerLifetimeOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    if (selectedCustomer.isDealer) {
      return orders
        .filter((o) => {
          if (selectedCustomer.dealerId && (o.dealerId === selectedCustomer.dealerId || (o as any).DealerId === selectedCustomer.dealerId)) {
            return true;
          }
          const nameMatch = o.customerName && o.customerName.trim().toLowerCase() === selectedCustomer.customerName.trim().toLowerCase();
          const uniproMatch = selectedCustomer.customerName.toUpperCase() === 'UNIPRO' && isDealerOrder(o);
          return Boolean(nameMatch || uniproMatch);
        })
        .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
    }

    return orders
      .filter((o) => {
        if (isDealerOrder(o)) return false;
        const rawName = (o.customerName || 'Walk-in Customer').trim().toLowerCase();
        const rawMobile = (o.mobileNumber || '').trim();
        return `${rawName}::${rawMobile}` === selectedCustomer.customerKey.replace('customer::', '');
      })
      .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
  }, [selectedCustomer, orders]);

  const modalTotalSpend = useMemo(() => {
    return selectedCustomerLifetimeOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  }, [selectedCustomerLifetimeOrders]);

  const modalAov = useMemo(() => {
    return selectedCustomerLifetimeOrders.length > 0 ? modalTotalSpend / selectedCustomerLifetimeOrders.length : 0;
  }, [selectedCustomerLifetimeOrders, modalTotalSpend]);

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

  const getStatusBadgeStyle = (statusCode?: number | null, paymentStatus?: string | null, isDealer?: boolean) => {
    if (statusCode === 70 || statusCode === 60) {
      return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', label: statusCode === 70 ? 'CLOSED' : 'COMPLETED' };
    }
    if (statusCode === 50) {
      return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'IN SERVICE' };
    }
    if (statusCode === 40 || statusCode === 30) {
      return isDealer
        ? { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'CREDIT / QUEUE' }
        : { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE', label: 'PAID / QUEUE' };
    }
    if (statusCode === 80) {
      return { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA', label: 'CANCELLED' };
    }
    if (isDealer || paymentStatus === 'CREDIT') {
      return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'CREDIT' };
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

  const { width } = useWindowDimensions();
  const [gridContainerWidth, setGridContainerWidth] = useState<number>(0);

  // Responsive Grid Card Width for Laptop, Desktop & Tablet (APK)
  const cardGap = 14;
  // Fallback before onLayout fires: accounts for outer mainContent padding (24*2), container padding (18*2), and browser scrollbar (~20px)
  const fallbackGridWidth = Math.max(300, width - (24 * 2 + 18 * 2 + 20));
  const effectiveGridWidth = gridContainerWidth > 0 ? gridContainerWidth : fallbackGridWidth;

  const numGridCols = effectiveGridWidth < 680
    ? 1
    : effectiveGridWidth >= 1520
    ? 4
    : effectiveGridWidth >= 1020
    ? 3
    : 2;

  const cardWidth = numGridCols === 1
    ? '100%'
    : Math.floor((effectiveGridWidth - (numGridCols - 1) * cardGap - 2) / numGridCols);

  return (
    <View style={styles.container}>
      {/* 1. FOUR KPI SCORECARDS */}
      <View style={styles.headerCard}>
        <View style={styles.kpiGrid}>
          {/* Card 1: Total Unique Profiles */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>TOTAL PROFILES</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="people-outline" size={16} color="#2563EB" />
              </View>
            </View>
            <Text style={styles.kpiValue}>{totalCustomersCount}</Text>
            <Text style={styles.kpiFootnote}>{customerOnlyCount} Customers • {dealerOnlyCount} Dealers</Text>
          </View>

          {/* Card 2: Total Completed Washes */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>TOTAL WASHES</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="water-outline" size={16} color="#059669" />
              </View>
            </View>
            <Text style={styles.kpiValue}>{totalWashesCount}</Text>
            <Text style={styles.kpiFootnote}>Total wash orders in selected period</Text>
          </View>

          {/* Card 3: Total Reconciled Revenue */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>TOTAL SPEND</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#FFFBEB' }]}>
                <Ionicons name="cash-outline" size={16} color="#D97706" />
              </View>
            </View>
            <Text style={styles.kpiValue}>{formatCurrency(totalRevenue)}</Text>
            <Text style={styles.kpiFootnote}>Avg {formatCurrency(averageCustomerSpend)} per profile</Text>
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
        {/* Navigation Tabs: Customer, Dealer, Repeat, All Wash Records */}
        <View style={styles.tabGroup}>
          <TouchableOpacity
            style={[styles.tabButton, (activeTab === 'CUSTOMERS' || activeTab === 'ALL_CUSTOMERS') && styles.tabButtonActive]}
            onPress={() => setActiveTab('CUSTOMERS')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-outline"
              size={15}
              color={(activeTab === 'CUSTOMERS' || activeTab === 'ALL_CUSTOMERS') ? '#FFFFFF' : '#475569'}
            />
            <Text
              style={[styles.tabButtonText, (activeTab === 'CUSTOMERS' || activeTab === 'ALL_CUSTOMERS') && styles.tabButtonTextActive]}
            >
              Customer ({customerOnlyCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'DEALERS' && styles.tabButtonActive]}
            onPress={() => setActiveTab('DEALERS')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="business-outline"
              size={15}
              color={activeTab === 'DEALERS' ? '#FFFFFF' : '#475569'}
            />
            <Text
              style={[styles.tabButtonText, activeTab === 'DEALERS' && styles.tabButtonTextActive]}
            >
              Dealer ({dealerOnlyCount})
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
              Repeated ({repeatCustomerCount})
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

          {/* Period Filter Pills: All Time, Yearly, Monthly, Weekly, Today */}
          <View style={styles.periodPillGroup}>
            {([
              { key: 'ALL', label: 'All Time' },
              { key: 'YEARLY', label: 'Yearly' },
              { key: 'MONTHLY', label: 'Monthly' },
              { key: 'WEEKLY', label: 'Weekly' },
              { key: 'TODAY', label: 'Today' },
            ] as Array<{ key: PeriodFilter; label: string }>).map((p) => {
              const isActive = periodFilter === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.periodPill, isActive && styles.periodPillActive]}
                  onPress={() => setPeriodFilter(p.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.periodPillText, isActive && styles.periodPillTextActive]}>
                    {p.label}
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
          {/* Sub-filter row to filter table by All Washes / Customer Washes / Dealer Washes */}
          <View style={styles.tableFilterBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="filter-outline" size={13} color="#64748B" />
              <Text style={styles.tableFilterTitle}>VIEW LEDGER:</Text>
            </View>
            <View style={styles.tableFilterPills}>
              <TouchableOpacity
                style={[styles.tableFilterPill, tableFilter === 'ALL' && styles.tableFilterPillActive]}
                onPress={() => setTableFilter('ALL')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tableFilterPillText, tableFilter === 'ALL' && styles.tableFilterPillTextActive]}>
                  All Records ({periodFilteredOrders.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tableFilterPill, tableFilter === 'CUSTOMERS' && styles.tableFilterPillActive]}
                onPress={() => setTableFilter('CUSTOMERS')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tableFilterPillText, tableFilter === 'CUSTOMERS' && styles.tableFilterPillTextActive]}>
                  Customers ({periodFilteredOrders.filter((o) => !isDealerOrder(o)).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tableFilterPill, tableFilter === 'DEALERS' && styles.tableFilterPillActive]}
                onPress={() => setTableFilter('DEALERS')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tableFilterPillText, tableFilter === 'DEALERS' && styles.tableFilterPillTextActive]}>
                  Dealers ({periodFilteredOrders.filter((o) => isDealerOrder(o)).length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

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

          <ScrollView 
            style={styles.tableScrollView} 
            showsVerticalScrollIndicator
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
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
                const isDealer = isDealerOrder(order);
                const statusStyle = getStatusBadgeStyle(order.statusCode, order.paymentStatus, isDealer);
                const payStyle = getPayModeStyle(order.payMode);
                const avatarStyle = isDealer
                  ? { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' }
                  : getAvatarStyle(order.customerName || 'Walk-in');

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
                        <Text style={[styles.tableCustomerPhone, isDealer && { color: '#2563EB', fontWeight: '700' }]}>
                          {isDealer ? 'Dealer' : (order.mobileNumber ? `📞 ${order.mobileNumber}` : 'Walk-in')}
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
                        {formatSgTime(order.createdDate, { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    {/* Amount */}
                    <View style={{ width: 95 }}>
                      <Text style={styles.tableAmountText}>{formatCurrency(order.totalAmount)}</Text>
                      <Text style={styles.tableGstSub}>Total</Text>
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
        /* ================= CUSTOMER / DEALER PROFILES DIRECTORY VIEW ================= */
        <ScrollView 
          style={styles.cardsScrollView} 
          showsVerticalScrollIndicator
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          {filteredCustomers.length === 0 ? (
            <View style={styles.emptyTableBox}>
              <Ionicons
                name={activeTab === 'DEALERS' ? 'business-outline' : 'people-outline'}
                size={40}
                color="#CBD5E1"
              />
              <Text style={styles.emptyTableTitle}>
                {activeTab === 'DEALERS'
                  ? 'No dealer accounts found'
                  : activeTab === 'CUSTOMERS'
                  ? 'No retail customers found'
                  : activeTab === 'REPEAT_CUSTOMERS'
                  ? 'No repeated customers found'
                  : 'No customer profiles found'}
              </Text>
              <Text style={styles.emptyTableSubtitle}>
                {searchTerm
                  ? `No profiles matching "${searchTerm}"`
                  : activeTab === 'DEALERS'
                  ? 'No commercial dealer records found for this period'
                  : 'No customers recorded yet for this period'}
              </Text>
            </View>
          ) : (
            <View 
              style={styles.customerGrid}
              onLayout={(e: LayoutChangeEvent) => {
                const w = Math.floor(e.nativeEvent.layout.width);
                if (w > 0 && Math.abs(w - gridContainerWidth) > 2) {
                  setGridContainerWidth(w);
                }
              }}
            >
              {filteredCustomers.map((cust) => {
                const isDealer = cust.isDealer;
                const avatarStyle = isDealer
                  ? { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' }
                  : getAvatarStyle(cust.customerName);
                const payStyle = getPayModeStyle(cust.preferredPayMode);

                return (
                  <View key={cust.customerKey} style={[styles.customerCard, { width: cardWidth }, isDealer && styles.dealerCardBorder]}>
                    {/* Top Customer / Dealer Info Row */}
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
                            <Text style={styles.cardCustomerName} numberOfLines={2}>
                              {cust.customerName}
                            </Text>
                            {isDealer ? (
                              <View style={styles.dealerBadge}>
                                <Ionicons name="business" size={10} color="#1D4ED8" />
                                <Text style={styles.dealerBadgeText}>DEALER</Text>
                              </View>
                            ) : cust.isRepeat ? (
                              <View style={styles.repeatBadge}>
                                <Ionicons name="repeat" size={10} color="#1D4ED8" />
                                <Text style={styles.repeatBadgeText}>REPEATED</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.cardCustomerPhone}>
                            {isDealer ? (
                              <Text style={{ color: '#2563EB', fontWeight: '800' }}>
                                🏢 Commercial Dealer{cust.mobileNumber ? ` • 📞 ${cust.mobileNumber}` : ''}
                              </Text>
                            ) : cust.mobileNumber ? (
                              `📞 ${cust.mobileNumber}`
                            ) : (
                              '👤 Walk-in Customer'
                            )}
                          </Text>
                        </View>
                      </View>

                      {/* Total Visits Pill */}
                      <View style={[styles.visitsBadge, isDealer && { backgroundColor: '#1E3A8A' }]}>
                        <Text style={styles.visitsBadgeCount}>{cust.totalVisits}</Text>
                        <Text style={styles.visitsBadgeLabel}>
                          {cust.totalVisits === 1 ? 'wash' : 'washes'}
                        </Text>
                      </View>
                    </View>

                    {/* Spend & Frequency Metrics */}
                    <View style={styles.cardMetricsRow}>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>{isDealer ? 'TOTAL CREDIT' : 'TOTAL SPENT'}</Text>
                        <Text style={[styles.metricValuePrimary, isDealer && { color: '#2563EB' }]}>
                          {formatCurrency(cust.totalSpend)}
                        </Text>
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
                      <Text style={styles.sectionMiniLabel}>
                        {isDealer ? 'FLEET VEHICLES' : 'REGISTERED VEHICLES'} ({cust.vehicles.length})
                      </Text>
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
                        style={[styles.openHistoryBtn, isDealer && { backgroundColor: '#1D4ED8' }]}
                        onPress={() => handleOpenCustomerModal(cust)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="time-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.openHistoryBtnText}>
                          {isDealer ? 'Dealer History ›' : 'Wash History ›'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ================= MODAL 1: CUSTOMER / DEALER COMPLETE HISTORY MODAL ================= */}
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
                        selectedCustomer.isDealer
                          ? { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }
                          : {
                              backgroundColor: getAvatarStyle(selectedCustomer.customerName).bg,
                              borderColor: getAvatarStyle(selectedCustomer.customerName).border,
                            },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalAvatarText,
                          selectedCustomer.isDealer
                            ? { color: '#2563EB' }
                            : { color: getAvatarStyle(selectedCustomer.customerName).text },
                        ]}
                      >
                        {getInitials(selectedCustomer.customerName)}
                      </Text>
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.modalCustomerTitle}>
                          {selectedCustomer.customerName}
                        </Text>
                        {selectedCustomer.isDealer ? (
                          <View style={styles.dealerBadge}>
                            <Ionicons name="business" size={10} color="#1D4ED8" />
                            <Text style={styles.dealerBadgeText}>DEALER ACCOUNT</Text>
                          </View>
                        ) : selectedCustomer.isRepeat ? (
                          <View style={styles.repeatBadge}>
                            <Ionicons name="repeat" size={10} color="#1D4ED8" />
                            <Text style={styles.repeatBadgeText}>REPEAT CUSTOMER</Text>
                          </View>
                        ) : (
                          <View style={styles.customerTypeBadge}>
                            <Ionicons name="person" size={10} color="#475569" />
                            <Text style={styles.customerTypeBadgeText}>RETAIL CUSTOMER</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.modalCustomerSubtitle}>
                        {selectedCustomer.isDealer
                          ? `Commercial Fleet Account • ${selectedCustomerLifetimeOrders.length} Lifetime Wash Visits`
                          : (selectedCustomer.mobileNumber
                              ? `Phone: ${selectedCustomer.mobileNumber}`
                              : 'Walk-in Customer') + ` • Total ${selectedCustomerLifetimeOrders.length} Lifetime Visits`}
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

                {/* Customer / Dealer Summary Highlight Bar */}
                <View style={styles.customerSummaryBar}>
                  <View style={styles.customerStatBox}>
                    <Text style={styles.custStatLabel}>TOTAL WASHES</Text>
                    <Text style={styles.custStatValue}>{selectedCustomerLifetimeOrders.length}</Text>
                  </View>
                  <View style={styles.custStatDivider} />
                  <View style={styles.customerStatBox}>
                    <Text style={styles.custStatLabel}>
                      {selectedCustomer.isDealer ? 'TOTAL CREDIT' : 'TOTAL SPENT'}
                    </Text>
                    <Text style={[styles.custStatValue, { color: selectedCustomer.isDealer ? '#2563EB' : '#ED0712' }]}>
                      {formatCurrency(modalTotalSpend)}
                    </Text>
                  </View>
                  <View style={styles.custStatDivider} />
                  <View style={styles.customerStatBox}>
                    <Text style={styles.custStatLabel}>AVG CHECK (AOV)</Text>
                    <Text style={styles.custStatValue}>
                      {formatCurrency(modalAov)}
                    </Text>
                  </View>
                  <View style={styles.custStatDivider} />
                  <View style={styles.customerStatBox}>
                    <Text style={styles.custStatLabel}>PAYMENT METHOD</Text>
                    <Text style={styles.custStatValue}>
                      {selectedCustomer.isDealer ? 'CREDIT' : selectedCustomer.preferredPayMode}
                    </Text>
                  </View>
                </View>

                {/* Wash History Timeline Title */}
                <View style={styles.timelineHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="calendar-outline" size={16} color="#ED0712" />
                    <Text style={styles.timelineTitle}>
                      {selectedCustomer.isDealer
                        ? `Chronological Dealer Fleet Wash History (${selectedCustomerLifetimeOrders.length} orders)`
                        : `Chronological Car Wash History (${selectedCustomerLifetimeOrders.length} orders)`}
                    </Text>
                  </View>
                  <Text style={styles.timelineSub}>Sorted from newest to oldest</Text>
                </View>

                {/* Orders Timeline List */}
                <ScrollView 
                  style={styles.timelineScrollView} 
                  showsVerticalScrollIndicator
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {selectedCustomerLifetimeOrders.map((order, idx) => {
                    const statusStyle = getStatusBadgeStyle(order.statusCode, order.paymentStatus, selectedCustomer.isDealer);
                    const payStyle = getPayModeStyle(order.payMode);

                    return (
                      <View key={order.orderId || idx} style={styles.timelineEntry}>
                        {/* Left Track & Icon */}
                        <View style={styles.timelineLeftTrack}>
                          <View style={[styles.timelineNodeDot, selectedCustomer.isDealer && { backgroundColor: '#2563EB' }]}>
                            <Ionicons name="car-outline" size={12} color="#FFFFFF" />
                          </View>
                          {idx < selectedCustomerLifetimeOrders.length - 1 && (
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

                <ScrollView 
                  style={{ maxHeight: 480 }} 
                  showsVerticalScrollIndicator
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                >
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
                      <Text style={styles.orderKeyLabel}>
                        {isDealerOrder(selectedOrder) ? 'TOTAL CREDIT' : 'TOTAL PAID'}
                      </Text>
                      <Text style={[styles.orderKeyVal, { color: isDealerOrder(selectedOrder) ? '#2563EB' : '#ED0712' }]}>
                        {formatCurrency(selectedOrder.totalAmount)}
                      </Text>
                      <Text style={styles.orderKeySub}>
                        via {(selectedOrder.payMode || (isDealerOrder(selectedOrder) ? 'CREDIT' : 'CASH')).toUpperCase()}
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
                        <Text style={styles.priceLabel}>GST ({selectedOrder.gstPercent != null ? selectedOrder.gstPercent : 0}%)</Text>
                        <Text style={styles.priceVal}>{formatCurrency(selectedOrder.gstAmount)}</Text>
                      </View>
                    )}
                    <View style={styles.priceDivider} />
                    <View style={styles.priceRow}>
                      <Text style={styles.priceTotalLabel}>
                        {isDealerOrder(selectedOrder) ? 'Total Credit Amount' : 'Total Settled Amount'}
                      </Text>
                      <Text style={[styles.priceTotalVal, isDealerOrder(selectedOrder) && { color: '#2563EB' }]}>
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
                        {orderHistoryTrail.map((h, i) => {
                          const isCreditStep = Boolean(
                            (h.newStatusName === 'PAID' || h.newStatusCode === 30 || h.newStatusName === 'CREDIT') && (
                              isDealerOrder(selectedOrder) ||
                              (selectedOrder.payMode && selectedOrder.payMode.toUpperCase() === 'CREDIT') ||
                              (h.remarks && h.remarks.toLowerCase().includes('credit')) ||
                              (h.changedBy && h.changedBy.toUpperCase().includes('DEALER'))
                            )
                          );
                          const statusDisplay = isCreditStep ? 'CREDIT' : (h.newStatusName || `Code ${h.newStatusCode}`);

                          return (
                            <View key={h.historyId || i} style={styles.trailItem}>
                              <View style={[styles.trailDot, isCreditStep && { backgroundColor: '#2563EB' }]} />
                              <View style={{ flex: 1 }}>
                                <View style={styles.trailTopRow}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={[styles.trailStatusName, isCreditStep && { color: '#2563EB' }]}>
                                      {statusDisplay}
                                    </Text>
                                    {isCreditStep && (
                                      <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#1D4ED8' }}>DEALER CREDIT</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={styles.trailTime}>
                                    {formatDateTime(h.changedDate)}
                                  </Text>
                                </View>
                                <Text style={styles.trailRemarks}>
                                  {h.remarks || 'Status update logged'} • By {h.changedBy || 'System'}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
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
    width: '100%',
    alignSelf: 'stretch',
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
    backgroundColor: '#ED0712',
  },
  periodPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  periodPillTextActive: {
    color: '#FFFFFF',
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
    width: '100%',
  },
  customerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    width: '100%',
    paddingBottom: 40,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'space-between',
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
  dealerCardBorder: {
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
  },
  dealerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dealerBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#1D4ED8',
    letterSpacing: 0.4,
  },
  customerTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customerTypeBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#475569',
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
    marginTop: 'auto',
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
  tableFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 8,
  },
  tableFilterTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  tableFilterPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  tableFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  tableFilterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  tableFilterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  tableFilterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
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
