import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { WashingBay } from '../../../types/pos.types';
import {
  IconSettings,
  IconClock,
  IconGrid,
  VehicleSplashBlackSuv,
  VehicleSplashWhiteSedan,
  VehicleSplashBlueSuv,
  VehicleAvailableSparkle,
} from '../../../components/common/AppIcons';

interface BayOverviewCardsProps {
  bays: WashingBay[];
  onSelectBay: (bay: WashingBay) => void;
  onManageBays?: () => void;
}

export const BayOverviewCards: React.FC<BayOverviewCardsProps> = ({
  bays,
  onSelectBay,
  onManageBays,
}) => {
  const [hoveredBay, setHoveredBay] = useState<string | null>(null);

  // Exactly 5 bays
  const displayBays = bays.slice(0, 5);
  const occupiedCount = displayBays.filter((b) => b.status === 'IN_SERVICE').length;
  const availableCount = displayBays.length - occupiedCount;

  const getBayVehicleGraphic = (bay: WashingBay) => {
    if (bay.status !== 'IN_SERVICE') {
      return <VehicleAvailableSparkle size={64} />;
    }
    if (bay.id.includes('1') || bay.bayNumber === 1) {
      return <VehicleSplashBlackSuv width="100%" height={70} />;
    }
    if (bay.id.includes('2') || bay.bayNumber === 2) {
      return <VehicleSplashWhiteSedan width="100%" height={70} />;
    }
    if (bay.id.includes('3') || bay.bayNumber === 3) {
      return <VehicleSplashBlueSuv width="100%" height={70} />;
    }
    return <VehicleSplashBlackSuv width="100%" height={70} />;
  };

  const getBayAvatar = (bay: WashingBay) => {
    const name = (bay.customerName || '').trim();
    if (name && name !== 'No Vehicle') {
      const parts = name.split(/\s+/);
      const initials = parts.length > 1
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : name.slice(0, 2).toUpperCase();
      const colors = ['#DC2626', '#3B82F6', '#059669', '#7C3AED', '#EA580C'];
      const bg = colors[((bay.bayNumber || 1) - 1) % colors.length];
      return { initials, bg };
    }
    return { initials: 'CB', bg: '#64748B' };
  };

  const getBayProgress = (bay: WashingBay) => {
    if (bay.status !== 'IN_SERVICE') return 0;
    if (bay.id.includes('1') || bay.bayNumber === 1) return 65;
    if (bay.id.includes('2') || bay.bayNumber === 2) return 35;
    if (bay.id.includes('3') || bay.bayNumber === 3) return 25;
    return 40;
  };

  return (
    <View style={styles.container}>
      {/* Header Row: Icon, Title, Live Status Pills & Manage Bays Button */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.iconBox}>
            <IconGrid size={18} color="#FFFFFF" strokeWidth={2.4} />
          </View>
          <View>
            <View style={styles.titleWithBadge}>
              <Text style={styles.sectionTitle}>Bay Overview</Text>
              <View style={styles.baySummaryChip}>
                <View style={styles.activeDot} />
                <Text style={styles.baySummaryChipText}>
                  {occupiedCount} In Service • {availableCount} Available
                </Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>
              Real-time washing bay occupancy & automated cycle progress
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.manageBaysBtn}
          onPress={onManageBays}
          activeOpacity={0.8}
        >
          <IconSettings size={15} color="#ED0712" strokeWidth={2.4} />
          <Text style={styles.manageText}>Manage Bays</Text>
        </TouchableOpacity>
      </View>

      {/* Exactly FIVE Bay Cards in One Horizontal Row */}
      <View style={styles.baysRow}>
        {displayBays.map((bay) => {
          const isOccupied = bay.status === 'IN_SERVICE';
          const avatar = getBayAvatar(bay);
          const progress = getBayProgress(bay);
          const isHovered = hoveredBay === bay.id;

          return (
            <TouchableOpacity
              key={bay.id}
              style={[
                styles.bayCard,
                isOccupied ? styles.bayCardOccupied : styles.bayCardAvailable,
                isHovered && styles.bayCardHovered,
              ]}
              onPress={() => onSelectBay(bay)}
              activeOpacity={0.85}
              // @ts-ignore
              onMouseEnter={() => setHoveredBay(bay.id)}
              // @ts-ignore
              onMouseLeave={() => setHoveredBay(null)}
            >
              {/* Card Header: Red Vertical Tag + Bay Name, and Status Pill */}
              <View style={styles.cardHeader}>
                <View style={styles.bayTagGroup}>
                  <View style={[styles.redVerticalTag, !isOccupied && styles.grayVerticalTag]} />
                  <Text style={styles.bayNameText}>{bay.name}</Text>
                </View>

                {isOccupied ? (
                  <View style={styles.statusPillOccupied}>
                    <View style={styles.greenPulseDot} />
                    <Text style={styles.statusPillOccupiedText}>In Service</Text>
                  </View>
                ) : (
                  <View style={styles.statusPillAvailable}>
                    <View style={styles.slateDot} />
                    <Text style={styles.statusPillAvailableText}>Available</Text>
                  </View>
                )}
              </View>

              {/* Upper Body: Realistic 3D Vehicle Render with Water Splash */}
              <View style={[styles.vehicleVisualContainer, !isOccupied && styles.vehicleVisualEmpty]}>
                {getBayVehicleGraphic(bay)}
              </View>

              {/* Middle Body: Customer Details with Circular Avatar OR Empty State Text */}
              {isOccupied ? (
                <View style={styles.customerInfoBlock}>
                  <View style={styles.customerRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: avatar.bg }]}>
                      <Text style={styles.avatarText}>{avatar.initials}</Text>
                    </View>

                    <View style={styles.bayDetailsBlock}>
                      <Text numberOfLines={1} style={styles.customerName}>
                        {bay.customerName}
                      </Text>
                      <View style={styles.plateChip}>
                        <Text style={styles.vehiclePlateText}>{bay.vehiclePlate}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.packageRow}>
                    <Text style={styles.packageNameText}>{bay.packageName}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.availableInfoBlock}>
                  <Text style={styles.noVehicleTitle}>No Vehicle</Text>
                  <Text style={styles.readySubtitle}>Ready for Wash</Text>
                </View>
              )}

              {/* Card Footer: Start Time & Elapsed Duration */}
              <View style={styles.cardFooter}>
                <View style={styles.footerTimeItem}>
                  <IconClock
                    size={12}
                    color={isOccupied ? '#EF4444' : '#94A3B8'}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      styles.footerTimeText,
                      isOccupied ? styles.timeDark : styles.timeMuted,
                    ]}
                  >
                    {bay.startTime && bay.startTime !== '-' ? bay.startTime : '--:--'}
                  </Text>
                </View>

                <View style={styles.footerTimeItem}>
                  <IconClock
                    size={12}
                    color={isOccupied ? '#10B981' : '#94A3B8'}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      styles.footerDurationText,
                      isOccupied ? styles.durationGreen : styles.durationGrey,
                    ]}
                  >
                    {bay.duration && bay.duration !== '-' ? bay.duration : '--'}
                  </Text>
                </View>
              </View>

              {/* Progress Bar & Percentage */}
              <View style={styles.progressContainer}>
                {isOccupied && (
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressLabel}>Wash Cycle</Text>
                    <Text style={styles.progressPercentText}>{progress}%</Text>
                  </View>
                )}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress}%` },
                      !isOccupied && { backgroundColor: 'transparent' },
                    ]}
                  />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
        } as any)
      : { elevation: 3 }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    flexWrap: 'wrap',
    gap: 14,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#ED0712',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 14px rgba(237, 7, 18, 0.35)' } as any)
      : { elevation: 4 }),
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  baySummaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  baySummaryChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  sectionSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  manageBaysBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.2,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any)
      : {}),
  },
  manageText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#ED0712',
  },
  baysRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bayCard: {
    flex: 1,
    minHeight: 220,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
          cursor: 'pointer',
        } as any)
      : { elevation: 2 }),
  },
  bayCardOccupied: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  bayCardAvailable: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  bayCardHovered: {
    borderColor: '#ED0712',
    ...(Platform.OS === 'web'
      ? ({
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px -4px rgba(237, 7, 18, 0.18)',
        } as any)
      : {}),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  bayTagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  redVerticalTag: {
    width: 3.5,
    height: 16,
    backgroundColor: '#ED0712',
    borderRadius: 2,
  },
  grayVerticalTag: {
    backgroundColor: '#94A3B8',
  },
  bayNameText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  statusPillOccupied: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusPillOccupiedText: {
    color: '#047857',
    fontSize: 10.5,
    fontWeight: '800',
  },
  statusPillAvailable: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  slateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  statusPillAvailableText: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '800',
  },
  vehicleVisualContainer: {
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  vehicleVisualEmpty: {
    opacity: 0.65,
  },
  customerInfoBlock: {
    gap: 4,
    marginTop: 2,
    marginBottom: 6,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 4px rgba(0,0,0,0.1)' } as any)
      : {}),
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  bayDetailsBlock: {
    flex: 1,
  },
  customerName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  plateChip: {
    backgroundColor: '#0F172A',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  vehiclePlateText: {
    fontSize: 10,
    color: '#F8FAFC',
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  packageRow: {
    marginTop: 2,
  },
  packageNameText: {
    fontSize: 10.5,
    color: '#ED0712',
    fontWeight: '700',
  },
  availableInfoBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  noVehicleTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#334155',
  },
  readySubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerTimeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timeDark: {
    color: '#1E293B',
  },
  timeMuted: {
    color: '#94A3B8',
  },
  footerDurationText: {
    fontSize: 11,
    fontWeight: '800',
  },
  durationGreen: {
    color: '#059669',
  },
  durationGrey: {
    color: '#94A3B8',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  progressLabel: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  progressPercentText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ED0712',
  },
  progressTrack: {
    height: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ED0712',
    borderRadius: 3,
  },
});
