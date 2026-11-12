import { apiFetch, getApiBaseUrl } from './apiConfig';

export interface SalesReportPeriod {
  startDate: string;
  endDate: string;
}

export interface SalesSummaryData {
  totalWashes?: number;
  totalCompletedWashes: number;
  totalClosedWashes?: number;
  totalActiveWashes: number;
  totalCancelledWashes: number;
  totalBookings: number;
  totalRevenue: number;
  totalNetRevenue: number;
  totalGSTAmount: number;
  totalUniqueCustomers: number;
  totalUniqueVehicles: number;
  averageOrderValue: number;
  avgWashDurationMinutes: number;
}

export interface ServiceDistributionItem {
  serviceCategoryId: number;
  serviceCategoryName: string;
  packageId: number;
  packageName: string;
  totalWashes: number;
  netSales: number;
  gstSales: number;
  grossRevenue: number;
  washSharePercentage: number;
  revenueSharePercentage: number;
}

export interface BayUtilizationItem {
  bayNumber: number;
  bayName: string;
  bayType: string;
  currentStatus: string;
  totalWashesHandled: number;
  totalRevenueGenerated: number;
  totalActiveMinutes: number;
  avgServiceMinutesPerCar: number;
  utilizationPercentage: number;
}

export interface PaymentChannelMixItem {
  paymentChannel: string;
  paymentChannelName: string;
  transactionCount: number;
  netSales: number;
  gstAmount: number;
  totalAmount: number;
  volumePercentage: number;
  revenuePercentage: number;
}

export interface WashTrendItem {
  orderDate: string;
  dayName: string;
  completedWashes: number;
  cancelledOrders: number;
  totalOrders: number;
  dailyRevenue: number;
  dailyGST: number;
}

export interface RecentWashItem {
  orderId: number;
  orderNo: string;
  customerName: string;
  vehicleNumber: string;
  vehicleTypeName: string;
  packageName: string;
  serviceCategoryName: string;
  bayId: number | null;
  bayName: string;
  totalAmount: number;
  statusCode: number;
  statusName: string;
  startedDate: string | null;
  completedDate: string | null;
  durationMinutes: number | null;
  createdDate: string;
}

export interface RecentTransactionItem {
  orderId: number;
  orderNo: string;
  customerName: string;
  vehicleNumber: string;
  packageName: string;
  payMode: string;
  payModeDescription: string;
  netAmount: number;
  gstAmount: number;
  totalAmount: number;
  paymentStatus: string;
  paymentReference: string | null;
  orderSource: string;
  paidDate: string | null;
  createdDate: string;
}

export interface FullDashboardPayload {
  success: boolean;
  period: SalesReportPeriod;
  summary: SalesSummaryData;
  serviceDistribution: ServiceDistributionItem[];
  bayUtilization: BayUtilizationItem[];
  paymentChannelMix: PaymentChannelMixItem[];
  washTrend: WashTrendItem[];
  recentWashes: RecentWashItem[];
  recentTransactions: RecentTransactionItem[];
}

export type ReportPeriodTab = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export function mapTabToPeriodParam(tab: ReportPeriodTab): string {
  switch (tab) {
    case 'DAILY':
      return 'today';
    case 'WEEKLY':
      return 'thisWeek';
    case 'MONTHLY':
      return 'thisMonth';
    case 'YEARLY':
      return 'thisYear';
    default:
      return 'thisMonth';
  }
}

/**
 * Fetch full sales dashboard payload from the backend SQL Server stored procedures
 */
export async function fetchFullSalesDashboard(
  periodTab: ReportPeriodTab = 'MONTHLY',
  startDate?: string,
  endDate?: string
): Promise<FullDashboardPayload> {
  const periodParam = mapTabToPeriodParam(periodTab);
  let url = `${getApiBaseUrl()}/api/carwash/reports/dashboard?period=${periodParam}`;
  if (startDate && endDate) {
    url += `&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  const response = await apiFetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load sales dashboard (HTTP ${response.status})`);
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.message || 'Error returned from sales report API');
  }

  return json;
}

