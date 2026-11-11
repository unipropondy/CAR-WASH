import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import {
  IconClipboard,
  IconCarWashBay,
  IconUsers,
  IconReports,
  IconSettings,
} from '../../../components/common/AppIcons';

export type PosNavTab = 'ORDERS' | 'BAYS' | 'CUSTOMERS' | 'REPORTS' | 'SETTINGS';

interface PosSidebarProps {
  activeTab: PosNavTab;
  onSelectTab: (tab: PosNavTab) => void;
  orderCount?: number;
  currentMode?: 'POS' | 'KIOSK';
  onSwitchMode?: (mode: 'POS' | 'KIOSK') => void;
  onSwitchToKiosk?: () => void;
  onClose?: () => void;
}

// Decorative Red Swoosh for Top-Left Corner
const TopLeftCornerFlair = () => {
  if (Platform.OS === 'web') {
    return React.createElement(
      'svg',
      {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: 52,
          height: 105,
          pointerEvents: 'none',
          zIndex: 0,
        },
        viewBox: '0 0 52 105',
        fill: 'none',
      },
      React.createElement('path', {
        d: 'M0 0 H48 C38 16 20 34 11 54 C4 74 1 92 0 105 V0 Z',
        fill: '#E60012',
        opacity: 0.85,
      }),
      React.createElement('path', {
        d: 'M0 0 H32 C24 15 13 30 7 46 C2 62 1 80 0 92 V0 Z',
        fill: '#E60012',
      }),
      React.createElement('path', {
        d: 'M0 0 H16 C11 11 6 22 3 34 C1 46 0 58 0 70 V0 Z',
        fill: '#B91C1C',
      })
    );
  }
  return null;
};

// Decorative Red Swoosh for Bottom-Right Corner
const BottomRightCornerFlair = () => {
  if (Platform.OS === 'web') {
    return React.createElement(
      'svg',
      {
        style: {
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 52,
          height: 100,
          pointerEvents: 'none',
          zIndex: 0,
        },
        viewBox: '0 0 52 100',
        fill: 'none',
      },
      React.createElement('path', {
        d: 'M52 100 H4 C14 84 32 66 41 46 C48 26 51 8 52 0 V100 Z',
        fill: '#E60012',
        opacity: 0.85,
      }),
      React.createElement('path', {
        d: 'M52 100 H20 C28 85 39 70 45 54 C50 38 51 20 52 8 V100 Z',
        fill: '#E60012',
      }),
      React.createElement('path', {
        d: 'M52 100 H36 C41 89 46 78 49 66 C51 54 52 42 52 30 V100 Z',
        fill: '#B91C1C',
      })
    );
  }
  return null;
};

// Red Line-Art Car Icon for Station Information Card
const IconStationRedCar: React.FC<{ size?: number; color?: string }> = ({ size = 38, color = '#E60012' }) => {
  if (Platform.OS === 'web') {
    return React.createElement(
      'svg',
      {
        width: size,
        height: Math.round(size * 0.6),
        viewBox: '0 0 48 28',
        fill: 'none',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 },
      },
      React.createElement('path', {
        d: 'M3 18 C3 18 3 15 6 14 L12 13 L17 5 C18 3.5 20 3 23 3 L33 3 C36 3 38 4 40 7 L45 13 C47 14 47 16 47 17 L47 20 C47 21 46 21 45 21 L42.5 21 C42 18 39.5 16 36.5 16 C33.5 16 31 18 30.5 21 L18.5 21 C18 18 15.5 16 12.5 16 C9.5 16 7 18 6.5 21 L4 21 C3 21 3 19 3 18 Z',
        stroke: color,
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      React.createElement('circle', {
        cx: 12.5,
        cy: 20.5,
        r: 3.5,
        stroke: color,
        strokeWidth: 1.8,
        fill: '#FFFFFF',
      }),
      React.createElement('circle', {
        cx: 12.5,
        cy: 20.5,
        r: 1.2,
        fill: color,
      }),
      React.createElement('circle', {
        cx: 36.5,
        cy: 20.5,
        r: 3.5,
        stroke: color,
        strokeWidth: 1.8,
        fill: '#FFFFFF',
      }),
      React.createElement('circle', {
        cx: 36.5,
        cy: 20.5,
        r: 1.2,
        fill: color,
      }),
      React.createElement('path', {
        d: 'M18 12.5 L22.5 6 H32 C34 6 35.5 6.8 37 9 L40.5 12.5 Z',
        stroke: color,
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      React.createElement('line', {
        x1: 28,
        y1: 6,
        x2: 28,
        y2: 12.5,
        stroke: color,
        strokeWidth: 1.4,
      })
    );
  }
  return <Text style={{ fontSize: 16, color }}>🚗</Text>;
};

export const PosSidebar: React.FC<PosSidebarProps> = ({
  activeTab,
  onSelectTab,
  currentMode = 'POS',
  onSwitchMode,
  onSwitchToKiosk,
  onClose,
}) => {
  const navItems: { id: PosNavTab; label: string }[] = [
    { id: 'ORDERS', label: 'Orders' },
    { id: 'BAYS', label: 'Bays' },
    { id: 'CUSTOMERS', label: 'Customers' },
    { id: 'REPORTS', label: 'Reports' },
    { id: 'SETTINGS', label: 'Settings' },
  ];

  const handleKioskClick = () => {
    if (onSwitchToKiosk) {
      onSwitchToKiosk();
    } else if (onSwitchMode) {
      onSwitchMode('KIOSK');
    }
  };

  const handlePosClick = () => {
    if (onSwitchMode) {
      onSwitchMode('POS');
    }
  };

  const renderNavIcon = (id: PosNavTab, isActive: boolean) => {
    const iconColor = isActive ? '#FFFFFF' : '#111827';
    switch (id) {
      case 'ORDERS':
        return <IconClipboard size={16} color={iconColor} strokeWidth={2.2} />;
      case 'BAYS':
        return <IconCarWashBay size={16} color={iconColor} strokeWidth={2.2} />;
      case 'CUSTOMERS':
        return <IconUsers size={16} color={iconColor} strokeWidth={2.2} />;
      case 'REPORTS':
        return <IconReports size={16} color={iconColor} strokeWidth={2.2} />;
      case 'SETTINGS':
        return <IconSettings size={16} color={iconColor} strokeWidth={2.2} />;
    }
  };

  return (
    <View style={styles.sidebarContainer}>
      {/* Decorative Red Accents in Corners */}
      <TopLeftCornerFlair />
      <BottomRightCornerFlair />

      {/* Top Header Section: Logo, "Car Wash POS", and Close Button */}
      <View style={styles.headerSection}>
        {onClose && (
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Close side menu"
          >
            <Text style={styles.closeBtnIcon}>✕</Text>
          </TouchableOpacity>
        )}

        <View style={styles.brandHeader}>
          <View style={styles.logoBadgeContainer}>
            <Image
              source={require('../../../../assets/images/red_bay_badge.jpg')}
              style={styles.logoBadge}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.brandSubtitle}>Car Wash POS</Text>
        </View>
      </View>

      {/* Navigation Menu Items */}
      <View style={styles.navList}>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.navBtn, isActive ? styles.navBtnActive : styles.navBtnInactive]}
              onPress={() => onSelectTab(item.id)}
              activeOpacity={0.8}
            >
              <View style={styles.navIconBox}>
                {renderNavIcon(item.id, isActive)}
              </View>
              <Text style={[styles.navText, isActive ? styles.navTextActive : styles.navTextInactive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bottom Section: Application Mode Switcher & Station Details */}
      <View style={styles.bottomSection}>
        {/* Application Mode Control Card */}
        {(onSwitchMode || onSwitchToKiosk) && (
          <View style={styles.modeCard}>
            <View style={styles.modeCardHeader}>
              <Text style={styles.modeLabel}>APPLICATION MODE</Text>
              <View style={styles.modeStatusBadge}>
                <View style={[styles.modeDot, currentMode === 'POS' ? styles.modeDotPos : styles.modeDotKiosk]} />
                <Text style={styles.modeStatusText}>{currentMode}</Text>
              </View>
            </View>

            {/* Compact POS Mode / Kiosk Mode Segmented Buttons */}
            <View style={styles.modePill}>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  currentMode === 'POS' ? styles.modeBtnActive : styles.modeBtnInactive,
                ]}
                onPress={handlePosClick}
                activeOpacity={0.8}
              >
                <Text style={[styles.modeBtnText, currentMode === 'POS' ? styles.modeBtnTextActive : styles.modeBtnTextInactive]}>
                  POS MODE
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  currentMode === 'KIOSK' ? styles.modeBtnActive : styles.modeBtnInactive,
                ]}
                onPress={handleKioskClick}
                activeOpacity={0.8}
              >
                <Text style={[styles.modeBtnText, currentMode === 'KIOSK' ? styles.modeBtnTextActive : styles.modeBtnTextInactive]}>
                  KIOSK MODE
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Station Information Card */}
        <View style={styles.stationCard}>
          <View style={styles.stationInfoLeft}>
            <View style={styles.stationBadge}>
              <View style={styles.greenDot} />
              <Text style={styles.stationText}>Station #01</Text>
            </View>
            <Text style={styles.locationText}>48 Toh Guan Rd East</Text>
            <Text style={styles.subText}>Singapore 608586</Text>
          </View>

          <View style={styles.stationCarBox}>
            <IconStationRedCar size={38} color="#E60012" />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebarContainer: {
    width: 220,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },

  // Top Section
  headerSection: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 14,
    zIndex: 1,
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtnIcon: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  brandHeader: {
    alignItems: 'center',
    marginTop: 2,
  },
  logoBadgeContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: '#E60012',
    marginBottom: 6,
  },
  logoBadge: {
    width: '100%',
    height: '100%',
  },
  brandSubtitle: {
    color: '#111827',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Navigation Items
  navList: {
    gap: 7,
    flexShrink: 0,
    zIndex: 1,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8.5,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 10,
  },
  navBtnActive: {
    backgroundColor: '#E60012',
  },
  navBtnInactive: {
    backgroundColor: '#F3F4F6',
  },
  navIconBox: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  navTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  navTextInactive: {
    color: '#111827',
    fontWeight: '600',
  },

  // Bottom Section
  bottomSection: {
    marginTop: 'auto',
    paddingTop: 10,
    gap: 8,
    zIndex: 1,
  },

  // Application Mode Card
  modeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  modeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  modeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  modeDotPos: {
    backgroundColor: '#10B981',
  },
  modeDotKiosk: {
    backgroundColor: '#E60012',
  },
  modeStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#111827',
  },
  modePill: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 2,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#E60012',
  },
  modeBtnInactive: {
    backgroundColor: 'transparent',
  },
  modeBtnText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
  modeBtnTextInactive: {
    color: '#4B5563',
  },

  // Switch to Kiosk Button
  launchKioskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E60012',
    paddingVertical: 7.5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  launchKioskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  launchKioskIcon: {
    fontSize: 12,
  },
  launchKioskText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  launchKioskArrow: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // Station Information Card
  stationCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: '#E60012',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stationInfoLeft: {
    flex: 1,
  },
  stationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  stationText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '800',
  },
  locationText: {
    color: '#4B5563',
    fontSize: 9,
    fontWeight: '500',
  },
  subText: {
    color: '#6B7280',
    fontSize: 8.5,
    marginTop: 1,
    fontWeight: '500',
  },
  stationCarBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
});
