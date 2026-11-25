import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Image, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useKioskLanguageStore } from '../store/kioskLanguageStore';
import { KIOSK_TRANSLATIONS } from '../data/kioskTranslations';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { sendKioskHelpRequest } from '../../../services/helpNotificationService';
import { RedBayAlertModal } from '../../../components/common/RedBayAlertModal';
import { ScreenNameBadge } from '../../../components/common/ScreenNameBadge';
import { KioskBackground } from '../components/KioskBackground';
import { useKioskResponsive } from '../utils/useKioskResponsive';
import { 
  fetchAccountTypes, 
  getCachedAccountTypes,
  AccountTypeOption, 
  FALLBACK_ACCOUNT_TYPES 
} from '../../../services/accountTypeApi';
import { resolveApiUrl } from '../../../services/apiConfig';
import {
  CompanySettings,
  getCachedCompanySettings,
  fetchCompanySettings,
  subscribeCompanySettings,
  getCompanyBannerUrl,
} from '../../../services/companySettingsApi';

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
  const { 
    height, 
    width,
    isCompact, 
    isVeryNarrow, 
    isTallKiosk, 
    isLandscape,
    isLandscapeShort, 
    contentMaxWidth,
    horizontalPadding,
    scale,
    scaleFont,
    scaleSize,
    clamp,
  } = useKioskResponsive();

  const { language } = useKioskLanguageStore();
  const t = KIOSK_TRANSLATIONS[language] || KIOSK_TRANSLATIONS.EN;
  const [isHelpActive, setIsHelpActive] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [accountTypes, setAccountTypes] = useState<AccountTypeOption[]>(() => {
    return getCachedAccountTypes() || [];
  });
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(() => !getCachedAccountTypes());
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(() => getCachedCompanySettings());

  useEffect(() => {
    const unsub = subscribeCompanySettings((s) => { if (s) setCompanySettings(s); });
    fetchCompanySettings().then(setCompanySettings).catch(() => {});
    return unsub;
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchAccountTypes()
      .then((types) => {
        if (isMounted && types && types.length > 0) {
          setAccountTypes(types);
        }
      })
      .catch((err) => {
        console.warn('[Page1UserTypeScreen] fetchAccountTypes error:', err);
        if (isMounted) {
          setAccountTypes((prev) => (prev.length > 0 ? prev : FALLBACK_ACCOUNT_TYPES));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRequestHelp = async () => {
    setIsHelpActive(true);
    setShowHelpModal(true);
    try {
      await sendKioskHelpRequest('Welcome Screen (Account Selection)', 'Station #01');
    } catch (err) {
      console.warn('Help request error:', err);
    }

    setTimeout(() => {
      setIsHelpActive(false);
    }, 20000);
  };

  const cardMinHeight = isLandscapeShort
    ? clamp(height * 0.46, 200, 300)
    : isTallKiosk
      ? clamp(height * 0.36, 360, 520)
      : clamp(height * 0.38, 260, 460);

  const dynamicLogoWidth = scaleSize(240, 170, 340);
  const dynamicLogoHeight = scaleSize(54, 38, 76);

  return (
    <View style={styles.container}>
      {/* Background Canvas with Top Red Swoosh & Bottom Racing Waves */}
      <KioskBackground />

      {/* Floating Top Utility Header */}
      <View style={[styles.topBar, { maxWidth: contentMaxWidth }, isTallKiosk && styles.topBarTall]}>
        <View style={styles.topBarLeft} />

        <View style={styles.topBarRight}>
          {onExitToPos && (
            <TouchableOpacity
              style={[styles.staffBtn, isTallKiosk && styles.staffBtnTall]}
              onPress={onExitToPos}
              activeOpacity={0.8}
            >
              <Text style={[styles.staffBtnText, isTallKiosk && styles.staffBtnTextTall]}>{t.staffPos || 'Staff POS'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.helpBtn, isTallKiosk && styles.helpBtnTall, isHelpActive && styles.helpBtnActive]}
            onPress={handleRequestHelp}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Help"
          >
            <Text style={[styles.helpBtnText, isTallKiosk && styles.helpBtnTextTall, isHelpActive && styles.helpBtnTextActive]}>
              {isHelpActive ? '🚨 Help Sent' : '? Help'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area: Proportional Balanced Alignment for Kiosk, Tablet & Mobile */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontalPadding },
          isTallKiosk && styles.scrollContentTall,
          isLandscapeShort && styles.scrollContentShort,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[
          styles.portraitContainer, 
          { maxWidth: contentMaxWidth, width: '100%' }, 
          isTallKiosk && styles.portraitContainerTall,
          isLandscapeShort && styles.portraitContainerShort,
        ]}>
          {/* Logo & Brand Tagline: Top-Centered */}
          <View style={[styles.heroSection, isTallKiosk && styles.heroSectionTall, isLandscapeShort && styles.heroSectionShort]}>
            <View style={[
              styles.logoBadgeContainer, 
              isTallKiosk && styles.logoBadgeContainerTall,
              isLandscapeShort && { paddingVertical: 4, paddingHorizontal: 14, marginBottom: 6 }
            ]}>
              <Image
                source={{ uri: getCompanyBannerUrl(companySettings) }}
                style={[
                  styles.logoBanner, 
                  { width: dynamicLogoWidth, height: dynamicLogoHeight },
                  isTallKiosk && styles.logoBannerTall,
                  isLandscapeShort && styles.logoBannerShort
                ]}
                resizeMode="contain"
              />
            </View>

            <View style={[styles.taglineBadge, isTallKiosk && styles.taglineBadgeTall]}>
              <Text style={[styles.taglineText, isTallKiosk && styles.taglineTextTall]}>{t.driveInShineOut}</Text>
            </View>

            <Text style={[
              styles.heroTitle, 
              isTallKiosk && styles.heroTitleTall,
              isCompact && styles.heroTitleCompact, 
              isLandscapeShort && styles.heroTitleShort
            ]}>
              {t.selectAccountPrompt}
            </Text>
          </View>

          {/* AUTO-FIT CARDS ROW / COLUMN FOR KIOSK, TABLET & MOBILE */}
          {accountTypes.length === 0 && isInitialLoading ? (
            <View style={[styles.loadingContainer, cardMinHeight !== undefined && { minHeight: cardMinHeight }]}>
              <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
            </View>
          ) : (
            <View style={[
              styles.cardsRow, 
              isTallKiosk && styles.cardsRowTall,
              isVeryNarrow && styles.cardsRowStacked
            ]}>
              {accountTypes.map((item) => {
              const isDealer = item.code === 'DEALER';
              const isCustomer = item.code === 'CUSTOMER';
              const handlePress = isDealer ? onSelectDealer : onSelectCustomer;
              const hasDescription = Boolean(
                item.description && 
                item.description.trim() !== '' && 
                item.description.trim() !== '-'
              );

              // Display title: localized fallback if standard CUSTOMER/DEALER, or db name
              const displayTitle = isCustomer 
                ? (t.customerTitle || item.name) 
                : (isDealer ? (t.dealerTitle || item.name) : item.name);

              return (
                <TouchableOpacity
                  key={String(item.id || item.accountTypeId || item.code)}
                  style={[
                    styles.kioskCard,
                    isDealer && styles.dealerCard,
                    isTallKiosk && styles.kioskCardTall,
                    isCompact && styles.kioskCardCompact,
                    isLandscapeShort && styles.kioskCardShort,
                    cardMinHeight !== undefined && { minHeight: cardMinHeight }
                  ]}
                  onPress={handlePress}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${displayTitle} Account`}
                >
                  <View style={[isDealer ? styles.cardTopStripDark : styles.cardTopStripRed, isTallKiosk && { height: 6 }]} />

                  {/* Icon Emblem / Image */}
                  {item.imageUrl ? (
                    <View style={[
                      styles.emblemImageBox,
                      isDealer && styles.emblemImageBoxDark,
                      isTallKiosk && styles.emblemImageBoxTall,
                      isCompact && styles.emblemImageBoxCompact,
                      isLandscapeShort && styles.emblemImageBoxShort
                    ]}>
                      <Image 
                        source={{ uri: resolveApiUrl(item.imageUrl) }} 
                        style={styles.emblemImageFull} 
                        resizeMode="cover" 
                      />
                    </View>
                  ) : (
                    <View style={[
                      isDealer ? styles.emblemWrapperDark : styles.emblemWrapperRed, 
                      isTallKiosk && styles.emblemWrapperTall,
                      isCompact && styles.emblemWrapperCompact,
                      isLandscapeShort && styles.emblemWrapperShort
                    ]}>
                      <View style={[
                        isDealer ? styles.emblemCoreDark : styles.emblemCoreRed, 
                        isTallKiosk && styles.emblemCoreTall,
                        isCompact && styles.emblemCoreCompact,
                        isLandscapeShort && styles.emblemCoreShort
                      ]}>
                        <Ionicons 
                          name={isDealer ? 'business' : (item.iconName as any || 'car-sport')} 
                          size={isTallKiosk ? (isDealer ? 58 : 64) : (isLandscapeShort ? 28 : (isCompact ? 30 : 40))} 
                          color="#FFFFFF" 
                        />
                      </View>
                    </View>
                  )}

                  {/* Title & Optional Description */}
                  <View style={styles.cardTitleBlock}>
                    <Text style={[
                      styles.cardTitle, 
                      isTallKiosk && styles.cardTitleTall,
                      isCompact && styles.cardTitleCompact,
                      isLandscapeShort && styles.cardTitleShort
                    ]}>
                      {displayTitle}
                    </Text>

                    {hasDescription && (
                      <Text style={[
                        styles.cardDescription,
                        isTallKiosk && styles.cardDescriptionTall,
                        isCompact && styles.cardDescriptionCompact,
                        isLandscapeShort && styles.cardDescriptionShort
                      ]}>
                        {item.description}
                      </Text>
                    )}
                  </View>

                  {/* Action Button */}
                  <View style={[
                    isDealer ? styles.actionBtnDark : styles.actionBtnRed, 
                    isTallKiosk && styles.actionBtnTall,
                    isCompact && styles.actionBtnCompact,
                    isLandscapeShort && styles.actionBtnShort
                  ]}>
                    <Text style={[
                      styles.actionBtnText, 
                      isTallKiosk && styles.actionBtnTextTall,
                      isCompact && styles.actionBtnTextCompact,
                      isLandscapeShort && styles.actionBtnTextShort
                    ]}>
                      START
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        </View>
      </ScrollView>

      {/* Red Bay Branded Alert Modal */}
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
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    width: '100%',
    height: '100%',
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
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: 'transparent',
    width: '100%',
    alignSelf: 'center',
    zIndex: 10,
  },
  topBarTall: {
    height: 68,
    paddingHorizontal: 28,
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
    gap: 10,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    ...makeShadow('#E11D48', { width: 0, height: 2 }, 0.12, 6, 2),
  },
  helpBtnTall: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 7,
  },
  helpBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: RED_BAY_COLORS.primary,
  },
  helpBtnIcon: {
    fontSize: 12,
  },
  helpBtnText: {
    color: '#E11D48',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  helpBtnTextTall: {
    fontSize: 15,
  },
  helpBtnTextActive: {
    color: '#FFFFFF',
  },
  staffBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
  },
  staffBtnTall: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 12,
  },
  staffBtnText: {
    color: '#64748B',
    fontSize: 11.5,
    fontWeight: '700',
  },
  staffBtnTextTall: {
    fontSize: 13.5,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexGrow: 1,
  },
  scrollContentTall: {
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 32,
    justifyContent: 'flex-start',
  },
  scrollContentShort: {
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
    justifyContent: 'flex-start',
  },
  portraitContainer: {
    width: '100%',
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'flex-start',
    flex: 1,
  },
  portraitContainerTall: {
    justifyContent: 'flex-start',
    paddingTop: 18,
  },
  portraitContainerShort: {
    justifyContent: 'flex-start',
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
    width: '100%',
  },
  heroSectionTall: {
    marginTop: 10,
    marginBottom: 28,
  },
  heroSectionShort: {
    marginTop: 4,
    marginBottom: 10,
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
  logoBadgeContainerTall: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 18,
  },
  logoBanner: {
    width: 240,
    height: 54,
  },
  logoBannerTall: {
    width: 330,
    height: 74,
  },
  logoBannerShort: {
    width: 170,
    height: 38,
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
  taglineBadgeTall: {
    paddingHorizontal: 22,
    paddingVertical: 6,
    borderRadius: 22,
    marginBottom: 16,
  },
  taglineText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
    letterSpacing: 2,
  },
  taglineTextTall: {
    fontSize: 14,
    letterSpacing: 2.5,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  heroTitleTall: {
    fontSize: 32,
    letterSpacing: 0.5,
  },
  heroTitleCompact: {
    fontSize: 20,
  },
  heroTitleShort: {
    fontSize: 18,
    marginTop: 4,
  },

  /* SIDE-BY-SIDE EQUAL ROW / AUTO-FIT */
  loadingContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    minHeight: 280,
  },
  cardsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 18,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  cardsRowTall: {
    gap: 28,
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
    justifyContent: 'space-between',
    minHeight: 280,
    gap: 20,
    ...makeShadow('#000000', { width: 0, height: 8 }, 0.08, 16, 4),
  },
  kioskCardTall: {
    borderRadius: 28,
    paddingVertical: 34,
    paddingHorizontal: 26,
    gap: 20,
    ...makeShadow('#000000', { width: 0, height: 12 }, 0.10, 22, 6),
  },
  kioskCardCompact: {
    paddingVertical: 20,
    paddingHorizontal: 14,
    minHeight: 240,
    gap: 14,
    borderRadius: 18,
  },
  kioskCardShort: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
    borderRadius: 16,
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
  emblemWrapperTall: {
    width: 140,
    height: 140,
    borderRadius: 38,
    padding: 10,
    marginVertical: 8,
  },
  emblemWrapperCompact: {
    width: 76,
    height: 76,
    borderRadius: 22,
    padding: 4,
    marginVertical: 0,
  },
  emblemWrapperShort: {
    width: 68,
    height: 68,
    borderRadius: 18,
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
  emblemCoreTall: {
    borderRadius: 30,
  },
  emblemCoreCompact: {
    borderRadius: 18,
  },
  emblemCoreShort: {
    borderRadius: 14,
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
  sparkleBadgeTall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    top: -8,
    right: -8,
    borderWidth: 2,
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
  verifiedBadgeTall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    top: -8,
    right: -8,
    borderWidth: 2,
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
  cardTitleTall: {
    fontSize: 32,
    letterSpacing: 0.8,
  },
  cardTitleCompact: {
    fontSize: 18,
    letterSpacing: 0.3,
  },
  cardTitleShort: {
    fontSize: 17,
  },
  cardDescription: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
    lineHeight: 18,
    fontWeight: '500',
  },
  cardDescriptionTall: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: 10,
  },
  cardDescriptionCompact: {
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 4,
  },
  cardDescriptionShort: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  emblemImage: {
    width: '100%',
    height: '100%',
  },
  emblemImageFull: {
    width: '100%',
    height: '100%',
  },
  emblemImageBox: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginVertical: 4,
    ...makeShadow('#000000', { width: 0, height: 4 }, 0.08, 10, 2),
  },
  emblemImageBoxDark: {
    borderColor: '#E2E8F0',
  },
  emblemImageBoxTall: {
    width: 140,
    height: 140,
    borderRadius: 34,
    marginVertical: 8,
  },
  emblemImageBoxCompact: {
    width: 76,
    height: 76,
    borderRadius: 18,
    marginVertical: 0,
  },
  emblemImageBoxShort: {
    width: 68,
    height: 68,
    borderRadius: 16,
    marginVertical: 0,
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
  actionBtnTall: {
    height: 64,
    borderRadius: 18,
    paddingVertical: 0,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 6 }, 0.4, 12, 4),
  },
  actionBtnCompact: {
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  actionBtnShort: {
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  actionBtnTextTall: {
    fontSize: 22,
    letterSpacing: 1.2,
  },
  actionBtnTextCompact: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  actionBtnTextShort: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
