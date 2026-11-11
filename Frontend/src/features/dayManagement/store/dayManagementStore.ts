import { create } from 'zustand';
import {
  fetchDayStatus,
  startBusinessDay,
  closeBusinessDay,
  submitCashMovement,
  DayMetrics,
  DayClosingReport,
  CashMovementRecord,
} from '../../../services/dayManagementApi';

interface DayManagementState {
  isOpen: boolean;
  activeDayId: number | null;
  businessDate: string | null;
  activeDay: DayMetrics | null;
  lastClosedDay: any | null;
  lastClosingReport: DayClosingReport | null;
  loading: boolean;
  error: string | null;
  isModalOpen: boolean;

  // Actions
  openModal: () => void;
  closeModal: () => void;
  checkStatus: () => Promise<boolean>;
  startDay: (payload: { openingCash?: number; remarks?: string; startedBy?: string; businessDate?: string }) => Promise<any>;
  closeDay: (payload?: { closingCash?: number; denominations?: any[]; closingRemarks?: string; endedBy?: string; forceClose?: boolean }) => Promise<DayClosingReport>;
  addCashMovement: (payload: { movementType: 'CASH_IN' | 'CASH_OUT'; amount: number; reason: string; remarks?: string; performedBy?: string }) => Promise<CashMovementRecord>;
  clearError: () => void;
  setLastClosingReport: (report: DayClosingReport | null) => void;
}

export const useDayManagementStore = create<DayManagementState>((set, get) => ({
  isOpen: false,
  activeDayId: null,
  businessDate: null,
  activeDay: null,
  lastClosedDay: null,
  lastClosingReport: null,
  loading: false,
  error: null,
  isModalOpen: false,

  openModal: () => {
    set({ isModalOpen: true });
    get().checkStatus();
  },

  closeModal: () => {
    set({ isModalOpen: false, error: null });
  },

  checkStatus: async () => {
    try {
      set({ loading: true, error: null });
      const res = await fetchDayStatus();
      set({
        isOpen: res.isOpen,
        activeDayId: res.activeDayId,
        businessDate: res.businessDate || res.activeDay?.businessDate || null,
        activeDay: res.activeDay || null,
        lastClosedDay: res.lastClosedDay || null,
        loading: false,
      });
      return res.isOpen;
    } catch (err: any) {
      set({
        loading: false,
        error: err?.message || 'Failed to check day status',
      });
      return false;
    }
  },

  startDay: async (payload) => {
    try {
      set({ loading: true, error: null });
      const res = await startBusinessDay({
        openingCash: payload.openingCash ?? 0,
        remarks: payload.remarks,
        startedBy: payload.startedBy,
        businessDate: payload.businessDate,
      });
      // Immediately refresh status after starting
      await get().checkStatus();
      set({ loading: false });
      return res;
    } catch (err: any) {
      set({
        loading: false,
        error: err?.message || 'Failed to start business day',
      });
      throw err;
    }
  },

  closeDay: async (payload = {}) => {
    try {
      set({ loading: true, error: null });
      const res = await closeBusinessDay({
        closingCash: payload.closingCash ?? 0,
        denominations: payload.denominations ?? [],
        closingRemarks: payload.closingRemarks ?? 'Day closed',
        endedBy: payload.endedBy ?? 'Cashier',
        forceClose: payload.forceClose ?? true,
      });
      set({
        isOpen: false,
        activeDayId: null,
        activeDay: null,
        lastClosingReport: res.report,
        loading: false,
      });
      // Refresh status after closing
      await get().checkStatus();
      return res.report;
    } catch (err: any) {
      set({
        loading: false,
        error: err?.message || 'Failed to close business day',
      });
      throw err;
    }
  },

  addCashMovement: async (payload) => {
    try {
      set({ loading: true, error: null });
      const res = await submitCashMovement(payload);
      // Refresh status to update running totals
      await get().checkStatus();
      set({ loading: false });
      return res.data;
    } catch (err: any) {
      set({
        loading: false,
        error: err?.message || 'Failed to record cash movement',
      });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
  setLastClosingReport: (report) => set({ lastClosingReport: report }),
}));

