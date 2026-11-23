import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Modal, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IconSearch, IconMenu, IconBell } from '../../../components/common/AppIcons';
import { DayStatusIndicator } from '../../dayManagement/components/DayStatusIndicator';
import { ScreenNameBadge } from '../../../components/common/ScreenNameBadge';
import { makeShadow } from '../../../theme/shadows';

interface PosTopNavbarProps {
  pageTitle?: string;
  pageSubtitle?: string;
  screenName?: string;
  onSearch?: (query: string) => void;
  showSearch?: boolean;
  showDayStatus?: boolean;
  onToggleSidebar?: () => void;
  cashierName?: string;
  onLogout?: () => void;
  onPressNotification?: () => void;
  unreadCount?: number;
  onPressDayManagement?: () => void;
  rightCustomActions?: React.ReactNode;
  categoryBadge?: string;
  onBack?: () => void;
}

export const PosTopNavbar: React.FC<PosTopNavbarProps> = ({
  pageTitle = "Today's orders",
  pageSubtitle,
  screenName,
  onSearch,
  showSearch = true,
  showDayStatus = false,
  onToggleSidebar,
  cashierName = 'Cashier',
  onLogout,
  onPressNotification,
  unreadCount = 0,
  onPressDayManagement,
  rightCustomActions,
  categoryBadge,
  onBack,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 680;
  const isVeryNarrow = width < 480;

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  return (
    <View style={[styles.navbarContainer, isMobile && styles.navbarContainerMobile]}>
      {/* Left side: Menu Button / Back Button, Orders Title, and Search Input */}
      <View style={styles.leftSection}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backBtnSquare}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={onToggleSidebar}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Toggle side menu"
          >
            <IconMenu size={20} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        )}

        {/* Title & Subtitle matching reference */}
        <View style={styles.titleContainer}>
          {categoryBadge ? (
            <Text style={styles.categoryBadgeText}>{categoryBadge}</Text>
          ) : null}
          <Text style={[styles.pageTitle, isMobile && styles.pageTitleMobile]}>
            {isVeryNarrow && pageTitle.length > 14 ? pageTitle.slice(0, 12) + '..' : pageTitle}
          </Text>
          {pageSubtitle && !isVeryNarrow ? (
            <Text style={[styles.pageSubtitle, isMobile && styles.pageSubtitleMobile]}>
              {pageSubtitle}
            </Text>
          ) : null}
        </View>

        {screenName && !isMobile && (
          <ScreenNameBadge name={screenName} variant="light" style={{ marginLeft: 10 }} />
        )}

        {/* Rounded Search Input matching screenshot */}
        {!isVeryNarrow && showSearch && (
          <View style={[styles.searchBox, isMobile && styles.searchBoxMobile]}>
            <View style={{ marginRight: 6 }}>
              <IconSearch size={14} color="#94A3B8" strokeWidth={2.2} />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder={isMobile ? "Search..." : "Search order, customer or plate"}
              placeholderTextColor="#94A3B8"
              onChangeText={onSearch}
            />
          </View>
        )}
      </View>

      {/* Right side: Day status, Notification button & Cashier profile OR Custom Actions */}
      <View style={[styles.rightSection, isMobile && { gap: 8 }]}>
        {rightCustomActions ? (
          rightCustomActions
        ) : (
          <>
            {/* Global Business Day Status Indicator - Dashboard only */}
            {showDayStatus && (
              <DayStatusIndicator onPress={onPressDayManagement} compact={isMobile} />
            )}

            {/* Notification Button */}
            <TouchableOpacity
              style={styles.notificationBtn}
              onPress={onPressNotification}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => setShowLogoutModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Cashier profile / logout"
            >
              <View style={styles.cashierAvatar}>
                <Text style={styles.cashierAvatarText}>CS</Text>
              </View>
              {!isMobile && <Text style={styles.cashierLabel}>{cashierName}</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTouch}
            activeOpacity={1}
            onPress={() => setShowLogoutModal(false)}
          />
          <View style={styles.logoutModalCard}>
            {/* Close (X) button */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowLogoutModal(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>

            <View style={styles.modalContent}>
              {/* Layered Squircle Icon Badge */}
              <View style={styles.logoutSquircle}>
                <View style={styles.logoutSquircleInner}>
                  <Ionicons name="log-out" size={24} color="#E60012" />
                </View>
              </View>

              <Text style={styles.logoutModalTitle}>Confirm Sign Out</Text>
              <Text style={styles.logoutModalMessage}>
                Are you sure you want to log out of the POS system? You will be returned to the sign-in screen.
              </Text>

              {/* Active Session Info Card */}
              <View style={styles.userSessionCard}>
                <View style={styles.userSessionAvatar}>
                  <Text style={styles.userSessionAvatarText}>CS</Text>
                </View>
                <View style={styles.userSessionDetails}>
                  <Text style={styles.userSessionName}>{cashierName}</Text>
                  <Text style={styles.userSessionRole}>Active Cashier Session</Text>
                </View>
                <View style={styles.userSessionBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.userSessionBadgeText}>ONLINE</Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.logoutModalActions}>
                <TouchableOpacity
                  style={styles.logoutCancelBtn}
                  onPress={() => setShowLogoutModal(false)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.logoutCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.logoutConfirmBtn}
                  onPress={() => {
                    setShowLogoutModal(false);
                    if (onLogout) onLogout();
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="log-out-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.logoutConfirmBtnText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  navbarContainer: {
    minHeight: 66,
    height: 66,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    width: '100%',
    zIndex: 10,
  },
  navbarContainerMobile: {
    minHeight: 58,
    height: 58,
    paddingHorizontal: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
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
  backBtnSquare: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  titleContainer: {
    marginLeft: 14,
    justifyContent: 'center',
  },
  categoryBadgeText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#E60012',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  pageTitleMobile: {
    fontSize: 16,
  },
  pageSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  pageSubtitleMobile: {
    fontSize: 10,
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
    maxWidth: 340,
  },
  searchBoxMobile: {
    marginLeft: 8,
    width: 140,
    maxWidth: 140,
    height: 36,
    paddingHorizontal: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  modalBackdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  logoutModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...makeShadow('#0F172A', { width: 0, height: 20 }, 0.22, 40, 12),
    zIndex: 10,
    position: 'relative',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  modalContent: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  logoutSquircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoutSquircleInner: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...makeShadow('#E60012', { width: 0, height: 3 }, 0.15, 8, 2),
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  logoutModalMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  userSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    marginBottom: 20,
  },
  userSessionAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  userSessionAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  userSessionDetails: {
    flex: 1,
  },
  userSessionName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  userSessionRole: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  userSessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 5,
  },
  userSessionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  logoutModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoutCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  logoutCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  logoutConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E60012',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...makeShadow('#E60012', { width: 0, height: 4 }, 0.25, 8, 3),
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  logoutConfirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
