const { getPool, sql } = require('../config/db');

/**
 * RedBay Car Wash POS - Day Management Controller
 * Handles Overall Business Day Start, Status, Cash Movement, Closing Preview, Day End, History, Details, and Audit.
 */

// Denomination defaults for Cash drawer count
const STANDARD_DENOMINATIONS = [
  { type: 'NOTE', value: 100.00, label: '$100 Note' },
  { type: 'NOTE', value: 50.00, label: '$50 Note' },
  { type: 'NOTE', value: 20.00, label: '$20 Note' },
  { type: 'NOTE', value: 10.00, label: '$10 Note' },
  { type: 'NOTE', value: 5.00, label: '$5 Note' },
  { type: 'NOTE', value: 2.00, label: '$2 Note' },
  { type: 'COIN', value: 1.00, label: '$1 Coin' },
  { type: 'COIN', value: 0.50, label: '50¢ Coin' },
  { type: 'COIN', value: 0.20, label: '20¢ Coin' },
  { type: 'COIN', value: 0.10, label: '10¢ Coin' },
  { type: 'COIN', value: 0.05, label: '5¢ Coin' },
];

/**
 * Helper to fetch the currently active OPEN day from dbo.CarWashDayMaster
 */
async function getActiveDay(txOrPool) {
  const req = txOrPool.request ? txOrPool.request() : new sql.Request(txOrPool);
  const result = await req.query(`
    SELECT TOP 1
      DayId,
      BusinessDate,
      DayStatus,
      OpeningCash,
      ClosingCash,
      ExpectedCash,
      CashDifference,
      TotalCashIn,
      TotalCashOut,
      TotalOrders,
      TotalSales,
      StartedBy,
      StartedDate,
      EndedBy,
      EndedDate,
      StartRemarks,
      ClosingRemarks,
      CreatedDate
    FROM dbo.CarWashDayMaster
    WHERE DayStatus = 'OPEN'
    ORDER BY DayId DESC;
  `);
  return result.recordset[0] || null;
}

/**
 * Helper to record an audit log entry
 */
async function recordAuditLog(txOrPool, { dayId, eventType, actionBy, details, ipAddress, remarks }) {
  try {
    const req = txOrPool.request ? txOrPool.request() : new sql.Request(txOrPool);
    req.input('dayId', sql.Int, dayId || null);
    req.input('eventType', sql.VarChar(50), eventType);
    req.input('actionBy', sql.NVarChar(100), actionBy || 'SYSTEM');
    req.input('details', sql.NVarChar(sql.MAX), typeof details === 'object' ? JSON.stringify(details) : details || null);
    req.input('ipAddress', sql.NVarChar(50), ipAddress || null);
    req.input('remarks', sql.NVarChar(500), remarks || null);

    await req.query(`
      INSERT INTO dbo.CarWashDayAuditLog (DayId, EventType, ActionBy, ActionDate, Details, IpAddress, Remarks)
      VALUES (@dayId, @eventType, @actionBy, GETDATE(), @details, @ipAddress, @remarks);
    `);
  } catch (err) {
    console.error('[Audit Log Error]', err.message);
  }
}

/**
 * Helper: Calculate complete live metrics for a given DayId
 */
async function calculateDayMetrics(pool, dayId) {
  // 1. Fetch Day Master
  const dmReq = pool.request();
  dmReq.input('dayId', sql.Int, dayId);
  const dmRes = await dmReq.query(`
    SELECT 
      DayId, BusinessDate, DayStatus, OpeningCash, ClosingCash, ExpectedCash,
      CashDifference, TotalCashIn, TotalCashOut, StartedBy, StartedDate,
      EndedBy, EndedDate, StartRemarks, ClosingRemarks, CreatedDate
    FROM dbo.CarWashDayMaster
    WHERE DayId = @dayId;
  `);

  if (!dmRes.recordset.length) return null;
  const dayMaster = dmRes.recordset[0];
  const openingCash = Number(dayMaster.OpeningCash || 0);
  const isDayOpen = dayMaster.DayStatus === 'OPEN';
  const startedDate = dayMaster.StartedDate || dayMaster.BusinessDate;
  const endedDate = dayMaster.EndedDate || new Date();

  // 2. Orders summary for this day
  const ordersReq = pool.request();
  ordersReq.input('dayId', sql.Int, dayId);
  ordersReq.input('startedDate', sql.DateTime, startedDate);
  ordersReq.input('endedDate', sql.DateTime, endedDate);

  const orderCondition = isDayOpen
    ? `(DayId = @dayId OR (DayId IS NULL AND CreatedDate >= @startedDate))`
    : `(DayId = @dayId OR (DayId IS NULL AND CreatedDate >= @startedDate AND CreatedDate <= @endedDate))`;

  const orderConditionPrefixed = isDayOpen
    ? `(o.DayId = @dayId OR (o.DayId IS NULL AND o.CreatedDate >= @startedDate))`
    : `(o.DayId = @dayId OR (o.DayId IS NULL AND o.CreatedDate >= @startedDate AND o.CreatedDate <= @endedDate))`;

  const ordersRes = await ordersReq.query(`
    SELECT
      COUNT(*) AS TotalOrders,
      ISNULL(SUM(CASE WHEN PaymentStatus = 'PAID' THEN TotalAmount ELSE 0 END), 0) AS TotalPaidSales,
      ISNULL(SUM(CASE WHEN PaymentStatus = 'PAID' THEN PackagePrice ELSE 0 END), 0) AS TotalPackageSales,
      ISNULL(SUM(CASE WHEN PaymentStatus = 'PAID' THEN GSTAmount ELSE 0 END), 0) AS TotalGSTAmount,
      ISNULL(SUM(CASE WHEN PaymentStatus = 'PAID' AND (CustomerName LIKE 'DEALER%' OR OrderSource = 'DEALER' OR RTRIM(PayMode) = 'CREDIT') THEN TotalAmount ELSE 0 END), 0) AS TotalDealerSales,
      ISNULL(SUM(CASE WHEN PaymentStatus = 'PAID' AND NOT (CustomerName LIKE 'DEALER%' OR OrderSource = 'DEALER' OR RTRIM(PayMode) = 'CREDIT') THEN TotalAmount ELSE 0 END), 0) AS TotalCustomerSales,
      ISNULL(SUM(CASE WHEN PaymentStatus = 'PENDING' AND StatusCode != 80 THEN 1 ELSE 0 END), 0) AS PendingPaymentCount,
      ISNULL(SUM(CASE WHEN PaymentStatus = 'PENDING' AND StatusCode != 80 THEN TotalAmount ELSE 0 END), 0) AS PendingPaymentAmount,
      ISNULL(SUM(CASE WHEN StatusCode IN (10, 20, 30, 40, 50) THEN 1 ELSE 0 END), 0) AS IncompleteWashOrderCount,
      ISNULL(SUM(CASE WHEN StatusCode = 60 THEN 1 ELSE 0 END), 0) AS CompletedWashOrderCount,
      ISNULL(SUM(CASE WHEN StatusCode = 70 THEN 1 ELSE 0 END), 0) AS ClosedWashOrderCount,
      ISNULL(SUM(CASE WHEN StatusCode = 80 THEN 1 ELSE 0 END), 0) AS CancelledWashOrderCount
    FROM dbo.CarWashOrder
    WHERE ${orderCondition};
  `);
  const ord = ordersRes.recordset[0] || {};

  // 3. Tender breakdown
  const tenderReq = pool.request();
  tenderReq.input('dayId', sql.Int, dayId);
  tenderReq.input('startedDate', sql.DateTime, startedDate);
  tenderReq.input('endedDate', sql.DateTime, endedDate);
  const tenderRes = await tenderReq.query(`
    SELECT
      RTRIM(ISNULL(PayMode, 'UNSPECIFIED')) AS PayMode,
      COUNT(*) AS TransactionCount,
      ISNULL(SUM(TotalAmount), 0) AS TotalAmount
    FROM dbo.CarWashOrder
    WHERE ${orderCondition} AND PaymentStatus = 'PAID'
    GROUP BY RTRIM(ISNULL(PayMode, 'UNSPECIFIED'));
  `);

  let cashSales = 0;
  let cardSales = 0;
  let onlineSales = 0;
  let otherSales = 0;

  const tenders = tenderRes.recordset.map((t) => {
    const mode = (t.PayMode || '').trim().toUpperCase();
    const amt = Number(t.TotalAmount || 0);
    if (mode === 'CASH') {
      cashSales += amt;
    } else if (mode === 'CARD') {
      cardSales += amt;
    } else if (mode === 'PAYNOW' || mode === 'ONLINE' || mode === 'NETS') {
      onlineSales += amt;
    } else {
      otherSales += amt;
    }
    return {
      payMode: mode,
      count: Number(t.TransactionCount || 0),
      amount: amt,
    };
  });

  // 4. Package-wise breakdown
  const pkgReq = pool.request();
  pkgReq.input('dayId', sql.Int, dayId);
  pkgReq.input('startedDate', sql.DateTime, startedDate);
  pkgReq.input('endedDate', sql.DateTime, endedDate);
  const pkgRes = await pkgReq.query(`
    SELECT
      ISNULL(sp.PackageName, 'Custom Wash') AS PackageName,
      COUNT(o.OrderId) AS OrderCount,
      ISNULL(SUM(o.TotalAmount), 0) AS TotalAmount,
      ISNULL(SUM(o.PackagePrice), 0) AS PackagePrice
    FROM dbo.CarWashOrder o
    LEFT JOIN dbo.ServicePackageMaster sp ON o.PackageId = sp.PackageId
    WHERE ${orderConditionPrefixed} AND o.PaymentStatus = 'PAID'
    GROUP BY ISNULL(sp.PackageName, 'Custom Wash')
    ORDER BY TotalAmount DESC;
  `);

  // 5. Cash movements (Cash In / Cash Out)
  const cmReq = pool.request();
  cmReq.input('dayId', sql.Int, dayId);
  const cmRes = await cmReq.query(`
    SELECT
      ISNULL(SUM(CASE WHEN MovementType = 'CASH_IN' THEN Amount ELSE 0 END), 0) AS TotalCashIn,
      ISNULL(SUM(CASE WHEN MovementType = 'CASH_OUT' THEN Amount ELSE 0 END), 0) AS TotalCashOut,
      COUNT(*) AS MovementCount
    FROM dbo.CarWashDayCashMovement
    WHERE DayId = @dayId;
  `);
  const cm = cmRes.recordset[0] || {};
  const totalCashIn = Number(cm.TotalCashIn || 0);
  const totalCashOut = Number(cm.TotalCashOut || 0);

  // 6. Refunds
  const refReq = pool.request();
  refReq.input('dayId', sql.Int, dayId);
  const refRes = await refReq.query(`
    SELECT
      COUNT(*) AS RefundCount,
      ISNULL(SUM(RefundAmount), 0) AS TotalRefunds,
      ISNULL(SUM(CASE WHEN RTRIM(PayMode) = 'CASH' THEN RefundAmount ELSE 0 END), 0) AS CashRefunds
    FROM dbo.CarWashRefundVoidHistory
    WHERE DayId = @dayId;
  `);
  const ref = refRes.recordset[0] || {};
  const totalRefunds = Number(ref.TotalRefunds || 0);
  const cashRefunds = Number(ref.CashRefunds || 0);

  // 7. Expected cash calculation
  // Formula: Opening Cash + Cash Sales + Cash In - Cash Out - Cash Refunds
  const expectedCash = Number((openingCash + cashSales + totalCashIn - totalCashOut - cashRefunds).toFixed(2));
  const totalPaidSales = Number((ord.TotalPaidSales || 0).toFixed(2));

  return {
    dayId,
    businessDate: dayMaster.BusinessDate,
    dayStatus: dayMaster.DayStatus,
    startedBy: dayMaster.StartedBy,
    startedDate: dayMaster.StartedDate,
    endedBy: dayMaster.EndedBy,
    endedDate: dayMaster.EndedDate,
    startRemarks: dayMaster.StartRemarks,
    closingRemarks: dayMaster.ClosingRemarks,
    openingCash,
    closingCash: dayMaster.ClosingCash != null ? Number(dayMaster.ClosingCash) : null,
    expectedCash: dayMaster.ExpectedCash != null ? Number(dayMaster.ExpectedCash) : expectedCash,
    cashDifference: dayMaster.CashDifference != null ? Number(dayMaster.CashDifference) : null,
    totalOrders: Number(ord.TotalOrders || 0),
    totalSales: totalPaidSales,
    totalCustomerSales: Number((ord.TotalCustomerSales || 0).toFixed(2)),
    totalDealerSales: Number((ord.TotalDealerSales || 0).toFixed(2)),
    packageSales: Number((ord.TotalPackageSales || 0).toFixed(2)),
    addonSales: 0.00,
    aLaCarteSales: 0.00,
    cashSales: Number(cashSales.toFixed(2)),
    cardSales: Number(cardSales.toFixed(2)),
    onlineSales: Number(onlineSales.toFixed(2)),
    otherSales: Number(otherSales.toFixed(2)),
    totalCashIn,
    totalCashOut,
    totalDiscounts: 0.00,
    totalRefunds,
    cashRefunds,
    pendingPaymentsCount: Number(ord.PendingPaymentCount || 0),
    pendingPaymentsAmount: Number((ord.PendingPaymentAmount || 0).toFixed(2)),
    incompleteWashOrdersCount: Number(ord.IncompleteWashOrderCount || 0),
    completedWashOrdersCount: Number(ord.CompletedWashOrderCount || 0),
    closedWashOrdersCount: Number(ord.ClosedWashOrderCount || 0),
    cancelledWashOrdersCount: Number(ord.CancelledWashOrderCount || 0),
    tenders,
    packageBreakdown: pkgRes.recordset.map((p) => ({
      packageName: p.PackageName,
      orderCount: Number(p.OrderCount || 0),
      totalAmount: Number((p.TotalAmount || 0).toFixed(2)),
    })),
  };
}

/**
 * 1. GET /api/day-management/status
 * Returns current business day status, active DayId, business date, opening cash, etc.
 */
async function getStatus(req, res) {
  try {
    const pool = await getPool();
    const activeDay = await getActiveDay(pool);

    if (!activeDay) {
      // Find the last closed day for reference
      const lastClosedRes = await pool.request().query(`
        SELECT TOP 1
          DayId, BusinessDate, DayStatus, OpeningCash, ClosingCash,
          ExpectedCash, CashDifference, StartedBy, StartedDate, EndedBy, EndedDate
        FROM dbo.CarWashDayMaster
        WHERE DayStatus = 'CLOSED'
        ORDER BY DayId DESC;
      `);
      const lastClosed = lastClosedRes.recordset[0] || null;

      return res.status(200).json({
        success: true,
        isOpen: false,
        activeDayId: null,
        message: 'Business day is currently CLOSED. Please start a new business day to begin operations.',
        activeDay: null,
        lastClosedDay: lastClosed,
      });
    }

    // Active day exists; fetch real-time summary metrics
    const metrics = await calculateDayMetrics(pool, activeDay.DayId);

    return res.status(200).json({
      success: true,
      isOpen: true,
      activeDayId: activeDay.DayId,
      businessDate: activeDay.BusinessDate,
      activeDay: metrics,
    });
  } catch (err) {
    console.error('[DayManagement getStatus Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve business day status',
      error: err.message,
    });
  }
}

/**
 * 2. POST /api/day-management/start
 * Starts a new business day with opening cash and generates a unique DayId.
 * Validates that no day is already open.
 */
async function startDay(req, res) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    const { openingCash = 0, remarks, businessDate } = req.body || {};
    const parsedCash = !isNaN(parseFloat(openingCash)) && parseFloat(openingCash) >= 0 ? parseFloat(openingCash) : 0;

    const startedBy =
      req.user?.userName ||
      req.user?.userCode ||
      req.body.startedBy ||
      req.body.userId ||
      'Staff Cashier';

    await transaction.begin();

    // Check if an OPEN day already exists (using TABLOCKX or UPDLOCK to prevent race condition)
    const checkReq = new sql.Request(transaction);
    const checkRes = await checkReq.query(`
      SELECT TOP 1 DayId, BusinessDate, StartedBy, StartedDate 
      FROM dbo.CarWashDayMaster WITH (UPDLOCK, HOLDLOCK)
      WHERE DayStatus = 'OPEN';
    `);

    if (checkRes.recordset.length > 0) {
      await transaction.rollback();
      const openDay = checkRes.recordset[0];
      return res.status(400).json({
        success: false,
        message: `A business day is already OPEN (DayId: ${openDay.DayId}, Started by: ${openDay.StartedBy} on ${new Date(openDay.StartedDate).toLocaleString()}). You cannot start another day.`,
        openDayId: openDay.DayId,
      });
    }

    // Determine BusinessDate: user specified date or current server date
    let effectiveDate = businessDate ? new Date(businessDate) : new Date();
    if (isNaN(effectiveDate.getTime())) {
      effectiveDate = new Date();
    }
    const yyyy = effectiveDate.getFullYear();
    const mm = String(effectiveDate.getMonth() + 1).padStart(2, '0');
    const dd = String(effectiveDate.getDate()).padStart(2, '0');
    const formattedBusinessDate = `${yyyy}-${mm}-${dd}`;

    // Insert into dbo.CarWashDayMaster
    const insertReq = new sql.Request(transaction);
    insertReq.input('businessDate', sql.Date, formattedBusinessDate);
    insertReq.input('openingCash', sql.Decimal(18, 2), parsedCash);
    insertReq.input('startedBy', sql.NVarChar(100), startedBy);
    insertReq.input('startRemarks', sql.NVarChar(500), remarks || null);
    insertReq.input('createdBy', sql.NVarChar(100), startedBy);

    const insertRes = await insertReq.query(`
      INSERT INTO dbo.CarWashDayMaster (
        BusinessDate, DayStatus, OpeningCash, StartedBy, StartedDate,
        StartRemarks, CreatedBy, CreatedDate
      )
      OUTPUT 
        INSERTED.DayId, 
        INSERTED.BusinessDate, 
        INSERTED.DayStatus, 
        INSERTED.OpeningCash, 
        INSERTED.StartedBy, 
        INSERTED.StartedDate
      VALUES (
        @businessDate, 'OPEN', @openingCash, @startedBy, GETDATE(),
        @startRemarks, @createdBy, GETDATE()
      );
    `);

    const createdDay = insertRes.recordset[0];
    const newDayId = createdDay.DayId;

    // Record Audit Log entry
    await recordAuditLog(transaction, {
      dayId: newDayId,
      eventType: 'DAY_START',
      actionBy: startedBy,
      details: {
        dayId: newDayId,
        businessDate: formattedBusinessDate,
        openingCash: parsedCash,
        remarks: remarks || '',
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'],
      remarks: `Day started with opening cash of $${parsedCash.toFixed(2)}`,
    });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: `Business Day #${newDayId} started successfully for date ${formattedBusinessDate}.`,
      data: {
        dayId: newDayId,
        businessDate: formattedBusinessDate,
        dayStatus: 'OPEN',
        openingCash: parsedCash,
        startedBy,
        startedDate: createdDay.StartedDate,
        remarks: remarks || '',
      },
    });
  } catch (err) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) {}
    }
    console.error('[DayManagement startDay Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to start business day',
      error: err.message,
    });
  }
}

/**
 * 3. GET /api/day-management/summary
 * Returns real-time financial, tender, order and cash drawer metrics for the active or requested day.
 */
async function getSummary(req, res) {
  try {
    const pool = await getPool();
    let dayId = req.query.dayId ? parseInt(req.query.dayId, 10) : null;

    if (!dayId) {
      const activeDay = await getActiveDay(pool);
      if (!activeDay) {
        return res.status(404).json({
          success: false,
          isOpen: false,
          message: 'No active business day found. Please start a business day first.',
        });
      }
      dayId = activeDay.DayId;
    }

    const metrics = await calculateDayMetrics(pool, dayId);
    if (!metrics) {
      return res.status(404).json({
        success: false,
        message: `Business day #${dayId} not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    console.error('[DayManagement getSummary Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve day summary',
      error: err.message,
    });
  }
}

/**
 * 4. POST /api/day-management/cash-movement
 * Records a Cash In or Cash Out transaction for petty cash / drawer movement.
 */
async function recordCashMovement(req, res) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    const { movementType, amount, reason, remarks } = req.body || {};
    const parsedAmount = parseFloat(amount);

    if (!movementType || !['CASH_IN', 'CASH_OUT'].includes(movementType.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid movement type. Must be either CASH_IN or CASH_OUT.',
      });
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number greater than 0.',
      });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reason for cash movement is required.',
      });
    }

    const performedBy =
      req.user?.userName ||
      req.user?.userCode ||
      req.body.performedBy ||
      req.body.userId ||
      'Staff Cashier';

    await transaction.begin();

    const activeDay = await getActiveDay(transaction);
    if (!activeDay) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot record cash movement: No business day is currently OPEN.',
      });
    }

    const normType = movementType.toUpperCase();

    // Insert into dbo.CarWashDayCashMovement
    const insReq = new sql.Request(transaction);
    insReq.input('dayId', sql.Int, activeDay.DayId);
    insReq.input('movementType', sql.VarChar(20), normType);
    insReq.input('amount', sql.Decimal(18, 2), parsedAmount);
    insReq.input('reason', sql.NVarChar(200), reason.trim());
    insReq.input('remarks', sql.NVarChar(500), remarks ? remarks.trim() : null);
    insReq.input('performedBy', sql.NVarChar(100), performedBy);

    const insRes = await insReq.query(`
      INSERT INTO dbo.CarWashDayCashMovement (
        DayId, MovementType, Amount, Reason, Remarks, PerformedBy, CreatedDate
      )
      OUTPUT 
        INSERTED.MovementId, 
        INSERTED.DayId, 
        INSERTED.MovementType, 
        INSERTED.Amount, 
        INSERTED.Reason, 
        INSERTED.Remarks, 
        INSERTED.PerformedBy, 
        INSERTED.CreatedDate
      VALUES (
        @dayId, @movementType, @amount, @reason, @remarks, @performedBy, GETDATE()
      );
    `);

    // Update running cash movement totals on dbo.CarWashDayMaster
    const updReq = new sql.Request(transaction);
    updReq.input('dayId', sql.Int, activeDay.DayId);
    updReq.input('amount', sql.Decimal(18, 2), parsedAmount);
    if (normType === 'CASH_IN') {
      await updReq.query(`
        UPDATE dbo.CarWashDayMaster
        SET TotalCashIn = TotalCashIn + @amount, UpdatedDate = GETDATE()
        WHERE DayId = @dayId;
      `);
    } else {
      await updReq.query(`
        UPDATE dbo.CarWashDayMaster
        SET TotalCashOut = TotalCashOut + @amount, UpdatedDate = GETDATE()
        WHERE DayId = @dayId;
      `);
    }

    // Record Audit Log
    await recordAuditLog(transaction, {
      dayId: activeDay.DayId,
      eventType: normType,
      actionBy: performedBy,
      details: {
        movementType: normType,
        amount: parsedAmount,
        reason: reason.trim(),
        remarks: remarks || '',
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'],
      remarks: `${normType === 'CASH_IN' ? 'Cash In' : 'Cash Out'} of $${parsedAmount.toFixed(2)} (${reason.trim()})`,
    });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: `${normType === 'CASH_IN' ? 'Cash In' : 'Cash Out'} of $${parsedAmount.toFixed(2)} recorded successfully.`,
      data: insRes.recordset[0],
    });
  } catch (err) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) {}
    }
    console.error('[DayManagement recordCashMovement Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to record cash movement',
      error: err.message,
    });
  }
}

/**
 * 5. GET /api/day-management/closing-preview
 * Pre-closing check to verify whether day can be closed cleanly.
 * Validates pending payments, incomplete wash orders, expected cash, and standard denominations.
 */
async function getClosingPreview(req, res) {
  try {
    const pool = await getPool();
    const activeDay = await getActiveDay(pool);

    if (!activeDay) {
      return res.status(404).json({
        success: false,
        isOpen: false,
        message: 'No business day is currently open.',
      });
    }

    const metrics = await calculateDayMetrics(pool, activeDay.DayId);

    // Check for blocking conditions
    const blockingIssues = [];
    const warnings = [];

    if (metrics.pendingPaymentsCount > 0) {
      blockingIssues.push(
        `There are ${metrics.pendingPaymentsCount} order(s) with pending payments ($${metrics.pendingPaymentsAmount.toFixed(2)}). All payments must be confirmed or cancelled before closing the day.`
      );
    }

    if (metrics.incompleteWashOrdersCount > 0) {
      blockingIssues.push(
        `There are ${metrics.incompleteWashOrdersCount} wash order(s) currently in progress or waiting in bay. Wash services must be marked as Completed or Closed.`
      );
    }

    const canClose = blockingIssues.length === 0;

    return res.status(200).json({
      success: true,
      canClose,
      blockingIssues,
      warnings,
      summary: metrics,
      standardDenominations: STANDARD_DENOMINATIONS,
    });
  } catch (err) {
    console.error('[DayManagement getClosingPreview Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate day closing preview',
      error: err.message,
    });
  }
}

/**
 * 6. POST /api/day-management/close
 * Closes the business day.
 * Validates pending orders and payments, computes actual closing cash, cash variance, tender summaries,
 * and saves denomination breakdown and closing audit logs within a transaction.
 */
async function closeDay(req, res) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      closingCash,
      denominations = [],
      closingRemarks,
      forceClose = true,
      endDate,
    } = req.body || {};

    let actualClosingCash = parseFloat(closingCash);

    // If denominations provided, sum up closing cash from denominations
    if (Array.isArray(denominations) && denominations.length > 0) {
      const denomSum = denominations.reduce((acc, d) => {
        const val = parseFloat(d.denominationValue || d.value || 0);
        const cnt = parseInt(d.count || d.denominationCount || 0, 10);
        return acc + (val * cnt);
      }, 0);

      if (isNaN(actualClosingCash) || actualClosingCash === 0) {
        actualClosingCash = denomSum;
      }
    }

    if (isNaN(actualClosingCash) || actualClosingCash < 0) {
      actualClosingCash = 0;
    }

    const endedBy =
      req.user?.userName ||
      req.user?.userCode ||
      req.body.endedBy ||
      req.body.userId ||
      'Staff Cashier';

    await transaction.begin();

    // Lock active day record
    const lockReq = new sql.Request(transaction);
    const lockRes = await lockReq.query(`
      SELECT TOP 1 DayId, BusinessDate, OpeningCash, StartedBy, StartedDate, DayStatus
      FROM dbo.CarWashDayMaster WITH (UPDLOCK, HOLDLOCK)
      WHERE DayStatus = 'OPEN';
    `);

    if (!lockRes.recordset.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot close business day: No day is currently OPEN.',
      });
    }

    const activeDay = lockRes.recordset[0];
    const dayId = activeDay.DayId;

    // Check for incomplete wash orders and pending payments
    const pendingReq = new sql.Request(transaction);
    pendingReq.input('dayId', sql.Int, dayId);
    const pendingRes = await pendingReq.query(`
      SELECT
        ISNULL(SUM(CASE WHEN PaymentStatus = 'PENDING' AND StatusCode != 80 THEN 1 ELSE 0 END), 0) AS PendingPaymentCount,
        ISNULL(SUM(CASE WHEN StatusCode IN (10, 20, 30, 40, 50) THEN 1 ELSE 0 END), 0) AS IncompleteOrderCount
      FROM dbo.CarWashOrder
      WHERE DayId = @dayId;
    `);

    const pendingRow = pendingRes.recordset[0] || {};
    const pendingPaymentCount = Number(pendingRow.PendingPaymentCount || 0);
    const incompleteOrderCount = Number(pendingRow.IncompleteOrderCount || 0);

    if (!forceClose && (pendingPaymentCount > 0 || incompleteOrderCount > 0)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        canClose: false,
        message: `Cannot close Day #${dayId}: There are ${pendingPaymentCount} pending payment(s) and ${incompleteOrderCount} incomplete vehicle wash order(s). Please resolve them before closing.`,
        pendingPaymentCount,
        incompleteOrderCount,
      });
    }

    // Compute live metrics for final closing snapshot
    const metrics = await calculateDayMetrics(pool, dayId);
    const expectedCash = metrics.expectedCash;
    const cashDifference = Number((actualClosingCash - expectedCash).toFixed(2));

    // 1. Save Denomination Details into dbo.CarWashDayClosingDetails
    if (Array.isArray(denominations) && denominations.length > 0) {
      for (const d of denominations) {
        const val = parseFloat(d.denominationValue || d.value || 0);
        const cnt = parseInt(d.count || d.denominationCount || 0, 10);
        const type = (d.denominationType || d.type || (val >= 2 ? 'NOTE' : 'COIN')).toUpperCase();
        const total = Number((val * cnt).toFixed(2));

        if (cnt > 0) {
          const denomReq = new sql.Request(transaction);
          denomReq.input('dayId', sql.Int, dayId);
          denomReq.input('type', sql.VarChar(10), type === 'NOTE' ? 'NOTE' : 'COIN');
          denomReq.input('val', sql.Decimal(18, 2), val);
          denomReq.input('cnt', sql.Int, cnt);
          denomReq.input('tot', sql.Decimal(18, 2), total);

          await denomReq.query(`
            INSERT INTO dbo.CarWashDayClosingDetails (
              DayId, DenominationType, DenominationValue, DenominationCount, TotalAmount, CreatedDate
            )
            VALUES (
              @dayId, @type, @val, @cnt, @tot, GETDATE()
            );
          `);
        }
      }
    }

    // 2. Save Tender Summary into dbo.CarWashDayTenderSummary
    if (metrics.tenders && metrics.tenders.length > 0) {
      for (const t of metrics.tenders) {
        const tReq = new sql.Request(transaction);
        tReq.input('dayId', sql.Int, dayId);
        tReq.input('payMode', sql.Char(10), t.payMode);
        tReq.input('payModeName', sql.VarChar(50), t.payMode);
        tReq.input('txCount', sql.Int, t.count);
        tReq.input('totAmt', sql.Decimal(18, 2), t.amount);
        tReq.input('refCount', sql.Int, 0);
        tReq.input('refAmt', sql.Decimal(18, 2), 0);
        tReq.input('netAmt', sql.Decimal(18, 2), t.amount);

        await tReq.query(`
          INSERT INTO dbo.CarWashDayTenderSummary (
            DayId, PayMode, PayModeName, TransactionCount, TotalAmount, RefundCount, RefundAmount, NetAmount, CreatedDate
          )
          VALUES (
            @dayId, @payMode, @payModeName, @txCount, @totAmt, @refCount, @refAmt, @netAmt, GETDATE()
          );
        `);
      }
    }

    // 3. Update dbo.CarWashDayMaster to CLOSED
    const closeReq = new sql.Request(transaction);
    closeReq.input('dayId', sql.Int, dayId);
    closeReq.input('closingCash', sql.Decimal(18, 2), actualClosingCash);
    closeReq.input('expectedCash', sql.Decimal(18, 2), expectedCash);
    closeReq.input('cashDifference', sql.Decimal(18, 2), cashDifference);
    closeReq.input('totalOrders', sql.Int, metrics.totalOrders);
    closeReq.input('totalSales', sql.Decimal(18, 2), metrics.totalSales);
    closeReq.input('totalCustSales', sql.Decimal(18, 2), metrics.totalCustomerSales);
    closeReq.input('totalDealerSales', sql.Decimal(18, 2), metrics.totalDealerSales);
    closeReq.input('packageSales', sql.Decimal(18, 2), metrics.packageSales);
    closeReq.input('addonSales', sql.Decimal(18, 2), metrics.addonSales);
    closeReq.input('aLaCarteSales', sql.Decimal(18, 2), metrics.aLaCarteSales);
    closeReq.input('cashSales', sql.Decimal(18, 2), metrics.cashSales);
    closeReq.input('cardSales', sql.Decimal(18, 2), metrics.cardSales);
    closeReq.input('onlineSales', sql.Decimal(18, 2), metrics.onlineSales);
    closeReq.input('otherSales', sql.Decimal(18, 2), metrics.otherSales);
    closeReq.input('totalDiscounts', sql.Decimal(18, 2), metrics.totalDiscounts);
    closeReq.input('totalRefunds', sql.Decimal(18, 2), metrics.totalRefunds);
    closeReq.input('endedBy', sql.NVarChar(100), endedBy);
    closeReq.input('closingRemarks', sql.NVarChar(500), closingRemarks ? closingRemarks.trim() : null);
    closeReq.input('updatedBy', sql.NVarChar(100), endedBy);

    await closeReq.query(`
      UPDATE dbo.CarWashDayMaster
      SET
        DayStatus = 'CLOSED',
        ClosingCash = @closingCash,
        ExpectedCash = @expectedCash,
        CashDifference = @cashDifference,
        TotalOrders = @totalOrders,
        TotalSales = @totalSales,
        TotalCustomerSales = @totalCustSales,
        TotalDealerSales = @totalDealerSales,
        PackageSales = @packageSales,
        AddonSales = @addonSales,
        ALaCarteSales = @aLaCarteSales,
        CashSales = @cashSales,
        CardSales = @cardSales,
        OnlineSales = @onlineSales,
        OtherSales = @otherSales,
        TotalDiscounts = @totalDiscounts,
        TotalRefunds = @totalRefunds,
        EndedBy = @endedBy,
        EndedDate = GETDATE(),
        ClosingRemarks = @closingRemarks,
        UpdatedBy = @updatedBy,
        UpdatedDate = GETDATE()
      WHERE DayId = @dayId;
    `);

    // 4. Record Audit Log for Day End
    await recordAuditLog(transaction, {
      dayId,
      eventType: 'DAY_END',
      actionBy: endedBy,
      details: {
        dayId,
        businessDate: activeDay.BusinessDate,
        openingCash: activeDay.OpeningCash,
        actualClosingCash,
        expectedCash,
        cashDifference,
        totalSales: metrics.totalSales,
        totalOrders: metrics.totalOrders,
        closingRemarks: closingRemarks || '',
        forceClose,
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'],
      remarks: `Day #${dayId} closed by ${endedBy}. Actual Cash: $${actualClosingCash.toFixed(2)}, Expected: $${expectedCash.toFixed(2)}, Diff: $${cashDifference.toFixed(2)}`,
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Business Day #${dayId} closed successfully.`,
      report: {
        dayId,
        businessDate: activeDay.BusinessDate,
        dayStatus: 'CLOSED',
        startedBy: activeDay.StartedBy,
        startedDate: activeDay.StartedDate,
        endedBy,
        endedDate: new Date().toISOString(),
        openingCash: Number(activeDay.OpeningCash),
        actualClosingCash,
        expectedCash,
        cashDifference,
        varianceStatus:
          cashDifference === 0 ? 'BALANCED' : cashDifference > 0 ? 'SURPLUS' : 'SHORTAGE',
        totalOrders: metrics.totalOrders,
        totalSales: metrics.totalSales,
        totalCustomerSales: metrics.totalCustomerSales,
        totalDealerSales: metrics.totalDealerSales,
        packageSales: metrics.packageSales,
        addonSales: metrics.addonSales,
        aLaCarteSales: metrics.aLaCarteSales,
        cashSales: metrics.cashSales,
        cardSales: metrics.cardSales,
        onlineSales: metrics.onlineSales,
        otherSales: metrics.otherSales,
        totalCashIn: metrics.totalCashIn,
        totalCashOut: metrics.totalCashOut,
        totalRefunds: metrics.totalRefunds,
        closingRemarks: closingRemarks || '',
        tenders: metrics.tenders,
        packageBreakdown: metrics.packageBreakdown,
      },
    });
  } catch (err) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) {}
    }
    console.error('[DayManagement closeDay Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to close business day',
      error: err.message,
    });
  }
}

/**
 * 7. GET /api/day-management/history
 * Returns historical business days with filtering and pagination.
 */
async function getHistory(req, res) {
  try {
    const pool = await getPool();
    const { startDate, endDate, status, limit = 50, offset = 0 } = req.query || {};

    let query = `
      SELECT 
        DayId, BusinessDate, DayStatus, OpeningCash, ClosingCash, ExpectedCash,
        CashDifference, TotalOrders, TotalSales, TotalCustomerSales, TotalDealerSales,
        CashSales, CardSales, OnlineSales, OtherSales, TotalCashIn, TotalCashOut,
        TotalRefunds, StartedBy, StartedDate, EndedBy, EndedDate, StartRemarks,
        ClosingRemarks, CreatedDate
      FROM dbo.CarWashDayMaster
      WHERE 1=1
    `;

    const request = pool.request();

    if (startDate) {
      request.input('startDate', sql.Date, startDate);
      query += ` AND BusinessDate >= @startDate`;
    }
    if (endDate) {
      request.input('endDate', sql.Date, endDate);
      query += ` AND BusinessDate <= @endDate`;
    }
    if (status) {
      request.input('status', sql.VarChar(20), status.toUpperCase());
      query += ` AND DayStatus = @status`;
    }

    query += ` ORDER BY DayId DESC OFFSET ${parseInt(offset, 10) || 0} ROWS FETCH NEXT ${parseInt(limit, 10) || 50} ROWS ONLY;`;

    const result = await request.query(query);

    return res.status(200).json({
      success: true,
      count: result.recordset.length,
      data: result.recordset.map((row) => ({
        dayId: row.DayId,
        businessDate: row.BusinessDate,
        dayStatus: row.DayStatus,
        openingCash: Number(row.OpeningCash || 0),
        closingCash: row.ClosingCash != null ? Number(row.ClosingCash) : null,
        expectedCash: row.ExpectedCash != null ? Number(row.ExpectedCash) : null,
        cashDifference: row.CashDifference != null ? Number(row.CashDifference) : null,
        totalOrders: Number(row.TotalOrders || 0),
        totalSales: Number(row.TotalSales || 0),
        totalCustomerSales: Number(row.TotalCustomerSales || 0),
        totalDealerSales: Number(row.TotalDealerSales || 0),
        cashSales: Number(row.CashSales || 0),
        cardSales: Number(row.CardSales || 0),
        onlineSales: Number(row.OnlineSales || 0),
        otherSales: Number(row.OtherSales || 0),
        totalCashIn: Number(row.TotalCashIn || 0),
        totalCashOut: Number(row.TotalCashOut || 0),
        totalRefunds: Number(row.TotalRefunds || 0),
        startedBy: row.StartedBy,
        startedDate: row.StartedDate,
        endedBy: row.EndedBy,
        endedDate: row.EndedDate,
        startRemarks: row.StartRemarks,
        closingRemarks: row.ClosingRemarks,
      })),
    });
  } catch (err) {
    console.error('[DayManagement getHistory Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve day history',
      error: err.message,
    });
  }
}

/**
 * 8. GET /api/day-management/:dayId/details
 * Returns comprehensive details, tender breakdown, cash movements and denomination counts for a specific day.
 */
async function getDayDetails(req, res) {
  try {
    const pool = await getPool();
    const dayId = parseInt(req.params.dayId, 10);

    if (!dayId || isNaN(dayId)) {
      return res.status(400).json({ success: false, message: 'Valid DayId is required' });
    }

    const metrics = await calculateDayMetrics(pool, dayId);
    if (!metrics) {
      return res.status(404).json({ success: false, message: `Day #${dayId} not found` });
    }

    // Cash movements
    const cmReq = pool.request();
    cmReq.input('dayId', sql.Int, dayId);
    const cmRes = await cmReq.query(`
      SELECT MovementId, MovementType, Amount, Reason, Remarks, PerformedBy, CreatedDate
      FROM dbo.CarWashDayCashMovement
      WHERE DayId = @dayId
      ORDER BY MovementId ASC;
    `);

    // Denominations
    const denomReq = pool.request();
    denomReq.input('dayId', sql.Int, dayId);
    const denomRes = await denomReq.query(`
      SELECT ClosingDetailId, DenominationType, DenominationValue, DenominationCount, TotalAmount, CreatedDate
      FROM dbo.CarWashDayClosingDetails
      WHERE DayId = @dayId
      ORDER BY DenominationValue DESC;
    `);

    // Tender summary
    const tenderReq = pool.request();
    tenderReq.input('dayId', sql.Int, dayId);
    const tenderRes = await tenderReq.query(`
      SELECT TenderSummaryId, PayMode, PayModeName, TransactionCount, TotalAmount, RefundCount, RefundAmount, NetAmount
      FROM dbo.CarWashDayTenderSummary
      WHERE DayId = @dayId
      ORDER BY TotalAmount DESC;
    `);

    return res.status(200).json({
      success: true,
      data: {
        ...metrics,
        cashMovements: cmRes.recordset.map((r) => ({
          movementId: r.MovementId,
          movementType: r.MovementType,
          amount: Number(r.Amount),
          reason: r.Reason,
          remarks: r.Remarks,
          performedBy: r.PerformedBy,
          createdDate: r.CreatedDate,
        })),
        denominations: denomRes.recordset.map((r) => ({
          id: r.ClosingDetailId,
          type: r.DenominationType,
          value: Number(r.DenominationValue),
          count: Number(r.DenominationCount),
          total: Number(r.TotalAmount),
        })),
        tenderSummary: tenderRes.recordset.map((r) => ({
          id: r.TenderSummaryId,
          payMode: (r.PayMode || '').trim(),
          name: r.PayModeName,
          count: Number(r.TransactionCount),
          amount: Number(r.TotalAmount),
          refundCount: Number(r.RefundCount),
          refundAmount: Number(r.RefundAmount),
          netAmount: Number(r.NetAmount),
        })),
      },
    });
  } catch (err) {
    console.error('[DayManagement getDayDetails Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve day details',
      error: err.message,
    });
  }
}

/**
 * 9. GET /api/day-management/:dayId/audit
 * Returns audit trail logs for a specific day.
 */
async function getDayAudit(req, res) {
  try {
    const pool = await getPool();
    const dayId = parseInt(req.params.dayId, 10);

    if (!dayId || isNaN(dayId)) {
      return res.status(400).json({ success: false, message: 'Valid DayId is required' });
    }

    const reqAudit = pool.request();
    reqAudit.input('dayId', sql.Int, dayId);
    const result = await reqAudit.query(`
      SELECT AuditId, DayId, EventType, ActionBy, ActionDate, Details, IpAddress, Remarks
      FROM dbo.CarWashDayAuditLog
      WHERE DayId = @dayId
      ORDER BY AuditId ASC;
    `);

    return res.status(200).json({
      success: true,
      count: result.recordset.length,
      data: result.recordset.map((row) => ({
        auditId: row.AuditId,
        dayId: row.DayId,
        eventType: row.EventType,
        actionBy: row.ActionBy,
        actionDate: row.ActionDate,
        details: (() => {
          try {
            return JSON.parse(row.Details);
          } catch (_) {
            return row.Details;
          }
        })(),
        ipAddress: row.IpAddress,
        remarks: row.Remarks,
      })),
    });
  } catch (err) {
    console.error('[DayManagement getDayAudit Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve day audit logs',
      error: err.message,
    });
  }
}

module.exports = {
  getStatus,
  startDay,
  getSummary,
  recordCashMovement,
  getClosingPreview,
  closeDay,
  getHistory,
  getDayDetails,
  getDayAudit,
  getActiveDay,
  recordAuditLog,
};

