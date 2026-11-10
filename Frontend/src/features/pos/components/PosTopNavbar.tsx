import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { IconSearch, IconMenu, IconBell } from '../../../components/common/AppIcons';

interface PosTopNavbarProps {
  onSearch?: (query: string) => void;
  onToggleSidebar?: () => void;
  cashierName?: string;
  onLogout?: () => void;
  onPressNotification?: () => void;
  unreadCount?: number;
}

export const PosTopNavbar: React.FC<PosTopNavbarProps> = ({
  onSearch,
  onToggleSidebar,
  cashierName = 'Cashier',
  onLogout,
  onPressNotification,
  unreadCount = 0,
}) => {
  return (
    <View style={styles.navbarContainer}>
      {/* Left side: Menu Button, Orders Title, and Search Input */}
      <View style={styles.leftSection}>
        {/* Menu Icon Button replacing W logo */}
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={onToggleSidebar}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Toggle side menu"
        >
          <IconMenu size={20} color="#FFFFFF" strokeWidth={2.4} />
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.pageTitle}>Orders</Text>

        {/* Rounded Search Input matching screenshot */}
        <View style={styles.searchBox}>
          <View style={{ marginRight: 10 }}>
            <IconSearch size={15} color="#94A3B8" strokeWidth={2.2} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search order, customer or plate"
            placeholderTextColor="#94A3B8"
            onChangeText={onSearch}
          />
        </View>
      </View>

      {/* Right side: Notification button & Cashier profile */}
      <View style={styles.rightSection}>
        {/* Notification Button */}
        <TouchableOpacity
          style={styles.notificationBtn}
          onPress={onPressNotification}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <IconBell size={19} color="#334155" strokeWidth={2.2} />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Cashier avatar CS + Cashier label */}
        <TouchableOpacity
          style={styles.cashierProfile}
          activeOpacity={0.75}
          onPress={onLogout}
          accessibilityRole="button"
          accessibilityLabel="Cashier profile / logout"
        >
          <View style={styles.cashierAvatar}>
            <Text style={styles.cashierAvatarText}>CS</Text>
          </View>
          <Text style={styles.cashierLabel}>{cashierName}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navbarContainer: {
    height: 64,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    width: '100%',
    zIndex: 10,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 14,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginLeft: 24,
    width: 340,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    padding: 0,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  notificationBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#E60012',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E60012',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  cashierProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cashierAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashierAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  cashierLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
});
