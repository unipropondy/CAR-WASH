import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { useKioskResponsive } from '../utils/useKioskResponsive';

interface KioskNavButtonsProps {
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  isLoading?: boolean;
  onBack?: () => void;
  backLabel?: string;
}

export const KioskNavButtons: React.FC<KioskNavButtonsProps> = ({
  onContinue,
  continueDisabled = false,
  continueLabel = 'Continue',
  isLoading = false,
}) => {
  const { isTallKiosk, isLandscapeShort, contentMaxWidth, horizontalPadding, scale, scaleFont, scaleSize } = useKioskResponsive();

  const buttonHeight = scaleSize(54, isLandscapeShort ? 44 : 48, 72);
  const fontSize = scaleFont(16.5, isLandscapeShort ? 14 : 15, 21);

  return (
    <View style={styles.outerWrapper}>
      <View style={[
        styles.container, 
        { maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding }, 
        isTallKiosk && styles.containerTall, 
        isLandscapeShort && styles.containerShort
      ]}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { height: buttonHeight },
            isTallKiosk && styles.primaryButtonTall,
            isLandscapeShort && styles.primaryButtonShort,
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
                  { fontSize },
                  isTallKiosk && styles.primaryButtonTextTall,
                  isLandscapeShort && styles.primaryButtonTextShort,
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
    flexShrink: 0,
    zIndex: 999,
    elevation: 8,
    ...makeShadow('#000000', { width: 0, height: -3 }, 0.05, 8, 2),
  },
  container: {
    height: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
    alignSelf: 'center',
  },
  containerTall: {
    height: 94,
    paddingHorizontal: 28,
  },
  containerShort: {
    height: 62,
    paddingHorizontal: 16,
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
  primaryButtonTall: {
    height: 64,
    borderRadius: 18,
    paddingHorizontal: 28,
  },
  primaryButtonShort: {
    height: 46,
    borderRadius: 12,
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
  primaryButtonTextTall: {
    fontSize: 20,
  },
  primaryButtonTextShort: {
    fontSize: 15,
  },
  primaryButtonTextDisabled: {
    color: '#94A3B8',
  },
});
