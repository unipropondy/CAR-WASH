import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { loginUser } from '../../../services/authApi';
import { AuthenticatedUser } from '../../../types/auth.types';
import { resolveUserRoleCategory } from '../../auth/utils/userGroupRouting';
import { useAuthStore } from '../../auth/store/authStore';

interface StaffPosLoginModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (user: AuthenticatedUser) => void;
}

export const StaffPosLoginModal: React.FC<StaffPosLoginModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setUserId('');
      setPassword('');
      setShowPassword(false);
      setErrorMessage(null);
      setIsLoading(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    const trimmedId = userId.trim();
    if (!trimmedId) {
      setErrorMessage('Please enter your Staff User ID or Username');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await loginUser(trimmedId, password);

      if (!res.success || !res.user) {
        setErrorMessage(res.message || 'Invalid User ID or Password');
        setIsLoading(false);
        return;
      }

      // Verify that this user is not restricted to KIOSK only
      const role = resolveUserRoleCategory(res.user);
      if (role === 'KIOSK') {
        setErrorMessage('Access Denied: Kiosk accounts cannot access Staff POS.');
        setIsLoading(false);
        return;
      }

      // Valid staff user! Update global auth store and trigger success
      useAuthStore.getState().setUser(res.user, res.token);
      setIsLoading(false);
      onSuccess(res.user);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Login failed. Please check backend connection.');
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Top Red Racing Accent Bar */}
          <View style={styles.racingBar} />

          {/* Header Icon Badge */}
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={30} color={RED_BAY_COLORS.primary} />
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>Staff POS Authorization</Text>
          <Text style={styles.subtitle}>Enter staff credentials to switch from Kiosk to POS</Text>

          {/* Error Message Box */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>User ID / Username</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 123, 2233, ADMIN"
                placeholderTextColor="#94A3B8"
                value={userId}
                onChangeText={(val) => {
                  setUserId(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Enter password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                onSubmitEditing={handleSubmit}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Buttons Row */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>Sign In to POS</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
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
    backgroundColor: RED_BAY_COLORS.primary,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  errorBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#B91C1C',
    fontWeight: '600',
  },
  formGroup: {
    width: '100%',
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    height: '100%',
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  eyeBtn: {
    padding: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  submitBtn: {
    flex: 1.3,
    height: 46,
    borderRadius: 12,
    backgroundColor: RED_BAY_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 12px rgba(242, 13, 32, 0.35)',
        } as any)
      : {
          elevation: 4,
        }),
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
