import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { WashingBay } from '../../../types/pos.types';

interface WashingBayStatusGridProps {
  bays: WashingBay[];
  onSelectBay: (bay: WashingBay) => void;
  onClearBay: (bayId: string) => void;
  currentLanguage: 'EN' | 'ZH';
}

export const WashingBayStatusGrid: React.FC<WashingBayStatusGridProps> = ({
  bays,
  onSelectBay,
  onClearBay,
  currentLanguage,
}) => {
  const getStatusBadge = (status: WashingBay['status']) => {
    switch (status) {
      case 'VACANT':
        return {
          bg: '#ECFDF5',
          border: '#A7F3D0',
          text: '#059669',
          labelEn: 'VACANT',
          labelZh: '空闲可用',
        };
      case 'OCCUPIED':
        return {
          bg: '#EFF6FF',
          border: '#BFDBFE',
          text: '#2563EB',
          labelEn: 'IN WASH',
          labelZh: '清洗作业中',
        };
      case 'FINISHING':
        return {
          bg: '#FFFBEB',
          border: '#FDE68A',
          text: '#D97706',
          labelEn: 'DETAILING / DRYING',
          labelZh: '精洗收尾中',
        };
      default:
        return {
          bg: '#F4F5F7',
          border: '#E2E8F0',
          text: '#64748B',
          labelEn: 'MAINTENANCE',
          labelZh: '检修维护',
        };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <View style={styles.redIndicator} />
          <Text style={styles.sectionTitle}>
            {currentLanguage === 'EN' ? 'LIVE WASHING BAYS' : '实时工位监控'}
          </Text>
          <Text style={styles.bayCounterBadge}>{bays.length} BAYS</Text>
        </View>
        <Text style={styles.hintText}>
          {currentLanguage === 'EN' ? 'Tap bay to manage or assign vehicle' : '点击工位进行车辆分配或状态变更'}
        </Text>
      </View>

      <View style={styles.grid}>
        {bays.map((bay) => {
          const badge = getStatusBadge(bay.status);
          const isOccupied = bay.status === 'OCCUPIED' || bay.status === 'FINISHING';
          const progressPercent = bay.totalDurationSeconds && bay.elapsedSeconds 
            ? Math.min(100, Math.round((bay.elapsedSeconds / bay.totalDurationSeconds) * 100))
            : 0;

          return (
            <TouchableOpacity
              key={bay.id}
              style={[
                styles.bayCard,
                isOccupied && styles.bayCardOccupied,
                bay.status === 'VACANT' && styles.bayCardVacant,
              ]}
              onPress={() => onSelectBay(bay)}
              activeOpacity={0.85}
            >
              {/* Header: Name and Status */}
              <View style={styles.bayHeader}>
                <Text style={styles.bayName}>{bay.name}</Text>
                <View style={[styles.statusTag, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                  <Text style={[styles.statusText, { color: badge.text }]}>
                    {currentLanguage === 'EN' ? badge.labelEn : badge.labelZh}
                  </Text>
                </View>
              </View>

              {/* Bay Body Content */}
              {isOccupied ? (
                <View style={styles.occupiedContent}>
                  <View style={styles.plateContainer}>
                    <Text style={styles.plateLabel}>VEHICLE PLATE</Text>
                    <Text style={styles.plateNumber}>{bay.vehiclePlate || 'N/A'}</Text>
                  </View>

                  {/* Progress Bar & Elapsed Time */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressRow}>
                      <Text style={styles.progressLabel}>
                        {Math.floor((bay.elapsedSeconds || 0) / 60)}m / {Math.floor((bay.totalDurationSeconds || 900) / 60)}m
                      </Text>
                      <Text style={styles.progressPercent}>{progressPercent}%</Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View 
                        style={[
                          styles.progressBarFill, 
                          { 
                            width: `${progressPercent}%`,
                            backgroundColor: bay.status === 'FINISHING' ? '#F59E0B' : RED_BAY_COLORS.primary,
                          }
                        ]} 
                      />
                    </View>
                  </View>

                  {/* Action row */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity 
                      style={styles.finishBtn}
                      onPress={() => onClearBay(bay.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.finishBtnText}>
                        {currentLanguage === 'EN' ? 'Complete Wash' : '完成清洗'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.vacantContent}>
                  <Text style={styles.vacantIcon}>🚿</Text>
                  <Text style={styles.vacantHeading}>
                    {currentLanguage === 'EN' ? 'Bay Ready' : '工位待命'}
                  </Text>
                  <Text style={styles.vacantSub}>
                    {currentLanguage === 'EN' ? 'Ready for next vehicle' : '可立即分配排队车辆'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redIndicator: {
    width: 4,
    height: 16,
    backgroundColor: RED_BAY_COLORS.primary,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#080808',
    letterSpacing: 0.5,
  },
  bayCounterBadge: {
    backgroundColor: '#E2E8F0',
    color: '#475569',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hintText: {
    fontSize: 12,
    color: '#64748B',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  bayCard: {
    width: '31.8%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 180,
    justifyContent: 'space-between',
    ...makeShadow('#080808', { width: 0, height: 2 }, 0.04, 6, 2),
  },
  bayCardOccupied: {
    borderColor: '#CBD5E1',
    borderTopWidth: 3,
    borderTopColor: RED_BAY_COLORS.primary,
  },
  bayCardVacant: {
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#FAFAFA',
  },
  bayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bayName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#080808',
    flex: 1,
    marginRight: 6,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  occupiedContent: {
    justifyContent: 'space-between',
    flex: 1,
  },
  plateContainer: {
    backgroundColor: '#080808',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  plateLabel: {
    fontSize: 9,
    color: '#A1A1AA',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  plateNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  progressContainer: {
    marginBottom: 10,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: 11,
    color: '#080808',
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardActions: {
    marginTop: 4,
  },
  finishBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  finishBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  vacantContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  vacantIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  vacantHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  vacantSub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
});

