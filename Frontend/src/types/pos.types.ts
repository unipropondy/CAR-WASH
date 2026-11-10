export type VehicleCategoryType = 'Sedan' | 'SUV' | 'MPV' | 'Big MPV';

export interface VehicleCategoryConfig {
  id: string;
  name: VehicleCategoryType;
  nameZh: string;
  basePrice: number;
  iconName: string;
  description: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  price: number;
  isPopular?: boolean;
  estimatedMinutes: number;
}

export type BayStatusType = 'AVAILABLE' | 'IN_SERVICE' | 'VACANT' | 'OCCUPIED' | 'FINISHING' | 'MAINTENANCE';

export interface WashingBay {
  id: string;
  bayId?: string;
  bayNumber?: number; // 1, 2, 3, 4, 5
  name: string;       // "Bay 1", "Bay 2", etc.
  type?: 'WASH' | 'VACUUM' | 'DETAILING' | string;
  status: BayStatusType | string;
  xSize?: number;
  ySize?: number;
  xPos?: number;
  yPos?: number;
  customerName?: string;
  customerMobile?: string;
  vehiclePlate?: string;
  vehicleNumber?: string;
  packageName?: string;
  remainingMinutes?: number;
  orderId?: string;
  currentOrderId?: string;
  totalAmount?: number;
  isLocked?: boolean;
  remarks?: string;
  elapsedSeconds?: number;
  totalDurationSeconds?: number;
  startTime?: string;     // e.g. "09:45 AM"
  duration?: string;      // e.g. "38 min"
  carColor?: string;      // e.g. "#18181B"
  vehicleType?: string;   // e.g. "SUV"
}

export type OrderQueueStatus = 
  | 'WAITING_ASSIGN' 
  | 'IN_SERVICE' 
  | 'IN_QUEUE' 
  | 'COMPLETED' 
  | 'WAITING' 
  | 'ASSIGNED_TO_BAY' 
  | 'IN_WASH' 
  | 'DETAILING' 
  | 'READY_FOR_COLLECTION' 
  | 'CLOSED'
  | 'CANCELLED';

export type PaymentStatus = 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
export type PaymentStatusType = PaymentStatus;
export type PaymentMethodType = 'YEAHPAY_QR' | 'YEAHPAY_CARD' | 'CASH' | 'MEMBER' | 'CREDIT' | string;

export interface PosOrder {
  id: string;
  orderId?: number;
  orderNumber: string; // e.g. "RB20261102-0001"
  customerName: string; // e.g. "Taylor Smith"
  customerMobile?: string;
  initials?: string;    // e.g. "TS"
  avatarColor?: string; // e.g. "#E11D48"
  vehiclePlate: string; // e.g. "SMK 8821 Z"
  vehicleCategory?: VehicleCategoryType | string;
  vehicleTypeName?: string;
  serviceCategoryName?: string;
  carColor?: string;    // e.g. "#EF4444"
  packageName: string;  // "Premium", "Deluxe", "Basic"
  services?: ServiceItem[];
  packagePrice?: number;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  payMode?: string;
  paymentStatus: PaymentStatus;
  status: OrderQueueStatus;
  statusCode?: number;
  statusName?: string;
  paymentMethod?: PaymentMethodType;
  assignedBayName?: string; // e.g. "Bay 2"
  assignedBayId?: string | number;
  bayStatus?: string;
  waitTime?: string;    // e.g. "12 min"
  createdAt: string;
  createdDate?: string;
  paidDate?: string;
  startedDate?: string;
  completedDate?: string;
  closedDate?: string;
}

export interface SalesMetrics {
  grossSalesToday: number;
  totalVehiclesServiced: number;
  activeInQueue: number;
  activeBaysOccupancy: number;
  averageWashMinutes: number;
}
