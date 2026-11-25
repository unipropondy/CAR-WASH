import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';

export type KeyboardMode = 'numeric' | 'alphanumeric';

interface KioskOnScreenKeyboardProps {
  visible: boolean;
  mode: KeyboardMode;
  fieldLabel: string;
  value: string;
  placeholder?: string;
  forceUppercase?: boolean;
  maxLength?: number;
  onChangeText: (nextValue: string) => void;
  onClose: () => void;
  onNext?: () => void;
  nextLabel?: string;
}

const NUMBER_ROW = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const QWERTY_ROW_1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
const QWERTY_ROW_2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
const QWERTY_ROW_3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

const NUMPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['CLEAR', '0', 'BACK'],
];

export const KioskOnScreenKeyboard: React.FC<KioskOnScreenKeyboardProps> = ({
  visible,
  mode,
  fieldLabel,
  value,
  placeholder = '',
  forceUppercase = false,
  maxLength,
  onChangeText,
  onClose,
  onNext,
  nextLabel = 'Next',
}) => {
  const { width, height } = useWindowDimensions();
  const [isShift, setIsShift] = useState(true);

  if (!visible) return null;

  const isCompact = width < 560 || height < 620;
  const keyHeight = mode === 'numeric' ? (isCompact ? 48 : 56) : (isCompact ? 40 : 48);
  const keyFontSize = mode === 'numeric' ? (isCompact ? 20 : 22) : (isCompact ? 15 : 17);

  const handleKeyPress = (char: string) => {
    if (maxLength && value.length >= maxLength) return;

    let outputChar = char;
    if (mode === 'alphanumeric' && /^[A-Z]$/.test(char)) {
      if (forceUppercase || isShift) {
        outputChar = char.toUpperCase();
      } else {
        outputChar = char.toLowerCase();
      }
      // Auto-disable shift after first character for normal name typing (unless forceUppercase)
      if (!forceUppercase && isShift) {
        setIsShift(false);
      }
    }

    const next = value + outputChar;
    onChangeText(maxLength ? next.slice(0, maxLength) : next);
  };

  const handleSpace = () => {
    if (maxLength && value.length >= maxLength) return;
    if (!forceUppercase) {
      // Auto-capitalize next word for Customer Name
      setIsShift(true);
    }
    onChangeText(value + ' ');
  };

  const handleBackspace = () => {
    if (value.length === 0) return;
    const next = value.slice(0, -1);
    onChangeText(next);
    if (!forceUppercase && (next.length === 0 || next.endsWith(' '))) {
      setIsShift(true);
    }
  };

  const handleClear = () => {
    onChangeText('');
    if (!forceUppercase) {
      setIsShift(true);
    }
  };

  return (
    <View style={styles.keyboardDock}>
      <View style={[styles.keyboardCard, { maxWidth: mode === 'numeric' ? 420 : 820 }]}>
        {/* Top Preview & Control Bar */}
        <View style={styles.topBar}>
          <View style={styles.previewArea}>
            <Text style={styles.fieldTag}>{fieldLabel}</Text>
            <Text style={styles.previewText} numberOfLines={1}>
              {value.length > 0 ? value : <Text style={styles.previewPlaceholder}>{placeholder}</Text>}
            </Text>
          </View>

          <View style={styles.topActions}>
            {onNext && (
              <TouchableOpacity style={styles.nextBtn} onPress={onNext} activeOpacity={0.8}>
                <Text style={styles.nextBtnText}>{nextLabel}</Text>
                <Ionicons name="arrow-forward" size={14} color="#0F172A" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>

        {mode === 'numeric' ? (
          /* ===== NUMBERS-ONLY KEYPAD (MOBILE NUMBER) ===== */
          <View style={styles.numpadGrid}>
            {NUMPAD_ROWS.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.numpadRow}>
                {row.map((key) => {
                  if (key === 'CLEAR') {
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.numKey, styles.actionKey, { height: keyHeight }]}
                        onPress={handleClear}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.actionKeyText, { fontSize: 13 }]}>CLEAR</Text>
                      </TouchableOpacity>
                    );
                  }
                  if (key === 'BACK') {
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.numKey, styles.actionKey, { height: keyHeight }]}
                        onPress={handleBackspace}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="backspace-outline" size={22} color="#334155" />
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.numKey, { height: keyHeight }]}
                      onPress={() => handleKeyPress(key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.keyText, { fontSize: keyFontSize }]}>{key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        ) : (
          /* ===== ALPHANUMERIC KEYBOARD (CUSTOMER NAME & VEHICLE PLATE) ===== */
          <View style={styles.alphaGrid}>
            {/* Row 1: Numbers 1-0 */}
            <View style={styles.alphaRow}>
              {NUMBER_ROW.map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[styles.alphaKey, styles.numHighlightKey, { height: keyHeight }]}
                  onPress={() => handleKeyPress(num)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.keyText, { fontSize: keyFontSize }]}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Row 2: Q-P */}
            <View style={styles.alphaRow}>
              {QWERTY_ROW_1.map((letter) => {
                const label = forceUppercase || isShift ? letter : letter.toLowerCase();
                return (
                  <TouchableOpacity
                    key={letter}
                    style={[styles.alphaKey, { height: keyHeight }]}
                    onPress={() => handleKeyPress(letter)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.keyText, { fontSize: keyFontSize }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Row 3: A-L */}
            <View style={[styles.alphaRow, { paddingHorizontal: isCompact ? 10 : 20 }]}>
              {QWERTY_ROW_2.map((letter) => {
                const label = forceUppercase || isShift ? letter : letter.toLowerCase();
                return (
                  <TouchableOpacity
                    key={letter}
                    style={[styles.alphaKey, { height: keyHeight }]}
                    onPress={() => handleKeyPress(letter)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.keyText, { fontSize: keyFontSize }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Row 4: Shift + Z-M + Backspace */}
            <View style={styles.alphaRow}>
              <TouchableOpacity
                style={[
                  styles.alphaKey,
                  styles.specialAlphaKey,
                  (forceUppercase || isShift) && styles.shiftActiveKey,
                  { height: keyHeight, flex: 1.4 },
                ]}
                onPress={() => {
                  if (!forceUppercase) setIsShift((prev) => !prev);
                }}
                activeOpacity={0.75}
                disabled={forceUppercase}
              >
                <Ionicons
                  name={forceUppercase || isShift ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
                  size={20}
                  color={forceUppercase || isShift ? '#FFFFFF' : '#334155'}
                />
              </TouchableOpacity>

              {QWERTY_ROW_3.map((letter) => {
                const label = forceUppercase || isShift ? letter : letter.toLowerCase();
                return (
                  <TouchableOpacity
                    key={letter}
                    style={[styles.alphaKey, { height: keyHeight }]}
                    onPress={() => handleKeyPress(letter)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.keyText, { fontSize: keyFontSize }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.alphaKey, styles.specialAlphaKey, { height: keyHeight, flex: 1.4 }]}
                onPress={handleBackspace}
                activeOpacity={0.75}
              >
                <Ionicons name="backspace-outline" size={20} color="#334155" />
              </TouchableOpacity>
            </View>

            {/* Row 5: Clear + Space + Done */}
            <View style={styles.alphaRow}>
              <TouchableOpacity
                style={[styles.alphaKey, styles.specialAlphaKey, { height: keyHeight, flex: 1.4 }]}
                onPress={handleClear}
                activeOpacity={0.75}
              >
                <Text style={styles.actionKeyText}>CLEAR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.alphaKey, styles.spaceKey, { height: keyHeight, flex: 4.2 }]}
                onPress={handleSpace}
                activeOpacity={0.75}
              >
                <Text style={styles.spaceKeyText}>SPACE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.alphaKey, styles.enterDoneKey, { height: keyHeight, flex: 1.6 }]}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={styles.enterDoneKeyText}>DONE</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  keyboardDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'web' ? 12 : 16,
    alignItems: 'center',
    zIndex: 9999,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        } as any)
      : {}),
  },
  keyboardCard: {
    width: '100%',
    backgroundColor: '#E2E8F0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    ...makeShadow('#000000', { width: 0, height: -4 }, 0.2, 20, 14),
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 10,
  },
  previewArea: {
    flex: 1,
    minWidth: 0,
  },
  fieldTag: {
    fontSize: 10,
    fontWeight: '800',
    color: RED_BAY_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  previewPlaceholder: {
    color: '#94A3B8',
    fontWeight: '500',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  nextBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: RED_BAY_COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9,
  },
  doneBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* Numeric Keypad */
  numpadGrid: {
    gap: 7,
  },
  numpadRow: {
    flexDirection: 'row',
    gap: 7,
  },
  numKey: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#CBD5E1',
  },
  actionKey: {
    backgroundColor: '#F1F5F9',
  },

  /* Alphanumeric Keyboard */
  alphaGrid: {
    gap: 6,
  },
  alphaRow: {
    flexDirection: 'row',
    gap: 5,
  },
  alphaKey: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#CBD5E1',
  },
  numHighlightKey: {
    backgroundColor: '#F8FAFC',
  },
  specialAlphaKey: {
    backgroundColor: '#CBD5E1',
    borderBottomColor: '#94A3B8',
  },
  shiftActiveKey: {
    backgroundColor: '#0F172A',
    borderBottomColor: '#0F172A',
  },
  spaceKey: {
    backgroundColor: '#FFFFFF',
  },
  spaceKeyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1.5,
  },
  enterDoneKey: {
    backgroundColor: RED_BAY_COLORS.primary,
    borderBottomColor: '#B91C1C',
  },
  enterDoneKeyText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  keyText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  actionKeyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.4,
  },
});
