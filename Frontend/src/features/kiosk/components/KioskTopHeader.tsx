import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { useKioskLanguageStore } from '../store/kioskLanguageStore';
import { KIOSK_TRANSLATIONS } from '../data/kioskTranslations';
import { sendKioskHelpRequest } from '../../../services/helpNotificationService';

interface KioskTopHeaderProps {
  subtitle?: string;
  onExitToPos?: () => void;
  showExitPos?: boolean;
  onBack?: () => void;
  backLabel?: string;
}

export const KioskTopHeader: React.FC<KioskTopHeaderProps> = ({
  subtitle,
  onExitToPos,
  showExitPos = false,
  onBack,
  backLabel = 'Back',
}) => {
  const { language } = useKioskLanguageStore();
  const t = KIOSK_TRANSLATIONS[language] || KIOSK_TRANSLATIONS.EN;
  const [isHelpRequested, setIsHelpRequested] = useState<boolean>(false);

  const handleRequestHelp = async () => {
    setIsHelpRequested(true);
    try {
      await sendKioskHelpRequest(subtitle || 'Kiosk Screen', 'Station #01');
      Alert.alert(
        'Staff Alerted',
        'Assistance requested! A staff member has been notified on the POS screen and is on their way.'
      );
    } catch (err) {
      console.warn('Help request error:', err);
    }

    // Auto-reset button after 20 seconds
    setTimeout(() => {
      setIsHelpRequested(false);
    }, 20000);
  };

  return (
    <View style={styles.headerContainer}>
      {/* Top Red Accent Stripe */}
      <View style={styles.topAccentBar} />

      <View style={styles.contentRow}>
        {/* TOP-LEFT: Back Button (Icon Only) */}
        <View style={styles.sideColLeft}>
          {onBack ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={backLabel || "Back"}
            >
              <Ionicons name="arrow-back" size={20} color="#0F172A" />
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholderBox} />
          )}
        </View>

        {/* TOP-CENTER: Official RED BAY CAR WASH Logo */}
        <View style={styles.centerCol}>
          <View style={styles.logoBadgeContainer}>
            <Image
              source={require('../../../../assets/images/red_bay_banner.jpg')}
              style={styles.logoBanner}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* TOP-RIGHT: Help Button (Staff POS is only displayed on Page 1) */}
        <View style={styles.sideColRight}>
          {showExitPos && onExitToPos && (
            <TouchableOpacity 
              style={styles.staffBtn} 
              onPress={onExitToPos}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Staff POS"
            >
              <Text style={styles.staffBtnText}>{t.staffPos || 'Staff POS'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[
              styles.helpBtn,
              isHelpRequested && styles.helpBtnActive,
            ]}
            onPress={handleRequestHelp}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Help"
          >
            <Text style={styles.helpBtnIcon}>{isHelpRequested ? '🚨' : '❓'}</Text>
            <Text style={[styles.helpBtnText, isHelpRequested && styles.helpBtnTextActive]}>
              {isHelpRequested ? 'Help Sent' : 'Help'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    width: '100%',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.04, 6, 2),
  },
  topAccentBar: {
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
    width: '100%',
  },
  contentRow: {
    height: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  sideColLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  placeholderBox: {
    width: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.04, 4, 1),
  },
  centerCol: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 2,
  },
  sideColRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
    cursor: 'pointer' as any,
    ...makeShadow('#EF4444', { width: 0, height: 2 }, 0.08, 4, 1),
  },
  helpBtnActive: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C',
  },
  helpBtnIcon: {
    fontSize: 12,
  },
  helpBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  helpBtnTextActive: {
    color: '#FFFFFF',
  },
  logoBadgeContainer: {
    backgroundColor: '#070A12',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    ...makeShadow('#000000', { width: 0, height: 3 }, 0.2, 6, 2),
  },
  logoBanner: {
    width: 170,
    height: 42,
  },
  staffBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
  },
  staffBtnText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
});
