import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface ScreenNameBadgeProps {
  name: string;
  variant?: 'light' | 'dark' | 'header';
  style?: any;
}

export const ScreenNameBadge: React.FC<ScreenNameBadgeProps> = ({
  name,
  variant = 'light',
  style,
}) => {
  const isDark = variant === 'dark';
  const isHeader = variant === 'header';

  return (
    <View
      style={[
        styles.badgeContainer,
        isDark && styles.badgeDark,
        isHeader && styles.badgeHeader,
        style,
      ]}
      testID="tsx-screen-badge"
      accessibilityRole="text"
      accessibilityLabel={`TSX Screen: ${name}`}
    >
      <View style={[styles.dot, isDark && styles.dotDark, isHeader && styles.dotHeader]} />
      <Text
        style={[styles.badgeText, isDark && styles.badgeTextDark, isHeader && styles.badgeTextHeader]}
        testID="tsx-screen-name"
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as any) : {}),
  },
  badgeDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: '#334155',
  },
  badgeHeader: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  dotDark: {
    backgroundColor: '#38BDF8',
  },
  dotHeader: {
    backgroundColor: '#DC2626',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : Platform.OS === 'android' ? 'monospace' : 'monospace',
    letterSpacing: 0.3,
  },
  badgeTextDark: {
    color: '#E2E8F0',
  },
  badgeTextHeader: {
    color: '#B91C1C',
  },
});
