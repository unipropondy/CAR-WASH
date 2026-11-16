import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface RedBayAlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'alert';
  buttonText?: string;
  onClose: () => void;
}

export const RedBayAlertModal: React.FC<RedBayAlertModalProps> = ({
  visible,
  title,
  message,
  type = 'alert',
  buttonText = 'OK, Understood',
  onClose,
}) => {
  const getIconConfig = () => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle' as const, color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' };
      case 'warning':
        return { name: 'warning' as const, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' };
      case 'info':
        return { name: 'information-circle' as const, color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' };
      case 'alert':
      default:
        return { name: 'notifications' as const, color: '#ED0712', bg: '#FEF2F2', border: '#FECACA' };
    }
  };

  const icon = getIconConfig();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          {/* Top Red Racing Accent Bar */}
          <View style={styles.racingBar} />

          {/* Centered Icon Badge */}
          <View style={[styles.iconCircle, { backgroundColor: icon.bg, borderColor: icon.border }]}>
            <Ionicons name={icon.name} size={32} color={icon.color} />
          </View>

          {/* Title */}
          <Text style={styles.titleText}>{title}</Text>

          {/* Message Content */}
          <Text style={styles.messageText}>{message}</Text>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={buttonText}
          >
            <Text style={styles.actionBtnText}>{buttonText}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 20px 40px -8px rgba(15, 23, 42, 0.35)',
        } as any)
      : {
          elevation: 12,
        }),
  },
  racingBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: '#ED0712',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  actionBtn: {
    width: '100%',
    backgroundColor: '#ED0712',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 14px rgba(237, 7, 18, 0.35)',
          cursor: 'pointer',
        } as any)
      : {
          elevation: 3,
        }),
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

