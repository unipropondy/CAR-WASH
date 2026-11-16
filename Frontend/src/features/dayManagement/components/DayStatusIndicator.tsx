import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

  const formattedDate = React.useMemo(() => {
    if (!businessDate) {
      const today = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(today.getDate())}.${pad(today.getMonth() + 1)}.${today.getFullYear()}`;
    }
    const clean = businessDate.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`;
    }
    const d = new Date(businessDate);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    }
    return businessDate;
  }, [businessDate]);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        compact && styles.containerCompact,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Business day is ${isOpen ? 'Started' : 'Closed'}`}
    >
      {/* 1. Red Calendar Icon Box */}
      <View style={[styles.calendarIconBox, compact && styles.calendarIconBoxCompact]}>
        <Ionicons name="calendar" size={compact ? 15 : 18} color="#FFFFFF" />
      </View>

      {/* 2. Bold Date (DD.MM.YYYY) */}
      <Text style={[styles.dateText, compact && styles.dateTextCompact]}>
        {formattedDate}
      </Text>

      {/* 3. Vertical Divider */}
      <View style={styles.verticalDivider} />

      {/* 4. Status Badge Pill */}
      <View
        style={[
          styles.statusPill,
          isOpen ? styles.statusPillOpen : styles.statusPillClosed,
          compact && styles.statusPillCompact,
        ]}
      >
        <Ionicons
          name={isOpen ? 'checkmark-circle' : 'close-circle'}
          size={compact ? 14 : 17}
          color={isOpen ? '#059669' : '#DC2626'}
        />
        <Text
          style={[
            styles.statusPillText,
            isOpen ? styles.statusPillTextOpen : styles.statusPillTextClosed,
            compact && styles.statusPillTextCompact,
          ]}
        >
          {isOpen ? 'Day Started' : 'Day Closed'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 4.5,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          userSelect: 'none',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.15s ease',
        } as any)
      : { elevation: 2 }),
  },
  containerCompact: {
    paddingLeft: 4,
    paddingRight: 6,
    paddingVertical: 3.5,
    borderRadius: 18,
  },
  calendarIconBox: {
    width: 33,
    height: 33,
    borderRadius: 10,
    backgroundColor: '#E60012',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 3px 10px rgba(230, 0, 18, 0.35)',
        } as any)
      : { elevation: 3 }),
  },
  calendarIconBoxCompact: {
    width: 27,
    height: 27,
    borderRadius: 8,
  },
  dateText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 9,
    marginRight: 2,
    letterSpacing: -0.2,
  },
  dateTextCompact: {
    fontSize: 12.5,
    marginLeft: 6,
  },
  verticalDivider: {
    width: 1.5,
    height: 18,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 9,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    borderWidth: 1.5,
    paddingHorizontal: 11,
    paddingVertical: 4.5,
  },
  statusPillCompact: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusPillOpen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#86EFAC',
  },
  statusPillClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 5,
    letterSpacing: -0.1,
  },
  statusPillTextCompact: {
    fontSize: 11.5,
    marginLeft: 4,
  },
  statusPillTextOpen: {
    color: '#047857',
  },
  statusPillTextClosed: {
    color: '#B91C1C',
  },
});

