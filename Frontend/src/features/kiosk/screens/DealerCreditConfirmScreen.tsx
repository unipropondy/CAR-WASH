import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { KioskBackground } from '../components/KioskBackground';
import { KioskNavButtons } from '../components/KioskNavButtons';
import { DealerOption, VehicleOption, ServiceCategory, ServicePackage, CustomerDetails } from '../types/kiosk.types';
import { getCachedGstRate } from '../../../services/companySettingsApi';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { useKioskResponsive } from '../utils/useKioskResponsive';

interface DealerCreditConfirmScreenProps {
  dealer: DealerOption;
  vehicle: VehicleOption;
  category: ServiceCategory;
  selectedPackage: ServicePackage;
  customerDetails: CustomerDetails;
  onPlaceOrder: () => void;
  onBack: () => void;
  onExitToPos?: () => void;
}

export const DealerCreditConfirmScreen: React.FC<DealerCreditConfirmScreenProps> = ({
  dealer,
  vehicle,
  category,
  selectedPackage,
  customerDetails,
  onPlaceOrder,
  onBack,
  onExitToPos,
}) => {
  const { isTallKiosk, isLandscape, contentMaxWidth, horizontalPadding, width } = useKioskResponsive();
  const isTwoCol = isLandscape && width >= 850;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const basePrice = selectedPackage.price;
  const gstRate = getCachedGstRate();
  const gstAmount = Number(((basePrice * (gstRate / 100))).toFixed(2));
  const total = Number((basePrice + gstAmount).toFixed(2));

  const handleConfirmOrder = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onPlaceOrder();
    }, 500);
  };

  const isWalkIn = !customerDetails?.vehicleNumber || customerDetails.vehicleNumber === 'WALK-IN';

  return (
    <View style={styles.container}>
      <KioskBackground />
      {/* Top Center Logo & Header */}
      <KioskTopHeader
        subtitle="DEALER STEP 5: AUTOMATIC CREDIT BILLING"
        screenName="DealerCreditConfirmScreen.tsx"
        onExitToPos={onExitToPos}
        onBack={onBack}
        backLabel="Details"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingHorizontal: horizontalPadding }, 
          isTallKiosk && { paddingVertical: 28 }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.portraitContainer, { maxWidth: isTwoCol ? 1200 : contentMaxWidth, width: '100%' }]}>
          {/* Top Automatic Credit Banner */}
          <View style={styles.creditBanner}>
            <View style={styles.creditIconBadge}>
              <Ionicons name="card" size={24} color="#D97706" />
            </View>
            <View style={styles.creditBannerText}>
              <Text style={styles.creditBannerTitle}>AUTOMATIC DEALER CREDIT BILLING</Text>
              <Text style={styles.creditBannerSubtitle}>
                No card or PayNow needed. Total amount is billed directly to your {dealer.name} commercial account.
              </Text>
            </View>
            <View style={styles.creditStatusTag}>
              <Text style={styles.creditStatusTagText}>CREDIT</Text>
            </View>
          </View>

          {/* Cards: Responsive Stack (1 Col in Portrait, 2 Col in Landscape) */}
          <View style={[styles.cardsStack, isTwoCol && styles.cardsStackTwoCol]}>
            {/* 1. Dealer Account Details Card */}
            <View style={[styles.card, isTwoCol && styles.cardTwoCol]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderTitle}>DEALER ACCOUNT DETAILS</Text>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{dealer.code}</Text>
                </View>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Dealer Name:</Text>
                <Text style={styles.valBold}>{dealer.name}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Credit Terms:</Text>
                <Text style={styles.val}>{dealer.billingCycle}</Text>
              </View>
              {dealer.contactPerson && (
                <View style={styles.row}>
                  <Text style={styles.label}>Account Rep:</Text>
                  <Text style={styles.val}>{dealer.contactPerson}</Text>
                </View>
              )}
            </View>

            {/* 2. Vehicle & Service Details Card */}
            <View style={[styles.card, isTwoCol && styles.cardTwoCol]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderTitle}>VEHICLE & SERVICE BREAKDOWN</Text>
                <View style={styles.serviceCatTag}>
                  <Text style={styles.serviceCatText}>{category.title}</Text>
                </View>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Vehicle Plate:</Text>
                <View style={styles.plateTag}>
                  <Text style={styles.plateText}>{isWalkIn ? 'FLEET VEHICLE' : customerDetails.vehicleNumber}</Text>
                </View>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Vehicle Type:</Text>
                <Text style={styles.val}>{vehicle.name}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Package:</Text>
                <Text style={[styles.valBold, { color: RED_BAY_COLORS.primary }]}>
                  {selectedPackage.name}
                </Text>
              </View>
            </View>

            {/* 3. Financial Summary Card */}
            <View style={[styles.card, isTwoCol && styles.cardFullWidth]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderTitle}>INVOICE SUMMARY</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Base Amount:</Text>
                <Text style={styles.val}>${basePrice.toFixed(2)}</Text>
              </View>

              {gstRate > 0 && (
                <View style={styles.row}>
                  <Text style={styles.label}>GST ({gstRate}%):</Text>
                  <Text style={styles.val}>${gstAmount.toFixed(2)}</Text>
                </View>
              )}

              <View style={styles.pricingDivider} />

              <View style={styles.totalRow}>
                <View>
                  <Text style={styles.totalLabel}>TOTAL BILLED TO CREDIT:</Text>
                  <Text style={styles.totalCycleNote}>Due per {dealer.billingCycle} credit terms</Text>
                </View>
                <Text style={styles.totalAmountText}>${total.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Navigation Buttons: Pinned at bottom */}
      <KioskNavButtons
        onContinue={handleConfirmOrder}
        continueDisabled={isSubmitting}
        isLoading={isSubmitting}
        continueLabel={isSubmitting ? "Authorizing Order..." : `Authorize Credit Order ($${total.toFixed(2)}) ›`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    ...(Platform.OS === 'web'
      ? {
          maxHeight: '100%' as any,
        }
      : {}),
  },
  scrollView: {
    flex: 1,
    flexShrink: 1,
    width: '100%',
    minHeight: 0,
  },
  scrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexGrow: 1,
  },
  portraitContainer: {
    width: '100%',
    gap: 12,
  },
  creditBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 16,
    padding: 12,
    gap: 10,
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.03, 4, 1),
  },
  creditIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditBannerText: {
    flex: 1,
  },
  creditBannerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  creditBannerSubtitle: {
    fontSize: 10.5,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 14,
  },
  creditStatusTag: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  creditStatusTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#92400E',
  },
  cardsStack: {
    width: '100%',
    gap: 12,
  },
  cardsStackTwoCol: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 8,
    ...makeShadow('#000000', { width: 0, height: 3 }, 0.04, 6, 2),
  },
  cardTwoCol: {
    width: '48.5%',
  },
  cardFullWidth: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  tag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
  },
  serviceCatTag: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  serviceCatText: {
    fontSize: 10,
    fontWeight: '800',
    color: RED_BAY_COLORS.primary,
  },
  taxInclusivePill: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  label: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  val: {
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '700',
  },
  valBold: {
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '900',
  },
  plateTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  plateText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  pricingDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
  },
  totalCycleNote: {
    fontSize: 10,
    color: '#64748B',
  },
  totalAmountText: {
    fontSize: 20,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
  },
});
