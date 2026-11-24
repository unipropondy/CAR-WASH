import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ScreenNameBadge } from '../../../components/common/ScreenNameBadge';
import { resolveApiUrl } from '../../../services/apiConfig';
import {
  KioskPromotion,
  fetchAllPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  uploadPromotionPoster,
} from '../../../services/promotionApi';

const C = {
  bg:         '#080808',
  surface:    '#111111',
  surfaceAlt: '#151515',
  card:       'rgba(21,21,21,0.85)',
  cardBorder: 'rgba(255,26,26,0.18)',
  accent:     '#FF1A1A',
  accentDark: '#8B0000',
  accentGlow: 'rgba(255,26,26,0.35)',
  white:      '#FFFFFF',
  textSec:    '#BDBDBD',
  textMuted:  'rgba(255,255,255,0.4)',
  divider:    'rgba(255,255,255,0.08)',
  green:      '#10B981',
  yellow:     '#F59E0B',
  red:        '#EF4444',
  blue:       '#3B82F6',
};

const getTodayString = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getFutureDateString = (daysAhead: number = 30): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface OffersPromotionsViewProps {
  onShowAlert?: (title: string, message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onConfirm?: (title: string, message: string, onYes: () => void) => void;
}

export const OffersPromotionsView: React.FC<OffersPromotionsViewProps> = ({
  onShowAlert,
  onConfirm,
}) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isMobile = width < 680;

  const [promotions, setPromotions] = useState<KioskPromotion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State for Add / Edit
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingPromo, setEditingPromo] = useState<KioskPromotion | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formStartDate, setFormStartDate] = useState<string>(getTodayString());
  const [formEndDate, setFormEndDate] = useState<string>(getFutureDateString(30));
  const [formDisplayOrder, setFormDisplayOrder] = useState<string>('1');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formImagePath, setFormImagePath] = useState<string>('');
  const [formPreviewUri, setFormPreviewUri] = useState<string>('');
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Image preview modal (full view)
  const [viewImageModal, setViewImageModal] = useState<string | null>(null);

  // Load promotions list from backend
  const loadPromotions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchAllPromotions();
      setPromotions(data);
    } catch (err: any) {
      console.error('[OffersPromotionsView] loadPromotions error:', err);
      onShowAlert?.('Fetch Failed', err?.message || 'Could not retrieve promotions list.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onShowAlert]);

  useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingPromo(null);
    setFormName('');
    setFormDesc('');
    setFormStartDate(getTodayString());
    setFormEndDate(getFutureDateString(30));
    setFormDisplayOrder(String(promotions.length + 1));
    setFormIsActive(true);
    setFormImagePath('');
    setFormPreviewUri('');
    setSelectedFileObj(null);
    setFormError('');
    setModalVisible(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (promo: KioskPromotion) => {
    setEditingPromo(promo);
    setFormName(promo.promotionName);
    setFormDesc(promo.description || '');
    setFormStartDate(promo.startDate || getTodayString());
    setFormEndDate(promo.endDate || getFutureDateString(30));
    setFormDisplayOrder(String(promo.displayOrder || 1));
    setFormIsActive(promo.isActive);
    setFormImagePath(promo.imagePath);
    setFormPreviewUri(resolveApiUrl(promo.imagePath));
    setSelectedFileObj(null);
    setFormError('');
    setModalVisible(true);
  };

  // Handle Image Selection (Web + Native Expo)
  const handlePickImage = async () => {
    setFormError('');

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/jpg,image/png,image/webp';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type.toLowerCase())) {
          setFormError('Please select a JPG, JPEG, PNG, or WEBP image.');
          return;
        }

        if (file.size > 20 * 1024 * 1024) {
          setFormError('Image size exceeds 20MB limit. Please select a smaller poster.');
          return;
        }

        setSelectedFileObj(file);

        // Instant local preview
        const reader = new FileReader();
        reader.onload = (uploadEvent: any) => {
          const dataUrl = uploadEvent.target?.result as string;
          setFormPreviewUri(dataUrl);
        };
        reader.readAsDataURL(file);
      };
      input.click();
    } else {
      // Native Expo Image Picker
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.9,
          base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const uri = asset.uri;
          setFormPreviewUri(uri);

          if (asset.base64) {
            const mime = asset.type === 'image' ? 'image/jpeg' : 'image/png';
            const dataUrl = `data:${mime};base64,${asset.base64}`;
            setFormPreviewUri(dataUrl);
            setSelectedFileObj(null);
            // Save base64 string directly for upload
            (asset as any)._base64Data = dataUrl;
          }
        }
      } catch (pickerErr: any) {
        console.warn('Image picker error:', pickerErr);
        setFormError(pickerErr.message || 'Failed to open image picker.');
      }
    }
  };

  // Save (Create or Update)
  const handleSavePromotion = async () => {
    setFormError('');

    if (!formName.trim()) {
      setFormError('Please enter a Promotion Name.');
      return;
    }

    if (!formStartDate || !formEndDate) {
      setFormError('Please select both Start Date and End Date.');
      return;
    }

    if (new Date(formStartDate) > new Date(formEndDate)) {
      setFormError('Start Date cannot be after End Date.');
      return;
    }

    let finalImagePath = formImagePath;

    // Check if new image was picked and needs upload
    if (selectedFileObj) {
      try {
        setIsUploading(true);
        const uploadRes = await uploadPromotionPoster(selectedFileObj, selectedFileObj.name);
        finalImagePath = uploadRes.imagePath;
      } catch (uploadErr: any) {
        setIsUploading(false);
        setFormError(`Image upload failed: ${uploadErr.message}`);
        return;
      }
    } else if (formPreviewUri && formPreviewUri.startsWith('data:')) {
      try {
        setIsUploading(true);
        const uploadRes = await uploadPromotionPoster(formPreviewUri, 'poster.png');
        finalImagePath = uploadRes.imagePath;
      } catch (uploadErr: any) {
        setIsUploading(false);
        setFormError(`Image upload failed: ${uploadErr.message}`);
        return;
      }
    }

    if (!finalImagePath || !finalImagePath.trim()) {
      setFormError('Please upload a promotional poster image (JPG, JPEG, PNG, WEBP).');
      return;
    }

    try {
      setIsSaving(true);
      const orderNum = parseInt(formDisplayOrder, 10) || 1;

      if (editingPromo) {
        await updatePromotion(editingPromo.promotionId, {
          promotionName: formName.trim(),
          description: formDesc.trim(),
          imagePath: finalImagePath,
          startDate: formStartDate,
          endDate: formEndDate,
          displayOrder: orderNum,
          isActive: formIsActive,
        });
        onShowAlert?.('Success', `Promotion "${formName}" updated successfully.`, 'success');
      } else {
        await createPromotion({
          promotionName: formName.trim(),
          description: formDesc.trim(),
          imagePath: finalImagePath,
          startDate: formStartDate,
          endDate: formEndDate,
          displayOrder: orderNum,
          isActive: formIsActive,
        });
        onShowAlert?.('Success', `Promotion "${formName}" created successfully.`, 'success');
      }

      setModalVisible(false);
      loadPromotions(true);
    } catch (err: any) {
      console.error('[OffersPromotionsView] Save error:', err);
      setFormError(err.message || 'Failed to save promotion.');
    } finally {
      setIsUploading(false);
      setIsSaving(false);
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (promo: KioskPromotion) => {
    try {
      const nextActive = !promo.isActive;
      await updatePromotion(promo.promotionId, { isActive: nextActive });
      setPromotions((prev) =>
        prev.map((p) => (p.promotionId === promo.promotionId ? { ...p, isActive: nextActive } : p))
      );
    } catch (err: any) {
      console.error('Toggle active error:', err);
      onShowAlert?.('Error', err.message || 'Failed to update promotion status.', 'error');
    }
  };

  // Delete Confirmation
  const handleDeletePromotion = (promo: KioskPromotion) => {
    const doDelete = async () => {
      try {
        await deletePromotion(promo.promotionId);
        onShowAlert?.('Deleted', `Promotion "${promo.promotionName}" removed.`, 'success');
        setPromotions((prev) => prev.filter((p) => p.promotionId !== promo.promotionId));
      } catch (err: any) {
        console.error('Delete promo error:', err);
        onShowAlert?.('Delete Failed', err.message || 'Could not delete promotion.', 'error');
      }
    };

    if (onConfirm) {
      onConfirm(
        'Delete Promotion',
        `Are you sure you want to delete "${promo.promotionName}"? This action cannot be undone.`,
        doDelete
      );
    } else {
      doDelete();
    }
  };

  // Filtered & Sorted Promotions
  const filteredPromotions = useMemo(() => {
    return promotions.filter((p) => {
      if (statusFilter === 'ACTIVE' && !p.isActive) return false;
      if (statusFilter === 'INACTIVE' && p.isActive) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = p.promotionName.toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        if (!nameMatch && !descMatch) return false;
      }
      return true;
    });
  }, [promotions, statusFilter, searchQuery]);

  // Helper to determine status badge
  const getPromoTimingStatus = (promo: KioskPromotion) => {
    if (!promo.isActive) {
      return { label: 'Disabled', color: C.red, bg: 'rgba(239,68,68,0.15)' };
    }
    const today = getTodayString();
    if (promo.startDate > today) {
      return { label: 'Upcoming', color: C.yellow, bg: 'rgba(245,158,11,0.15)' };
    }
    if (promo.endDate < today) {
      return { label: 'Expired', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' };
    }
    return { label: 'Live on Kiosk', color: C.green, bg: 'rgba(16,185,129,0.15)' };
  };

  return (
    <View style={styles.container}>
      {/* Top Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconBox}>
              <Ionicons name="images" size={22} color={C.accent} />
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.headerTitle}>Offers & Promotions</Text>
                <ScreenNameBadge name="OffersPromotionsView.tsx" variant="dark" style={{ marginLeft: 8 }} />
              </View>
              <Text style={styles.headerSubtitle}>
                Manage full-screen idle promotional posters and marketing slideshows for the customer kiosk
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => loadPromotions(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <Ionicons name="refresh" size={16} color={C.white} />
            )}
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.createBtn} onPress={handleOpenCreate}>
            <Ionicons name="add-circle" size={18} color={C.white} />
            <Text style={styles.createBtnText}>New Promotion</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter and Stats Bar */}
      <View style={styles.filterBar}>
        {/* Search Input */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search promotion name or description..."
            placeholderTextColor={C.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        <View style={styles.filterPills}>
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((filter) => {
            const active = statusFilter === filter;
            const count =
              filter === 'ALL'
                ? promotions.length
                : filter === 'ACTIVE'
                ? promotions.filter((p) => p.isActive).length
                : promotions.filter((p) => !p.isActive).length;

            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setStatusFilter(filter)}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                  {filter} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Main Promotions Content Table / Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Loading promotions from SQL Server...</Text>
        </View>
      ) : filteredPromotions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="images-outline" size={48} color={C.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Promotions Found</Text>
          <Text style={styles.emptyDesc}>
            {searchQuery
              ? 'No promotions match your search query.'
              : 'Upload promotional posters to display rotating offers on the idle kiosk screen.'}
          </Text>
          <TouchableOpacity style={styles.emptyCreateBtn} onPress={handleOpenCreate}>
            <Ionicons name="add-circle" size={18} color={C.white} />
            <Text style={styles.createBtnText}>Upload First Promotion</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.tableScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.promotionsList}>
            {filteredPromotions.map((promo) => {
              const timing = getPromoTimingStatus(promo);
              const resolvedImg = resolveApiUrl(promo.imagePath);

              return (
                <View key={promo.promotionId} style={styles.promoCard}>
                  {/* Poster Thumbnail & Preview Trigger */}
                  <TouchableOpacity
                    style={styles.thumbnailContainer}
                    onPress={() => setViewImageModal(resolvedImg)}
                    activeOpacity={0.8}
                  >
                    {resolvedImg ? (
                      <Image
                        source={{ uri: resolvedImg }}
                        style={styles.thumbnailImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.thumbnailFallback}>
                        <Ionicons name="image-outline" size={32} color={C.textMuted} />
                      </View>
                    )}
                    <View style={styles.thumbnailZoomBadge}>
                      <Ionicons name="scan-outline" size={13} color={C.white} />
                      <Text style={styles.thumbnailZoomText}>Preview</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Promotion Info */}
                  <View style={styles.promoInfo}>
                    <View style={styles.promoHeaderRow}>
                      <View style={styles.promoTitleGroup}>
                        <Text style={styles.promoName}>{promo.promotionName}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: timing.bg }]}>
                          <View style={[styles.statusDot, { backgroundColor: timing.color }]} />
                          <Text style={[styles.statusText, { color: timing.color }]}>
                            {timing.label}
                          </Text>
                        </View>
                      </View>

                      {/* Display Order Badge */}
                      <View style={styles.orderBadge}>
                        <Ionicons name="swap-vertical" size={13} color={C.accent} />
                        <Text style={styles.orderBadgeText}>Priority #{promo.displayOrder}</Text>
                      </View>
                    </View>

                    {promo.description ? (
                      <Text style={styles.promoDescription} numberOfLines={2}>
                        {promo.description}
                      </Text>
                    ) : (
                      <Text style={[styles.promoDescription, { fontStyle: 'italic', color: C.textMuted }]}>
                        No description provided.
                      </Text>
                    )}

                    {/* Metadata Row: Dates and File */}
                    <View style={styles.promoMetaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={14} color={C.textMuted} />
                        <Text style={styles.metaText}>
                          {promo.startDate} to {promo.endDate}
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="document-text-outline" size={14} color={C.textMuted} />
                        <Text style={styles.metaText} numberOfLines={1}>
                          {promo.imagePath.split('/').pop()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Actions Column */}
                  <View style={styles.promoActions}>
                    {/* Toggle Active Button */}
                    <TouchableOpacity
                      style={[
                        styles.toggleBtn,
                        promo.isActive ? styles.toggleBtnActive : styles.toggleBtnInactive,
                      ]}
                      onPress={() => handleToggleActive(promo)}
                    >
                      <Ionicons
                        name={promo.isActive ? 'checkmark-circle' : 'close-circle'}
                        size={15}
                        color={promo.isActive ? C.green : C.red}
                      />
                      <Text
                        style={[
                          styles.toggleBtnText,
                          { color: promo.isActive ? C.green : C.red },
                        ]}
                      >
                        {promo.isActive ? 'Active' : 'Disabled'}
                      </Text>
                    </TouchableOpacity>

                    {/* Edit Button */}
                    <TouchableOpacity
                      style={styles.actionBtnEdit}
                      onPress={() => handleOpenEdit(promo)}
                    >
                      <Ionicons name="create-outline" size={15} color={C.white} />
                      <Text style={styles.actionBtnEditText}>Edit</Text>
                    </TouchableOpacity>

                    {/* Delete Button */}
                    <TouchableOpacity
                      style={styles.actionBtnDelete}
                      onPress={() => handleDeletePromotion(promo)}
                    >
                      <Ionicons name="trash-outline" size={15} color={C.red} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Add / Edit Promotion Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isSaving && setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isWide && { maxWidth: 650 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons
                    name={editingPromo ? 'create-outline' : 'add-circle-outline'}
                    size={20}
                    color={C.accent}
                  />
                </View>
                <Text style={styles.modalTitle}>
                  {editingPromo ? 'Edit Promotion' : 'Add New Promotion Poster'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => !isSaving && setModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={C.white} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalFormScroll} showsVerticalScrollIndicator={false}>
              {/* Form Validation Alert Banner */}
              {formError ? (
                <View style={styles.formErrorBanner}>
                  <Ionicons name="alert-circle" size={17} color={C.red} />
                  <Text style={styles.formErrorText}>{formError}</Text>
                </View>
              ) : null}

              {/* Poster Image Upload & Preview Section */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Promotional Poster Image <Text style={{ color: C.accent }}>*</Text>
                </Text>
                <Text style={styles.formHelpText}>
                  Supports JPG, JPEG, PNG, and WEBP formats (portrait or landscape full-screen poster).
                </Text>

                <View style={styles.uploadArea}>
                  {formPreviewUri ? (
                    <View style={styles.previewContainer}>
                      <Image
                        source={{ uri: formPreviewUri }}
                        style={styles.posterPreviewImage}
                        resizeMode="contain"
                      />
                      <View style={styles.previewControls}>
                        <TouchableOpacity
                          style={styles.changePosterBtn}
                          onPress={handlePickImage}
                          disabled={isSaving}
                        >
                          <Ionicons name="camera-outline" size={16} color={C.white} />
                          <Text style={styles.changePosterText}>Change Poster</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadDropZone}
                      onPress={handlePickImage}
                      disabled={isSaving}
                    >
                      <View style={styles.uploadIconCircle}>
                        <Ionicons name="cloud-upload-outline" size={32} color={C.accent} />
                      </View>
                      <Text style={styles.uploadDropTitle}>Click to Choose Promotional Image</Text>
                      <Text style={styles.uploadDropSubtitle}>
                        JPG, JPEG, PNG, WEBP • Max 20MB
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Promotion Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Promotion Name <Text style={{ color: C.accent }}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Lunar New Year Super Wash Deal"
                  placeholderTextColor={C.textMuted}
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="Enter promotion details, offer highlights, or customer notes..."
                  placeholderTextColor={C.textMuted}
                  value={formDesc}
                  onChangeText={setFormDesc}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Dates Row (Start Date & End Date) */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>
                    Start Date <Text style={{ color: C.accent }}>*</Text>
                  </Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      style={{
                        backgroundColor: '#1E1E1E',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        padding: '10px 12px',
                        fontSize: '14px',
                        outline: 'none',
                        colorScheme: 'dark',
                        fontFamily: 'inherit',
                      }}
                    />
                  ) : (
                    <TextInput
                      style={styles.formInput}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={C.textMuted}
                      value={formStartDate}
                      onChangeText={setFormStartDate}
                    />
                  )}
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>
                    End Date <Text style={{ color: C.accent }}>*</Text>
                  </Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      style={{
                        backgroundColor: '#1E1E1E',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        padding: '10px 12px',
                        fontSize: '14px',
                        outline: 'none',
                        colorScheme: 'dark',
                        fontFamily: 'inherit',
                      }}
                    />
                  ) : (
                    <TextInput
                      style={styles.formInput}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={C.textMuted}
                      value={formEndDate}
                      onChangeText={setFormEndDate}
                    />
                  )}
                </View>
              </View>

              {/* Display Order and Active Status Row */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Display Order / Priority</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="1"
                    placeholderTextColor={C.textMuted}
                    value={formDisplayOrder}
                    onChangeText={setFormDisplayOrder}
                    keyboardType="numeric"
                  />
                  <Text style={styles.formHelpText}>Lower numbers display earlier in kiosk slideshow.</Text>
                </View>

                <View style={[styles.formGroup, { flex: 1, justifyContent: 'center' }]}>
                  <Text style={styles.formLabel}>Status</Text>
                  <TouchableOpacity
                    style={[
                      styles.statusToggleBox,
                      formIsActive ? styles.statusToggleBoxActive : styles.statusToggleBoxInactive,
                    ]}
                    onPress={() => setFormIsActive(!formIsActive)}
                  >
                    <Ionicons
                      name={formIsActive ? 'checkmark-circle' : 'close-circle'}
                      size={20}
                      color={formIsActive ? C.green : C.red}
                    />
                    <Text
                      style={[
                        styles.statusToggleText,
                        { color: formIsActive ? C.green : C.red },
                      ]}
                    >
                      {formIsActive ? 'Enabled (Active)' : 'Disabled (Hidden)'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={isSaving || isUploading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, (isSaving || isUploading) && { opacity: 0.6 }]}
                onPress={handleSavePromotion}
                disabled={isSaving || isUploading}
              >
                {isSaving || isUploading ? (
                  <ActivityIndicator size="small" color={C.white} style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="save-outline" size={18} color={C.white} style={{ marginRight: 8 }} />
                )}
                <Text style={styles.modalSubmitText}>
                  {isUploading ? 'Uploading Image...' : isSaving ? 'Saving...' : editingPromo ? 'Update Promotion' : 'Save Promotion'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Size Image Preview Modal */}
      <Modal
        visible={Boolean(viewImageModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewImageModal(null)}
      >
        <Pressable style={styles.viewBackdrop} onPress={() => setViewImageModal(null)}>
          <View style={styles.viewImageCard}>
            <TouchableOpacity
              style={styles.viewCloseBtn}
              onPress={() => setViewImageModal(null)}
            >
              <Ionicons name="close" size={24} color={C.white} />
            </TouchableOpacity>
            {viewImageModal && (
              <Image
                source={{ uri: viewImageModal }}
                style={styles.fullPreviewImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: C.bg,
  },

  /* Header Card */
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    minWidth: 280,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,26,26,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,26,26,0.25)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: C.textSec,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  refreshBtnText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '600',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: C.accent,
  },
  createBtnText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '700',
  },

  /* Filter Bar */
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: C.white,
    fontSize: 13,
    padding: 0,
    margin: 0,
  },
  filterPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(255,26,26,0.15)',
    borderColor: C.accent,
  },
  filterPillText: {
    color: C.textSec,
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: C.white,
    fontWeight: '700',
  },

  /* Content Loading & Empty States */
  loadingContainer: {
    flex: 1,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: C.textSec,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.white,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: C.textSec,
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 9,
  },

  /* Promotions List */
  tableScroll: {
    flex: 1,
  },
  promotionsList: {
    gap: 12,
    paddingBottom: 24,
  },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexWrap: 'wrap',
    gap: 14,
  },
  thumbnailContainer: {
    width: 90,
    height: 110,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailZoomBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 3,
  },
  thumbnailZoomText: {
    fontSize: 10,
    color: C.white,
    fontWeight: '600',
  },
  promoInfo: {
    flex: 1,
    minWidth: 240,
  },
  promoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  promoTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  promoName: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  orderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,26,26,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,26,26,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  orderBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
  },
  promoDescription: {
    fontSize: 13,
    color: C.textSec,
    lineHeight: 18,
    marginBottom: 8,
  },
  promoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: C.textMuted,
  },
  promoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  toggleBtnInactive: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  actionBtnEditText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtnDelete: {
    padding: 7,
    borderRadius: 7,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },

  /* Modal Styling */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#121212',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,26,26,0.3)',
    overflow: 'hidden',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    backgroundColor: '#161616',
  },
  modalHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,26,26,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.white,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalFormScroll: {
    padding: 20,
    maxHeight: 520,
  },
  formErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  formErrorText: {
    color: C.red,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.white,
    marginBottom: 6,
  },
  formHelpText: {
    fontSize: 11,
    color: C.textMuted,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.white,
    fontSize: 14,
  },
  formTextArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },

  /* Upload Area in Form */
  uploadArea: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  uploadDropZone: {
    padding: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,26,26,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  uploadDropTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.white,
  },
  uploadDropSubtitle: {
    fontSize: 12,
    color: C.textMuted,
  },
  previewContainer: {
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#0F0F0F',
  },
  posterPreviewImage: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    backgroundColor: '#000000',
  },
  previewControls: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  changePosterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 7,
  },
  changePosterText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '600',
  },

  statusToggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusToggleBoxActive: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  statusToggleBoxInactive: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  statusToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },

  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: C.divider,
    backgroundColor: '#161616',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCancelText: {
    color: C.textSec,
    fontSize: 13,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalSubmitText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '700',
  },

  /* Full Image View */
  viewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  viewImageCard: {
    maxWidth: '92%',
    maxHeight: '90%',
    width: 600,
    height: 700,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewCloseBtn: {
    position: 'absolute',
    top: -40,
    right: 0,
    zIndex: 10,
    padding: 6,
  },
  fullPreviewImage: {
    width: '100%',
    height: '100%',
  },
});
