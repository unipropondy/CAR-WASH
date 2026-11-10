import { 
  VehicleOption, 
  ServiceCategory, 
  ServicePackage 
} from '../types/kiosk.types';

// Page 2: Exactly 2 Columns x 5 Rows Initially Visible (10 Vehicles)
export const VEHICLE_OPTIONS: VehicleOption[] = [
  { id: 'v_sedan', name: 'Sedan', nameZh: '标准轿车', icon: '🚗', description: '4-door saloon & compact sedans' },
  { id: 'v_suv', name: 'SUV', nameZh: '城市越野车 (SUV)', icon: '🚙', description: 'Compact crossovers & 5-seater SUVs' },
  { id: 'v_mpv', name: 'MPV', nameZh: '多用途商务车 (MPV)', icon: '🚐', description: 'Standard 7-seater family MPVs' },
  { id: 'v_big_mpv', name: 'Big MPV', nameZh: '大型豪华商务车', icon: '🚌', description: 'Alphard, Vellfire & Full-size vans' },
  { id: 'v_hatchback', name: 'Hatchback', nameZh: '紧凑型两厢车', icon: '🚘', description: 'Compact 5-door city hatchbacks' },
  { id: 'v_coupe', name: 'Coupe', nameZh: '双门轿跑车', icon: '🏎️', description: '2-door performance & sports coupes' },
  { id: 'v_commercial_van', name: 'Commercial Van', nameZh: '商用货运面包车', icon: '🚚', description: 'Delivery vans & cargo utility vehicles' },
  { id: 'v_pickup_truck', name: 'Pickup Truck', nameZh: '皮卡皮卡车', icon: '🛻', description: 'Dual-cab & flatbed utility trucks' },
  { id: 'v_luxury_saloon', name: 'Luxury Saloon', nameZh: '豪华行政旗舰轿车', icon: '👑', description: 'S-Class, 7-Series, A8 long wheelbase' },
  { id: 'v_sports_car', name: 'Sports Car', nameZh: '超级跑车', icon: '🏁', description: 'Low-clearance exotic supercars' },
];

// Page 3: Three Main Service Categories
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'CAR_WASH',
    title: 'CAR WASH',
    titleZh: '专业精细洗车',
    subtitle: 'Exterior Foam, High Pressure Rinse & Hand Dry',
    icon: '🚿',
    description: 'High-density snow foam shampoo, wheel face degreasing, clean soft chamois hand dry.',
  },
  {
    id: 'POLISHING',
    title: 'POLISHING',
    titleZh: '车漆抛光美研',
    subtitle: 'Paint Correction, Scratch & Swirl Removal',
    icon: '✨',
    description: 'Machine compound correction, oxidation removal, mirror gloss enhancement & paint seal.',
  },
  {
    id: 'ALCARE_CARE',
    title: 'ALCARE CARE',
    titleZh: 'ALCARE 车厢深层养护',
    subtitle: 'Interior Sanitation & Antibacterial Disinfection',
    icon: '🛡️',
    description: 'Hospital-grade cabin sanitizing fog, leather feeding, deep dust extraction & AC vent purification.',
  },
];

// Packages for each Category
export const SERVICE_PACKAGES: Record<string, ServicePackage[]> = {
  CAR_WASH: [
    {
      id: 'cw_pkg_express',
      categoryId: 'CAR_WASH',
      name: 'Express Foam Wash',
      nameZh: '极速雪沫洗车',
      price: 15.00,
      description: 'Quick exterior high-pressure rinse, active snow foam, and soft microfiber chamois dry.',
      features: ['Snow Foam Shampoo', 'Pressure Wheel Rinse', 'Microfiber Hand Dry'],
    },
    {
      id: 'cw_pkg_deluxe',
      categoryId: 'CAR_WASH',
      name: 'Deluxe Wash & Vacuum',
      nameZh: '豪华洗车 + 车厢吸尘',
      price: 22.00,
      description: 'Complete exterior wash plus interior floor mats, boot, and cabin crevice vacuuming.',
      features: ['Snow Foam Wash', 'Full Interior Vacuum', 'Tire Dressing Gloss', 'Dashboard Wipe'],
    },
    {
      id: 'cw_pkg_premium',
      categoryId: 'CAR_WASH',
      name: 'Premium Hydrophobic Wash & Wax',
      nameZh: '尊贵水性镀膜水蜡精洗',
      price: 30.00,
      description: 'Full wash, vacuum, polymer spray seal wax coating for water beading and deep gloss.',
      features: ['Full Deluxe Service', 'Polymer Spray Wax', 'Windscreen Hydrophobic Coat', 'Engine Hood Wipe'],
    },
  ],

  POLISHING: [
    {
      id: 'pol_pkg_single',
      categoryId: 'POLISHING',
      name: 'Single Stage Gloss Enhancement',
      nameZh: '单步漆面增亮光泽还原',
      price: 68.00,
      description: 'Removes light surface hazing, restores clear coat clarity, and boosts wet reflective shine.',
      features: ['Clay Bar Decontamination', 'Single Stage Rotary Polish', 'Carnauba Sealant Finish'],
    },
    {
      id: 'pol_pkg_multi',
      categoryId: 'POLISHING',
      name: 'Multi-Stage Paint Correction',
      nameZh: '多阶深度划痕太阳纹矫正',
      price: 128.00,
      description: 'Heavy cutting compound and micro-fine finishing polish to eliminate 85%+ of paint defects.',
      features: ['Full Paint Defect Removal', 'Swirl & Scratch Elimination', 'Mirror Finish Refining'],
    },
    {
      id: 'pol_pkg_ceramic',
      categoryId: 'POLISHING',
      name: 'Ceramic Coating Shield (1 Year)',
      nameZh: '9H 纳米陶瓷结晶镀晶 (一年质保)',
      price: 238.00,
      description: 'Professional 9H ceramic matrix bond providing long-term UV resistance, hydrophobicity and scratch guard.',
      features: ['2-Stage Paint Prep', '9H Nano Ceramic Layer', 'Hydrophobic Rain Repellent', '1-Year Warranty Card'],
    },
  ],

  ALCARE_CARE: [
    {
      id: 'alc_pkg_fog',
      categoryId: 'ALCARE_CARE',
      name: 'Alcare Interior Antibacterial Fogging',
      nameZh: 'Alcare 医用级车厢杀菌烟熏雾化',
      price: 28.00,
      description: 'Ultrasound dry fogging penetrates air conditioning ducts and fabrics, eliminating 99.9% of bacteria.',
      features: ['Hospital-Grade Sanitizer', 'AC System Deodorizing', 'Kills Odor & Mold Spores'],
    },
    {
      id: 'alc_pkg_leather',
      categoryId: 'ALCARE_CARE',
      name: 'Alcare Leather Deep Conditioning',
      nameZh: 'Alcare 顶级真皮深层滋养修复',
      price: 48.00,
      description: 'pH-balanced gentle cleaner followed by essential nutrient balm to restore suppleness and prevent cracking.',
      features: ['Deep Pore Dirt Extraction', 'Essential Oil Balm Massage', 'Matte OEM Leather Finish'],
    },
    {
      id: 'alc_pkg_full',
      categoryId: 'ALCARE_CARE',
      name: 'Alcare Full Cabin Sanitation & AC Purify',
      nameZh: 'Alcare 全车厢极致净化深度护理',
      price: 78.00,
      description: 'Comprehensive steam disinfection, carpet extraction, leather feeding, and complete HVAC sanitization.',
      features: ['High-Temp Steam Clean', 'Full Antibacterial Fogging', 'Leather & Plastic Dressing', 'Free Air Freshener'],
    },
  ],
};
