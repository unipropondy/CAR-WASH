import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Image,
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { DealerOption } from '../types/kiosk.types';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';

interface DealerPasswordScreenProps {
  dealer: DealerOption;
  onSuccess: () => void;
  onBack: () => void;
  onExitToPos?: () => void;
}

export const DealerPasswordScreen: React.FC<DealerPasswordScreenProps> = ({
  dealer,
  onSuccess,
  onBack,
  onExitToPos,
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const pinLength = Math.max(4, dealer.pin ? dealer.pin.length : 4);
  const pinSlots = Array.from({ length: pinLength }, (_, i) => i);
  const logoSource = dealer.logo || (dealer.logoUrl ? { uri: dealer.logoUrl } : null);

  const handleKeyPress = (char: string) => {
    if (isVerifying) return;
    setErrorMessage(null);
    if (pin.length < pinLength) {
      const nextPin = pin + char;
      setPin(nextPin);
      // Auto-verify when matching dealer PIN
      if (nextPin === dealer.pin) {
        setIsVerifying(true);
        setTimeout(() => {
          onSuccess();
        }, 220);
      } else if (nextPin.length === pinLength) {
        setTimeout(() => {
          setErrorMessage(`Incorrect PIN for ${dealer.name}. Please try again.`);
          setPin('');
        }, 220);
      }
    }
  };

  const handleBackspace = () => {
    if (isVerifying) return;
    setErrorMessage(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isVerifying) return;
    setErrorMessage(null);
    setPin('');
  };

  const handleVerifyPin = () => {
    if (isVerifying) return;
    if (!pin) {
      setErrorMessage('Please enter your security PIN.');
      return;
    }

    if (pin.trim() === dealer.pin) {
      setIsVerifying(true);
      setErrorMessage(null);
      onSuccess();
    } else {
      setErrorMessage(`Incorrect PIN for ${dealer.name}. Please try again.`);
      setPin('');
    }
  };

  const keypadRows = [
    [
      { label: '1', value: '1' },
      { label: '2', value: '2' },
      { label: '3', value: '3' },
    ],
    [
      { label: '4', value: '4' },
      { label: '5', value: '5' },
      { label: '6', value: '6' },
    ],
    [
      { label: '7', value: '7' },
      { label: '8', value: '8' },
      { label: '9', value: '9' },
    ],
    [
      { label: 'CLEAR', value: 'CLEAR', isAction: true },
      { label: '0', value: '0' },
      { label: 'BACKSPACE', value: 'BACKSPACE', isAction: true },
    ],
  ];

  return (
    <View style={styles.container}>
      {/* Top Center Logo & Header */}
      <KioskTopHeader
        subtitle="DEALER STEP 2: SECURITY PIN"
        onExitToPos={onExitToPos}
        onBack={onBack}
        backLabel="Dealers"
      />

      {/* Main Title Header */}
      <View style={styles.promptHeader}>
        <Text style={styles.title}>Enter Security PIN</Text>
        <View style={styles.titleUnderlineAccent} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.portraitContainer}>
          <View style={styles.cardContainer}>
            {/* Top Accent Strip */}
            <View style={styles.cardAccentStrip} />

            {/* Selected Dealer Header Pill */}
            <View style={styles.dealerHeaderCard}>
              <View style={styles.dealerLogoBox}>
                {logoSource ? (
                  <Image source={logoSource} style={styles.dealerLogoImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.dealerLogoEmoji}>{dealer.icon || '🏢'}</Text>
                )}
              </View>
              <View style={styles.dealerInfoCol}>
                <Text style={styles.accountTag}>AUTHORIZED DEALER</Text>
                <Text style={styles.dealerNameText}>{dealer.name}</Text>
              </View>
            </View>

            {/* Tactile PIN Indicator Section */}
            <View style={styles.pinSection}>
              <View style={styles.pinHeaderRow}>
                <Text style={styles.pinSectionLabel}>SECURITY PIN</Text>
                <TouchableOpacity
                  style={styles.toggleVisibilityBtn}
                  onPress={() => setShowPin(!showPin)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={showPin ? "eye-off-outline" : "eye-outline"} 
                    size={16} 
                    color="#64748B" 
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.toggleVisibilityText}>
                    {showPin ? "Hide" : "Show"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Modern PIN Slot Dots */}
              <View style={styles.pinDotsRow}>
                {pinSlots.map((index) => {
                  const isFilled = pin.length > index;
                  const isCurrent = pin.length === index;

                  return (
                    <View
                      key={index}
                      style={[
                        styles.pinDot,
                        isFilled && styles.pinDotFilled,
                        isCurrent && styles.pinDotCurrent,
                        errorMessage ? styles.pinDotError : null,
                      ]}
                    >
                      {isFilled && showPin && (
                        <Text style={styles.pinDotDigit}>{pin[index]}</Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Hardware Keyboard Fallback Input (transparent) */}
              <TextInput
                style={styles.hiddenInput}
                value={pin}
                onChangeText={(text) => {
                  const cleaned = text.replace(/\D/g, '').slice(0, pinLength);
                  setErrorMessage(null);
                  setPin(cleaned);
                  if (cleaned === dealer.pin) {
                    setIsVerifying(true);
                    setTimeout(() => onSuccess(), 200);
                  } else if (cleaned.length === pinLength) {
                    setTimeout(() => {
                      setErrorMessage(`Incorrect PIN for ${dealer.name}. Please try again.`);
                      setPin('');
                    }, 220);
                  }
                }}
                keyboardType="numeric"
                maxLength={pinLength}
                autoFocus={Platform.OS === 'web'}
                secureTextEntry={!showPin}
              />

              {/* Error Banner */}
              {errorMessage && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={15} color="#EF4444" />
                  <Text style={styles.errorMessage}>{errorMessage}</Text>
                </View>
              )}
            </View>

            {/* Touch-Friendly Tactile Keypad */}
            <View style={styles.keypad}>
              {keypadRows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.keypadRow}>
                  {row.map((btn) => {
                    const isAction = btn.isAction;

                    return (
                      <TouchableOpacity
                        key={btn.value}
                        style={[
                          styles.keypadButton, 
                          isAction && styles.keypadButtonAction,
                        ]}
                        onPress={() => {
                          if (btn.value === 'CLEAR') handleClear();
                          else if (btn.value === 'BACKSPACE') handleBackspace();
                          else handleKeyPress(btn.value);
                        }}
                        activeOpacity={0.75}
                      >
                        {btn.value === 'BACKSPACE' ? (
                          <Ionicons name="backspace-outline" size={24} color="#334155" />
                        ) : btn.value === 'CLEAR' ? (
                          <Text style={styles.keypadActionText}>CLEAR</Text>
                        ) : (
                          <Text style={styles.keypadDigitText}>{btn.label}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
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
  scrollContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  portraitContainer: {
    width: '100%',
    maxWidth: 440,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 22,
    position: 'relative',
    overflow: 'hidden',
    gap: 16,
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.06, 14, 3),
  },
  cardAccentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
  },

  /* Dealer Header Card */
  dealerHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dealerLogoBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 4,
  },
  dealerLogoImage: {
    width: '100%',
    height: '100%',
  },
  dealerLogoEmoji: {
    fontSize: 26,
  },
  dealerInfoCol: {
    flex: 1,
    gap: 2,
  },
  accountTag: {
    fontSize: 9.5,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
    letterSpacing: 1,
  },
  dealerNameText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },

  /* PIN Display Section */
  pinSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    position: 'relative',
  },
  pinHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pinSectionLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1,
  },
  toggleVisibilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  toggleVisibilityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  pinDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDotCurrent: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFF1F2',
  },
  pinDotFilled: {
    backgroundColor: RED_BAY_COLORS.primary,
    borderColor: RED_BAY_COLORS.primary,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 2 }, 0.35, 6, 2),
  },
  pinDotError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  pinDotDigit: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0.01,
    width: 1,
    height: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorMessage: {
    color: '#EF4444',
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },

  /* Keypad */
  keypad: {
    gap: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  keypadButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.04, 4, 1),
  },
  keypadButtonAction: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  keypadDigitText: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
  },
  keypadActionText: {
    color: '#475569',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
