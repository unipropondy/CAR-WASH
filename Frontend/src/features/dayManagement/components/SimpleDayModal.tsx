import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDayManagementStore } from '../store/dayManagementStore';
import { useAuthStore } from '../../auth/store/authStore';
import { getSgDateISO, formatSgDate, getDbTime } from '../../../services/timeService';

interface SimpleDayModalProps {
  onViewHistory?: () => void;
}

export const SimpleDayModal: React.FC<SimpleDayModalProps> = ({ onViewHistory }) => {
  const user = useAuthStore((state) => state.user);
  const isOpen = useDayManagementStore((state) => state.isOpen);
  const activeDayId = useDayManagementStore((state) => state.activeDayId);
  const businessDate = useDayManagementStore((state) => state.businessDate);
  const activeDay = useDayManagementStore((state) => state.activeDay);
  const isModalOpen = useDayManagementStore((state) => state.isModalOpen);
  const closeModal = useDayManagementStore((state) => state.closeModal);
  const checkStatus = useDayManagementStore((state) => state.checkStatus);
  const startDay = useDayManagementStore((state) => state.startDay);
  const closeDay = useDayManagementStore((state) => state.closeDay);

  // Helper to format today's operational date in Singapore as YYYY-MM-DD
  const getTodayStr = () => {
    return getSgDateISO(getDbTime());
  };

  const todayStr = getTodayStr();
  // Selected date is strictly locked to current date only
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isModalOpen) {
      setErrorMsg('');
      setSelectedDate(getTodayStr());
      checkStatus();
    }
  }, [isModalOpen, checkStatus]);

  const cleanDate = businessDate ? businessDate.split('T')[0] : selectedDate;

  // Pretty date formatter: "Wednesday, 11 November 2026"
  const formatFriendlyDate = (dateStr: string) => {
    if (!dateStr) return '';
    return formatSgDate(dateStr, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleStartDay = async () => {
    setErrorMsg('');
    const targetDate = todayStr; // Enforce current date only
    setLoading(true);
    try {
      await startDay({
        businessDate: targetDate,
        openingCash: 0,
        startedBy: user?.userName || user?.userCode || 'Cashier',
      });
      setLoading(false);
      closeModal();
      await checkStatus();
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err?.message || 'Failed to start day.');
    }
  };

  const handleEndDay = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await closeDay({
        closingCash: 0,
        forceClose: true,
        endedBy: user?.userName || user?.userCode || 'Cashier',
        closingRemarks: `Day ended on ${cleanDate}`,
      });
      setLoading(false);
      closeModal();
      await checkStatus();
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err?.message || 'Failed to end day.');
    }
  };

  const totalWashes = activeDay?.totalOrders || 0;
  const totalSales = Number(activeDay?.totalSales || 0).toFixed(2);

  return (
    <Modal
      visible={isModalOpen}
      transparent
      animationType="fade"
      onRequestClose={closeModal}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Top Bar Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>
                {isOpen ? 'Day End Closing' : 'Start Business Day'}
              </Text>
            </View>
            <TouchableOpacity onPress={closeModal} style={styles.closeBtn} activeOpacity={0.7} accessibilityLabel="Close modal">
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Modal Body */}
          {isOpen ? (
            // ==========================================
            // DAY OPEN STATE: Total Sales, Washes & End Day
            // ==========================================
            <View style={styles.body}>
              <Text style={styles.bodySubtitle}>
                Review today's performance and close the current business day.
              </Text>

              {/* Business Date Pill */}
              <View style={styles.dateBanner}>
                <View style={styles.dateBannerIconWrap}>
                  <Ionicons name="calendar" size={18} color="#E60012" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateBannerLabel}>ACTIVE BUSINESS DATE</Text>
                  <Text style={styles.dateBannerValue}>{formatFriendlyDate(cleanDate)}</Text>
                </View>
              </View>

              {/* Metrics Display */}
              <View style={styles.metricsGrid}>
                {/* Total Sales Card */}
                <View style={styles.metricCardSales}>
                  <View style={styles.metricHeaderRow}>
                    <Text style={styles.metricLabelSales}>TOTAL SALES</Text>
                    <Ionicons name="cash-outline" size={16} color="#16A34A" />
                  </View>
                  <Text style={styles.metricValueSales}>${totalSales}</Text>
                  <Text style={styles.metricHint}>Paid wash revenue</Text>
                </View>

                {/* Total Washes Card */}
                <View style={styles.metricCardWashes}>
                  <View style={styles.metricHeaderRow}>
                    <Text style={styles.metricLabelWashes}>TOTAL WASHES</Text>
                    <Ionicons name="car-outline" size={16} color="#2563EB" />
                  </View>
                  <Text style={styles.metricValueWashes}>{totalWashes}</Text>
                  <Text style={styles.metricHint}>Completed orders</Text>
                </View>
              </View>

              {errorMsg ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginTop: 12, marginBottom: 4, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Ionicons name="mail-outline" size={15} color="#475569" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 12, color: '#475569', flex: 1 }}>
                  Daily sales summary and reconciliation report will be emailed automatically to the report email address upon closing.
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={closeModal}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.endDayBtn, loading && styles.btnDisabled]}
                  onPress={handleEndDay}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <View style={styles.btnContentRow}>
                      <Ionicons name="power" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.endDayBtnText}>Confirm Day End</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {onViewHistory && (
                <TouchableOpacity
                  style={styles.modalHistoryLink}
                  onPress={() => {
                    closeModal();
                    onViewHistory();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.historyLinkRow}>
                    <Ionicons name="time-outline" size={15} color="#475569" style={{ marginRight: 6 }} />
                    <Text style={styles.modalHistoryLinkText}>View Previous Days & History</Text>
                    <Ionicons name="chevron-forward" size={14} color="#64748B" style={{ marginLeft: 4 }} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            // ==========================================
            // DAY CLOSED STATE: Start Day with CURRENT DATE ONLY
            // ==========================================
            <View style={styles.body}>
              <Text style={styles.bodySubtitle}>
                Open the business day to enable POS billing and Kiosk vehicle wash operations.
              </Text>

              {/* Current Date Card with Locked Badge */}
              <View style={styles.dateSelectionCard}>
                <View style={styles.dateSelectionHeader}>
                  <Text style={styles.dateSelectionLabel}>BUSINESS DATE</Text>
                  <View style={styles.currentDateBadge}>
                    <Text style={styles.currentDateBadgeText}>CURRENT DATE ONLY</Text>
                  </View>
                </View>

                {/* Date Display Row */}
                <View style={styles.dateDisplayRow}>
                  <View style={styles.calendarIconCircle}>
                    <Ionicons name="calendar-outline" size={20} color="#0F172A" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.formattedDateText}>{formatFriendlyDate(todayStr)}</Text>
                    <Text style={styles.dateSubtext}>Today's operational business date</Text>
                  </View>
                </View>

                {/* Calendar Input: Locked with min={todayStr} and max={todayStr} */}
                <View style={styles.inputContainer}>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={todayStr}
                      min={todayStr}
                      max={todayStr}
                      readOnly
                      style={{
                        padding: '12px 14px',
                        fontSize: '15px',
                        borderRadius: '10px',
                        border: '1.5px solid #E2E8F0',
                        backgroundColor: '#F8FAFC',
                        color: '#0F172A',
                        fontWeight: '700',
                        width: '100%',
                        boxSizing: 'border-box',
                        outline: 'none',
                        cursor: 'default',
                        userSelect: 'none',
                      }}
                    />
                  ) : (
                    <TextInput
                      style={styles.nativeInput}
                      value={todayStr}
                      editable={false}
                    />
                  )}
                </View>
              </View>

              {/* Operator info row */}
              <View style={styles.operatorRow}>
                <Text style={styles.operatorLabel}>Operator:</Text>
                <Text style={styles.operatorValue}>
                  {user?.userName || user?.userCode || 'Cashier'}
                </Text>
              </View>

              {errorMsg ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                </View>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={closeModal}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.startDayBtn, loading && styles.btnDisabled]}
                  onPress={handleStartDay}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <View style={styles.btnContentRow}>
                      <Ionicons name="play" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.startDayBtnText}>Start Day</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {onViewHistory && (
                <TouchableOpacity
                  style={styles.modalHistoryLink}
                  onPress={() => {
                    closeModal();
                    onViewHistory();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.historyLinkRow}>
                    <Ionicons name="time-outline" size={15} color="#475569" style={{ marginRight: 6 }} />
                    <Text style={styles.modalHistoryLinkText}>View Previous Days & History</Text>
                    <Ionicons name="chevron-forward" size={14} color="#64748B" style={{ marginLeft: 4 }} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 9999,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    width: '100%',
    maxWidth: 460,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any) : {}),
  },

  // Body
  body: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  bodySubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 19,
    marginBottom: 20,
  },

  // Date banner (for Day Open)
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  dateBannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.7,
  },
  dateBannerValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },
  metricCardSales: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 16,
    padding: 16,
  },
  metricCardWashes: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    padding: 16,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabelSales: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.6,
  },
  metricLabelWashes: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.6,
  },
  metricValueSales: {
    fontSize: 28,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: -0.5,
  },
  metricValueWashes: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1D4ED8',
    letterSpacing: -0.5,
  },
  metricHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
  },

  // Date Selection Card (for Start Day)
  dateSelectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  dateSelectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateSelectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  currentDateBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  currentDateBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.4,
  },
  dateDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formattedDateText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  dateSubtext: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  inputContainer: {
    marginTop: 4,
  },
  nativeInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
  },

  // Operator Row
  operatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  operatorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  operatorValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Errors
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  startDayBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  startDayBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  endDayBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#E60012',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E60012',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  endDayBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  modalHistoryLink: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  historyLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHistoryLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
});
