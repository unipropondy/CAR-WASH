import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { makeShadow } from '../../../theme/shadows';
import {
  IconSummaryTotalOrders,
  IconSummaryCompletedBadge,
  IconSummaryInServiceCarWash,
  IconSummaryPendingHourglass,
} from '../../../components/common/AppIcons';

interface PosSummaryCardsProps {
  totalOrders?: number;
  completedCount?: number;
  inServiceCount?: number;
  pendingCount?: number;
}

export const PosSummaryCards: React.FC<PosSummaryCardsProps> = ({
  totalOrders = 6,
  completedCount = 2,
  inServiceCount = 3,
  pendingCount = 1,
}) => {
  return (
    <View style={styles.gridContainer}>
      {/* 1. Total Orders Card - Clipboard Checklist Icon */}
      <View style={styles.summaryCard}>
        {/* Subtle decorative bottom-right curve */}
        <View style={[styles.decorBlob, styles.decorBlobRed]} />

        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, styles.iconBoxRed]}>
            <IconSummaryTotalOrders size={22} color="#FFFFFF" strokeWidth={2} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>Total Orders</Text>
            <View style={styles.valueRow}>
              <Text style={styles.cardValue}>{totalOrders}</Text>
              <Text style={styles.trendGreen}>↗ +20%</Text>
            </View>
            <Text style={styles.cardSubtitle}>Today's Orders</Text>
          </View>
        </View>

        {/* Mini Bar Chart */}
        <View style={styles.chartBars}>
          <View style={[styles.bar, { height: 10, backgroundColor: '#FECACA' }]} />
          <View style={[styles.bar, { height: 16, backgroundColor: '#FCA5A5' }]} />
          <View style={[styles.bar, { height: 20, backgroundColor: '#F87171' }]} />
          <View style={[styles.bar, { height: 26, backgroundColor: '#E50914' }]} />
        </View>
      </View>

      {/* 2. Completed Card - Scalloped Verified Check Badge */}
      <View style={styles.summaryCard}>
        <View style={[styles.decorBlob, styles.decorBlobGreen]} />

        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, styles.iconBoxGreen]}>
            <IconSummaryCompletedBadge size={22} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>Completed</Text>
            <View style={styles.valueRow}>
              <Text style={styles.cardValue}>{completedCount}</Text>
              <Text style={styles.trendGreen}>↗ +100%</Text>
            </View>
            <Text style={styles.cardSubtitle}>Finished Washes</Text>
          </View>
        </View>

        {/* Mini Bar Chart */}
        <View style={styles.chartBars}>
          <View style={[styles.bar, { height: 10, backgroundColor: '#A7F3D0' }]} />
          <View style={[styles.bar, { height: 16, backgroundColor: '#6EE7B7' }]} />
          <View style={[styles.bar, { height: 20, backgroundColor: '#34D399' }]} />
          <View style={[styles.bar, { height: 26, backgroundColor: '#059669' }]} />
        </View>
      </View>

      {/* 3. In Service Card - Car with Bubbles / Wash Foam */}
      <View style={styles.summaryCard}>
        <View style={[styles.decorBlob, styles.decorBlobRed]} />

        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, styles.iconBoxRed]}>
            <IconSummaryInServiceCarWash size={22} color="#FFFFFF" strokeWidth={2} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>In Service</Text>
            <View style={styles.valueRow}>
              <Text style={styles.cardValue}>{inServiceCount}</Text>
            </View>
            <Text style={styles.cardSubtitle}>Currently Washing</Text>
          </View>
        </View>

        {/* Mini Bar Chart */}
        <View style={styles.chartBars}>
          <View style={[styles.bar, { height: 10, backgroundColor: '#FECACA' }]} />
          <View style={[styles.bar, { height: 16, backgroundColor: '#FCA5A5' }]} />
          <View style={[styles.bar, { height: 20, backgroundColor: '#F87171' }]} />
          <View style={[styles.bar, { height: 26, backgroundColor: '#E50914' }]} />
        </View>
      </View>

      {/* 4. Pending Card - Classic Symmetrical Hourglass */}
      <View style={styles.summaryCard}>
        <View style={[styles.decorBlob, styles.decorBlobRed]} />

        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, styles.iconBoxRed]}>
            <IconSummaryPendingHourglass size={22} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>Pending</Text>
            <View style={styles.valueRow}>
              <Text style={styles.cardValue}>{pendingCount}</Text>
            </View>
            <Text style={styles.cardSubtitle}>Waiting in Queue</Text>
          </View>
        </View>

        {/* Mini Bar Chart */}
        <View style={styles.chartBars}>
          <View style={[styles.bar, { height: 10, backgroundColor: '#FECACA' }]} />
          <View style={[styles.bar, { height: 16, backgroundColor: '#FCA5A5' }]} />
          <View style={[styles.bar, { height: 20, backgroundColor: '#F87171' }]} />
          <View style={[styles.bar, { height: 26, backgroundColor: '#E50914' }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.04, 8, 2),
    position: 'relative',
    overflow: 'hidden',
  },
  decorBlob: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    opacity: 0.45,
    pointerEvents: 'none' as any,
  },
  decorBlobRed: {
    backgroundColor: '#FEE2E2',
  },
  decorBlobGreen: {
    backgroundColor: '#D1FAE5',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.12, 4, 3),
  },
  iconBoxRed: {
    backgroundColor: '#E50914', // Red Bay signature red
  },
  iconBoxGreen: {
    backgroundColor: '#059669', // Verified emerald green
  },
  cardInfo: {
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  trendGreen: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  cardSubtitle: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3.5,
    height: 32,
    paddingRight: 4,
    zIndex: 2,
  },
  bar: {
    width: 3.5,
    borderRadius: 2,
  },
});

