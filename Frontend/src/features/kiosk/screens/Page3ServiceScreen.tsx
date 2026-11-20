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
import { KioskBackground } from '../components/KioskBackground';
import { ServiceCategory, ServicePackage, DealerOption, VehicleOption } from '../types/kiosk.types';
import { fetchServiceCategories, getCachedServiceCategories } from '../../../services/categoryApi';
import { fetchPackagesByCategory, getCachedPackages } from '../../../services/packageApi';
import { getCachedGstRate } from '../../../services/companySettingsApi';
import { useKioskLanguageStore } from '../store/kioskLanguageStore';
import { KIOSK_TRANSLATIONS } from '../data/kioskTranslations';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { getCategoryVisualMeta } from '../data/kioskCategoryAssets';
import { useKioskResponsive } from '../utils/useKioskResponsive';
import { resolveApiUrl } from '../../../services/apiConfig';

export interface DealerAddonOption {
  id: string;
  name: string;
  price: number;
  icon: string;
  description: string;
}

export const DEALER_ADDONS: DealerAddonOption[] = [
  { id: 'tire_shine', name: 'Tire Shine & Rim Coating', price: 5.0, icon: 'disc-outline', description: 'Deep glossy tire shine with brake dust repellent' },
  { id: 'rain_repellent', name: 'Rain Repellent Windshield Coating', price: 8.0, icon: 'rainy-outline', description: 'Hydrophobic windshield water beading barrier' },
  { id: 'interior_mist', name: 'Interior Antibacterial Mist Fogging', price: 10.0, icon: 'shield-checkmark-outline', description: 'Hospital-grade cabin sanitizing & odor removal' },
  { id: 'engine_degrease', name: 'Engine Bay Quick Degrease', price: 12.0, icon: 'hardware-chip-outline', description: 'Removal of oil residue & engine bay dusting' },
];

interface Page3ServiceScreenProps {
  initialCategory?: ServiceCategory;
  initialPackage?: ServicePackage;
  initialStep?: 'CATEGORIES' | 'PACKAGES';
  isDealer?: boolean;
  dealer?: DealerOption;
  vehicleNumber?: string;
  vehicle?: VehicleOption;
  onContinue: (
    category: ServiceCategory,
    pkg: ServicePackage,
    serviceCategoryId?: number,
    additionalServices?: string,
    additionalAmount?: number
  ) => void;
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
  initialStep,
  isDealer = false,
  dealer,
  vehicleNumber = '',
  vehicle,
  onContinue,
  onBack,
  onExitToPos,
}) => {
  const { language } = useKioskLanguageStore();
  const t = KIOSK_TRANSLATIONS[language] || KIOSK_TRANSLATIONS.EN;
  const { 
    isTallKiosk, 
    isLandscape, 
    isLandscapeShort, 
    contentMaxWidth, 
    horizontalPadding, 
    categoryCols, 
    packageCols, 
    scale, 
    scaleFont, 
    scaleSize, 
    clamp, 
    width 
  } = useKioskResponsive();

  const gstRate = getCachedGstRate();
  const isVeryNarrow = width < 480;
  const categoryCardWidth = categoryCols === 3 ? '31%' : (isVeryNarrow ? '47.5%' : '48%');
  const packageCardWidth = packageCols === 3 ? '31%' : (isVeryNarrow ? '47.5%' : '48%');
  const addonCardWidth = isVeryNarrow ? '47.5%' : (isLandscape && width >= 1000 ? '31.5%' : '48.5%');

  const dynamicCategoryImgHeight = scaleSize(160, 125, 220);
  const dynamicPackageMinHeight = scaleSize(260, 210, 420);

  const initialCategoriesList = getCachedServiceCategories();
  const [categories, setCategories] = useState<ServiceCategory[]>(initialCategoriesList);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(initialCategoriesList.length === 0);
  const [categoryError, setCategoryError] = useState<string>('');

  const targetInitialCatId = initialCategory?.serviceCategoryId || (isDealer && initialCategoriesList.length > 0 ? initialCategoriesList[0].serviceCategoryId : 1);
  const initialPackagesList = getCachedPackages(targetInitialCatId);
  const [packages, setPackages] = useState<ServicePackage[]>(initialPackagesList);
  const [loadingPackages, setLoadingPackages] = useState<boolean>(false);
  const [packageError, setPackageError] = useState<string>('');

  const use3ColCategories = categoryCols === 3;
  const use3ColPackages = packageCols === 3;

  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | undefined>(() => {
    if (initialCategory) return initialCategory;
    if (isDealer && initialCategoriesList.length > 0) return initialCategoriesList[0];
    return undefined;
  });
  const [selectedServiceCategoryId, setSelectedServiceCategoryId] = useState<number | undefined>(() => {
    if (initialCategory?.serviceCategoryId) return initialCategory.serviceCategoryId;
    if (isDealer && initialCategoriesList.length > 0) return initialCategoriesList[0].serviceCategoryId;
    return undefined;
  });
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | undefined>(initialPackage);

  // Default viewStep:
  // For Dealer: always goes directly to PACKAGES
  // For Customer: ALWAYS defaults to CATEGORIES unless specifically asked for PACKAGES with a valid category
  const [viewStep, setViewStep] = useState<'CATEGORIES' | 'PACKAGES'>(
    isDealer ? 'PACKAGES' : (initialStep === 'PACKAGES' && initialCategory ? 'PACKAGES' : 'CATEGORIES')
  );

  // Synchronize viewStep when initialStep prop changes (e.g. navigation from KioskMainScreen)
  useEffect(() => {
    if (isDealer) {
      setViewStep('PACKAGES');
    } else if (initialStep === 'PACKAGES' && initialCategory) {
      setViewStep('PACKAGES');
    } else {
      setViewStep('CATEGORIES');
    }
  }, [initialStep, isDealer, initialCategory]);

  // Synchronize category selection state from parent
  useEffect(() => {
    setSelectedCategory(initialCategory);
    setSelectedServiceCategoryId(initialCategory?.serviceCategoryId);
  }, [initialCategory]);

  // Synchronize package selection state from parent
  useEffect(() => {
    setSelectedPackage(initialPackage);
  }, [initialPackage]);

  // Dealer Additional Services selection state
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const loadCategories = async () => {
    try {
      if (categories.length === 0) {
        setLoadingCategories(true);
      }
      setCategoryError('');
      const data = await fetchServiceCategories();
      if (data && data.length > 0) {
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
        } else if (isDealer && data.length > 0) {
          // For dealer, automatically choose Car Wash and view packages directly
          const defaultCat = data[0];
          setSelectedCategory(defaultCat);
          setSelectedServiceCategoryId(defaultCat.serviceCategoryId);
          setViewStep('PACKAGES');
          loadPackagesForCategory(defaultCat.serviceCategoryId);
        }
      }
    } catch (err: any) {
      if (categories.length === 0) {
        setCategoryError(err?.message || 'Failed to load service categories.');
      }
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadPackagesForCategory = async (categoryId?: number) => {
    if (!categoryId) return;
    try {
      // First check cache synchronously
      const cached = getCachedPackages(categoryId);
      if (cached && cached.length > 0) {
        setPackages(cached);
      } else if (packages.length === 0) {
        setLoadingPackages(true);
      }

      setPackageError('');
      const data = await fetchPackagesByCategory(categoryId);
      if (data && data.length > 0) {
        setPackages(data);

        if (initialPackage) {
          const found = data.find(
            (p) => p.packageId === initialPackage.packageId || p.id === initialPackage.id
          );
          if (found) {
            setSelectedPackage(found);
          }
        } else if (isDealer && data.length > 0 && !selectedPackage) {
          // For dealer, auto-highlight first package
          setSelectedPackage(data[0]);
        }
      }
    } catch (err: any) {
      if (packages.length === 0) {
        setPackageError(err?.message || 'Failed to load service packages.');
      }
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
    setSelectedPackage(pkg);
    if (!isDealer) {
      if (isNavigating) return;
      if (!selectedCategory) return;
      setIsNavigating(true);
      // Single-Click Auto Navigation: proceed immediately to Customer Details
      onContinue(selectedCategory, pkg, selectedServiceCategoryId);
    }
  };

  const handleDealerPlaceCreditOrder = () => {
    if (!selectedPackage || !selectedCategory) return;
    const activeAddons = DEALER_ADDONS.filter((a) => selectedAddonIds.includes(a.id));
    const addonsStr = activeAddons.map((a) => `${a.name} ($${a.price.toFixed(2)})`).join(', ');
    const addonsTotal = activeAddons.reduce((sum, a) => sum + a.price, 0);

    onContinue(
      selectedCategory,
      selectedPackage,
      selectedServiceCategoryId,
      addonsStr || undefined,
      addonsTotal
    );
  };

  const handleBackNavigation = () => {
    setIsNavigating(false);
    if (viewStep === 'PACKAGES' && !isDealer) {
      setViewStep('CATEGORIES');
    } else {
      onBack();
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Canvas with Top Red Swoosh & Bottom Racing Waves */}
      <KioskBackground />

      {/* Top Floating Controls: Back Button, RedBay Logo Badge, Help Button */}
      <KioskTopHeader
        onBack={handleBackNavigation}
        onExitToPos={onExitToPos}
        subtitle={isDealer ? "Dealer Package" : (viewStep === 'CATEGORIES' ? "Category Selection" : "Package Selection")}
      />

      {/* Main Title & Prompt Header (Plain & Transparent) */}
      <View style={styles.promptHeader}>
        <Text style={styles.mainTitle}>
          {isDealer ? "Choose Package & Additional Services" : (viewStep === 'CATEGORIES' ? "Select a Service Category" : "Choose Your Package")}
        </Text>
        <Text style={styles.subtitle}>
          {isDealer 
            ? "Select service package and optional commercial add-ons. Order will be billed automatically to credit."
            : (viewStep === 'CATEGORIES' ? "Choose between exterior wash, paint polishing, or AlCare interior sanitization." : "Select your desired wash package.")}
        </Text>
        <View style={styles.titleUnderlineAccent} />
      </View>

      {/* Main Content Area - RESPONSIVE & BALANCED */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingHorizontal: horizontalPadding }, 
          isTallKiosk && styles.scrollContentTall
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.portraitContainer, { maxWidth: contentMaxWidth, width: '100%' }]}>
          {/* ================= STEP 1: CATEGORY SELECTION ================= */}
          {viewStep === 'CATEGORIES' && (
            loadingCategories && categories.length === 0 ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
                <Text style={styles.loadingText}>Loading categories...</Text>
              </View>
            ) : categoryError && categories.length === 0 ? (
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
                  const hasCatDescription = Boolean(
                    cat.description &&
                    cat.description.trim() !== '' &&
                    cat.description.trim() !== '-'
                  );

                  return (
                    <TouchableOpacity
                      key={cat.serviceCategoryId || cat.id}
                      style={[
                        styles.categoryCard, 
                        { width: categoryCardWidth },
                        use3ColCategories && styles.categoryCard3Col,
                        isTallKiosk && styles.categoryCardTall,
                        { borderColor: meta.cardBorderColor }
                      ]}
                      onPress={() => handleSelectCategory(cat)}
                      activeOpacity={0.9}
                    >
                      {/* Top Photographic Car Image Box */}
                      <View style={[
                        styles.cardImageBox, 
                        { height: dynamicCategoryImgHeight },
                        isTallKiosk && styles.cardImageBoxTall, 
                        isLandscapeShort && styles.cardImageBoxShort
                      ]}>
                        <Image
                          source={cat.imageUrl && cat.hasImage ? { uri: resolveApiUrl(cat.imageUrl) } : meta.image}
                          style={styles.cardImage}
                          resizeMode="cover"
                        />
                      </View>

                      {/* Card Content Body */}
                      <View style={styles.cardBody}>
                        {/* Category Emblem & Title Block */}
                        <View style={styles.cardTopInfoRow}>
                          <View style={[
                            styles.cardEmblemBox,
                            {
                              backgroundColor: '#FFFFFF',
                              borderColor: meta.cardBorderColor,
                            }
                          ]}>
                            {cat.iconUrl && cat.hasIcon ? (
                              <Image
                                source={{ uri: resolveApiUrl(cat.iconUrl) }}
                                style={styles.cardEmblemImage}
                                resizeMode="contain"
                              />
                            ) : (
                              <Ionicons name={meta.iconName} size={22} color={meta.accentColor} />
                            )}
                          </View>
                          <View style={[styles.cardTitleCol, !hasCatDescription && styles.cardTitleColCentered]}>
                            <Text style={styles.cardTitle} numberOfLines={1}>
                              {cat.title.toUpperCase()}
                            </Text>
                            {hasCatDescription && (
                              <Text style={styles.cardSubtitle} numberOfLines={2}>
                                {cat.description!.trim()}
                              </Text>
                            )}
                          </View>
                        </View>

                        {/* 3 Checklist Bullets */}
                        <View style={styles.cardBulletList}>
                          {meta.bullets.map((bullet, idx) => (
                            <View key={idx} style={styles.cardBulletRow}>
                              <Ionicons name="checkmark-circle" size={17} color={meta.accentColor} />
                              <Text style={styles.cardBulletText} numberOfLines={1}>
                                {bullet}
                              </Text>
                            </View>
                          ))}
                        </View>

                        {/* Bottom View Packages Action Button */}
                        <View style={[styles.cardActionBtn, { backgroundColor: meta.btnColor }]}>
                          <Text style={styles.cardActionBtnText}>View Packages</Text>
                          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
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
              {/* Category Switcher Banner */}
              <TouchableOpacity
                style={styles.categorySwitcherPill}
                onPress={() => setViewStep('CATEGORIES')}
                activeOpacity={0.8}
              >
                <View style={styles.switchCatLeft}>
                  <View style={[
                    styles.switchCatIconBox,
                    {
                      borderColor: selectedCategory?.title 
                        ? getCategoryVisualMeta(selectedCategory.title).accentColor 
                        : RED_BAY_COLORS.primary,
                      backgroundColor: '#FFFFFF',
                    }
                  ]}>
                    {selectedCategory?.iconUrl && selectedCategory?.hasIcon ? (
                      <Image
                        source={{ uri: resolveApiUrl(selectedCategory.iconUrl) }}
                        style={styles.switchCatImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Ionicons
                        name="car-sport"
                        size={20}
                        color={selectedCategory?.title 
                          ? getCategoryVisualMeta(selectedCategory.title).accentColor 
                          : RED_BAY_COLORS.primary}
                      />
                    )}
                  </View>
                  <View style={styles.switchCatTextCol}>
                    <Text style={styles.switchCatKicker}>CURRENT CATEGORY</Text>
                    <Text style={styles.switchCatTitle}>
                      {selectedCategory?.title || 'CAR WASH'}
                    </Text>
                  </View>
                </View>
                <View style={styles.changePill}>
                  <Ionicons name="swap-horizontal" size={15} color="#FFFFFF" />
                  <Text style={styles.changePillText}>Change Category</Text>
                </View>
              </TouchableOpacity>

              {loadingPackages && packages.length === 0 ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
                  <Text style={styles.loadingText}>Loading packages...</Text>
                </View>
              ) : packageError && packages.length === 0 ? (
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
                          { width: packageCardWidth, minHeight: dynamicPackageMinHeight },
                          use3ColPackages && styles.packageCard3Col,
                          isTallKiosk && styles.packageCardTall,
                          isLandscapeShort && styles.packageCardShort,
                          isSelected && styles.packageCardSelected,
                        ]}
                        onPress={() => handleSelectPackage(pkg)}
                        activeOpacity={0.88}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                      >
                        {isSelected && <View style={styles.pkgSelectedStrip} />}

                        {/* Package Name & Price Banner */}
                        <View style={styles.pkgHeaderBlock}>
                          <Text style={[styles.packageName, isSelected && styles.packageNameSelected]} numberOfLines={2}>
                            {pkg.name}
                          </Text>
                          <View style={styles.priceRow}>
                            <Text style={[styles.priceAmount, isSelected && styles.priceAmountSelected]}>
                              ${pkg.price.toFixed(2)}
                            </Text>
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
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                          )}
                          <Text style={[styles.pkgActionBtnText, isSelected && styles.pkgActionBtnTextSelected]}>
                            {isSelected ? 'Selected' : 'Select Package'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* ================= DEALER: ADDITIONAL SERVICES & AUTOMATIC CREDIT CHECKOUT ================= */}
              {isDealer && selectedPackage && (
                <View style={styles.dealerSectionWrapper}>
                  {/* Additional Services Section Header */}
                  <View style={styles.dealerSectionHeader}>
                    <View style={styles.dealerSectionBadge}>
                      <Ionicons name="sparkles" size={16} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dealerSectionTitle}>Additional Services (Commercial Add-ons)</Text>
                      <Text style={styles.dealerSectionSub}>
                        Optional services available for {dealer?.name || 'Dealer'} account. Tap to add or remove.
                      </Text>
                    </View>
                  </View>

                  {/* Addons Grid */}
                  <View style={styles.addonsGrid}>
                    {DEALER_ADDONS.map((addon) => {
                      const isAdded = selectedAddonIds.includes(addon.id);
                      return (
                        <TouchableOpacity
                          key={addon.id}
                          style={[
                            styles.addonCard, 
                            { width: addonCardWidth },
                            isAdded && styles.addonCardSelected
                          ]}
                          onPress={() => toggleAddon(addon.id)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.addonTopRow}>
                            <View style={[styles.addonCheckbox, isAdded && styles.addonCheckboxSelected]}>
                              {isAdded && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                            </View>
                            <View style={styles.addonPriceTag}>
                              <Text style={styles.addonPriceTagText}>+${addon.price.toFixed(2)}</Text>
                            </View>
                          </View>
                          <View style={styles.addonContent}>
                            <View style={styles.addonIconBox}>
                              <Ionicons name={addon.icon as any} size={20} color={isAdded ? RED_BAY_COLORS.primary : "#475569"} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.addonName, isAdded && styles.addonNameSelected]}>{addon.name}</Text>
                              <Text style={styles.addonDesc} numberOfLines={2}>{addon.description}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Automatic Credit Checkout Card */}
                  {(() => {
                    const activeAddons = DEALER_ADDONS.filter((a) => selectedAddonIds.includes(a.id));
                    const addonsTotal = activeAddons.reduce((sum, a) => sum + a.price, 0);
                    const grandTotal = Number((selectedPackage.price + addonsTotal).toFixed(2));

                    return (
                      <View style={styles.dealerCreditCard}>
                        {/* Notice Banner */}
                        <View style={styles.dealerCreditNoticeBanner}>
                          <Ionicons name="card" size={20} color="#D97706" />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.dealerCreditNoticeTitle}>AUTOMATIC DEALER CREDIT BILLING</Text>
                            <Text style={styles.dealerCreditNoticeSubtitle}>
                              No Cash, Card, or PayNow required. Total amount is charged automatically to your commercial credit account.
                            </Text>
                          </View>
                          <View style={styles.creditPillTag}>
                            <Text style={styles.creditPillTagText}>CREDIT</Text>
                          </View>
                        </View>

                        {/* Breakdown Rows */}
                        <View style={styles.creditBreakdown}>
                          <View style={styles.creditRow}>
                            <Text style={styles.creditRowLabel}>Dealer Account</Text>
                            <Text style={styles.creditRowValBold}>{dealer?.name} ({dealer?.code})</Text>
                          </View>
                          <View style={styles.creditRow}>
                            <Text style={styles.creditRowLabel}>Vehicle Plate</Text>
                            <Text style={styles.creditRowValBold}>{vehicleNumber || 'WALK-IN'}</Text>
                          </View>
                          <View style={styles.creditRow}>
                            <Text style={styles.creditRowLabel}>Selected Package</Text>
                            <Text style={styles.creditRowVal}>{selectedPackage.name} (${selectedPackage.price.toFixed(2)})</Text>
                          </View>
                          {activeAddons.length > 0 && (
                            <View style={styles.creditRow}>
                              <Text style={styles.creditRowLabel}>Additional Services ({activeAddons.length})</Text>
                              <Text style={styles.creditRowVal}>+${addonsTotal.toFixed(2)}</Text>
                            </View>
                          )}
                          <View style={styles.creditDivider} />
                          <View style={styles.creditTotalRow}>
                            <Text style={styles.creditTotalLabel}>Total Credit Amount</Text>
                            <Text style={styles.creditTotalVal}>${grandTotal.toFixed(2)}</Text>
                          </View>
                        </View>

                        {/* Automatic Submit Button */}
                        <TouchableOpacity
                          style={styles.dealerCreditSubmitBtn}
                          onPress={handleDealerPlaceCreditOrder}
                          activeOpacity={0.88}
                        >
                          <Text style={styles.dealerCreditSubmitBtnText}>
                            Place Order on Credit (${grandTotal.toFixed(2)})
                          </Text>
                          <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    );
                  })()}
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
    backgroundColor: 'transparent',
  },
  promptHeader: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    width: '100%',
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
    fontSize: 27,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 16,
    maxWidth: 520,
    lineHeight: 19,
  },
  titleUnderlineAccent: {
    width: 44,
    height: 4,
    backgroundColor: '#E60012',
    borderRadius: 2,
    marginTop: 10,
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
  scrollContentTall: {
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  portraitContainer: {
    width: '100%',
    alignItems: 'center',
  },
  /* Categories Centered Grid Matching Reference Mockup */
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    rowGap: 18,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: 10,
  },
  categoryCard: {
    width: '48%',
    maxWidth: 360,
    minWidth: 155,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.08, 14, 2),
  },
  categoryCard3Col: {
    width: '31%',
    maxWidth: 320,
    minWidth: 150,
  },
  categoryCardTall: {
    borderRadius: 26,
  },
  cardImageBox: {
    width: '100%',
    height: 160,
    position: 'relative',
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  cardImageBoxTall: {
    height: 195,
  },
  cardImageBoxShort: {
    height: 120,
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
    minHeight: 44,
  },
  cardEmblemBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 3,
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.05, 4, 1),
  },
  cardEmblemImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  cardTitleCol: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitleColCentered: {
    justifyContent: 'center',
    alignSelf: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 14.5,
    fontWeight: '500',
  },
  cardBulletList: {
    gap: 8,
    marginVertical: 4,
  },
  cardBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardBulletText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  cardActionBtn: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    ...makeShadow('#000000', { width: 0, height: 3 }, 0.18, 6, 2),
  },
  cardActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  /* Category Switcher Banner */
  categorySwitcherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    ...makeShadow('#000000', { width: 0, height: 4 }, 0.05, 10, 2),
  },
  switchCatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchCatIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: RED_BAY_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 3,
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.05, 4, 1),
  },
  switchCatImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  switchCatTextCol: {
    justifyContent: 'center',
    gap: 2,
  },
  switchCatKicker: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  switchCatTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    ...makeShadow('#0F172A', { width: 0, height: 2 }, 0.2, 4, 1),
  },
  changePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* Packages Responsive Grid */
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
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'space-between',
    gap: 8,
    ...makeShadow('#000000', { width: 0, height: 6 }, 0.06, 14, 3),
  },
  packageCard3Col: {
    width: '31.8%',
  },
  packageCardTall: {
    padding: 22,
    borderRadius: 26,
    gap: 12,
  },
  packageCardShort: {
    padding: 12,
    borderRadius: 16,
    gap: 6,
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 2,
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
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginVertical: 4,
  },
  pkgFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pkgFeatureText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  pkgFeatureTextSelected: {
    color: '#0F172A',
    fontWeight: '700',
  },
  pkgActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 12,
    backgroundColor: RED_BAY_COLORS.primary,
    marginTop: 6,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 3 }, 0.22, 6, 2),
  },
  pkgActionBtnSelected: {
    backgroundColor: '#0F172A',
    ...makeShadow('#0F172A', { width: 0, height: 3 }, 0.25, 6, 2),
  },
  pkgActionBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  pkgActionBtnTextSelected: {
    color: '#FFFFFF',
  },
  dealerBannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 8,
    gap: 6,
  },
  dealerBannerText: {
    fontSize: 12,
    color: '#92400E',
  },
  dealerBannerBold: {
    fontWeight: '800',
    color: '#78350F',
  },
  dealerSectionWrapper: {
    marginTop: 20,
    marginBottom: 28,
  },
  dealerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  dealerSectionBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealerSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  dealerSectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  addonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  addonCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.04, 6, 1),
  },
  addonCardSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FEF2F2',
  },
  addonTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addonCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  addonCheckboxSelected: {
    backgroundColor: RED_BAY_COLORS.primary,
    borderColor: RED_BAY_COLORS.primary,
  },
  addonPriceTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  addonPriceTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  addonContent: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  addonIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  addonName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 16,
  },
  addonNameSelected: {
    color: RED_BAY_COLORS.primary,
    fontWeight: '800',
  },
  addonDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 14,
  },
  dealerCreditCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: 18,
    ...makeShadow('#000000', { width: 0, height: 4 }, 0.06, 10, 2),
  },
  dealerCreditNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginBottom: 16,
  },
  dealerCreditNoticeTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 0.3,
  },
  dealerCreditNoticeSubtitle: {
    fontSize: 11.5,
    color: '#92400E',
    marginTop: 2,
    lineHeight: 15,
  },
  creditPillTag: {
    backgroundColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  creditPillTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  creditBreakdown: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  creditRowLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  creditRowVal: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '700',
  },
  creditRowValBold: {
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '800',
  },
  creditDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  creditTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  creditTotalLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  creditTotalVal: {
    fontSize: 20,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
  },
  dealerCreditSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RED_BAY_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 4 }, 0.28, 8, 3),
  },
  dealerCreditSubmitBtnText: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
