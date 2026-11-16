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
import { DealerOption } from '../types/kiosk.types';
import { fetchAllDealers } from '../../../services/dealerApi';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';

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
  const [selectedDealer, setSelectedDealer] = useState<DealerOption | undefined>(initialDealer);
  const [dealersList, setDealersList] = useState<DealerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const { width } = useWindowDimensions();

  useEffect(() => {
    setIsLoading(true);
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
        } else {
          setDealersList([]);
        }
      })
      .catch((err) => {
        console.warn('Failed to load dealer accounts:', err);
        setDealersList([]);
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
      {/* Top Center Logo & Header */}
      <KioskTopHeader
        subtitle="DEALER STEP 1: SELECT DEALER ACCOUNT"
        screenName="DealerChooseScreen.tsx"
        onExitToPos={onExitToPos}
        onBack={onBack}
        backLabel="Back"
      />

      {/* Title Header */}
      <View style={styles.promptHeader}>
        <Text style={styles.title}>Choose Your Dealer Account</Text>
        <View style={styles.titleUnderlineAccent} />
      </View>

      {/* Optional Search Bar for Dealer Accounts */}
      {dealersList.length > 3 && (
        <View style={styles.searchBarWrapper}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search dealer by name or code (e.g. UNIPRO, APEX)..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {/* Main Content Area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
            <Text style={styles.loadingText}>Loading dealer accounts...</Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {filteredDealers.map((dealer) => {
              const isSelected = selectedDealer?.id === dealer.id || selectedDealer?.code === dealer.code;
              const logoSource = dealer.logo || (dealer.logoUrl ? { uri: dealer.logoUrl } : null);

              return (
                <TouchableOpacity
                  key={dealer.id || dealer.code}
                  style={[
                    styles.dealerCard,
                    isSelected && styles.dealerCardSelected,
                  ]}
                  onPress={() => handleSelectDealer(dealer)}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${dealer.name}`}
                >
                  {/* Dealer Logo Box */}
                  <View style={[styles.logoBox, isSelected && styles.logoBoxSelected]}>
                    {logoSource ? (
                      <Image source={logoSource} style={styles.logoImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.placeholderLogoBox}>
                        <Ionicons name="business" size={40} color={RED_BAY_COLORS.primary} />
                      </View>
                    )}
                  </View>

                  {/* Dealer Name */}
                  <View style={styles.cardInfoCol}>
                    <Text
                      style={[styles.dealerName, isSelected && styles.dealerNameSelected]}
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
    backgroundColor: '#F8FAFC',
  },
  promptHeader: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    width: '100%',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.03, 6, 1),
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  titleUnderlineAccent: {
    width: 44,
    height: 3.5,
    backgroundColor: RED_BAY_COLORS.primary,
    borderRadius: 2,
    marginTop: 8,
  },
  searchBarWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 16,
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
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    flexGrow: 1,
  },
  gridContainer: {
    width: '100%',
    maxWidth: 820,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 22,
  },
  dealerCard: {
    width: 280,
    minHeight: 190,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.06, 14, 2),
  },
  dealerCardSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFFDFD',
    borderWidth: 2.5,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 10 }, 0.22, 18, 4),
  },
  logoBox: {
    width: 82,
    height: 82,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 8,
    marginBottom: 16,
    ...makeShadow('#000000', { width: 0, height: 3 }, 0.04, 6, 1),
  },
  logoBoxSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  placeholderLogoBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F2',
    borderRadius: 14,
  },
  cardInfoCol: {
    width: '100%',
    alignItems: 'center',
  },
  dealerName: {
    fontSize: 17.5,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 23,
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
