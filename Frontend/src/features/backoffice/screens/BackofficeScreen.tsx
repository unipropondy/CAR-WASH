import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface BackofficeScreenProps {
  onLogout?: () => void;
}

const ACCENT = '#ED0712';
const BG_DARK = '#0D0D0D';
const CARD_BG = 'rgba(255,255,255,0.05)';
const CARD_BORDER = 'rgba(255,255,255,0.1)';

type QuickTile = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
};

const TILES: QuickTile[] = [
  { icon: 'car-sport-outline', label: 'Total Washes Today', value: '—', color: '#ED0712' },
  { icon: 'cash-outline', label: 'Revenue Today', value: '—', color: '#22C55E' },
  { icon: 'people-outline', label: 'Active Staff', value: '—', color: '#3B82F6' },
  { icon: 'construct-outline', label: 'Bays Online', value: '—', color: '#F59E0B' },
];

const MENU_ITEMS: { icon: keyof typeof Ionicons.glyphMap; label: string; desc: string }[] = [
  { icon: 'bar-chart-outline', label: 'Analytics & Reports', desc: 'View business performance and trends' },
  { icon: 'people-circle-outline', label: 'User Management', desc: 'Manage staff accounts and roles' },
  { icon: 'settings-outline', label: 'System Configuration', desc: 'Configure pricing, services and bays' },
  { icon: 'shield-outline', label: 'Audit Logs', desc: 'Review system events and actions' },
  { icon: 'cloud-upload-outline', label: 'Data Export', desc: 'Export reports and transaction records' },
  { icon: 'notifications-outline', label: 'Alerts & Notifications', desc: 'Manage system notifications' },
];

export const BackofficeScreen: React.FC<BackofficeScreenProps> = ({ onLogout }) => {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />

      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.logoMark}>
            <Ionicons name="shield-checkmark" size={22} color="#fff" />
          </View>
          <View>
            <Text style={styles.appName}>RedBay Backoffice</Text>
            <Text style={styles.appSub}>Administrator Portal</Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <View style={styles.adminBadge}>
            <Ionicons name="person-circle-outline" size={18} color={ACCENT} />
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
          {onLogout && (
            <Pressable
              style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.75 }]}
              onPress={onLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#fff" />
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Welcome Banner ── */}
        <View style={styles.banner}>
          <View style={styles.bannerInner}>
            <Ionicons name="shield-checkmark-outline" size={40} color={ACCENT} />
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.bannerTitle}>Welcome to Backoffice</Text>
              <Text style={styles.bannerSub}>
                You have full administrative access. Use the tools below to manage your car wash operation.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Quick Stats ── */}
        <Text style={styles.sectionTitle}>Quick Overview</Text>
        <View style={styles.tilesRow}>
          {TILES.map((t) => (
            <View key={t.label} style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: t.color + '22' }]}>
                <Ionicons name={t.icon} size={26} color={t.color} />
              </View>
              <Text style={styles.tileValue}>{t.value}</Text>
              <Text style={styles.tileLabel}>{t.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Menu Grid ── */}
        <Text style={styles.sectionTitle}>Admin Tools</Text>
        <View style={styles.menuGrid}>
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [styles.menuCard, pressed && { opacity: 0.75 }]}
            >
              <View style={styles.menuCardIcon}>
                <Ionicons name={item.icon} size={28} color={ACCENT} />
              </View>
              <Text style={styles.menuCardLabel}>{item.label}</Text>
              <Text style={styles.menuCardDesc}>{item.desc}</Text>
              <Ionicons
                name="chevron-forward-outline"
                size={16}
                color="rgba(255,255,255,0.3)"
                style={{ marginTop: 'auto' as any }}
              />
            </Pressable>
          ))}
        </View>

        <Text style={styles.footerText}>
          © 2026 Unipro Softwares SG · Backoffice v1.0
        </Text>
      </ScrollView>
    </View>
  );
};

export default BackofficeScreen;

/* ─────────────────────── STYLES ─────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_DARK,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed' as any,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        } as any)
      : {}),
  },

  /* Top bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.6)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(12px)' } as any)
      : {}),
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  appSub: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '500' },

  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(237,7,18,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(237,7,18,0.3)',
  },
  adminBadgeText: { color: ACCENT, fontSize: 13, fontWeight: '700' },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },

  /* Banner */
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(237,7,18,0.3)',
    backgroundColor: 'rgba(237,7,18,0.08)',
    marginBottom: 28,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(135deg, rgba(237,7,18,0.12) 0%, rgba(237,7,18,0.04) 100%)',
        } as any)
      : {}),
  },
  bannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  bannerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  bannerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, maxWidth: 480 },

  /* Section title */
  sectionTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  /* Tiles */
  tilesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  tile: {
    flex: 1,
    minWidth: 140,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 16,
    alignItems: 'flex-start',
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileValue: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 2 },
  tileLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },

  /* Menu grid */
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  menuCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 18,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer' } as any)
      : {}),
  },
  menuCardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(237,7,18,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  menuCardLabel: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  menuCardDesc: { color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 18 },

  /* Footer */
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
});

