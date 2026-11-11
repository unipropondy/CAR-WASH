import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useDayManagementStore } from '../store/dayManagementStore';

interface DayStatusIndicatorProps {
  onPress?: () => void;
  compact?: boolean;
}

export const DayStatusIndicator: React.FC<DayStatusIndicatorProps> = ({ onPress, compact = false }) => {
  const isOpen = useDayManagementStore((state) => state.isOpen);
  const activeDayId = useDayManagementStore((state) => state.activeDayId);
  const businessDate = useDayManagementStore((state) => state.businessDate);
  const checkStatus = useDayManagementStore((state) => state.checkStatus);
  const openModal = useDayManagementStore((state) => state.openModal);

  useEffect(() => {
    checkStatus();
    // Periodic refresh every 30 seconds
    const interval = setInterval(() => {
      checkStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      openModal();
    }
  };

  const formattedDate = businessDate
    ? new Date(businessDate).toLocaleDateString('en-SG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isOpen ? styles.containerOpen : styles.containerClosed,
        compact && styles.containerCompact,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Business day is ${isOpen ? 'OPEN' : 'CLOSED'}`}
    >
      <View style={[styles.dot, isOpen ? styles.dotOpen : styles.dotClosed]} />
      <View style={styles.textContainer}>
        <Text style={[styles.statusText, isOpen ? styles.textOpen : styles.textClosed]}>
          {isOpen ? `Day #${activeDayId || 1} OPEN` : 'Day CLOSED'}
        </Text>
        {!compact && formattedDate ? (
          <Text style={styles.dateText}>{formattedDate}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    ...(Platform.OS === 'web'
      ? {
          cursor: 'pointer' as any,
          userSelect: 'none' as any,
          transition: 'all 0.2s ease',
        }
      : {}),
  },
  containerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  containerOpen: {
    backgroundColor: '#F0FDF4',
    borderColor: '#22C55E',
  },
  containerClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#E60012',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotOpen: {
    backgroundColor: '#16A34A',
  },
  dotClosed: {
    backgroundColor: '#E60012',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textOpen: {
    color: '#15803D',
  },
  textClosed: {
    color: '#B91C1C',
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
});

