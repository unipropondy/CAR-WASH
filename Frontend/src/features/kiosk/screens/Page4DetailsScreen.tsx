import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { KioskNavButtons } from '../components/KioskNavButtons';
import { CustomerDetails, DealerOption, VehicleOption, ServicePackage } from '../types/kiosk.types';
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
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>
            {isDealer ? "STEP 5 • FLEET INFO" : "STEP 4 • CONTACT INFO"}
          </Text>
        </View>
        <Text style={styles.mainTitle}>
          {isDealer ? "Vehicle & Driver Details" : "Customer & Contact Details"}
        </Text>
        <Text style={styles.subtitle}>
          {isDealer
            ? `Logged in as ${dealer?.name || 'Dealer'}. Enter car plate or skip to use fleet billing.`
            : "Please enter your name and mobile number. Vehicle plate is optional."}
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
                  <Ionicons name="clipboard-outline" size={18} color={RED_BAY_COLORS.primary} />
                </View>
                <Text style={styles.cardSectionTitle}>Vehicle & Contact Details</Text>
              </View>
            </View>

            {/* 1. Customer Name (REQUIRED) */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={styles.labelWithIcon}>
                  <Ionicons name="person-outline" size={14} color="#0F172A" />
                  <Text style={styles.fieldLabel}>
                    {isDealer ? "DRIVER NAME" : "CUSTOMER NAME"}
                  </Text>
                  <Text style={styles.requiredAsterisk}>*</Text>
                </View>
                <View style={[styles.badgePill, isNameValid ? styles.badgePillSuccess : (hasAttemptedSubmit ? styles.badgePillError : styles.badgePillRequired)]}>
                  <Ionicons 
                    name={isNameValid ? "checkmark-circle" : (hasAttemptedSubmit ? "alert-circle" : "ellipse")} 
                    size={10} 
                    color={isNameValid ? "#16A34A" : (hasAttemptedSubmit ? "#DC2626" : "#DC2626")} 
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
                  name="person" 
                  size={16} 
                  color={nameError ? "#EF4444" : (isNameValid ? "#0F172A" : "#94A3B8")} 
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={styles.modernTextInput}
                  value={customerName}
                  onChangeText={(text) => {
                    setCustomerName(text);
                    if (hasAttemptedSubmit) setHasAttemptedSubmit(false);
                  }}
                  placeholder={isDealer ? "Driver Name (required)" : "e.g. Alex Tan"}
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
                  <Ionicons name="call-outline" size={14} color="#0F172A" />
                  <Text style={styles.fieldLabel}>MOBILE NUMBER</Text>
                  <Text style={styles.requiredAsterisk}>*</Text>
                </View>
                <View style={[styles.badgePill, isMobileValid ? styles.badgePillSuccess : (hasAttemptedSubmit ? styles.badgePillError : styles.badgePillRequired)]}>
                  <Ionicons 
                    name={isMobileValid ? "checkmark-circle" : (hasAttemptedSubmit ? "alert-circle" : "ellipse")} 
                    size={10} 
                    color={isMobileValid ? "#16A34A" : (hasAttemptedSubmit ? "#DC2626" : "#DC2626")} 
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
                <View style={styles.mobilePrefixPill}>
                  <Text style={styles.mobilePrefixCountry}>SG</Text>
                  <Text style={styles.mobilePrefixText}>+65</Text>
                </View>
                <TextInput
                  style={styles.modernTextInput}
                  value={mobileNumber}
                  onChangeText={(text) => {
                    setMobileNumber(text);
                    if (hasAttemptedSubmit) setHasAttemptedSubmit(false);
                  }}
                  placeholder="e.g. 9123 4567"
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
              {mobileError ? (
                <View style={styles.errorRow}>
                  <Ionicons name="warning" size={13} color="#EF4444" />
                  <Text style={styles.errorText}>{mobileError}</Text>
                </View>
              ) : (
                <Text style={styles.fieldHelpText}>SMS receipt and bay readiness notification will be sent here.</Text>
              )}
            </View>

            {/* Divider */}
            <View style={styles.fieldSectionDivider} />

            {/* 3. Vehicle Registration Number (OPTIONAL) */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={styles.labelWithIcon}>
                  <Ionicons name="car-outline" size={15} color="#475569" />
                  <Text style={styles.fieldLabelOptional}>VEHICLE REGISTRATION NUMBER</Text>
                </View>
                <View style={[styles.badgePill, hasPlate ? styles.badgePillSuccess : styles.badgePillOptional]}>
                  <Ionicons 
                    name={hasPlate ? "checkmark-circle" : "information-circle-outline"} 
                    size={10} 
                    color={hasPlate ? "#16A34A" : "#64748B"} 
                  />
                  <Text style={[styles.badgeText, hasPlate ? styles.badgeTextSuccess : styles.badgeTextOptional]}>
                    {hasPlate ? 'Plate Added' : 'Optional'}
                  </Text>
                </View>
              </View>

              <View style={[styles.modernPlateBox, hasPlate && styles.modernPlateBoxFilled]}>
                <View style={styles.sgPill}>
                  <Text style={styles.sgPillText}>SG</Text>
                </View>
                <TextInput
                  style={styles.modernPlateInput}
                  value={vehicleNumber}
                  onChangeText={(text) => setVehicleNumber(text.toUpperCase())}
                  placeholder="e.g. SBA 1234 A (or leave blank)"
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
              <Text style={styles.fieldHelpText}>
                Optional. Leave blank to process as standard Walk-In order.
              </Text>
            </View>
          </View>

          {/* ================= ORDER SUMMARY CARD (STACKED IN PORTRAIT) ================= */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTopStrip} />

            <View style={styles.summaryHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="receipt-outline" size={16} color="#0F172A" />
                <Text style={styles.summaryTitle}>ORDER SUMMARY</Text>
              </View>
              <View style={styles.summaryStationBadge}>
                <Text style={styles.summaryStationText}>EXPRESS BAY</Text>
              </View>
            </View>

            {/* Vehicle Chosen Row */}
            <View style={styles.summaryItemRow}>
              <View style={styles.summaryIconBox}>
                <Ionicons name="car-sport" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryItemLabel}>VEHICLE TYPE</Text>
                <Text style={styles.summaryItemValue}>
                  {selectedVehicle?.name || 'Standard Vehicle'}
                </Text>
              </View>
            </View>

            {/* Package Chosen Row */}
            <View style={styles.summaryItemRow}>
              <View style={[styles.summaryIconBox, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="sparkles" size={18} color={RED_BAY_COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryItemLabel}>SERVICE PACKAGE</Text>
                <Text style={styles.summaryItemValue}>
                  {selectedPackage?.name || 'Selected Package'}
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
              ? 'CONTINUE TO CREDIT SUMMARY ›'
              : selectedPackage
                ? `Proceed to Payment (${priceFormatted}) ›`
                : 'Proceed to Payment ›'
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
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  cardSectionSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
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
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  fieldLabelOptional: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.3,
  },
  requiredAsterisk: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 1,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgePillRequired: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  badgePillOptional: {
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 48,
  },
  modernInputBoxFilled: {
    borderColor: '#0284C7',
    backgroundColor: '#FFFFFF',
  },
  modernInputBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  mobilePrefixPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
    gap: 6,
  },
  mobilePrefixCountry: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
  },
  mobilePrefixText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  modernTextInput: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
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
  modernPlateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    height: 50,
  },
  modernPlateBoxFilled: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  sgPill: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  sgPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  modernPlateInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    letterSpacing: 1.2,
  },
  clearBtn: {
    padding: 4,
  },

  /* Summary Card (Stacked Below) */
  summaryCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    gap: 10,
    ...makeShadow('#000000', { width: 0, height: 4 }, 0.04, 8, 2),
  },
  summaryTopStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#0F172A',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summaryTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.6,
  },
  summaryStationBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  summaryStationText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#475569',
  },
  summaryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  summaryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryItemLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  summaryItemValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  summaryPriceBox: {
    alignItems: 'flex-end',
  },
  summaryPriceText: {
    fontSize: 15,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
  },
  summaryGstText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
});

