import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ImageBackground,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { loginUser } from '../../../services/authApi';
import { useAuthStore } from '../store/authStore';
import { AuthenticatedUser } from '../../../types/auth.types';

export interface LoginScreenProps {
  onLoginSuccess?: (user?: AuthenticatedUser) => void;
  onQuickSwitchToKiosk?: () => void;
  /** Called when the backoffice credentials (ID: 123 / PW: 9976) are entered. */
  onBackofficeAccess?: () => void;
}

/* ---------- Backoffice hard-coded credentials ---------- */
const BACKOFFICE_USER_ID = '123';
const BACKOFFICE_PASSWORD = '9976';

/* ---------- assets (src/features/auth/screens -> Frontend/assets/images) ---------- */
const LOGIN_BG_IMAGE = require('../../../../assets/images/login-bg.jpg');
const CAR_WASH_IMAGE = require('../../../../assets/images/car wash.png');

/* ---------- colours ---------- */
export const LOGIN_BG_COLOR = '#670101';
export const LOGIN_BG_DARK = '#420100';
export const LOGIN_BG_GLOW = '#B70101';
const PRIMARY = '#ED0712';

/* ---------- right side size at 100% (used to scale it to fit the window) ---------- */
const RIGHT_W = 410;
const RIGHT_H = 480;
const SHIFT_LEFT = 0.025; // how far the login block moves left (2.5% of screen width)

/* ---------- "Remember Me" storage (web only for now) ---------- */
const REMEMBER_KEY = 'redbay_remembered_user';
const store = {
  get: (): string | null => {
    try {
      if (Platform.OS !== 'web') return null;
      return (globalThis as any).localStorage?.getItem(REMEMBER_KEY) ?? null;
    } catch {
      return null;
    }
  },
  set: (v: string) => {
    try {
      if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(REMEMBER_KEY, v);
    } catch {}
  },
  clear: () => {
    try {
      if (Platform.OS === 'web') (globalThis as any).localStorage?.removeItem(REMEMBER_KEY);
    } catch {}
  },
};

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; lines: [string, string] }[] = [
  { icon: 'water-outline', lines: ['Premium', 'Car Wash'] },
  { icon: 'shield-checkmark-outline', lines: ['Safe for', 'All Vehicles'] },
  { icon: 'leaf-outline', lines: ['Eco-Friendly', 'Products'] },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onQuickSwitchToKiosk,
  onBackofficeAccess,
}) => {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 900;

  // shrink the right side so it always fits the window: no scrolling
  const rightWidth = isWide ? width * 0.35 : width;
  const scale = Math.max(
    0.5,
    Math.min(1, (height - 48) / RIGHT_H, (rightWidth - 24) / RIGHT_W),
  );
  const shiftX = isWide ? -Math.round(width * SHIFT_LEFT) : 0;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // pre-fill saved user ID
  useEffect(() => {
    const saved = store.get();
    if (saved) {
      setUsername(saved);
      setRemember(true);
    }
  }, []);

  // web only: stop Chrome's blue autofill colour on the input boxes
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'redbay-login-autofill';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.innerHTML = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 1000px #300003 inset !important;
        -webkit-text-fill-color: #FFFFFF !important;
        caret-color: #FFFFFF;
        transition: background-color 9999s ease-in-out 0s;
      }
    `;
    document.head.appendChild(style);
  }, []);

  const handleLogin = async () => {
    setError('');
    const trimmedId = username.trim();
    if (!trimmedId || !password) {
      setError('Enter your user ID and password.');
      return;
    }

    // ── Backoffice credential check (runs BEFORE the regular API login) ──
    if (trimmedId === BACKOFFICE_USER_ID && password === BACKOFFICE_PASSWORD) {
      onBackofficeAccess?.();
      return;
    }

    try {
      setLoading(true);

      const result = await loginUser(trimmedId, password);

      if (!result.success || !result.user) {
        setError(result.message || 'Invalid User ID or Password');
        return;
      }

      if (remember) store.set(trimmedId);
      else store.clear();

      useAuthStore.getState().setUser(result.user, result.token);

      onLoginSuccess?.(result.user);
    } catch (e: any) {
      setError(e?.message || 'Login failed. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={LOGIN_BG_DARK} />

      {Platform.OS === 'web' && <View style={styles.webGradient} />}

      <ImageBackground
        source={LOGIN_BG_IMAGE}
        style={styles.background}
        imageStyle={styles.bgImage}
        resizeMode="cover"
      >
        <View style={styles.vignette} pointerEvents="none" />

        <View style={styles.row}>
          {/* ================= LEFT 65% (unchanged) ================= */}
          {isWide && (
            <View style={styles.left}>
              <Image source={CAR_WASH_IMAGE} style={styles.hero} resizeMode="contain" />

              <View style={styles.tagline}>
                <Text style={styles.taglineWhite}>CLEANER</Text>
                <Text style={styles.taglineWhite}>CARS</Text>
                <Text style={styles.taglineRed}>BRIGHTER</Text>
                <Text style={styles.taglineRed}>DAYS</Text>
              </View>

              <View style={styles.features}>
                {FEATURES.map((f, i) => (
                  <View key={f.icon} style={[styles.feature, i > 0 && styles.featureDivider]}>
                    <Ionicons name={f.icon} size={34} color="#fff" />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.featureText}>{f.lines[0]}</Text>
                      <Text style={styles.featureText}>{f.lines[1]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ================= RIGHT 35% (fixed, no scroll) ================= */}
          <View style={[styles.right, { width: isWide ? '35%' : '100%' }]}>
            <View
              style={[
                styles.rightInner,
                { transform: [{ translateX: shiftX }, { scale }] },
              ]}
            >
              <View style={styles.card}>
                <Text style={styles.title}>Sign In</Text>
                <Text style={styles.subtitle}>Enter your credentials to continue</Text>

                {/* USER ID */}
                <Text style={styles.label}>USER ID</Text>
                <View style={styles.field}>
                  <Ionicons name="person-outline" size={20} color="rgba(255, 255, 255, 0.75)" />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter user ID"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>

                {/* PASSWORD */}
                <Text style={[styles.label, { marginTop: 14 }]}>PASSWORD</Text>
                <View style={styles.field}>
                  <Ionicons name="lock-closed-outline" size={20} color="rgba(255, 255, 255, 0.75)" />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter password"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={handleLogin}
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={() => setShowPassword((s) => !s)}
                    hitSlop={10}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={22}
                      color="rgba(255, 255, 255, 0.75)"
                    />
                  </Pressable>
                </View>

                {/* Remember me */}
                <Pressable
                  style={styles.rememberRow}
                  onPress={() => setRemember((r) => !r)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: remember }}
                >
                  <View style={[styles.checkbox, !remember && styles.checkboxOff]}>
                    {remember && <Ionicons name="checkmark" size={18} color="#fff" />}
                  </View>
                  <Text style={styles.rememberText}>Remember Me</Text>
                </Pressable>

                {!!error && <Text style={styles.error}>{error}</Text>}

                {/* Sign In */}
                <Pressable
                  onPress={handleLogin}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.button,
                    pressed && { opacity: 0.85 },
                    loading && { opacity: 0.7 },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="log-in-outline" size={24} color="#fff" />
                      <Text style={styles.buttonText}>Sign In</Text>
                    </>
                  )}
                </Pressable>

                {onQuickSwitchToKiosk && (
                  <Pressable
                    onPress={onQuickSwitchToKiosk}
                    style={{
                      marginTop: 12,
                      paddingVertical: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 12,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.25)',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                      🖥️ Switch to Customer Kiosk ›
                    </Text>
                  </Pressable>
                )}

                <Text style={styles.footer}>
                  © 2026 Unipro Softwares SG. All Rights Reserved.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
};

export default LoginScreen;

/* ====================================== STYLES ====================================== */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LOGIN_BG_COLOR,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          // pinned to the browser window: the page itself can never scroll
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        } as any)
      : {}),
  },
  background: { ...StyleSheet.absoluteFillObject },
  bgImage: { width: '100%', height: '100%' },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 0, 0, 0.12)',
  },
  row: { flex: 1, flexDirection: 'row' },

  /* ---------- left (same as before) ---------- */
  left: {
    width: '65%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  hero: { width: '100%', maxWidth: 1000, aspectRatio: 1671 / 941 },
  tagline: {
    position: 'absolute',
    left: 28,
    top: '44%',
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY,
  },
  taglineWhite: { color: '#fff', fontSize: 18, fontWeight: '800', lineHeight: 22 },
  taglineRed: { color: PRIMARY, fontSize: 18, fontWeight: '800', lineHeight: 22 },
  features: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  feature: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28 },
  featureDivider: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.3)' },
  featureText: { color: '#fff', fontSize: 14, fontWeight: '500', lineHeight: 18 },

  /* ---------- right ---------- */
  right: {
    height: '100%',
    justifyContent: 'center', // vertical centre
    alignItems: 'center', // horizontal centre
  },
  rightInner: { width: RIGHT_W, alignItems: 'center' },

  /* card: dark red glass */
  card: {
    width: '100%',
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,70,80,0.55)',
    backgroundColor: 'rgba(70,0,8,0.78)',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(160deg, rgba(170,10,22,0.62) 0%, rgba(75,0,8,0.82) 55%, rgba(38,0,4,0.9) 100%)',
          backdropFilter: 'blur(16px) saturate(140%)',
          boxShadow:
            '0 0 28px rgba(237,7,18,0.40), 0 20px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.15)',
        } as any)
      : { elevation: 12 }),
  },
  title: { color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'center' },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  label: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  input: {
    flex: 1,
    marginLeft: 10,
    color: '#FFFFFF',
    fontSize: 16,
    height: '100%',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOff: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  rememberText: { color: '#F1F5F9', fontSize: 14, fontWeight: '600', marginLeft: 10 },
  error: { color: '#FFC9CC', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    gap: 8,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 6px 20px rgba(237,7,18,0.5)', cursor: 'pointer' } as any)
      : { elevation: 6 }),
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  footer: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textAlign: 'center',
  },

  /* ---------- web gradient under the image ---------- */
  webGradient: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: [
            `radial-gradient(40% 45% at 52% 62%, ${LOGIN_BG_GLOW} 0%, transparent 70%)`,
            `radial-gradient(35% 45% at 88% 52%, ${LOGIN_BG_GLOW} 0%, transparent 70%)`,
            `radial-gradient(45% 60% at 22% 25%, ${LOGIN_BG_DARK} 0%, transparent 75%)`,
            `linear-gradient(120deg, ${LOGIN_BG_DARK} 0%, ${LOGIN_BG_COLOR} 45%, #850202 100%)`,
          ].join(', '),
        } as any)
      : {}),
  },
});