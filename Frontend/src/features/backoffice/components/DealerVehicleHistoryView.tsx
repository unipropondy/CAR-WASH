import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchDealerVehicleHistorySummary,
  fetchDealerDetailedVisits,
  DealerVehicleHistorySummary,
  DealerDetailedVisit,
} from '../../../services/dealerApi';
import { formatSgDateTime } from '../../../services/timeService';
import { RED_BAY_COLORS } from '../../../theme/colors';

type ActiveTab = 'SUMMARY' | 'DETAILED';

export interface DealerVehicleHistoryViewProps {
  theme?: 'dark' | 'light';
}

export const DealerVehicleHistoryView: React.FC<DealerVehicleHistoryViewProps> = ({
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const styles = useMemo(() => getStyles(isLight), [isLight]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('SUMMARY');
  const [summaries, setSummaries] = useState<DealerVehicleHistorySummary[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<number | undefined>(undefined);
  const [visits, setVisits] = useState<DealerDetailedVisit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const loadData = async (
    overrideDealerId?: number,
    overrideFromDate?: string,
    overrideToDate?: string,
    overrideStatus?: 'ALL' | 'PAID' | 'PENDING'
  ) => {
    try {
      setLoading(true);
      const curDealerId = overrideDealerId !== undefined ? overrideDealerId : selectedDealerId;
      const curFrom = overrideFromDate !== undefined ? overrideFromDate : fromDate;
      const curTo = overrideToDate !== undefined ? overrideToDate : toDate;
      const curStatus = overrideStatus !== undefined ? overrideStatus : statusFilter;

      const [sumData, visitData] = await Promise.all([
        fetchDealerVehicleHistorySummary(),
        fetchDealerDetailedVisits(
          curDealerId,
          searchQuery.trim(),
          curFrom.trim() || undefined,
          curTo.trim() || undefined,
          curStatus
        ),
      ]);
      setSummaries(sumData);
      setVisits(visitData);
    } catch (err: any) {
      console.warn('[DealerVehicleHistoryView] loadData error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDealerId]);

  const handleSearchSubmit = () => {
    loadData();
  };

  const handleSelectDealerAndShowVisits = (dealerId: number) => {
    setSelectedDealerId(dealerId);
    setActiveTab('DETAILED');
  };

  const handleStatusChange = (st: 'ALL' | 'PAID' | 'PENDING') => {
    setStatusFilter(st);
    loadData(selectedDealerId, fromDate, toDate, st);
  };

  const handleApplyDateFilter = () => {
    loadData(selectedDealerId, fromDate, toDate, statusFilter);
  };

  const handleQuickDatePreset = (preset: 'TODAY' | 'WEEK' | 'MONTH' | 'ALL') => {
    let f = '';
    let t = '';
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'TODAY') {
      f = toYmd(now);
      t = toYmd(now);
    } else if (preset === 'WEEK') {
      const past = new Date(now.getTime() - 7 * 86400000);
      f = toYmd(past);
      t = toYmd(now);
    } else if (preset === 'MONTH') {
      f = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      t = toYmd(now);
    } else if (preset === 'ALL') {
      f = '';
      t = '';
    }

    setFromDate(f);
    setToDate(t);
    loadData(selectedDealerId, f, t, statusFilter);
  };

  const formatDateTime = (dtStr?: string) => {
    if (!dtStr) return '-';
    return formatSgDateTime(dtStr);
  };

  const selectedDealerSummary = useMemo(() => {
    if (!selectedDealerId) return null;
    return summaries.find((s) => s.dealerId === selectedDealerId) || null;
  }, [summaries, selectedDealerId]);

  const visitStats = useMemo(() => {
    let totalAmt = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let paidCount = 0;
    let pendingCount = 0;

    for (const v of visits) {
      totalAmt += v.totalAmount || 0;
      totalPaid += v.paidAmount || 0;
      totalOutstanding += v.outstandingAmount || 0;
      const s = (v.paymentStatus || '').toUpperCase();
      if (s === 'PAID') {
        paidCount++;
      } else {
        pendingCount++;
      }
    }

    return {
      totalCount: visits.length,
      paidCount,
      pendingCount,
      totalAmt,
      totalPaid,
      totalOutstanding,
    };
  }, [visits]);

  const handleDownloadExcel = () => {
    if (visits.length === 0) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('No visit records available to download.');
      }
      return;
    }

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const dealerLabel = selectedDealerSummary?.dealerName || (selectedDealerId ? `Dealer #${selectedDealerId}` : 'All Dealers');
    const filterMeta = `Dealer: ${dealerLabel} | Date Range: ${fromDate || 'Start'} to ${toDate || 'Present'} | Status: ${statusFilter}`;

    const headers = [
      'Date & Time',
      'Bill Number',
      'Dealer Name',
      'Dealer Code',
      'Vehicle Plate',
      'Vehicle Type',
      'Package Selected',
      'Additional Services',
      'Total Amount ($)',
      'Paid Amount ($)',
      'Outstanding ($)',
      'Payment Status',
    ];

    const dataRows = visits.map((v) => [
      escapeCsv(formatDateTime(v.visitDateTime || v.inTime)),
      escapeCsv(v.billNumber),
      escapeCsv(v.dealerName),
      escapeCsv(v.dealerCode || '-'),
      escapeCsv(v.vehicleNumber),
      escapeCsv(v.vehicleType),
      escapeCsv(v.packageSelected),
      escapeCsv(v.additionalServices || '-'),
      escapeCsv(v.totalAmount.toFixed(2)),
      escapeCsv(v.paidAmount.toFixed(2)),
      escapeCsv(v.outstandingAmount.toFixed(2)),
      escapeCsv(v.paymentStatus || 'PENDING'),
    ].join(','));

    const totalRow = [
      escapeCsv('TOTAL'),
      escapeCsv(`${visits.length} Visits`),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(visitStats.totalAmt.toFixed(2)),
      escapeCsv(visitStats.totalPaid.toFixed(2)),
      escapeCsv(visitStats.totalOutstanding.toFixed(2)),
      escapeCsv(`${visitStats.paidCount} Paid / ${visitStats.pendingCount} Pending`),
    ].join(',');

    const metaRow = [escapeCsv('RedBay Car Wash - Commercial Fleet Vehicle Visit Report'), escapeCsv(filterMeta)].join(',');

    const csvContent = '\uFEFF' + [metaRow, '', headers.map(escapeCsv).join(','), ...dataRows, '', totalRow].join('\r\n');

    const cleanDealer = (selectedDealerSummary?.dealerName || 'AllDealers').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Dealer_Visits_${cleanDealer}_${fromDate || 'start'}_to_${toDate || 'today'}.csv`;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadPdf = () => {
    if (visits.length === 0) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('No records available to export.');
      }
      return;
    }

    const dealerLabel = selectedDealerSummary?.dealerName || (selectedDealerId ? `Dealer #${selectedDealerId}` : 'All Dealers');
    const dateRangeLabel = fromDate || toDate ? `${fromDate || 'Start'} to ${toDate || 'Present'}` : 'All Recorded Dates';
    const reportDate = formatDateTime(new Date().toISOString());

    const tableRowsHtml = visits.map((v, i) => {
      const isPaid = (v.paymentStatus || '').toUpperCase() === 'PAID';
      const statusColor = isPaid ? '#16a34a' : '#d97706';
      const statusBg = isPaid ? '#dcfce7' : '#fef3c7';

      return `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 7px 9px; font-size: 11px; border-bottom: 1px solid #e2e8f0;">${formatDateTime(v.visitDateTime || v.inTime)}</td>
          <td style="padding: 7px 9px; font-size: 11px; font-weight: 700; color: #0284c7; border-bottom: 1px solid #e2e8f0;">${v.billNumber}</td>
          <td style="padding: 7px 9px; font-size: 11px; border-bottom: 1px solid #e2e8f0;">${v.dealerName}</td>
          <td style="padding: 7px 9px; font-size: 11px; font-weight: 700; border-bottom: 1px solid #e2e8f0;"><span style="display:inline-block; padding: 2px 5px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 3px;">${v.vehicleNumber}</span></td>
          <td style="padding: 7px 9px; font-size: 11px; border-bottom: 1px solid #e2e8f0;">${v.vehicleType}</td>
          <td style="padding: 7px 9px; font-size: 11px; border-bottom: 1px solid #e2e8f0;">${v.packageSelected}</td>
          <td style="padding: 7px 9px; font-size: 11px; border-bottom: 1px solid #e2e8f0; color: #64748b;">${v.additionalServices || '-'}</td>
          <td style="padding: 7px 9px; font-size: 11px; text-align: right; font-weight: 700; border-bottom: 1px solid #e2e8f0;">$${v.totalAmount.toFixed(2)}</td>
          <td style="padding: 7px 9px; font-size: 11px; text-align: right; color: #16a34a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">$${v.paidAmount.toFixed(2)}</td>
          <td style="padding: 7px 9px; font-size: 11px; text-align: right; color: ${v.outstandingAmount > 0 ? '#d97706' : '#16a34a'}; font-weight: 700; border-bottom: 1px solid #e2e8f0;">$${v.outstandingAmount.toFixed(2)}</td>
          <td style="padding: 7px 9px; text-align: center; border-bottom: 1px solid #e2e8f0;">
            <span style="display:inline-block; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 800; background: ${statusBg}; color: ${statusColor};">${v.paymentStatus || 'PENDING'}</span>
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Dealer Visit Report - ${dealerLabel}</title>
        <style>
          @media print {
            @page { size: landscape; margin: 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 20px;
            background: #ffffff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #ef4444;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .title-area h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
          }
          .title-area p {
            margin: 3px 0 0;
            font-size: 12px;
            color: #64748b;
          }
          .meta-box {
            text-align: right;
            font-size: 11px;
            color: #475569;
          }
          .kpi-row {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
          }
          .kpi-card {
            flex: 1;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
          }
          .kpi-label {
            font-size: 10px;
            color: #64748b;
            font-weight: 700;
            text-transform: uppercase;
          }
          .kpi-value {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background: #0f172a;
            color: #ffffff;
            font-size: 10.5px;
            font-weight: 800;
            text-transform: uppercase;
            padding: 8px 9px;
            text-align: left;
          }
          .footer {
            margin-top: 16px;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
            display: flex;
            justify-content: space-between;
            font-size: 10.5px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>REDBAY CAR WASH — VEHICLE VISIT & CREDIT REPORT</h1>
            <p>Commercial fleet account service logs, entry/exit timestamps, and payment tracking.</p>
          </div>
          <div class="meta-box">
            <div><strong>Dealer:</strong> ${dealerLabel}</div>
            <div><strong>Date Range:</strong> ${dateRangeLabel}</div>
            <div><strong>Filter Status:</strong> ${statusFilter}</div>
            <div><strong>Generated:</strong> ${reportDate}</div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">Total Visits</div>
            <div class="kpi-value">${visits.length}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Paid Visits</div>
            <div class="kpi-value" style="color: #16a34a;">${visitStats.paidCount}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Pending Visits</div>
            <div class="kpi-value" style="color: #d97706;">${visitStats.pendingCount}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Amount</div>
            <div class="kpi-value">$${visitStats.totalAmt.toFixed(2)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Paid</div>
            <div class="kpi-value" style="color: #16a34a;">$${visitStats.totalPaid.toFixed(2)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Outstanding</div>
            <div class="kpi-value" style="color: ${visitStats.totalOutstanding > 0 ? '#d97706' : '#16a34a'};">$${visitStats.totalOutstanding.toFixed(2)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Bill Number</th>
              <th>Dealer</th>
              <th>Plate</th>
              <th>Type</th>
              <th>Package</th>
              <th>Add-ons</th>
              <th style="text-align: right;">Total</th>
              <th style="text-align: right;">Paid</th>
              <th style="text-align: right;">Outstanding</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: 800; font-size: 11px;">
              <td colspan="7" style="padding: 8px 9px; text-align: right;">TOTAL:</td>
              <td style="padding: 8px 9px; text-align: right;">$${visitStats.totalAmt.toFixed(2)}</td>
              <td style="padding: 8px 9px; text-align: right; color: #16a34a;">$${visitStats.totalPaid.toFixed(2)}</td>
              <td style="padding: 8px 9px; text-align: right; color: ${visitStats.totalOutstanding > 0 ? '#d97706' : '#16a34a'};">$${visitStats.totalOutstanding.toFixed(2)}</td>
              <td style="padding: 8px 9px; text-align: center;">${visitStats.paidCount} Paid / ${visitStats.pendingCount} Pending</td>
            </tr>
          </tfoot>
        </table>

        <div class="footer">
          <div>RedBay Car Wash POS System &bull; Confidential Commercial Fleet Report</div>
          <div>Page 1 of 1</div>
        </div>
      </body>
      </html>
    `;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(htmlContent);
          doc.close();
          iframe.contentWindow?.focus();
          setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => {
              document.body.removeChild(iframe);
            }, 5000);
          }, 500);
        }
      }
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || 'PENDING').toUpperCase();
    if (s === 'PAID') {
      return { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#22C55E', label: 'PAID' };
    }
    if (s === 'PARTIALLY_PAID') {
      return { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', text: '#3B82F6', label: 'PARTIALLY PAID' };
    }
    return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#F59E0B', label: 'PENDING' };
  };

  return (
    <View style={styles.container}>
      {/* ── TOP TOGGLE TABS ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'SUMMARY' && styles.tabBtnActive]}
          onPress={() => setActiveTab('SUMMARY')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="stats-chart-outline"
            size={16}
            color={activeTab === 'SUMMARY' ? '#FFFFFF' : '#94A3B8'}
          />
          <Text style={[styles.tabBtnText, activeTab === 'SUMMARY' && styles.tabBtnTextActive]}>
            Dealer Fleet & Visit Counts Summary
          </Text>
          <View style={[styles.tabBadge, activeTab === 'SUMMARY' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'SUMMARY' && styles.tabBadgeTextActive]}>
              {summaries.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'DETAILED' && styles.tabBtnActive]}
          onPress={() => setActiveTab('DETAILED')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="car-outline"
            size={16}
            color={activeTab === 'DETAILED' ? '#FFFFFF' : '#94A3B8'}
          />
          <Text style={[styles.tabBtnText, activeTab === 'DETAILED' && styles.tabBtnTextActive]}>
            Detailed Vehicle Visit History {selectedDealerSummary ? `(${selectedDealerSummary.dealerName})` : '(All Dealers)'}
          </Text>
          <View style={[styles.tabBadge, activeTab === 'DETAILED' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'DETAILED' && styles.tabBadgeTextActive]}>
              {visits.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ══════════════════════════════════════════════════════════
          VIEW 1: DEALER FLEET & VISIT COUNTS SUMMARY (FULL SCREEN)
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'SUMMARY' && (
        <View style={styles.fullScreenCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Dealer Fleet & Visit Counts Summary</Text>
              <Text style={styles.sectionSub}>
                Commercial dealer accounts, serviced fleet counts, visits, and balance totals. Click any dealer or 'Filter Visits' to inspect their full vehicle logs.
              </Text>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => loadData()}>
              <Ionicons name="refresh" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {loading && summaries.length === 0 ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
              <Text style={styles.loadingText}>Loading dealer vehicle summaries...</Text>
            </View>
          ) : summaries.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="business-outline" size={44} color="#64748B" />
              <Text style={styles.emptyTitle}>No Dealer Summary Records</Text>
              <Text style={styles.emptySub}>No commercial dealer accounts found.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.horizontalScroll}>
              <View style={styles.tableInnerWrapper}>
                {/* Summary Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.th, { width: 170 }]}>Dealer Name</Text>
                  <Text style={[styles.th, { width: 110, textAlign: 'center' }]}>Total Visits</Text>
                  <Text style={[styles.th, { width: 140, textAlign: 'center' }]}>Vehicles Serviced</Text>
                  <Text style={[styles.th, { width: 110, textAlign: 'center' }]}>Total Orders</Text>
                  <Text style={[styles.th, { width: 130, textAlign: 'right' }]}>Total Amount</Text>
                  <Text style={[styles.th, { width: 130, textAlign: 'right' }]}>Total Paid</Text>
                  <Text style={[styles.th, { width: 130, textAlign: 'right' }]}>Outstanding</Text>
                  <Text style={[styles.th, { width: 160 }]}>Last Visit Date</Text>
                  <Text style={[styles.th, { width: 130, textAlign: 'center' }]}>Action</Text>
                </View>

                {/* Full-Height Summary Table Rows */}
                <ScrollView style={styles.tableBodyScroll} showsVerticalScrollIndicator={true}>
                  {summaries.map((s, idx) => {
                    const isSelected = selectedDealerId === s.dealerId;
                    const isEven = idx % 2 === 0;

                    return (
                      <TouchableOpacity
                        key={s.dealerId}
                        style={[
                          styles.tableRow,
                          isEven && styles.tableRowEven,
                          isSelected && styles.tableRowSelected,
                        ]}
                        onPress={() => handleSelectDealerAndShowVisits(s.dealerId)}
                        activeOpacity={0.8}
                      >
                        {/* Dealer Name */}
                        <View style={{ width: 170 }}>
                          <Text style={[styles.cellBold, isSelected && { color: '#38BDF8' }]}>
                            {s.dealerName}
                          </Text>
                          <Text style={styles.cellMuted}>{s.uniqueCode}</Text>
                        </View>

                        {/* Total Visits Badge */}
                        <View style={{ width: 110, alignItems: 'center' }}>
                          <View style={styles.visitCountBadge}>
                            <Text style={styles.visitCountBadgeText}>{s.totalVisits}</Text>
                          </View>
                        </View>

                        {/* Total Vehicles Serviced */}
                        <View style={{ width: 140, alignItems: 'center' }}>
                          <View style={styles.vehicleCountTag}>
                            <Ionicons name="car" size={13} color="#38BDF8" style={{ marginRight: 5 }} />
                            <Text style={styles.vehicleCountText}>{s.totalVehiclesServiced} cars</Text>
                          </View>
                        </View>

                        {/* Total Orders */}
                        <Text style={[styles.cellText, { width: 110, textAlign: 'center' }]}>
                          {s.totalOrders}
                        </Text>

                        {/* Total Amount */}
                        <Text style={[styles.cellBold, { width: 130, textAlign: 'right' }]}>
                          ${s.totalAmount.toFixed(2)}
                        </Text>

                        {/* Total Paid */}
                        <Text style={[styles.cellBold, { width: 130, textAlign: 'right', color: '#22C55E' }]}>
                          ${s.totalPaidAmount.toFixed(2)}
                        </Text>

                        {/* Outstanding */}
                        <Text
                          style={[
                            styles.cellBold,
                            {
                              width: 130,
                              textAlign: 'right',
                              color: s.totalOutstandingCredit > 0 ? '#F59E0B' : '#22C55E',
                            },
                          ]}
                        >
                          ${s.totalOutstandingCredit.toFixed(2)}
                        </Text>

                        {/* Last Visit Date */}
                        <Text style={[styles.cellMuted, { width: 160 }]}>
                          {formatDateTime(s.lastVisitDate || undefined)}
                        </Text>

                        {/* Action: Click to Filter & View Full Logs */}
                        <View style={{ width: 130, alignItems: 'center' }}>
                          <TouchableOpacity
                            style={[styles.filterBtn, isSelected && styles.filterBtnActive]}
                            onPress={() => handleSelectDealerAndShowVisits(s.dealerId)}
                          >
                            <Ionicons
                              name="list"
                              size={12}
                              color={isSelected ? '#0A0A0A' : '#38BDF8'}
                              style={{ marginRight: 4 }}
                            />
                            <Text style={[styles.filterBtnText, isSelected && styles.filterBtnTextActive]}>
                              View Visits
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════
          VIEW 2: DETAILED VEHICLE VISIT HISTORY (FULL SCREEN)
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'DETAILED' && (
        <View style={styles.fullScreenCard}>
          {/* Top Bar: Title + Right Action Buttons (Search, Excel, PDF, Refresh) */}
          <View style={styles.detailedHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>
                Detailed Vehicle Visit History
                {selectedDealerSummary ? ` — ${selectedDealerSummary.dealerName}` : ' (All Dealers)'}
              </Text>
              <Text style={styles.sectionSub}>
                {visits.length} vehicle service visit record(s) logged in the system.
              </Text>
            </View>

            <View style={styles.headerControlsRight}>
              {selectedDealerId && (
                <TouchableOpacity
                  style={styles.clearFilterChip}
                  onPress={() => setSelectedDealerId(undefined)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearFilterChipText}>
                    Dealer: {selectedDealerSummary?.dealerName || `#${selectedDealerId}`}
                  </Text>
                  <Ionicons name="close-circle" size={14} color="#38BDF8" />
                </TouchableOpacity>
              )}

              <View style={styles.searchBox}>
                <Ionicons name="search" size={15} color="#64748B" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search bill#, plate..."
                  placeholderTextColor="#64748B"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearchSubmit}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); loadData(); }}>
                    <Ionicons name="close-circle" size={14} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Download Excel Button */}
              <TouchableOpacity
                style={styles.downloadExcelBtn}
                onPress={handleDownloadExcel}
                activeOpacity={0.85}
              >
                <Ionicons name="document-text-outline" size={14} color="#FFFFFF" />
                <Text style={styles.downloadBtnText}>Excel (.csv)</Text>
              </TouchableOpacity>

              {/* Download PDF Button */}
              <TouchableOpacity
                style={styles.downloadPdfBtn}
                onPress={handleDownloadPdf}
                activeOpacity={0.85}
              >
                <Ionicons name="print-outline" size={14} color="#FFFFFF" />
                <Text style={styles.downloadBtnText}>PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.refreshBtn} onPress={() => loadData()}>
                <Ionicons name="refresh" size={15} color={isLight ? '#0F172A' : '#FFFFFF'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Bar: Status Filter, Date Range (From/To) & Quick Date Presets, KPI Mini Bar */}
          <View style={styles.filterBarRow}>
            {/* 1. Payment Status Toggle Filter (ALL / PAID / PENDING) */}
            <View style={styles.statusGroup}>
              <Text style={styles.filterLabel}>Status:</Text>
              <TouchableOpacity
                style={[styles.statusFilterPill, statusFilter === 'ALL' && styles.statusFilterPillActive]}
                onPress={() => handleStatusChange('ALL')}
                activeOpacity={0.8}
              >
                <Text style={[styles.statusFilterPillText, statusFilter === 'ALL' && styles.statusFilterPillTextActive]}>
                  ALL ({visits.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusFilterPill, statusFilter === 'PAID' && styles.statusFilterPillActive]}
                onPress={() => handleStatusChange('PAID')}
                activeOpacity={0.8}
              >
                <View style={[styles.statusDot, { backgroundColor: '#22C55E' }]} />
                <Text style={[styles.statusFilterPillText, statusFilter === 'PAID' && styles.statusFilterPillTextActive]}>
                  PAID ({visitStats.paidCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusFilterPill, statusFilter === 'PENDING' && styles.statusFilterPillActive]}
                onPress={() => handleStatusChange('PENDING')}
                activeOpacity={0.8}
              >
                <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.statusFilterPillText, statusFilter === 'PENDING' && styles.statusFilterPillTextActive]}>
                  PENDING ({visitStats.pendingCount})
                </Text>
              </TouchableOpacity>
            </View>

            {/* 2. Date Range Filter: From Date, To Date & Quick Filters */}
            <View style={styles.dateFilterGroup}>
              <Text style={styles.filterLabel}>From Date:</Text>
              <View style={styles.dateInputBox}>
                <Ionicons name="calendar-outline" size={13} color="#64748B" />
                <TextInput
                  style={styles.dateInputField}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#64748B"
                  value={fromDate}
                  onChangeText={setFromDate}
                  onSubmitEditing={handleApplyDateFilter}
                />
              </View>

              <Text style={styles.filterLabel}>To Date:</Text>
              <View style={styles.dateInputBox}>
                <Ionicons name="calendar-outline" size={13} color="#64748B" />
                <TextInput
                  style={styles.dateInputField}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#64748B"
                  value={toDate}
                  onChangeText={setToDate}
                  onSubmitEditing={handleApplyDateFilter}
                />
              </View>

              <TouchableOpacity
                style={styles.applyFilterBtn}
                onPress={handleApplyDateFilter}
                activeOpacity={0.8}
              >
                <Text style={styles.applyFilterBtnText}>Filter</Text>
              </TouchableOpacity>

              {/* Quick Presets */}
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={() => handleQuickDatePreset('TODAY')}
              >
                <Text style={styles.quickDateChipText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={() => handleQuickDatePreset('WEEK')}
              >
                <Text style={styles.quickDateChipText}>7 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateChip}
                onPress={() => handleQuickDatePreset('MONTH')}
              >
                <Text style={styles.quickDateChipText}>This Month</Text>
              </TouchableOpacity>
              {(fromDate || toDate) ? (
                <TouchableOpacity
                  style={styles.quickDateChipClear}
                  onPress={() => handleQuickDatePreset('ALL')}
                >
                  <Text style={styles.quickDateChipClearText}>Clear Dates</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* 3. Filter Summary Mini KPIs */}
            <View style={styles.kpiSummaryGroup}>
              <View style={styles.kpiMiniItem}>
                <Text style={styles.kpiMiniLabel}>Total:</Text>
                <Text style={styles.kpiMiniVal}>${visitStats.totalAmt.toFixed(2)}</Text>
              </View>
              <View style={styles.kpiMiniItem}>
                <Text style={styles.kpiMiniLabel}>Paid:</Text>
                <Text style={[styles.kpiMiniVal, { color: '#22C55E' }]}>${visitStats.totalPaid.toFixed(2)}</Text>
              </View>
              <View style={styles.kpiMiniItem}>
                <Text style={styles.kpiMiniLabel}>Balance:</Text>
                <Text style={[styles.kpiMiniVal, { color: visitStats.totalOutstanding > 0 ? '#F59E0B' : '#22C55E' }]}>
                  ${visitStats.totalOutstanding.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={RED_BAY_COLORS.primary} />
              <Text style={styles.loadingText}>Loading vehicle visit records...</Text>
            </View>
          ) : visits.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="car-outline" size={44} color="#64748B" />
              <Text style={styles.emptyTitle}>No Visit History Recorded</Text>
              <Text style={styles.emptySub}>
                No vehicle service records match the current view or date/status filter.
              </Text>
              {(selectedDealerId || fromDate || toDate || statusFilter !== 'ALL') && (
                <TouchableOpacity
                  style={styles.showAllBtn}
                  onPress={() => {
                    setSelectedDealerId(undefined);
                    setStatusFilter('ALL');
                    setFromDate('');
                    setToDate('');
                    loadData(undefined, '', '', 'ALL');
                  }}
                >
                  <Text style={styles.showAllBtnText}>Reset All Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.horizontalScroll}>
              <View style={styles.tableInnerWrapper}>
                {/* Detailed Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.th, { width: 170 }]}>Date & Time</Text>
                  <Text style={[styles.th, { width: 140 }]}>Bill Number</Text>
                  <Text style={[styles.th, { width: 150 }]}>Dealer</Text>
                  <Text style={[styles.th, { width: 120 }]}>Vehicle Plate</Text>
                  <Text style={[styles.th, { width: 110 }]}>Vehicle Type</Text>
                  <Text style={[styles.th, { width: 180 }]}>Package Selected</Text>
                  <Text style={[styles.th, { width: 160 }]}>Additional Services</Text>
                  <Text style={[styles.th, { width: 110, textAlign: 'right' }]}>Total Amount</Text>
                  <Text style={[styles.th, { width: 110, textAlign: 'right' }]}>Paid Amount</Text>
                  <Text style={[styles.th, { width: 110, textAlign: 'right' }]}>Balance</Text>
                  <Text style={[styles.th, { width: 130, textAlign: 'center' }]}>Payment Status</Text>
                </View>

                {/* Full-Height Detailed Table Rows */}
                <ScrollView style={styles.tableBodyScroll} showsVerticalScrollIndicator={true}>
                  {visits.map((v, idx) => {
                    const b = getStatusBadge(v.paymentStatus);
                    const isEven = idx % 2 === 0;

                    return (
                      <View key={v.orderId || idx} style={[styles.tableRow, isEven && styles.tableRowEven]}>
                        {/* Date & Time */}
                        <Text style={[styles.cellText, { width: 170 }]}>{formatDateTime(v.visitDateTime || v.inTime)}</Text>

                        {/* Bill Number */}
                        <Text style={[styles.cellBold, { width: 140, color: '#38BDF8' }]}>{v.billNumber}</Text>

                        {/* Dealer */}
                        <Text style={[styles.cellText, { width: 150 }]} numberOfLines={1}>{v.dealerName}</Text>

                        {/* Vehicle Number */}
                        <View style={{ width: 120 }}>
                          <View style={styles.plateTag}>
                            <Text style={styles.plateText}>{v.vehicleNumber}</Text>
                          </View>
                        </View>

                        {/* Vehicle Type */}
                        <Text style={[styles.cellText, { width: 110 }]}>{v.vehicleType}</Text>

                        {/* Package Selected */}
                        <Text style={[styles.cellText, { width: 180 }]} numberOfLines={1}>{v.packageSelected}</Text>

                        {/* Additional Services */}
                        <Text style={[styles.cellMuted, { width: 160 }]} numberOfLines={1}>{v.additionalServices || '-'}</Text>

                        {/* Total Amount */}
                        <Text style={[styles.cellBold, { width: 110, textAlign: 'right' }]}>${v.totalAmount.toFixed(2)}</Text>

                        {/* Paid Amount */}
                        <Text style={[styles.cellBold, { width: 110, textAlign: 'right', color: '#22C55E' }]}>
                          ${v.paidAmount.toFixed(2)}
                        </Text>

                        {/* Outstanding Balance */}
                        <Text
                          style={[
                            styles.cellBold,
                            {
                              width: 110,
                              textAlign: 'right',
                              color: v.outstandingAmount > 0 ? '#F59E0B' : '#22C55E',
                            },
                          ]}
                        >
                          ${v.outstandingAmount.toFixed(2)}
                        </Text>

                        {/* Payment Status Badge */}
                        <View style={{ width: 130, alignItems: 'center' }}>
                          <View style={[styles.statusBadge, { backgroundColor: b.bg, borderColor: b.border }]}>
                            <Text style={[styles.statusBadgeText, { color: b.text }]}>{b.label}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const getStyles = (isLight: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    padding: isLight ? 0 : 14,
    backgroundColor: isLight ? 'transparent' : '#0A0A0A',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
  },
  tabBtnActive: {
    backgroundColor: isLight ? '#0F172A' : 'rgba(255,26,26,0.18)',
    borderColor: isLight ? '#0F172A' : RED_BAY_COLORS.primary,
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: isLight ? '#64748B' : '#94A3B8',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: RED_BAY_COLORS.primary,
  },
  tabBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: isLight ? '#64748B' : '#94A3B8',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },
  fullScreenCard: {
    flex: 1,
    backgroundColor: isLight ? '#FFFFFF' : '#161616',
    borderRadius: isLight ? 14 : 12,
    borderWidth: 1,
    borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
    ...(isLight && Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' } as any)
      : isLight
      ? { elevation: 2 }
      : {}),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)',
  },
  detailedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)',
  },
  headerControlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: isLight ? '#0F172A' : '#FFFFFF',
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    maxWidth: 700,
  },
  refreshBtn: {
    backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.06)',
    borderWidth: isLight ? 1 : 0,
    borderColor: isLight ? '#CBD5E1' : 'transparent',
    padding: 8,
    borderRadius: 6,
  },
  clearFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: isLight ? '#EFF6FF' : 'rgba(56,189,248,0.1)',
    borderWidth: 1,
    borderColor: isLight ? '#BFDBFE' : 'rgba(56,189,248,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  clearFilterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: isLight ? '#1D4ED8' : '#38BDF8',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchInput: {
    color: isLight ? '#0F172A' : '#FFFFFF',
    fontSize: 12,
    width: 170,
  },
  downloadExcelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingHorizontal: 11,
    height: 36,
    borderRadius: 8,
  },
  downloadPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: RED_BAY_COLORS.primary || '#EF4444',
    paddingHorizontal: 11,
    height: 36,
    borderRadius: 8,
  },
  downloadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterBarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)',
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 2,
  },
  statusFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
  },
  statusFilterPillActive: {
    backgroundColor: isLight ? '#0F172A' : 'rgba(56,189,248,0.15)',
    borderColor: isLight ? '#0F172A' : '#38BDF8',
  },
  statusFilterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: isLight ? '#64748B' : '#94A3B8',
  },
  statusFilterPillTextActive: {
    color: isLight ? '#FFFFFF' : '#38BDF8',
    fontWeight: '800',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dateFilterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  dateInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    height: 32,
    gap: 4,
  },
  dateInputField: {
    fontSize: 11.5,
    color: isLight ? '#0F172A' : '#FFFFFF',
    width: 95,
    padding: 0,
  },
  applyFilterBtn: {
    backgroundColor: isLight ? '#0F172A' : '#27272A',
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyFilterBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickDateChip: {
    paddingHorizontal: 7,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
  },
  quickDateChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: isLight ? '#475569' : '#94A3B8',
  },
  quickDateChipClear: {
    paddingHorizontal: 7,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: isLight ? '#FEF2F2' : 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: isLight ? '#FEE2E2' : 'rgba(239,68,68,0.25)',
  },
  quickDateChipClearText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#EF4444',
  },
  kpiSummaryGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.06)',
  },
  kpiMiniItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kpiMiniLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '700',
  },
  kpiMiniVal: {
    fontSize: 11.5,
    fontWeight: '800',
    color: isLight ? '#0F172A' : '#FFFFFF',
  },
  horizontalScroll: {
    flex: 1,
  },
  tableInnerWrapper: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1,
    borderBottomColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  th: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tableBodyScroll: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.04)',
  },
  tableRowEven: {
    backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.015)',
  },
  tableRowSelected: {
    backgroundColor: isLight ? '#EFF6FF' : 'rgba(56,189,248,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  cellText: {
    fontSize: 12,
    color: isLight ? '#0F172A' : '#E2E8F0',
    fontWeight: '500',
  },
  cellBold: {
    fontSize: 12,
    fontWeight: '800',
    color: isLight ? '#0F172A' : '#FFFFFF',
  },
  cellMuted: {
    fontSize: 11,
    color: '#64748B',
  },
  visitCountBadge: {
    backgroundColor: isLight ? '#FEF2F2' : 'rgba(255,26,26,0.15)',
    borderWidth: 1,
    borderColor: isLight ? '#FEE2E2' : 'rgba(255,26,26,0.3)',
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 12,
  },
  visitCountBadgeText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#ED0712',
  },
  vehicleCountTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isLight ? '#EFF6FF' : 'rgba(56,189,248,0.08)',
    borderWidth: isLight ? 1 : 0,
    borderColor: isLight ? '#BFDBFE' : 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  vehicleCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: isLight ? '#1D4ED8' : '#38BDF8',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isLight ? '#EFF6FF' : 'rgba(56,189,248,0.1)',
    borderWidth: 1,
    borderColor: isLight ? '#BFDBFE' : 'rgba(56,189,248,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  filterBtnActive: {
    backgroundColor: isLight ? '#2563EB' : '#38BDF8',
    borderColor: isLight ? '#2563EB' : '#38BDF8',
  },
  filterBtnText: {
    fontSize: 11,
    color: isLight ? '#1D4ED8' : '#38BDF8',
    fontWeight: '700',
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  plateTag: {
    backgroundColor: isLight ? '#F1F5F9' : '#0F172A',
    borderWidth: 1,
    borderColor: isLight ? '#CBD5E1' : '#334155',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  plateText: {
    color: isLight ? '#0F172A' : '#F8FAFC',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  centerBox: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: isLight ? '#0F172A' : '#FFFFFF',
    marginTop: 6,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
  },
  showAllBtn: {
    marginTop: 10,
    backgroundColor: isLight ? '#EFF6FF' : 'rgba(56,189,248,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: isLight ? '#BFDBFE' : 'rgba(56,189,248,0.25)',
  },
  showAllBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: isLight ? '#1D4ED8' : '#38BDF8',
  },
});
