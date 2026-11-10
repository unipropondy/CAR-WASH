export type KioskPage = 
  | 'PAGE_1_USER_TYPE'       // Customer vs Dealer
  | 'DEALER_CHOOSE'          // Page 2: Select Dealer
  | 'DEALER_PASSWORD'        // Page 3: Dealer PIN Verification
  | 'PAGE_2_VEHICLE'         // Vehicle Type Selection
  | 'PAGE_3_SERVICE_CAT'     // CAR WASH, POLISHING, ALCARE CARE
  | 'PAGE_3_PACKAGES'        // Packages under chosen category
  | 'PAGE_4_DETAILS'         // Vehicle No, Name, Mobile
  | 'PAGE_5_PAYMENT'         // Customer Payment: Cash, PayNow, Card
  | 'DEALER_CREDIT_CONFIRM'  // Dealer Automatic Credit Confirmation
  | 'PAGE_6_SUCCESS';        // Bill #, Summary, Print, Reset

export type KioskUserType = 'CUSTOMER' | 'DEALER';

export interface DealerOption {
  id: string;
  name: string;
  code: string;
  pin: string;
  contactPerson?: string;
  phone?: string;
  billingCycle: string;
  icon?: string;
}

export interface VehicleOption {
  id: string;
  vehicleTypeId?: number;
  vehicleTypeCode?: string;
  name: string;
  nameZh?: string;
  icon?: string;
  description: string;
  imageUrl?: string | null;
  imageContentType?: string | null;
  hasImage?: boolean;
}

export type ServiceCategoryId = 'CAR_WASH' | 'POLISHING' | 'ALCARE_CARE' | string;

export interface ServiceCategory {
  id: string;
  serviceCategoryId?: number;
  serviceCategoryCode?: string;
  title: string;
  titleZh?: string;
  subtitle?: string;
  icon?: string;
  description: string;
  imageUrl?: string | null;
  imageContentType?: string | null;
  hasImage?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}

export interface ServicePackage {
  id: string;
  packageId?: number;
  serviceCategoryId?: number;
  packageCode?: string;
  categoryId: ServiceCategoryId;
  name: string;
  nameZh?: string;
  price: number;
  currencyCode?: string;
  gstPercent?: number;
  isTaxInclusive?: boolean;
  durationMinutes?: number | null;
  displayOrder?: number;
  isActive?: boolean;
  description: string;
  features: string[];
}

export interface CustomerDetails {
  vehicleNumber: string;
  customerName: string;
  mobileNumber: string;
}

export type PaymentMode = 'CASH' | 'MEMBER' | 'CREDIT' | 'PAYNOW' | 'CARD' | string;

export type PaymentStatus = 'PAID' | 'PENDING' | 'CREDIT / PENDING' | string;

export interface KioskOrder {
  orderId?: number;
  orderNo?: string;
  billNumber: string; // e.g. "RB000001" or orderNo
  userType: KioskUserType;
  selectedDealer?: DealerOption;
  vehicle: VehicleOption;
  serviceCategory: ServiceCategory;
  selectedPackage: ServicePackage;
  customerDetails: CustomerDetails;
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  gstAmount: number;
  createdAt: string;
}
