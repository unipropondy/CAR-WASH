import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { SalesMetrics } from '../../../types/pos.types';

interface MetricsSummaryCardsProps {
  metrics: SalesMetrics;
  currentLanguage: 'EN' | 'ZH';
}

export const MetricsSummaryCards: React.FC<MetricsSummaryCardsProps> = ({
  metrics,
  currentLanguage,
}) => {
  const cards = [
    {
      id: 'gross',
      labelEn: "Today's Gross Sales",
      labelZh: '今日营业额',
      value: `$ ${metrics.grossSalesToday.toFixed(2)}`,
      subEn: 'Incl. 9% GST',
      subZh: '含 9% 消费税',
      accentColor: RED_BAY_COLORS.primary,
      icon: '💰',
    },
    {
      id: 'serviced',
      labelEn: 'Vehicles Serviced',
      labelZh: '已完成洗车量',
      value: `${metrics.totalVehiclesServiced}`,
      subEn: 'Vehicles Out',
      subZh: '完成出场',
      accentColor: '#10B981',
      icon: '🚗',
    },
    {
      id: 'queue',
      labelEn: 'Active In Queue',
      labelZh: '当前排队等候',
      value: `${metrics.activeInQueue}`,
      subEn: 'Waiting Assignment',
      subZh: '等待进工位',
      accentColor: '#F59E0B',
      icon: '⏳',
    },
    {
      id: 'occupancy',
      labelEn: 'Bays Occupancy',
      labelZh: '工位使用率',
      value: `${metrics.activeBaysOccupancy}%`,
      subEn: 'Avg 14.5 mins / car',
      subZh: '平均每辆 14.5 分钟',
      accentColor: '#3B82F6',
      icon: '🚿',
    },
  ];

  return (
    <View style={styles.container}>
      {cards.map((card) => (
        <View key={card.id} style={styles.card}>
          {/* Top colored accent line */}
          <View style={[styles.cardAccent, { backgroundColor: card.accentColor }]} />

          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>
              {currentLanguage === 'EN' ? card.labelEn : card.labelZh}
            </Text>
            <Text style={styles.cardIcon}>{card.icon}</Text>
          </View>

          <Text style={styles.cardValue}>{card.value}</Text>

          <View style={styles.cardFooter}>
            <Text style={styles.cardSub}>
              {currentLanguage === 'EN' ? card.subEn : card.subZh}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...makeShadow('#080808', { width: 0, height: 2 }, 0.04, 8, 2),
    position: 'relative',
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardIcon: {
    fontSize: 18,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#080808',
    letterSpacing: 0.2,
  },
  cardFooter: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardSub: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
});

