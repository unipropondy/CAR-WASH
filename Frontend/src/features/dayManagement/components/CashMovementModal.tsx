import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useDayManagementStore } from '../store/dayManagementStore';

interface CashMovementModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userName?: string;
}

export const CashMovementModal: React.FC<CashMovementModalProps> = ({
  visible,
  onClose,
  onSuccess,
  userName = 'Cashier',
}) => {
  const [movementType, setMovementType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN');
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const addCashMovement = useDayManagementStore((state) => state.addCashMovement);

  const quickReasons =
    movementType === 'CASH_IN'
      ? ['Cash Float Addition', 'Bank Float Replenishment', 'Owner Capital Deposit', 'Change Coins Supply']
      : ['Petty Cash Expense', 'Cleaning Supplies Purchase', 'Drinking Water & Coffee', 'Emergency Equipment Repair'];

  const handleSubmit = async () => {
    setErrorMsg('');
    const parsedAmt = parseFloat(amount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Please select or specify a reason.');
      return;
    }

    setSubmitting(true);
    try {
      await addCashMovement({
        movementType,
        amount: parsedAmt,
        reason: reason.trim(),
        remarks: remarks.trim() || undefined,
        performedBy: userName,
      });

      setAmount('');
      setReason('');
      setRemarks('');
      setSubmitting(false);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setSubmitting(false);
      setErrorMsg(err?.message || 'Failed to record cash movement.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Record Cash Movement</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Type Toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, movementType === 'CASH_IN' && styles.toggleBtnActiveIn]}
              onPress={() => {
                setMovementType('CASH_IN');
                setReason('');
              }}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  movementType === 'CASH_IN' && styles.toggleBtnTextActive,
                ]}
              >
                + Cash In (Float In)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, movementType === 'CASH_OUT' && styles.toggleBtnActiveOut]}
              onPress={() => {
                setMovementType('CASH_OUT');
                setReason('');
              }}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  movementType === 'CASH_OUT' && styles.toggleBtnTextActive,
                ]}
              >
                - Cash Out (Paid Out)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Amount (S$)</Text>
            <View style={styles.amountInputWrapper}>
              <Text style={styles.currencyPrefix}>$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
          </View>

          {/* Quick Reasons */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Select Reason</Text>
            <View style={styles.chipGrid}>
              {quickReasons.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, reason === r && styles.chipSelected]}
                  onPress={() => setReason(r)}
                >
                  <Text style={[styles.chipText, reason === r && styles.chipTextSelected]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Or enter custom reason"
              placeholderTextColor="#94A3B8"
              value={reason}
              onChangeText={setReason}
            />
          </View>

          {/* Remarks */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Remarks / Reference (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Receipt number, supplier name"
              placeholderTextColor="#94A3B8"
              value={remarks}
              onChangeText={setRemarks}
            />
          </View>

          {/* Error message */}
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                movementType === 'CASH_IN' ? styles.submitBtnIn : styles.submitBtnOut,
                submitting && { opacity: 0.6 },
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {movementType === 'CASH_IN' ? 'Confirm Cash In' : 'Confirm Cash Out'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActiveIn: {
    backgroundColor: '#16A34A',
  },
  toggleBtnActiveOut: {
    backgroundColor: '#E60012',
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    paddingVertical: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  chipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  submitBtn: {
    flex: 1.5,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  submitBtnIn: {
    backgroundColor: '#16A34A',
  },
  submitBtnOut: {
    backgroundColor: '#E60012',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

