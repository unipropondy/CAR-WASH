import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Image,
  TextInput,
  ActivityIndicator,
  useWindowDimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { KioskBackground } from '../components/KioskBackground';
import { DealerOption } from '../types/kiosk.types';
import { fetchAllDealers, getCachedDealers } from '../../../services/dealerApi';
import { resolveApiUrl } from '../../../services/apiConfig';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { useKioskResponsive } from '../utils/useKioskResponsive';

interface DealerChooseScreenProps {
  initialDealer?: DealerOption;
  onContinue: (dealer: DealerOption) => void;
  onBack: () => void;
  onExitToPos?: () => void;
}

export const DealerChooseScreen: React.FC<DealerChooseScreenProps> = ({
  initialDealer,
  onContinue,
  onBack,
  onExitToPos,
}) => {
  const { 
    isTallKiosk, 
    isLandscape, 
    contentMaxWidth, 
    horizontalPadding, 
    dealerCols, 
    scale, 
    scaleFont, 
    scaleSize, 
    clamp, 
    width 
  } = useKioskResponsive();

  const isVeryNarrow = width < 480;
  const cardWidthPercent = isVeryNarrow 
    ? '47%' 
    : dealerCols === 3 
      ? '30.5%' 
      : '47%';

  const dynamicImageShowcaseHeight = scaleSize(120, 105, 140);
  const dynamicDealerNameFont = scaleFont(16, 14.5, 18.5);

  const initialCachedDealers: DealerOption[] = getCachedDealers().map((r) => ({
    id: String(r.dealerId || r.uniqueCode),
    name: r.dealerName,
    code: r.uniqueCode,
    pin: r.securityPin || '1234',
    contactPerson: r.contactPerson,
    phone: r.contactNumber,
    address: r.address,
    billingCycle: r.billingCycle || 'Monthly 30-Day Credit',
    icon: '🏢',
    logoUrl: r.logoUrl,
    isActive: r.isActive,
  }));

  const [selectedDealer, setSelectedDealer] = useState<DealerOption | undefined>(initialDealer);
  const [dealersList, setDealersList] = useState<DealerOption[]>(initialCachedDealers);
  const [isLoading, setIsLoading] = useState(initialCachedDealers.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (dealersList.length === 0) {
      setIsLoading(true);
    }
    fetchAllDealers(false)
      .then((records) => {
        if (records && records.length > 0) {
          const mapped: DealerOption[] = records.map((r) => ({
            id: String(r.dealerId || r.uniqueCode),
            name: r.dealerName,
            code: r.uniqueCode,
            pin: r.securityPin || '1234',
            contactPerson: r.contactPerson,
            phone: r.contactNumber,
            address: r.address,
            billingCycle: r.billingCycle || 'Monthly 30-Day Credit',
            icon: '🏢',
            logoUrl: r.logoUrl,
            isActive: r.isActive,
          }));
          setDealersList(mapped);
        }
      })
      .catch((err) => {
        console.warn('Failed to load dealer accounts:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const filteredDealers = dealersList.filter((d) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();
    return (
      (d.name && d.name.toLowerCase().includes(query)) ||
      (d.code && d.code.toLowerCase().includes(query)) ||
      (d.contactPerson && d.contactPerson.toLowerCase().includes(query))
    );
  });

  const handleSelectDealer = (dealer: DealerOption) => {
    if (isNavigating) return;
    setIsNavigating(true);
    setSelectedDealer(dealer);
    // Single-Click Auto Navigation: proceed directly to PIN verification
    onContinue(dealer);
  };

  return (
    <View style={styles.container}>
      <KioskBackground />
      {/* Top Center Logo & Header */}
      <KioskTopHeader
        subtitle="DEALER STEP 1: SELECT DEALER ACCOUNT"
        screenName="DealerChooseScreen.tsx"
        onExitToPos={onExitToPos}
        onBack={onBack}
        backLabel="Back"
      />

      {/* Title Header */}
      <View style={[styles.promptHeader, isTallKiosk && styles.promptHeaderTall]}>
        <Text style={[styles.title, isTallKiosk && styles.titleTall]}>Choose Your Dealer Account</Text>
        <Text style={[styles.subtitle, isTallKiosk && styles.subtitleTall]}>
          Select your registered dealer account for commercial billing.
        </Text>
        <View style={styles.titleUnderlineAccent} />
      </View>

      {/* Optional Search Bar for Dealer Accounts */}
      {dealersList.length > 3 && (
        <View style={styles.searchBarWrapper}>
          <View style={[styles.searchBar, isTallKiosk && styles.searchBarTall]}>
            <Ionicons name="search-outline" size={isTallKiosk ? 22 : 18} color="#94A3B8" />
            <TextInput
              style={[styles.searchInput, isTallKiosk && { fontSize: 16 }]}
              placeholder="Search dealer by name or code (e.g. UNIPRO, APEX)..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={isTallKiosk ? 22 : 18} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {/* Main Content Area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingHorizontal: horizontalPadding }, 
          isTallKiosk && styles.scrollContentTall
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading && dealersList.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
            <Text style={styles.loadingText}>Loading dealer accounts...</Text>
          </View>
        ) : (
          <View style={[styles.gridContainer, isTallKiosk && styles.gridContainerTall, { maxWidth: contentMaxWidth, width: '100%' }]}>
            {filteredDealers.map((dealer) => {
              const isSelected = selectedDealer?.id === dealer.id || selectedDealer?.code === dealer.code;
              const hasFailedImage = Boolean(failedImages[String(dealer.id || dealer.code)]);
              const logoSource = !hasFailedImage && (dealer.logo || (dealer.logoUrl ? { uri: resolveApiUrl(dealer.logoUrl) } : null));

              return (
                <TouchableOpacity
                  key={dealer.id || dealer.code}
                  style={[
                    styles.dealerCard,
                    { width: cardWidthPercent },
                    isTallKiosk && styles.dealerCardTall,
                    isSelected && styles.dealerCardSelected,
                  ]}
                  onPress={() => handleSelectDealer(dealer)}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${dealer.name}`}
                >
                  {/* Body: Uniform Framed Showcase */}
                  <View style={[
                    styles.imageShowcase, 
                    { height: dynamicImageShowcaseHeight },
                    isTallKiosk && styles.imageShowcaseTall,
                    isSelected && styles.imageShowcaseSelected
                  ]}>
                    {logoSource ? (
                      <Image 
                        source={logoSource} 
                        style={styles.logoImage} 
                        resizeMode="cover"
                        onError={() => setFailedImages((prev) => ({ ...prev, [String(dealer.id || dealer.code)]: true }))}
                      />
                    ) : (
                      <View style={[
                        styles.fallbackContainer,
                        isSelected && styles.fallbackContainerSelected
                      ]}>
                        <View style={[
                          styles.fallbackIconCircle,
                          isSelected && styles.fallbackIconCircleSelected
                        ]}>
                          <Ionicons 
                            name="business" 
                            size={isTallKiosk ? 36 : 28} 
                            color={RED_BAY_COLORS.primary} 
                          />
                        </View>
                        <Text style={[styles.fallbackTag, isSelected && styles.fallbackTagSelected]}>
                          COMMERCIAL
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Dealer Name Only */}
                  <View style={[styles.cardInfo, isTallKiosk && styles.cardInfoTall]}>
                    <Text
                      style={[
                        styles.dealerName, 
                        { fontSize: dynamicDealerNameFont },
                        isTallKiosk && styles.dealerNameTall, 
                        isSelected && styles.dealerNameSelected
                      ]}
                      numberOfLines={2}
                    >
                      {dealer.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {filteredDealers.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={44} color="#94A3B8" />
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'No matching dealer accounts found' : 'No dealer accounts available'}
                </Text>
                <Text style={styles.emptySub}>
                  {searchQuery ? 'Try searching for another dealer name or code' : 'Please contact the station cashier or administrator.'}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  promptHeader: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    width: '100%',
  },
  promptHeaderTall: {
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  titleTall: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
  subtitleTall: {
    fontSize: 15,
    marginTop: 4,
  },
  titleUnderlineAccent: {
    width: 36,
    height: 3,
    backgroundColor: RED_BAY_COLORS.primary,
    borderRadius: 2,
    marginTop: 6,
  },
  searchBarWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: 20,
  },
  searchBar: {
    width: '100%',
    maxWidth: 520,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.04, 6, 1),
  },
  searchBarTall: {
    maxWidth: 700,
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 18,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingTop: 18,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexGrow: 1,
  },
  scrollContentTall: {
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 32,
  },
  gridContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 18,
    rowGap: 20,
  },
  gridContainerTall: {
    gap: 22,
    rowGap: 22,
  },
  dealerCard: {
    width: '30.5%',
    minWidth: 155,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    overflow: 'hidden',
    ...makeShadow('#0F172A', { width: 0, height: 4 }, 0.06, 12, 2),
  },
  dealerCardTall: {
    borderRadius: 24,
    padding: 16,
    ...makeShadow('#0F172A', { width: 0, height: 6 }, 0.08, 16, 3),
  },
  dealerCardSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 8 }, 0.22, 16, 4),
  },
  imageShowcase: {
    width: '100%',
    height: 115,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageShowcaseTall: {
    height: 135,
    borderRadius: 16,
  },
  imageShowcaseSelected: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
  },
  fallbackContainerSelected: {
    backgroundColor: '#FEF2F2',
  },
  fallbackIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...makeShadow('#0F172A', { width: 0, height: 2 }, 0.04, 4, 1),
  },
  fallbackIconCircleSelected: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFFFF',
  },
  fallbackTag: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  fallbackTagSelected: {
    color: RED_BAY_COLORS.primary,
  },
  cardInfo: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  cardInfoTall: {
    marginTop: 14,
    minHeight: 52,
  },
  dealerName: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  dealerNameTall: {
    fontSize: 17.5,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  dealerNameSelected: {
    color: RED_BAY_COLORS.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
});
