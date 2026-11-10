import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform, Pressable } from 'react-native';
import { useKioskLanguageStore, KIOSK_LANGUAGES, KioskLanguage } from '../store/kioskLanguageStore';
import { Ionicons } from '@expo/vector-icons';

interface KioskLanguageSelectorProps {
  compact?: boolean;
}

export const KioskLanguageSelector: React.FC<KioskLanguageSelectorProps> = ({ compact = false }) => {
  const { language, setLanguage } = useKioskLanguageStore();
  const [modalVisible, setModalVisible] = useState(false);

  const currentOption = KIOSK_LANGUAGES.find((item) => item.code === language) || KIOSK_LANGUAGES[0];

  const handleSelect = (code: KioskLanguage) => {
    setLanguage(code);
    setModalVisible(false);
  };

  return (
    <>
      {/* ================= LANGUAGE TRIGGER BUTTON ================= */}
      <TouchableOpacity
        style={[styles.triggerBtn, compact && styles.triggerBtnCompact]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <View style={styles.triggerIconCircle}>
          <Ionicons name="globe-outline" size={compact ? 16 : 18} color="#ED0712" />
        </View>

        <Text style={[styles.triggerText, compact && styles.triggerTextCompact]}>
          {currentOption.nativeLabel}
        </Text>

        <Ionicons
          name="chevron-down"
          size={compact ? 14 : 16}
          color="#64748B"
          style={{ marginLeft: 2 }}
        />
      </TouchableOpacity>

      {/* ================= CHOOSE LANGUAGE MODAL / POPOVER ================= */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleGroup}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="globe" size={20} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Choose Language</Text>
                  <Text style={styles.modalSubtitle}>Select your preferred kiosk language</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setModalVisible(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* 4 Language Selection Options */}
            <View style={styles.optionsList}>
              {KIOSK_LANGUAGES.map((item) => {
                const isSelected = language === item.code;
                return (
                  <TouchableOpacity
                    key={item.code}
                    style={[styles.optionItem, isSelected && styles.optionItemActive]}
                    onPress={() => handleSelect(item.code)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.optionLeft}>
                      <View style={[styles.langBadge, isSelected && styles.langBadgeActive]}>
                        <Text style={[styles.langBadgeText, isSelected && styles.langBadgeTextActive]}>
                          {item.code}
                        </Text>
                      </View>

                      <View>
                        <Text style={[styles.optionNativeText, isSelected && styles.optionNativeTextActive]}>
                          {item.nativeLabel}
                        </Text>
                        <Text style={styles.optionSubText}>{item.label}</Text>
                      </View>
                    </View>

                    {isSelected ? (
                      <View style={styles.checkCircleActive}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View style={styles.checkCircleInactive} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    gap: 8,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        } as any)
      : { elevation: 2 }),
  },
  triggerBtnCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  triggerIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  triggerTextCompact: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* Modal Backdrop */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as any) : {}),
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    width: '100%',
    maxWidth: 420,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)',
        } as any)
      : { elevation: 10 }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  modalHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ED0712',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsList: {
    gap: 10,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        } as any)
      : {}),
  },
  optionItemActive: {
    borderColor: '#ED0712',
    backgroundColor: '#FEF2F2',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  langBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBadgeActive: {
    backgroundColor: '#ED0712',
  },
  langBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#475569',
  },
  langBadgeTextActive: {
    color: '#FFFFFF',
  },
  optionNativeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  optionNativeTextActive: {
    color: '#ED0712',
  },
  optionSubText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  checkCircleActive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ED0712',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleInactive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
});
