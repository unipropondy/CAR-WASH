const { getPool, sql } = require('../config/db');

// Status code constants
const STATUS_CODES = {
  DETAILS_SAVED: 10,
  PAYMENT_PENDING: 20,
  PAID: 30,
  BAY_ASSIGNED: 40,
  IN_SERVICE: 50,
  COMPLETED: 60,
  CLOSED: 70,
  CANCELLED: 80,
};

const STATUS_NAMES = {
  10: 'DETAILS_SAVED',
  20: 'PAYMENT_PENDING',
  30: 'PAID',
  40: 'BAY_ASSIGNED',
  50: 'IN_SERVICE',
  60: 'COMPLETED',
  70: 'CLOSED',
  80: 'CANCELLED',
};

// Allowed status transitions mapping
const ALLOWED_TRANSITIONS = {
  10: [20, 30, 80],       // DETAILS_SAVED -> PAYMENT_PENDING, PAID, or CANCELLED
  20: [30, 80],           // PAYMENT_PENDING -> PAID, or CANCELLED
  30: [40, 50, 60, 80],   // PAID -> BAY_ASSIGNED, IN_SERVICE, COMPLETED, or CANCELLED
  40: [50, 60, 80],       // BAY_ASSIGNED -> IN_SERVICE, COMPLETED, or CANCELLED
  50: [60],               // IN_SERVICE -> COMPLETED
  60: [70],               // COMPLETED -> CLOSED
  70: [],                 // CLOSED is final
  80: [],                 // CANCELLED is final
};

/**
 * 1. GET /api/carwash/paymodes
 * Fetch active payment modes directly from dbo.Paymode
 */
async function getPaymodes(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        Position, 
        RTRIM(PayMode) AS PayMode, 
        Description, 
        Active,
        ExtraCharges,
        Commission
      FROM dbo.Paymode
      WHERE Active = 1
      ORDER BY Position ASC;
    `);

    const paymodes = result.recordset.map((row) => ({
      position: Number(row.Position),
      payMode: (row.PayMode || '').trim(),
      description: row.Description || '',
      active: Boolean(row.Active),
      extraCharges: row.ExtraCharges ? Number(row.ExtraCharges) : 0,
      commission: row.Commission ? Number(row.Commission) : 0,
    }));

    return res.status(200).json({
      success: true,
      count: paymodes.length,
      data: paymodes,
    });
  } catch (err) {
    console.error('[CarWash getPaymodes Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment modes from database',
      error: err.message,
    });
  }
}

/**
 * 2. POST /api/carwash/orders
 * Kiosk saves customer booking when completing the vehicle & contact details screen.
 * Fetches actual package price, GST and currency from ServicePackageMaster.
 * Never trusts price values sent by the frontend.
 * Inserts into dbo.CarWashOrder and dbo.CarWashOrderStatusHistory within a transaction.
 */
async function createOrder(req, res) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      customerName,
      vehicleNumber,
      mobileNumber,
      vehicleTypeId,
      serviceCategoryId,
      packageId,
    } = req.body || {};

    // Validate required service fields (customer details are optional)
    const safeCustomerName = (customerName && customerName.trim()) ? customerName.trim() : 'Walk-in Customer';
    const safeVehicleNumber = (vehicleNumber && vehicleNumber.trim()) ? vehicleNumber.trim().toUpperCase() : 'WALK-IN';
    const safeMobileNumber = (mobileNumber && mobileNumber.trim()) ? mobileNumber.trim() : '-';

    if (!vehicleTypeId) {
      return res.status(400).json({ success: false, message: 'Vehicle type ID is required' });
    }
    if (!serviceCategoryId) {
      return res.status(400).json({ success: false, message: 'Service category ID is required' });
    }
    if (!packageId) {
      return res.status(400).json({ success: false, message: 'Package ID is required' });
    }

    // Begin SQL Transaction
    await transaction.begin();

    // 1. Fetch official package details from ServicePackageMaster (DO NOT trust client prices)
    const pkgReq = new sql.Request(transaction);
    pkgReq.input('packageId', sql.Int, parseInt(packageId, 10));
    pkgReq.input('serviceCategoryId', sql.Int, parseInt(serviceCategoryId, 10));

    const pkgResult = await pkgReq.query(`
      SELECT 
        PackageId, 
        ServiceCategoryId, 
        PackageName, 
        Price, 
        CurrencyCode, 
        GSTPercent, 
        IsTaxInclusive,
        IsActive
      FROM dbo.ServicePackageMaster
      WHERE PackageId = @packageId AND ServiceCategoryId = @serviceCategoryId;
    `);

    if (!pkgResult.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'The selected package does not exist or does not match the category.',
      });
    }

    const officialPkg = pkgResult.recordset[0];
    if (!officialPkg.IsActive) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'The selected package is no longer active.',
      });
    }

    // Official pricing calculations
    const price = Number(officialPkg.Price);
    const gstPercent = officialPkg.GSTPercent ? Number(officialPkg.GSTPercent) : 9;
    const isTaxInclusive = Boolean(officialPkg.IsTaxInclusive);
    const currencyCode = (officialPkg.CurrencyCode || 'SGD').trim();

    let totalAmount = 0;
    let packagePrice = 0;
    let gstAmount = 0;

    if (isTaxInclusive) {
      totalAmount = Number(price.toFixed(2));
      // GST is already included in total
      gstAmount = Number(((totalAmount * (gstPercent / 100)) / (1 + (gstPercent / 100))).toFixed(2));
      packagePrice = Number((totalAmount - gstAmount).toFixed(2));
    } else {
      packagePrice = Number(price.toFixed(2));
      gstAmount = Number((packagePrice * (gstPercent / 100)).toFixed(2));
      totalAmount = Number((packagePrice + gstAmount).toFixed(2));
    }

    // 2. Generate Unique OrderNo
    const dateObj = new Date();
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}${mm}${dd}`;

    const seqReq = new sql.Request(transaction);
    const seqResult = await seqReq.query(`
      SELECT COUNT(*) AS todayOrders 
      FROM dbo.CarWashOrder 
      WHERE CAST(CreatedDate AS DATE) = CAST(GETDATE() AS DATE);
    `);
    const todayOrders = (seqResult.recordset[0]?.todayOrders || 0) + 1;
    const orderNo = `RB${datePrefix}-${String(todayOrders).padStart(4, '0')}`;

    // 3. Insert into dbo.CarWashOrder
    const orderInsertReq = new sql.Request(transaction);
    orderInsertReq.input('orderNo', sql.NVarChar(30), orderNo);
    orderInsertReq.input('customerName', sql.NVarChar(150), safeCustomerName);
    orderInsertReq.input('vehicleNumber', sql.NVarChar(30), safeVehicleNumber);
    orderInsertReq.input('mobileNumber', sql.NVarChar(20), safeMobileNumber);
    orderInsertReq.input('vehicleTypeId', sql.Int, parseInt(vehicleTypeId, 10));
    orderInsertReq.input('serviceCategoryId', sql.Int, parseInt(serviceCategoryId, 10));
    orderInsertReq.input('packageId', sql.Int, parseInt(packageId, 10));
    orderInsertReq.input('packagePrice', sql.Decimal(18, 2), packagePrice);
    orderInsertReq.input('gstPercent', sql.Decimal(5, 2), gstPercent);
    orderInsertReq.input('gstAmount', sql.Decimal(18, 2), gstAmount);
    orderInsertReq.input('totalAmount', sql.Decimal(18, 2), totalAmount);
    orderInsertReq.input('currencyCode', sql.NVarChar(10), currencyCode);
    orderInsertReq.input('paymentStatus', sql.VarChar(20), 'PENDING');
    orderInsertReq.input('statusCode', sql.Int, STATUS_CODES.DETAILS_SAVED); // 10

    const insertResult = await orderInsertReq.query(`
      INSERT INTO dbo.CarWashOrder (
        OrderNo, CustomerName, VehicleNumber, MobileNumber,
        VehicleTypeId, ServiceCategoryId, PackageId,
        PackagePrice, GSTPercent, GSTAmount, TotalAmount, CurrencyCode,
        PaymentStatus, StatusCode, CreatedDate
      )
      OUTPUT 
        INSERTED.OrderId, 
        INSERTED.OrderNo, 
        INSERTED.CreatedDate
      VALUES (
        @orderNo, @customerName, @vehicleNumber, @mobileNumber,
        @vehicleTypeId, @serviceCategoryId, @packageId,
        @packagePrice, @gstPercent, @gstAmount, @totalAmount, @currencyCode,
        @paymentStatus, @statusCode, GETDATE()
      );
    `);

    const createdOrder = insertResult.recordset[0];
    const orderId = createdOrder.OrderId;

    // 4. Insert initial status history record into dbo.CarWashOrderStatusHistory
    const histReq = new sql.Request(transaction);
    histReq.input('orderId', sql.Int, orderId);
    histReq.input('oldStatusCode', sql.Int, null);
    histReq.input('newStatusCode', sql.Int, STATUS_CODES.DETAILS_SAVED);
    histReq.input('remarks', sql.NVarChar(500), 'Kiosk customer details saved - awaiting payment');
    histReq.input('changedBy', sql.NVarChar(100), 'KIOSK');

    await histReq.query(`
      INSERT INTO dbo.CarWashOrderStatusHistory (
        OrderId, OldStatusCode, NewStatusCode, Remarks, ChangedBy, ChangedDate
      )
      VALUES (
        @orderId, @oldStatusCode, @newStatusCode, @remarks, @changedBy, GETDATE()
      );
    `);

    // Commit Transaction
    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: 'Customer booking saved successfully',
      data: {
        orderId,
        orderNo: createdOrder.OrderNo,
        customerName: safeCustomerName,
        vehicleNumber: safeVehicleNumber,
        mobileNumber: safeMobileNumber,
        vehicleTypeId: parseInt(vehicleTypeId, 10),
        serviceCategoryId: parseInt(serviceCategoryId, 10),
        packageId: parseInt(packageId, 10),
        packageName: officialPkg.PackageName,
        packagePrice,
        gstPercent,
        gstAmount,
        totalAmount,
        currencyCode,
        paymentStatus: 'PENDING',
        statusCode: STATUS_CODES.DETAILS_SAVED,
        statusName: STATUS_NAMES[STATUS_CODES.DETAILS_SAVED],
        createdDate: createdOrder.CreatedDate,
      },
    });
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rbErr) {
        // Rollback error
      }
    }
    console.error('[CarWash createOrder Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to save customer booking',
      error: err.message,
    });
  }
}

/**
 * 3. PUT /api/carwash/orders/:id/payment
 * Customer selects payment mode at Kiosk or Cashier records payment.
 * Rules:
 * - CASH: PaymentStatus remains PENDING until cashier confirms collection. StatusCode = 20 (PAYMENT_PENDING).
 * - Confirmed payment (e.g. Cashier Confirm, Authorized Member, Authorized Credit):
 *   PaymentStatus becomes PAID, StatusCode = 30, PaidDate = GETDATE().
 * - Never marks payment as PAID without confirmation.
 */
async function updatePayment(req, res) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    const { id } = req.params;
    const orderId = parseInt(id, 10);
    const {
      payMode,
      paymentReference,
      confirmPaid = false,
      changedBy = 'KIOSK',
      remarks,
    } = req.body || {};

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Valid Order ID is required' });
    }
    if (!payMode || !payMode.trim()) {
      return res.status(400).json({ success: false, message: 'Payment mode is required' });
    }

    const trimmedPayMode = payMode.trim().toUpperCase();

    await transaction.begin();

    // 1. Fetch current order
    const checkReq = new sql.Request(transaction);
    checkReq.input('orderId', sql.Int, orderId);
    const checkResult = await checkReq.query(`
      SELECT 
        OrderId, OrderNo, CustomerName, VehicleNumber, TotalAmount,
        PayMode, PaymentStatus, StatusCode
      FROM dbo.CarWashOrder
      WHERE OrderId = @orderId;
    `);

    if (!checkResult.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const currentOrder = checkResult.recordset[0];
    const oldStatusCode = currentOrder.StatusCode;

    // Prevent duplicate payment confirmation
    if (confirmPaid && currentOrder.PaymentStatus === 'PAID') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'This order has already been paid.',
      });
    }

    // Determine new payment status and status code
    // Rules:
    // 1. CASH: Payment status is PENDING (StatusCode 20) until staff/cashier manually confirms.
    // 2. Non-CASH (Card, PayNow, Online, Member, Credit, etc.): Automatically marked as PAID (StatusCode 30).
    // 3. If confirmPaid is true, order is marked as PAID (StatusCode 30).
    const isCash = trimmedPayMode === 'CASH';
    let newPaymentStatus = currentOrder.PaymentStatus || 'PENDING';
    let newStatusCode = oldStatusCode;
    let updatePaidDate = false;

    if (confirmPaid || !isCash) {
      newPaymentStatus = 'PAID';
      newStatusCode = oldStatusCode < STATUS_CODES.PAID ? STATUS_CODES.PAID : oldStatusCode;
      updatePaidDate = true;
    } else {
      newPaymentStatus = 'PENDING';
      newStatusCode = oldStatusCode <= STATUS_CODES.PAYMENT_PENDING ? STATUS_CODES.PAYMENT_PENDING : oldStatusCode;
    }

    // Validate status transition
    if (oldStatusCode !== newStatusCode) {
      const allowed = ALLOWED_TRANSITIONS[oldStatusCode] || [];
      if (!allowed.includes(newStatusCode)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Invalid status transition from ${STATUS_NAMES[oldStatusCode] || oldStatusCode} to ${STATUS_NAMES[newStatusCode] || newStatusCode}`,
        });
      }
    }

    // Update dbo.CarWashOrder
    const updReq = new sql.Request(transaction);
    updReq.input('orderId', sql.Int, orderId);
    updReq.input('payMode', sql.Char(10), trimmedPayMode);
    updReq.input('paymentStatus', sql.VarChar(20), newPaymentStatus);
    updReq.input('paymentReference', sql.NVarChar(150), paymentReference || null);
    updReq.input('statusCode', sql.Int, newStatusCode);

    let sqlQuery = `
      UPDATE dbo.CarWashOrder
      SET 
        PayMode = @payMode,
        PaymentStatus = @paymentStatus,
        PaymentReference = ISNULL(@paymentReference, PaymentReference),
        StatusCode = @statusCode
    `;

    if (updatePaidDate) {
      sqlQuery += `, PaidDate = GETDATE() `;
    }

    sqlQuery += ` WHERE OrderId = @orderId;`;

    await updReq.query(sqlQuery);

    // Insert history record if status changed or remarks provided
    const histRemarks =
      remarks ||
      (confirmPaid
        ? `Payment confirmed (${trimmedPayMode}) - S$ ${currentOrder.TotalAmount.toFixed(2)} received`
        : `Payment mode selected at Kiosk: ${trimmedPayMode}`);

    const histReq = new sql.Request(transaction);
    histReq.input('orderId', sql.Int, orderId);
    histReq.input('oldStatusCode', sql.Int, oldStatusCode);
    histReq.input('newStatusCode', sql.Int, newStatusCode);
    histReq.input('remarks', sql.NVarChar(500), histRemarks);
    histReq.input('changedBy', sql.NVarChar(100), changedBy);

    await histReq.query(`
      INSERT INTO dbo.CarWashOrderStatusHistory (
        OrderId, OldStatusCode, NewStatusCode, Remarks, ChangedBy, ChangedDate
      )
      VALUES (
        @orderId, @oldStatusCode, @newStatusCode, @remarks, @changedBy, GETDATE()
      );
    `);

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: confirmPaid ? 'Payment confirmed successfully' : 'Payment mode updated',
      data: {
        orderId,
        orderNo: currentOrder.OrderNo,
        payMode: trimmedPayMode,
        paymentStatus: newPaymentStatus,
        paymentReference,
        statusCode: newStatusCode,
        statusName: STATUS_NAMES[newStatusCode],
      },
    });
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rbErr) {
        // Rollback error
      }
    }
    console.error('[CarWash updatePayment Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update payment',
      error: err.message,
    });
  }
}

/**
 * 4. PUT /api/carwash/orders/:id/status
 * Cashier actions:
 * - 30: PAID (Confirm Cash Collection)
 * - 40: BAY_ASSIGNED (Assign Bay)
 * - 50: IN_SERVICE (Start Wash Service)
 * - 60: COMPLETED (Mark as Completed)
 * - 70: CLOSED (Order Closed)
 * - 80: CANCELLED (Cancel Order)
 */
async function updateStatus(req, res) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    const { id } = req.params;
    const orderId = parseInt(id, 10);
    const {
      statusCode,
      bayId,
      remarks,
      changedBy = req.user?.userName || 'Staff POS',
    } = req.body || {};

    const targetStatusCode = parseInt(statusCode, 10);

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Valid Order ID is required' });
    }
    if (!targetStatusCode || isNaN(targetStatusCode)) {
      return res.status(400).json({ success: false, message: 'Valid status code is required' });
    }
    if (!STATUS_NAMES[targetStatusCode]) {
      return res.status(400).json({
        success: false,
        message: `Unknown status code: ${targetStatusCode}. Allowed codes: 10, 20, 30, 40, 50, 60, 70, 80`,
      });
    }

    await transaction.begin();

    // 1. Fetch current order
    const checkReq = new sql.Request(transaction);
    checkReq.input('orderId', sql.Int, orderId);
    const checkResult = await checkReq.query(`
      SELECT 
        OrderId, OrderNo, CustomerName, VehicleNumber, TotalAmount,
        PayMode, PaymentStatus, StatusCode, BayId,
        PaidDate, StartedDate, CompletedDate, ClosedDate
      FROM dbo.CarWashOrder
      WHERE OrderId = @orderId;
    `);

    if (!checkResult.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const currentOrder = checkResult.recordset[0];
    const oldStatusCode = currentOrder.StatusCode;

    // Validate transition
    if (oldStatusCode === targetStatusCode) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Order is already in status ${STATUS_NAMES[targetStatusCode]} (${targetStatusCode}).`,
      });
    }

    const allowedNext = ALLOWED_TRANSITIONS[oldStatusCode] || [];
    if (!allowedNext.includes(targetStatusCode)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Invalid status transition: cannot change from ${STATUS_NAMES[oldStatusCode] || oldStatusCode} to ${STATUS_NAMES[targetStatusCode]} (${targetStatusCode}).`,
      });
    }

    // Additional validation for bay assignment and starting service
    const targetBayNum = bayId ? parseInt(bayId, 10) : (currentOrder.BayId ? parseInt(currentOrder.BayId, 10) : null);

    if (targetStatusCode === STATUS_CODES.BAY_ASSIGNED && !targetBayNum) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Bay ID is required when assigning a wash bay.',
      });
    }

    if (targetStatusCode === STATUS_CODES.IN_SERVICE && !targetBayNum) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'A wash bay must be selected before starting service.',
      });
    }

    // Verify bay availability from database and prevent two active orders in the same bay
    if ((targetStatusCode === STATUS_CODES.BAY_ASSIGNED || targetStatusCode === STATUS_CODES.IN_SERVICE) && targetBayNum) {
      // 1. Check BayMaster table status
      const bayCheckReq = new sql.Request(transaction);
      bayCheckReq.input('checkBayNum', sql.Int, targetBayNum);
      const bayMasterCheck = await bayCheckReq.query(`
        SELECT BayNumber, BayName, BayStatus 
        FROM dbo.BayMaster 
        WHERE BayNumber = @checkBayNum;
      `);

      if (bayMasterCheck.recordset.length > 0) {
        const bStatus = (bayMasterCheck.recordset[0].BayStatus || '').toUpperCase();
        if (bStatus === 'MAINTENANCE' || bStatus === 'CLEANING') {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Bay ${targetBayNum} is currently under ${bStatus} and cannot be assigned.`,
          });
        }
      }

      // 2. Prevent two active orders from being assigned to the same bay in dbo.CarWashOrder
      const conflictReq = new sql.Request(transaction);
      conflictReq.input('conflictBayNum', sql.Int, targetBayNum);
      conflictReq.input('currOrderId', sql.Int, orderId);
      const conflictCheck = await conflictReq.query(`
        SELECT TOP 1 OrderId, OrderNo, VehicleNumber 
        FROM dbo.CarWashOrder 
        WHERE BayId = @conflictBayNum 
          AND StatusCode IN (40, 50) 
          AND OrderId != @currOrderId;
      `);

      if (conflictCheck.recordset.length > 0) {
        const busy = conflictCheck.recordset[0];
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: `Bay ${targetBayNum} is currently occupied by active order ${busy.OrderNo} (${busy.VehicleNumber}). Please select an available bay.`,
        });
      }
    }

    // Construct update query
    const updReq = new sql.Request(transaction);
    updReq.input('orderId', sql.Int, orderId);
    updReq.input('statusCode', sql.Int, targetStatusCode);

    let updateFields = [`StatusCode = @statusCode`];

    if (targetStatusCode === STATUS_CODES.PAID) {
      updateFields.push(`PaymentStatus = 'PAID'`);
      updateFields.push(`PaidDate = ISNULL(PaidDate, GETDATE())`);
    } else if (targetStatusCode === STATUS_CODES.BAY_ASSIGNED) {
      updReq.input('bayId', sql.Int, targetBayNum);
      updateFields.push(`BayId = @bayId`);

      // Update dbo.BayMaster with customer and vehicle details
      const bayReq = new sql.Request(transaction);
      bayReq.input('bayNum', sql.Int, targetBayNum);
      bayReq.input('custName', sql.NVarChar(150), currentOrder.CustomerName || null);
      bayReq.input('custMob', sql.NVarChar(20), currentOrder.MobileNumber || null);
      bayReq.input('vehNum', sql.NVarChar(50), currentOrder.VehicleNumber || null);
      bayReq.input('ordNo', sql.NVarChar(50), currentOrder.OrderNo || null);
      bayReq.input('totAmt', sql.Decimal(10, 2), currentOrder.TotalAmount != null ? Number(currentOrder.TotalAmount) : 0);
      await bayReq.query(`
        UPDATE dbo.BayMaster
        SET 
          BayStatus = 'IN_SERVICE',
          CustomerName = @custName,
          CustomerMobile = @custMob,
          VehicleNumber = @vehNum,
          CurrentOrderId = @ordNo,
          TotalAmount = @totAmt,
          ModifiedOn = GETDATE()
        WHERE BayNumber = @bayNum;
      `);
    } else if (targetStatusCode === STATUS_CODES.IN_SERVICE) {
      updateFields.push(`StartedDate = ISNULL(StartedDate, GETDATE())`);
      if (targetBayNum) {
        updReq.input('bayId', sql.Int, targetBayNum);
        updateFields.push(`BayId = @bayId`);

        const bayReq = new sql.Request(transaction);
        bayReq.input('bayNum', sql.Int, targetBayNum);
        bayReq.input('custName', sql.NVarChar(150), currentOrder.CustomerName || null);
        bayReq.input('custMob', sql.NVarChar(20), currentOrder.MobileNumber || null);
        bayReq.input('vehNum', sql.NVarChar(50), currentOrder.VehicleNumber || null);
        bayReq.input('ordNo', sql.NVarChar(50), currentOrder.OrderNo || null);
        bayReq.input('totAmt', sql.Decimal(10, 2), currentOrder.TotalAmount != null ? Number(currentOrder.TotalAmount) : 0);
        await bayReq.query(`
          UPDATE dbo.BayMaster
          SET 
            BayStatus = 'IN_SERVICE',
            CustomerName = @custName,
            CustomerMobile = @custMob,
            VehicleNumber = @vehNum,
            CurrentOrderId = @ordNo,
            TotalAmount = @totAmt,
            ModifiedOn = GETDATE()
          WHERE BayNumber = @bayNum;
        `);
      }
    } else if (targetStatusCode === STATUS_CODES.COMPLETED) {
      updateFields.push(`CompletedDate = ISNULL(CompletedDate, GETDATE())`);
      // If completed, release the bay in dbo.BayMaster
      const releaseReq = new sql.Request(transaction);
      releaseReq.input('relBayNum', sql.Int, currentOrder.BayId ? parseInt(currentOrder.BayId, 10) : null);
      releaseReq.input('ordNo', sql.NVarChar(50), currentOrder.OrderNo || null);
      await releaseReq.query(`
        UPDATE dbo.BayMaster
        SET 
          BayStatus = 'AVAILABLE',
          CustomerName = NULL,
          CustomerMobile = NULL,
          VehicleNumber = NULL,
          CurrentOrderId = NULL,
          TotalAmount = 0,
          ModifiedOn = GETDATE()
        WHERE (BayNumber = @relBayNum OR CurrentOrderId = @ordNo);
      `);
    } else if (targetStatusCode === STATUS_CODES.CLOSED) {
      updateFields.push(`ClosedDate = ISNULL(ClosedDate, GETDATE())`);
      // If closed, ensure bay is released in dbo.BayMaster
      const releaseReq = new sql.Request(transaction);
      releaseReq.input('relBayNum', sql.Int, currentOrder.BayId ? parseInt(currentOrder.BayId, 10) : null);
      releaseReq.input('ordNo', sql.NVarChar(50), currentOrder.OrderNo || null);
      await releaseReq.query(`
        UPDATE dbo.BayMaster
        SET 
          BayStatus = 'AVAILABLE',
          CustomerName = NULL,
          CustomerMobile = NULL,
          VehicleNumber = NULL,
          CurrentOrderId = NULL,
          TotalAmount = 0,
          ModifiedOn = GETDATE()
        WHERE (BayNumber = @relBayNum OR CurrentOrderId = @ordNo);
      `);
    } else if (targetStatusCode === STATUS_CODES.CANCELLED) {
      updateFields.push(`PaymentStatus = 'CANCELLED'`);
      const releaseReq = new sql.Request(transaction);
      releaseReq.input('relBayNum', sql.Int, currentOrder.BayId ? parseInt(currentOrder.BayId, 10) : null);
      releaseReq.input('ordNo', sql.NVarChar(50), currentOrder.OrderNo || null);
      await releaseReq.query(`
        UPDATE dbo.BayMaster
        SET 
          BayStatus = 'AVAILABLE',
          CustomerName = NULL,
          CustomerMobile = NULL,
          VehicleNumber = NULL,
          CurrentOrderId = NULL,
          TotalAmount = 0,
          ModifiedOn = GETDATE()
        WHERE (BayNumber = @relBayNum OR CurrentOrderId = @ordNo);
      `);
    }

    const updateSql = `
      UPDATE dbo.CarWashOrder
      SET ${updateFields.join(', ')}
      WHERE OrderId = @orderId;
    `;
    await updReq.query(updateSql);

    // Insert history record
    const defaultRemark = `Status changed to ${STATUS_NAMES[targetStatusCode]}${bayId ? ` (Bay ${bayId})` : ''}`;
    const histReq = new sql.Request(transaction);
    histReq.input('orderId', sql.Int, orderId);
    histReq.input('oldStatusCode', sql.Int, oldStatusCode);
    histReq.input('newStatusCode', sql.Int, targetStatusCode);
    histReq.input('remarks', sql.NVarChar(500), remarks || defaultRemark);
    histReq.input('changedBy', sql.NVarChar(100), changedBy);

    await histReq.query(`
      INSERT INTO dbo.CarWashOrderStatusHistory (
        OrderId, OldStatusCode, NewStatusCode, Remarks, ChangedBy, ChangedDate
      )
      VALUES (
        @orderId, @oldStatusCode, @newStatusCode, @remarks, @changedBy, GETDATE()
      );
    `);

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Order status successfully updated to ${STATUS_NAMES[targetStatusCode]}`,
      data: {
        orderId,
        orderNo: currentOrder.OrderNo,
        oldStatusCode,
        oldStatusName: STATUS_NAMES[oldStatusCode],
        newStatusCode: targetStatusCode,
        newStatusName: STATUS_NAMES[targetStatusCode],
        bayId: bayId || currentOrder.BayId,
        changedBy,
      },
    });
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rbErr) {
        // Rollback error
      }
    }
    console.error('[CarWash updateStatus Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: err.message,
    });
  }
}

/**
 * 5. GET /api/carwash/orders
 * Fetch kiosk orders for Staff POS Order Queue with rich joined details & filters.
 * Filters supported:
 * - filter: 'ALL' | 'PENDING_PAYMENT' | 'PAID_WAITING' | 'IN_SERVICE' | 'COMPLETED' | 'CLOSED' | 'CANCELLED'
 * - search: search by customerName, vehicleNumber, orderNo
 * - date: 'today' | 'all' | 'YYYY-MM-DD'
 */
async function getOrders(req, res) {
  try {
    const pool = await getPool();
    const { filter = 'ALL', search = '', date = 'today' } = req.query;

    const request = pool.request();
    let whereConditions = [];

    // Filter by date (defaults to today for active operational POS queue)
    if (date === 'today') {
      whereConditions.push(`CAST(o.CreatedDate AS DATE) = CAST(GETDATE() AS DATE)`);
    } else if (date && date !== 'all') {
      request.input('filterDate', sql.Date, date);
      whereConditions.push(`CAST(o.CreatedDate AS DATE) = @filterDate`);
    }

    // Filter by Status
    const normalizedFilter = filter.toUpperCase();
    if (normalizedFilter === 'PENDING_PAYMENT' || normalizedFilter === 'PENDING') {
      // Only actual unpaid orders: CASH with PENDING status or status 10/20 where paymentStatus is not PAID
      whereConditions.push(`(o.PaymentStatus = 'PENDING' AND (RTRIM(o.PayMode) = 'CASH' OR o.StatusCode IN (10, 20)))`);
    } else if (normalizedFilter === 'PAID_WAITING' || normalizedFilter === 'WAITING') {
      // Paid and waiting for bay assignment
      whereConditions.push(`((o.StatusCode IN (30, 40) OR (o.PaymentStatus = 'PAID' AND o.StatusCode < 50)) AND o.PaymentStatus != 'PENDING')`);
    } else if (normalizedFilter === 'IN_SERVICE') {
      whereConditions.push(`o.StatusCode = 50`);
    } else if (normalizedFilter === 'COMPLETED') {
      whereConditions.push(`o.StatusCode = 60`);
    } else if (normalizedFilter === 'CLOSED') {
      whereConditions.push(`o.StatusCode = 70`);
    } else if (normalizedFilter === 'CANCELLED') {
      whereConditions.push(`o.StatusCode = 80`);
    }

    // Keyword Search
    if (search && search.trim()) {
      request.input('searchKw', sql.NVarChar(100), `%${search.trim()}%`);
      whereConditions.push(`(
        o.OrderNo LIKE @searchKw OR
        o.CustomerName LIKE @searchKw OR
        o.VehicleNumber LIKE @searchKw OR
        o.MobileNumber LIKE @searchKw
      )`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        o.OrderId,
        o.OrderNo,
        o.CustomerName,
        o.VehicleNumber,
        o.MobileNumber,
        o.VehicleTypeId,
        vt.VehicleTypeName,
        vt.VehicleTypeCode,
        o.ServiceCategoryId,
        sc.CategoryName AS ServiceCategoryName,
        sc.ServiceCategoryCode,
        o.PackageId,
        sp.PackageName,
        sp.PackageCode,
        sp.DurationMinutes,
        o.PackagePrice,
        o.GSTPercent,
        o.GSTAmount,
        o.TotalAmount,
        o.CurrencyCode,
        RTRIM(o.PayMode) AS PayMode,
        o.PaymentStatus,
        o.PaymentReference,
        o.StatusCode,
        o.BayId,
        o.CreatedDate,
        o.PaidDate,
        o.StartedDate,
        o.CompletedDate,
        o.ClosedDate,
        CASE 
          WHEN o.StatusCode = 60 THEN
            DATEDIFF(MINUTE, o.CreatedDate, ISNULL(o.CompletedDate, GETDATE()))
          WHEN o.StatusCode = 70 THEN
            DATEDIFF(MINUTE, o.CreatedDate, ISNULL(o.ClosedDate, ISNULL(o.CompletedDate, GETDATE())))
          WHEN o.StatusCode = 80 THEN 0
          ELSE 
            DATEDIFF(MINUTE, o.CreatedDate, GETDATE())
        END AS WaitMinutes
      FROM dbo.CarWashOrder o
      LEFT JOIN dbo.VehicleTypeMaster vt ON o.VehicleTypeId = vt.VehicleTypeId
      LEFT JOIN dbo.ServiceCategoryMaster sc ON o.ServiceCategoryId = sc.ServiceCategoryId
      LEFT JOIN dbo.ServicePackageMaster sp ON o.PackageId = sp.PackageId
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN o.StatusCode IN (10, 20, 30, 40, 50) THEN 0 
          ELSE 1 
        END ASC,
        o.CreatedDate DESC;
    `;

    const result = await request.query(query);

    const orders = result.recordset.map((row) => {
      const waitMin = row.WaitMinutes != null && row.WaitMinutes >= 0 ? row.WaitMinutes : 0;
      let waitTimeStr = `${waitMin} min`;
      if (waitMin >= 60) {
        const hrs = Math.floor(waitMin / 60);
        const remMin = waitMin % 60;
        waitTimeStr = `${hrs}h ${remMin}m`;
      }

      // Map to POS status and Bay name
      let bayStatus = 'Unassigned';
      if (row.BayId) {
        bayStatus = `Bay ${row.BayId}`;
      }

      return {
        orderId: row.OrderId,
        orderNo: row.OrderNo,
        customerName: row.CustomerName,
        vehicleNumber: row.VehicleNumber,
        mobileNumber: row.MobileNumber,
        vehicleTypeId: row.VehicleTypeId,
        vehicleTypeName: row.VehicleTypeName || 'Sedan',
        vehicleTypeCode: row.VehicleTypeCode || 'SEDAN',
        serviceCategoryId: row.ServiceCategoryId,
        serviceCategoryName: row.ServiceCategoryName || 'Car Wash',
        serviceCategoryCode: row.ServiceCategoryCode || 'CAR_WASH',
        packageId: row.PackageId,
        packageName: row.PackageName || 'Wash Package',
        packageCode: row.PackageCode || '',
        durationMinutes: row.DurationMinutes,
        packagePrice: Number(row.PackagePrice),
        gstPercent: row.GSTPercent ? Number(row.GSTPercent) : 9,
        gstAmount: row.GSTAmount ? Number(row.GSTAmount) : 0,
        totalAmount: Number(row.TotalAmount),
        currencyCode: row.CurrencyCode || 'SGD',
        payMode: (row.PayMode || '').trim(),
        paymentStatus: row.PaymentStatus || 'PENDING',
        paymentReference: row.PaymentReference,
        statusCode: row.StatusCode,
        statusName: STATUS_NAMES[row.StatusCode] || 'DETAILS_SAVED',
        bayId: row.BayId,
        bayStatus,
        waitTime: waitTimeStr,
        waitMinutes: waitMin,
        createdDate: row.CreatedDate,
        paidDate: row.PaidDate,
        startedDate: row.StartedDate,
        completedDate: row.CompletedDate,
        closedDate: row.ClosedDate,
      };
    });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (err) {
    console.error('[CarWash getOrders Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: err.message,
    });
  }
}

/**
 * 6. GET /api/carwash/orders/:id
 * Fetch single order with details
 */
async function getOrderById(req, res) {
  try {
    const pool = await getPool();
    const { id } = req.params;
    const orderId = parseInt(id, 10);

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Valid Order ID is required' });
    }

    const request = pool.request();
    request.input('orderId', sql.Int, orderId);

    const query = `
      SELECT 
        o.OrderId,
        o.OrderNo,
        o.CustomerName,
        o.VehicleNumber,
        o.MobileNumber,
        o.VehicleTypeId,
        vt.VehicleTypeName,
        vt.VehicleTypeCode,
        o.ServiceCategoryId,
        sc.CategoryName AS ServiceCategoryName,
        sc.ServiceCategoryCode,
        o.PackageId,
        sp.PackageName,
        sp.PackageCode,
        sp.DurationMinutes,
        o.PackagePrice,
        o.GSTPercent,
        o.GSTAmount,
        o.TotalAmount,
        o.CurrencyCode,
        RTRIM(o.PayMode) AS PayMode,
        o.PaymentStatus,
        o.PaymentReference,
        o.StatusCode,
        o.BayId,
        o.CreatedDate,
        o.PaidDate,
        o.StartedDate,
        o.CompletedDate,
        o.ClosedDate,
        CASE 
          WHEN o.StatusCode = 60 THEN
            DATEDIFF(MINUTE, o.CreatedDate, ISNULL(o.CompletedDate, GETDATE()))
          WHEN o.StatusCode = 70 THEN
            DATEDIFF(MINUTE, o.CreatedDate, ISNULL(o.ClosedDate, ISNULL(o.CompletedDate, GETDATE())))
          WHEN o.StatusCode = 80 THEN 0
          ELSE 
            DATEDIFF(MINUTE, o.CreatedDate, GETDATE())
        END AS WaitMinutes
      FROM dbo.CarWashOrder o
      LEFT JOIN dbo.VehicleTypeMaster vt ON o.VehicleTypeId = vt.VehicleTypeId
      LEFT JOIN dbo.ServiceCategoryMaster sc ON o.ServiceCategoryId = sc.ServiceCategoryId
      LEFT JOIN dbo.ServicePackageMaster sp ON o.PackageId = sp.PackageId
      WHERE o.OrderId = @orderId;
    `;

    const result = await request.query(query);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const row = result.recordset[0];
    const waitMin = row.WaitMinutes != null && row.WaitMinutes >= 0 ? row.WaitMinutes : 0;

    return res.status(200).json({
      success: true,
      data: {
        orderId: row.OrderId,
        orderNo: row.OrderNo,
        customerName: row.CustomerName,
        vehicleNumber: row.VehicleNumber,
        mobileNumber: row.MobileNumber,
        vehicleTypeId: row.VehicleTypeId,
        vehicleTypeName: row.VehicleTypeName,
        vehicleTypeCode: row.VehicleTypeCode,
        serviceCategoryId: row.ServiceCategoryId,
        serviceCategoryName: row.ServiceCategoryName,
        serviceCategoryCode: row.ServiceCategoryCode,
        packageId: row.PackageId,
        packageName: row.PackageName,
        packageCode: row.PackageCode,
        durationMinutes: row.DurationMinutes,
        packagePrice: Number(row.PackagePrice),
        gstPercent: row.GSTPercent ? Number(row.GSTPercent) : 9,
        gstAmount: row.GSTAmount ? Number(row.GSTAmount) : 0,
        totalAmount: Number(row.TotalAmount),
        currencyCode: row.CurrencyCode || 'SGD',
        payMode: (row.PayMode || '').trim(),
        paymentStatus: row.PaymentStatus || 'PENDING',
        paymentReference: row.PaymentReference,
        statusCode: row.StatusCode,
        statusName: STATUS_NAMES[row.StatusCode] || 'DETAILS_SAVED',
        bayId: row.BayId,
        bayStatus: row.BayId ? `Bay ${row.BayId}` : 'Unassigned',
        waitTime: `${waitMin} min`,
        waitMinutes: waitMin,
        createdDate: row.CreatedDate,
        paidDate: row.PaidDate,
        startedDate: row.StartedDate,
        completedDate: row.CompletedDate,
        closedDate: row.ClosedDate,
      },
    });
  } catch (err) {
    console.error('[CarWash getOrderById Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: err.message,
    });
  }
}

/**
 * 7. GET /api/carwash/orders/:id/history
 * Fetch complete audit status history from dbo.CarWashOrderStatusHistory
 */
async function getOrderHistory(req, res) {
  try {
    const pool = await getPool();
    const { id } = req.params;
    const orderId = parseInt(id, 10);

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Valid Order ID is required' });
    }

    const request = pool.request();
    request.input('orderId', sql.Int, orderId);

    const query = `
      SELECT 
        HistoryId,
        OrderId,
        OldStatusCode,
        NewStatusCode,
        Remarks,
        ChangedBy,
        ChangedDate
      FROM dbo.CarWashOrderStatusHistory
      WHERE OrderId = @orderId
      ORDER BY ChangedDate ASC, HistoryId ASC;
    `;

    const result = await request.query(query);

    const history = result.recordset.map((row) => ({
      historyId: row.HistoryId,
      orderId: row.OrderId,
      oldStatusCode: row.OldStatusCode,
      oldStatusName: row.OldStatusCode ? STATUS_NAMES[row.OldStatusCode] : null,
      newStatusCode: row.NewStatusCode,
      newStatusName: STATUS_NAMES[row.NewStatusCode],
      remarks: row.Remarks,
      changedBy: row.ChangedBy,
      changedDate: row.ChangedDate,
    }));

    return res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (err) {
    console.error('[CarWash getOrderHistory Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order status history',
      error: err.message,
    });
  }
}

module.exports = {
  getPaymodes,
  createOrder,
  updatePayment,
  updateStatus,
  getOrders,
  getOrderById,
  getOrderHistory,
  STATUS_CODES,
  STATUS_NAMES,
};

