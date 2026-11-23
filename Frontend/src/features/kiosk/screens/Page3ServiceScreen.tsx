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
import { fetchAllAddons } from '../../../services/masterApi';

export interface ALaCarteServiceOption {
  id: string;
  name: string;
  customerPrice: number;
  dealerPrice: number;
  category: 'EXTERIOR' | 'INTERIOR';
  icon: string;
  description: string;
}

export const ALL_A_LA_CARTE_SERVICES: ALaCarteServiceOption[] = [
  // Exterior Services
  {
    id: 'snow_foam_wash',
    name: 'Snow Foam Hand Wash',
    customerPrice: 12.0,
    dealerPrice: 9.0,
    category: 'EXTERIOR',
    icon: 'water-outline',
    description: 'High-density pH-neutral snow foam hand wash with clean chamois hand dry',
  },
  {
    id: 'water_wax_finish',
    name: 'Water Wax Finish',
    customerPrice: 10.0,
    dealerPrice: 7.5,
    category: 'EXTERIOR',
    icon: 'sparkles-outline',
    description: 'Spray wax treatment that enhances gloss and beads water off exterior paint',
  },
  {
    id: 'tyre_dressing_shine',
    name: 'Tyre Dressing & Shine',
    customerPrice: 3.0,
    dealerPrice: 2.2,
    category: 'EXTERIOR',
    icon: 'disc-outline',
    description: 'Silicone-based dressing applied to tyres for a rich wet-black shine',
  },
  {
    id: 'rim_detailing',
    name: 'Rim Detailing',
    customerPrice: 6.0,
    dealerPrice: 4.5,
    category: 'EXTERIOR',
    icon: 'radio-button-on-outline',
    description: 'Wheel face cleaner removing stubborn brake dust from rims',
  },
  {
    id: 'headlight_restoration',
    name: 'Headlight Restoration',
    customerPrice: 50.0,
    dealerPrice: 37.5,
    category: 'EXTERIOR',
    icon: 'sunny-outline',
    description: 'Machine-polishing hazy, yellowed headlight lenses back to crystal clear',
  },
  {
    id: 'windscreen_polishing_coating',
    name: 'Windscreen Polishing & Coating',
    customerPrice: 40.0,
    dealerPrice: 30.0,
    category: 'EXTERIOR',
    icon: 'rainy-outline',
    description: 'Glass scrubbed of oil film and coated with a rain-repellent hydrophobic barrier',
  },
  {
    id: 'engine_bay_cleaning',
    name: 'Engine Bay Cleaning & Dressing',
    customerPrice: 20.0,
    dealerPrice: 15.0,
    category: 'EXTERIOR',
    icon: 'hardware-chip-outline',
    description: 'Safe engine compartment degrease, wipe-down and plastic dressing',
  },
  {
    id: 'clay_bar_treatment',
    name: 'Clay Bar Treatment',
    customerPrice: 50.0,
    dealerPrice: 37.5,
    category: 'EXTERIOR',
    icon: 'hand-left-outline',
    description: 'Automotive clay bar removes bonded surface contaminants (tar, fallout, overspray)',
  },
  {
    id: 'quick_3in1_polish',
    name: '3-in-1 Polishing',
    customerPrice: 80.0,
    dealerPrice: 60.0,
    category: 'EXTERIOR',
    icon: 'color-wand-outline',
    description: 'Single-stage machine polish that cleans paint, reduces light swirls and adds sealant',
  },
  {
    id: 'detailed_3layer_polish',
    name: '3-Layer Polishing & Sealant',
    customerPrice: 150.0,
    dealerPrice: 112.5,
    category: 'EXTERIOR',
    icon: 'layers-outline',
    description: 'Multi-stage paint correction: compound cut, swirl-free polish, and synthetic sealant',
  },
  {
    id: 'ceramic_coating',
    name: 'Ceramic Coating',
    customerPrice: 60.0,
    dealerPrice: 45.0,
    category: 'EXTERIOR',
    icon: 'shield-checkmark-outline',
    description: 'Liquid polymer coating that bonds with paint for durable hydrophobic shine',
  },

  // Interior Services
  {
    id: 'interior_vacuuming',
    name: 'Interior Vacuuming',
    customerPrice: 8.0,
    dealerPrice: 6.0,
    category: 'INTERIOR',
    icon: 'funnel-outline',
    description: 'Standard vacuuming of cabin carpets, seats and footwells',
  },
  {
    id: 'deep_interior_vacuuming',
    name: 'Deep Interior Vacuuming',
    customerPrice: 15.0,
    dealerPrice: 11.2,
    category: 'INTERIOR',
    icon: 'scan-outline',
    description: 'Intensive vacuuming under seats, boot/trunk and deep crevices',
  },
  {
    id: 'dashboard_cleaning',
    name: 'Dashboard Cleaning & Shine',
    customerPrice: 5.0,
    dealerPrice: 3.8,
    category: 'INTERIOR',
    icon: 'speedometer-outline',
    description: 'Wipe-down of dashboard and centre console with UV protectant',
  },
  {
    id: 'interior_wipe_down',
    name: 'Interior Wipe-Down',
    customerPrice: 10.0,
    dealerPrice: 7.5,
    category: 'INTERIOR',
    icon: 'brush-outline',
    description: 'All hard interior surfaces wiped clean of fingerprints, dust and marks',
  },
  {
    id: 'interior_dressing_shine',
    name: 'Interior Dressing & Shine',
    customerPrice: 10.0,
    dealerPrice: 7.5,
    category: 'INTERIOR',
    icon: 'color-fill-outline',
    description: 'Plastic and vinyl surfaces dressed for a uniform, non-greasy satin finish',
  },
  {
    id: 'dettol_interior_wipe',
    name: 'Dettol Interior Wipe-Down',
    customerPrice: 12.0,
    dealerPrice: 9.0,
    category: 'INTERIOR',
    icon: 'medkit-outline',
    description: 'Disinfectant wipe-down using Dettol-based solution on high-touch cabin surfaces',
  },
  {
    id: 'interior_fumigation',
    name: 'Interior Fumigation',
    customerPrice: 30.0,
    dealerPrice: 22.5,
    category: 'INTERIOR',
    icon: 'cloud-outline',
    description: 'Sanitising antibacterial fog neutralising odours and bacteria in cabin vents',
  },
  {
    id: 'leather_conditioning',
    name: 'Leather Cleaning & Conditioning',
    customerPrice: 20.0,
    dealerPrice: 15.0,
    category: 'INTERIOR',
    icon: 'ribbon-outline',
    description: 'Leather seats cleaned and conditioned to prevent cracking and restore softness',
  },
  {
    id: 'upholstery_steam_cleaning',
    name: 'Upholstery Steam Cleaning',
    customerPrice: 60.0,
    dealerPrice: 45.0,
    category: 'INTERIOR',
    icon: 'flame-outline',
    description: 'Hot steam extraction deep-cleaning fabric/leather seats, lifting embedded dirt',
  },
  {
    id: 'vomit_odour_removal',
    name: 'Vomit & Odour Removal',
    customerPrice: 80.0,
    dealerPrice: 60.0,
    category: 'INTERIOR',
    icon: 'trash-bin-outline',
    description: 'Specialised decontamination removing bio-waste residue and persistent foul odours',
  },
];

/**
 * Filter à la carte services depending on the selected package according to the official Red Bay menu matrix:
 * Avoid recommending items already included in the package. Suggest high-value upgrades.
 */
export function getAvailableALaCarteForPackage(pkg?: ServicePackage, customList?: ALaCarteServiceOption[]): ALaCarteServiceOption[] {
  const source = customList && customList.length > 0 ? customList : ALL_A_LA_CARTE_SERVICES;
  if (!pkg) return source;
  const code = (pkg.packageCode || pkg.name || '').toUpperCase();

  // Helper to normalize and check if item matches an excluded ID or code
  const isExcluded = (item: ALaCarteServiceOption, excluded: string[]) => {
    const itemNorm = item.id.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return excluded.some((ex) => itemNorm.includes(ex) || ex.includes(itemNorm));
  };

  // 1. CARLING PACKAGE
  // Included: Snow Foam Wash, Tyre Dressing, Rim Detailing, Interior Vac, Dashboard Clean
  if (code.includes('CARLING')) {
    const includedIds = ['snow_foam_wash', 'tyre_dressing', 'rim_detailing', 'interior_vacuuming', 'dashboard_cleaning'];
    return source.filter((item) => !isExcluded(item, includedIds));
  }

  // 2. PREMIER PACKAGE
  // Included: Snow Foam Wash, Tyre Dressing, Rim Detailing, Water Wax, Interior Vac, Dashboard Clean, Dettol Wipe
  if (code.includes('PREMIER')) {
    const includedIds = [
      'snow_foam_wash',
      'tyre_dressing',
      'rim_detailing',
      'water_wax',
      'interior_vacuuming',
      'dashboard_cleaning',
      'dettol',
    ];
    return source.filter((item) => !isExcluded(item, includedIds));
  }

  // 3. CHAMPION PACKAGE
  // Included: Snow Foam, Tyre Dressing, Rim Detailing, Water Wax, Deep Vac, Dashboard, Dettol, Leather, Fumigation, Engine Bay
  if (code.includes('CHAMPION')) {
    const includedIds = [
      'snow_foam_wash',
      'tyre_dressing',
      'rim_detailing',
      'water_wax',
      'interior_vacuuming',
      'deep_interior_vacuuming',
      'dashboard_cleaning',
      'dettol',
      'leather',
      'fumigation',
      'engine_bay',
    ];
    return source.filter((item) => !isExcluded(item, includedIds));
  }

  // 4. CLUB PACKAGE (POLISHING)
  // Included: Premier Wash, 3-in-1 Polish, Clay Bar, Interior Care
  if (code.includes('CLUB')) {
    const includedIds = [
      'snow_foam_wash',
      'tyre_dressing',
      'rim_detailing',
      'water_wax',
      'interior_vacuuming',
      'dashboard_cleaning',
      'dettol',
      '3_in_1_polish',
      'clay_bar',
      'interior_wipe',
      'interior_dressing',
    ];
    return source.filter((item) => !isExcluded(item, includedIds));
  }

  // 5. EURO PACKAGE (POLISHING)
  // Included: Champion Package, 3-Layer Polishing & Sealant, Clay Bar, Glass Polishing, Glass Shield
  if (code.includes('EURO')) {
    const includedIds = [
      'snow_foam_wash',
      'tyre_dressing',
      'rim_detailing',
      'water_wax',
      'interior_vacuuming',
      'deep_interior_vacuuming',
      'dashboard_cleaning',
      'dettol',
      'leather',
      'fumigation',
      'engine_bay',
      'clay_bar',
      '3_in_1_polish',
      '3_layer_polish',
      'windscreen',
    ];
    return source.filter((item) => !isExcluded(item, includedIds));
  }

  // 6. WORLD CUP PACKAGE (POLISHING)
  // Included: Champion Package, 3-Layer Polishing & Sealant, Clay Bar, Steam Extraction, Glass Polishing, Glass Shield
  if (code.includes('WORLD')) {
    const includedIds = [
      'snow_foam_wash',
      'tyre_dressing',
      'rim_detailing',
      'water_wax',
      'interior_vacuuming',
      'deep_interior_vacuuming',
      'dashboard_cleaning',
      'dettol',
      'leather',
      'fumigation',
      'engine_bay',
      'clay_bar',
      '3_in_1_polish',
      '3_layer_polish',
      'windscreen',
      'steam_cleaning',
    ];
    return source.filter((item) => !isExcluded(item, includedIds));
  }

  return source;
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
  const [addonsList, setAddonsList] = useState<ALaCarteServiceOption[]>(ALL_A_LA_CARTE_SERVICES);

  // Fetch dynamic add-ons from database
  useEffect(() => {
    let active = true;
    fetchAllAddons(true)
      .then((records) => {
        if (!active || !records || records.length === 0) return;
        const mapped: ALaCarteServiceOption[] = records.map((r) => ({
          id: r.addonCode.toLowerCase(),
          name: r.addonName,
          customerPrice: r.customerPrice,
          dealerPrice: r.dealerPrice,
          category: r.category,
          icon: r.icon || 'sparkles-outline',
          description: r.description || '',
        }));
        setAddonsList(mapped);
      })
      .catch((err) => {
        console.warn('[Page3ServiceScreen] Could not load dynamic add-ons from DB:', err);
      });
    return () => {
      active = false;
    };
  }, []);

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
    setSelectedAddonIds([]);
    setViewStep('PACKAGES');
    loadPackagesForCategory(cat.serviceCategoryId);
  };

  const handleSelectPackage = (pkg: ServicePackage) => {
    setSelectedPackage(pkg);
    // When package changes, auto-clean any previously selected add-on that is already included in this package
    const available = getAvailableALaCarteForPackage(pkg, addonsList);
    const availableIdSet = new Set(available.map((a) => a.id));
    setSelectedAddonIds((prev) => prev.filter((id) => availableIdSet.has(id)));
  };

  const handleProceedWithOrder = () => {
    if (!selectedPackage || !selectedCategory) return;
    const available = getAvailableALaCarteForPackage(selectedPackage, addonsList);
    const activeAddons = available.filter((a) => selectedAddonIds.includes(a.id));
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

  const handleDealerPlaceCreditOrder = handleProceedWithOrder;

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
                    const pkgDisplayPrice = isDealer && pkg.dealerPrice != null ? pkg.dealerPrice : pkg.price;
                    const hasDealerDiscount = isDealer && pkg.dealerPrice != null && pkg.dealerPrice < pkg.price;

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
                              ${pkgDisplayPrice.toFixed(2)}
                            </Text>
                            {hasDealerDiscount && (
                              <View style={styles.dealerDiscountBadge}>
                                <Text style={styles.dealerDiscountBadgeText}>DEALER (20% OFF)</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Divider */}
                        <View style={styles.pkgDivider} />

                        {/* Features Points Checklist */}
                        <View style={styles.pkgFeatureList}>
                          {features.slice(0, 4).map((feat, fIdx) => (
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
                            {isSelected ? 'Selected ✓' : 'Select Package'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* ================= A LA CARTE SERVICES TAILORED TO SELECTED PACKAGE ================= */}
              {selectedPackage && (
                <View style={styles.dealerSectionWrapper}>
                  {/* Section Header */}
                  <View style={styles.dealerSectionHeader}>
                    <View style={styles.dealerSectionBadge}>
                      <Ionicons name="sparkles" size={17} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dealerSectionTitle}>
                        À La Carte Services & Upgrades
                      </Text>
                      <Text style={styles.dealerSectionSub}>
                        {isDealer
                          ? `Recommended commercial add-ons for ${selectedPackage.name} (25% dealer discount).`
                          : `Recommended add-ons for ${selectedPackage.name}. Pick any upgrades or continue directly.`}
                      </Text>
                    </View>
                    {selectedAddonIds.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setSelectedAddonIds([])}
                        style={styles.clearAddonsBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.clearAddonsText}>Clear ({selectedAddonIds.length})</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Addons Grid */}
                  {(() => {
                    const availableAddons = getAvailableALaCarteForPackage(selectedPackage, addonsList);
                    const activeAddons = availableAddons.filter((a) => selectedAddonIds.includes(a.id));
                    const basePkgPrice = isDealer && selectedPackage.dealerPrice != null
                      ? selectedPackage.dealerPrice
                      : selectedPackage.price;
                    const addonsTotal = activeAddons.reduce(
                      (sum, a) => sum + (isDealer ? a.dealerPrice : a.customerPrice),
                      0
                    );
                    const grandTotal = Number((basePkgPrice + addonsTotal).toFixed(2));

                    return (
                      <>
                        <View style={styles.addonsGrid}>
                          {availableAddons.map((addon) => {
                            const isAdded = selectedAddonIds.includes(addon.id);
                            const itemPrice = isDealer ? addon.dealerPrice : addon.customerPrice;

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
                                  <View style={[styles.addonPriceTag, isAdded && { backgroundColor: '#FEE2E2' }]}>
                                    <Text style={[styles.addonPriceTagText, isAdded && { color: RED_BAY_COLORS.primary }]}>
                                      +${itemPrice.toFixed(2)}
                                    </Text>
                                    {isDealer && (
                                      <Text style={styles.dealerDiscountTag}>-25%</Text>
                                    )}
                                  </View>
                                </View>
                                <View style={styles.addonContent}>
                                  <View style={[styles.addonIconBox, isAdded && { backgroundColor: '#FEE2E2' }]}>
                                    <Ionicons 
                                      name={addon.icon as any} 
                                      size={20} 
                                      color={isAdded ? RED_BAY_COLORS.primary : "#475569"} 
                                    />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.addonName, isAdded && styles.addonNameSelected]}>
                                      {addon.name}
                                    </Text>
                                    <Text style={styles.addonDesc} numberOfLines={2}>
                                      {addon.description}
                                    </Text>
                                  </View>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Order Checkout Card */}
                        {isDealer ? (
                          <View style={styles.dealerCreditCard}>
                            {/* Notice Banner */}
                            <View style={styles.dealerCreditNoticeBanner}>
                              <Ionicons name="card" size={20} color="#D97706" />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.dealerCreditNoticeTitle}>AUTOMATIC DEALER CREDIT BILLING</Text>
                                <Text style={styles.dealerCreditNoticeSubtitle}>
                                  Charged automatically to your commercial credit account. No upfront payment required.
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
                                <Text style={styles.creditRowVal}>{selectedPackage.name} (${basePkgPrice.toFixed(2)})</Text>
                              </View>
                              {activeAddons.length > 0 && (
                                <View style={styles.creditRow}>
                                  <Text style={styles.creditRowLabel}>À La Carte Add-ons ({activeAddons.length})</Text>
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
                              onPress={handleProceedWithOrder}
                              activeOpacity={0.88}
                            >
                              <Text style={styles.dealerCreditSubmitBtnText}>
                                Continue to Details (${grandTotal.toFixed(2)})
                              </Text>
                              <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.customerSummaryCard}>
                            {/* Breakdown Rows */}
                            <View style={styles.creditBreakdown}>
                              <View style={styles.creditRow}>
                                <Text style={styles.creditRowLabel}>Base Package</Text>
                                <Text style={styles.creditRowValBold}>{selectedPackage.name} (${basePkgPrice.toFixed(2)})</Text>
                              </View>
                              {activeAddons.length > 0 ? (
                                <View style={styles.creditRow}>
                                  <Text style={styles.creditRowLabel}>Selected À La Carte ({activeAddons.length})</Text>
                                  <Text style={[styles.creditRowVal, { color: RED_BAY_COLORS.primary }]}>+${addonsTotal.toFixed(2)}</Text>
                                </View>
                              ) : (
                                <View style={styles.creditRow}>
                                  <Text style={styles.creditRowLabel}>À La Carte Add-ons</Text>
                                  <Text style={styles.creditRowVal}>None selected (Base package only)</Text>
                                </View>
                              )}
                              <View style={styles.creditDivider} />
                              <View style={styles.creditTotalRow}>
                                <Text style={styles.creditTotalLabel}>Grand Total</Text>
                                <Text style={styles.creditTotalVal}>${grandTotal.toFixed(2)}</Text>
                              </View>
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                              style={styles.customerProceedBtn}
                              onPress={handleProceedWithOrder}
                              activeOpacity={0.88}
                            >
                              <Text style={styles.customerProceedBtnText}>
                                Continue to Customer Details (${grandTotal.toFixed(2)})
                              </Text>
                              <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </>
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
  clearAddonsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clearAddonsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  dealerDiscountTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
    marginLeft: 4,
  },
  customerSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 18,
    ...makeShadow('#000000', { width: 0, height: 4 }, 0.06, 10, 2),
  },
  customerProceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RED_BAY_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 4 }, 0.28, 8, 3),
  },
  customerProceedBtnText: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
