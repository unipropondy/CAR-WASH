import { KioskLanguage } from '../store/kioskLanguageStore';

export interface KioskStrings {
  driveInShineOut: string;
  selectAccountPrompt: string;
  customerTitle: string;
  customerSubtitle: string;
  customerDesc: string;
  customerBtn: string;
  dealerTitle: string;
  dealerSubtitle: string;
  dealerDesc: string;
  dealerBtn: string;
  staffPos: string;
  addressFooter: string;
  back: string;
  continue: string;
  selectVehicleTitle: string;
  selectServiceTitle: string;
  categoryPromptSubtitle: string;
  viewPackages: string;
  backToVehicles: string;
  changeCategory: string;
  enterDetailsTitle: string;
  paymentTitle: string;
}

export const KIOSK_TRANSLATIONS: Record<KioskLanguage, KioskStrings> = {
  EN: {
    driveInShineOut: 'DRIVE IN. SHINE OUT.',
    selectAccountPrompt: 'Please select your account type to begin:',
    customerTitle: 'CUSTOMER',
    customerSubtitle: 'Walk-in & Retail Services',
    customerDesc: 'Walk-in car wash, detailing, wax & antibacterial fogging services.',
    customerBtn: 'Select Customer ›',
    dealerTitle: 'DEALER',
    dealerSubtitle: 'Commercial & Fleet Clients',
    dealerDesc: 'Commercial automotive fleet, showroom prep & verified dealer accounts.',
    dealerBtn: 'Select Dealer ›',
    staffPos: 'Staff POS',
    addressFooter: '48 Toh Guan Road East, Singapore 608586 • #01-121 (Centre Lane) • Helpline: 9027 7786',
    back: 'Back',
    continue: 'Continue',
    selectVehicleTitle: 'Select Your Vehicle Type',
    selectServiceTitle: 'Select a Service Category',
    categoryPromptSubtitle: 'Choose between exterior wash, paint polishing, or Alcare interior sanitization.',
    viewPackages: 'View Packages ›',
    backToVehicles: 'Back to Vehicles',
    changeCategory: 'Change Category',
    enterDetailsTitle: 'Enter Your Details',
    paymentTitle: 'Payment & Confirmation',
  },
  ZH: {
    driveInShineOut: '洗车进出 • 焕然一新',
    selectAccountPrompt: '请选择您的账户类型以开始：',
    customerTitle: '个人车主',
    customerSubtitle: '个人车主自选服务',
    customerDesc: '直接到店洗车、精细护理、纳米打蜡及抗菌雾化服务。',
    customerBtn: '选择个人车主 ›',
    dealerTitle: '车行客户',
    dealerSubtitle: '车行及车队商用客户',
    dealerDesc: '商用车队、展厅车准备及已认证的车行月结客户。',
    dealerBtn: '选择车行客户 ›',
    staffPos: '员工 POS',
    addressFooter: '48 Toh Guan Road East, Singapore 608586 • #01-121 • 服务热线: 9027 7786',
    back: '返回',
    continue: '继续',
    selectVehicleTitle: '选择您的车型',
    selectServiceTitle: '选择服务类别',
    categoryPromptSubtitle: '选择外部洗车、车漆抛光或 Alcare 车厢内饰深层养护。',
    viewPackages: '查看套餐 ›',
    backToVehicles: '返回车辆选择',
    changeCategory: '更改类别',
    enterDetailsTitle: '输入您的资料',
    paymentTitle: '付款与确认',
  },
  MS: {
    driveInShineOut: 'PANDU MASUK. KILAT KELUAR.',
    selectAccountPrompt: 'Sila pilih jenis akaun anda untuk bermula:',
    customerTitle: 'PELANGGAN',
    customerSubtitle: 'Perkhidmatan Runcit & Terus',
    customerDesc: 'Cuci kereta walk-in, perincian, lilin & pengasapan antibakteria.',
    customerBtn: 'Pilih Pelanggan ›',
    dealerTitle: 'PENIAGA / FLEET',
    dealerSubtitle: 'Pelanggan Komersial & Armada',
    dealerDesc: 'Armada automotif komersial, persiapan bilik pameran & akaun peniaga.',
    dealerBtn: 'Pilih Peniaga ›',
    staffPos: 'Staf POS',
    addressFooter: '48 Toh Guan Road East, Singapore 608586 • #01-121 • Talian Bantuan: 9027 7786',
    back: 'Kembali',
    continue: 'Teruskan',
    selectVehicleTitle: 'Pilih Jenis Kenderaan',
    selectServiceTitle: 'Pilih Kategori Perkhidmatan',
    categoryPromptSubtitle: 'Pilih antara cucian luaran, gilapan cat, atau sanitasi dalaman Alcare.',
    viewPackages: 'Lihat Pakej ›',
    backToVehicles: 'Kembali ke Kenderaan',
    changeCategory: 'Tukar Kategori',
    enterDetailsTitle: 'Masukkan Butiran Anda',
    paymentTitle: 'Pembayaran & Pengesahan',
  },
  TA: {
    driveInShineOut: 'உள்ளே வாருங்கள். மின்னும் பொலிவுடன் செல்லுங்கள்.',
    selectAccountPrompt: 'தொடங்குவதற்கு உங்கள் கணக்கு வகையைத் தேர்ந்தெடுக்கவும்:',
    customerTitle: 'வாடிக்கையாளர்',
    customerSubtitle: 'தனிப்பட்ட வாகன சுய சேவை',
    customerDesc: 'நேரடி கார் கழுவுதல், பாலிஷ், மெழுகு மற்றும் கிருமிநாசினி சேவைகள்.',
    customerBtn: 'வாடிக்கையாளரைத் தேர்வு செய்க ›',
    dealerTitle: 'டீலர் / வணிகம்',
    dealerSubtitle: 'வணிக மற்றும் வாகனக் குழு கணக்குகள்',
    dealerDesc: 'வணிக ரீதியான வாகனங்கள், ஷோரூம் தயாரிப்பு மற்றும் டீலர் கணக்குகள்.',
    dealerBtn: 'டீலரைத் தேர்வு செய்க ›',
    staffPos: 'பணியாளர் POS',
    addressFooter: '48 Toh Guan Road East, Singapore 608586 • #01-121 • உதவி எண்: 9027 7786',
    back: 'பின்செல்க',
    continue: 'தொடர்க',
    selectVehicleTitle: 'உங்கள் வாகன வகையைத் தேர்வுசெய்க',
    selectServiceTitle: 'சேவை வகையைத் தேர்ந்தெடுக்கவும்',
    categoryPromptSubtitle: 'வெளிப்புற கழுவுதல், பெயிண்ட் பாலிஷ் அல்லது உட்புற கிருமிநாசினி இடையே தேர்வு செய்யவும்.',
    viewPackages: 'திட்டங்களைக் காண்க ›',
    backToVehicles: 'வாகனங்களுக்குத் திரும்பு',
    changeCategory: 'வகையை மாற்றவும்',
    enterDetailsTitle: 'உங்கள் விவரங்களை உள்ளிடவும்',
    paymentTitle: 'பணம் செலுத்துதல் & உறுதிப்படுத்தல்',
  },
};
