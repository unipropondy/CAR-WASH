const { getPool, sql } = require('../config/db');

/**
 * Helper to get the active or most recent Business Date from dbo.CarWashDayMaster
 */
async function getEffectiveBusinessDate(pool) {
  try {
    const res = await pool.request().query(`
      SELECT TOP 1 BusinessDate, DayStatus
      FROM dbo.CarWashDayMaster
      ORDER BY CASE WHEN DayStatus = 'OPEN' THEN 0 ELSE 1 END, DayId DESC;
    `);
    if (res.recordset.length && res.recordset[0].BusinessDate) {
      const bd = res.recordset[0].BusinessDate;
      if (bd instanceof Date) {
        const y = bd.getFullYear();
        const m = String(bd.getMonth() + 1).padStart(2, '0');
        const d = String(bd.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return String(bd).split('T')[0];
    }
  } catch (err) {
    console.warn('[getEffectiveBusinessDate Warning]', err.message);
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Helper to compute date range from presets or explicit dates.
 * Always resolves relative to the active Business Date (from Day Start / Day End)
 * rather than system/calendar date.
 */
async function resolveDateRange(query, pool) {
  const { period, startDate, endDate } = query || {};
  const activeBusinessDate = await getEffectiveBusinessDate(pool);
  
  if (startDate && endDate) {
    return {
      start: startDate,
      end: endDate,
      activeBusinessDate,
    };
  }

  if (startDate && !endDate) {
    return {
      start: startDate,
      end: startDate,
      activeBusinessDate,
    };
  }

  const parts = activeBusinessDate.split('-').map(Number);
  const baseDate = new Date(parts[0], parts[1] - 1, parts[2]);

  const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (period === 'today') {
    return { start: activeBusinessDate, end: activeBusinessDate, activeBusinessDate };
  }

  if (period === 'yesterday') {
    const yest = new Date(baseDate);
    yest.setDate(yest.getDate() - 1);
    const dt = formatDate(yest);
    return { start: dt, end: dt, activeBusinessDate };
  }

  if (period === 'thisWeek') {
    const past7 = new Date(baseDate);
    past7.setDate(past7.getDate() - 7);
    return { start: formatDate(past7), end: activeBusinessDate, activeBusinessDate };
  }

  if (period === 'thisMonth') {
    const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    return { start: formatDate(firstDay), end: activeBusinessDate, activeBusinessDate };
  }

  if (period === 'thisYear') {
    const firstDay = new Date(baseDate.getFullYear(), 0, 1);
    return { start: formatDate(firstDay), end: activeBusinessDate, activeBusinessDate };
  }

  // Default: past 30 days up to activeBusinessDate
  const past30 = new Date(baseDate);
  past30.setDate(past30.getDate() - 30);
  return { start: formatDate(past30), end: activeBusinessDate, activeBusinessDate };
}

/**
 * 1. GET /api/carwash/reports/summary
 * KPI Summary metrics (Washes, Revenue, Customers, Vehicles, AOV, Avg Duration)
 */
async function getSalesSummary(req, res) {
  try {
    const pool = await getPool();
    const { start, end, activeBusinessDate } = await resolveDateRange(req.query, pool);
    const bayId = req.query.bayId ? parseInt(req.query.bayId, 10) : null;
    const orderSource = req.query.orderSource || null;

    const request = pool.request()
      .input('StartDate', sql.Date, start)
      .input('EndDate', sql.Date, end)
      .input('BayId', sql.Int, bayId)
      .input('OrderSource', sql.NVarChar(20), orderSource);

    const result = await request.execute('dbo.sp_CarWash_SalesSummary');
    const row = result.recordset[0] || {};
    const totalWashesVal = Number(row.TotalWashes || (Number(row.TotalCompletedWashes || 0) + Number(row.TotalClosedWashes || 0)) || 0);

    return res.status(200).json({
      success: true,
      period: { startDate: start, endDate: end },
      activeBusinessDate,
      data: {
        totalWashes: totalWashesVal,
        totalCompletedWashes: totalWashesVal,
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
    const { start, end, activeBusinessDate } = await resolveDateRange(req.query, pool);

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
      activeBusinessDate,
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
    const { start, end, activeBusinessDate } = await resolveDateRange(req.query, pool);

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
      activeBusinessDate,
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
    const { start, end, activeBusinessDate } = await resolveDateRange(req.query, pool);

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
      activeBusinessDate,
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
    const { start, end, activeBusinessDate } = await resolveDateRange(req.query, pool);

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
      activeBusinessDate,
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
    const { start, end, activeBusinessDate } = await resolveDateRange(req.query, pool);
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
      period: { startDate: start, endDate: end },
      activeBusinessDate,
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
    const { start, end, activeBusinessDate } = await resolveDateRange(req.query, pool);
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
      period: { startDate: start, endDate: end },
      activeBusinessDate,
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
    const { start, end, activeBusinessDate } = await resolveDateRange(req.query, pool);

    // Execute queries using connection pool
    const summaryRes = await pool.request().input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_SalesSummary');
    const serviceRes = await pool.request().input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_ServiceWiseSales');
    const bayRes = await pool.request().input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_BayUtilization');
    const paymentRes = await pool.request().input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_PaymentChannelMix');
    const trendRes = await pool.request().input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_DateWiseWashTrend');
    const washesRes = await pool.request().input('TopCount', sql.Int, 100).input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_RecentWashes');
    const txRes = await pool.request().input('TopCount', sql.Int, 100).input('StartDate', sql.Date, start).input('EndDate', sql.Date, end).execute('dbo.sp_CarWash_RecentTransactions');

    const sRow = summaryRes.recordset[0] || {};

    const trendCompletedSum = (trendRes.recordset || []).reduce(
      (sum, r) => sum + Number(r.CompletedWashes || r.TotalOrders || 0), 0
    );
    const calculatedTotalWashes = Number(
      sRow.TotalWashes || 
      (Number(sRow.TotalCompletedWashes || 0) + Number(sRow.TotalClosedWashes || 0)) || 
      trendCompletedSum || 
      0
    );

    let rawTransactions = txRes.recordset || [];
    try {
      const fullTxRes = await pool.request()
        .input('StartDate', sql.Date, start)
        .input('EndDate', sql.Date, end)
        .input('TopCount', sql.Int, 100)
        .query(`
          SELECT TOP (@TopCount)
              o.OrderId,
              o.OrderNo,
              o.CustomerName,
              o.VehicleNumber,
              p.PackageName,
              ISNULL(RTRIM(o.PayMode), 'CARD') AS PayMode,
              ISNULL(pm.Description, RTRIM(o.PayMode)) AS PayModeDescription,
              ISNULL(o.PackagePrice, o.TotalAmount) AS NetAmount,
              ISNULL(o.GSTAmount, 0) AS GSTAmount,
              ISNULL(o.TotalAmount, 0) AS TotalAmount,
              ISNULL(o.PaymentStatus, 'PAID') AS PaymentStatus,
              o.PaymentReference,
              ISNULL(o.OrderSource, 'KIOSK') AS OrderSource,
              ISNULL(o.PaidDate, o.CreatedDate) AS PaidDate,
              o.CreatedDate,
              COALESCE(o.BusinessDate, dm.BusinessDate, CAST(o.CreatedDate AS DATE)) AS BusinessDate
          FROM dbo.CarWashOrder o
          LEFT JOIN dbo.CarWashDayMaster dm ON o.DayId = dm.DayId
          LEFT JOIN dbo.ServicePackageMaster p ON o.PackageId = p.PackageId
          LEFT JOIN dbo.Paymode pm ON RTRIM(o.PayMode) = RTRIM(pm.PayMode)
          WHERE (o.PaymentStatus = 'PAID' OR o.StatusCode IN (30, 40, 50, 60, 70) OR o.TotalAmount > 0)
            AND o.StatusCode != 80
            AND (@StartDate IS NULL OR COALESCE(o.BusinessDate, dm.BusinessDate, CAST(o.CreatedDate AS DATE)) >= @StartDate)
            AND (@EndDate IS NULL OR COALESCE(o.BusinessDate, dm.BusinessDate, CAST(o.CreatedDate AS DATE)) <= @EndDate)
          ORDER BY o.OrderId DESC;
        `);
      if (fullTxRes.recordset && fullTxRes.recordset.length > 0) {
        rawTransactions = fullTxRes.recordset;
      }
    } catch (txErr) {
      console.warn('[Full Transactions Query Fallback Warning]', txErr.message);
    }

    // Merge any washes from washesRes that have TotalAmount > 0 if not already present
    const existingTxIds = new Set(rawTransactions.map(r => r.OrderId));
    (washesRes.recordset || []).forEach(w => {
      if (!existingTxIds.has(w.OrderId) && Number(w.TotalAmount || 0) > 0) {
        rawTransactions.push({
          OrderId: w.OrderId,
          OrderNo: w.OrderNo,
          CustomerName: w.CustomerName,
          VehicleNumber: w.VehicleNumber,
          PackageName: w.PackageName,
          PayMode: 'CARD',
          PayModeDescription: 'Card / Electronic',
          NetAmount: Number(w.TotalAmount || 0),
          GSTAmount: 0,
          TotalAmount: Number(w.TotalAmount || 0),
          PaymentStatus: 'PAID',
          OrderSource: 'KIOSK',
          PaidDate: w.CompletedDate || w.StartedDate || w.CreatedDate,
          CreatedDate: w.CreatedDate,
        });
        existingTxIds.add(w.OrderId);
      }
    });

    rawTransactions.sort((a, b) => (b.OrderId || 0) - (a.OrderId || 0));

    return res.status(200).json({
      success: true,
      period: { startDate: start, endDate: end },
      activeBusinessDate,
      summary: {
        totalWashes: calculatedTotalWashes,
        totalCompletedWashes: calculatedTotalWashes,
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
      recentTransactions: rawTransactions.map((r) => ({
        orderId: r.OrderId,
        orderNo: r.OrderNo,
        customerName: r.CustomerName,
        vehicleNumber: r.VehicleNumber,
        packageName: r.PackageName,
        payMode: (r.PayMode || '').trim() || 'CARD',
        payModeDescription: (r.PayModeDescription || r.PayMode || '').trim() || 'Card Payment',
        netAmount: Number(r.NetAmount || 0),
        gstAmount: Number(r.GSTAmount || 0),
        totalAmount: Number(r.TotalAmount || 0),
        paymentStatus: r.PaymentStatus || 'PAID',
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

