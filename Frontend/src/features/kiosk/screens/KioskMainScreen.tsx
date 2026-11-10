import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Page1UserTypeScreen } from './Page1UserTypeScreen';
import { DealerChooseScreen } from './DealerChooseScreen';
import { DealerPasswordScreen } from './DealerPasswordScreen';
import { Page2VehicleScreen } from './Page2VehicleScreen';
import { Page3ServiceScreen } from './Page3ServiceScreen';
import { Page4DetailsScreen } from './Page4DetailsScreen';
import { Page5PaymentScreen } from './Page5PaymentScreen';
import { DealerCreditConfirmScreen } from './DealerCreditConfirmScreen';
import { Page6SuccessScreen } from './Page6SuccessScreen';
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
import { createCarWashOrder, updateOrderPayment } from '../../../services/carwashOrderApi';
import { 
  saveKioskSession, 
  loadKioskSession, 
  clearKioskSession 
} from '../store/kioskSessionStorage';

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
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | undefined>(savedSession?.customerDetails);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | undefined>(savedSession?.paymentMode);

  // SQL Server Order ID & Order Number
  const [activeOrderId, setActiveOrderId] = useState<number | undefined>(savedSession?.activeOrderId);
  const [activeOrderNo, setActiveOrderNo] = useState<string | undefined>(savedSession?.activeOrderNo);
  
  // Completed Order State & Bill Number Counter (e.g. RB000001)
  const [billCounter, setBillCounter] = useState<number>(savedSession?.billCounter || 1);
  const [completedOrder, setCompletedOrder] = useState<KioskOrder | null>(savedSession?.completedOrder || null);

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
      setUserType(initialUserType);
    }
  }, [initialUserType]);

  const navigateToPage = (page: KioskPage, route: string) => {
    setCurrentPage(page);
    onNavigateScreen?.(route);
  };

  // Safe fallback if direct URL access lacks required prerequisites
  useEffect(() => {
    if (currentPage === 'PAGE_5_PAYMENT' && (!selectedVehicle || !selectedCategory || !selectedPackage || !customerDetails)) {
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
  const handleContinueVehicle = (vehicle: VehicleOption, vehicleTypeId?: number) => {
    setSelectedVehicle(vehicle);
    setSelectedVehicleTypeId(vehicleTypeId || vehicle.vehicleTypeId);
    setSelectedVehicleTypeCode(vehicle.vehicleTypeCode);
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
  const handleContinueServices = (
    category: ServiceCategory,
    pkg: ServicePackage,
    serviceCategoryId?: number
  ) => {
    setSelectedCategory(category);
    setSelectedServiceCategoryId(serviceCategoryId || category.serviceCategoryId);
    setSelectedServiceCategoryCode(category.serviceCategoryCode);
    setSelectedPackage(pkg);
    setSelectedPackageId(pkg.packageId);
    setSelectedPackageCode(pkg.packageCode);
    navigateToPage('PAGE_4_DETAILS', '/details');
  };

  // ================= 6. COMMON: DETAILS FORM (SAVES INTO SQL SERVER) =================
  const handleContinueDetails = async (details: CustomerDetails) => {
    setCustomerDetails(details);

    try {
      const vTypeId = selectedVehicleTypeId || selectedVehicle?.vehicleTypeId || 1;
      const catId = selectedServiceCategoryId || selectedCategory?.serviceCategoryId || 1;
      const pkgId = selectedPackageId || selectedPackage?.packageId || 1;

      // Save customer booking in dbo.CarWashOrder before proceeding to payment
      const saved = await createCarWashOrder({
        customerName: details.customerName?.trim() || (userType === 'DEALER' ? (selectedDealer?.name || 'Authorized Dealer') : 'Walk-in Customer'),
        vehicleNumber: details.vehicleNumber?.trim() ? details.vehicleNumber.trim().toUpperCase() : 'WALK-IN',
        mobileNumber: details.mobileNumber?.trim() || '-',
        vehicleTypeId: vTypeId,
        serviceCategoryId: catId,
        packageId: pkgId,
      });

      setActiveOrderId(saved.orderId);
      setActiveOrderNo(saved.orderNo);

      if (userType === 'DEALER') {
        navigateToPage('DEALER_CREDIT_CONFIRM', '/dealer-confirm');
      } else {
        navigateToPage('PAGE_5_PAYMENT', '/checkout');
      }
    } catch (err: any) {
      Alert.alert(
        'Booking Error',
        err?.message || 'Failed to save customer booking into database. Please try again.'
      );
    }
  };

  // ================= 7. CUSTOMER FLOW: PAYMENT (CASH / MEMBER / CREDIT) =================
  const handleConfirmCustomerPayment = async (mode: PaymentMode) => {
    setPaymentMode(mode);

    if (!selectedVehicle || !selectedCategory || !selectedPackage || !customerDetails) {
      return;
    }

    const orderNo = activeOrderNo || `RB${String(billCounter).padStart(6, '0')}`;
    const totalAmount = selectedPackage.price;
    const gstPercent = selectedPackage.gstPercent || 9;
    const gstAmount = Number(((totalAmount * (gstPercent / 100)) / (1 + (gstPercent / 100))).toFixed(2));

    // Update payment mode in SQL Server dbo.CarWashOrder
    if (activeOrderId) {
      try {
        const isCash = String(mode).toUpperCase() === 'CASH';
        await updateOrderPayment(activeOrderId, {
          payMode: String(mode),
          confirmPaid: !isCash,
          changedBy: 'KIOSK',
          remarks: !isCash
            ? `Payment completed via ${mode} at Kiosk`
            : 'Cash payment selected at Kiosk - pay at counter',
        });
      } catch (err: any) {
        console.warn('Payment update warning:', err?.message);
      }
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
      totalAmount,
      gstAmount,
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
    navigateToPage('PAGE_6_SUCCESS', '/success');
  };

  // ================= RESET STATE: NEW CUSTOMER OR DEALER =================
  const handleResetSession = () => {
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
    setCustomerDetails(undefined);
    setPaymentMode(undefined);
    setActiveOrderId(undefined);
    setActiveOrderNo(undefined);
    setCompletedOrder(null);
    navigateToPage('PAGE_1_USER_TYPE', '/customer-login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.portraitWrapper}>
        {/* PAGE 1: Customer vs Dealer */}
        {currentPage === 'PAGE_1_USER_TYPE' && (
          <Page1UserTypeScreen
            onSelectCustomer={handleSelectCustomer}
            onSelectDealer={handleSelectDealer}
            onExitToPos={onExitToPos}
          />
        )}

        {/* DEALER FLOW: Page 2 - Choose Dealer */}
        {currentPage === 'DEALER_CHOOSE' && (
          <DealerChooseScreen
            initialDealer={selectedDealer}
            onContinue={handleDealerChosen}
            onBack={() => navigateToPage('PAGE_1_USER_TYPE', '/customer-login')}
            onExitToPos={onExitToPos}
          />
        )}

        {/* DEALER FLOW: Page 3 - Dealer Password */}
        {currentPage === 'DEALER_PASSWORD' && selectedDealer && (
          <DealerPasswordScreen
            dealer={selectedDealer}
            onSuccess={handleDealerPasswordSuccess}
            onBack={() => navigateToPage('DEALER_CHOOSE', '/dealer-login')}
            onExitToPos={onExitToPos}
          />
        )}

        {/* PAGE 4 (Dealer) / PAGE 2 (Customer): Vehicle Selection */}
        {currentPage === 'PAGE_2_VEHICLE' && (
          <Page2VehicleScreen
            initialVehicle={selectedVehicle}
            onContinue={handleContinueVehicle}
            onBack={handleBackFromVehicle}
            onExitToPos={onExitToPos}
          />
        )}

        {/* PAGE 5 (Dealer) / PAGE 3 (Customer): Service & Package Selection */}
        {(currentPage === 'PAGE_3_SERVICE_CAT' || currentPage === 'PAGE_3_PACKAGES') && (
          <Page3ServiceScreen
            initialCategory={selectedCategory}
            initialPackage={selectedPackage}
            onContinue={handleContinueServices}
            onBack={() => navigateToPage('PAGE_2_VEHICLE', '/new-wash')}
            onExitToPos={onExitToPos}
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
            onContinue={handleContinueDetails}
            onBack={() => navigateToPage('PAGE_3_SERVICE_CAT', '/services')}
            onExitToPos={onExitToPos}
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
            onConfirmPayment={handleConfirmCustomerPayment}
            onBack={() => navigateToPage('PAGE_4_DETAILS', '/details')}
            onExitToPos={onExitToPos}
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
            onExitToPos={onExitToPos}
          />
        )}

        {/* FINAL: Success Screen & Bill Number (Both Customer & Dealer) */}
        {currentPage === 'PAGE_6_SUCCESS' && completedOrder && (
          <Page6SuccessScreen
            order={completedOrder}
            onNewCustomer={handleResetSession}
            onExitToPos={onExitToPos}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    backgroundColor: '#F8FAFC',
    alignSelf: 'center',
  },
});
