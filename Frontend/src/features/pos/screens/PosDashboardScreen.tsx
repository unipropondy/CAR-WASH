import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Platform, 
  Modal, 
  Text, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator 
} from 'react-native';
import { PosSidebar, PosNavTab } from '../components/PosSidebar';
import { PosTopNavbar } from '../components/PosTopNavbar';
import { OrderQueueTable } from '../components/OrderQueueTable';
import { BayOverviewCards } from '../components/BayOverviewCards';
import { PosSettingsView } from '../components/PosSettingsView';
import { BayMasterManagementView } from '../components/BayMasterManagementView';
import { PosReportsView } from '../components/PosReportsView';
import { PosCustomerHistoryView } from '../components/PosCustomerHistoryView';
import { SimpleDayModal } from '../../dayManagement/components/SimpleDayModal';
import { useDayManagementStore } from '../../dayManagement/store/dayManagementStore';
import { INITIAL_BAYS } from '../../../data/mockData';
import { PosOrder, WashingBay } from '../../../types/pos.types';
import { 
  fetchCarWashOrders, 
  updateOrderPayment, 
  updateOrderStatus, 
  fetchCarWashOrderHistory, 
  fetchBayMasterList,
  assignBayMaster,
  releaseBayMaster,
  updateBayMasterStatus,
  BayMasterRecord,
  ApiOrder, 
  OrderStatusHistoryItem 
} from '../../../services/carwashOrderApi';
import {
  HelpRequestItem,
  fetchActiveHelpRequests,
  resolveHelpRequest,
  subscribeToHelpRequests,
  subscribeToHelpResolved,
  getStoredPendingRequests,
  playNotificationChime,
} from '../../../services/helpNotificationService';
import { Ionicons } from '@expo/vector-icons';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';

interface PosDashboardScreenProps {
  onSwitchToKiosk?: () => void;
  currentMode?: 'POS' | 'KIOSK';
  onSwitchMode?: (mode: 'POS' | 'KIOSK') => void;
  cashierName?: string;
  onLogout?: () => void;
  currentTab?: PosNavTab;
  onTabChange?: (tab: PosNavTab) => void;
}

export const PosDashboardScreen: React.FC<PosDashboardScreenProps> = ({ 
  onSwitchToKiosk,
  currentMode = 'POS',
  onSwitchMode,
  cashierName = 'John Doe',
  onLogout,
  currentTab = 'ORDERS',
  onTabChange,
}) => {
  const [activeTab, setActiveTab] = useState<PosNavTab>(currentTab);

  useEffect(() => {
    if (currentTab) {
      setActiveTab(currentTab);
    }
  }, [currentTab]);

  const handleSelectTab = (tab: PosNavTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [bays, setBays] = useState<WashingBay[]>(INITIAL_BAYS);
  const [rawBayMaster, setRawBayMaster] = useState<BayMasterRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Modal States
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState<PosOrder | null>(null);
  const [selectedBayToAssign, setSelectedBayToAssign] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedOrderForView, setSelectedOrderForView] = useState<PosOrder | null>(null);

  // Notifications Modal State
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [activeHelpAlerts, setActiveHelpAlerts] = useState<HelpRequestItem[]>([]);
  const [latestHelpAlert, setLatestHelpAlert] = useState<HelpRequestItem | null>(null);

  // History Modal State
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [orderHistoryList, setOrderHistoryList] = useState<OrderStatusHistoryItem[]>([]);
  const [historyOrderNo, setHistoryOrderNo] = useState<string>('');
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Convert ApiOrder to PosOrder
  const mapApiOrderToPosOrder = (api: ApiOrder): PosOrder => {
    // Determine Pos status
    let status: any = 'IN_QUEUE';
    const isPaid = api.paymentStatus === 'PAID' || (api.statusCode != null && api.statusCode >= 30);
    if (!isPaid && (api.statusCode === 10 || api.statusCode === 20 || api.paymentStatus === 'PENDING')) {
      status = 'IN_QUEUE'; // Pending payment
    } else if (api.statusCode === 30 || (isPaid && !api.bayId && (api.statusCode == null || api.statusCode < 50))) {
      status = 'WAITING_ASSIGN'; // Paid, awaiting bay
    } else if (api.statusCode === 40) {
      status = 'ASSIGNED_TO_BAY';
    } else if (api.statusCode === 50) {
      status = 'IN_SERVICE';
    } else if (api.statusCode === 60) {
      status = 'COMPLETED';
    } else if (api.statusCode === 70) {
      status = 'CLOSED';
    } else if (api.statusCode === 80) {
      status = 'CANCELLED';
    }

    return {
      id: String(api.orderId),
      orderId: api.orderId,
      orderNumber: api.orderNo,
      customerName: api.customerName,
      customerMobile: api.mobileNumber,
      vehiclePlate: api.vehicleNumber,
      vehicleTypeName: api.vehicleTypeName,
      vehicleCategory: api.vehicleTypeName,
      serviceCategoryName: api.serviceCategoryName,
      packageName: api.packageName,
      packagePrice: api.packagePrice,
      subtotal: api.packagePrice,
      gstRate: api.gstPercent,
      gstAmount: api.gstAmount,
      totalAmount: api.totalAmount,
      payMode: api.payMode,
      paymentStatus: api.paymentStatus,
      statusCode: api.statusCode,
      statusName: api.statusName,
      status,
      assignedBayId: api.bayId ? String(api.bayId) : undefined,
      assignedBayName: api.bayId ? `Bay ${api.bayId}` : undefined,
      bayStatus: api.bayStatus,
      waitTime: api.waitTime,
      createdAt: new Date(api.createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdDate: api.createdDate,
      paidDate: api.paidDate,
      startedDate: api.startedDate,
      completedDate: api.completedDate,
      closedDate: api.closedDate,
    };
  };

  // Map BayMaster record from dbo.BayMaster to WashingBay
  const mapBayMasterToWashingBay = (
    bm: BayMasterRecord,
    currentOrders: PosOrder[]
  ): WashingBay => {
    const bayNum = bm.bayNumber;
    const activeOrder = currentOrders.find(
      (o) =>
        o.assignedBayId === String(bayNum) &&
        (o.statusCode === 40 || o.statusCode === 50 || o.status === 'IN_SERVICE' || o.status === 'ASSIGNED_TO_BAY')
    );

    const isOccupied =
      bm.bayStatus === 'IN_SERVICE' ||
      bm.bayStatus === 'OCCUPIED' ||
      !!activeOrder;

    return {
      id: String(bm.bayNumber),
      bayId: bm.bayId,
      bayNumber: bm.bayNumber,
      name: bm.bayName || `BAY ${bm.bayNumber}`,
      type: (bm.bayType as any) || 'WASH',
      status: isOccupied ? 'IN_SERVICE' : ((bm.bayStatus as any) || 'AVAILABLE'),
      xSize: bm.xSize,
      ySize: bm.ySize,
      xPos: bm.xPos,
      yPos: bm.yPos,
      customerName: isOccupied
        ? bm.customerName || activeOrder?.customerName || 'In Service'
        : 'No Vehicle',
      customerMobile: (bm.customerMobile || activeOrder?.customerMobile) ?? undefined,
      vehiclePlate: isOccupied
        ? bm.vehicleNumber || activeOrder?.vehiclePlate
        : undefined,
      vehicleNumber: (bm.vehicleNumber || activeOrder?.vehiclePlate) ?? undefined,
      packageName: isOccupied
        ? activeOrder?.packageName || 'Washing Service'
        : 'Ready for Wash',
      orderId: isOccupied ? (bm.currentOrderId || activeOrder?.id) : undefined,
      currentOrderId: (bm.currentOrderId || activeOrder?.orderNumber) ?? undefined,
      totalAmount: bm.totalAmount ?? activeOrder?.totalAmount ?? 0,
      isLocked: bm.isLocked,
      remarks: bm.remarks ?? undefined,
      startTime: activeOrder?.createdAt || (isOccupied ? 'In Service' : '-'),
      duration: activeOrder?.waitTime || (isOccupied ? 'In Service' : '-'),
    };
  };

  // Sync 5 Washing Bays with active database orders (Fallback if offline)
  const syncBaysWithOrders = (currentOrders: PosOrder[]) => {
    setBays((prevBays) =>
      prevBays.map((bay) => {
        const bayNum = bay.bayNumber || parseInt(bay.id.replace(/\D/g, '') || '1', 10);
        const activeOrder = currentOrders.find(
          (o) =>
            o.assignedBayId === String(bayNum) &&
            (o.statusCode === 40 || o.statusCode === 50 || o.status === 'IN_SERVICE' || o.status === 'ASSIGNED_TO_BAY')
        );

        if (activeOrder) {
          return {
            ...bay,
            status: 'IN_SERVICE',
            customerName: activeOrder.customerName,
            vehiclePlate: activeOrder.vehiclePlate,
            packageName: activeOrder.packageName,
            orderId: activeOrder.id,
            startTime: activeOrder.createdAt,
            duration: activeOrder.waitTime || 'In Service',
          };
        }

        return {
          ...bay,
          status: 'AVAILABLE',
          customerName: 'No Vehicle',
          vehiclePlate: undefined,
          packageName: 'Ready for Wash',
          orderId: undefined,
          startTime: '-',
          duration: '-',
        };
      })
    );
  };

  // Load orders and bays dynamically from dbo.BayMaster and dbo.CarWashOrder
  const loadOrders = async (silent: boolean = false) => {
    try {
      if (!silent) setIsRefreshing(true);
      const [apiOrders, bayMasterList] = await Promise.all([
        fetchCarWashOrders('ALL', '', 'today'),
        fetchBayMasterList().catch((err) => {
          console.warn('Failed to fetch BayMaster list:', err);
          return [] as BayMasterRecord[];
        }),
      ]);

      const mappedOrders = apiOrders.map(mapApiOrderToPosOrder);
      setOrders(mappedOrders);
      setRawBayMaster(bayMasterList);

      if (bayMasterList && bayMasterList.length > 0) {
        const mappedBays = bayMasterList.map((bm) =>
          mapBayMasterToWashingBay(bm, mappedOrders)
        );
        setBays(mappedBays);
      } else {
        syncBaysWithOrders(mappedOrders);
      }
    } catch (err: any) {
      if (!silent) {
        console.warn('Failed to fetch orders:', err?.message);
      }
    } finally {
      setLoadingOrders(false);
      setIsRefreshing(false);
    }
  };

  // Initial load, real-time help notification subscription, and auto-polling every 4 seconds
  useEffect(() => {
    loadOrders(false);

    // Initial load from persistent local storage & backend sync
    const localAlerts = getStoredPendingRequests();
    if (localAlerts.length > 0) {
      setActiveHelpAlerts(localAlerts);
    }

    fetchActiveHelpRequests()
      .then((alerts) => {
        if (alerts.length > 0) {
          setActiveHelpAlerts(alerts);
        }
      })
      .catch(() => {});

    // Real-time listener for instant help requests from Kiosk
    const unsubscribeHelp = subscribeToHelpRequests((newAlert) => {
      setActiveHelpAlerts((prev) => {
        const filtered = prev.filter((a) => a.id !== newAlert.id);
        return [newAlert, ...filtered];
      });
      setLatestHelpAlert(newAlert);
      playNotificationChime();
    });

    // Real-time listener for resolved requests across tabs
    const unsubscribeResolved = subscribeToHelpResolved((resolvedId) => {
      setActiveHelpAlerts((prev) => prev.filter((a) => a.id !== resolvedId));
      setLatestHelpAlert((prev) => (prev?.id === resolvedId ? null : prev));
    });

    const pollTimer = setInterval(() => {
      loadOrders(true);
      fetchActiveHelpRequests()
        .then((alerts) => {
          setActiveHelpAlerts((prev) => {
            // Never wipe out pending alerts if backend temporarily returns empty
            const map = new Map<string, HelpRequestItem>();
            prev.forEach((a) => {
              if (a.status === 'PENDING') map.set(a.id, a);
            });
            alerts.forEach((a) => {
              if (a.status === 'PENDING') map.set(a.id, a);
            });
            return Array.from(map.values());
          });
        })
        .catch(() => {});
    }, 4000);

    return () => {
      unsubscribeHelp();
      unsubscribeResolved();
      clearInterval(pollTimer);
    };
  }, []);

  // Auto-hide Kiosk Help Pop-up after 5 seconds if not clicked
  // If the cashier does NOT click the close button within 5 seconds,
  // the pop-up hides but the notification is kept safe in the Notification Box!
  useEffect(() => {
    if (!latestHelpAlert) return;
    const hideTimer = setTimeout(() => {
      setLatestHelpAlert(null);
    }, 5000);
    return () => clearTimeout(hideTimer);
  }, [latestHelpAlert]);

  // 1. Confirm Cash Payment Action
  const handlePayOrder = async (order: PosOrder) => {
    const orderId = order.orderId || parseInt(order.id, 10);
    if (!orderId) return;

    // Optimistic UI update immediately
    setOrders((prev) =>
      prev.map((o) => {
        const id = o.orderId || parseInt(o.id, 10);
        if (id === orderId) {
          return {
            ...o,
            paymentStatus: 'PAID',
            statusCode: 30,
            status: 'WAITING_ASSIGN',
          };
        }
        return o;
      })
    );

    try {
      await updateOrderPayment(orderId, {
        payMode: order.payMode || 'CASH',
        confirmPaid: true,
        changedBy: cashierName,
        remarks: `Received $ ${order.totalAmount.toFixed(2)} at cashier counter`,
      });

      await loadOrders(false);
    } catch (err: any) {
      console.error('Payment Error:', err);
      Alert.alert('Payment Error', err?.message || 'Failed to confirm payment.');
      await loadOrders(false);
    }
  };

  // 2. Open Assign Bay Modal (refreshes live bay statuses from DB first)
  const handleOpenAssignModal = async (order: PosOrder) => {
    setSelectedOrderForAssign(order);
    setSelectedBayToAssign(null);
    setAssignModalVisible(true);
    await loadOrders(true).catch(() => {});
  };

  // 3. Confirm Bay Assignment -> updates dbo.BayMaster, sets StatusCode = 50 (IN_SERVICE), assigns bay
  const handleConfirmAssign = async (bayIdStr: string) => {
    if (!selectedOrderForAssign || isAssigning) return;
    setIsAssigning(true);
    const orderId = selectedOrderForAssign.orderId || parseInt(selectedOrderForAssign.id, 10);
    const bayNum = parseInt(bayIdStr.replace(/\D/g, '') || '1', 10);

    try {
      // 1. Assign in dbo.BayMaster table
      await assignBayMaster(bayNum, {
        customerName: selectedOrderForAssign.customerName,
        customerMobile: selectedOrderForAssign.customerMobile,
        vehicleNumber: selectedOrderForAssign.vehiclePlate,
        currentOrderId: selectedOrderForAssign.orderNumber,
        totalAmount: selectedOrderForAssign.totalAmount,
        remarks: `Assigned order #${selectedOrderForAssign.orderNumber}`,
      }).catch((err) => console.warn('BayMaster assign warning:', err));

      // 2. Update status in dbo.CarWashOrder directly to 50 (IN_SERVICE) with assigned bay
      await updateOrderStatus(orderId, {
        statusCode: 50, // IN_SERVICE
        bayId: bayNum,
        changedBy: cashierName,
        remarks: `Assigned to Washing Bay ${bayNum} - Service started`,
      });

      // 3. Optimistic local state update
      setOrders((prev) =>
        prev.map((o) => {
          const id = o.orderId || parseInt(o.id, 10);
          if (id === orderId) {
            return {
              ...o,
              statusCode: 50,
              status: 'IN_SERVICE',
              statusName: 'In Service',
              assignedBayId: String(bayNum),
              assignedBayName: `Bay ${bayNum}`,
              startedDate: new Date().toISOString(),
            };
          }
          return o;
        })
      );

      setAssignModalVisible(false);
      setSelectedOrderForAssign(null);
      setSelectedBayToAssign(null);
      await loadOrders(false);
    } catch (err: any) {
      console.error('Assignment Error:', err);
      Alert.alert('Assignment Error', err?.message || 'Failed to assign bay.');
      await loadOrders(false);
    } finally {
      setIsAssigning(false);
    }
  };

  // 4. Start Car Wash Service (StatusCode 50)
  const handleStartOrder = async (order: PosOrder) => {
    const orderId = order.orderId || parseInt(order.id, 10);
    const bayNum = order.assignedBayId ? parseInt(String(order.assignedBayId), 10) : undefined;
    try {
      await updateOrderStatus(orderId, {
        statusCode: 50, // IN_SERVICE
        changedBy: cashierName,
        remarks: `Car wash service commenced in ${order.assignedBayName || 'Bay'}`,
      });
      if (bayNum) {
        await updateBayMasterStatus(bayNum, 'IN_SERVICE').catch(() => {});
      }
      await loadOrders(false);
    } catch (err: any) {
      Alert.alert('Start Error', err?.message || 'Failed to start service.');
    }
  };

  // 5. Mark Service as Completed (StatusCode 60)
  const handleCompleteOrder = async (order: PosOrder) => {
    const orderId = order.orderId || parseInt(order.id, 10);
    const bayNum = order.assignedBayId ? parseInt(String(order.assignedBayId), 10) : undefined;
    const nowIso = new Date().toISOString();

    // Optimistic UI update immediately
    setOrders((prev) =>
      prev.map((o) => {
        const id = o.orderId || parseInt(o.id, 10);
        if (id === orderId) {
          return {
            ...o,
            statusCode: 60,
            status: 'COMPLETED',
            completedDate: o.completedDate || nowIso,
          };
        }
        return o;
      })
    );
    setViewModalVisible(false);
    setSelectedOrderForView(null);

    try {
      await updateOrderStatus(orderId, {
        statusCode: 60, // COMPLETED
        changedBy: cashierName,
        remarks: 'Washing, drying and inspection completed',
      });
      // Release bay in dbo.BayMaster
      if (bayNum) {
        await releaseBayMaster(bayNum).catch(() => {});
      }
      await loadOrders(false);
    } catch (err: any) {
      console.error('Complete Error:', err);
      Alert.alert('Complete Error', err?.message || 'Failed to complete service.');
      await loadOrders(false);
    }
  };

  // 6. Close Order (StatusCode 70)
  const handleCloseOrder = async (order: PosOrder) => {
    const orderId = order.orderId || parseInt(order.id, 10);
    const bayNum = order.assignedBayId ? parseInt(String(order.assignedBayId), 10) : undefined;
    const nowIso = new Date().toISOString();

    // Optimistic UI update immediately
    setOrders((prev) =>
      prev.map((o) => {
        const id = o.orderId || parseInt(o.id, 10);
        if (id === orderId) {
          return {
            ...o,
            statusCode: 70,
            status: 'CLOSED',
            completedDate: o.completedDate || nowIso,
            closedDate: o.closedDate || nowIso,
          };
        }
        return o;
      })
    );
    setViewModalVisible(false);
    setSelectedOrderForView(null);

    try {
      await updateOrderStatus(orderId, {
        statusCode: 70, // CLOSED
        changedBy: cashierName,
        remarks: 'Vehicle handed over to customer - order closed',
      });
      // Release bay in dbo.BayMaster
      if (bayNum) {
        await releaseBayMaster(bayNum).catch(() => {});
      }
      await loadOrders(false);
    } catch (err: any) {
      console.error('Close Error:', err);
      Alert.alert('Close Error', err?.message || 'Failed to close order.');
      await loadOrders(false);
    }
  };

  // 7. View Audit History
  const handleViewHistory = async (order: PosOrder) => {
    const orderId = order.orderId || parseInt(order.id, 10);
    setHistoryOrderNo(order.orderNumber);
    setLoadingHistory(true);
    setHistoryModalVisible(true);
    try {
      const history = await fetchCarWashOrderHistory(orderId);
      setOrderHistoryList(history);
    } catch (err: any) {
      Alert.alert('History Error', err?.message || 'Failed to fetch status history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open In-Service View Modal
  const handleOpenViewModal = (order: PosOrder) => {
    setSelectedOrderForView(order);
    setViewModalVisible(true);
  };

  // Select Bay from Bay Overview
  const handleSelectBay = (bay: WashingBay) => {
    if (bay.status === 'AVAILABLE') {
      const waitingOrder = orders.find((o) => o.statusCode === 30 || o.status === 'WAITING_ASSIGN');
      if (waitingOrder) {
        handleOpenAssignModal(waitingOrder);
      } else {
        Alert.alert(bay.name, 'This bay is currently available. There are no paid waiting orders to assign.');
      }
    } else {
      const order = orders.find(
        (o) =>
          o.id === bay.orderId ||
          o.orderNumber === bay.currentOrderId ||
          String(o.assignedBayId) === String(bay.bayNumber)
      );
      if (order) {
        handleOpenViewModal(order);
      }
    }
  };

  const handleManageBays = () => {
    handleSelectTab('BAYS');
  };

  const availableBays = bays.filter((b) => {
    if (b.status !== 'AVAILABLE') return false;
    // Strictly ensure no active order (StatusCode 40 or 50) is occupying this bay
    const bayNum = b.bayNumber || parseInt(b.id.replace(/\D/g, '') || '1', 10);
    const isOccupiedByOrder = orders.some(
      (o) =>
        (o.assignedBayId === String(bayNum) || (o.assignedBayName && o.assignedBayName.includes(String(bayNum)))) &&
        (o.statusCode === 40 || o.statusCode === 50 || o.status === 'IN_SERVICE' || o.status === 'ASSIGNED_TO_BAY')
    );
    return !isOccupiedByOrder;
  });

  // Compute dynamic summary metrics from orders
  const totalOrdersCount = orders.length;
  const inServiceCount = orders.filter(
    (o) => o.statusCode === 50 || o.status === 'IN_SERVICE'
  ).length;
  const closedCount = orders.filter(
    (o) => o.statusCode === 70 || o.status === 'CLOSED'
  ).length;
  // Revenue: Strictly calculate only successful PAID orders (exclude cancelled & pending unpaid orders)
  const totalRevenue = orders
    .filter(
      (o) =>
        (o.paymentStatus === 'PAID' || (o.statusCode != null && o.statusCode >= 30)) &&
        o.statusCode !== 80 &&
        o.paymentStatus !== 'CANCELLED'
    )
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const formattedTodayDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.screenContainer}>
      {/* Top Navbar Header matching the screenshot (hidden on Reports view) */}
      {activeTab !== 'REPORTS' && (
        <PosTopNavbar 
          cashierName={cashierName} 
          pageTitle={
            activeTab === 'CUSTOMERS'
              ? 'Customer History'
              : activeTab === 'BAYS'
              ? 'Bays'
              : activeTab === 'SETTINGS'
              ? 'Settings'
              : 'Orders'
          }
          onLogout={onLogout} 
          onSearch={setSearchQuery}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onPressNotification={() => setNotificationModalVisible(true)}
          onPressDayManagement={() => {
            useDayManagementStore.getState().openModal();
          }}
          unreadCount={
            orders.filter((o) => o.statusCode === 30 || (o.paymentStatus === 'PAID' && !o.assignedBayId)).length +
            activeHelpAlerts.length
          }
        />
      )}

      {/* ================= FLOATING TOAST POP-UP: KIOSK HELP (CENTERED) ================= */}
      {latestHelpAlert && (
        <View style={styles.helpToastContainer} pointerEvents="box-none">
          <View style={styles.helpToastCard}>
            {/* Left Accent Strip */}
            <View style={styles.helpToastRedStrip} />

            <View style={styles.helpToastContent}>
              <View style={styles.helpToastTopRow}>
                <View style={styles.helpToastIconWrapper}>
                  <Text style={styles.helpToastSirenIcon}>🚨</Text>
                </View>

                <View style={styles.helpToastTextCol}>
                  <View style={styles.helpToastBadgeRow}>
                    <Text style={styles.helpToastTitle}>Customer Assistance Needed</Text>
                    <View style={styles.helpToastBadge}>
                      <Text style={styles.helpToastBadgeText}>KIOSK</Text>
                    </View>
                  </View>

                  <Text style={styles.helpToastLocation}>
                    {latestHelpAlert.location} • <Text style={styles.helpToastStep}>{latestHelpAlert.step}</Text>
                  </Text>

                  <Text style={styles.helpToastMessage} numberOfLines={1}>
                    Customer requested help at {latestHelpAlert.location}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.helpToastCloseBtn}
                  onPress={() => {
                    if (latestHelpAlert) {
                      resolveHelpRequest(latestHelpAlert.id);
                      setActiveHelpAlerts((prev) => prev.filter((a) => a.id !== latestHelpAlert.id));
                    }
                    setLatestHelpAlert(null);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Close notification"
                >
                  <Text style={styles.helpToastCloseIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* 5-Second Animated Progress Bar */}
              <View style={styles.helpToastProgressTrack}>
                <View style={styles.helpToastProgressBar} />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Slide-out Sidebar Drawer with Backdrop */}
      {isSidebarOpen && (
        <View style={styles.sidebarOverlayContainer}>
          {/* Backdrop: click anywhere outside to close */}
          <TouchableOpacity
            style={styles.sidebarBackdrop}
            activeOpacity={1}
            onPress={() => setIsSidebarOpen(false)}
          />

          {/* Drawer Sidebar */}
          <View style={styles.sidebarDrawerWrapper}>
            <PosSidebar
              activeTab={activeTab}
              onClose={() => setIsSidebarOpen(false)}
              onSelectTab={(tab) => {
                handleSelectTab(tab);
                setIsSidebarOpen(false);
              }}
              currentMode={currentMode}
              onSwitchMode={(mode) => {
                setIsSidebarOpen(false);
                onSwitchMode?.(mode);
              }}
              onSwitchToKiosk={() => {
                setIsSidebarOpen(false);
                onSwitchToKiosk?.();
              }}
            />
          </View>
        </View>
      )}

      {/* Main Scrollable Content Area */}
      <ScrollView style={styles.mainPane} contentContainerStyle={styles.mainContent}>
        {activeTab === 'SETTINGS' ? (
          <PosSettingsView
            cashierName={cashierName}
            onBackToOrders={() => handleSelectTab('ORDERS')}
          />
        ) : activeTab === 'BAYS' ? (
          <BayMasterManagementView
            bays={rawBayMaster}
            onRefresh={() => loadOrders(false)}
            onBackToOrders={() => handleSelectTab('ORDERS')}
          />
        ) : activeTab === 'REPORTS' ? (
          <PosReportsView
            orders={orders}
            bays={rawBayMaster}
            cashierName={cashierName}
            onBackToOrders={() => handleSelectTab('ORDERS')}
            onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          />
        ) : activeTab === 'CUSTOMERS' ? (
          <PosCustomerHistoryView
            cashierName={cashierName}
            onBackToOrders={() => handleSelectTab('ORDERS')}
            onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            searchQuery={searchQuery}
          />
        ) : (
          <View style={styles.ordersContentWrapper}>
            {/* 1. Header: Today's Orders & Date */}
            <View style={styles.todayHeaderSection}>
              <View>
                <Text style={styles.todayTitle}>Today’s orders</Text>
                <Text style={styles.todaySubtitle}>{formattedTodayDate}</Text>
              </View>
            </View>

            {/* 2. Four Summary Cards */}
            <View style={styles.summaryCardsRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardLabel}>TOTAL ORDERS</Text>
                <Text style={styles.summaryCardValue}>{totalOrdersCount}</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardLabel}>IN SERVICE</Text>
                <Text style={styles.summaryCardValue}>{inServiceCount}</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardLabel}>CLOSED</Text>
                <Text style={styles.summaryCardValue}>{closedCount}</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardLabel}>REVENUE</Text>
                <Text style={styles.summaryCardValue}>${totalRevenue.toFixed(2)}</Text>
              </View>
            </View>

            {/* 3. Order Queue Section with Real SQL Server Data & Actions */}
            <OrderQueueTable
              orders={orders}
              searchQuery={searchQuery}
              onAssignOrder={handleOpenAssignModal}
              onViewOrder={handleOpenViewModal}
              onPayOrder={handlePayOrder}
              onStartOrder={handleStartOrder}
              onCompleteOrder={handleCompleteOrder}
              onCloseOrder={handleCloseOrder}
              onViewHistory={handleViewHistory}
              onRefresh={() => loadOrders(false)}
              isRefreshing={isRefreshing}
            />

            {/* 4. Bay Overview Section: Exactly 5 Washing Bays synced with SQL Server */}
            <BayOverviewCards
              bays={bays}
              onSelectBay={handleSelectBay}
              onManageBays={handleManageBays}
            />
          </View>
        )}
      </ScrollView>

      {/* ================= MODAL: ASSIGN TO BAY ================= */}
      <Modal visible={assignModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Washing Bay</Text>
              <TouchableOpacity onPress={() => { setAssignModalVisible(false); setSelectedBayToAssign(null); }}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedOrderForAssign && (
              <View style={styles.orderSummarySnippet}>
                <Text style={styles.snippetOrderNum}>#{selectedOrderForAssign.orderNumber}</Text>
                <Text style={styles.snippetCustomer}>{selectedOrderForAssign.customerName}</Text>
                <Text style={styles.snippetPlate}>
                  {selectedOrderForAssign.vehiclePlate} • {selectedOrderForAssign.packageName}
                </Text>
              </View>
            )}

            <Text style={styles.selectBayHeading}>Select an Available Bay:</Text>

            {availableBays.length === 0 ? (
              <View style={styles.noBaysNotice}>
                <Text style={styles.noBaysText}>All washing bays are currently occupied.</Text>
                <Text style={[styles.noBaysText, { fontSize: 11, fontWeight: '500', marginTop: 4 }]}>
                  Please wait for an active wash service to complete before assigning.
                </Text>
              </View>
            ) : (
              <View style={styles.bayOptionsList}>
                {availableBays.map((bay) => {
                  const isSelected = selectedBayToAssign === bay.id;
                  return (
                    <TouchableOpacity
                      key={bay.id}
                      style={[
                        styles.bayOptionItem,
                        isSelected && styles.bayOptionItemSelected,
                      ]}
                      onPress={() => setSelectedBayToAssign(bay.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.bayOptionLeft}>
                        <View
                          style={[
                            styles.bayOptionDot,
                            isSelected && { backgroundColor: RED_BAY_COLORS.primary },
                          ]}
                        />
                        <Text
                          style={[
                            styles.bayOptionName,
                            isSelected && { color: RED_BAY_COLORS.primary, fontWeight: '900' },
                          ]}
                        >
                          {bay.name}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.assignPill,
                          isSelected
                            ? { backgroundColor: RED_BAY_COLORS.primary }
                            : { backgroundColor: '#F1F5F9' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.assignPillText,
                            isSelected ? { color: '#FFFFFF' } : { color: '#475569' },
                          ]}
                        >
                          {isSelected ? '✓ Selected' : 'Select'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {availableBays.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.confirmBayActionBtn,
                  (!selectedBayToAssign || isAssigning) && styles.confirmBayActionBtnDisabled,
                ]}
                disabled={!selectedBayToAssign || isAssigning}
                onPress={() => selectedBayToAssign && handleConfirmAssign(selectedBayToAssign)}
                activeOpacity={0.85}
              >
                {isAssigning ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmBayActionBtnText}>
                    {selectedBayToAssign
                      ? `Confirm ${availableBays.find((b) => b.id === selectedBayToAssign)?.name || 'Bay'} & Start Service`
                      : 'Choose an Available Bay Above'}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => {
                setAssignModalVisible(false);
                setSelectedBayToAssign(null);
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: VIEW IN SERVICE ORDER ================= */}
      <Modal visible={viewModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Operational Details</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedOrderForView && (
              <View style={styles.viewBody}>
                {selectedOrderForView.assignedBayName && (
                  <View style={styles.inServiceBadge}>
                    <Text style={styles.inServiceBadgeText}>
                      ASSIGNED: {selectedOrderForView.assignedBayName}
                    </Text>
                  </View>
                )}

                <View style={styles.viewInfoRow}>
                  <Text style={styles.viewLabel}>Order No:</Text>
                  <Text style={[styles.viewVal, { fontWeight: '900', color: RED_BAY_COLORS.primary }]}>
                    #{selectedOrderForView.orderNumber}
                  </Text>
                </View>

                <View style={styles.viewInfoRow}>
                  <Text style={styles.viewLabel}>Customer:</Text>
                  <Text style={styles.viewVal}>{selectedOrderForView.customerName} ({selectedOrderForView.customerMobile || 'Kiosk'})</Text>
                </View>

                <View style={styles.viewInfoRow}>
                  <Text style={styles.viewLabel}>Vehicle Plate:</Text>
                  <Text style={styles.viewVal}>{selectedOrderForView.vehiclePlate} ({selectedOrderForView.vehicleTypeName || 'Sedan'})</Text>
                </View>

                <View style={styles.viewInfoRow}>
                  <Text style={styles.viewLabel}>Package:</Text>
                  <Text style={styles.viewVal}>{selectedOrderForView.packageName} ({selectedOrderForView.serviceCategoryName || 'Car Wash'})</Text>
                </View>

                <View style={styles.viewInfoRow}>
                  <Text style={styles.viewLabel}>Payment Mode:</Text>
                  <Text style={styles.viewVal}>{selectedOrderForView.payMode || 'CASH'}</Text>
                </View>

                <View style={styles.viewInfoRow}>
                  <Text style={styles.viewLabel}>Payment Status:</Text>
                  <Text style={[styles.viewVal, { color: selectedOrderForView.paymentStatus === 'PAID' ? '#059669' : '#D97706', fontWeight: '800' }]}>
                    {selectedOrderForView.paymentStatus} ($ {selectedOrderForView.totalAmount.toFixed(2)})
                  </Text>
                </View>

                <View style={styles.viewActions}>
                  {/* Manual Confirm Payment: ONLY displayed for unpaid CASH orders awaiting counter payment */}
                  {selectedOrderForView.paymentStatus !== 'PAID' &&
                    (selectedOrderForView.statusCode == null || selectedOrderForView.statusCode <= 20) &&
                    (selectedOrderForView.payMode || '').trim().toUpperCase() === 'CASH' && (
                    <TouchableOpacity
                      style={[styles.completeWashBtn, { backgroundColor: '#0F172A' }]}
                      onPress={async () => {
                        const target = selectedOrderForView;
                        setViewModalVisible(false);
                        await handlePayOrder(target);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.completeWashText}>✓ Confirm Payment ($ {selectedOrderForView.totalAmount.toFixed(2)})</Text>
                    </TouchableOpacity>
                  )}

                  {/* If Paid & Waiting for bay assignment: Show Select Bay button */}
                  {(selectedOrderForView.paymentStatus === 'PAID' || (selectedOrderForView.statusCode != null && selectedOrderForView.statusCode >= 30)) &&
                    !selectedOrderForView.assignedBayId &&
                    (selectedOrderForView.statusCode == null || selectedOrderForView.statusCode <= 40) && (
                    <TouchableOpacity
                      style={[styles.completeWashBtn, { backgroundColor: RED_BAY_COLORS.primary }]}
                      onPress={() => {
                        const orderToAssign = selectedOrderForView;
                        setViewModalVisible(false);
                        handleOpenAssignModal(orderToAssign);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.completeWashText}>💧 Select Bay & Start Service</Text>
                    </TouchableOpacity>
                  )}

                  {/* If In Service (bay assigned, service ongoing): Show Complete Service button */}
                  {(selectedOrderForView.statusCode === 50 ||
                    (selectedOrderForView.assignedBayId && (selectedOrderForView.statusCode === 40 || selectedOrderForView.status === 'IN_SERVICE'))) && (
                    <TouchableOpacity
                      style={styles.completeWashBtn}
                      onPress={() => handleCompleteOrder(selectedOrderForView)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Complete Service"
                    >
                      <Text style={styles.completeWashText}>✓ Complete Service</Text>
                    </TouchableOpacity>
                  )}

                  {selectedOrderForView.statusCode === 60 && (
                    <TouchableOpacity
                      style={styles.closeOrderBtn}
                      onPress={() => handleCloseOrder(selectedOrderForView)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.closeOrderText}>Close Order & Handover</Text>
                    </TouchableOpacity>
                  )}

                  {/* If Order is already Closed (StatusCode 70) */}
                  {selectedOrderForView.statusCode === 70 && (
                    <View style={{ alignItems: 'center', width: '100%', marginTop: 8 }}>
                      <View style={{ backgroundColor: '#F0FDF4', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 12 }}>
                        <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 13 }}>✓ Service Completed & Order Closed</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.closeOrderBtn, { backgroundColor: '#64748B' }]}
                        onPress={() => setViewModalVisible(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.closeOrderText}>Close Window</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: AUDIT STATUS HISTORY ================= */}
      <Modal visible={historyModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 600 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Order Status Audit Trail</Text>
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  Order #{historyOrderNo} (From dbo.CarWashOrderStatusHistory)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
                <Text style={{ marginTop: 10, fontSize: 12, color: '#64748B' }}>
                  Loading status history from database...
                </Text>
              </View>
            ) : orderHistoryList.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Text style={{ color: '#64748B', fontSize: 13 }}>No status history records found.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360, marginVertical: 10 }}>
                {orderHistoryList.map((hist, i) => (
                  <View key={hist.historyId || i} style={styles.historyRow}>
                    <View style={styles.historyBadge}>
                      <Text style={styles.historyBadgeText}>
                        {hist.oldStatusCode != null ? `${hist.oldStatusCode} → ${hist.newStatusCode}` : `${hist.newStatusCode}`}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.historyStatusName}>{hist.newStatusName}</Text>
                      {hist.remarks && (
                        <Text style={styles.historyRemarks}>{hist.remarks}</Text>
                      )}
                      <Text style={styles.historyMeta}>
                        Changed by <Text style={{ fontWeight: '700' }}>{hist.changedBy}</Text> • {new Date(hist.changedDate).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setHistoryModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: NOTIFICATIONS ================= */}
      <Modal visible={notificationModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 520 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18 }}>🔔</Text>
                <Text style={styles.modalTitle}>Notifications</Text>
              </View>
              <TouchableOpacity onPress={() => setNotificationModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380, marginVertical: 10 }}>
              {/* Kiosk Customer Help Requests */}
              {activeHelpAlerts.length > 0 && (
                <View style={styles.notificationCardSiren}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={styles.notificationCardTitleSiren}>
                      🚨 KIOSK CUSTOMER ASSISTANCE NEEDED ({activeHelpAlerts.length})
                    </Text>
                  </View>
                  {activeHelpAlerts.map((alert) => (
                    <View key={alert.id} style={styles.notificationItemRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <Text style={[styles.notificationItemHeading, { color: '#B91C1C', fontWeight: '800' }]}>
                            {alert.location}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#94A3B8' }}>•</Text>
                          <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#DC2626' }}>{alert.step}</Text>
                          </View>
                        </View>
                        <Text style={styles.notificationItemSub}>{alert.message}</Text>
                        <Text style={styles.notificationItemMeta}>
                          Requested at {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.notificationActionBtn, { backgroundColor: '#E60012' }]}
                        onPress={async () => {
                          await resolveHelpRequest(alert.id);
                          setActiveHelpAlerts((prev) => prev.filter((a) => a.id !== alert.id));
                          if (latestHelpAlert?.id === alert.id) setLatestHelpAlert(null);
                        }}
                      >
                        <Text style={styles.notificationActionBtnText}>Acknowledge</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {orders.filter((o) => o.statusCode === 30 || (o.paymentStatus === 'PAID' && !o.assignedBayId)).length > 0 && (
                <View style={styles.notificationCardUrgent}>
                  <Text style={styles.notificationCardTitle}>⚠️ Action Required: Bay Assignment</Text>
                  {orders
                    .filter((o) => o.statusCode === 30 || (o.paymentStatus === 'PAID' && !o.assignedBayId))
                    .map((o) => (
                      <View key={o.id} style={styles.notificationItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.notificationItemHeading}>
                            Order #{o.orderNumber} • {o.vehiclePlate} ({o.customerName})
                          </Text>
                          <Text style={styles.notificationItemSub}>
                            Payment confirmed ($ {o.totalAmount.toFixed(2)}) - waiting for bay assignment
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.notificationActionBtn}
                          onPress={() => {
                            setNotificationModalVisible(false);
                            handleOpenAssignModal(o);
                          }}
                        >
                          <Text style={styles.notificationActionBtnText}>Select Bay</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                </View>
              )}

              {orders.filter((o) => o.statusCode === 50 || o.status === 'IN_SERVICE').length > 0 && (
                <View style={styles.notificationCardInfo}>
                  <Text style={styles.notificationCardTitle}>💧 Active In-Service Washes</Text>
                  {orders
                    .filter((o) => o.statusCode === 50 || o.status === 'IN_SERVICE')
                    .map((o) => (
                      <View key={o.id} style={styles.notificationItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.notificationItemHeading}>
                            {o.assignedBayName || `Bay ${o.assignedBayId || '?'}`} • Order #{o.orderNumber} ({o.vehiclePlate})
                          </Text>
                          <Text style={styles.notificationItemSub}>
                            {o.packageName} in progress • Started: {o.createdAt}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.notificationActionBtn, { backgroundColor: '#0284C7' }]}
                          onPress={() => {
                            setNotificationModalVisible(false);
                            handleOpenViewModal(o);
                          }}
                        >
                          <Text style={styles.notificationActionBtnText}>View</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                </View>
              )}

              <View style={styles.notificationCardDefault}>
                <Text style={styles.notificationCardTitle}>⚙️ System Status</Text>
                <Text style={styles.notificationItemSub}>
                  RED BAY POS Station is connected with live database updates enabled.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setNotificationModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: DAY MANAGEMENT POPUP ================= */}
      <SimpleDayModal />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F1F4F9',
    ...(Platform.OS === 'web'
      ? {
          height: '100vh' as any,
          minHeight: '100vh' as any,
          width: '100vw' as any,
          overflow: 'hidden' as any,
        }
      : {}),
  },
  mainPane: {
    flex: 1,
    backgroundColor: '#F1F4F9',
  },
  // Slide-out Drawer Styles
  sidebarOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    flexDirection: 'row',
  },
  sidebarBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  sidebarDrawerWrapper: {
    width: 220,
    height: '100%',
    zIndex: 10000,
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
    ...makeShadow('#000000', { width: 4, height: 0 }, 0.12, 16, 20),
  },
  closeDrawerBtn: {
    position: 'absolute',
    top: 14,
    right: 12,
    zIndex: 10002,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeDrawerIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  mainContent: {
    padding: 24,
    paddingBottom: 48,
    alignItems: 'center',
  },
  ordersContentWrapper: {
    width: '100%',
    maxWidth: 1400,
  },
  todayHeaderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  todayTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  todaySubtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  summaryCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  summaryCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
        } as any)
      : { elevation: 2 }),
  },
  summaryCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  summaryCardValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 480,
    padding: 22,
    ...makeShadow('#000000', { width: 0, height: 10 }, 0.15, 20, 8),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#64748B',
  },
  orderSummarySnippet: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  snippetOrderNum: {
    fontSize: 12,
    fontWeight: '800',
    color: RED_BAY_COLORS.primary,
    fontFamily: 'monospace',
  },
  snippetCustomer: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  snippetPlate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  selectBayHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noBaysNotice: {
    padding: 20,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  noBaysText: {
    fontSize: 13,
    color: '#B45309',
    fontWeight: '700',
  },
  bayOptionsList: {
    gap: 8,
    marginBottom: 16,
  },
  bayOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    cursor: 'pointer' as any,
  },
  bayOptionItemSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FEF2F2',
  },
  bayOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bayOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  bayOptionName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  assignPill: {
    backgroundColor: RED_BAY_COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  assignPillText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  confirmBayActionBtn: {
    backgroundColor: RED_BAY_COLORS.primary,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    cursor: 'pointer' as any,
  },
  confirmBayActionBtnDisabled: {
    backgroundColor: '#CBD5E1',
    cursor: 'not-allowed' as any,
  },
  confirmBayActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  modalCancelBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  viewBody: {
    gap: 10,
  },
  inServiceBadge: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  inServiceBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0284C7',
  },
  viewInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  viewLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  viewVal: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  viewActions: {
    marginTop: 16,
    gap: 8,
  },
  completeWashBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  completeWashText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  closeOrderBtn: {
    backgroundColor: '#475569',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeOrderText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  // Audit History
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  historyStatusName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  historyRemarks: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  historyMeta: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
  // Notifications Modal Styles
  notificationCardUrgent: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  notificationCardInfo: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  notificationCardDefault: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  notificationCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  notificationItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    gap: 8,
  },
  notificationItemHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  notificationItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  notificationActionBtn: {
    backgroundColor: RED_BAY_COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    cursor: 'pointer' as any,
  },
  notificationActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  notificationCardSiren: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  notificationCardTitleSiren: {
    fontSize: 12,
    fontWeight: '900',
    color: '#B91C1C',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationItemMeta: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  // Floating Toast Pop-up Styles for Kiosk Help (Centered at top)
  helpToastContainer: {
    position: 'absolute',
    top: 76,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    pointerEvents: 'box-none' as any,
  },
  helpToastCard: {
    width: 440,
    maxWidth: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 14px 34px -4px rgba(220, 38, 38, 0.22), 0 6px 14px -2px rgba(0, 0, 0, 0.08)',
          animation: 'slideDownCenter 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        } as any)
      : {}),
  },
  helpToastRedStrip: {
    width: 5,
    backgroundColor: '#DC2626',
  },
  helpToastContent: {
    flex: 1,
    paddingTop: 12,
  },
  helpToastTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 10,
  },
  helpToastIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  helpToastSirenIcon: {
    fontSize: 18,
  },
  helpToastTextCol: {
    flex: 1,
  },
  helpToastBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  helpToastTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  helpToastBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  helpToastBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  helpToastLocation: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 3,
  },
  helpToastStep: {
    color: '#DC2626',
    fontWeight: '800',
  },
  helpToastMessage: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  helpToastCloseBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    cursor: 'pointer' as any,
  },
  helpToastCloseIcon: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  helpToastProgressTrack: {
    height: 3,
    backgroundColor: '#FEE2E2',
    width: '100%',
    overflow: 'hidden',
  },
  helpToastProgressBar: {
    height: '100%',
    backgroundColor: '#DC2626',
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          animation: 'shrinkProgress 5s linear forwards',
          transformOrigin: 'left',
        } as any)
      : {}),
  },
});
