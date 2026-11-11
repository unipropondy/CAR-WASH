import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Platform,
  Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { KioskNavButtons } from '../components/KioskNavButtons';
import { CustomerDetails, DealerOption, VehicleOption, ServicePackage } from '../types/kiosk.types';
import { getVehicleImageSource } from './Page2VehicleScreen';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';

interface Page4DetailsScreenProps {
  initialDetails?: CustomerDetails;
  isDealer?: boolean;
  dealer?: DealerOption;
  selectedVehicle?: VehicleOption;
  selectedPackage?: ServicePackage;
  onContinue: (details: CustomerDetails) => void;
  onSkip?: () => void;
  onBack: () => void;
  onExitToPos?: () => void;
}

export const Page4DetailsScreen: React.FC<Page4DetailsScreenProps> = ({
  initialDetails,
  isDealer = false,
  dealer,
  selectedVehicle,
  selectedPackage,
  onContinue,
  onSkip,
  onBack,
  onExitToPos,
}) => {
  const [customerName, setCustomerName] = useState(initialDetails?.customerName || '');
  const [mobileNumber, setMobileNumber] = useState(initialDetails?.mobileNumber || '');
  const [vehicleNumber, setVehicleNumber] = useState(initialDetails?.vehicleNumber === 'WALK-IN' ? '' : (initialDetails?.vehicleNumber || ''));

  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field validation
  const cleanMobile = mobileNumber.replace(/\D/g, '');
  const isNameValid = customerName.trim().length >= 2;
  const isMobileValid = cleanMobile.length >= 8;
  const hasPlate = vehicleNumber.trim().length > 0;

  // Validation errors (for non-dealer flow)
  const nameError = hasAttemptedSubmit && !isNameValid
    ? (customerName.trim().length === 0 ? 'Customer name is required' : 'Please enter a valid name (min 2 characters)')
    : null;

  const mobileError = hasAttemptedSubmit && !isMobileValid
    ? (cleanMobile.length === 0 ? 'Mobile number is required' : 'Please enter a valid 8-digit mobile number')
    : null;

  const handleContinue = () => {
    if (isSubmitting) return;

    if (!isDealer) {
      setHasAttemptedSubmit(true);
      if (!isNameValid || !isMobileValid) {
        return;
      }
    }

    setIsSubmitting(true);
    if (isDealer) {
      const finalPlate = vehicleNumber.trim()
        ? vehicleNumber.trim().toUpperCase()
        : (dealer ? `${dealer.code} FLEET` : 'DEALER FLEET');
      const finalName = customerName.trim()
        ? customerName.trim()
        : (dealer ? `${dealer.name}` : 'Authorized Dealer Rep');
      const finalMobile = cleanMobile.length > 0
        ? cleanMobile
        : (dealer?.phone ? dealer.phone.replace(/\D/g, '') : '-');

      onContinue({
        vehicleNumber: finalPlate,
        customerName: finalName,
        mobileNumber: finalMobile,
      });
    } else {
      const finalPlate = vehicleNumber.trim()
        ? vehicleNumber.trim().toUpperCase()
        : 'WALK-IN';
      const finalName = customerName.trim();
      const finalMobile = cleanMobile;

      onContinue({
        vehicleNumber: finalPlate,
        customerName: finalName,
        mobileNumber: finalMobile,
      });
    }
  };

  const handleSkipForDealer = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    if (onSkip) {
      onSkip();
    } else {
      const finalPlate = dealer ? `${dealer.code} FLEET` : 'DEALER FLEET';
      const finalName = dealer ? `${dealer.name}` : 'Authorized Dealer Rep';
      const finalMobile = dealer?.phone ? dealer.phone.replace(/\D/g, '') : '-';

      onContinue({
        vehicleNumber: finalPlate,
        customerName: finalName,
        mobileNumber: finalMobile,
      });
    }
  };

  const priceFormatted = selectedPackage 
    ? `${selectedPackage.currencyCode || 'SGD'} $${selectedPackage.price.toFixed(2)}`
    : '';

  const vehicleImgSource = getVehicleImageSource(selectedVehicle);

  return (
    <View style={styles.container}>
      {/* Top Center Logo & Header */}
      <KioskTopHeader
        subtitle={isDealer ? "DEALER STEP 5: VEHICLE & CONTACT" : "STEP 4 OF 5: CUSTOMER DETAILS"}
        onExitToPos={onExitToPos}
        onBack={onBack}
        backLabel="Packages"
      />

      {/* Main Title & Prompt Header */}
      <View style={styles.promptHeader}>
        <Text style={styles.mainTitle}>
          {isDealer ? "Vehicle & Driver Details" : "Customer & Contact Details"}
        </Text>
        <View style={styles.titleUnderlineAccent} />
      </View>

      {/* Main Content Area - PORTRAIT OPTIMIZED */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.portraitContainer}>
          {/* ================= DETAILS FORM CARD ================= */}
          <View style={styles.formCard}>
            <View style={styles.formAccentStrip} />

            {/* Dealer Fast-Track Banner */}
            {isDealer && (
              <View style={styles.dealerSkipBanner}>
                <View style={styles.dealerSkipLeft}>
                  <Text style={styles.dealerSkipIcon}>⚡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dealerSkipTitle}>Dealer Fast-Track Available</Text>
                    <Text style={styles.dealerSkipSubtitle}>
                      Skip entering details to use {dealer?.name || 'Dealer'} billing profile.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.skipBtn}
                  onPress={handleSkipForDealer}
                  activeOpacity={0.8}
                >
                  <Text style={styles.skipBtnText}>SKIP STEP ⏭️</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Section Header */}
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.sectionIconBadge}>
                  <Ionicons name="id-card-outline" size={20} color={RED_BAY_COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.cardSectionTitle}>Vehicle & Contact Details</Text>
                  <Text style={styles.cardSectionSubtitle}>Quick verification for wash queue</Text>
                </View>
              </View>
              <View style={styles.secureBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#16A34A" />
                <Text style={styles.secureBadgeText}>Fast Checkout</Text>
              </View>
            </View>

            {/* 1. Customer Name (REQUIRED) */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={styles.labelWithIcon}>
                  <Text style={styles.fieldLabel}>
                    {isDealer ? "Driver Name" : "Customer Name"}
                  </Text>
                  <Text style={styles.requiredAsterisk}>*</Text>
                </View>
                <View style={[styles.badgePill, isNameValid ? styles.badgePillSuccess : (hasAttemptedSubmit ? styles.badgePillError : styles.badgePillRequired)]}>
                  <Ionicons 
                    name={isNameValid ? "checkmark-circle" : (hasAttemptedSubmit ? "alert-circle" : "ellipse")} 
                    size={11} 
                    color={isNameValid ? "#16A34A" : "#DC2626"} 
                  />
                  <Text style={[styles.badgeText, isNameValid ? styles.badgeTextSuccess : (hasAttemptedSubmit ? styles.badgeTextError : styles.badgeTextRequired)]}>
                    {isNameValid ? 'Done' : 'Required'}
                  </Text>
                </View>
              </View>

              <View style={[
                styles.modernInputBox, 
                isNameValid && styles.modernInputBoxFilled,
                nameError && styles.modernInputBoxError,
              ]}>
                <Ionicons 
                  name="person-outline" 
                  size={19} 
                  color={nameError ? "#EF4444" : (isNameValid ? RED_BAY_COLORS.primary : "#64748B")} 
                  style={styles.fieldInputIcon}
                />
                <TextInput
                  style={styles.modernTextInput}
                  value={customerName}
                  onChangeText={(text) => {
                    setCustomerName(text);
                    if (hasAttemptedSubmit) setHasAttemptedSubmit(false);
                  }}
                  placeholder={isDealer ? "Driver name (required)" : "Enter customer name"}
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                />
                {customerName.length > 0 && (
                  <TouchableOpacity onPress={() => setCustomerName('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
              {nameError && (
                <View style={styles.errorRow}>
                  <Ionicons name="warning" size={13} color="#EF4444" />
                  <Text style={styles.errorText}>{nameError}</Text>
                </View>
              )}
            </View>

            {/* 2. Singapore Mobile Number (REQUIRED) */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={styles.labelWithIcon}>
                  <Text style={styles.fieldLabel}>Mobile Number</Text>
                  <Text style={styles.requiredAsterisk}>*</Text>
                </View>
                <View style={[styles.badgePill, isMobileValid ? styles.badgePillSuccess : (hasAttemptedSubmit ? styles.badgePillError : styles.badgePillRequired)]}>
                  <Ionicons 
                    name={isMobileValid ? "checkmark-circle" : (hasAttemptedSubmit ? "alert-circle" : "ellipse")} 
                    size={11} 
                    color={isMobileValid ? "#16A34A" : "#DC2626"} 
                  />
                  <Text style={[styles.badgeText, isMobileValid ? styles.badgeTextSuccess : (hasAttemptedSubmit ? styles.badgeTextError : styles.badgeTextRequired)]}>
                    {isMobileValid ? 'Done' : 'Required'}
                  </Text>
                </View>
              </View>

              <View style={[
                styles.modernInputBox, 
                isMobileValid && styles.modernInputBoxFilled,
                mobileError && styles.modernInputBoxError,
              ]}>
                <Ionicons 
                  name="call-outline" 
                  size={19} 
                  color={mobileError ? "#EF4444" : (isMobileValid ? RED_BAY_COLORS.primary : "#64748B")} 
                  style={styles.fieldInputIcon}
                />
                <TextInput
                  style={styles.modernTextInput}
                  value={mobileNumber}
                  onChangeText={(text) => {
                    setMobileNumber(text);
                    if (hasAttemptedSubmit) setHasAttemptedSubmit(false);
                  }}
                  placeholder="Enter mobile number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  maxLength={15}
                />
                {mobileNumber.length > 0 && (
                  <TouchableOpacity onPress={() => setMobileNumber('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
              {mobileError && (
                <View style={styles.errorRow}>
                  <Ionicons name="warning" size={13} color="#EF4444" />
                  <Text style={styles.errorText}>{mobileError}</Text>
                </View>
              )}
            </View>

            {/* Divider */}
            <View style={styles.fieldSectionDivider} />

            {/* 3. Vehicle Registration Number (OPTIONAL) */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={styles.labelWithIcon}>
                  <Text style={styles.fieldLabel}>Vehicle Registration Number</Text>
                  <Text style={styles.fieldOptionalHint}>(Optional)</Text>
                </View>
                <View style={[styles.badgePill, hasPlate ? styles.badgePillSuccess : styles.badgePillOptional]}>
                  <Ionicons 
                    name={hasPlate ? "checkmark-circle" : "information-circle-outline"} 
                    size={11} 
                    color={hasPlate ? "#16A34A" : "#64748B"} 
                  />
                  <Text style={[styles.badgeText, hasPlate ? styles.badgeTextSuccess : styles.badgeTextOptional]}>
                    {hasPlate ? 'Plate Added' : 'Optional'}
                  </Text>
                </View>
              </View>

              <View style={[styles.modernInputBox, hasPlate && styles.modernPlateBoxFilled]}>
                <Ionicons 
                  name="car-outline" 
                  size={19} 
                  color={hasPlate ? RED_BAY_COLORS.primary : "#64748B"} 
                  style={styles.fieldInputIcon}
                />
                <TextInput
                  style={styles.modernTextInput}
                  value={vehicleNumber}
                  onChangeText={(text) => setVehicleNumber(text.toUpperCase())}
                  placeholder="Enter vehicle plate (optional)"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  maxLength={10}
                />
                {hasPlate && (
                  <TouchableOpacity 
                    onPress={() => setVehicleNumber('')} 
                    style={styles.clearBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* ================= ORDER SUMMARY CARD (STACKED IN PORTRAIT) ================= */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTopStrip} />

            <View style={styles.summaryHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.summaryReceiptBadge}>
                  <Ionicons name="receipt-outline" size={15} color={RED_BAY_COLORS.primary} />
                </View>
                <Text style={styles.summaryTitle}>ORDER SUMMARY</Text>
              </View>
            </View>

            {/* Vehicle Chosen Row */}
            <View style={styles.summaryItemRow}>
              <View style={styles.summaryVehicleImageBox}>
                {vehicleImgSource ? (
                  <Image
                    source={vehicleImgSource}
                    style={styles.summaryVehicleImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons name="car-sport" size={24} color={RED_BAY_COLORS.primary} />
                )}
              </View>
              <View style={styles.summaryItemInfo}>
                <Text style={styles.summaryItemLabel}>VEHICLE TYPE</Text>
                <Text style={styles.summaryItemValue}>
                  {selectedVehicle?.name || 'Standard Vehicle'}
                </Text>
                <Text style={styles.summaryItemSub}>
                  {selectedVehicle?.description || 'Selected Category'}
                </Text>
              </View>
            </View>

            {/* Divider Line */}
            <View style={styles.summaryDivider} />

            {/* Package Chosen Row */}
            <View style={styles.summaryItemRow}>
              <View style={styles.summaryPackageIconBox}>
                <Ionicons name="sparkles" size={22} color={RED_BAY_COLORS.primary} />
              </View>
              <View style={styles.summaryItemInfo}>
                <Text style={styles.summaryItemLabel}>SERVICE PACKAGE</Text>
                <Text style={styles.summaryItemValue}>
                  {selectedPackage?.name || 'Selected Package'}
                </Text>
                <Text style={styles.summaryItemSub}>
                  {selectedPackage?.durationMinutes 
                    ? `${selectedPackage.durationMinutes} mins service` 
                    : 'Complete car care'}
                </Text>
              </View>
              {selectedPackage && (
                <View style={styles.summaryPriceBox}>
                  <Text style={styles.summaryPriceText}>{priceFormatted}</Text>
                  <Text style={styles.summaryGstText}>
                    {selectedPackage.isTaxInclusive ? 'Incl. 9% GST' : '+ 9% GST'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Navigation Buttons: Pinned at bottom */}
      <KioskNavButtons
        onContinue={handleContinue}
        continueDisabled={isSubmitting}
        isLoading={isSubmitting}
        continueLabel={
          isSubmitting
            ? 'Processing Order...'
            : isDealer
              ? 'CONTINUE TO CREDIT SUMMARY'
              : selectedPackage
                ? `Proceed to Payment (${priceFormatted})`
                : 'Proceed to Payment'
        }
      />
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
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 14,
    marginBottom: 4,
  },
  stepBadgeText: {
    color: RED_BAY_COLORS.primary,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  titleUnderlineAccent: {
    width: 44,
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
    borderRadius: 2,
    marginTop: 8,
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
    gap: 14,
  },
  /* Form Card */
  formCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    gap: 14,
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.06, 12, 3),
  },
  formAccentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  cardSectionSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  secureBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.3,
  },
  requiredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  requiredPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  dealerSkipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 12,
    padding: 10,
  },
  dealerSkipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  dealerSkipIcon: {
    fontSize: 18,
  },
  dealerSkipTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#92400E',
  },
  dealerSkipSubtitle: {
    fontSize: 10.5,
    color: '#B45309',
    fontWeight: '600',
  },
  skipBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  skipBtnText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
  },
  fieldGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  fieldOptionalHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginLeft: 6,
  },
  fieldLabelOptional: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  requiredAsterisk: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 3,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgePillRequired: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  badgePillOptional: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  badgePillSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgePillError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTextRequired: {
    color: '#DC2626',
  },
  badgeTextOptional: {
    color: '#64748B',
  },
  badgeTextSuccess: {
    color: '#16A34A',
  },
  badgeTextError: {
    color: '#DC2626',
  },
  modernInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 52,
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.03, 4, 1),
  },
  fieldInputIcon: {
    marginRight: 10,
  },
  modernInputBoxFilled: {
    borderColor: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  modernInputBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  modernTextInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...(Platform.OS === 'web' ? ({
      outlineStyle: 'none',
      outlineWidth: 0,
      borderStyle: 'none',
    } as any) : {}),
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingLeft: 2,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  fieldHelpText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '500',
    paddingLeft: 2,
  },
  fieldSectionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  modernPlateBoxFilled: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFFDFD',
  },
  clearBtn: {
    padding: 4,
  },

  /* Summary Card (Stacked Below) */
  summaryCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    gap: 12,
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.05, 12, 3),
  },
  summaryTopStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summaryReceiptBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.6,
  },
  summaryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 2,
  },
  summaryVehicleImageBox: {
    width: 82,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    overflow: 'hidden',
  },
  summaryVehicleImage: {
    width: '100%',
    height: '100%',
  },
  summaryPackageIconBox: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryItemInfo: {
    flex: 1,
    gap: 2,
  },
  summaryItemLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  summaryItemValue: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  summaryItemSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
  },
  summaryPriceBox: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  summaryPriceText: {
    fontSize: 17,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
    letterSpacing: 0.3,
  },
  summaryGstText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1,
  },
});

