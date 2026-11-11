const { getPool, sql } = require('../config/db');

/**
 * Helper to compute date range from presets:
 * - 'today'
 * - 'yesterday'
 * - 'thisWeek'
 * - 'thisMonth'
 * - 'thisYear'
 * - or explicit startDate & endDate ('YYYY-MM-DD')
 */
function resolveDateRange(query) {
  const { period, startDate, endDate } = query || {};
  const today = new Date();
  
  if (startDate && endDate) {
    return {
      start: startDate,
      end: endDate,
    };
  }

  const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (period === 'today') {
    const dt = formatDate(today);
    return { start: dt, end: dt };
  }

  if (period === 'yesterday') {
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const dt = formatDate(yest);
    return { start: dt, end: dt };
  }

  if (period === 'thisWeek') {
    const firstDay = new Date(today);
    const dayOfWeek = today.getDay(); // 0 is Sunday
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday start
    firstDay.setDate(diff);
    return { start: formatDate(firstDay), end: formatDate(today) };
  }

  if (period === 'thisMonth') {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: formatDate(firstDay), end: formatDate(today) };
  }

  if (period === 'thisYear') {
    const firstDay = new Date(today.getFullYear(), 0, 1);
    return { start: formatDate(firstDay), end: formatDate(today) };
  }

  // Default: past 30 days
  const past30 = new Date(today);
  past30.setDate(past30.getDate() - 30);
  return { start: formatDate(past30), end: formatDate(today) };
}

/**
 * 1. GET /api/carwash/reports/summary
 * KPI Summary metrics (Washes, Revenue, Customers, Vehicles, AOV, Avg Duration)
 */
async function getSalesSummary(req, res) {
  try {
    const pool = await getPool();
    const { start, end } = resolveDateRange(req.query);
    const bayId = req.query.bayId ? parseInt(req.query.bayId, 10) : null;
    const orderSource = req.query.orderSource || null;

    const request = pool.request()
      .input('StartDate', sql.Date, start)
      .input('EndDate', sql.Date, end)
      .input('BayId', sql.Int, bayId)
      .input('OrderSource', sql.NVarChar(20), orderSource);

    const result = await request.execute('dbo.sp_CarWash_SalesSummary');
    const row = result.recordset[0] || {};

    return res.status(200).json({
      success: true,
      period: { startDate: start, endDate: end },
      data: {
        totalWashes: Number(row.TotalWashes || row.TotalCompletedWashes || 0),
        totalCompletedWashes: Number(row.TotalCompletedWashes || 0),
        totalClosedWashes: Number(row.TotalClosedWashes || 0),
        totalActiveWashes: Number(row.TotalActiveWashes || 0),
        totalCancelledWashes: Number(row.TotalCancelledWashes || 0),
        totalBookings: Number(row.TotalBookings || 0),
        totalRevenue: Number(row.TotalRevenue || 0),
        totalNetRevenue: Number(row.TotalNetRevenue || 0),
        totalGSTAmount: Number(row.TotalGSTAmount || 0),
        totalUniqueCustomers: Number(row.TotalUniqueCustomers || 0),
        totalUniqueVehicles: Number(row.TotalUniqueVehicles || 0),
        averageOrderValue: Number(row.AverageOrderValue || 0),
        avgWashDurationMinutes: Number(row.AvgWashDurationMinutes || 0),
      },
    });
  } catch (err) {
    console.error('[SalesReport getSalesSummary Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch sales summary', error: err.message });
  }
}

/**
 * 2. GET /api/carwash/reports/service-wise
 * Service distribution & package sales share
 */
async function getServiceWiseSales(req, res) {
  try {
    const pool = await getPool();
    const { start, end } = resolveDateRange(req.query);

    const result = await pool.request()
      .input('StartDate', sql.Date, start)
      .input('EndDate', sql.Date, end)
      .execute('dbo.sp_CarWash_ServiceWiseSales');

    const data = result.recordset.map((r) => ({
      serviceCategoryId: r.ServiceCategoryId,
      serviceCategoryName: r.ServiceCategoryName,
      packageId: r.PackageId,
      packageName: r.PackageName,
      totalWashes: Number(r.TotalWashes || 0),
      netSales: Number(r.NetSales || 0),
      gstSales: Number(r.GSTSales || 0),
      grossRevenue: Number(r.GrossRevenue || 0),
      washSharePercentage: Number(r.WashSharePercentage || 0),
      revenueSharePercentage: Number(r.RevenueSharePercentage || 0),
    }));

    return res.status(200).json({
      success: true,
      period: { startDate: start, endDate: end },
      count: data.length,
      data,
    });
  } catch (err) {
    console.error('[SalesReport getServiceWiseSales Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch service-wise sales', error: err.message });
  }
}

/**
 * 3. GET /api/carwash/reports/bay-utilization
 * Bay utilization %, active minutes, and revenue generated
 */
async function getBayUtilization(req, res) {
  try {
    const pool = await getPool();
    const { start, end } = resolveDateRange(req.query);

    const result = await pool.request()
      .input('StartDate', sql.Date, start)
      .input('EndDate', sql.Date, end)
      .execute('dbo.sp_CarWash_BayUtilization');

    const data = result.recordset.map((r) => ({
      bayNumber: Number(r.BayNumber),
      bayName: r.BayName || `Bay ${r.BayNumber}`,
      bayType: r.BayType || 'STANDARD',
      currentStatus: r.CurrentStatus || 'AVAILABLE',
      totalWashesHandled: Number(r.TotalWashesHandled || 0),
      totalRevenueGenerated: Number(r.TotalRevenueGenerated || 0),
      totalActiveMinutes: Number(r.TotalActiveMinutes || 0),
      avgServiceMinutesPerCar: Number(r.AvgServiceMinutesPerCar || 0),
      utilizationPercentage: Number(r.UtilizationPercentage || 0),
    }));

    return res.status(200).json({
      success: true,
      period: { startDate: start, endDate: end },
      count: data.length,
      data,
    });
  } catch (err) {
    console.error('[SalesReport getBayUtilization Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch bay utilization', error: err.message });
  }
}

/**
 * 4. GET /api/carwash/reports/payment-mix
 * Payment channel distribution (Cash, Credit, Member, etc.)
 */
async function getPaymentChannelMix(req, res) {
  try {
    const pool = await getPool();
    const { start, end } = resolveDateRange(req.query);

    const result = await pool.request()
      .input('StartDate', sql.Date, start)
      .input('EndDate', sql.Date, end)
      .execute('dbo.sp_CarWash_PaymentChannelMix');

    const data = result.recordset.map((r) => ({
      paymentChannel: (r.PaymentChannel || '').trim(),
      paymentChannelName: (r.PaymentChannelName || '').trim(),
      transactionCount: Number(r.TransactionCount || 0),
      netSales: Number(r.NetSales || 0),
      gstAmount: Number(r.GSTAmount || 0),
      totalAmount: Number(r.TotalAmount || 0),
      volumePercentage: Number(r.VolumePercentage || 0),
      revenuePercentage: Number(r.RevenuePercentage || 0),
    }));

    return res.status(200).json({
      success: true,
      period: { startDate: start, endDate: end },
      count: data.length,
      data,
    });
  } catch (err) {
    console.error('[SalesReport getPaymentChannelMix Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch payment channel mix', error: err.message });
  }
}

/**
 * 5. GET /api/carwash/reports/wash-trend
 * Date-wise volume and revenue trend
 */
async function getDateWiseWashTrend(req, res) {
  try {
    const pool = await getPool();
    const { start, end } = resolveDateRange(req.query);

    const result = await pool.request()
      .input('StartDate', sql.Date, start)
      .input('EndDate', sql.Date, end)
      .execute('dbo.sp_CarWash_DateWiseWashTrend');

    const data = result.recordset.map((r) => ({
      orderDate: r.OrderDate instanceof Date ? r.OrderDate.toISOString().split('T')[0] : r.OrderDate,
      dayName: r.DayName,
      completedWashes: Number(r.CompletedWashes || 0),
      cancelledOrders: Number(r.CancelledOrders || 0),
      totalOrders: Number(r.TotalOrders || 0),
      dailyRevenue: Number(r.DailyRevenue || 0),
      dailyGST: Number(r.DailyGST || 0),
    }));

    return res.status(200).json({
      success: true,
      period: { startDate: start, endDate: end },
      count: data.length,
      data,
    });
  } catch (err) {
    console.error('[SalesReport getDateWiseWashTrend Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch wash trend', error: err.message });
  }
}

/**
 * 6. GET /api/carwash/reports/recent-washes
 * Recent wash orders
 */
async function getRecentWashes(req, res) {
  try {
    const pool = await getPool();
    const { start, end } = resolveDateRange(req.query);
    const topCount = req.query.limit ? parseInt(req.query.limit, 10) : 100;

    const result = await pool.request()
      .input('TopCount', sql.Int, topCount)
      .input('StartDate', sql.Date, start)
      .input('EndDate', sql.Date, end)
      .execute('dbo.sp_CarWash_RecentWashes');

    const data = result.recordset.map((r) => ({
      orderId: r.OrderId,
      orderNo: r.OrderNo,
      customerName: r.CustomerName,
      vehicleNumber: r.VehicleNumber,
      vehicleTypeName: r.VehicleTypeName || 'Standard Vehicle',
      packageName: r.PackageName || 'Wash Package',
      serviceCategoryName: r.ServiceCategoryName || 'Car Wash',
      bayId: r.BayId,
      bayName: r.BayName || (r.BayId ? `Bay ${r.BayId}` : 'Unassigned'),
      totalAmount: Number(r.TotalAmount || 0),
      statusCode: r.StatusCode,
      statusName: r.StatusName,
      startedDate: r.StartedDate,
      completedDate: r.CompletedDate,
      durationMinutes: r.DurationMinutes,
      createdDate: r.CreatedDate,
    }));

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error('[SalesReport getRecentWashes Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch recent washes', error: err.message });
  }
}

/**
 * 7. GET /api/carwash/reports/recent-transactions
 * Recent financial transactions
 */
async function getRecentTransactions(req, res) {
  try {
    const pool = await getPool();
    const { start, end } = resolveDateRange(req.query);
    const topCount = req.query.limit ? parseInt(req.query.limit, 10) : 100;

    const result = await pool.request()
      .input('TopCount', sql.Int, topCount)
      .input('StartDate', sql.Date, start)
      .input('EndDate', sql.Date, end)
      .execute('dbo.sp_CarWash_RecentTransactions');

    const data = result.recordset.map((r) => ({
      orderId: r.OrderId,
      orderNo: r.OrderNo,
      customerName: r.CustomerName,
      vehicleNumber: r.VehicleNumber,
      packageName: r.PackageName,
      payMode: (r.PayMode || '').trim(),
      payModeDescription: (r.PayModeDescription || r.PayMode || '').trim(),
      netAmount: Number(r.NetAmount || 0),
      gstAmount: Number(r.GSTAmount || 0),
      totalAmount: Number(r.TotalAmount || 0),
      paymentStatus: r.PaymentStatus,
      paymentReference: r.PaymentReference,
      orderSource: r.OrderSource || 'KIOSK',
      paidDate: r.PaidDate,
      createdDate: r.CreatedDate,
    }));

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error('[SalesReport getRecentTransactions Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch recent transactions', error: err.message });
  }
}

/**
 * 8. GET /api/carwash/reports/dashboard
 * Aggregates all dashboard sections into a single comprehensive payload
 */
async function getFullDashboard(req, res) {
  try {
    const pool = await getPool();
    const { start, end } = resolveDateRange(req.query);

    // Run parallel queries using connection pool
    const [summaryRes, serviceRes, bayRes, paymentRes, trendRes, washesRes, txRes] = await Promise.all([
      pool.request().input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_SalesSummary'),
      pool.request().input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_ServiceWiseSales'),
      pool.request().input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_BayUtilization'),
      pool.request().input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_PaymentChannelMix'),
      pool.request().input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_DateWiseWashTrend'),
      pool.request().input('TopCount', sql.Int, 100).input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_RecentWashes'),
      pool.request().input('TopCount', sql.Int, 100).input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_RecentTransactions'),
    ]);

    const sRow = summaryRes.recordset[0] || {};

    return res.status(200).json({
      success: true,
      period: { startDate: start, endDate: end },
      summary: {
        totalWashes: Number(sRow.TotalWashes || sRow.TotalCompletedWashes || 0),
        totalCompletedWashes: Number(sRow.TotalCompletedWashes || 0),
        totalClosedWashes: Number(sRow.TotalClosedWashes || 0),
        totalActiveWashes: Number(sRow.TotalActiveWashes || 0),
        totalCancelledWashes: Number(sRow.TotalCancelledWashes || 0),
        totalBookings: Number(sRow.TotalBookings || 0),
        totalRevenue: Number(sRow.TotalRevenue || 0),
        totalNetRevenue: Number(sRow.TotalNetRevenue || 0),
        totalGSTAmount: Number(sRow.TotalGSTAmount || 0),
        totalUniqueCustomers: Number(sRow.TotalUniqueCustomers || 0),
        totalUniqueVehicles: Number(sRow.TotalUniqueVehicles || 0),
        averageOrderValue: Number(sRow.AverageOrderValue || 0),
        avgWashDurationMinutes: Number(sRow.AvgWashDurationMinutes || 0),
      },
      serviceDistribution: serviceRes.recordset.map((r) => ({
        serviceCategoryId: r.ServiceCategoryId,
        serviceCategoryName: r.ServiceCategoryName,
        packageId: r.PackageId,
        packageName: r.PackageName,
        totalWashes: Number(r.TotalWashes || 0),
        netSales: Number(r.NetSales || 0),
        gstSales: Number(r.GSTSales || 0),
        grossRevenue: Number(r.GrossRevenue || 0),
        washSharePercentage: Number(r.WashSharePercentage || 0),
        revenueSharePercentage: Number(r.RevenueSharePercentage || 0),
      })),
      bayUtilization: bayRes.recordset.map((r) => ({
        bayNumber: Number(r.BayNumber),
        bayName: r.BayName || `Bay ${r.BayNumber}`,
        bayType: r.BayType || 'STANDARD',
        currentStatus: r.CurrentStatus || 'AVAILABLE',
        totalWashesHandled: Number(r.TotalWashesHandled || 0),
        totalRevenueGenerated: Number(r.TotalRevenueGenerated || 0),
        totalActiveMinutes: Number(r.TotalActiveMinutes || 0),
        avgServiceMinutesPerCar: Number(r.AvgServiceMinutesPerCar || 0),
        utilizationPercentage: Number(r.UtilizationPercentage || 0),
      })),
      paymentChannelMix: paymentRes.recordset.map((r) => ({
        paymentChannel: (r.PaymentChannel || '').trim(),
        paymentChannelName: (r.PaymentChannelName || '').trim(),
        transactionCount: Number(r.TransactionCount || 0),
        netSales: Number(r.NetSales || 0),
        gstAmount: Number(r.GSTAmount || 0),
        totalAmount: Number(r.TotalAmount || 0),
        volumePercentage: Number(r.VolumePercentage || 0),
        revenuePercentage: Number(r.RevenuePercentage || 0),
      })),
      washTrend: trendRes.recordset.map((r) => ({
        orderDate: r.OrderDate instanceof Date ? r.OrderDate.toISOString().split('T')[0] : r.OrderDate,
        dayName: r.DayName,
        completedWashes: Number(r.CompletedWashes || 0),
        cancelledOrders: Number(r.CancelledOrders || 0),
        totalOrders: Number(r.TotalOrders || 0),
        dailyRevenue: Number(r.DailyRevenue || 0),
        dailyGST: Number(r.DailyGST || 0),
      })),
      recentWashes: washesRes.recordset.map((r) => ({
        orderId: r.OrderId,
        orderNo: r.OrderNo,
        customerName: r.CustomerName,
        vehicleNumber: r.VehicleNumber,
        vehicleTypeName: r.VehicleTypeName || 'Standard Vehicle',
        packageName: r.PackageName || 'Wash Package',
        serviceCategoryName: r.ServiceCategoryName || 'Car Wash',
        bayId: r.BayId,
        bayName: r.BayName || (r.BayId ? `Bay ${r.BayId}` : 'Unassigned'),
        totalAmount: Number(r.TotalAmount || 0),
        statusCode: r.StatusCode,
        statusName: r.StatusName,
        startedDate: r.StartedDate,
        completedDate: r.CompletedDate,
        durationMinutes: r.DurationMinutes,
        createdDate: r.CreatedDate,
      })),
      recentTransactions: txRes.recordset.map((r) => ({
        orderId: r.OrderId,
        orderNo: r.OrderNo,
        customerName: r.CustomerName,
        vehicleNumber: r.VehicleNumber,
        packageName: r.PackageName,
        payMode: (r.PayMode || '').trim(),
        payModeDescription: (r.PayModeDescription || r.PayMode || '').trim(),
        netAmount: Number(r.NetAmount || 0),
        gstAmount: Number(r.GSTAmount || 0),
        totalAmount: Number(r.TotalAmount || 0),
        paymentStatus: r.PaymentStatus,
        paymentReference: r.PaymentReference,
        orderSource: r.OrderSource || 'KIOSK',
        paidDate: r.PaidDate,
        createdDate: r.CreatedDate,
      })),
    });
  } catch (err) {
    console.error('[SalesReport getFullDashboard Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch full sales dashboard', error: err.message });
  }
}

module.exports = {
  getSalesSummary,
  getServiceWiseSales,
  getBayUtilization,
  getPaymentChannelMix,
  getDateWiseWashTrend,
  getRecentWashes,
  getRecentTransactions,
  getFullDashboard,
};

