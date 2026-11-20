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
  useWindowDimensions,
} from 'react-native';
import {
  BayMasterRecord,
  updateBayMasterStatus,
  releaseBayMaster,
  updateBayMasterLayout,
} from '../../../services/carwashOrderApi';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import {
  IconCarWashBay,
  IconCheck,
  IconClock,
  IconSettings,
  IconGrid,
  IconAutomobile,
} from '../../../components/common/AppIcons';

interface PendingBayAction {
  bayNumber: number;
  bayName: string;
  actionType: 'STATUS' | 'RELEASE';
  targetStatus: 'MAINTENANCE' | 'CLEANING' | 'AVAILABLE';
  currentStatus?: string;
}

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
  const [pendingAction, setPendingAction] = useState<PendingBayAction | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  const getConfirmActionDetails = (act: PendingBayAction | null) => {
    if (!act) {
      return {
        title: 'Confirm Action',
        subtitle: 'Are you sure you want to proceed?',
        confirmText: 'Confirm',
        confirmColor: '#0F172A',
        iconBg: '#F1F5F9',
        iconBorder: '#E2E8F0',
        iconName: 'help-circle-outline' as const,
        iconColor: '#64748B',
      };
    }

    if (act.actionType === 'RELEASE') {
      return {
        title: `Release ${act.bayName || `Bay ${act.bayNumber}`}?`,
        subtitle: `Are you sure you want to release ${act.bayName || `Bay ${act.bayNumber}`}? Current vehicle assignment will be cleared and the bay returned to Available status.`,
        confirmText: 'Yes, Release Bay',
        confirmColor: '#DC2626',
        iconBg: '#FEF2F2',
        iconBorder: '#FECACA',
        iconName: 'log-out-outline' as const,
        iconColor: '#DC2626',
      };
    }

    if (act.targetStatus === 'MAINTENANCE') {
      return {
        title: `Set ${act.bayName || `Bay ${act.bayNumber}`} to Maintenance?`,
        subtitle: `Are you sure you want to set ${act.bayName || `Bay ${act.bayNumber}`} to Maintenance? Active wash orders cannot be assigned while maintenance is in progress.`,
        confirmText: 'Yes, Set Maintenance',
        confirmColor: '#D97706',
        iconBg: '#FFFBEB',
        iconBorder: '#FDE68A',
        iconName: 'construct-outline' as const,
        iconColor: '#D97706',
      };
    }

    if (act.targetStatus === 'CLEANING') {
      return {
        title: `Set ${act.bayName || `Bay ${act.bayNumber}`} to Cleaning?`,
        subtitle: `Are you sure you want to set ${act.bayName || `Bay ${act.bayNumber}`} to Cleaning? New wash orders will be blocked from this bay until cleaning is finished.`,
        confirmText: 'Yes, Set Cleaning',
        confirmColor: '#7E22CE',
        iconBg: '#F3E8FF',
        iconBorder: '#E9D5FF',
        iconName: 'sparkles-outline' as const,
        iconColor: '#7E22CE',
      };
    }

    return {
      title: `Set ${act.bayName || `Bay ${act.bayNumber}`} to Available?`,
      subtitle: `Are you sure you want to mark ${act.bayName || `Bay ${act.bayNumber}`} as Available for incoming washes?`,
      confirmText: 'Yes, Set Available',
      confirmColor: '#059669',
      iconBg: '#ECFDF5',
      iconBorder: '#A7F3D0',
      iconName: 'checkmark-circle-outline' as const,
      iconColor: '#059669',
    };
  };

  const executeConfirmedAction = async () => {
    if (!pendingAction) return;
    try {
      setIsExecutingAction(true);
      setLoadingAction(pendingAction.bayNumber);
      if (pendingAction.actionType === 'RELEASE') {
        await releaseBayMaster(pendingAction.bayNumber);
      } else if (pendingAction.targetStatus) {
        await updateBayMasterStatus(pendingAction.bayNumber, pendingAction.targetStatus);
      }
      setPendingAction(null);
      await onRefresh();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update bay');
    } finally {
      setIsExecutingAction(false);
      setLoadingAction(null);
    }
  };

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

  const { width } = useWindowDimensions();
  const isMobile = width < 680;

  return (
    <View style={styles.container}>
      {/* Top Controls Toolbar: Filter Tabs on Left, Actions on Right */}
      <View style={[styles.filterRow, isMobile && { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
      </View>

      {/* Bays Grid */}
      <ScrollView contentContainerStyle={styles.grid}>
        {filteredBays.map((bay) => {
          const badge = getStatusBadge(bay.bayStatus);
          const isBusy = loadingAction === bay.bayNumber;
          const hasVehicle = Boolean(bay.vehicleNumber || bay.customerName);

          return (
            <View key={bay.bayId || bay.bayNumber} style={[styles.bayCard, isMobile && { minWidth: '100%', maxWidth: '100%' }]}>
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
                        onPress={() =>
                          setPendingAction({
                            bayNumber: bay.bayNumber,
                            bayName: bay.bayName,
                            actionType: 'STATUS',
                            targetStatus: 'AVAILABLE',
                            currentStatus: bay.bayStatus,
                          })
                        }
                      >
                        <Text style={styles.btnAvailableText}>Set Available</Text>
                      </TouchableOpacity>
                    )}

                    {hasVehicle && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.btnRelease]}
                        onPress={() =>
                          setPendingAction({
                            bayNumber: bay.bayNumber,
                            bayName: bay.bayName,
                            actionType: 'RELEASE',
                            targetStatus: 'AVAILABLE',
                            currentStatus: bay.bayStatus,
                          })
                        }
                      >
                        <Text style={styles.btnReleaseText}>Release Bay</Text>
                      </TouchableOpacity>
                    )}

                    {bay.bayStatus !== 'MAINTENANCE' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.btnMaintenance]}
                        onPress={() =>
                          setPendingAction({
                            bayNumber: bay.bayNumber,
                            bayName: bay.bayName,
                            actionType: 'STATUS',
                            targetStatus: 'MAINTENANCE',
                            currentStatus: bay.bayStatus,
                          })
                        }
                      >
                        <Text style={styles.btnMaintenanceText}>Maintenance</Text>
                      </TouchableOpacity>
                    )}

                    {bay.bayStatus !== 'CLEANING' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.btnCleaning]}
                        onPress={() =>
                          setPendingAction({
                            bayNumber: bay.bayNumber,
                            bayName: bay.bayName,
                            actionType: 'STATUS',
                            targetStatus: 'CLEANING',
                            currentStatus: bay.bayStatus,
                          })
                        }
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

      {/* Action Confirmation Alert Modal */}
      <Modal
        visible={!!pendingAction}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!isExecutingAction) setPendingAction(null);
        }}
      >
        <View style={styles.modalOverlay}>
          {(() => {
            const details = getConfirmActionDetails(pendingAction);
            return (
              <View style={styles.confirmModalBox}>
                {/* Action Icon Circle */}
                <View
                  style={[
                    styles.confirmIconCircle,
                    { backgroundColor: details.iconBg, borderColor: details.iconBorder },
                  ]}
                >
                  <Ionicons name={details.iconName} size={30} color={details.iconColor} />
                </View>

                {/* Modal Title & Subtitle */}
                <Text style={styles.confirmModalTitle}>{details.title}</Text>
                <Text style={styles.confirmModalSubtitle}>{details.subtitle}</Text>

                {/* Bay Target Info Badge */}
                {pendingAction && (
                  <View style={styles.confirmBayBadge}>
                    <Text style={styles.confirmBayBadgeName}>
                      {pendingAction.bayName || `Bay ${pendingAction.bayNumber}`}
                    </Text>
                    <View style={styles.confirmBayArrow}>
                      <Text style={styles.confirmBayArrowText}>→</Text>
                    </View>
                    <View
                      style={[
                        styles.confirmTargetPill,
                        { backgroundColor: details.iconBg, borderColor: details.iconBorder },
                      ]}
                    >
                      <Text style={[styles.confirmTargetPillText, { color: details.iconColor }]}>
                        {pendingAction.actionType === 'RELEASE' ? 'AVAILABLE' : pendingAction.targetStatus}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Modal Action Buttons */}
                <View style={styles.confirmBtnRow}>
                  <TouchableOpacity
                    style={styles.confirmCancelBtn}
                    onPress={() => !isExecutingAction && setPendingAction(null)}
                    disabled={isExecutingAction}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.confirmCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmExecuteBtn, { backgroundColor: details.confirmColor }]}
                    onPress={executeConfirmedAction}
                    disabled={isExecutingAction}
                    activeOpacity={0.85}
                  >
                    {isExecutingAction ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmExecuteBtnText}>{details.confirmText}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
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
  // Confirm Modal
  confirmModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  confirmIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  confirmBayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 8,
  },
  confirmBayBadgeName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  confirmBayArrow: {
    paddingHorizontal: 2,
  },
  confirmBayArrowText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  confirmTargetPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  confirmTargetPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  confirmExecuteBtn: {
    flex: 1.3,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmExecuteBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});

