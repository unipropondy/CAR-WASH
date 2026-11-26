import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
  useWindowDimensions,
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
import { fetchAllAddons } from '../../../services/masterApi';

export interface ALaCarteServiceOption {
  id: string;
  addonId?: number;
  name: string;
  customerPrice: number;
  dealerPrice: number;
  category: 'EXTERIOR' | 'INTERIOR';
  icon: string;
  description: string;
  packageIds?: number[];
  packageNames?: string[];
  packageCodes?: string[];
}

export const ALL_A_LA_CARTE_SERVICES: ALaCarteServiceOption[] = [];

/**
 * Filter à la carte services strictly based on the database package mapping (dbo.ServicePackageAddonMapping).
 * If a service is not mapped to the selected package, it is strictly excluded.
 * Interior items appear first, followed by Exterior items.
 */
export function getAvailableALaCarteForPackage(pkg?: ServicePackage, customList?: ALaCarteServiceOption[]): ALaCarteServiceOption[] {
  if (!pkg) {
    const list = customList || [];
    return [...list].sort((a, b) => {
      const aIsInt = (a.category || '').toUpperCase() === 'INTERIOR' ? 0 : 1;
      const bIsInt = (b.category || '').toUpperCase() === 'INTERIOR' ? 0 : 1;
      return aIsInt - bIsInt;
    });
  }

  const list = customList && customList.length > 0 ? customList : [];
  if (list.length === 0) {
    return [];
  }

  const pkgId = pkg.packageId;
  const pkgCode = (pkg.packageCode || pkg.name || '').toUpperCase();

  // Filter strictly by packageId or packageCode
  const filtered = list.filter((item) => {
    // 1. Direct packageId match
    if (pkgId && Array.isArray(item.packageIds) && item.packageIds.includes(pkgId)) {
      return true;
    }
    // 2. PackageCode match
    if (pkgCode && Array.isArray(item.packageCodes) && item.packageCodes.some((c) => c.toUpperCase() === pkgCode)) {
      return true;
    }
    return false;
  });

  // Always enforce Interior services first, Exterior services next
  return [...filtered].sort((a, b) => {
    const aIsInt = (a.category || '').toUpperCase() === 'INTERIOR' ? 0 : 1;
    const bIsInt = (b.category || '').toUpperCase() === 'INTERIOR' ? 0 : 1;
    return aIsInt - bIsInt;
  });
}

// Retain backward-compatible alias
export type DealerAddonOption = ALaCarteServiceOption;
export const DEALER_ADDONS = ALL_A_LA_CARTE_SERVICES;

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
    return ['High-density snow foam shampoo', 'Wheel face degreasing', 'Clean soft chamois hand dry'];
  }
  if (code.includes('DELUXE') || code.includes('VACUUM')) {
    return ['Premium exterior snow foam wash', 'Complete interior cabin vacuum', 'Soft chamois dry & wipe down'];
  }
  if (code.includes('HYDRO') || code.includes('WAX') || code.includes('PREMIUM')) {
    return ['Hydrophobic protective wax coat', 'Deep exterior foam wash', 'Tire shine & wheel degreasing'];
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

  // Screen dimensions — used for responsive modal layout
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTabletOrDesktop = screenWidth >= 768;
  const isPhoneVeryNarrow = screenWidth < 340;
  const modalCols = isTabletOrDesktop ? 3 : (isPhoneVeryNarrow ? 1 : 2);
  const modalAddonCardWidth: any = modalCols === 3 ? '31.8%' : (modalCols === 1 ? '100%' : '48.5%');
  const footerIsStacked = screenWidth < 640;

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
    width,
  } = useKioskResponsive();

  const gstRate = getCachedGstRate();
  const isVeryNarrow = width < 480;
  // Always display Service Categories in a 2-per-row grid (with odd cards centered on the next row)
  const categoryCardWidth = isVeryNarrow ? '47.5%' : '48%';
  const packageCardWidth = packageCols === 3 ? '31%' : (isVeryNarrow ? '47.5%' : '48%');

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

  const use3ColCategories = false;
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

  const [viewStep, setViewStep] = useState<'CATEGORIES' | 'PACKAGES'>(
    isDealer ? 'PACKAGES' : (initialStep === 'PACKAGES' && initialCategory ? 'PACKAGES' : 'CATEGORIES')
  );

  useEffect(() => {
    if (isDealer) {
      setViewStep('PACKAGES');
    } else if (initialStep === 'PACKAGES' && initialCategory) {
      setViewStep('PACKAGES');
    } else {
      setViewStep('CATEGORIES');
    }
  }, [initialStep, isDealer, initialCategory]);

  useEffect(() => {
    setSelectedCategory(initialCategory);
    setSelectedServiceCategoryId(initialCategory?.serviceCategoryId);
  }, [initialCategory]);

  useEffect(() => {
    setSelectedPackage(initialPackage);
  }, [initialPackage]);

  // Committed selected add-ons (after clicking Confirm in the modal)
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [addonsList, setAddonsList] = useState<ALaCarteServiceOption[]>([]);

  // À La Carte popup modal state
  const [showALaCarteModal, setShowALaCarteModal] = useState(false);
  // Pending selections inside the modal (not committed until Confirm)
  const [pendingAddonIds, setPendingAddonIds] = useState<string[]>([]);
  // Active category filter tab in modal: 'ALL' | 'INTERIOR' | 'EXTERIOR'
  const [activeAddonTab, setActiveAddonTab] = useState<'ALL' | 'INTERIOR' | 'EXTERIOR'>('ALL');

  // Fetch dynamic add-ons from database
  useEffect(() => {
    let active = true;
    fetchAllAddons(true)
      .then((records) => {
        if (!active) return;
        const mapped: ALaCarteServiceOption[] = (records || []).map((r) => ({
          id: r.addonCode.toLowerCase(),
          addonId: r.addonId,
          name: r.addonName,
          customerPrice: r.customerPrice,
          dealerPrice: r.dealerPrice,
          category: (r.category && r.category.toUpperCase() === 'INTERIOR' ? 'INTERIOR' : 'EXTERIOR') as 'EXTERIOR' | 'INTERIOR',
          icon: r.icon || ((r.category && r.category.toUpperCase() === 'INTERIOR') ? 'sparkles-outline' : 'car-outline'),
          description: r.description || '',
          packageIds: r.packageIds || [],
          packageNames: r.packageNames || [],
          packageCodes: r.packageCodes || [],
        }));
        // Sort Interior first, Exterior next
        const sorted = [...mapped].sort((a, b) => {
          const aIsInt = a.category === 'INTERIOR' ? 0 : 1;
          const bIsInt = b.category === 'INTERIOR' ? 0 : 1;
          return aIsInt - bIsInt;
        });
        setAddonsList(sorted);
      })
      .catch((err) => {
        console.warn('[Page3ServiceScreen] Could not load dynamic add-ons from DB:', err);
        setAddonsList([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const togglePendingAddon = (id: string) => {
    setPendingAddonIds((prev) =>
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
    setSelectedAddonIds([]);
    setViewStep('PACKAGES');
    loadPackagesForCategory(cat.serviceCategoryId);
  };

  /**
   * When a package card is tapped:
   * 1. Query the database mapping table (dbo.ServicePackageAddonMapping) for this package
   * 2. Filter strictly by package assignment from the DB
   * 3. Clean any stale addon selections that are not assigned to this package
   * 4. Open the À La Carte popup modal
   */
  const handleSelectPackage = async (pkg: ServicePackage) => {
    setSelectedPackage(pkg);
    setActiveAddonTab('ALL');

    let currentAddons = addonsList;
    if (pkg.packageId) {
      try {
        const records = await fetchAllAddons(true, pkg.packageId);
        if (records) {
          const mapped: ALaCarteServiceOption[] = records.map((r) => {
            const pIds = (r.packageIds && r.packageIds.length > 0) ? r.packageIds : (pkg.packageId ? [pkg.packageId] : []);
            return {
              id: r.addonCode.toLowerCase(),
              addonId: r.addonId,
              name: r.addonName,
              customerPrice: r.customerPrice,
              dealerPrice: r.dealerPrice,
              category: (r.category && r.category.toUpperCase() === 'INTERIOR' ? 'INTERIOR' : 'EXTERIOR') as 'EXTERIOR' | 'INTERIOR',
              icon: r.icon || ((r.category && r.category.toUpperCase() === 'INTERIOR') ? 'sparkles-outline' : 'car-outline'),
              description: r.description || '',
              packageIds: pIds,
              packageNames: r.packageNames || [],
              packageCodes: r.packageCodes || [],
            };
          });
          currentAddons = mapped;
          setAddonsList(mapped);
        }
      } catch (err) {
        console.warn('[Page3ServiceScreen] Failed to fetch package addons from DB:', err);
      }
    }

    const available = getAvailableALaCarteForPackage(pkg, currentAddons);
    const availableIdSet = new Set(available.map((a) => a.id));
    const cleanedAddons = selectedAddonIds.filter((id) => availableIdSet.has(id));

    setSelectedAddonIds(cleanedAddons);
    setPendingAddonIds(cleanedAddons);

    // If the package does NOT have any à la carte add-ons in the DB, skip popup and continue directly
    if (available.length === 0) {
      setShowALaCarteModal(false);
      const cat = selectedCategory || initialCategory || (categories.length > 0 ? categories[0] : undefined);
      if (cat) {
        onContinue(
          cat,
          pkg,
          selectedServiceCategoryId || cat.serviceCategoryId,
          undefined,
          0
        );
      }
      return;
    }

    setShowALaCarteModal(true);
  };

  /** Cancel / close the À La Carte modal without committing */
  const handleALaCarteClose = () => {
    setShowALaCarteModal(false);
  };

  /** Confirm: commit pending addon selections and proceed to next screen */
  const handleALaCarteConfirm = () => {
    if (!selectedPackage || !selectedCategory) return;

    // Commit the pending addon selections
    setSelectedAddonIds(pendingAddonIds);
    setShowALaCarteModal(false);

    const available = getAvailableALaCarteForPackage(selectedPackage, addonsList);
    const activeAddons = available.filter((a) => pendingAddonIds.includes(a.id));
    const addonsStr = activeAddons
      .map((a) => {
        const itemPrice = isDealer ? a.dealerPrice : a.customerPrice;
        return `${a.name} ($${itemPrice.toFixed(2)})`;
      })
      .join(', ');
    const addonsTotal = activeAddons.reduce(
      (sum, a) => sum + (isDealer ? a.dealerPrice : a.customerPrice),
      0
    );

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

  // ---- Modal computed values ----
  const aLaCarteAvailableAddons = selectedPackage
    ? getAvailableALaCarteForPackage(selectedPackage, addonsList)
    : [];
  const aLaCarteActiveAddons = aLaCarteAvailableAddons.filter((a) => pendingAddonIds.includes(a.id));

  const interiorAddons = useMemo(
    () => aLaCarteAvailableAddons.filter((a) => (a.category || '').toUpperCase() === 'INTERIOR'),
    [aLaCarteAvailableAddons]
  );
  const exteriorAddons = useMemo(
    () => aLaCarteAvailableAddons.filter((a) => (a.category || '').toUpperCase() !== 'INTERIOR'),
    [aLaCarteAvailableAddons]
  );
  const pendingInteriorCount = pendingAddonIds.filter((id) =>
    interiorAddons.some((a) => a.id === id)
  ).length;
  const pendingExteriorCount = pendingAddonIds.filter((id) =>
    exteriorAddons.some((a) => a.id === id)
  ).length;

  const aLaCarteBasePkgPrice = selectedPackage
    ? isDealer && selectedPackage.dealerPrice != null
      ? selectedPackage.dealerPrice
      : selectedPackage.price
    : 0;
  const aLaCarteAddonsTotal = aLaCarteActiveAddons.reduce(
    (sum, a) => sum + (isDealer ? a.dealerPrice : a.customerPrice),
    0
  );
  const aLaCarteGrandTotal = Number((aLaCarteBasePkgPrice + aLaCarteAddonsTotal).toFixed(2));

  const renderAddonCard = (addon: ALaCarteServiceOption) => {
    const isAdded = pendingAddonIds.includes(addon.id);
    const itemPrice = isDealer ? addon.dealerPrice : addon.customerPrice;
    const isInterior = (addon.category || '').toUpperCase() === 'INTERIOR';

    return (
      <TouchableOpacity
        key={addon.id}
        style={[
          styles.aLaCarteAddonCard,
          { width: modalAddonCardWidth },
          isAdded && styles.aLaCarteAddonCardSelected,
        ]}
        onPress={() => togglePendingAddon(addon.id)}
        activeOpacity={0.85}
      >
        {/* Top row: Checkbox, Category Chip, Price Tag */}
        <View style={styles.addonTopRow}>
          <View style={styles.addonCheckAndCat}>
            <View style={[styles.addonCheckbox, isAdded && styles.addonCheckboxSelected]}>
              {isAdded && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
            </View>
            <View
              style={[
                styles.addonCatChip,
                isInterior ? styles.addonCatChipInterior : styles.addonCatChipExterior,
              ]}
            >
              <Text
                style={[
                  styles.addonCatChipText,
                  isInterior ? styles.addonCatChipTextInterior : styles.addonCatChipTextExterior,
                ]}
              >
                {isInterior ? 'INTERIOR' : 'EXTERIOR'}
              </Text>
            </View>
          </View>

          <View style={[styles.addonPriceTag, isAdded && styles.addonPriceTagSelected]}>
            <Text style={[styles.addonPriceTagText, isAdded && { color: RED_BAY_COLORS.primary }]}>
              +${itemPrice.toFixed(2)}
            </Text>
            {isDealer && (
              <Text style={styles.dealerDiscountTag}>-25%</Text>
            )}
          </View>
        </View>

        {/* Body: Icon + Title + Description */}
        <View style={styles.addonContent}>
          <View
            style={[
              styles.addonIconBox,
              isInterior ? styles.addonIconBoxInterior : styles.addonIconBoxExterior,
              isAdded && styles.addonIconBoxSelected,
            ]}
          >
            <Ionicons
              name={addon.icon as any}
              size={20}
              color={isAdded ? RED_BAY_COLORS.primary : (isInterior ? '#7C3AED' : '#2563EB')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.addonName, isAdded && styles.addonNameSelected]} numberOfLines={2}>
              {addon.name}
            </Text>
            <Text style={styles.addonDesc} numberOfLines={2}>
              {addon.description}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Background Canvas */}
      <KioskBackground />

      {/* Top Header */}
      <KioskTopHeader
        onBack={handleBackNavigation}
        onExitToPos={onExitToPos}
        subtitle={
          isDealer
            ? 'Dealer Package'
            : viewStep === 'CATEGORIES'
            ? 'Category Selection'
            : 'Package Selection'
        }
      />

      {/* Page Title */}
      <View style={styles.promptHeader}>
        <Text style={styles.mainTitle}>
          {isDealer
            ? 'Choose Package & Additional Services'
            : viewStep === 'CATEGORIES'
            ? 'Select a Service Category'
            : 'Choose Your Package'}
        </Text>
        <Text style={styles.subtitle}>
          {isDealer
            ? 'Select service package and optional commercial add-ons. Order will be billed automatically to credit.'
            : viewStep === 'CATEGORIES'
            ? 'Choose between exterior wash, paint polishing, or AlCare interior sanitization.'
            : 'Tap a package to select it and pick optional upgrades.'}
        </Text>
        <View style={styles.titleUnderlineAccent} />
      </View>

      {/* ===== À LA CARTE POPUP MODAL ===== */}
      <Modal
        visible={showALaCarteModal}
        animationType="fade"
        transparent
        onRequestClose={handleALaCarteClose}
      >
        <View style={styles.aLaCarteOverlay}>
          <View style={[
            styles.aLaCarteModalContainer,
            {
              maxHeight: isTallKiosk
                ? Math.min(screenHeight * 0.88, 1250)
                : Math.min(screenHeight * 0.88, 840),
              maxWidth: isTallKiosk ? 980 : 860,
              width: isTallKiosk ? '92%' : '96%',
            },
          ]}>
            {/* Modal Header */}
            <View style={styles.aLaCarteModalHeader}>
              <View style={styles.aLaCarteBadgeIcon}>
                <Ionicons name="sparkles" size={18} color="#D97706" />
              </View>
              <View style={styles.aLaCarteHeaderTextCol}>
                <Text style={styles.aLaCarteModalTitle} numberOfLines={1}>
                  À La Carte Services & Upgrades
                </Text>
                <Text style={styles.aLaCarteModalSub} numberOfLines={2}>
                  {isDealer
                    ? `Recommended add-ons for ${selectedPackage?.name ?? ''} (25% dealer discount).`
                    : `Recommended add-ons for ${selectedPackage?.name ?? ''}. Pick any upgrades or continue directly.`}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.aLaCarteCloseBtn}
                onPress={handleALaCarteClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Addon Cards Scrollable Area */}
            <ScrollView
              style={styles.aLaCarteScrollBody}
              contentContainerStyle={styles.aLaCarteScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {aLaCarteAvailableAddons.length === 0 ? (
                <View style={styles.aLaCarteEmptyState}>
                  <Ionicons name="sparkles-outline" size={48} color="#9CA3AF" />
                  <Text style={styles.aLaCarteEmptyTitle}>No Add-ons Configured</Text>
                  <Text style={styles.aLaCarteEmptySubtitle}>
                    There are no additional à la carte services assigned to {selectedPackage?.name ?? 'this package'}.
                  </Text>
                </View>
              ) : (
                <>
                  {/* ================= 1. INTERIOR SERVICES (SHOWN FIRST) ================= */}
                  {(activeAddonTab === 'ALL' || activeAddonTab === 'INTERIOR') && interiorAddons.length > 0 && (
                    <View style={styles.categorySectionWrapper}>
                      <View style={styles.categorySectionHeader}>
                        <View style={styles.categoryHeaderLeft}>
                          <View style={[styles.categorySectionIconBadge, styles.categorySectionIconBadgeInterior]}>
                            <Ionicons name="sparkles" size={16} color="#7C3AED" />
                          </View>
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Text style={styles.categorySectionTitle}>Interior Services</Text>
                              <View style={[styles.categoryCountBadge, styles.categoryCountBadgeInterior]}>
                                <Text style={[styles.categoryCountBadgeText, { color: '#7C3AED' }]}>
                                  {interiorAddons.length} options
                                </Text>
                              </View>
                              {pendingInteriorCount > 0 && (
                                <View style={styles.categorySelectedPill}>
                                  <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" />
                                  <Text style={styles.categorySelectedPillText}>
                                    {pendingInteriorCount} selected
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.categorySectionSubtitle}>
                              Deep cabin vacuuming, sanitization, leather conditioning & freshness
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.aLaCarteAddonsGrid}>
                        {interiorAddons.map(renderAddonCard)}
                      </View>
                    </View>
                  )}

                  {activeAddonTab === 'INTERIOR' && interiorAddons.length === 0 && (
                    <View style={styles.aLaCarteEmptyCategoryState}>
                      <Ionicons name="checkmark-circle-outline" size={36} color="#10B981" />
                      <Text style={styles.aLaCarteEmptyCategoryTitle}>All Interior Services Included</Text>
                      <Text style={styles.aLaCarteEmptyCategorySub}>
                        This package already includes all interior services.
                      </Text>
                    </View>
                  )}

                  {/* ================= 2. EXTERIOR SERVICES (SHOWN NEXT) ================= */}
                  {(activeAddonTab === 'ALL' || activeAddonTab === 'EXTERIOR') && exteriorAddons.length > 0 && (
                    <View style={[styles.categorySectionWrapper, { marginTop: activeAddonTab === 'ALL' ? 18 : 0 }]}>
                      <View style={styles.categorySectionHeader}>
                        <View style={styles.categoryHeaderLeft}>
                          <View style={[styles.categorySectionIconBadge, styles.categorySectionIconBadgeExterior]}>
                            <Ionicons name="car-sport" size={16} color="#2563EB" />
                          </View>
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Text style={styles.categorySectionTitle}>Exterior Services</Text>
                              <View style={[styles.categoryCountBadge, styles.categoryCountBadgeExterior]}>
                                <Text style={[styles.categoryCountBadgeText, { color: '#2563EB' }]}>
                                  {exteriorAddons.length} options
                                </Text>
                              </View>
                              {pendingExteriorCount > 0 && (
                                <View style={styles.categorySelectedPill}>
                                  <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" />
                                  <Text style={styles.categorySelectedPillText}>
                                    {pendingExteriorCount} selected
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.categorySectionSubtitle}>
                              Snow foam wash, wheel detailing, wax & paint protection
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.aLaCarteAddonsGrid}>
                        {exteriorAddons.map(renderAddonCard)}
                      </View>
                    </View>
                  )}

                  {activeAddonTab === 'EXTERIOR' && exteriorAddons.length === 0 && (
                    <View style={styles.aLaCarteEmptyCategoryState}>
                      <Ionicons name="checkmark-circle-outline" size={36} color="#10B981" />
                      <Text style={styles.aLaCarteEmptyCategoryTitle}>All Exterior Services Included</Text>
                      <Text style={styles.aLaCarteEmptyCategorySub}>
                        This package already includes all exterior services.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Modal Footer — responsive: 2-row on mobile/portrait, row on wide tablet/desktop */}
            <View style={[
              styles.aLaCarteModalFooter,
              !footerIsStacked && styles.aLaCarteModalFooterWide,
            ]}>
              {footerIsStacked ? (
                <>
                  {/* Row 1: Price breakdown banner */}
                  <View style={styles.footerPriceBanner}>
                    <View style={styles.footerPriceDetails}>
                      <Text style={styles.footerBaseText}>
                        Base Package: <Text style={styles.footerBaseAmount}>${aLaCarteBasePkgPrice.toFixed(2)}</Text>
                      </Text>
                      {aLaCarteAddonsTotal > 0 && (
                        <View style={{ marginTop: 2 }}>
                          <Text style={styles.footerUpgradesText}>
                            + Upgrades ({aLaCarteActiveAddons.length}):{' '}
                            <Text style={styles.footerUpgradesAmount}>+${aLaCarteAddonsTotal.toFixed(2)}</Text>
                          </Text>
                          <Text style={styles.footerBreakdownSub}>
                            {pendingInteriorCount > 0 ? `${pendingInteriorCount} Interior` : ''}
                            {pendingInteriorCount > 0 && pendingExteriorCount > 0 ? ' • ' : ''}
                            {pendingExteriorCount > 0 ? `${pendingExteriorCount} Exterior` : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.footerTotalPill}>
                      <Text style={styles.footerTotalPillLabel}>TOTAL</Text>
                      <Text style={styles.footerTotalPillVal}>${aLaCarteGrandTotal.toFixed(2)}</Text>
                    </View>
                  </View>

                  {/* Row 2: Action buttons side by side */}
                  <View style={styles.footerStackedBtnRow}>
                    <TouchableOpacity style={styles.footerStackedCancelBtn} onPress={handleALaCarteClose}>
                      <Text style={styles.aLaCarteSkipBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.footerStackedConfirmBtn} onPress={handleALaCarteConfirm}>
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.aLaCarteConfirmBtnText}>Confirm & Continue</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {/* Wide layout: Left price breakdown, Right action buttons */}
                  <View style={styles.aLaCartePriceCol}>
                    <View style={styles.aLaCartePriceRow}>
                      <Text style={styles.aLaCartePriceLabel}>Base Package:</Text>
                      <Text style={styles.aLaCartePriceVal}>${aLaCarteBasePkgPrice.toFixed(2)}</Text>
                    </View>
                    {aLaCarteAddonsTotal > 0 && (
                      <View style={styles.aLaCartePriceRow}>
                        <View>
                          <Text style={styles.aLaCartePriceLabel}>
                            Upgrades ({aLaCarteActiveAddons.length}):
                          </Text>
                          <Text style={styles.footerBreakdownSub}>
                            {pendingInteriorCount > 0 ? `${pendingInteriorCount} Interior` : ''}
                            {pendingInteriorCount > 0 && pendingExteriorCount > 0 ? ' • ' : ''}
                            {pendingExteriorCount > 0 ? `${pendingExteriorCount} Exterior` : ''}
                          </Text>
                        </View>
                        <Text style={[styles.aLaCartePriceVal, { color: RED_BAY_COLORS.primary }]}>
                          +${aLaCarteAddonsTotal.toFixed(2)}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.aLaCartePriceRow, styles.aLaCarteTotalRow]}>
                      <Text style={styles.aLaCarteTotalLabel}>TOTAL:</Text>
                      <Text style={styles.aLaCarteTotalVal}>${aLaCarteGrandTotal.toFixed(2)}</Text>
                    </View>
                  </View>

                  <View style={styles.aLaCarteFooterBtns}>
                    <TouchableOpacity style={styles.aLaCarteSkipBtn} onPress={handleALaCarteClose}>
                      <Text style={styles.aLaCarteSkipBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.aLaCarteConfirmBtn} onPress={handleALaCarteConfirm}>
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.aLaCarteConfirmBtnText}>Confirm & Continue</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Main Content Area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontalPadding },
          isTallKiosk && styles.scrollContentTall,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
                        { borderColor: meta.cardBorderColor },
                      ]}
                      onPress={() => handleSelectCategory(cat)}
                      activeOpacity={0.9}
                    >
                      <View style={[
                        styles.cardImageBox,
                        { height: dynamicCategoryImgHeight },
                        isTallKiosk && styles.cardImageBoxTall,
                        isLandscapeShort && styles.cardImageBoxShort,
                      ]}>
                        <Image
                          source={cat.imageUrl ? { uri: resolveApiUrl(cat.imageUrl) } : meta.image}
                          style={styles.cardImage}
                          resizeMode="cover"
                        />
                      </View>

                      <View style={styles.cardBody}>
                        <View style={styles.cardTopInfoRow}>
                          <View style={[
                            styles.cardEmblemBox,
                            { backgroundColor: '#FFFFFF', borderColor: meta.cardBorderColor },
                          ]}>
                            {cat.iconUrl ? (
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
                    },
                  ]}>
                    {selectedCategory?.iconUrl ? (
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
                    const isSelected =
                      selectedPackage?.packageId === pkg.packageId ||
                      selectedPackage?.id === pkg.id;
                    const features = getPackageFeatures(pkg);
                    const pkgDisplayPrice =
                      isDealer && pkg.dealerPrice != null ? pkg.dealerPrice : pkg.price;
                    const hasDealerDiscount =
                      isDealer && pkg.dealerPrice != null && pkg.dealerPrice < pkg.price;

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

                        {/* Package Name & Price */}
                        <View style={styles.pkgHeaderBlock}>
                          <Text
                            style={[styles.packageName, isSelected && styles.packageNameSelected]}
                            numberOfLines={2}
                          >
                            {pkg.name}
                          </Text>
                          <View style={styles.priceRow}>
                            <Text style={[styles.priceAmount, isSelected && styles.priceAmountSelected]}>
                              ${pkgDisplayPrice.toFixed(2)}
                            </Text>
                            {hasDealerDiscount && (
                              <View style={styles.dealerDiscountBadge}>
                                <Text style={styles.dealerDiscountBadgeText}>DEALER (20% OFF)</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        <View style={styles.pkgDivider} />

                        {/* Features list */}
                        <View style={styles.pkgFeatureList}>
                          {features.slice(0, 4).map((feat, fIdx) => (
                            <View key={fIdx} style={styles.pkgFeatureItem}>
                              <Ionicons
                                name="checkmark-circle"
                                size={14}
                                color={isSelected ? RED_BAY_COLORS.primary : '#10B981'}
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

                        {/* CTA Button */}
                        <View style={[styles.pkgActionBtn, isSelected && styles.pkgActionBtnSelected]}>
                          <Text style={[styles.pkgActionBtnText, isSelected && styles.pkgActionBtnTextSelected]}>
                            Select
                          </Text>
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

  /* ---- Categories Grid ---- */
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

  /* ---- Category Switcher ---- */
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

  /* ---- Packages Grid ---- */
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
  dealerDiscountBadge: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  dealerDiscountBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.2,
  },

  /* ---- Addon card shared styles ---- */
  addonTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addonCheckAndCat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  addonCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
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
  addonCatChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  addonCatChipInterior: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  addonCatChipExterior: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  addonCatChipText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  addonCatChipTextInterior: {
    color: '#7C3AED',
  },
  addonCatChipTextExterior: {
    color: '#2563EB',
  },
  addonPriceTag: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addonPriceTagSelected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  addonPriceTagText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  dealerDiscountTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
    marginLeft: 4,
  },
  addonContent: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  addonIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  addonIconBoxInterior: {
    backgroundColor: '#F5F3FF',
  },
  addonIconBoxExterior: {
    backgroundColor: '#EFF6FF',
  },
  addonIconBoxSelected: {
    backgroundColor: '#FEE2E2',
  },
  addonName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#1E293B',
    lineHeight: 18,
  },
  addonNameSelected: {
    color: RED_BAY_COLORS.primary,
    fontWeight: '900',
  },
  addonDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 15,
  },

  /* ===== À LA CARTE MODAL STYLES ===== */
  aLaCarteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 8, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  aLaCarteModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 960,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...makeShadow('#000000', { width: 0, height: 12 }, 0.25, 28, 12),
  },
  aLaCarteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  aLaCarteBadgeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  aLaCarteHeaderTextCol: {
    flex: 1,
    marginHorizontal: 14,
    justifyContent: 'center',
  },
  aLaCarteModalTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  aLaCarteModalSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 17,
    fontWeight: '500',
  },
  aLaCarteCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  /* Category Filter Tabs Bar */
  modalFilterBar: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalTabsList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  modalTabPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  modalTabPillText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#475569',
  },
  modalTabPillTextActive: {
    color: '#FFFFFF',
  },
  modalTabPillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  modalTabPillBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  modalTabPillBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  modalTabPillBadgeTextActive: {
    color: '#FFFFFF',
  },
  modalTabSelectionIndicator: {
    backgroundColor: RED_BAY_COLORS.primary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 1,
  },
  modalTabSelectionIndicatorText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },

  aLaCarteScrollBody: {
    flexGrow: 0,
    flexShrink: 1,
    width: '100%',
  },
  aLaCarteScrollContent: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  aLaCarteClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  aLaCarteClearText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },

  /* Section Headers inside Modal */
  categorySectionWrapper: {
    marginBottom: 6,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categorySectionIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  categorySectionIconBadgeInterior: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  categorySectionIconBadgeExterior: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  categorySectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  categorySectionSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  categoryCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryCountBadgeInterior: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  categoryCountBadgeExterior: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  categoryCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  categorySelectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  categorySelectedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  aLaCarteAddonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10,
  },
  aLaCarteAddonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    justifyContent: 'space-between',
    minHeight: 128,
    marginBottom: 8,
    ...makeShadow('#000000', { width: 0, height: 2 }, 0.04, 6, 1),
  },
  aLaCarteAddonCardSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFF7F7',
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 3 }, 0.12, 8, 2),
  },
  aLaCarteEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  aLaCarteEmptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  aLaCarteEmptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  aLaCarteEmptyCategoryState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  aLaCarteEmptyCategoryTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  aLaCarteEmptyCategorySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },

  /* Footer styles */
  aLaCarteModalFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    width: '100%',
    flexShrink: 0,
  },
  aLaCarteModalFooterWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 14,
  },

  /* Stacked (Narrow/Mobile/Portrait Kiosk) Footer */
  footerPriceBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  footerPriceDetails: {
    justifyContent: 'center',
    gap: 2,
  },
  footerBaseText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  footerBaseAmount: {
    color: '#0F172A',
    fontWeight: '800',
  },
  footerUpgradesText: {
    fontSize: 12,
    color: RED_BAY_COLORS.primary,
    fontWeight: '700',
  },
  footerUpgradesAmount: {
    fontWeight: '800',
  },
  footerBreakdownSub: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  footerTotalPill: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  footerTotalPillLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  footerTotalPillVal: {
    fontSize: 24,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
    letterSpacing: 0.3,
  },
  footerStackedBtnRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    width: '100%',
  },
  footerStackedCancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerStackedConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: RED_BAY_COLORS.primary,
    paddingVertical: 15,
    borderRadius: 14,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 4 }, 0.3, 8, 3),
  },

  /* Wide (Tablet/Desktop) Footer */
  aLaCartePriceCol: {
    gap: 3,
    flex: 1,
  },
  aLaCartePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  aLaCarteTotalRow: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  aLaCartePriceLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  aLaCartePriceVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  aLaCarteTotalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  aLaCarteTotalVal: {
    fontSize: 24,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
  },
  aLaCarteFooterBtns: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  aLaCarteSkipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  aLaCarteSkipBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  aLaCarteConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: RED_BAY_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 4 }, 0.3, 8, 3),
  },
  aLaCarteConfirmBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
