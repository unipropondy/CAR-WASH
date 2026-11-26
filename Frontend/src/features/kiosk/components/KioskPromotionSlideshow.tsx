import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Animated,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { resolveApiUrl } from '../../../services/apiConfig';
import {
  KioskPromotion,
  fetchActivePromotions,
  getCachedActivePromotions,
} from '../../../services/promotionApi';

interface KioskPromotionSlideshowProps {
  /** Called when customer taps anywhere on the promotional screen */
  onTouchAnywhere: () => void;
  /** Duration each poster stays on screen in milliseconds (default 5000ms = 5s) */
  slideDurationMs?: number;
  /** Periodic background refresh interval to fetch newly uploaded promotions (default 30000ms = 30s) */
  refreshIntervalMs?: number;
  /** Callback when no active promotions exist in the system */
  onNoPromotions?: () => void;
}

export const KioskPromotionSlideshow: React.FC<KioskPromotionSlideshowProps> = ({
  onTouchAnywhere,
  slideDurationMs = 5000,
  refreshIntervalMs = 30000,
  onNoPromotions,
}) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Initial promotions from in-memory / localStorage cache for zero-latency instant display
  const [promotions, setPromotions] = useState<KioskPromotion[]>(() => {
    return getCachedActivePromotions();
  });
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(() => promotions.length === 0);
  const [imageError, setImageError] = useState<boolean>(false);
  const [useFallbackUrl, setUseFallbackUrl] = useState<boolean>(false);

  const currentPromo = promotions[currentIndex];
  const imageUrl = currentPromo
    ? resolveApiUrl(
        useFallbackUrl
          ? currentPromo.imagePath
          : currentPromo.imageUrl || `/api/promotions/${currentPromo.promotionId}/image`
      )
    : '';

  // Reset image error and fallback state whenever slide index changes
  useEffect(() => {
    setImageError(false);
    setUseFallbackUrl(false);
  }, [currentIndex, currentPromo?.promotionId]);

  // Animation values for smooth cross-fade transition
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsating CTA prompt animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Fetch active promotions from SQL Server API
  const loadPromotions = useCallback(async () => {
    try {
      const activeList = await fetchActivePromotions();
      if (Array.isArray(activeList)) {
        setPromotions(activeList);
        if (activeList.length === 0) {
          onNoPromotions?.();
        }
      }
    } catch (err) {
      console.warn('[KioskPromotionSlideshow] Error fetching promotions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [onNoPromotions]);

  // Initial fetch on mount
  useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  // Periodic background polling to fetch new posters uploaded by Backoffice admin
  useEffect(() => {
    const pollTimer = setInterval(() => {
      loadPromotions();
    }, refreshIntervalMs);

    return () => clearInterval(pollTimer);
  }, [loadPromotions, refreshIntervalMs]);

  // Auto-rotation slideshow timer
  useEffect(() => {
    if (promotions.length <= 1) return;

    const timer = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0.15,
        duration: 350,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        // Switch slide
        setCurrentIndex((prev) => (prev + 1) % promotions.length);

        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 450,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      });
    }, slideDurationMs);

    return () => clearInterval(timer);
  }, [promotions.length, slideDurationMs, fadeAnim]);

  // If no promotions and finished loading, do not render or inform parent
  if (!isLoading && promotions.length === 0) {
    return null;
  }

  return (
    <Pressable
      style={styles.fullScreenContainer}
      onPress={onTouchAnywhere}
      android_disableSound
    >
      {/* Background Poster Image with Cross-Fade */}
      <Animated.View style={[styles.imageWrapper, { opacity: fadeAnim }]}>
        {imageUrl && !imageError ? (
          <>
            {/* Blurred ambient backdrop for non-standard aspect ratios */}
            <Image
              source={{ uri: imageUrl }}
              style={styles.blurredBackdrop}
              blurRadius={Platform.OS === 'web' ? 25 : 12}
              resizeMode="cover"
            />
            {/* Main Crisp Poster */}
            <Image
              source={{ uri: imageUrl }}
              style={styles.mainPoster}
              resizeMode={isLandscape ? 'contain' : 'cover'}
              onError={(e) => {
                console.warn('[KioskPromotionSlideshow] Failed to load poster image:', imageUrl, e.nativeEvent);
                if (!useFallbackUrl && currentPromo?.imagePath) {
                  setUseFallbackUrl(true);
                } else {
                  setImageError(true);
                }
              }}
            />
          </>
        ) : (
          <View style={styles.fallbackPoster}>
            <Ionicons name="sparkles" size={64} color="#ED0712" />
            <Text style={styles.fallbackTitle}>
              {currentPromo?.promotionName || 'RedBay Car Wash'}
            </Text>
            <Text style={styles.fallbackSubtitle}>
              {currentPromo?.description || 'Premium Touchless & Detailing Services'}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Bottom Floating Interactive Call-To-Action (TOUCH ANYWHERE TO START) */}
      <View style={styles.bottomOverlay}>
        <Animated.View
          style={[
            styles.touchCtaBanner,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          {/* Left Circular Red Touch Target with Ripple Icon */}
          <View style={styles.touchCtaIconBox}>
            <MaterialCommunityIcons name="gesture-tap" size={20} color="#FFFFFF" />
          </View>

          {/* Crisp Vertical Divider */}
          <View style={styles.verticalDivider} />

          {/* Single-Line Bold Uppercase Text */}
          <Text style={styles.touchCtaTitle}>TOUCH ANYWHERE TO START</Text>

          {/* Right Red Chevrons (>>) */}
          <View style={styles.chevronsRow}>
            <Ionicons
              name="chevron-forward"
              size={17}
              color="#ED0712"
              style={styles.chevronIcon}
            />
            <Ionicons
              name="chevron-forward"
              size={17}
              color="#ED0712"
              style={[styles.chevronIcon, { marginLeft: -9 }]}
            />
          </View>
        </Animated.View>

        {/* Slideshow Progress Dots */}
        {promotions.length > 1 && (
          <View style={styles.dotsRow}>
            {promotions.map((p, idx) => (
              <View
                key={p.promotionId || idx}
                style={[
                  styles.dot,
                  idx === currentIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    zIndex: 9999,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? {
          cursor: 'pointer',
          userSelect: 'none',
        }
      : {}),
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurredBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.35,
  },
  mainPoster: {
    width: '100%',
    height: '100%',
  },
  fallbackPoster: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#080808',
  },
  fallbackTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  fallbackSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },

  /* Bottom Overlay & CTA */
  bottomOverlay: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 24 : 18,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 100,
    ...(Platform.OS === 'web'
      ? ({
          pointerEvents: 'box-none',
        } as any)
      : {}),
  },
  touchCtaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    position: 'relative',
    maxWidth: '92%',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingVertical: 5.5,
    paddingLeft: 6,
    paddingRight: 16,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#ED0712',
    elevation: 8,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(237, 7, 18, 0.22)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        } as any)
      : {
          shadowColor: '#ED0712',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        }),
  },
  touchCtaIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ED0712',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 2px 8px rgba(237, 7, 18, 0.4)',
        } as any)
      : {
          shadowColor: '#ED0712',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 4,
        }),
  },
  verticalDivider: {
    width: 1.5,
    height: 18,
    backgroundColor: 'rgba(237, 7, 18, 0.3)',
    borderRadius: 1,
  },
  touchCtaTitle: {
    color: '#0F172A',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    ...(Platform.OS === 'web'
      ? ({
          fontFamily: 'system-ui, -apple-system, sans-serif',
          whiteSpace: 'nowrap',
        } as any)
      : {}),
  },
  chevronsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
  },
  chevronIcon: {
    ...(Platform.OS === 'web'
      ? ({
          filter: 'drop-shadow(0 1px 3px rgba(237, 7, 18, 0.35))',
        } as any)
      : {}),
  },

  /* Dots */
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    backgroundColor: '#ED0712',
    shadowColor: '#ED0712',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
});
