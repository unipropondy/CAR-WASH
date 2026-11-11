import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Image, 
  Alert,
  useWindowDimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useKioskLanguageStore } from '../store/kioskLanguageStore';
import { KIOSK_TRANSLATIONS } from '../data/kioskTranslations';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { sendKioskHelpRequest } from '../../../services/helpNotificationService';

interface Page1UserTypeScreenProps {
  onSelectCustomer: () => void;
  onSelectDealer: () => void;
  onExitToPos?: () => void;
}

export const Page1UserTypeScreen: React.FC<Page1UserTypeScreenProps> = ({
  onSelectCustomer,
  onSelectDealer,
  onExitToPos,
}) => {
  const { width } = useWindowDimensions();
  const isCompact = width < 560;
  const isVeryNarrow = width < 380;

  const { language } = useKioskLanguageStore();
  const t = KIOSK_TRANSLATIONS[language] || KIOSK_TRANSLATIONS.EN;
  const [isHelpActive, setIsHelpActive] = useState(false);

  const handleRequestHelp = async () => {
    setIsHelpActive(true);
    try {
      await sendKioskHelpRequest('Welcome Screen (Account Selection)', 'Station #01');
      Alert.alert(
        'Staff Alerted',
        'Assistance requested! A staff member has been notified on the POS screen and is on their way.'
      );
    } catch (err) {
      console.warn('Help request error:', err);
    }

    setTimeout(() => {
      setIsHelpActive(false);
    }, 20000);
  };

  return (
    <View style={styles.container}>
      {/* Top Red Accent Stripe */}
      <View style={styles.topAccentBar} />

      {/* Top Utility Header */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft} />

        <View style={styles.topBarRight}>
          {onExitToPos && (
            <TouchableOpacity
              style={styles.staffBtn}
              onPress={onExitToPos}
              activeOpacity={0.8}
            >
              <Text style={styles.staffBtnText}>{t.staffPos || 'Staff POS'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.helpBtn, isHelpActive && styles.helpBtnActive]}
            onPress={handleRequestHelp}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Help"
          >
            <Text style={styles.helpBtnIcon}>{isHelpActive ? '🚨' : '❓'}</Text>
            <Text style={[styles.helpBtnText, isHelpActive && styles.helpBtnTextActive]}>
              {isHelpActive ? 'Help Sent' : 'Help'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area: Top-Centered Alignment for Kiosk & Mobile */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.portraitContainer}>
          {/* Logo & Brand Tagline: Top-Centered */}
          <View style={styles.heroSection}>
            <View style={styles.logoBadgeContainer}>
              <Image
                source={require('../../../../assets/images/red_bay_banner.jpg')}
                style={styles.logoBanner}
                resizeMode="contain"
              />
            </View>

            <View style={styles.taglineBadge}>
              <Text style={styles.taglineText}>{t.driveInShineOut}</Text>
            </View>

            <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
              {t.selectAccountPrompt}
            </Text>
          </View>

          {/* AUTO-FIT CARDS ROW / COLUMN FOR KIOSK & MOBILE */}
          <View style={[styles.cardsRow, isVeryNarrow && styles.cardsRowStacked]}>
            {/* ================= LEFT CARD: CUSTOMER ================= */}
            <TouchableOpacity
              style={[styles.kioskCard, isCompact && styles.kioskCardCompact]}
              onPress={onSelectCustomer}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Select Customer Account"
            >
              <View style={styles.cardTopStripRed} />

              {/* Icon Emblem */}
              <View style={[styles.emblemWrapperRed, isCompact && styles.emblemWrapperCompact]}>
                <View style={[styles.emblemCoreRed, isCompact && styles.emblemCoreCompact]}>
                  <Ionicons name="car-sport" size={isCompact ? 34 : 44} color="#FFFFFF" />
                  <View style={styles.sparkleBadge}>
                    <Ionicons name="sparkles" size={12} color="#F59E0B" />
                  </View>
                </View>
              </View>

              {/* Title */}
              <View style={styles.cardTitleBlock}>
                <Text style={[styles.cardTitle, isCompact && styles.cardTitleCompact]}>
                  {t.customerTitle}
                </Text>
              </View>

              {/* Action Button */}
              <View style={[styles.actionBtnRed, isCompact && styles.actionBtnCompact]}>
                <Text style={[styles.actionBtnText, isCompact && styles.actionBtnTextCompact]}>
                  START
                </Text>
              </View>
            </TouchableOpacity>

            {/* ================= RIGHT CARD: DEALER ================= */}
            <TouchableOpacity
              style={[
                styles.kioskCard, 
                styles.dealerCard, 
                isCompact && styles.kioskCardCompact
              ]}
              onPress={onSelectDealer}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Select Dealer Account"
            >
              <View style={styles.cardTopStripDark} />

              {/* Icon Emblem */}
              <View style={[styles.emblemWrapperDark, isCompact && styles.emblemWrapperCompact]}>
                <View style={[styles.emblemCoreDark, isCompact && styles.emblemCoreCompact]}>
                  <Ionicons name="business" size={isCompact ? 30 : 40} color="#FFFFFF" />
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#38BDF8" />
                  </View>
                </View>
              </View>

              {/* Title */}
              <View style={styles.cardTitleBlock}>
                <Text style={[styles.cardTitle, isCompact && styles.cardTitleCompact]}>
                  {t.dealerTitle}
                </Text>
              </View>

              {/* Action Button */}
              <View style={[styles.actionBtnDark, isCompact && styles.actionBtnCompact]}>
                <Text style={[styles.actionBtnText, isCompact && styles.actionBtnTextCompact]}>
                  START
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topAccentBar: {
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
    width: '100%',
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    ...makeShadow('#000000', { width: 0, height: 1 }, 0.04, 4, 1),
  },
  topBarLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topBarRight: {
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
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
    fontSize: 11.5,
    fontWeight: '800',
  },
  helpBtnTextActive: {
    color: '#FFFFFF',
  },
  staffBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  staffBtnText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  portraitContainer: {
    width: '100%',
    maxWidth: 700,
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
  },
  logoBadgeContainer: {
    backgroundColor: '#070A12',
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.25, 12, 4),
    marginBottom: 14,
    alignSelf: 'center',
  },
  logoBanner: {
    width: 240,
    height: 54,
  },
  taglineBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12,
    alignSelf: 'center',
  },
  taglineText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
    letterSpacing: 2,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  heroTitleCompact: {
    fontSize: 20,
  },
  heroSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  heroSubtitleCompact: {
    fontSize: 11.5,
  },

  /* SIDE-BY-SIDE EQUAL ROW / AUTO-FIT */
  cardsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 16,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  cardsRowStacked: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  kioskCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingVertical: 32,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
    gap: 22,
    ...makeShadow('#000000', { width: 0, height: 8 }, 0.08, 16, 4),
  },
  kioskCardCompact: {
    paddingVertical: 20,
    paddingHorizontal: 14,
    minHeight: 240,
    gap: 14,
    borderRadius: 18,
  },
  dealerCard: {
    borderColor: '#CBD5E1',
  },
  cardTopStripRed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  cardTopStripDark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#0F172A',
  },
  cardHeaderRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRetail: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  badgeRetailText: {
    color: '#E60012',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  badgeRetailTextCompact: {
    fontSize: 8.5,
    letterSpacing: 0.5,
  },
  badgeDealer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  badgeDealerText: {
    color: '#334155',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  badgeDealerTextCompact: {
    fontSize: 9,
    letterSpacing: 0.5,
  },
  emblemWrapperRed: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#FFF1F2',
    borderWidth: 2,
    borderColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    marginVertical: 4,
  },
  emblemWrapperDark: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    marginVertical: 4,
  },
  emblemWrapperCompact: {
    width: 76,
    height: 76,
    borderRadius: 22,
    padding: 4,
    marginVertical: 0,
  },
  emblemCoreRed: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: RED_BAY_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.45)',
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 6 }, 0.38, 12, 3),
  },
  emblemCoreDark: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.28, 12, 3),
  },
  emblemCoreCompact: {
    borderRadius: 18,
  },
  sparkleBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.15, 4, 1),
  },
  verifiedBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.15, 4, 1),
  },
  cardTitleBlock: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  cardTitleCompact: {
    fontSize: 18,
    letterSpacing: 0.3,
  },
  cardSubtitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#E60012',
    marginTop: 1,
    textAlign: 'center',
  },
  cardSubtitleCompact: {
    fontSize: 10.5,
  },
  cardDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
    textAlign: 'center',
  },
  cardDescCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  actionBtnRed: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RED_BAY_COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 4 }, 0.35, 8, 3),
  },
  actionBtnDark: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 14,
    ...makeShadow('#000000', { width: 0, height: 4 }, 0.25, 8, 3),
  },
  actionBtnCompact: {
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  actionBtnTextCompact: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
