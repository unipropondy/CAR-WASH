import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Platform, 
  Image, 
  ActivityIndicator,
  useWindowDimensions, 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { KioskBackground } from '../components/KioskBackground';
import { KioskOnScreenKeyboard } from '../components/KioskOnScreenKeyboard';
import { CustomerDetails, DealerOption, VehicleOption, ServicePackage } from '../types/kiosk.types';
import { getCachedGstRate } from '../../../services/companySettingsApi';
import { getVehicleImageSource } from './Page2VehicleScreen';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { useKioskResponsive } from '../utils/useKioskResponsive';

interface Page4DetailsScreenProps {
  initialDetails?: CustomerDetails;
  isDealer?: boolean;
  dealer?: DealerOption;
  selectedVehicle?: VehicleOption;
  selectedPackage?: ServicePackage;
  additionalServices?: string;
  additionalAmount?: number;
  onContinue: (details: CustomerDetails) => Promise<void> | void;
  onSkip?: () => Promise<void> | void;
  onBack: () => void;
  onExitToPos?: () => void;
}

export const Page4DetailsScreen: React.FC<Page4DetailsScreenProps> = ({
  initialDetails,
  isDealer = false,
  dealer,
  selectedVehicle,
  selectedPackage,
  additionalServices,
  additionalAmount = 0,
  onContinue,
  onSkip,
  onBack,
  onExitToPos,
}) => {
  const { 
    isTallKiosk, 
    isLandscape, 
    isLandscapeShort, 
    contentMaxWidth, 
    horizontalPadding, 
    scale, 
    scaleFont, 
    scaleSize, 
    clamp, 
    width 
  } = useKioskResponsive();
  const gstRate = getCachedGstRate();
  const isSideBySide = isLandscape && width >= 850;

  const dynamicInputHeight = scaleSize(52, 46, 68);
  const dynamicInputFontSize = scaleFont(14.5, 13, 19);

  const [customerName, setCustomerName] = useState((initialDetails?.customerName === 'Walk-in Customer' || initialDetails?.customerName === 'Walk-in') ? '' : (initialDetails?.customerName || ''));
  const [mobileNumber, setMobileNumber] = useState(initialDetails?.mobileNumber || '');
  const [vehicleNumber, setVehicleNumber] = useState(initialDetails?.vehicleNumber === 'WALK-IN' ? '' : (initialDetails?.vehicleNumber || ''));

  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeField, setActiveField] = useState<'name' | 'mobile' | 'plate' | null>(null);

  // Field validation
  const hasName = customerName.trim().length > 0;
  const cleanMobile = mobileNumber.replace(/\D/g, '');
  const isMobileValid = cleanMobile.length >= 8 && cleanMobile.length <= 10;
  const hasPlate = vehicleNumber.trim().length > 0;

  const handleMobileChange = (text: string) => {
    // Only numbers allowed, capped at 10 digits
    const digitsOnly = text.replace(/\D/g, '').slice(0, 10);
    setMobileNumber(digitsOnly);
    if (hasAttemptedSubmit) setHasAttemptedSubmit(false);
  };

  const mobileError = !isDealer && hasAttemptedSubmit && !isMobileValid
    ? (cleanMobile.length === 0
        ? 'Mobile number is required'
        : cleanMobile.length < 8
          ? 'Mobile number must be at least 8 digits'
          : 'Mobile number cannot exceed 10 digits')
    : null;

  const handleContinue = async () => {
    if (isSubmitting) return;

    if (!isDealer) {
      setHasAttemptedSubmit(true);
      if (!isMobileValid) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
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

        await onContinue({
          vehicleNumber: finalPlate,
          customerName: finalName,
          mobileNumber: finalMobile,
        });
      } else {
        const finalPlate = vehicleNumber.trim()
          ? vehicleNumber.trim().toUpperCase()
          : 'WALK-IN';
        const finalName = customerName.trim() || 'Walk-in';
        const finalMobile = cleanMobile;

        await onContinue({
          vehicleNumber: finalPlate,
          customerName: finalName,
          mobileNumber: finalMobile,
        });
      }
    } catch (err: any) {
      console.warn('[Page4DetailsScreen] Continue action failed:', err?.message || err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipForDealer = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (onSkip) {
        await onSkip();
      } else {
        const finalPlate = dealer ? `${dealer.code} FLEET` : 'DEALER FLEET';
        const finalName = dealer ? `${dealer.name}` : 'Authorized Dealer Rep';
        const finalMobile = dealer?.phone ? dealer.phone.replace(/\D/g, '') : '-';

        await onContinue({
          vehicleNumber: finalPlate,
          customerName: finalName,
          mobileNumber: finalMobile,
        });
      }
    } catch (err: any) {
      console.warn('[Page4DetailsScreen] Skip action failed:', err?.message || err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const basePrice = selectedPackage 
    ? (isDealer && selectedPackage.dealerPrice != null ? selectedPackage.dealerPrice : selectedPackage.price)
    : 0;
  const grandTotal = basePrice + (additionalAmount || 0);
  const priceFormatted = `$${grandTotal.toFixed(2)}`;

  const vehicleImgSource = getVehicleImageSource(selectedVehicle);

  return (
    <View style={styles.container}>
      <KioskBackground />
      {/* Top Center Logo & Header */}
      <KioskTopHeader
        subtitle={isDealer ? "DEALER STEP 5: VEHICLE & CONTACT (OPTIONAL)" : "STEP 4 OF 5: CUSTOMER DETAILS"}
        screenName="Page4DetailsScreen.tsx"
        onExitToPos={onExitToPos}
        onBack={onBack}
        backLabel="Packages"
      />

      {/* Main Title & Prompt Header */}
      <View style={styles.promptHeader}>
        <Text style={styles.mainTitle}>
          {isDealer ? "Vehicle & Driver Details (Optional)" : "Customer & Contact Details"}
        </Text>
        <View style={styles.titleUnderlineAccent} />
      </View>

      {/* Main Content Area - RESPONSIVE & BALANCED */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingHorizontal: horizontalPadding }, 
          isTallKiosk && styles.scrollContentTall,
          activeField !== null && { paddingBottom: activeField === 'mobile' ? 300 : 340 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[
          styles.portraitContainer, 
          { maxWidth: contentMaxWidth, width: '100%' }, 
          isSideBySide && { flexDirection: 'row', alignItems: 'flex-start', gap: 20 }
        ]}>
          {/* ================= DETAILS FORM CARD ================= */}
          <View style={[
            styles.formCard, 
            isSideBySide && { flex: 1.25, width: undefined }, 
            isTallKiosk && styles.formCardTall
          ]}>
            <View style={styles.formAccentStrip} />

            {/* Dealer Fast-Track Banner */}
            {isDealer && (
              <View style={styles.dealerSkipBanner}>
                <View style={styles.dealerSkipLeft}>
                  <Text style={styles.dealerSkipIcon}>⚡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dealerSkipTitle}>Dealer Account Billing</Text>
                    <Text style={styles.dealerSkipSubtitle}>
                      {dealer ? `${dealer.name} account • ` : ''}All driver & contact fields are completely optional.
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
                  <Ionicons name={isDealer ? "business-outline" : "id-card-outline"} size={20} color={RED_BAY_COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.cardSectionTitle}>
                    {isDealer ? "Dealer Fleet & Driver Details" : "Customer & Contact Details"}
                  </Text>
                  <Text style={styles.cardSectionSubtitle}>
                    {isDealer ? "All details below are optional for commercial billing" : "Quick verification for wash queue"}
                  </Text>
                </View>
              </View>
              <View style={[styles.secureBadge, isDealer && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                <Ionicons name="shield-checkmark" size={12} color={isDealer ? "#D97706" : "#16A34A"} />
                <Text style={[styles.secureBadgeText, isDealer && { color: '#B45309' }]}>
                  {isDealer ? "Account Credit" : "Fast Checkout"}
                </Text>
              </View>
            </View>

            {/* 1. Customer Name (OPTIONAL) */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={styles.labelWithIcon}>
                  <Text style={styles.fieldLabel}>
                    {isDealer ? "Driver / Contact Name" : "Customer Name"}
                  </Text>
                  <Text style={styles.fieldOptionalHint}>(Optional)</Text>
                </View>
                <View style={[styles.badgePill, hasName ? styles.badgePillSuccess : styles.badgePillOptional]}>
                  <Ionicons 
                    name={hasName ? "checkmark-circle" : "information-circle-outline"} 
                    size={11} 
                    color={hasName ? "#16A34A" : "#64748B"} 
                  />
                  <Text style={[styles.badgeText, hasName ? styles.badgeTextSuccess : styles.badgeTextOptional]}>
                    {hasName ? 'Name Added' : 'Optional'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => setActiveField('name')}
                style={[
                  styles.modernInputBox, 
                  isTallKiosk && styles.modernInputBoxTall,
                  hasName && styles.modernInputBoxFilled,
                  activeField === 'name' && styles.modernInputBoxActive,
                ]}
              >
                <Ionicons 
                  name="person-outline" 
                  size={isTallKiosk ? 22 : 19} 
                  color={activeField === 'name' || hasName ? RED_BAY_COLORS.primary : "#64748B"} 
                  style={styles.fieldInputIcon}
                />
                <TextInput
                  style={[styles.modernTextInput, isTallKiosk && styles.modernTextInputTall]}
                  value={customerName}
                  onChangeText={setCustomerName}
                  onFocus={() => setActiveField('name')}
                  onTouchStart={() => setActiveField('name')}
                  pointerEvents="none"
                  showSoftInputOnFocus={false}
                  placeholder={isDealer ? "Enter driver / contact name (optional)" : "Enter customer name (optional)"}
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                />
                {customerName.length > 0 && (
                  <TouchableOpacity 
                    onPress={(e) => {
                      (e as any)?.stopPropagation?.();
                      setCustomerName('');
                    }} 
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.fieldSectionDivider} />

            {/* 2. Mobile Number (Required for Retail: Min 8, Max 10 digits only) */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <View style={styles.labelWithIcon}>
                  <Text style={styles.fieldLabel}>Mobile Number</Text>
                  {!isDealer ? (
                    <Text style={styles.requiredAsterisk}>*</Text>
                  ) : (
                    <Text style={styles.fieldOptionalHint}>(Optional)</Text>
                  )}
                </View>
                <View style={[
                  styles.badgePill, 
                  isDealer 
                    ? (isMobileValid ? styles.badgePillSuccess : styles.badgePillOptional)
                    : (isMobileValid ? styles.badgePillSuccess : (hasAttemptedSubmit ? styles.badgePillError : styles.badgePillRequired))
                ]}>
                  <Ionicons 
                    name={isMobileValid ? "checkmark-circle" : (isDealer ? "information-circle-outline" : (hasAttemptedSubmit ? "alert-circle" : "ellipse"))} 
                    size={11} 
                    color={isMobileValid ? "#16A34A" : (isDealer ? "#64748B" : "#DC2626")} 
                  />
                  <Text style={[
                    styles.badgeText, 
                    isMobileValid ? styles.badgeTextSuccess : (isDealer ? styles.badgeTextOptional : (hasAttemptedSubmit ? styles.badgeTextError : styles.badgeTextRequired))
                  ]}>
                    {isMobileValid ? 'Done' : (isDealer ? 'Optional' : 'Required')}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => setActiveField('mobile')}
                style={[
                  styles.modernInputBox, 
                  isTallKiosk && styles.modernInputBoxTall,
                  isMobileValid && styles.modernInputBoxFilled,
                  activeField === 'mobile' && styles.modernInputBoxActive,
                  mobileError && styles.modernInputBoxError,
                ]}
              >
                <Ionicons 
                  name="call-outline" 
                  size={isTallKiosk ? 22 : 19} 
                  color={mobileError ? "#EF4444" : (activeField === 'mobile' || isMobileValid ? RED_BAY_COLORS.primary : "#64748B")} 
                  style={styles.fieldInputIcon}
                />
                <TextInput
                  style={[styles.modernTextInput, isTallKiosk && styles.modernTextInputTall]}
                  value={mobileNumber}
                  onChangeText={handleMobileChange}
                  onFocus={() => setActiveField('mobile')}
                  onTouchStart={() => setActiveField('mobile')}
                  pointerEvents="none"
                  showSoftInputOnFocus={false}
                  placeholder={isDealer ? "Enter mobile number (optional)" : "Enter mobile number"}
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={10}
                />
                {mobileNumber.length > 0 && (
                  <TouchableOpacity 
                    onPress={(e) => {
                      (e as any)?.stopPropagation?.();
                      handleMobileChange('');
                    }} 
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
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

              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => setActiveField('plate')}
                style={[
                  styles.modernInputBox, 
                  isTallKiosk && styles.modernInputBoxTall,
                  hasPlate && styles.modernPlateBoxFilled,
                  activeField === 'plate' && styles.modernInputBoxActive,
                ]}
              >
                <Ionicons 
                  name="car-outline" 
                  size={isTallKiosk ? 22 : 19} 
                  color={activeField === 'plate' || hasPlate ? RED_BAY_COLORS.primary : "#64748B"} 
                  style={styles.fieldInputIcon}
                />
                <TextInput
                  style={[styles.modernTextInput, isTallKiosk && styles.modernTextInputTall]}
                  value={vehicleNumber}
                  onChangeText={(text) => setVehicleNumber(text.toUpperCase())}
                  onFocus={() => setActiveField('plate')}
                  onTouchStart={() => setActiveField('plate')}
                  pointerEvents="none"
                  showSoftInputOnFocus={false}
                  placeholder="Enter vehicle plate (optional)"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  maxLength={10}
                />
                {hasPlate && (
                  <TouchableOpacity 
                    onPress={(e) => {
                      (e as any)?.stopPropagation?.();
                      setVehicleNumber('');
                    }} 
                    style={styles.clearBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ================= RIGHT COLUMN: ORDER SUMMARY + ACTION BUTTON ================= */}
          <View style={[
            styles.sideBySideRightCol,
            isSideBySide ? { flex: 1, width: undefined } : { width: '100%' }
          ]}>
            {/* ORDER SUMMARY CARD */}
            <View style={[styles.summaryCard, isTallKiosk && styles.summaryCardTall]}>
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
                    <Text style={styles.summaryPriceText}>
                      ${(isDealer && selectedPackage.dealerPrice != null ? selectedPackage.dealerPrice : selectedPackage.price).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>

              {additionalServices ? (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={[styles.summaryItemRow, { alignItems: 'flex-start' }]}>
                    <View style={[styles.summaryPackageIconBox, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                      <Ionicons name="sparkles" size={18} color="#D97706" />
                    </View>
                    <View style={styles.summaryItemInfo}>
                      <Text style={styles.summaryItemLabel}>À LA CARTE SERVICES</Text>
                      {additionalServices.split(/,\s*/).filter(Boolean).map((svc, idx) => {
                        const match = svc.match(/^(.*?)\s*\(\$([0-9.]+)\)$/);
                        return (
                          <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: idx === 0 ? 3 : 4, gap: 8 }}>
                            <Text style={[styles.summaryItemValue, { fontSize: 13, fontWeight: '700', flex: 1 }]}>
                              • {match ? match[1].trim() : svc}
                            </Text>
                            {match && (
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#D97706' }}>
                                +${Number(match[2]).toFixed(2)}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </>
              ) : null}

              <View style={styles.summaryDivider} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#475569', letterSpacing: 0.5 }}>
                  TOTAL PAYABLE
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: RED_BAY_COLORS.primary }}>
                  {priceFormatted}
                </Text>
              </View>
            </View>

            {/* In-flow Action Button: Always immediately visible right below Order Summary */}
            <View style={styles.inlineActionWrapper}>
              <TouchableOpacity
                style={[
                  styles.inlineProceedBtn,
                  isSubmitting && styles.inlineProceedBtnDisabled,
                ]}
                onPress={handleContinue}
                disabled={isSubmitting}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={
                  isDealer
                    ? 'Confirm Dealer Order'
                    : selectedPackage
                      ? `Proceed to Payment (${priceFormatted})`
                      : 'Proceed to Payment'
                }
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.inlineProceedInner}>
                    <Text style={styles.inlineProceedBtnText}>
                      {isSubmitting
                        ? 'Processing Order...'
                        : isDealer
                          ? 'Confirm Dealer Order (Account Credit) ›'
                          : selectedPackage
                            ? `Proceed to Payment (${priceFormatted}) ›`
                            : 'Proceed to Payment ›'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Kiosk On-Screen Touch Keyboard */}
      <KioskOnScreenKeyboard
        visible={activeField !== null}
        mode={activeField === 'mobile' ? 'numeric' : 'alphanumeric'}
        fieldLabel={
          activeField === 'name'
            ? (isDealer ? 'Driver / Contact Name' : 'Customer Name')
            : activeField === 'mobile'
              ? 'Mobile Number (Numbers Only)'
              : 'Vehicle Registration Number'
        }
        value={
          activeField === 'name'
            ? customerName
            : activeField === 'mobile'
              ? mobileNumber
              : vehicleNumber
        }
        placeholder={
          activeField === 'name'
            ? 'Type customer name...'
            : activeField === 'mobile'
              ? 'Enter 8–10 digit mobile number...'
              : 'Enter vehicle plate...'
        }
        forceUppercase={activeField === 'plate'}
        maxLength={activeField === 'mobile' || activeField === 'plate' ? 10 : 50}
        onChangeText={(nextVal) => {
          if (activeField === 'name') {
            setCustomerName(nextVal);
          } else if (activeField === 'mobile') {
            handleMobileChange(nextVal);
          } else if (activeField === 'plate') {
            setVehicleNumber(nextVal.toUpperCase());
          }
        }}
        onNext={
          activeField === 'name'
            ? () => setActiveField('mobile')
            : activeField === 'mobile'
              ? () => setActiveField('plate')
              : () => setActiveField(null)
        }
        nextLabel={
          activeField === 'name' ? 'Next' : activeField === 'mobile' ? 'Next' : 'Done'
        }
        onClose={() => setActiveField(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? {
          maxHeight: '100%' as any,
        }
      : {}),
  },
  promptHeader: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    width: '100%',
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
    flexShrink: 1,
    width: '100%',
    minHeight: 0,
  },
  scrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingBottom: 40,
    alignItems: 'center',
    flexGrow: 1,
  },
  scrollContentTall: {
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  portraitContainer: {
    width: '100%',
    gap: 14,
  },
  sideBySideRightCol: {
    gap: 14,
  },
  formCardTall: {
    padding: 26,
    borderRadius: 26,
    gap: 20,
  },
  summaryCardTall: {
    padding: 24,
    borderRadius: 26,
    gap: 16,
  },
  inlineActionWrapper: {
    width: '100%',
    marginTop: 4,
    marginBottom: 12,
  },
  inlineProceedBtn: {
    backgroundColor: RED_BAY_COLORS.primary,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 4 }, 0.35, 10, 4),
  },
  inlineProceedBtnDisabled: {
    backgroundColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? { boxShadow: 'none' as any } : { shadowOpacity: 0, elevation: 0 }),
  },
  inlineProceedInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inlineProceedBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
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
    backgroundColor: 'transparent',
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
  modernInputBoxTall: {
    height: 64,
    borderRadius: 18,
    paddingHorizontal: 18,
  },
  fieldInputIcon: {
    marginRight: 10,
  },
  modernInputBoxFilled: {
    borderColor: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  modernInputBoxActive: {
    borderColor: RED_BAY_COLORS.primary,
    borderWidth: 2,
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
  modernTextInputTall: {
    fontSize: 18,
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
    backgroundColor: 'transparent',
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

