import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { MOCK_DEALERS } from '../data/dealersMockData';
import { DealerOption } from '../types/kiosk.types';
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
  const [isNavigating, setIsNavigating] = useState(false);

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

      {/* Title & Instructions */}
      <View style={styles.promptHeader}>
        <Text style={styles.title}>Choose Your Dealer Account</Text>
        <Text style={styles.subtitle}>
          Select your registered dealership or fleet account to proceed with monthly credit billing
        </Text>
      </View>

      {/* Main Content Area - PORTRAIT OPTIMIZED */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.portraitContainer}>
          {MOCK_DEALERS.map((dealer) => {
            const isSelected = selectedDealer?.id === dealer.id;

            return (
              <TouchableOpacity
                key={dealer.id}
                style={[
                  styles.dealerCard,
                  isSelected && styles.dealerCardSelected,
                ]}
                onPress={() => handleSelectDealer(dealer)}
                activeOpacity={0.88}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                {isSelected && <View style={styles.selectedAccentBar} />}

                {/* Left Icon */}
                <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
                  <Text style={styles.iconEmoji}>{dealer.icon || '🏢'}</Text>
                </View>

                {/* Middle Info */}
                <View style={styles.dealerInfoCol}>
                  <View style={styles.dealerTitleRow}>
                    <Text
                      style={[styles.dealerName, isSelected && styles.dealerNameSelected]}
                      numberOfLines={1}
                    >
                      {dealer.name}
                    </Text>
                    <View style={styles.codeTag}>
                      <Text style={styles.codeText}>{dealer.code}</Text>
                    </View>
                  </View>

                  <Text style={styles.billingCycleText}>
                    Credit Terms: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{dealer.billingCycle}</Text>
                  </Text>

                  {dealer.contactPerson && (
                    <Text style={styles.contactText}>
                      Authorized Rep: {dealer.contactPerson}
                    </Text>
                  )}
                </View>

                {/* Right Arrow / Check Circle */}
                <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                  ) : (
                    <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                  )}
                </View>
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    width: '100%',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.03, 4, 1),
  },
  stepBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 14,
    marginBottom: 4,
  },
  stepBadgeText: {
    color: '#B45309',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexGrow: 1,
  },
  portraitContainer: {
    width: '100%',
    maxWidth: 560,
    gap: 12,
  },
  dealerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
    ...makeShadow('#000000', { width: 0, height: 3 }, 0.04, 6, 2),
  },
  dealerCardSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFF8F8',
    borderWidth: 2,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 6 }, 0.18, 10, 3),
  },
  selectedAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxSelected: {
    backgroundColor: '#FEE2E2',
  },
  iconEmoji: {
    fontSize: 22,
  },
  dealerInfoCol: {
    flex: 1,
    gap: 2,
  },
  dealerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dealerName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    flex: 1,
  },
  dealerNameSelected: {
    color: RED_BAY_COLORS.primary,
  },
  codeTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codeText: {
    color: '#475569',
    fontSize: 10.5,
    fontWeight: '800',
  },
  billingCycleText: {
    fontSize: 11.5,
    color: '#64748B',
  },
  contactText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  radioCircleSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  radioDotEmpty: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
  },
});
