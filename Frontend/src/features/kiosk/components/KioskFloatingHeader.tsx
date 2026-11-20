import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { sendKioskHelpRequest } from '../../../services/helpNotificationService';
import { RedBayAlertModal } from '../../../components/common/RedBayAlertModal';
import { useKioskResponsive } from '../utils/useKioskResponsive';

interface KioskFloatingHeaderProps {
  onBack?: () => void;
  onExitToPos?: () => void;
  screenSubtitle?: string;
  stationName?: string;
}

export const KioskFloatingHeader: React.FC<KioskFloatingHeaderProps> = ({
  onBack,
  onExitToPos,
  screenSubtitle = 'Service Selection',
  stationName = 'Station #01',
}) => {
  const { isTallKiosk, isLandscapeShort, contentMaxWidth, horizontalPadding, scaleSize } = useKioskResponsive();
  const [isHelpRequested, setIsHelpRequested] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  const handleRequestHelp = async () => {
    setIsHelpRequested(true);
    setShowHelpModal(true);
    try {
      await sendKioskHelpRequest(screenSubtitle, stationName);
    } catch (err) {
      console.warn('Help request error:', err);
    }

    setTimeout(() => {
      setIsHelpRequested(false);
    }, 20000);
  };

  const dynamicLogoWidth = scaleSize(160, 130, 210);
  const dynamicLogoHeight = scaleSize(40, 32, 52);

  return (
    <View style={styles.headerWrapper}>
      <View style={[styles.floatingRow, { maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding }]}>
        {/* Left: Back Button */}
        <View style={styles.sideCol}>
          {onBack ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color="#0F172A" />
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>

        {/* Center: RedBay Logo in Black Pill Badge */}
        <TouchableOpacity
          style={styles.logoPill}
          activeOpacity={onExitToPos ? 0.85 : 1}
          onLongPress={onExitToPos}
          delayLongPress={2000}
        >
          <Image
            source={require('../../../../assets/images/red_bay_banner.jpg')}
            style={[styles.logoImage, { width: dynamicLogoWidth, height: dynamicLogoHeight }]}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Right: Help Button */}
        <View style={[styles.sideCol, styles.sideColRight]}>
          <TouchableOpacity
            style={[styles.helpBtn, isHelpRequested && styles.helpBtnActive]}
            onPress={handleRequestHelp}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Request staff help"
          >
            <Text style={[styles.helpBtnText, isHelpRequested && styles.helpBtnTextActive]}>
              {isHelpRequested ? '🚨 Help Sent' : '? Help'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Staff Alerted Modal */}
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
  headerWrapper: {
    width: '100%',
    paddingTop: 14,
    paddingBottom: 6,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  floatingRow: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideCol: {
    width: 90,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideColRight: {
    alignItems: 'flex-end',
  },
  placeholder: {
    width: 44,
    height: 44,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.08, 6, 2),
  },
  logoPill: {
    backgroundColor: '#000000',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    paddingHorizontal: 20,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    ...makeShadow('#000000', { width: 0, height: 4 }, 0.22, 10, 3),
  },
  logoImage: {
    width: 160,
    height: 40,
  },
  helpBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...makeShadow('#E11D48', { width: 0, height: 2 }, 0.12, 6, 2),
  },
  helpBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: RED_BAY_COLORS.primary,
  },
  helpBtnText: {
    color: '#E11D48',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  helpBtnTextActive: {
    color: '#991B1B',
  },
});
