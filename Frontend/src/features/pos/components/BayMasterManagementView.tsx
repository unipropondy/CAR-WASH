import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {
  BayMasterRecord,
  updateBayMasterStatus,
  releaseBayMaster,
  updateBayMasterLayout,
} from '../../../services/carwashOrderApi';
import { RED_BAY_COLORS } from '../../../theme/colors';
import {
  IconCarWashBay,
  IconCheck,
  IconClock,
  IconSettings,
  IconGrid,
  IconAutomobile,
} from '../../../components/common/AppIcons';

interface BayMasterManagementViewProps {
  bays: BayMasterRecord[];
  onRefresh: () => Promise<void>;
  onBackToOrders?: () => void;
}

export const BayMasterManagementView: React.FC<BayMasterManagementViewProps> = ({
  bays,
  onRefresh,
  onBackToOrders,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'AVAILABLE' | 'IN_SERVICE' | 'MAINTENANCE'>('ALL');
  const [loadingAction, setLoadingAction] = useState<number | null>(null);
  const [editingBay, setEditingBay] = useState<BayMasterRecord | null>(null);
  const [editXPos, setEditXPos] = useState('0');
  const [editYPos, setEditYPos] = useState('0');
  const [editXSize, setEditXSize] = useState('150');
  const [editYSize, setEditYSize] = useState('200');
  const [savingLayout, setSavingLayout] = useState(false);

  const filteredBays = bays.filter((b) => {
    if (filter === 'ALL') return true;
    if (filter === 'AVAILABLE') return b.bayStatus === 'AVAILABLE';
    if (filter === 'IN_SERVICE') return b.bayStatus === 'IN_SERVICE' || b.bayStatus === 'OCCUPIED';
    if (filter === 'MAINTENANCE') return b.bayStatus === 'MAINTENANCE' || b.bayStatus === 'CLEANING';
    return true;
  });

  const handleStatusChange = async (bayNumber: number, newStatus: string) => {
    try {
      setLoadingAction(bayNumber);
      await updateBayMasterStatus(bayNumber, newStatus);
      await onRefresh();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update bay status');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRelease = async (bayNumber: number) => {
    try {
      setLoadingAction(bayNumber);
      await releaseBayMaster(bayNumber);
      await onRefresh();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to release bay');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOpenEditLayout = (bay: BayMasterRecord) => {
    setEditingBay(bay);
    setEditXPos(String(bay.xPos ?? 0));
    setEditYPos(String(bay.yPos ?? 0));
    setEditXSize(String(bay.xSize ?? 150));
    setEditYSize(String(bay.ySize ?? 200));
  };

  const handleSaveLayout = async () => {
    if (!editingBay) return;
    try {
      setSavingLayout(true);
      await updateBayMasterLayout([
        {
          bayNumber: editingBay.bayNumber,
          xPos: parseInt(editXPos, 10) || 0,
          yPos: parseInt(editYPos, 10) || 0,
          xSize: parseInt(editXSize, 10) || 150,
          ySize: parseInt(editYSize, 10) || 200,
        },
      ]);
      setEditingBay(null);
      await onRefresh();
    } catch (err: any) {
      Alert.alert('Layout Save Error', err?.message || 'Failed to save layout');
    } finally {
      setSavingLayout(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'AVAILABLE') {
      return { bg: '#ECFDF5', text: '#059669', label: 'AVAILABLE' };
    }
    if (s === 'IN_SERVICE' || s === 'OCCUPIED') {
      return { bg: '#EFF6FF', text: '#1D4ED8', label: 'IN SERVICE' };
    }
    if (s === 'CLEANING') {
      return { bg: '#F3E8FF', text: '#7E22CE', label: 'CLEANING' };
    }
    return { bg: '#FFFBEB', text: '#D97706', label: s || 'MAINTENANCE' };
  };

  return (
    <View style={styles.container}>
      {/* Header section */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <IconCarWashBay size={20} color="#FFFFFF" strokeWidth={2.4} />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.title}>Bay Management</Text>
              <View style={styles.dbTableChip}>
                <Text style={styles.dbTableChipText}>dbo.BayMaster</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              Live SQL Server table: BayMaster • Physical wash bays & layout mapping
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {onBackToOrders && (
            <TouchableOpacity style={styles.backBtn} onPress={onBackToOrders} activeOpacity={0.8}>
              <Text style={styles.backBtnText}>← Back to Orders</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.8}>
            <Text style={styles.refreshBtnText}>↻ Refresh Bays</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['ALL', 'AVAILABLE', 'IN_SERVICE', 'MAINTENANCE'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterPill, filter === tab && styles.filterPillActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterPillText, filter === tab && styles.filterPillTextActive]}>
              {tab.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bays Grid */}
      <ScrollView contentContainerStyle={styles.grid}>
        {filteredBays.map((bay) => {
          const badge = getStatusBadge(bay.bayStatus);
          const isBusy = loadingAction === bay.bayNumber;
          const hasVehicle = Boolean(bay.vehicleNumber || bay.customerName);

          return (
            <View key={bay.bayId || bay.bayNumber} style={styles.bayCard}>
              {/* Card top */}
              <View style={styles.cardTop}>
                <View style={styles.bayHeaderLeft}>
                  <View style={styles.bayNumberCircle}>
                    <Text style={styles.bayNumberText}>{bay.bayNumber}</Text>
                  </View>
                  <View>
                    <Text style={styles.bayName}>{bay.bayName}</Text>
                    <Text style={styles.bayType}>{bay.bayType}</Text>
                  </View>
                </View>

                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                </View>
              </View>

              {/* Occupancy Info */}
              <View style={styles.occupancySection}>
                {hasVehicle ? (
                  <View style={styles.occupiedBox}>
                    <View style={styles.vehicleRow}>
                      <IconAutomobile size={14} color="#0F172A" strokeWidth={2.4} />
                      <Text style={styles.vehiclePlate}>
                        {bay.vehicleNumber || 'Plate N/A'}
                      </Text>
                    </View>
                    <Text style={styles.custText}>
                      {bay.customerName || 'Customer'} {bay.customerMobile ? `(${bay.customerMobile})` : ''}
                    </Text>
                    {bay.currentOrderId && (
                      <Text style={styles.orderTag}>Order #{bay.currentOrderId}</Text>
                    )}
                    {bay.totalAmount ? (
                      <Text style={styles.amountText}>Amount: $ {Number(bay.totalAmount).toFixed(2)}</Text>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyTitle}>Bay Vacant</Text>
                    <Text style={styles.emptyDesc}>Ready for next car wash assignment</Text>
                  </View>
                )}
              </View>

              {/* Layout Info (XPos, YPos, XSize, YSize) */}
              <View style={styles.layoutInfoRow}>
                <Text style={styles.layoutLabel}>
                  Layout: Pos ({bay.xPos}, {bay.yPos}) • Size {bay.xSize}×{bay.ySize}
                </Text>
                <TouchableOpacity
                  style={styles.editLayoutBtn}
                  onPress={() => handleOpenEditLayout(bay)}
                >
                  <IconSettings size={12} color="#0284C7" strokeWidth={2} />
                  <Text style={styles.editLayoutText}>Edit</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View style={styles.cardActions}>
                {isBusy ? (
                  <ActivityIndicator size="small" color={RED_BAY_COLORS.primary} />
                ) : (
                  <>
                    {bay.bayStatus !== 'AVAILABLE' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.btnAvailable]}
                        onPress={() => handleStatusChange(bay.bayNumber, 'AVAILABLE')}
                      >
                        <Text style={styles.btnAvailableText}>Set Available</Text>
                      </TouchableOpacity>
                    )}

                    {hasVehicle && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.btnRelease]}
                        onPress={() => handleRelease(bay.bayNumber)}
                      >
                        <Text style={styles.btnReleaseText}>Release Bay</Text>
                      </TouchableOpacity>
                    )}

                    {bay.bayStatus !== 'MAINTENANCE' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.btnMaintenance]}
                        onPress={() => handleStatusChange(bay.bayNumber, 'MAINTENANCE')}
                      >
                        <Text style={styles.btnMaintenanceText}>Maintenance</Text>
                      </TouchableOpacity>
                    )}

                    {bay.bayStatus !== 'CLEANING' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.btnCleaning]}
                        onPress={() => handleStatusChange(bay.bayNumber, 'CLEANING')}
                      >
                        <Text style={styles.btnCleaningText}>Cleaning</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Edit Layout Coordinates Modal */}
      <Modal visible={!!editingBay} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Bay Layout ({editingBay?.bayName})</Text>
              <TouchableOpacity onPress={() => setEditingBay(null)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>X Position (XPos in BayMaster):</Text>
              <TextInput
                style={styles.input}
                value={editXPos}
                onChangeText={setEditXPos}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Y Position (YPos in BayMaster):</Text>
              <TextInput
                style={styles.input}
                value={editYPos}
                onChangeText={setEditYPos}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Width (XSize in BayMaster):</Text>
              <TextInput
                style={styles.input}
                value={editXSize}
                onChangeText={setEditXSize}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Height (YSize in BayMaster):</Text>
              <TextInput
                style={styles.input}
                value={editYSize}
                onChangeText={setEditYSize}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={styles.saveLayoutBtn}
                onPress={handleSaveLayout}
                disabled={savingLayout}
              >
                {savingLayout ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveLayoutText}>Save Coordinates to BayMaster</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 1400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  dbTableChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dbTableChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
    fontFamily: 'monospace',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  backBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  refreshBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
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
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingBottom: 40,
  },
  bayCard: {
    flex: 1,
    minWidth: 240,
    maxWidth: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
        } as any)
      : { elevation: 2 }),
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bayNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bayNumberText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  bayName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  bayType: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  occupancySection: {
    minHeight: 100,
    marginBottom: 12,
    justifyContent: 'center',
  },
  occupiedBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  vehiclePlate: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  custText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  orderTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
    marginTop: 4,
  },
  amountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    marginTop: 2,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  emptyDesc: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  layoutInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 10,
  },
  layoutLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  editLayoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  editLayoutText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  btnAvailable: {
    backgroundColor: '#ECFDF5',
  },
  btnAvailableText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  btnRelease: {
    backgroundColor: '#FEE2E2',
  },
  btnReleaseText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  btnMaintenance: {
    backgroundColor: '#FFFBEB',
  },
  btnMaintenanceText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  btnCleaning: {
    backgroundColor: '#F3E8FF',
  },
  btnCleaningText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7E22CE',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748B',
  },
  modalBody: {
    gap: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  saveLayoutBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveLayoutText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
});

