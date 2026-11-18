import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DealerCreditSettlementView } from '../../backoffice/components/DealerCreditSettlementView';
import { DealerCreditHistoryView } from '../../backoffice/components/DealerCreditHistoryView';
import { DealerVehicleHistoryView } from '../../backoffice/components/DealerVehicleHistoryView';

export interface PosDealerManagementViewProps {
  cashierName?: string;
  onBackToOrders?: () => void;
  onToggleSidebar?: () => void;
}

type DealerSubTab = 'SETTLEMENT' | 'LEDGER' | 'FLEET';

export const PosDealerManagementView: React.FC<PosDealerManagementViewProps> = ({
  onBackToOrders,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<DealerSubTab>('SETTLEMENT');
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <View style={styles.container}>
      {/* ── TOP CONTROL & SUB-TAB HEADER ── */}
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={styles.titleWithIcon}>
            <View style={styles.headerIconBox}>
              <Ionicons name="business" size={20} color="#ED0712" />
            </View>
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.pageTitle}>Dealer Management</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>COMMERCIAL CREDIT</Text>
                </View>
              </View>
              <Text style={styles.pageSubtitle}>
                Manage commercial dealer credit accounts, track unpaid balances, and process payment settlements.
              </Text>
            </View>
          </View>

          {onBackToOrders && (
            <TouchableOpacity
              style={styles.backOrdersBtn}
              onPress={onBackToOrders}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={14} color="#FFFFFF" />
              <Text style={styles.backOrdersBtnText}>Back to Orders</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── SUB-TABS: PAY FLOW VS LEDGER VS FLEET ── */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeSubTab === 'SETTLEMENT' && styles.tabBtnActive]}
            onPress={() => setActiveSubTab('SETTLEMENT')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="cash-outline"
              size={15}
              color={activeSubTab === 'SETTLEMENT' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.tabBtnText, activeSubTab === 'SETTLEMENT' && styles.tabBtnTextActive]}>
              Settle Payment (Pay Flow)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeSubTab === 'LEDGER' && styles.tabBtnActive]}
            onPress={() => setActiveSubTab('LEDGER')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="receipt-outline"
              size={15}
              color={activeSubTab === 'LEDGER' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.tabBtnText, activeSubTab === 'LEDGER' && styles.tabBtnTextActive]}>
              Credit History & Ledger
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeSubTab === 'FLEET' && styles.tabBtnActive]}
            onPress={() => setActiveSubTab('FLEET')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="car-outline"
              size={15}
              color={activeSubTab === 'FLEET' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.tabBtnText, activeSubTab === 'FLEET' && styles.tabBtnTextActive]}>
              Fleet Vehicles & Visits
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── ACTIVE SUB-VIEW CONTENT ── */}
      <View style={styles.contentCard}>
        {activeSubTab === 'SETTLEMENT' && <DealerCreditSettlementView theme="light" />}
        {activeSubTab === 'LEDGER' && <DealerCreditHistoryView theme="light" />}
        {activeSubTab === 'FLEET' && <DealerVehicleHistoryView theme="light" />}
      </View>
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
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
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
    marginBottom: 14,
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
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  badge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  pageSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
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
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    paddingTop: 2,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtnActive: {
    backgroundColor: '#ED0712',
    borderColor: '#ED0712',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  contentCard: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 600,
    backgroundColor: 'transparent',
  },
});
