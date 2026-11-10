import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Image, 
  ActivityIndicator,
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KioskTopHeader } from '../components/KioskTopHeader';
import { ServiceCategory, ServicePackage } from '../types/kiosk.types';
import { fetchServiceCategories } from '../../../services/categoryApi';
import { fetchPackagesByCategory } from '../../../services/packageApi';
import { useKioskLanguageStore } from '../store/kioskLanguageStore';
import { KIOSK_TRANSLATIONS } from '../data/kioskTranslations';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { getCategoryVisualMeta } from '../data/kioskCategoryAssets';

interface Page3ServiceScreenProps {
  initialCategory?: ServiceCategory;
  initialPackage?: ServicePackage;
  onContinue: (category: ServiceCategory, pkg: ServicePackage, serviceCategoryId?: number) => void;
  onBack: () => void;
  onExitToPos?: () => void;
}

function getPackageFeatures(pkg: ServicePackage): string[] {
  if (Array.isArray(pkg.features) && pkg.features.length > 0) {
    return pkg.features;
  }
  if (pkg.description) {
    if (pkg.description.includes(',')) {
      const parts = pkg.description.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) return parts.slice(0, 3);
    }
    if (pkg.description.includes('.')) {
      const parts = pkg.description.split('.').map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) return parts.slice(0, 3);
    }
  }
  const code = (pkg.packageCode || pkg.name || '').toUpperCase();
  if (code.includes('FOAM') || code.includes('EXPRESS')) {
    return [
      'High-density snow foam shampoo',
      'Wheel face degreasing',
      'Clean soft chamois hand dry',
    ];
  }
  if (code.includes('DELUXE') || code.includes('VACUUM')) {
    return [
      'Premium exterior snow foam wash',
      'Complete interior cabin vacuum',
      'Soft chamois dry & wipe down',
    ];
  }
  if (code.includes('HYDRO') || code.includes('WAX') || code.includes('PREMIUM')) {
    return [
      'Hydrophobic protective wax coat',
      'Deep exterior foam wash',
      'Tire shine & wheel degreasing',
    ];
  }
  if (pkg.description) {
    return [pkg.description];
  }
  return ['Professional express wash', 'Hand chamois dry', 'Quality satisfaction guaranteed'];
}

export const Page3ServiceScreen: React.FC<Page3ServiceScreenProps> = ({
  initialCategory,
  initialPackage,
  onContinue,
  onBack,
  onExitToPos,
}) => {
  const { language } = useKioskLanguageStore();
  const t = KIOSK_TRANSLATIONS[language] || KIOSK_TRANSLATIONS.EN;

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(true);
  const [categoryError, setCategoryError] = useState<string>('');

  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState<boolean>(false);
  const [packageError, setPackageError] = useState<string>('');

  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | undefined>(initialCategory);
  const [selectedServiceCategoryId, setSelectedServiceCategoryId] = useState<number | undefined>(
    initialCategory?.serviceCategoryId
  );
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | undefined>(initialPackage);

  const [viewStep, setViewStep] = useState<'CATEGORIES' | 'PACKAGES'>(
    initialCategory ? 'PACKAGES' : 'CATEGORIES'
  );

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      setCategoryError('');
      const data = await fetchServiceCategories();
      setCategories(data);

      if (initialCategory) {
        const found = data.find(
          (c) => c.serviceCategoryId === initialCategory.serviceCategoryId || c.id === initialCategory.id
        );
        if (found) {
          setSelectedCategory(found);
          setSelectedServiceCategoryId(found.serviceCategoryId);
          loadPackagesForCategory(found.serviceCategoryId);
        }
      }
    } catch (err: any) {
      setCategoryError(err?.message || 'Failed to load service categories.');
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadPackagesForCategory = async (categoryId?: number) => {
    if (!categoryId) return;
    try {
      setLoadingPackages(true);
      setPackageError('');
      const data = await fetchPackagesByCategory(categoryId);
      setPackages(data);

      if (initialPackage) {
        const found = data.find(
          (p) => p.packageId === initialPackage.packageId || p.id === initialPackage.id
        );
        if (found) {
          setSelectedPackage(found);
        }
      }
    } catch (err: any) {
      setPackageError(err?.message || 'Failed to load service packages.');
    } finally {
      setLoadingPackages(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const [isNavigating, setIsNavigating] = useState(false);

  const handleSelectCategory = (cat: ServiceCategory) => {
    setIsNavigating(false);
    setSelectedCategory(cat);
    setSelectedServiceCategoryId(cat.serviceCategoryId);
    setSelectedPackage(undefined);
    setViewStep('PACKAGES');
    loadPackagesForCategory(cat.serviceCategoryId);
  };

  const handleSelectPackage = (pkg: ServicePackage) => {
    if (isNavigating) return;
    if (!selectedCategory) return;
    setIsNavigating(true);
    setSelectedPackage(pkg);
    // Single-Click Auto Navigation: proceed immediately to Customer Details
    onContinue(selectedCategory, pkg, selectedServiceCategoryId);
  };

  const handleBackNavigation = () => {
    setIsNavigating(false);
    if (viewStep === 'PACKAGES') {
      setViewStep('CATEGORIES');
    } else {
      onBack();
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Center Logo & Header */}
      <KioskTopHeader
        subtitle={viewStep === 'CATEGORIES' ? "STEP 2 OF 5: CATEGORY" : "STEP 2 OF 5: PACKAGE"}
        onExitToPos={onExitToPos}
        onBack={handleBackNavigation}
        backLabel={viewStep === 'PACKAGES' ? 'Categories' : 'Vehicles'}
      />

      {/* Main Title & Prompt Header */}
      <View style={styles.promptHeader}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>
            {viewStep === 'CATEGORIES' ? "STEP 2 OF 5: SERVICE CATEGORY" : "STEP 2 OF 5: SERVICE PACKAGE"}
          </Text>
        </View>
        <Text style={styles.mainTitle}>
          {viewStep === 'CATEGORIES' ? "Select a Service Category" : "Choose Your Package"}
        </Text>
        <Text style={styles.subtitle}>
          {viewStep === 'CATEGORIES' 
            ? "Choose between exterior wash, paint polishing, or Alcare interior sanitization."
            : `Available packages for ${selectedCategory?.title || 'CAR WASH'}.`}
        </Text>
        <View style={styles.titleUnderlineAccent} />
      </View>

      {/* Main Content Area - PORTRAIT OPTIMIZED */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.portraitContainer}>
          {/* ================= STEP 1: CATEGORY SELECTION ================= */}
          {viewStep === 'CATEGORIES' && (
            loadingCategories ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
                <Text style={styles.loadingText}>Loading categories...</Text>
              </View>
            ) : categoryError ? (
              <View style={styles.centerContainer}>
                <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
                <Text style={styles.errorText}>{categoryError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadCategories} activeOpacity={0.8}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.categoriesGrid}>
                {categories.map((cat) => {
                  const meta = getCategoryVisualMeta(cat.title);

                  return (
                    <TouchableOpacity
                      key={cat.serviceCategoryId || cat.id}
                      style={[styles.categoryCard, { borderColor: meta.cardBorderColor }]}
                      onPress={() => handleSelectCategory(cat)}
                      activeOpacity={0.9}
                    >
                      {/* Top Photographic Car Image Box */}
                      <View style={styles.cardImageBox}>
                        <Image
                          source={meta.image}
                          style={styles.cardImage}
                          resizeMode="cover"
                        />
                        {/* Floating Pill Badge Over Image */}
                        <View style={[styles.cardFloatingBadge, { backgroundColor: meta.badgeBg }]}>
                          <Ionicons 
                            name={meta.badgeIcon} 
                            size={11} 
                            color={meta.badgeColor} 
                            style={{ marginRight: 4 }} 
                          />
                          <Text style={[styles.cardFloatingBadgeText, { color: meta.badgeColor }]}>
                            {meta.badge}
                          </Text>
                        </View>
                      </View>

                      {/* Card Content Body */}
                      <View style={styles.cardBody}>
                        {/* Category Emblem & Title Block */}
                        <View style={styles.cardTopInfoRow}>
                          <View style={[styles.cardEmblemBox, { backgroundColor: meta.accentColor }]}>
                            <Ionicons name={meta.iconName} size={22} color="#FFFFFF" />
                          </View>
                          <View style={styles.cardTitleCol}>
                            <Text style={styles.cardTitle} numberOfLines={1}>
                              {cat.title.toUpperCase()}
                            </Text>
                            <Text style={styles.cardSubtitle} numberOfLines={2}>
                              {cat.description || meta.defaultSubtitle}
                            </Text>
                          </View>
                        </View>

                        {/* 3 Checklist Bullets */}
                        <View style={styles.cardBulletList}>
                          {meta.bullets.map((bullet, idx) => (
                            <View key={idx} style={styles.cardBulletRow}>
                              <Ionicons name="checkmark-circle" size={16} color={meta.accentColor} />
                              <Text style={styles.cardBulletText} numberOfLines={1}>
                                {bullet}
                              </Text>
                            </View>
                          ))}
                        </View>

                        {/* Bottom View Packages Action Button */}
                        <View style={[styles.cardActionBtn, { backgroundColor: meta.btnColor }]}>
                          <Text style={styles.cardActionBtnText}>View Packages →</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )
          )}

          {/* ================= STEP 2: PACKAGE SELECTION ================= */}
          {viewStep === 'PACKAGES' && (
            <View style={{ width: '100%' }}>
              {/* Category Switcher Pill */}
              <TouchableOpacity
                style={styles.categorySwitcherPill}
                onPress={() => setViewStep('CATEGORIES')}
                activeOpacity={0.8}
              >
                <View style={styles.switchCatLeft}>
                  <Ionicons name="car-sport" size={16} color={RED_BAY_COLORS.primary} />
                  <Text style={styles.switchCatText}>
                    Category: <Text style={styles.switchCatHighlight}>{selectedCategory?.title}</Text>
                  </Text>
                </View>
                <View style={styles.changePill}>
                  <Ionicons name="repeat-outline" size={13} color="#FFFFFF" />
                  <Text style={styles.changePillText}>Change Category</Text>
                </View>
              </TouchableOpacity>

              {loadingPackages ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
                  <Text style={styles.loadingText}>Loading packages...</Text>
                </View>
              ) : packageError ? (
                <View style={styles.centerContainer}>
                  <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
                  <Text style={styles.errorText}>{packageError}</Text>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => loadPackagesForCategory(selectedServiceCategoryId)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : packages.length === 0 ? (
                <View style={styles.centerContainer}>
                  <Ionicons name="car-outline" size={48} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No Packages Configured</Text>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => setViewStep('CATEGORIES')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.retryBtnText}>Choose Another Category</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.packagesGrid}>
                  {packages.map((pkg) => {
                    const isSelected = selectedPackage?.packageId === pkg.packageId || selectedPackage?.id === pkg.id;
                    const features = getPackageFeatures(pkg);

                    return (
                      <TouchableOpacity
                        key={pkg.packageId || pkg.id}
                        style={[
                          styles.packageCard,
                          isSelected && styles.packageCardSelected,
                        ]}
                        onPress={() => handleSelectPackage(pkg)}
                        activeOpacity={0.88}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                      >
                        {isSelected && <View style={styles.pkgSelectedStrip} />}

                        {/* Top Row: Duration & Radio Check */}
                        <View style={styles.pkgTopRow}>
                          <View style={[styles.durationBadge, isSelected && styles.durationBadgeSelected]}>
                            <Ionicons 
                              name="time-outline" 
                              size={12} 
                              color={isSelected ? RED_BAY_COLORS.primary : "#64748B"} 
                            />
                            <Text style={[styles.durationText, isSelected && styles.durationTextSelected]}>
                              {pkg.durationMinutes ? `${pkg.durationMinutes} mins` : 'Express Service'}
                            </Text>
                          </View>

                          <View style={[styles.packageCheck, isSelected && styles.packageCheckSelected]}>
                            {isSelected ? (
                              <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                            ) : (
                              <View style={styles.packageCheckDot} />
                            )}
                          </View>
                        </View>

                        {/* Package Name & Price Banner */}
                        <View style={styles.pkgHeaderBlock}>
                          <Text style={[styles.packageName, isSelected && styles.packageNameSelected]} numberOfLines={2}>
                            {pkg.name}
                          </Text>
                          <View style={styles.priceRow}>
                            <Text style={[styles.priceAmount, isSelected && styles.priceAmountSelected]}>
                              {pkg.currencyCode || 'SGD'} ${pkg.price.toFixed(2)}
                            </Text>
                            <View style={styles.gstBadge}>
                              <Text style={styles.priceGst}>
                                {pkg.isTaxInclusive ? 'Incl. 9% GST' : '+ 9% GST'}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Divider */}
                        <View style={styles.pkgDivider} />

                        {/* Features Points Checklist */}
                        <View style={styles.pkgFeatureList}>
                          {features.slice(0, 3).map((feat, fIdx) => (
                            <View key={fIdx} style={styles.pkgFeatureItem}>
                              <Ionicons 
                                name="checkmark-circle" 
                                size={14} 
                                color={isSelected ? RED_BAY_COLORS.primary : "#10B981"} 
                              />
                              <Text 
                                style={[styles.pkgFeatureText, isSelected && styles.pkgFeatureTextSelected]} 
                                numberOfLines={2}
                              >
                                {feat}
                              </Text>
                            </View>
                          ))}
                        </View>

                        {/* Bottom CTA Action Button */}
                        <View style={[styles.pkgActionBtn, isSelected && styles.pkgActionBtnSelected]}>
                          <Text style={[styles.pkgActionBtnText, isSelected && styles.pkgActionBtnTextSelected]}>
                            {isSelected ? 'Selected' : 'Select Package'}
                          </Text>
                          <Ionicons 
                            name={isSelected ? "checkmark" : "arrow-forward"} 
                            size={14} 
                            color={isSelected ? "#FFFFFF" : "#0F172A"} 
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  promptHeader: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    width: '100%',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.03, 4, 1),
  },
  stepBadge: {
    backgroundColor: '#E60012',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 6,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  titleUnderlineAccent: {
    width: 46,
    height: 4,
    backgroundColor: '#E60012',
    borderRadius: 2,
    marginTop: 8,
  },
  centerContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748B',
  },
  retryBtn: {
    backgroundColor: RED_BAY_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexGrow: 1,
  },
  portraitContainer: {
    width: '100%',
    maxWidth: 700,
    alignItems: 'center',
  },
  /* Categories 2+1 Centered Grid Matching Reference Mockup */
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
    paddingVertical: 8,
  },
  categoryCard: {
    width: '48%',
    minWidth: 290,
    maxWidth: 335,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    ...makeShadow('#000000', { width: 0, height: 8 }, 0.08, 16, 4),
  },
  cardImageBox: {
    width: '100%',
    height: 145,
    position: 'relative',
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardFloatingBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.25, 4, 1),
  },
  cardFloatingBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardBody: {
    padding: 14,
    gap: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  cardTopInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardEmblemBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.1, 4, 1),
  },
  cardTitleCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
    fontWeight: '500',
  },
  cardBulletList: {
    gap: 8,
    marginVertical: 2,
  },
  cardBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardBulletText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  cardActionBtn: {
    width: '100%',
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    ...makeShadow('#000000', { width: 0, height: 3 }, 0.15, 6, 2),
  },
  cardActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  /* Category Switcher Pill */
  categorySwitcherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.03, 4, 1),
  },
  switchCatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchCatText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  switchCatHighlight: {
    color: '#0F172A',
    fontWeight: '900',
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  changePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  /* Packages 2-Column Responsive Square Grid */
  packagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
    columnGap: 12,
    width: '100%',
    paddingVertical: 4,
  },
  packageCard: {
    width: '48%',
    aspectRatio: 0.98,
    minHeight: 270,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'space-between',
    ...makeShadow('#000000', { width: 0, height: 4 }, 0.05, 10, 2),
  },
  packageCardSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFFDFD',
    borderWidth: 2.5,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 8 }, 0.22, 16, 5),
  },
  pkgSelectedStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  pkgTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  durationBadgeSelected: {
    backgroundColor: '#FEE2E2',
  },
  durationText: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '700',
  },
  durationTextSelected: {
    color: RED_BAY_COLORS.primary,
  },
  packageCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  packageCheckSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: RED_BAY_COLORS.primary,
  },
  packageCheckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  pkgHeaderBlock: {
    gap: 4,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  packageNameSelected: {
    color: RED_BAY_COLORS.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  priceAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  priceAmountSelected: {
    color: RED_BAY_COLORS.primary,
  },
  gstBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priceGst: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  pkgDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
  },
  pkgFeatureList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 8,
    gap: 5,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    flex: 1,
    justifyContent: 'center',
    marginVertical: 2,
  },
  pkgFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pkgFeatureText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  pkgFeatureTextSelected: {
    color: '#0F172A',
    fontWeight: '700',
  },
  pkgActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginTop: 4,
  },
  pkgActionBtnSelected: {
    backgroundColor: RED_BAY_COLORS.primary,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 2 }, 0.25, 4, 1),
  },
  pkgActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  pkgActionBtnTextSelected: {
    color: '#FFFFFF',
  },
});
