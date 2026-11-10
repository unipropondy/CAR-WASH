import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { KioskNavButtons } from '../components/KioskNavButtons';
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

  const handleKeyPress = (char: string) => {
    if (isVerifying) return;
    setErrorMessage(null);
    if (pin.length < 8) {
      const nextPin = pin + char;
      setPin(nextPin);
      // Auto-verify when matching dealer PIN
      if (nextPin === dealer.pin) {
        setIsVerifying(true);
        setTimeout(() => {
          onSuccess();
        }, 250);
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
      setErrorMessage('Please enter your dealer PIN.');
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

  const keypadKeys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['CLEAR', '0', '⌫'],
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

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.portraitContainer}>
          <View style={styles.cardContainer}>
            {/* Top Accent Strip */}
            <View style={styles.cardAccentStrip} />

            {/* Selected Dealer Badge Header */}
            <View style={styles.dealerHeaderPill}>
              <View style={styles.dealerIconBadge}>
                <Text style={styles.dealerIcon}>{dealer.icon || '🏢'}</Text>
              </View>
              <View style={styles.dealerInfo}>
                <Text style={styles.accountLabel}>VERIFYING ACCOUNT</Text>
                <Text style={styles.dealerNameText}>{dealer.name}</Text>
                <Text style={styles.dealerCodeText}>Code: {dealer.code} • {dealer.billingCycle}</Text>
              </View>
            </View>

            {/* PIN Input Display */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>ENTER DEALER SECURITY PIN</Text>
              <View style={[styles.inputBox, errorMessage ? styles.inputBoxError : null]}>
                <TextInput
                  style={styles.textInput}
                  value={pin}
                  onChangeText={(text) => {
                    setErrorMessage(null);
                    setPin(text);
                  }}
                  secureTextEntry={!showPin}
                  placeholder="••••"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={8}
                />
                <TouchableOpacity
                  style={styles.toggleVisibilityBtn}
                  onPress={() => setShowPin(!showPin)}
                >
                  <Ionicons name={showPin ? "eye-off-outline" : "eye-outline"} size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
              {errorMessage && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={14} color="#EF4444" />
                  <Text style={styles.errorMessage}>{errorMessage}</Text>
                </View>
              )}
            </View>

            {/* Touch-Friendly Onscreen Keypad */}
            <View style={styles.keypad}>
              {keypadKeys.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.keypadRow}>
                  {row.map((key) => {
                    const isAction = key === 'CLEAR' || key === '⌫';
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.keypadButton, isAction && styles.keypadButtonAction]}
                        onPress={() => {
                          if (key === 'CLEAR') handleClear();
                          else if (key === '⌫') handleBackspace();
                          else handleKeyPress(key);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.keypadButtonText, isAction && styles.keypadButtonTextAction]}>
                          {key}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Navigation Buttons: Pinned at bottom */}
      <KioskNavButtons
        onContinue={handleVerifyPin}
        continueDisabled={!pin}
        continueLabel="Verify & Continue ›"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingVertical: 18,
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
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.05, 12, 3),
  },
  cardAccentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  dealerHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  dealerIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealerIcon: {
    fontSize: 22,
  },
  dealerInfo: {
    flex: 1,
  },
  accountLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: RED_BAY_COLORS.primary,
    letterSpacing: 1,
  },
  dealerNameText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  dealerCodeText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF8F8',
  },
  textInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 6,
  },
  toggleVisibilityBtn: {
    padding: 6,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorMessage: {
    color: '#EF4444',
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
  keypad: {
    gap: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  keypadButton: {
    flex: 1,
    height: 52,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadButtonAction: {
    backgroundColor: '#F1F5F9',
  },
  keypadButtonText: {
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '800',
  },
  keypadButtonTextAction: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '900',
  },
});
