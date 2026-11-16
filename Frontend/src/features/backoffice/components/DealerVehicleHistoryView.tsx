import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchDealerVehicleHistorySummary,
  fetchDealerDetailedVisits,
  DealerVehicleHistorySummary,
  DealerDetailedVisit,
} from '../../../services/dealerApi';
import { RED_BAY_COLORS } from '../../../theme/colors';

type ActiveTab = 'SUMMARY' | 'DETAILED';

export const DealerVehicleHistoryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('SUMMARY');
  const [summaries, setSummaries] = useState<DealerVehicleHistorySummary[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<number | undefined>(undefined);
  const [visits, setVisits] = useState<DealerDetailedVisit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumData, visitData] = await Promise.all([
        fetchDealerVehicleHistorySummary(),
        fetchDealerDetailedVisits(selectedDealerId, searchQuery.trim()),
      ]);
      setSummaries(sumData);
      setVisits(visitData);
    } catch (err: any) {
      console.warn('[DealerVehicleHistoryView] loadData error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDealerId]);

  const handleSearchSubmit = () => {
    loadData();
  };

  const handleSelectDealerAndShowVisits = (dealerId: number) => {
    setSelectedDealerId(dealerId);
    setActiveTab('DETAILED');
  };

  const formatDateTime = (dtStr?: string) => {
    if (!dtStr) return '-';
    try {
      const d = new Date(dtStr);
      return d.toLocaleDateString('en-SG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dtStr;
    }
  };

  const selectedDealerSummary = useMemo(() => {
    if (!selectedDealerId) return null;
    return summaries.find((s) => s.dealerId === selectedDealerId) || null;
  }, [summaries, selectedDealerId]);

  const getStatusBadge = (status?: string) => {
    const s = (status || 'PENDING').toUpperCase();
    if (s === 'PAID') {
      return { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#22C55E', label: 'PAID' };
    }
    if (s === 'PARTIALLY_PAID') {
      return { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', text: '#3B82F6', label: 'PARTIALLY PAID' };
    }
    return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#F59E0B', label: 'PENDING' };
  };

  return (
    <View style={styles.container}>
      {/* ── TOP TOGGLE TABS ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'SUMMARY' && styles.tabBtnActive]}
          onPress={() => setActiveTab('SUMMARY')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="stats-chart-outline"
            size={16}
            color={activeTab === 'SUMMARY' ? '#FFFFFF' : '#94A3B8'}
          />
          <Text style={[styles.tabBtnText, activeTab === 'SUMMARY' && styles.tabBtnTextActive]}>
            Dealer Fleet & Visit Counts Summary
          </Text>
          <View style={[styles.tabBadge, activeTab === 'SUMMARY' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'SUMMARY' && styles.tabBadgeTextActive]}>
              {summaries.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'DETAILED' && styles.tabBtnActive]}
          onPress={() => setActiveTab('DETAILED')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="car-outline"
            size={16}
            color={activeTab === 'DETAILED' ? '#FFFFFF' : '#94A3B8'}
          />
          <Text style={[styles.tabBtnText, activeTab === 'DETAILED' && styles.tabBtnTextActive]}>
            Detailed Vehicle Visit History {selectedDealerSummary ? `(${selectedDealerSummary.dealerName})` : '(All Dealers)'}
          </Text>
          <View style={[styles.tabBadge, activeTab === 'DETAILED' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'DETAILED' && styles.tabBadgeTextActive]}>
              {visits.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ══════════════════════════════════════════════════════════
          VIEW 1: DEALER FLEET & VISIT COUNTS SUMMARY (FULL SCREEN)
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'SUMMARY' && (
        <View style={styles.fullScreenCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Dealer Fleet & Visit Counts Summary</Text>
              <Text style={styles.sectionSub}>
                Commercial dealer accounts, serviced fleet counts, visits, and balance totals. Click any dealer or 'Filter Visits' to inspect their full vehicle logs.
              </Text>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
              <Ionicons name="refresh" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {loading && summaries.length === 0 ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
              <Text style={styles.loadingText}>Loading dealer vehicle summaries...</Text>
            </View>
          ) : summaries.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="business-outline" size={44} color="#64748B" />
              <Text style={styles.emptyTitle}>No Dealer Summary Records</Text>
              <Text style={styles.emptySub}>No commercial dealer accounts found.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.horizontalScroll}>
              <View style={styles.tableInnerWrapper}>
                {/* Summary Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.th, { width: 170 }]}>Dealer Name</Text>
                  <Text style={[styles.th, { width: 110, textAlign: 'center' }]}>Total Visits</Text>
                  <Text style={[styles.th, { width: 140, textAlign: 'center' }]}>Vehicles Serviced</Text>
                  <Text style={[styles.th, { width: 110, textAlign: 'center' }]}>Total Orders</Text>
                  <Text style={[styles.th, { width: 130, textAlign: 'right' }]}>Total Amount</Text>
                  <Text style={[styles.th, { width: 130, textAlign: 'right' }]}>Total Paid</Text>
                  <Text style={[styles.th, { width: 130, textAlign: 'right' }]}>Outstanding</Text>
                  <Text style={[styles.th, { width: 160 }]}>Last Visit Date</Text>
                  <Text style={[styles.th, { width: 130, textAlign: 'center' }]}>Action</Text>
                </View>

                {/* Full-Height Summary Table Rows */}
                <ScrollView style={styles.tableBodyScroll} showsVerticalScrollIndicator={true}>
                  {summaries.map((s, idx) => {
                    const isSelected = selectedDealerId === s.dealerId;
                    const isEven = idx % 2 === 0;

                    return (
                      <TouchableOpacity
                        key={s.dealerId}
                        style={[
                          styles.tableRow,
                          isEven && styles.tableRowEven,
                          isSelected && styles.tableRowSelected,
                        ]}
                        onPress={() => handleSelectDealerAndShowVisits(s.dealerId)}
                        activeOpacity={0.8}
                      >
                        {/* Dealer Name */}
                        <View style={{ width: 170 }}>
                          <Text style={[styles.cellBold, isSelected && { color: '#38BDF8' }]}>
                            {s.dealerName}
                          </Text>
                          <Text style={styles.cellMuted}>{s.uniqueCode}</Text>
                        </View>

                        {/* Total Visits Badge */}
                        <View style={{ width: 110, alignItems: 'center' }}>
                          <View style={styles.visitCountBadge}>
                            <Text style={styles.visitCountBadgeText}>{s.totalVisits}</Text>
                          </View>
                        </View>

                        {/* Total Vehicles Serviced */}
                        <View style={{ width: 140, alignItems: 'center' }}>
                          <View style={styles.vehicleCountTag}>
                            <Ionicons name="car" size={13} color="#38BDF8" style={{ marginRight: 5 }} />
                            <Text style={styles.vehicleCountText}>{s.totalVehiclesServiced} cars</Text>
                          </View>
                        </View>

                        {/* Total Orders */}
                        <Text style={[styles.cellText, { width: 110, textAlign: 'center' }]}>
                          {s.totalOrders}
                        </Text>

                        {/* Total Amount */}
                        <Text style={[styles.cellBold, { width: 130, textAlign: 'right' }]}>
                          ${s.totalAmount.toFixed(2)}
                        </Text>

                        {/* Total Paid */}
                        <Text style={[styles.cellBold, { width: 130, textAlign: 'right', color: '#22C55E' }]}>
                          ${s.totalPaidAmount.toFixed(2)}
                        </Text>

                        {/* Outstanding */}
                        <Text
                          style={[
                            styles.cellBold,
                            {
                              width: 130,
                              textAlign: 'right',
                              color: s.totalOutstandingCredit > 0 ? '#F59E0B' : '#22C55E',
                            },
                          ]}
                        >
                          ${s.totalOutstandingCredit.toFixed(2)}
                        </Text>

                        {/* Last Visit Date */}
                        <Text style={[styles.cellMuted, { width: 160 }]}>
                          {formatDateTime(s.lastVisitDate || undefined)}
                        </Text>

                        {/* Action: Click to Filter & View Full Logs */}
                        <View style={{ width: 130, alignItems: 'center' }}>
                          <TouchableOpacity
                            style={[styles.filterBtn, isSelected && styles.filterBtnActive]}
                            onPress={() => handleSelectDealerAndShowVisits(s.dealerId)}
                          >
                            <Ionicons
                              name="list"
                              size={12}
                              color={isSelected ? '#0A0A0A' : '#38BDF8'}
                              style={{ marginRight: 4 }}
                            />
                            <Text style={[styles.filterBtnText, isSelected && styles.filterBtnTextActive]}>
                              View Visits
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════
          VIEW 2: DETAILED VEHICLE VISIT HISTORY (FULL SCREEN)
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'DETAILED' && (
        <View style={styles.fullScreenCard}>
          <View style={styles.detailedHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>
                Detailed Vehicle Visit History
                {selectedDealerSummary ? ` — ${selectedDealerSummary.dealerName}` : ' (All Dealers)'}
              </Text>
              <Text style={styles.sectionSub}>
                {visits.length} vehicle service visit record(s) logged in the system.
              </Text>
            </View>

            <View style={styles.headerControlsRight}>
              {selectedDealerId && (
                <TouchableOpacity
                  style={styles.clearFilterChip}
                  onPress={() => setSelectedDealerId(undefined)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearFilterChipText}>
                    Dealer: {selectedDealerSummary?.dealerName || `#${selectedDealerId}`}
                  </Text>
                  <Ionicons name="close-circle" size={14} color="#38BDF8" />
                </TouchableOpacity>
              )}

              <View style={styles.searchBox}>
                <Ionicons name="search" size={15} color="#64748B" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search bill#, plate..."
                  placeholderTextColor="#64748B"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearchSubmit}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); loadData(); }}>
                    <Ionicons name="close-circle" size={14} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
                <Ionicons name="refresh" size={15} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
              <Text style={styles.loadingText}>Loading vehicle visit records...</Text>
            </View>
          ) : visits.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="car-outline" size={44} color="#64748B" />
              <Text style={styles.emptyTitle}>No Visit History Recorded</Text>
              <Text style={styles.emptySub}>
                No vehicle service records match the current view or search query.
              </Text>
              {selectedDealerId && (
                <TouchableOpacity
                  style={styles.showAllBtn}
                  onPress={() => setSelectedDealerId(undefined)}
                >
                  <Text style={styles.showAllBtnText}>Show All Dealers</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.horizontalScroll}>
              <View style={styles.tableInnerWrapper}>
                {/* Detailed Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.th, { width: 150 }]}>Visit Date & Time</Text>
                  <Text style={[styles.th, { width: 140 }]}>Bill Number</Text>
                  <Text style={[styles.th, { width: 150 }]}>Dealer</Text>
                  <Text style={[styles.th, { width: 120 }]}>Vehicle Plate</Text>
                  <Text style={[styles.th, { width: 110 }]}>Vehicle Type</Text>
                  <Text style={[styles.th, { width: 180 }]}>Package Selected</Text>
                  <Text style={[styles.th, { width: 160 }]}>Additional Services</Text>
                  <Text style={[styles.th, { width: 110, textAlign: 'right' }]}>Total Amount</Text>
                  <Text style={[styles.th, { width: 130, textAlign: 'center' }]}>Payment Status</Text>
                </View>

                {/* Full-Height Detailed Table Rows */}
                <ScrollView style={styles.tableBodyScroll} showsVerticalScrollIndicator={true}>
                  {visits.map((v, idx) => {
                    const b = getStatusBadge(v.paymentStatus);
                    const isEven = idx % 2 === 0;

                    return (
                      <View key={v.orderId || idx} style={[styles.tableRow, isEven && styles.tableRowEven]}>
                        {/* Visit Date & Time */}
                        <Text style={[styles.cellText, { width: 150 }]}>{formatDateTime(v.visitDateTime)}</Text>

                        {/* Bill Number */}
                        <Text style={[styles.cellBold, { width: 140, color: '#38BDF8' }]}>{v.billNumber}</Text>

                        {/* Dealer */}
                        <Text style={[styles.cellText, { width: 150 }]} numberOfLines={1}>{v.dealerName}</Text>

                        {/* Vehicle Number */}
                        <View style={{ width: 120 }}>
                          <View style={styles.plateTag}>
                            <Text style={styles.plateText}>{v.vehicleNumber}</Text>
                          </View>
                        </View>

                        {/* Vehicle Type */}
                        <Text style={[styles.cellText, { width: 110 }]}>{v.vehicleType}</Text>

                        {/* Package Selected */}
                        <Text style={[styles.cellText, { width: 180 }]} numberOfLines={1}>{v.packageSelected}</Text>

                        {/* Additional Services */}
                        <Text style={[styles.cellMuted, { width: 160 }]} numberOfLines={1}>{v.additionalServices || '-'}</Text>

                        {/* Total Amount */}
                        <Text style={[styles.cellBold, { width: 110, textAlign: 'right' }]}>${v.totalAmount.toFixed(2)}</Text>

                        {/* Payment Status */}
                        <View style={{ width: 130, alignItems: 'center' }}>
                          <View style={[styles.statusBadge, { backgroundColor: b.bg, borderColor: b.border }]}>
                            <Text style={[styles.statusBadgeText, { color: b.text }]}>{b.label}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 14,
    backgroundColor: '#0A0A0A',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255,26,26,0.18)',
    borderColor: RED_BAY_COLORS.primary,
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: RED_BAY_COLORS.primary,
  },
  tabBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94A3B8',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },
  fullScreenCard: {
    flex: 1,
    backgroundColor: '#161616',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  detailedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerControlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    maxWidth: 700,
  },
  refreshBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 8,
    borderRadius: 6,
  },
  clearFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  clearFilterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchInput: {
    color: '#FFFFFF',
    fontSize: 12,
    width: 170,
  },
  horizontalScroll: {
    flex: 1,
  },
  tableInnerWrapper: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  th: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tableBodyScroll: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  tableRowEven: {
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  tableRowSelected: {
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
  },
  cellText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  cellBold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cellMuted: {
    fontSize: 11,
    color: '#64748B',
  },
  visitCountBadge: {
    backgroundColor: 'rgba(255,26,26,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,26,26,0.3)',
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 12,
  },
  visitCountBadgeText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  vehicleCountTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  vehicleCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  filterBtnActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  filterBtnText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
  },
  filterBtnTextActive: {
    color: '#0A0A0A',
    fontWeight: '800',
  },
  plateTag: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  plateText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  centerBox: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 6,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
  },
  showAllBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(56,189,248,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
  },
  showAllBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
});
