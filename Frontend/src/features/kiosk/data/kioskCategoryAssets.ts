export interface CategoryVisualMeta {
  key: string;
  badge: string;
  badgeIcon: any;
  badgeBg: string;
  badgeColor: string;
  accentColor: string;
  cardBorderColor: string;
  btnColor: string;
  iconName: any;
  image: any;
  defaultSubtitle: string;
  bullets: string[];
}

export const CATEGORY_VISUAL_CONFIG: Record<string, CategoryVisualMeta> = {
  wash: {
    key: 'wash',
    badge: 'MOST POPULAR',
    badgeIcon: 'flash',
    badgeBg: '#E60012',
    badgeColor: '#FFFFFF',
    accentColor: '#E60012',
    cardBorderColor: '#FCA5A5',
    btnColor: '#E60012',
    iconName: 'car-sport',
    image: require('../../../../assets/images/categories/car_wash.jpg'),
    defaultSubtitle: 'Exterior wash, detailing & cleaning',
    bullets: [
      'High-Density Foam Wash',
      'Wheel & Rim Degreasing',
      'Clean & Dry Finish',
    ],
  },
  polish: {
    key: 'polish',
    badge: 'PAINT RESTORATION & GLOSS',
    badgeIcon: 'sparkles',
    badgeBg: '#D97706',
    badgeColor: '#FFFFFF',
    accentColor: '#D97706',
    cardBorderColor: '#FCD34D',
    btnColor: '#E17000',
    iconName: 'sparkles',
    image: require('../../../../assets/images/categories/polishing.jpg'),
    defaultSubtitle: 'Restore shine & protect your paint',
    bullets: [
      'Paint Polishing & Gloss',
      'Minor Scratch Removal',
      'Long-Lasting Protection',
    ],
  },
  alcare: {
    key: 'alcare',
    badge: 'CABIN SANITIZATION & CARE',
    badgeIcon: 'shield-checkmark',
    badgeBg: '#059669',
    badgeColor: '#FFFFFF',
    accentColor: '#059669',
    cardBorderColor: '#6EE7B7',
    btnColor: '#059669',
    iconName: 'shield-checkmark',
    image: require('../../../../assets/images/categories/alcare.jpg'),
    defaultSubtitle: 'Interior cleaning, sanitization & special care',
    bullets: [
      'Cabin Sanitization',
      'Interior Deep Cleaning',
      'Odour Removal & Freshness',
    ],
  },
};

export function getCategoryVisualMeta(title: string): CategoryVisualMeta {
  const t = (title || '').toLowerCase();
  if (t.includes('polish') || t.includes('paint')) {
    return CATEGORY_VISUAL_CONFIG.polish;
  }
  if (t.includes('alcare') || t.includes('interior') || t.includes('sanitiz')) {
    return CATEGORY_VISUAL_CONFIG.alcare;
  }
  return CATEGORY_VISUAL_CONFIG.wash;
}

