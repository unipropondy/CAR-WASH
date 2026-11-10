import { 
  VehicleCategoryConfig, 
  ServiceItem, 
  WashingBay, 
  PosOrder 
} from '../types/pos.types';

export const INITIAL_VEHICLE_CATEGORIES: VehicleCategoryConfig[] = [
  { id: 'cat_sedan', name: 'Sedan', nameZh: '标准轿车', basePrice: 15.00, iconName: 'car-side', description: '4-door Saloons' },
  { id: 'cat_suv', name: 'SUV', nameZh: '城市越野车 (SUV)', basePrice: 16.00, iconName: 'truck-monster', description: 'Crossovers & 5-Seaters' },
  { id: 'cat_mpv', name: 'MPV', nameZh: '多用途商务车 (MPV)', basePrice: 17.00, iconName: 'van-shuttle', description: '7-Seaters & Family MPVs' },
  { id: 'cat_big_mpv', name: 'Big MPV', nameZh: '大型豪华商务车', basePrice: 20.00, iconName: 'bus', description: 'Alphard / Full-size vans' }
];

export const INITIAL_SERVICES: ServiceItem[] = [
  { id: 'srv_car_wash', name: 'Car Wash', nameZh: '全车泡沫精洗', description: 'Foam shampoo & chamois dry', price: 0, isPopular: true, estimatedMinutes: 12 },
  { id: 'srv_vacuum', name: 'Vacuum', nameZh: '深度吸尘', description: 'Interior cabin & boot vacuuming', price: 6.00, isPopular: true, estimatedMinutes: 10 },
  { id: 'srv_interior_refresh', name: 'Interior Refresh', nameZh: '内饰焕新', description: 'Antibacterial cabin mist & wipe', price: 12.00, isPopular: false, estimatedMinutes: 15 },
  { id: 'srv_tyre_shine', name: 'Tyre Shine', nameZh: '轮胎上光', description: 'Silicone polymer UV coating', price: 4.00, isPopular: true, estimatedMinutes: 5 }
];

// EXACT FIVE BAYS matching the screenshot in 1 horizontal row
export const INITIAL_BAYS: WashingBay[] = [
  {
    id: 'bay_1',
    bayNumber: 1,
    name: 'Bay 1',
    status: 'IN_SERVICE',
    customerName: 'Casey Brown',
    vehiclePlate: 'SLP 6620 M',
    packageName: 'Deluxe Wash',
    startTime: '09:45 AM',
    duration: '38 min',
    remainingMinutes: 4,
    carColor: '#18181B',
    vehicleType: 'SUV',
    orderId: 'ord_1047'
  },
  {
    id: 'bay_2',
    bayNumber: 2,
    name: 'Bay 2',
    status: 'IN_SERVICE',
    customerName: 'Sam Patel',
    vehiclePlate: 'SGL 5590 X',
    packageName: 'Basic Wash',
    startTime: '10:10 AM',
    duration: '14 min',
    remainingMinutes: 8,
    carColor: '#F8FAFC',
    vehicleType: 'Sedan',
    orderId: 'ord_1045'
  },
  {
    id: 'bay_3',
    bayNumber: 3,
    name: 'Bay 3',
    status: 'IN_SERVICE',
    customerName: 'Jordan Lee',
    vehiclePlate: 'SND 9918 C',
    packageName: 'Premium Wash',
    startTime: '10:15 AM',
    duration: '9 min',
    remainingMinutes: 6,
    carColor: '#2563EB',
    vehicleType: 'SUV',
    orderId: 'ord_1046'
  },
  {
    id: 'bay_4',
    bayNumber: 4,
    name: 'Bay 4',
    status: 'AVAILABLE',
    customerName: 'No Vehicle',
    packageName: 'Ready for Wash',
    startTime: '-',
    duration: '-',
    carColor: '#E2E8F0'
  },
  {
    id: 'bay_5',
    bayNumber: 5,
    name: 'Bay 5',
    status: 'AVAILABLE',
    customerName: 'No Vehicle',
    packageName: 'Ready for Wash',
    startTime: '-',
    duration: '-',
    carColor: '#E2E8F0'
  }
];

// Initial Queue matching screenshot rows (1044, 1045, 1046, 1047, 1048, 1049)
export const INITIAL_ORDERS: PosOrder[] = [
  {
    id: 'ord_1044',
    orderNumber: '1044',
    customerName: 'Taylor Smith',
    initials: 'TS',
    avatarColor: '#E11D48', // Vibrant Rose/Pink
    vehiclePlate: 'SMK 8821 Z',
    carColor: '#EF4444',    // Red car
    vehicleCategory: 'SUV',
    packageName: 'Deluxe',
    services: [INITIAL_SERVICES[0], INITIAL_SERVICES[1], INITIAL_SERVICES[3]],
    subtotal: 26.00,
    gstRate: 9.0,
    gstAmount: 2.34,
    totalAmount: 28.34,
    paymentStatus: 'PAID',
    status: 'WAITING_ASSIGN',
    waitTime: '12 min',
    createdAt: '10:18 AM',
    customerMobile: '9888 2311'
  },
  {
    id: 'ord_1045',
    orderNumber: '1045',
    customerName: 'Sam Patel',
    initials: 'SP',
    avatarColor: '#64748B', // Slate Grey
    vehiclePlate: 'SGL 5590 X',
    carColor: '#F8FAFC',    // White car
    vehicleCategory: 'Sedan',
    packageName: 'Basic',
    services: [INITIAL_SERVICES[0]],
    subtotal: 15.00,
    gstRate: 9.0,
    gstAmount: 1.35,
    totalAmount: 16.35,
    paymentStatus: 'PAID',
    status: 'IN_SERVICE',
    assignedBayName: 'Bay 2',
    assignedBayId: 'bay_2',
    waitTime: '8 min',
    createdAt: '10:05 AM',
    customerMobile: '8765 4321'
  },
  {
    id: 'ord_1046',
    orderNumber: '1046',
    customerName: 'Jordan Lee',
    initials: 'JL',
    avatarColor: '#3B82F6', // Blue
    vehiclePlate: 'SND 9918 C',
    carColor: '#2563EB',    // Blue car
    vehicleCategory: 'SUV',
    packageName: 'Premium',
    services: [INITIAL_SERVICES[0], INITIAL_SERVICES[1], INITIAL_SERVICES[2], INITIAL_SERVICES[3]],
    subtotal: 42.00,
    gstRate: 9.0,
    gstAmount: 3.78,
    totalAmount: 45.78,
    paymentStatus: 'PAID',
    status: 'IN_SERVICE',
    assignedBayName: 'Bay 3',
    assignedBayId: 'bay_3',
    waitTime: '6 min',
    createdAt: '10:08 AM',
    customerMobile: '9345 6789'
  },
  {
    id: 'ord_1047',
    orderNumber: '1047',
    customerName: 'Casey Brown',
    initials: 'CB',
    avatarColor: '#8B5CF6', // Purple
    vehiclePlate: 'SLP 6620 M',
    carColor: '#18181B',    // Black car
    vehicleCategory: 'MPV',
    packageName: 'Deluxe',
    services: [INITIAL_SERVICES[0], INITIAL_SERVICES[1], INITIAL_SERVICES[3]],
    subtotal: 27.00,
    gstRate: 9.0,
    gstAmount: 2.43,
    totalAmount: 29.43,
    paymentStatus: 'PAID',
    status: 'IN_SERVICE',
    assignedBayName: 'Bay 1',
    assignedBayId: 'bay_1',
    waitTime: '4 min',
    createdAt: '09:58 AM',
    customerMobile: '9211 0044'
  },
  {
    id: 'ord_1048',
    orderNumber: '1048',
    customerName: 'Pat Taylor',
    initials: 'PT',
    avatarColor: '#0D9488', // Teal
    vehiclePlate: 'SGE 7714 T',
    carColor: '#E2E8F0',    // Silver/White car
    vehicleCategory: 'Sedan',
    packageName: 'Basic',
    services: [INITIAL_SERVICES[0]],
    subtotal: 15.00,
    gstRate: 9.0,
    gstAmount: 1.35,
    totalAmount: 16.35,
    paymentStatus: 'PENDING',
    status: 'IN_QUEUE',
    waitTime: '15 min',
    createdAt: '10:22 AM',
    customerMobile: '9555 1234'
  },
  {
    id: 'ord_1049',
    orderNumber: '1049',
    customerName: 'Alex Wong',
    initials: 'AW',
    avatarColor: '#EF4444', // Red
    vehiclePlate: 'SML 1234 K',
    carColor: '#EF4444',    // Red car
    vehicleCategory: 'SUV',
    packageName: 'Premium',
    services: [INITIAL_SERVICES[0], INITIAL_SERVICES[1], INITIAL_SERVICES[2]],
    subtotal: 37.00,
    gstRate: 9.0,
    gstAmount: 3.33,
    totalAmount: 40.33,
    paymentStatus: 'PAID',
    status: 'WAITING_ASSIGN',
    waitTime: '10 min',
    createdAt: '10:24 AM',
    customerMobile: '9123 4567'
  }
];
