import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Image,
  useWindowDimensions 
} from 'react-native';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { MOCK_DEALERS } from '../data/dealersMockData';
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
  const [dealersList, setDealersList] = useState<DealerOption[]>(MOCK_DEALERS);
  const [isNavigating, setIsNavigating] = useState(false);
  const { width } = useWindowDimensions();

  useEffect(() => {
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
      .catch(() => {});
  }, []);

  // 4 items per row on kiosk / desktop (width >= 820), 3 on medium, 2 on narrow
  const cardWidth = width >= 820 ? '23.2%' : width >= 600 ? '31.2%' : '47.5%';

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
        onExitToPos={onExitToPos}
        onBack={onBack}
        backLabel="Back"
      />

      {/* Title Header (Without Subtitle) */}
      <View style={styles.promptHeader}>
        <Text style={styles.title}>Choose Your Dealer Account</Text>
        <View style={styles.titleUnderlineAccent} />
      </View>

      {/* Main Content Area - 4 COLUMNS GRID */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gridContainer}>
          {dealersList.map((dealer) => {
            const isSelected = selectedDealer?.id === dealer.id || selectedDealer?.code === dealer.code;
            const logoSource = dealer.logo || (dealer.logoUrl ? { uri: dealer.logoUrl } : null);

            return (
              <TouchableOpacity
                key={dealer.id || dealer.code}
                style={[
                  styles.dealerCard,
                  { width: cardWidth },
                  isSelected && styles.dealerCardSelected,
                ]}
                onPress={() => handleSelectDealer(dealer)}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={`Select ${dealer.name}`}
              >
                {isSelected && <View style={styles.selectedTopStrip} />}

                {/* Dealer Logo Image / Emblem */}
                <View style={[styles.logoBox, isSelected && styles.logoBoxSelected]}>
                  {logoSource ? (
                    <Image source={logoSource} style={styles.logoImage} resizeMode="contain" />
                  ) : (
                    <Text style={styles.logoEmoji}>{dealer.icon || '🏢'}</Text>
                  )}
                </View>

                {/* Dealer Name Only */}
                <Text
                  style={[styles.dealerName, isSelected && styles.dealerNameSelected]}
                  numberOfLines={2}
                >
                  {dealer.name}
                </Text>
              </TouchableOpacity>
            );
          })}
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
  promptHeader: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    width: '100%',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.03, 4, 1),
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  titleUnderlineAccent: {
    width: 36,
    height: 3,
    backgroundColor: RED_BAY_COLORS.primary,
    borderRadius: 2,
    marginTop: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexGrow: 1,
  },
  gridContainer: {
    width: '100%',
    maxWidth: 960,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  dealerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 24,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 145,
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.05, 12, 3),
  },
  dealerCardSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFFDFD',
    borderWidth: 2.5,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 8 }, 0.22, 16, 4),
  },
  selectedTopStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  logoBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 6,
  },
  logoBoxSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoEmoji: {
    fontSize: 34,
  },
  dealerName: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.2,
    minHeight: 38,
  },
  dealerNameSelected: {
    color: RED_BAY_COLORS.primary,
  },
});
