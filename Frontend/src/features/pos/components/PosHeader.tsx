import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { RED_BAY_BRAND } from '../../../theme/theme';
import { makeShadow } from '../../../theme/shadows';

interface PosHeaderProps {
  currentLanguage: 'EN' | 'ZH';
  onToggleLanguage: () => void;
  onOpenBackoffice: () => void;
  onNewOrder: () => void;
}

export const PosHeader: React.FC<PosHeaderProps> = ({
  currentLanguage,
  onToggleLanguage,
  onOpenBackoffice,
  onNewOrder,
}) => {
  return (
    <View style={styles.headerContainer}>
      {/* Brand Identity with Logo */}
      <View style={styles.brandRow}>
        <Image
          source={require('../../../../assets/images/red_bay_logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <View style={styles.brandTextCol}>
          <View style={styles.brandTitleRow}>
            <Text style={styles.brandTitle}>{RED_BAY_BRAND.name}</Text>
            <View style={styles.racingStripeBadge}>
              <Text style={styles.racingStripeText}>SG • 48 TOH GUAN</Text>
            </View>
          </View>
          <Text style={styles.brandTagline}>
            {currentLanguage === 'EN' ? RED_BAY_BRAND.tagline : RED_BAY_BRAND.taglineZh}
          </Text>
        </View>
      </View>

      {/* Action Controls & Cashier Info */}
      <View style={styles.controlsRow}>
        {/* Operating status & Live Indicator */}
        <View style={styles.statusPill}>
          <View style={styles.liveDot} />
          <Text style={styles.statusPillText}>OPEN (10 AM – 12 AM)</Text>
        </View>


        {/* Backoffice Protected Button */}
        <TouchableOpacity 
          style={styles.backofficeBtn} 
          onPress={onOpenBackoffice}
          activeOpacity={0.8}
        >
          <Text style={styles.backofficeBtnIcon}>🔒</Text>
          <Text style={styles.backofficeBtnText}>
            {currentLanguage === 'EN' ? 'Backoffice' : '管理后台'}
          </Text>
        </TouchableOpacity>

        {/* Primary Call to Action: New Wash Order */}
        <TouchableOpacity 
          style={styles.newOrderBtn} 
          onPress={onNewOrder}
          activeOpacity={0.85}
        >
          <Text style={styles.newOrderBtnIcon}>＋</Text>
          <Text style={styles.newOrderBtnText}>
            {currentLanguage === 'EN' ? 'NEW ORDER' : '新建订单'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    height: 76,
    backgroundColor: RED_BAY_COLORS.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    borderBottomWidth: 3,
    borderBottomColor: RED_BAY_COLORS.primary,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 140,
    height: 48,
    marginRight: 16,
  },
  brandTextCol: {
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  racingStripeBadge: {
    backgroundColor: 'rgba(242, 13, 32, 0.15)',
    borderWidth: 1,
    borderColor: RED_BAY_COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  racingStripeText: {
    color: RED_BAY_COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandTagline: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusPillText: {
    color: '#E4E4E7',
    fontSize: 11,
    fontWeight: '700',
  },
  langToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  langText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
  },
  langActive: {
    color: '#FFFFFF',
  },
  langDivider: {
    color: '#3F3F46',
    fontSize: 12,
  },
  backofficeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F23',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3F3F46',
    gap: 6,
  },
  backofficeBtnIcon: {
    fontSize: 14,
  },
  backofficeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  newOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RED_BAY_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 4 }, 0.35, 8, 4),
    gap: 8,
  },
  newOrderBtnIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  newOrderBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});

