import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  StyleSheet, 
  Modal, 
  ScrollView 
} from 'react-native';
import { RED_BAY_COLORS } from '../../../theme/colors';
import { makeShadow } from '../../../theme/shadows';
import { 
  VehicleCategoryConfig, 
  ServiceItem, 
  PosOrder 
} from '../../../types/pos.types';

interface NewOrderModalProps {
  visible: boolean;
  onClose: () => void;
  categories: VehicleCategoryConfig[];
  services: ServiceItem[];
  onCreateOrder: (order: Partial<PosOrder>) => void;
  currentLanguage: 'EN' | 'ZH';
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  visible,
  onClose,
  categories,
  services,
  onCreateOrder,
  currentLanguage,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategoryConfig>(categories[0]);
  const [plateNumber, setPlateNumber] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([services[0]?.id || '']);
  const [customerMobile, setCustomerMobile] = useState('');

  const toggleService = (srvId: string) => {
    // Car wash is primary base service, but toggling add-ons
    if (srvId === services[0]?.id) return; // Keep base wash selected
    if (selectedServiceIds.includes(srvId)) {
      setSelectedServiceIds(selectedServiceIds.filter((id) => id !== srvId));
    } else {
      setSelectedServiceIds([...selectedServiceIds, srvId]);
    }
  };

  // Pricing Calculation with Configurable 9% GST
  const basePrice = selectedCategory?.basePrice || 15.00;
  const addOnsTotal = services
    .filter((s) => selectedServiceIds.includes(s.id) && s.id !== services[0]?.id)
    .reduce((sum, s) => sum + s.price, 0);

  const subtotal = basePrice + addOnsTotal;
  const gstRate = 9.0;
  const gstAmount = Number(((subtotal * gstRate) / 100).toFixed(2));
  const totalAmount = Number((subtotal + gstAmount).toFixed(2));

  const handleConfirm = () => {
    if (!plateNumber.trim()) {
      alert(currentLanguage === 'EN' ? 'Please enter a vehicle license plate' : '请输入车牌号码');
      return;
    }

    const chosenServices = services.filter((s) => selectedServiceIds.includes(s.id));

    onCreateOrder({
      customerName: `Customer (${plateNumber.toUpperCase().trim()})`,
      vehiclePlate: plateNumber.toUpperCase().trim(),
      vehicleCategory: selectedCategory.name,
      packageName: `${selectedCategory.name} Wash`,
      services: chosenServices,
      subtotal,
      gstRate,
      gstAmount,
      totalAmount,
      customerMobile: customerMobile.trim() || undefined,
      status: 'WAITING_ASSIGN',
      paymentStatus: 'PAID',
    });

    // Reset fields
    setPlateNumber('');
    setCustomerMobile('');
    setSelectedServiceIds([services[0]?.id || '']);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <View style={styles.redPuck} />
              <View>
                <Text style={styles.modalTitle}>
                  {currentLanguage === 'EN' ? 'NEW WASH ORDER' : '新建洗车订单'}
                </Text>
                <Text style={styles.modalSub}>RED BAY CAR WASH • SINGAPORE</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Step 1: Vehicle Category Selection */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>
                1. {currentLanguage === 'EN' ? 'SELECT VEHICLE CATEGORY' : '选择车型规格'}
              </Text>
              <View style={styles.categoryGrid}>
                {categories.map((cat) => {
                  const isSelected = selectedCategory.id === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                      onPress={() => setSelectedCategory(cat)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.categoryHeader}>
                        <Text style={[styles.categoryName, isSelected && styles.categoryNameSelected]}>
                          {currentLanguage === 'EN' ? cat.name : cat.nameZh}
                        </Text>
                        <View style={[styles.priceTag, isSelected && styles.priceTagSelected]}>
                          <Text style={[styles.priceTagText, isSelected && styles.priceTagTextSelected]}>
                            $ {cat.basePrice.toFixed(0)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.categoryDesc}>{cat.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 2: License Plate & Mobile */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>
                2. {currentLanguage === 'EN' ? 'VEHICLE REGISTRATION NUMBER (SINGAPORE)' : '新加坡车牌号码'}
              </Text>
              <View style={styles.inputRow}>
                <View style={styles.plateInputContainer}>
                  <Text style={styles.platePrefixLabel}>SG PLATE</Text>
                  <TextInput
                    style={styles.plateInput}
                    placeholder="e.g. SBA 1234 A"
                    placeholderTextColor="#A0AEC0"
                    value={plateNumber}
                    onChangeText={setPlateNumber}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.mobileInputContainer}>
                  <Text style={styles.platePrefixLabel}>CUSTOMER MOBILE (OPTIONAL)</Text>
                  <TextInput
                    style={styles.mobileInput}
                    placeholder="e.g. 9123 4567"
                    placeholderTextColor="#A0AEC0"
                    value={customerMobile}
                    onChangeText={setCustomerMobile}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>

            {/* Step 3: Service Selection */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>
                3. {currentLanguage === 'EN' ? 'SELECT SERVICES & ADD-ONS' : '选择洗车与增值服务'}
              </Text>
              <View style={styles.servicesList}>
                {services.map((srv) => {
                  const isSelected = selectedServiceIds.includes(srv.id);
                  const isBase = srv.id === services[0]?.id;
                  return (
                    <TouchableOpacity
                      key={srv.id}
                      style={[styles.serviceRow, isSelected && styles.serviceRowSelected]}
                      onPress={() => toggleService(srv.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.checkboxArea}>
                        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <View>
                          <View style={styles.srvTitleRow}>
                            <Text style={styles.serviceName}>
                              {currentLanguage === 'EN' ? srv.name : srv.nameZh}
                            </Text>
                            {isBase && (
                              <View style={styles.baseIncludedPill}>
                                <Text style={styles.baseIncludedText}>INCLUDED IN BASE</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.serviceDesc}>{srv.description}</Text>
                        </View>
                      </View>

                      <Text style={styles.servicePrice}>
                        {isBase ? `Included` : `+ $ ${srv.price.toFixed(2)}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer with Subtotal, GST, and Action */}
          <View style={styles.modalFooter}>
            <View style={styles.pricingSummaryCol}>
              <View style={styles.priceRowItem}>
                <Text style={styles.priceSummaryLabel}>Subtotal:</Text>
                <Text style={styles.priceSummaryValue}>$ {subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.priceRowItem}>
                <Text style={styles.priceSummaryLabel}>Singapore GST (9%):</Text>
                <Text style={styles.priceSummaryValue}>$ {gstAmount.toFixed(2)}</Text>
              </View>
              <View style={[styles.priceRowItem, styles.totalRow]}>
                <Text style={styles.totalLabel}>TOTAL PAYABLE:</Text>
                <Text style={styles.totalValue}>$ {totalAmount.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.modalActionButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>
                  {currentLanguage === 'EN' ? 'Cancel' : '取消'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                <Text style={styles.confirmBtnText}>
                  {currentLanguage === 'EN' ? 'CREATE ORDER & QUEUE' : '生成订单并加入队列'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 8, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '85%',
    maxWidth: 820,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...makeShadow('#000000', { width: 0, height: 10 }, 0.3, 20, 10),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: RED_BAY_COLORS.secondary,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 3,
    borderBottomColor: RED_BAY_COLORS.primary,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  redPuck: {
    width: 6,
    height: 32,
    backgroundColor: RED_BAY_COLORS.primary,
    borderRadius: 3,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  modalSub: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1F1F23',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#A1A1AA',
    fontSize: 16,
    fontWeight: '800',
  },
  scrollBody: {
    padding: 24,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#080808',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  categoryCardSelected: {
    borderColor: RED_BAY_COLORS.primary,
    backgroundColor: '#FFF1F2',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#080808',
  },
  categoryNameSelected: {
    color: RED_BAY_COLORS.primary,
  },
  priceTag: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priceTagSelected: {
    backgroundColor: RED_BAY_COLORS.primary,
  },
  priceTagText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#080808',
  },
  priceTagTextSelected: {
    color: '#FFFFFF',
  },
  categoryDesc: {
    fontSize: 11,
    color: '#64748B',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 16,
  },
  plateInputContainer: {
    flex: 1,
  },
  mobileInputContainer: {
    flex: 1,
  },
  platePrefixLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  plateInput: {
    backgroundColor: '#080808',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: RED_BAY_COLORS.primary,
  },
  mobileInput: {
    backgroundColor: '#F8FAFC',
    color: '#080808',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  servicesList: {
    gap: 10,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceRowSelected: {
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  checkboxArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: RED_BAY_COLORS.primary,
    borderColor: RED_BAY_COLORS.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  srvTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#080808',
  },
  baseIncludedPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  baseIncludedText: {
    color: '#15803D',
    fontSize: 9,
    fontWeight: '800',
  },
  serviceDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  servicePrice: {
    fontSize: 13,
    fontWeight: '900',
    color: '#080808',
  },
  modalFooter: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingSummaryCol: {
    gap: 4,
  },
  priceRowItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  priceSummaryLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  priceSummaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#080808',
  },
  totalRow: {
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#080808',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: RED_BAY_COLORS.primary,
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtn: {
    backgroundColor: RED_BAY_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    ...makeShadow(RED_BAY_COLORS.primary, { width: 0, height: 4 }, 0.3, 8, 4),
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

