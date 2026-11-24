import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InactivityPromptModalProps {
  visible: boolean;
  countdownSeconds: number;
  onContinueOrder: () => void;
  onCancelOrder: () => void;
}

export const InactivityPromptModal: React.FC<InactivityPromptModalProps> = ({
  visible,
  countdownSeconds,
  onContinueOrder,
  onCancelOrder,
}) => {
  const { width, height } = useWindowDimensions();

  if (!visible) return null;

  // Screen size breakpoints
  const isSmallMobile = width < 380;
  const isMobile = width < 520;
  const isShortLandscape = height < 500 && width > height;

  // Adaptive dimensions
  const iconBoxSize = isShortLandscape ? 44 : isMobile ? 54 : 68;
  const iconSize = isShortLandscape ? 24 : isMobile ? 28 : 36;
  const cardPaddingH = isMobile ? 18 : 26;
  const cardPaddingV = isShortLandscape ? 16 : isMobile ? 20 : 28;
  const titleFontSize = isShortLandscape ? 19 : isMobile ? 21 : 25;
  const questionFontSize = isShortLandscape ? 13 : isMobile ? 14 : 15.5;
  const btnFontSize = isSmallMobile ? 12.5 : isMobile ? 13.5 : 15;
  const btnIconSize = isMobile ? 17 : 19;
  const btnPaddingV = isShortLandscape ? 9 : isMobile ? 11 : 13;

  // Button layout: stack vertically only on ultra-narrow screens (< 360px)
  const shouldStackButtons = width < 360;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onContinueOrder}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.cardContainer,
            {
              paddingHorizontal: cardPaddingH,
              paddingVertical: cardPaddingV,
              maxWidth: Math.min(width * 0.92, 460),
            },
          ]}
        >
          {/* Header Icon */}
          <View
            style={[
              styles.iconCircle,
              {
                width: iconBoxSize,
                height: iconBoxSize,
                borderRadius: iconBoxSize / 2,
                marginBottom: isShortLandscape ? 10 : isMobile ? 14 : 18,
              },
            ]}
          >
            <Ionicons name="time-outline" size={iconSize} color="#ED0712" />
          </View>

          {/* Title */}
          <Text
            style={[
              styles.titleText,
              {
                fontSize: titleFontSize,
                marginBottom: isShortLandscape ? 4 : 6,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Are you still there?
          </Text>

          {/* Subtitle / Question */}
          <Text
            style={[
              styles.questionText,
              {
                fontSize: questionFontSize,
                lineHeight: Math.round(questionFontSize * 1.45),
                marginBottom: isShortLandscape ? 10 : isMobile ? 12 : 16,
              },
            ]}
          >
            Would you like to continue your order?
          </Text>

          {/* Countdown indicator */}
          <View
            style={[
              styles.countdownBadge,
              {
                paddingVertical: isMobile ? 4 : 6,
                paddingHorizontal: isMobile ? 10 : 14,
                marginBottom: isShortLandscape ? 14 : isMobile ? 18 : 22,
              },
            ]}
          >
            <Ionicons name="hourglass-outline" size={isMobile ? 14 : 16} color="#F59E0B" />
            <Text style={[styles.countdownText, { fontSize: isMobile ? 12 : 13 }]}>
              Returning to idle in <Text style={styles.countdownNum}>{countdownSeconds}s</Text>
            </Text>
          </View>

          {/* Action Buttons */}
          <View
            style={[
              styles.buttonRow,
              {
                flexDirection: shouldStackButtons ? 'column-reverse' : 'row',
                gap: isMobile ? 10 : 12,
              },
            ]}
          >
            {/* Cancel Order Button */}
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                {
                  paddingVertical: btnPaddingV,
                  paddingHorizontal: isMobile ? 10 : 16,
                  width: shouldStackButtons ? '100%' : undefined,
                },
              ]}
              onPress={onCancelOrder}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={btnIconSize} color="#EF4444" />
              <Text
                style={[styles.cancelBtnText, { fontSize: btnFontSize }]}
                numberOfLines={1}
              >
                Cancel Order
              </Text>
            </TouchableOpacity>

            {/* Continue Order Button */}
            <TouchableOpacity
              style={[
                styles.continueBtn,
                {
                  paddingVertical: btnPaddingV,
                  paddingHorizontal: isMobile ? 12 : 18,
                  width: shouldStackButtons ? '100%' : undefined,
                },
              ]}
              onPress={onContinueOrder}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={btnIconSize} color="#FFFFFF" />
              <Text
                style={[styles.continueBtnText, { fontSize: btnFontSize }]}
                numberOfLines={1}
              >
                Continue Order
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 99999,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        } as any)
      : {}),
  },
  cardContainer: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(237, 7, 18, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ED0712',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 18,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 10px 36px rgba(237, 7, 18, 0.35), 0 4px 12px rgba(0, 0, 0, 0.6)',
        } as any)
      : {}),
  },
  iconCircle: {
    backgroundColor: 'rgba(237, 7, 18, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(237, 7, 18, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? ({
          fontFamily: 'system-ui, -apple-system, sans-serif',
          whiteSpace: 'nowrap',
        } as any)
      : {}),
  },
  questionText: {
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 20,
  },
  countdownText: {
    color: '#FCD34D',
    fontWeight: '600',
  },
  countdownNum: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  buttonRow: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  cancelBtnText: {
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.2,
    ...(Platform.OS === 'web'
      ? ({
          whiteSpace: 'nowrap',
        } as any)
      : {}),
  },
  continueBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#ED0712',
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 14px rgba(237, 7, 18, 0.4)',
          whiteSpace: 'nowrap',
        } as any)
      : {
          shadowColor: '#ED0712',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
        }),
  },
  continueBtnText: {
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    ...(Platform.OS === 'web'
      ? ({
          whiteSpace: 'nowrap',
        } as any)
      : {}),
  },
});

