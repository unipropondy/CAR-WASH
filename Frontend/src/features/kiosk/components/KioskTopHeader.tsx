import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { useKioskLanguageStore } from '../store/kioskLanguageStore';
import { KIOSK_TRANSLATIONS } from '../data/kioskTranslations';
import { sendKioskHelpRequest } from '../../../services/helpNotificationService';
import { ScreenNameBadge } from '../../../components/common/ScreenNameBadge';
import { RedBayAlertModal } from '../../../components/common/RedBayAlertModal';
import { useKioskResponsive } from '../utils/useKioskResponsive';

interface KioskTopHeaderProps {
  subtitle?: string;
  screenName?: string;
  onExitToPos?: () => void;
  showExitPos?: boolean;
  onBack?: () => void;
  backLabel?: string;
}

export const KioskTopHeader: React.FC<KioskTopHeaderProps> = ({
  subtitle,
  screenName,
  onExitToPos,
  showExitPos = false,
  onBack,
  backLabel = 'Back',
}) => {
  const { language } = useKioskLanguageStore();
  const t = KIOSK_TRANSLATIONS[language] || KIOSK_TRANSLATIONS.EN;
  const { isTallKiosk, isLandscapeShort, contentMaxWidth, horizontalPadding, scale, scaleFont, scaleSize } = useKioskResponsive();
  const [isHelpRequested, setIsHelpRequested] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  const handleRequestHelp = async () => {
    setIsHelpRequested(true);
    setShowHelpModal(true);
    try {
      await sendKioskHelpRequest(subtitle || 'Kiosk Screen', 'Station #01');
    } catch (err) {
      console.warn('Help request error:', err);
    }

    // Auto-reset button after 20 seconds
    setTimeout(() => {
      setIsHelpRequested(false);
    }, 20000);
  };

  const dynamicLogoWidth = scaleSize(220, 160, 310);
  const dynamicLogoHeight = scaleSize(65, 42, 88);

  return (
    <View style={styles.headerContainer}>
      {/* Top Red Accent Stripe */}
      <View style={styles.topAccentBar} />

      <View style={[
        styles.contentRow, 
        { maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding }, 
        isTallKiosk && styles.contentRowTall, 
        isLandscapeShort && styles.contentRowShort
      ]}>
        {/* TOP-LEFT: Back Button (Icon Only) */}
        <View style={styles.sideColLeft}>
          {onBack ? (
            <TouchableOpacity
              style={[styles.backBtn, isTallKiosk && styles.backBtnTall, isLandscapeShort && styles.backBtnShort]}
              onPress={onBack}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={backLabel || "Back"}
            >
              <Ionicons name="arrow-back" size={isTallKiosk ? 24 : (isLandscapeShort ? 18 : 20)} color="#0F172A" />
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholderBox} />
          )}
        </View>

        {/* TOP-CENTER: Official RED BAY CAR WASH Logo & Screen Name Badge */}
        <View style={styles.centerCol}>
          <View style={[styles.logoBadgeContainer, isTallKiosk && styles.logoBadgeContainerTall]}>
            <Image
              source={require('../../../../assets/images/red_bay_banner.jpg')}
              style={[
                styles.logoBanner,
                { width: dynamicLogoWidth, height: dynamicLogoHeight },
                isLandscapeShort && styles.logoBannerShort
              ]}
              resizeMode="contain"
            />
          </View>
          {screenName && (
            <ScreenNameBadge name={screenName} variant="header" style={styles.screenBadge} />
          )}
        </View>

        {/* TOP-RIGHT: Help Button (Staff POS is only displayed on Page 1) */}
        <View style={styles.sideColRight}>
          {showExitPos && onExitToPos && (
            <TouchableOpacity 
              style={[styles.staffBtn, isTallKiosk && styles.staffBtnTall]} 
              onPress={onExitToPos}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Staff POS"
            >
              <Text style={[styles.staffBtnText, isTallKiosk && styles.staffBtnTextTall]}>{t.staffPos || 'Staff POS'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[
              styles.helpBtn,
              isTallKiosk && styles.helpBtnTall,
              isHelpRequested && styles.helpBtnActive,
            ]}
            onPress={handleRequestHelp}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Help"
          >
            <Text style={[styles.helpBtnIcon, isTallKiosk && { fontSize: 14 }]}>{isHelpRequested ? '🚨' : '❓'}</Text>
            <Text style={[styles.helpBtnText, isTallKiosk && styles.helpBtnTextTall, isHelpRequested && styles.helpBtnTextActive]}>
              {isHelpRequested ? 'Help Sent' : 'Help'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Red Bay Branded Staff Alert Modal */}
      <RedBayAlertModal
        visible={showHelpModal}
        title="Staff Alerted"
        message="Assistance requested! A staff member has been notified on the POS screen and is on their way."
        type="alert"
        buttonText="OK, Understood"
        onClose={() => setShowHelpModal(false)}
      />
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
    minHeight: 82,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    width: '100%',
    alignSelf: 'center',
  },
  contentRowTall: {
    minHeight: 104,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  contentRowShort: {
    minHeight: 60,
    paddingVertical: 4,
  },
  screenBadge: {
    marginTop: 4,
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
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.04, 4, 1),
  },
  backBtnTall: {
    width: 50,
    height: 50,
    borderRadius: 16,
  },
  backBtnShort: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    cursor: 'pointer' as any,
    ...makeShadow('#EF4444', { width: 0, height: 2 }, 0.08, 4, 1),
  },
  helpBtnTall: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 7,
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
  helpBtnTextTall: {
    fontSize: 14,
  },
  helpBtnTextActive: {
    color: '#FFFFFF',
  },
  logoBadgeContainer: {
    backgroundColor: '#070A12',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    ...makeShadow('#000000', { width: 0, height: 3 }, 0.2, 6, 2),
  },
  logoBadgeContainerTall: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 16,
  },
  logoBanner: {
    width: 215,
    height: 64,
  },
  logoBannerTall: {
    width: 280,
    height: 82,
  },
  logoBannerShort: {
    width: 155,
    height: 44,
  },
  staffBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  staffBtnTall: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  staffBtnText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  staffBtnTextTall: {
    fontSize: 13,
  },
});
