import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';

interface KioskNavButtonsProps {
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  isLoading?: boolean;
  // Optional for backward compatibility with screens where onBack was previously passed to KioskNavButtons
  onBack?: () => void;
  backLabel?: string;
}

export const KioskNavButtons: React.FC<KioskNavButtonsProps> = ({
  onContinue,
  continueDisabled = false,
  continueLabel = 'Continue',
  isLoading = false,
}) => {
  return (
    <View style={styles.outerWrapper}>
      <View style={styles.container}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            continueDisabled && styles.primaryButtonDisabled,
          ]}
          onPress={onContinue}
          disabled={continueDisabled || isLoading}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={continueLabel}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.buttonInner}>
              <Text
                style={[
                  styles.primaryButtonText,
                  continueDisabled && styles.primaryButtonTextDisabled,
                ]}
                numberOfLines={1}
              >
                {continueLabel}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    width: '100%',
    ...makeShadow('#000000', { width: 0, height: -3 }, 0.05, 8, 2),
  },
  container: {
    height: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  primaryButton: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RED_BAY_COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 20,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 4 }, 0.35, 10, 4),
  },
  primaryButtonDisabled: {
    backgroundColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? { boxShadow: 'none' as any } : { shadowOpacity: 0, elevation: 0 }),
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  primaryButtonTextDisabled: {
    color: '#94A3B8',
  },
});
