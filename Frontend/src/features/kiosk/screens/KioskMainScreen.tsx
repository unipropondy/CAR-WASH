import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { Page1UserTypeScreen } from './Page1UserTypeScreen';
import { DealerChooseScreen } from './DealerChooseScreen';
import { DealerPasswordScreen } from './DealerPasswordScreen';
import { Page2VehicleScreen } from './Page2VehicleScreen';
import { Page3ServiceScreen } from './Page3ServiceScreen';
import { Page4DetailsScreen } from './Page4DetailsScreen';
import { Page5PaymentScreen } from './Page5PaymentScreen';
import { DealerCreditConfirmScreen } from './DealerCreditConfirmScreen';
import { Page6SuccessScreen } from './Page6SuccessScreen';
import { KioskPromotionSlideshow } from '../components/KioskPromotionSlideshow';
import { InactivityPromptModal } from '../components/InactivityPromptModal';
import { 
  KioskPage, 
  KioskUserType, 
  DealerOption, 
  VehicleOption, 
  ServiceCategory, 
  ServicePackage, 
  CustomerDetails, 
  PaymentMode, 
  KioskOrder 
} from '../types/kiosk.types';
import { createCarWashOrder, updateOrderPayment, CreatedOrderResponse } from '../../../services/carwashOrderApi';
import { broadcastNewKioskOrder } from '../../../services/kioskOrderNotificationService';
import { fetchCompanySettings, getCachedGstRate } from '../../../services/companySettingsApi';
import { 
  saveKioskSession, 
  loadKioskSession, 
  clearKioskSession 
} from '../store/kioskSessionStorage';
import { StaffPosLoginModal } from '../components/StaffPosLoginModal';
import { AuthenticatedUser } from '../../../types/auth.types';
import { getRouteForUserGroup } from '../../auth/utils/userGroupRouting';
import { fetchVehicleTypes } from '../../../services/vehicleApi';
import { fetchServiceCategories } from '../../../services/categoryApi';
import { fetchPackagesByCategory } from '../../../services/packageApi';
import { fetchAllDealers } from '../../../services/dealerApi';

interface KioskMainScreenProps {
  onExitToPos?: () => void;
  initialPage?: KioskPage;
  initialUserType?: KioskUserType;
  currentRoute?: string;
  onNavigateScreen?: (route: string) => void;
}

export const KioskMainScreen: React.FC<KioskMainScreenProps> = ({ 
  onExitToPos,
  initialPage = 'PAGE_1_USER_TYPE',
  initialUserType = 'CUSTOMER',
  currentRoute,
  onNavigateScreen,
}) => {
  const savedSession = useMemo(() => loadKioskSession(), []);

  const [currentPage, setCurrentPage] = useState<KioskPage>(initialPage);
  const [userType, setUserType] = useState<KioskUserType>(savedSession?.userType || initialUserType);

  // Dealer Specific State
  const [selectedDealer, setSelectedDealer] = useState<DealerOption | undefined>(savedSession?.selectedDealer);
  const [isDealerAuthenticated, setIsDealerAuthenticated] = useState<boolean>(savedSession?.isDealerAuthenticated || false);

  // Common Vehicle, Service & Customer Selections State
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | undefined>(savedSession?.selectedVehicle);
  const [selectedVehicleTypeId, setSelectedVehicleTypeId] = useState<number | undefined>(savedSession?.selectedVehicleTypeId);
  const [selectedVehicleTypeCode, setSelectedVehicleTypeCode] = useState<string | undefined>(savedSession?.selectedVehicleTypeCode);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | undefined>(savedSession?.selectedCategory);
  const [selectedServiceCategoryId, setSelectedServiceCategoryId] = useState<number | undefined>(savedSession?.selectedServiceCategoryId);
  const [selectedServiceCategoryCode, setSelectedServiceCategoryCode] = useState<string | undefined>(savedSession?.selectedServiceCategoryCode);
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | undefined>(savedSession?.selectedPackage);
  const [selectedPackageId, setSelectedPackageId] = useState<number | undefined>(savedSession?.selectedPackageId);
  const [selectedPackageCode, setSelectedPackageCode] = useState<string | undefined>(savedSession?.selectedPackageCode);
  const [selectedAdditionalServices, setSelectedAdditionalServices] = useState<string | undefined>(undefined);
  const [selectedAdditionalAmount, setSelectedAdditionalAmount] = useState<number>(0);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | undefined>(savedSession?.customerDetails);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | undefined>(savedSession?.paymentMode);

  // SQL Server Order ID & Order Number
  const [activeOrderId, setActiveOrderId] = useState<number | undefined>(savedSession?.activeOrderId);
  const [activeOrderNo, setActiveOrderNo] = useState<string | undefined>(savedSession?.activeOrderNo);
  
  // Completed Order State & Bill Number Counter (e.g. RB000001)
  const [billCounter, setBillCounter] = useState<number>(savedSession?.billCounter || 1);
  const [completedOrder, setCompletedOrder] = useState<KioskOrder | null>(savedSession?.completedOrder || null);
  const [createdOrderData, setCreatedOrderData] = useState<CreatedOrderResponse | null>(null);

  // Staff POS Authentication Modal State
  const [isStaffLoginModalOpen, setIsStaffLoginModalOpen] = useState<boolean>(false);

  // Idle Promotional Slideshow State
  // Default to showing promotional idle slideshow if no ongoing order in progress
  const [isIdleActive, setIsIdleActive] = useState<boolean>(() => {
    return !savedSession?.selectedVehicle && !savedSession?.selectedDealer && !savedSession?.customerDetails;
  });

  // Inactivity Confirmation Modal State (Order In-Progress Timeout)
  const [showInactivityModal, setShowInactivityModal] = useState<boolean>(false);
  const [inactivityCountdown, setInactivityCountdown] = useState<number>(30);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState<boolean>(false);

  const inactivityTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);

  // Clear countdown timer utility
  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // Universal Inactivity Timer Handler (1 Minute = 60,000ms)
  const resetInactivityTimer = useCallback(() => {
    // If confirmation modal is currently visible, let the countdown handle auto-cancel
    if (showInactivityModal) return;

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    // If promotional slideshow is currently covering the screen, no background timer needed
    if (isIdleActive) return;

    inactivityTimerRef.current = setTimeout(() => {
      // CASE 1: Kiosk Idle Screen (Customer Login / Welcome)
      if (currentPage === 'PAGE_1_USER_TYPE') {
        setIsIdleActive(true);
        return;
      }

      // CASE 2: Order Success Screen
      if (currentPage === 'PAGE_6_SUCCESS') {
        handleResetSession();
        return;
      }

      // CASE 3: Customer is placing an order (Vehicles, Services, Details, Payment, Dealer)
      // Never interrupt active payment terminal / card processing
      if (isPaymentProcessing) {
        resetInactivityTimer();
        return;
      }

      // Pause ordering screen and display confirmation popup
      setShowInactivityModal(true);
      setInactivityCountdown(30);

      clearCountdownTimer();
      countdownTimerRef.current = setInterval(() => {
        setInactivityCountdown((prev) => {
          if (prev <= 1) {
            clearCountdownTimer();
            setShowInactivityModal(false);
            handleResetSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 60000);
  }, [isIdleActive, showInactivityModal, currentPage, isPaymentProcessing, clearCountdownTimer]);

  // Handle customer continuing their existing order from the inactivity popup
  const handleContinueOrderFromInactivity = () => {
    clearCountdownTimer();
    setShowInactivityModal(false);
    resetInactivityTimer();
  };

  // Handle customer cancelling their order from the inactivity popup
  const handleCancelOrderFromInactivity = () => {
    clearCountdownTimer();
    setShowInactivityModal(false);
    handleResetSession();
  };

  // Any screen touch/interaction resets the inactivity timer
  const handleScreenTouchActivity = () => {
    if (!showInactivityModal) {
      resetInactivityTimer();
    }
  };

  const handleDismissIdle = () => {
    setIsIdleActive(false);
    resetInactivityTimer();
    if (currentPage !== 'PAGE_1_USER_TYPE') {
      navigateToPage('PAGE_1_USER_TYPE', '/customer-login');
    }
  };

  useEffect(() => {
    if (!isIdleActive) {
      resetInactivityTimer();
    } else if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      clearCountdownTimer();
    };
  }, [isIdleActive, currentPage, resetInactivityTimer, clearCountdownTimer]);

  const handleOpenStaffLogin = () => {
    setIsStaffLoginModalOpen(true);
  };

  const handleStaffLoginSuccess = (user: AuthenticatedUser) => {
    setIsStaffLoginModalOpen(false);
    const targetRoute = getRouteForUserGroup(user);
    if (onNavigateScreen) {
      onNavigateScreen(targetRoute);
    } else if (onExitToPos) {
      onExitToPos();
    }
  };

  // Proactive background prefetching for all kiosk steps
  useEffect(() => {
    let isMounted = true;
    const prefetchKioskData = async () => {
      try {
        const [vehicles, categories] = await Promise.all([
          fetchVehicleTypes().catch(() => []),
          fetchServiceCategories().catch(() => []),
          fetchAllDealers(false).catch(() => []),
          fetchCompanySettings().catch(() => ({} as any)),
        ]);

        if (!isMounted) return;

        // Prefetch packages for each category
        if (Array.isArray(categories)) {
          for (const cat of categories) {
            if (cat.serviceCategoryId) {
              fetchPackagesByCategory(cat.serviceCategoryId).catch(() => []);
            }
          }
        }
      } catch (e) {
        // Silent background prefetch fallback
      }
    };

    prefetchKioskData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync state changes with session storage for browser refresh restoration
  useEffect(() => {
    saveKioskSession({
      userType,
      selectedDealer,
      isDealerAuthenticated,
      selectedVehicle,
      selectedVehicleTypeId,
      selectedVehicleTypeCode,
      selectedCategory,
      selectedServiceCategoryId,
      selectedServiceCategoryCode,
      selectedPackage,
      selectedPackageId,
      selectedPackageCode,
      customerDetails,
      paymentMode,
      activeOrderId,
      activeOrderNo,
      billCounter,
      completedOrder,
    });
  }, [
    userType,
    selectedDealer,
    isDealerAuthenticated,
    selectedVehicle,
    selectedVehicleTypeId,
    selectedVehicleTypeCode,
    selectedCategory,
    selectedServiceCategoryId,
    selectedServiceCategoryCode,
    selectedPackage,
    selectedPackageId,
    selectedPackageCode,
    customerDetails,
    paymentMode,
    activeOrderId,
    activeOrderNo,
    billCounter,
    completedOrder,
  ]);

  // Synchronize route changes from external navigation / refresh / back-forward
  useEffect(() => {
    if (initialPage && initialPage !== currentPage) {
      setCurrentPage(initialPage);
    }
  }, [initialPage]);

  useEffect(() => {
    if (initialUserType && initialUserType !== userType) {
      if (userType === 'DEALER' && initialUserType === 'CUSTOMER' && !['/customer-login', '/kiosk'].includes(currentRoute || '')) {
        return;
      }
      setUserType(initialUserType);
    }
  }, [initialUserType, currentRoute, userType]);

  const navigateToPage = (page: KioskPage, route: string) => {
    setCurrentPage(page);
    onNavigateScreen?.(route);
  };

  // Safe fallback if direct URL access lacks required prerequisites
  useEffect(() => {
    if (currentPage === 'PAGE_5_PAYMENT' && userType === 'DEALER') {
      navigateToPage('PAGE_4_DETAILS', '/details');
    } else if (currentPage === 'PAGE_5_PAYMENT' && (!selectedVehicle || !selectedCategory || !selectedPackage || !customerDetails)) {
      navigateToPage('PAGE_2_VEHICLE', '/new-wash');
    } else if (currentPage === 'PAGE_4_DETAILS' && (!selectedVehicle || !selectedCategory || !selectedPackage)) {
      navigateToPage('PAGE_2_VEHICLE', '/new-wash');
    } else if ((currentPage === 'PAGE_3_SERVICE_CAT' || currentPage === 'PAGE_3_PACKAGES') && !selectedVehicle) {
      navigateToPage('PAGE_2_VEHICLE', '/new-wash');
    } else if (currentPage === 'DEALER_PASSWORD' && !selectedDealer) {
      navigateToPage('DEALER_CHOOSE', '/dealer-login');
    } else if (currentPage === 'DEALER_CREDIT_CONFIRM' && (!selectedDealer || !selectedVehicle || !selectedCategory || !selectedPackage || !customerDetails)) {
      navigateToPage('PAGE_2_VEHICLE', '/new-wash');
    } else if (currentPage === 'PAGE_6_SUCCESS' && !completedOrder) {
      navigateToPage('PAGE_1_USER_TYPE', '/customer-login');
    }
  }, [
    currentPage,
    selectedVehicle,
    selectedCategory,
    selectedPackage,
    customerDetails,
    selectedDealer,
    completedOrder,
  ]);

  // ================= 1. PAGE 1: USER TYPE =================
  const handleSelectCustomer = () => {
    setUserType('CUSTOMER');
    setSelectedDealer(undefined);
    setIsDealerAuthenticated(false);
    navigateToPage('PAGE_2_VEHICLE', '/new-wash');
  };

  const handleSelectDealer = () => {
    setUserType('DEALER');
    navigateToPage('DEALER_CHOOSE', '/dealer-login');
  };

  // ================= 2. DEALER FLOW: CHOOSE DEALER =================
  const handleDealerChosen = (dealer: DealerOption) => {
    setSelectedDealer(dealer);
    setIsDealerAuthenticated(false);
    navigateToPage('DEALER_PASSWORD', '/dealer-password');
  };

  // ================= 3. DEALER FLOW: PASSWORD VERIFICATION =================
  const handleDealerPasswordSuccess = () => {
    setIsDealerAuthenticated(true);
    navigateToPage('PAGE_2_VEHICLE', '/new-wash');
  };

  // ================= 4. COMMON: VEHICLE SELECTION =================
  const handleContinueVehicle = (
    vehicle: VehicleOption, 
    vehicleTypeId?: number,
    vehicleDetails?: { vehicleNumber: string; remarks?: string }
  ) => {
    setSelectedVehicle(vehicle);
    setSelectedVehicleTypeId(vehicleTypeId || vehicle.vehicleTypeId);
    setSelectedVehicleTypeCode(vehicle.vehicleTypeCode);
    if (vehicleDetails) {
      setCustomerDetails({
        vehicleNumber: vehicleDetails.vehicleNumber,
        customerName: selectedDealer?.name || 'Authorized Dealer',
        mobileNumber: selectedDealer?.phone || '-',
      });
    }
    navigateToPage('PAGE_3_SERVICE_CAT', '/services');
  };

  const handleBackFromVehicle = () => {
    if (userType === 'DEALER') {
      navigateToPage('DEALER_PASSWORD', '/dealer-password');
    } else {
      navigateToPage('PAGE_1_USER_TYPE', '/customer-login');
    }
  };

  // ================= 5. COMMON: SERVICE & PACKAGE SELECTION =================
  const handleContinueServices = async (
    category: ServiceCategory,
    pkg: ServicePackage,
    serviceCategoryId?: number,
    additionalServices?: string,
    additionalAmount?: number
  ) => {
    setSelectedCategory(category);
    setSelectedServiceCategoryId(serviceCategoryId || category.serviceCategoryId);
    setSelectedServiceCategoryCode(category.serviceCategoryCode);
    setSelectedPackage(pkg);
    setSelectedPackageId(pkg.packageId);
    setSelectedPackageCode(pkg.packageCode);
    setSelectedAdditionalServices(additionalServices);
    setSelectedAdditionalAmount(additionalAmount || 0);

    // Both Customer and Dealer navigate to Details screen (all fields optional for dealer)
    navigateToPage('PAGE_4_DETAILS', '/details');
  };

  // ================= 6. COMMON: DETAILS FORM (SAVES INTO SQL SERVER) =================
  const handleContinueDetails = async (details: CustomerDetails) => {
    setCustomerDetails(details);

    try {
      const vTypeId = selectedVehicleTypeId || selectedVehicle?.vehicleTypeId || 1;
      const catId = selectedServiceCategoryId || selectedCategory?.serviceCategoryId || 1;
      const pkgId = selectedPackageId || selectedPackage?.packageId || 1;
      const isDealerFlow = userType === 'DEALER' || Boolean(selectedDealer) ||
        Boolean(details.vehicleNumber && (details.vehicleNumber.includes('DLR-') || details.vehicleNumber.includes('FLEET'))) ||
        Boolean(details.customerName && details.customerName.toUpperCase() === 'UNIPRO');
      const dId = (isDealerFlow && selectedDealer?.id) 
        ? parseInt(String(selectedDealer.id), 10) 
        : (isDealerFlow ? 1 : undefined);

      const vNum = details.vehicleNumber?.trim()
        ? details.vehicleNumber.trim().toUpperCase()
        : (isDealerFlow && selectedDealer ? `${selectedDealer.code} FLEET` : 'WALK-IN');
      const cName = details.customerName?.trim()
        ? details.customerName.trim()
        : (isDealerFlow && selectedDealer ? selectedDealer.name : 'Walk-in Customer');
      const mNum = details.mobileNumber?.trim() && details.mobileNumber !== '-'
        ? details.mobileNumber.trim()
        : (isDealerFlow && selectedDealer?.phone ? selectedDealer.phone : '-');

      if (isDealerFlow) {
        // Dealer Flow: create CREDIT order directly, NEVER show paymodes to dealer
        const saved = await createCarWashOrder({
          customerName: cName,
          vehicleNumber: vNum,
          mobileNumber: mNum,
          vehicleTypeId: vTypeId,
          serviceCategoryId: catId,
          packageId: pkgId,
          dealerId: dId,
          payMode: 'CREDIT',
          additionalServices: selectedAdditionalServices,
          additionalAmount: selectedAdditionalAmount,
        });

        const orderNo = saved.orderNo || `RB${String(billCounter).padStart(6, '0')}`;
        setActiveOrderId(saved.orderId);
        setActiveOrderNo(orderNo);
        setCreatedOrderData(saved);

        const pkgAmt = saved.packagePrice != null ? Number(saved.packagePrice) : (selectedPackage?.dealerPrice || selectedPackage?.price || 0);
        const extraAmt = Number(selectedAdditionalAmount || 0);
        const baseAmt = Number((pkgAmt + extraAmt).toFixed(2));
        const gstPercent = saved.gstPercent != null ? Number(saved.gstPercent) : getCachedGstRate();
        const computedGst = Number((baseAmt * (gstPercent / 100)).toFixed(2));
        const gstAmt = (saved.gstAmount != null && (extraAmt === 0 || Number(saved.totalAmount) >= baseAmt)) ? Number(saved.gstAmount) : computedGst;
        const totalAmt = (saved.totalAmount != null && (extraAmt === 0 || Number(saved.totalAmount) >= baseAmt)) ? Number(saved.totalAmount) : Number((baseAmt + gstAmt).toFixed(2));

        const newDealerOrder: KioskOrder = {
          orderId: saved.orderId,
          orderNo: orderNo,
          billNumber: orderNo,
          userType: 'DEALER',
          selectedDealer: selectedDealer,
          vehicle: selectedVehicle || { id: '1', name: 'Sedan', description: '' },
          serviceCategory: selectedCategory!,
          selectedPackage: selectedPackage!,
          customerDetails: {
            vehicleNumber: vNum,
            customerName: cName,
            mobileNumber: mNum,
          },
          paymentMode: 'CREDIT',
          paymentStatus: 'PENDING',
          packagePrice: pkgAmt,
          dealerPrice: selectedPackage?.dealerPrice || pkgAmt,
          gstPercent: gstPercent,
          totalAmount: totalAmt,
          gstAmount: gstAmt,
          additionalServices: selectedAdditionalServices,
          additionalAmount: extraAmt,
          outstandingAmount: totalAmt,
          createdAt: new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };

        setPaymentMode('CREDIT');
        setCompletedOrder(newDealerOrder);
        setBillCounter((prev) => prev + 1);

        // Broadcast to POS with popup & chime alert
        broadcastNewKioskOrder({
          orderId: saved.orderId,
          orderNo: orderNo,
          customerName: cName,
          vehiclePlate: vNum,
          vehicleType: selectedVehicle?.name || 'Vehicle',
          packageName: selectedPackage?.name || 'Package',
          amount: totalAmt,
          payMode: 'CREDIT',
          payStatus: 'PAID',
          isDealer: true,
          dealerName: selectedDealer?.name || 'Dealer',
          timestamp: new Date().toISOString(),
        });

        navigateToPage('PAGE_6_SUCCESS', '/success');
      } else {
        // Customer Flow: save booking and proceed to payment selection
        const saved = await createCarWashOrder({
          customerName: cName,
          vehicleNumber: vNum,
          mobileNumber: mNum,
          vehicleTypeId: vTypeId,
          serviceCategoryId: catId,
          packageId: pkgId,
          additionalServices: selectedAdditionalServices,
          additionalAmount: selectedAdditionalAmount,
        });

        setActiveOrderId(saved.orderId);
        setActiveOrderNo(saved.orderNo);
        setCreatedOrderData(saved);
        navigateToPage('PAGE_5_PAYMENT', '/checkout');
      }
    } catch (err: any) {
      console.error('[handleContinueDetails Error]', err);
      Alert.alert(
        'Booking Error',
        err?.message || 'Failed to save customer booking into database. Please try again.'
      );
      throw err;
    }
  };

  // ================= 7. CUSTOMER FLOW: PAYMENT (CASH / MEMBER / CREDIT) =================
  const handleConfirmCustomerPayment = async (mode: PaymentMode) => {
    setPaymentMode(mode);

    if (!selectedVehicle || !selectedCategory || !selectedPackage || !customerDetails) {
      return;
    }

    const orderNo = activeOrderNo || `RB${String(billCounter).padStart(6, '0')}`;
    const pkgAmount = createdOrderData?.packagePrice != null ? Number(createdOrderData.packagePrice) : selectedPackage.price;
    const extraAmt = Number(selectedAdditionalAmount || 0);
    const baseAmount = Number((pkgAmount + extraAmt).toFixed(2));
    const gstPercent = createdOrderData?.gstPercent != null ? Number(createdOrderData.gstPercent) : getCachedGstRate();
    const computedGst = Number((baseAmount * (gstPercent / 100)).toFixed(2));
    const gstAmount = (createdOrderData?.gstAmount != null && (extraAmt === 0 || Number(createdOrderData.totalAmount) >= baseAmount)) ? Number(createdOrderData.gstAmount) : computedGst;
    const totalAmount = (createdOrderData?.totalAmount != null && (extraAmt === 0 || Number(createdOrderData.totalAmount) >= baseAmount)) ? Number(createdOrderData.totalAmount) : Number((baseAmount + gstAmount).toFixed(2));

    // Broadcast customer order to POS with popup & chime alert IMMEDIATELY (0ms latency)
    broadcastNewKioskOrder({
      orderId: activeOrderId,
      orderNo: orderNo,
      customerName: customerDetails.customerName,
      vehiclePlate: customerDetails.vehicleNumber,
      vehicleType: selectedVehicle.name,
      packageName: selectedPackage.name,
      amount: totalAmount,
      payMode: String(mode),
      payStatus: String(mode).toUpperCase() === 'CASH' ? 'PENDING' : 'PAID',
      isDealer: false,
      timestamp: new Date().toISOString(),
    });

    // Update payment mode in SQL Server dbo.CarWashOrder (async background update)
    if (activeOrderId) {
      const isCash = String(mode).toUpperCase() === 'CASH';
      updateOrderPayment(activeOrderId, {
        payMode: String(mode),
        confirmPaid: !isCash,
        changedBy: 'KIOSK',
        remarks: !isCash
          ? `Payment completed via ${mode} at Kiosk`
          : 'Cash payment selected at Kiosk - pay at counter',
      }).catch((err: any) => {
        console.warn('Payment update warning:', err?.message);
      });
    }

    const newOrder: KioskOrder = {
      orderId: activeOrderId,
      orderNo: orderNo,
      billNumber: orderNo,
      userType: 'CUSTOMER',
      vehicle: selectedVehicle,
      serviceCategory: selectedCategory,
      selectedPackage: selectedPackage,
      customerDetails: customerDetails,
      paymentMode: mode,
      paymentStatus: String(mode).toUpperCase() === 'CASH' ? 'PENDING' : 'PAID',
      packagePrice: pkgAmount,
      dealerPrice: selectedPackage.dealerPrice,
      gstPercent,
      totalAmount,
      gstAmount,
      additionalServices: selectedAdditionalServices,
      additionalAmount: extraAmt,
      createdAt: new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setCompletedOrder(newOrder);
    setBillCounter((prev) => prev + 1);
    navigateToPage('PAGE_6_SUCCESS', '/success');
  };

  // ================= 8. DEALER FLOW: AUTOMATIC CREDIT ORDER PLACEMENT =================
  const handlePlaceDealerCreditOrder = async () => {
    if (!selectedDealer || !selectedVehicle || !selectedCategory || !selectedPackage || !customerDetails) {
      return;
    }

    const orderNo = activeOrderNo || `RB${String(billCounter).padStart(6, '0')}`;
    const totalAmount = selectedPackage.price;
    const gstPercent = selectedPackage.gstPercent || 9;
    const gstAmount = Number(((totalAmount * (gstPercent / 100)) / (1 + (gstPercent / 100))).toFixed(2));

    if (activeOrderId) {
      try {
        await updateOrderPayment(activeOrderId, {
          payMode: 'CREDIT',
          confirmPaid: true,
          changedBy: `DEALER:${selectedDealer.code}`,
          remarks: `Dealer credit order authorized by ${selectedDealer.name}`,
        });
      } catch (err: any) {
        console.warn('Dealer payment update warning:', err?.message);
      }
    }

    const newDealerOrder: KioskOrder = {
      orderId: activeOrderId,
      orderNo: orderNo,
      billNumber: orderNo,
      userType: 'DEALER',
      selectedDealer: selectedDealer,
      vehicle: selectedVehicle,
      serviceCategory: selectedCategory,
      selectedPackage: selectedPackage,
      customerDetails: customerDetails,
      paymentMode: 'CREDIT',
      paymentStatus: 'PAID',
      totalAmount,
      gstAmount,
      createdAt: new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setPaymentMode('CREDIT');
    setCompletedOrder(newDealerOrder);
    setBillCounter((prev) => prev + 1);

    // Broadcast dealer credit order to POS with popup & chime alert
    broadcastNewKioskOrder({
      orderId: activeOrderId,
      orderNo: orderNo,
      customerName: customerDetails.customerName,
      vehiclePlate: customerDetails.vehicleNumber,
      vehicleType: selectedVehicle.name,
      packageName: selectedPackage.name,
      amount: totalAmount,
      payMode: 'CREDIT',
      payStatus: 'PAID',
      isDealer: true,
      dealerName: selectedDealer.name,
      timestamp: new Date().toISOString(),
    });

    navigateToPage('PAGE_6_SUCCESS', '/success');
  };

  // ================= RESET STATE: NEW CUSTOMER OR DEALER =================
  const handleResetSession = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    clearCountdownTimer();
    setShowInactivityModal(false);
    clearKioskSession();
    setUserType('CUSTOMER');
    setSelectedDealer(undefined);
    setIsDealerAuthenticated(false);
    setSelectedVehicle(undefined);
    setSelectedVehicleTypeId(undefined);
    setSelectedVehicleTypeCode(undefined);
    setSelectedCategory(undefined);
    setSelectedServiceCategoryId(undefined);
    setSelectedServiceCategoryCode(undefined);
    setSelectedPackage(undefined);
    setSelectedPackageId(undefined);
    setSelectedPackageCode(undefined);
    setSelectedAdditionalServices(undefined);
    setSelectedAdditionalAmount(0);
    setCustomerDetails(undefined);
    setPaymentMode(undefined);
    setActiveOrderId(undefined);
    setActiveOrderNo(undefined);
    setCompletedOrder(null);
    navigateToPage('PAGE_1_USER_TYPE', '/customer-login');
    setIsIdleActive(true);
  };

  return (
    <View
      style={styles.container}
      onStartShouldSetResponderCapture={() => {
        handleScreenTouchActivity();
        return false;
      }}
      onMoveShouldSetResponderCapture={() => {
        handleScreenTouchActivity();
        return false;
      }}
      onTouchStart={handleScreenTouchActivity}
    >
      {/* Full-screen Idle Promotional Slideshow */}
      {isIdleActive && (
        <KioskPromotionSlideshow
          onTouchAnywhere={handleDismissIdle}
          onNoPromotions={() => setIsIdleActive(false)}
        />
      )}

      <View style={styles.portraitWrapper}>
        {/* PAGE 1: Customer vs Dealer */}
        {currentPage === 'PAGE_1_USER_TYPE' && (
          <Page1UserTypeScreen
            onSelectCustomer={handleSelectCustomer}
            onSelectDealer={handleSelectDealer}
            onExitToPos={handleOpenStaffLogin}
          />
        )}

        {/* DEALER FLOW: Page 2 - Choose Dealer */}
        {currentPage === 'DEALER_CHOOSE' && (
          <DealerChooseScreen
            initialDealer={selectedDealer}
            onContinue={handleDealerChosen}
            onBack={() => navigateToPage('PAGE_1_USER_TYPE', '/customer-login')}
            onExitToPos={handleOpenStaffLogin}
          />
        )}

        {/* DEALER FLOW: Page 3 - Dealer Password */}
        {currentPage === 'DEALER_PASSWORD' && selectedDealer && (
          <DealerPasswordScreen
            dealer={selectedDealer}
            onSuccess={handleDealerPasswordSuccess}
            onBack={() => navigateToPage('DEALER_CHOOSE', '/dealer-login')}
            onExitToPos={handleOpenStaffLogin}
          />
        )}

        {/* PAGE 4 (Dealer) / PAGE 2 (Customer): Vehicle Selection */}
        {currentPage === 'PAGE_2_VEHICLE' && (
          <Page2VehicleScreen
            initialVehicle={selectedVehicle}
            isDealer={userType === 'DEALER'}
            dealer={selectedDealer}
            initialVehicleNumber={customerDetails?.vehicleNumber}
            onContinue={handleContinueVehicle}
            onBack={handleBackFromVehicle}
            onExitToPos={handleOpenStaffLogin}
          />
        )}

        {/* PAGE 5 (Dealer) / PAGE 3 (Customer): Service & Package Selection */}
        {(currentPage === 'PAGE_3_SERVICE_CAT' || currentPage === 'PAGE_3_PACKAGES') && (
          <Page3ServiceScreen
            initialCategory={selectedCategory}
            initialPackage={selectedPackage}
            isDealer={userType === 'DEALER'}
            dealer={selectedDealer}
            vehicleNumber={customerDetails?.vehicleNumber}
            vehicle={selectedVehicle}
            onContinue={handleContinueServices}
            onBack={() => navigateToPage('PAGE_2_VEHICLE', '/new-wash')}
            onExitToPos={handleOpenStaffLogin}
          />
        )}

        {/* PAGE 6 (Dealer) / PAGE 4 (Customer): Customer Details Form */}
        {currentPage === 'PAGE_4_DETAILS' && (
          <Page4DetailsScreen
            initialDetails={customerDetails}
            isDealer={userType === 'DEALER'}
            dealer={selectedDealer}
            selectedVehicle={selectedVehicle}
            selectedPackage={selectedPackage}
            additionalServices={selectedAdditionalServices}
            additionalAmount={selectedAdditionalAmount}
            onContinue={handleContinueDetails}
            onBack={() => navigateToPage('PAGE_3_SERVICE_CAT', '/services')}
            onExitToPos={handleOpenStaffLogin}
          />
        )}

        {/* CUSTOMER FLOW: Page 5 - Payment Mode (Active Paymodes from SQL Server) */}
        {currentPage === 'PAGE_5_PAYMENT' && selectedVehicle && selectedCategory && selectedPackage && customerDetails && (
          <Page5PaymentScreen
            vehicle={selectedVehicle}
            category={selectedCategory}
            selectedPackage={selectedPackage}
            customerDetails={customerDetails}
            initialPaymentMode={paymentMode}
            orderNo={activeOrderNo}
            savedOrder={createdOrderData}
            onConfirmPayment={handleConfirmCustomerPayment}
            onBack={() => navigateToPage('PAGE_4_DETAILS', '/details')}
            onExitToPos={handleOpenStaffLogin}
            onPaymentProcessingChange={setIsPaymentProcessing}
          />
        )}

        {/* DEALER FLOW: Final Step - Automatic Credit Payment Confirmation */}
        {currentPage === 'DEALER_CREDIT_CONFIRM' && selectedDealer && selectedVehicle && selectedCategory && selectedPackage && customerDetails && (
          <DealerCreditConfirmScreen
            dealer={selectedDealer}
            vehicle={selectedVehicle}
            category={selectedCategory}
            selectedPackage={selectedPackage}
            customerDetails={customerDetails}
            onPlaceOrder={handlePlaceDealerCreditOrder}
            onBack={() => navigateToPage('PAGE_4_DETAILS', '/details')}
            onExitToPos={handleOpenStaffLogin}
          />
        )}

        {/* FINAL: Success Screen & Bill Number (Both Customer & Dealer) */}
        {currentPage === 'PAGE_6_SUCCESS' && completedOrder && (
          <Page6SuccessScreen
            order={completedOrder}
            onNewCustomer={handleResetSession}
            onExitToPos={handleOpenStaffLogin}
          />
        )}
      </View>

      {/* Inactivity Order Continuation Confirmation Modal */}
      <InactivityPromptModal
        visible={showInactivityModal}
        countdownSeconds={inactivityCountdown}
        onContinueOrder={handleContinueOrderFromInactivity}
        onCancelOrder={handleCancelOrderFromInactivity}
      />

      {/* Staff POS Authorization Modal */}
      <StaffPosLoginModal
        visible={isStaffLoginModalOpen}
        onClose={() => setIsStaffLoginModalOpen(false)}
        onSuccess={handleStaffLoginSuccess}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? {
          width: '100vw' as any,
          height: '100vh' as any,
          maxWidth: '100vw' as any,
          maxHeight: '100vh' as any,
          boxSizing: 'border-box' as any,
        }
      : {}),
  },
  portraitWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 0,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    ...(Platform.OS === 'web'
      ? {
          width: '100%' as any,
          height: '100%' as any,
          maxWidth: '100%' as any,
          maxHeight: '100%' as any,
          boxSizing: 'border-box' as any,
        }
      : {}),
  },
});
