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
  const progressPercent = Math.max(0, Math.min(100, (countdownSeconds / 30) * 100));
  const isUrgent = countdownSeconds <= 10;

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
              maxWidth: Math.min(width * 0.92, 460),
            },
          ]}
        >
          {/* Soft Tinted Header Area with Layered Icon Halo */}
          <View
            style={[
              styles.headerBand,
              {
                paddingHorizontal: cardPaddingH,
                paddingTop: cardPaddingV,
                paddingBottom: isShortLandscape ? 14 : 20,
              },
            ]}
          >
            <View
              style={[
                styles.iconOuterHalo,
                {
                  width: iconBoxSize + 18,
                  height: iconBoxSize + 18,
                  borderRadius: (iconBoxSize + 18) / 2,
                  marginBottom: isShortLandscape ? 10 : isMobile ? 12 : 16,
                },
              ]}
            >
              <View
                style={[
                  styles.iconInnerCircle,
                  {
                    width: iconBoxSize,
                    height: iconBoxSize,
                    borderRadius: iconBoxSize / 2,
                  },
                ]}
              >
                <Ionicons name="time" size={iconSize} color="#FFFFFF" />
              </View>
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
                },
              ]}
            >
              Would you like to continue your order?
            </Text>
          </View>

          {/* Body & Actions */}
          <View
            style={[
              styles.bodySection,
              {
                paddingHorizontal: cardPaddingH,
                paddingTop: isShortLandscape ? 14 : 18,
                paddingBottom: cardPaddingV,
              },
            ]}
          >
            {/* Countdown Card with Live Progress Bar */}
            <View
              style={[
                styles.countdownCard,
                isUrgent && styles.countdownCardUrgent,
                { marginBottom: isShortLandscape ? 16 : isMobile ? 18 : 22 },
              ]}
            >
              <View style={styles.countdownTopRow}>
                <View style={styles.countdownLabelRow}>
                  <Ionicons
                    name="hourglass-outline"
                    size={isMobile ? 15 : 17}
                    color={isUrgent ? '#DC2626' : '#D97706'}
                  />
                  <Text
                    style={[
                      styles.countdownText,
                      isUrgent && { color: '#991B1B' },
                      { fontSize: isMobile ? 12.5 : 13.5 },
                    ]}
                  >
                    Returning to idle screen in
                  </Text>
                </View>
                <View style={[styles.countdownPill, isUrgent && styles.countdownPillUrgent]}>
                  <Text style={[styles.countdownNum, isUrgent && { color: '#FFFFFF' }]}>
                    {countdownSeconds}s
                  </Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressPercent}%` as any,
                      backgroundColor: isUrgent ? '#EF4444' : '#F59E0B',
                    },
                  ]}
                />
              </View>
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
                    paddingHorizontal: isMobile ? 12 : 16,
                    width: shouldStackButtons ? '100%' : undefined,
                  },
                ]}
                onPress={onCancelOrder}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle-outline" size={btnIconSize} color="#64748B" />
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
                    paddingHorizontal: isMobile ? 14 : 18,
                    width: shouldStackButtons ? '100%' : undefined,
                  },
                ]}
                onPress={onContinueOrder}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={btnIconSize} color="#FFFFFF" />
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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 99999,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        } as any)
      : {}),
  },
  cardContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 18,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 24px 56px rgba(0, 0, 0, 0.28), 0 4px 14px rgba(0, 0, 0, 0.08)',
        } as any)
      : {}),
  },
  headerBand: {
    width: '100%',
    backgroundColor: '#FFF5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOuterHalo: {
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInnerCircle: {
    backgroundColor: '#ED0712',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 6px 16px rgba(237, 7, 18, 0.35)',
        } as any)
      : {
          shadowColor: '#ED0712',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 6,
        }),
  },
  titleText: {
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? ({
          fontFamily: 'system-ui, -apple-system, sans-serif',
          whiteSpace: 'nowrap',
        } as any)
      : {}),
  },
  questionText: {
    color: '#475569',
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 8,
  },
  bodySection: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  countdownCard: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  countdownCardUrgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  countdownTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  countdownLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countdownText: {
    color: '#92400E',
    fontWeight: '600',
  },
  countdownPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countdownPillUrgent: {
    backgroundColor: '#EF4444',
  },
  countdownNum: {
    color: '#B45309',
    fontWeight: '900',
    fontSize: 13,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
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
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  cancelBtnText: {
    fontWeight: '700',
    color: '#475569',
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
    borderRadius: 14,
    backgroundColor: '#ED0712',
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 6px 18px rgba(237, 7, 18, 0.35)',
          whiteSpace: 'nowrap',
          outlineStyle: 'none',
        } as any)
      : {
          shadowColor: '#ED0712',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
        }),
  },
  continueBtnText: {
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    ...(Platform.OS === 'web'
      ? ({
          whiteSpace: 'nowrap',
        } as any)
      : {}),
  },
});

