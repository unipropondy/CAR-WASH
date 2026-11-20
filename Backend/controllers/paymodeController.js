const { sql, getPool } = require('../config/db');

/**
 * 1. GET /api/paymodes
 * Query params: ?all=true / ?includeInactive=true, ?search=...
 * Fetch payment modes from dbo.Paymode
 */
async function getPaymodes(req, res) {
  try {
    const { all, includeInactive, search } = req.query || {};
    const showAll = all === 'true' || all === '1' || includeInactive === 'true' || includeInactive === '1';

    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT 
        Position, 
        RTRIM(PayMode) AS PayMode, 
        Description, 
        Commission,
        Active,
        ServiceCharge,
        isEntertainment,
        isVoucher,
        PaymodeImage,
        DeviceSN,
        DeviceSalt,
        YeahPayEnabled,
        ExtraCharges,
        CreateDate,
        ModifyDate
      FROM dbo.Paymode
    `;

    const whereClauses = [];
    if (!showAll) {
      whereClauses.push(`Active = 1`);
    }

    if (search && search.trim()) {
      request.input('search', sql.NVarChar(100), `%${search.trim()}%`);
      whereClauses.push(`(PayMode LIKE @search OR Description LIKE @search)`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY Position ASC, RTRIM(PayMode) ASC;`;

    const result = await request.query(query);

    const paymodes = (result.recordset || []).map((row) => ({
      position: Number(row.Position ?? 0),
      payMode: (row.PayMode || '').trim(),
      code: (row.PayMode || '').trim(),
      description: (row.Description || '').trim(),
      commission: row.Commission != null ? Number(row.Commission) : 0,
      active: Boolean(row.Active),
      isActive: Boolean(row.Active),
      serviceCharge: row.ServiceCharge != null ? Number(row.ServiceCharge) : 0,
      isEntertainment: Boolean(row.isEntertainment),
      isVoucher: Boolean(row.isVoucher),
      paymodeImage: row.PaymodeImage || null,
      deviceSN: (row.DeviceSN || '').trim(),
      deviceSalt: (row.DeviceSalt || '').trim(),
      yeahPayEnabled: Boolean(row.YeahPayEnabled),
      extraCharges: row.ExtraCharges != null ? Number(row.ExtraCharges) : 0,
      createDate: row.CreateDate,
      modifyDate: row.ModifyDate,
    }));

    return res.status(200).json({
      success: true,
      count: paymodes.length,
      data: paymodes,
    });
  } catch (err) {
    console.error('[Paymode getPaymodes Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment modes from database',
      error: err.message,
    });
  }
}

/**
 * 2. GET /api/paymodes/:payMode
 * Fetch single payment mode
 */
async function getPaymodeById(req, res) {
  try {
    const rawMode = req.params.payMode;
    if (!rawMode) {
      return res.status(400).json({ success: false, message: 'PayMode parameter is required' });
    }

    const payMode = rawMode.trim().toUpperCase();
    const pool = await getPool();
    const result = await pool.request()
      .input('payMode', sql.Char(10), payMode)
      .query(`
        SELECT 
          Position, 
          RTRIM(PayMode) AS PayMode, 
          Description, 
          Commission,
          Active,
          ServiceCharge,
          isEntertainment,
          isVoucher,
          PaymodeImage,
          DeviceSN,
          DeviceSalt,
          YeahPayEnabled,
          ExtraCharges,
          CreateDate,
          ModifyDate
        FROM dbo.Paymode
        WHERE RTRIM(UPPER(PayMode)) = @payMode;
      `);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: `Payment mode '${payMode}' not found` });
    }

    const row = result.recordset[0];
    const data = {
      position: Number(row.Position ?? 0),
      payMode: (row.PayMode || '').trim(),
      code: (row.PayMode || '').trim(),
      description: (row.Description || '').trim(),
      commission: row.Commission != null ? Number(row.Commission) : 0,
      active: Boolean(row.Active),
      isActive: Boolean(row.Active),
      serviceCharge: row.ServiceCharge != null ? Number(row.ServiceCharge) : 0,
      isEntertainment: Boolean(row.isEntertainment),
      isVoucher: Boolean(row.isVoucher),
      paymodeImage: row.PaymodeImage || null,
      deviceSN: (row.DeviceSN || '').trim(),
      deviceSalt: (row.DeviceSalt || '').trim(),
      yeahPayEnabled: Boolean(row.YeahPayEnabled),
      extraCharges: row.ExtraCharges != null ? Number(row.ExtraCharges) : 0,
      createDate: row.CreateDate,
      modifyDate: row.ModifyDate,
    };

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[Paymode getPaymodeById Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch payment mode', error: err.message });
  }
}

/**
 * 3. POST /api/paymodes
 * Create a new payment mode in dbo.Paymode
 */
async function createPaymode(req, res) {
  try {
    const {
      payMode,
      code,
      description,
      position,
      commission,
      active,
      isActive,
      serviceCharge,
      isEntertainment,
      isVoucher,
      paymodeImage,
      deviceSN,
      deviceSalt,
      yeahPayEnabled,
      extraCharges,
    } = req.body || {};

    const rawMode = (payMode || code || '').trim().toUpperCase();
    if (!rawMode) {
      return res.status(400).json({ success: false, message: 'PayMode code is required (e.g. CASH, NETS, PAYNOW)' });
    }

    if (rawMode.length > 10) {
      return res.status(400).json({ success: false, message: 'PayMode code cannot exceed 10 characters' });
    }

    const desc = (description || '').trim();
    if (!desc) {
      return res.status(400).json({ success: false, message: 'Description is required' });
    }

    if (desc.length > 50) {
      return res.status(400).json({ success: false, message: 'Description cannot exceed 50 characters' });
    }

    const pool = await getPool();

    // Check duplicate
    const checkDup = await pool.request()
      .input('payMode', sql.Char(10), rawMode)
      .query(`SELECT TOP 1 PayMode FROM dbo.Paymode WHERE RTRIM(UPPER(PayMode)) = @payMode;`);

    if (checkDup.recordset && checkDup.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Payment mode with code '${rawMode}' already exists in dbo.Paymode.`,
      });
    }

    // Auto calculate Position if not specified or <= 0
    let finalPos = Number(position);
    if (isNaN(finalPos) || finalPos <= 0) {
      const posResult = await pool.request().query(`SELECT ISNULL(MAX(Position), 0) + 1 AS NextPos FROM dbo.Paymode;`);
      finalPos = Number(posResult.recordset[0]?.NextPos || 1);
    }

    const finalActive = active !== undefined ? (active ? 1 : 0) : (isActive !== undefined ? (isActive ? 1 : 0) : 1);
    const finalCommission = commission != null && !isNaN(Number(commission)) ? Number(commission) : 0;
    const finalExtraCharges = extraCharges != null && !isNaN(Number(extraCharges)) ? Number(extraCharges) : 0;
    const finalServiceCharge = serviceCharge != null && !isNaN(Number(serviceCharge)) ? Number(serviceCharge) : 0;
    const finalEntertainment = isEntertainment ? 1 : 0;
    const finalVoucher = isVoucher ? 1 : 0;
    const finalYeahPay = yeahPayEnabled ? 1 : 0;

    const insertReq = pool.request();
    insertReq.input('position', sql.Decimal(18, 0), finalPos);
    insertReq.input('payMode', sql.Char(10), rawMode);
    insertReq.input('description', sql.VarChar(50), desc);
    insertReq.input('commission', sql.Decimal(18, 2), finalCommission);
    insertReq.input('active', sql.Bit, finalActive);
    insertReq.input('serviceCharge', sql.Numeric(18, 2), finalServiceCharge);
    insertReq.input('isEntertainment', sql.Bit, finalEntertainment);
    insertReq.input('isVoucher', sql.Bit, finalVoucher);
    insertReq.input('paymodeImage', sql.NVarChar(sql.MAX), paymodeImage ? String(paymodeImage) : null);
    insertReq.input('deviceSN', sql.NVarChar(100), deviceSN ? String(deviceSN).trim() : null);
    insertReq.input('deviceSalt', sql.NVarChar(200), deviceSalt ? String(deviceSalt).trim() : null);
    insertReq.input('yeahPayEnabled', sql.Bit, finalYeahPay);
    insertReq.input('extraCharges', sql.Decimal(18, 2), finalExtraCharges);

    await insertReq.query(`
      INSERT INTO dbo.Paymode (
        Position,
        PayMode,
        Description,
        Commission,
        Active,
        ServiceCharge,
        isEntertainment,
        isVoucher,
        PaymodeImage,
        DeviceSN,
        DeviceSalt,
        YeahPayEnabled,
        ExtraCharges,
        CreateDate
      ) VALUES (
        @position,
        @payMode,
        @description,
        @commission,
        @active,
        @serviceCharge,
        @isEntertainment,
        @isVoucher,
        @paymodeImage,
        @deviceSN,
        @deviceSalt,
        @yeahPayEnabled,
        @extraCharges,
        GETDATE()
      );
    `);

    return res.status(201).json({
      success: true,
      message: `Payment mode '${rawMode}' created successfully`,
      data: {
        position: finalPos,
        payMode: rawMode,
        code: rawMode,
        description: desc,
        commission: finalCommission,
        active: Boolean(finalActive),
        isActive: Boolean(finalActive),
        serviceCharge: finalServiceCharge,
        isEntertainment: Boolean(finalEntertainment),
        isVoucher: Boolean(finalVoucher),
        paymodeImage: paymodeImage || null,
        deviceSN: deviceSN || null,
        deviceSalt: deviceSalt || null,
        yeahPayEnabled: Boolean(finalYeahPay),
        extraCharges: finalExtraCharges,
      },
    });
  } catch (err) {
    console.error('[Paymode createPaymode Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment mode',
      error: err.message,
    });
  }
}

/**
 * 4. PUT /api/paymodes/:payMode
 * Update an existing payment mode in dbo.Paymode
 */
async function updatePaymode(req, res) {
  try {
    const currentPayMode = (req.params.payMode || '').trim().toUpperCase();
    if (!currentPayMode) {
      return res.status(400).json({ success: false, message: 'PayMode parameter is required' });
    }

    const {
      newPayMode,
      description,
      position,
      commission,
      active,
      isActive,
      serviceCharge,
      isEntertainment,
      isVoucher,
      paymodeImage,
      deviceSN,
      deviceSalt,
      yeahPayEnabled,
      extraCharges,
    } = req.body || {};

    const pool = await getPool();

    // Verify existing record
    const checkResult = await pool.request()
      .input('payMode', sql.Char(10), currentPayMode)
      .query(`SELECT TOP 1 Position, PayMode, Description FROM dbo.Paymode WHERE RTRIM(UPPER(PayMode)) = @payMode;`);

    if (!checkResult.recordset || checkResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: `Payment mode '${currentPayMode}' not found` });
    }

    // Handle newPayMode change if requested
    let targetPayMode = currentPayMode;
    if (newPayMode && newPayMode.trim().toUpperCase() !== currentPayMode) {
      const candidateMode = newPayMode.trim().toUpperCase();
      if (candidateMode.length > 10) {
        return res.status(400).json({ success: false, message: 'New PayMode code cannot exceed 10 characters' });
      }
      const dupCheck = await pool.request()
        .input('newMode', sql.Char(10), candidateMode)
        .query(`SELECT TOP 1 PayMode FROM dbo.Paymode WHERE RTRIM(UPPER(PayMode)) = @newMode;`);

      if (dupCheck.recordset && dupCheck.recordset.length > 0) {
        return res.status(400).json({ success: false, message: `Payment mode code '${candidateMode}' is already taken.` });
      }
      targetPayMode = candidateMode;
    }

    const desc = description !== undefined ? String(description).trim() : checkResult.recordset[0].Description;
    if (!desc) {
      return res.status(400).json({ success: false, message: 'Description cannot be empty' });
    }
    if (desc.length > 50) {
      return res.status(400).json({ success: false, message: 'Description cannot exceed 50 characters' });
    }

    const finalPos = position !== undefined && !isNaN(Number(position)) ? Number(position) : Number(checkResult.recordset[0].Position);
    const finalCommission = commission !== undefined && !isNaN(Number(commission)) ? Number(commission) : 0;
    const finalExtraCharges = extraCharges !== undefined && !isNaN(Number(extraCharges)) ? Number(extraCharges) : 0;
    const finalServiceCharge = serviceCharge !== undefined && !isNaN(Number(serviceCharge)) ? Number(serviceCharge) : 0;
    const finalActive = active !== undefined ? (active ? 1 : 0) : (isActive !== undefined ? (isActive ? 1 : 0) : 1);
    const finalEntertainment = isEntertainment !== undefined ? (isEntertainment ? 1 : 0) : 0;
    const finalVoucher = isVoucher !== undefined ? (isVoucher ? 1 : 0) : 0;
    const finalYeahPay = yeahPayEnabled !== undefined ? (yeahPayEnabled ? 1 : 0) : 0;

    const updReq = pool.request();
    updReq.input('currentPayMode', sql.Char(10), currentPayMode);
    updReq.input('targetPayMode', sql.Char(10), targetPayMode);
    updReq.input('description', sql.VarChar(50), desc);
    updReq.input('position', sql.Decimal(18, 0), finalPos);
    updReq.input('commission', sql.Decimal(18, 2), finalCommission);
    updReq.input('active', sql.Bit, finalActive);
    updReq.input('serviceCharge', sql.Numeric(18, 2), finalServiceCharge);
    updReq.input('isEntertainment', sql.Bit, finalEntertainment);
    updReq.input('isVoucher', sql.Bit, finalVoucher);
    updReq.input('extraCharges', sql.Decimal(18, 2), finalExtraCharges);
    updReq.input('yeahPayEnabled', sql.Bit, finalYeahPay);

    let imageClause = '';
    if (paymodeImage !== undefined) {
      updReq.input('paymodeImage', sql.NVarChar(sql.MAX), paymodeImage ? String(paymodeImage) : null);
      imageClause = ', PaymodeImage = @paymodeImage';
    }

    let deviceClause = '';
    if (deviceSN !== undefined) {
      updReq.input('deviceSN', sql.NVarChar(100), deviceSN ? String(deviceSN).trim() : null);
      deviceClause += ', DeviceSN = @deviceSN';
    }
    if (deviceSalt !== undefined) {
      updReq.input('deviceSalt', sql.NVarChar(200), deviceSalt ? String(deviceSalt).trim() : null);
      deviceClause += ', DeviceSalt = @deviceSalt';
    }

    await updReq.query(`
      UPDATE dbo.Paymode
      SET 
        PayMode = @targetPayMode,
        Description = @description,
        Position = @position,
        Commission = @commission,
        Active = @active,
        ServiceCharge = @serviceCharge,
        isEntertainment = @isEntertainment,
        isVoucher = @isVoucher,
        ExtraCharges = @extraCharges,
        YeahPayEnabled = @yeahPayEnabled,
        ModifyDate = GETDATE()
        ${imageClause}
        ${deviceClause}
      WHERE RTRIM(UPPER(PayMode)) = @currentPayMode;
    `);

    return res.status(200).json({
      success: true,
      message: `Payment mode '${targetPayMode}' updated successfully`,
      data: {
        payMode: targetPayMode,
        code: targetPayMode,
        description: desc,
        position: finalPos,
        commission: finalCommission,
        active: Boolean(finalActive),
        isActive: Boolean(finalActive),
        serviceCharge: finalServiceCharge,
        isEntertainment: Boolean(finalEntertainment),
        isVoucher: Boolean(finalVoucher),
        extraCharges: finalExtraCharges,
        yeahPayEnabled: Boolean(finalYeahPay),
      },
    });
  } catch (err) {
    console.error('[Paymode updatePaymode Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update payment mode',
      error: err.message,
    });
  }
}

/**
 * 5. PATCH /api/paymodes/:payMode/status
 * Quick toggle active/inactive status
 */
async function togglePaymodeStatus(req, res) {
  try {
    const rawMode = (req.params.payMode || '').trim().toUpperCase();
    if (!rawMode) {
      return res.status(400).json({ success: false, message: 'PayMode parameter is required' });
    }

    const { active, isActive } = req.body || {};
    const pool = await getPool();

    // Check if mode exists
    const check = await pool.request()
      .input('payMode', sql.Char(10), rawMode)
      .query(`SELECT TOP 1 Active FROM dbo.Paymode WHERE RTRIM(UPPER(PayMode)) = @payMode;`);

    if (!check.recordset || check.recordset.length === 0) {
      return res.status(404).json({ success: false, message: `Payment mode '${rawMode}' not found` });
    }

    const currentActive = Boolean(check.recordset[0].Active);
    const newActive = active !== undefined ? Boolean(active) : (isActive !== undefined ? Boolean(isActive) : !currentActive);

    await pool.request()
      .input('payMode', sql.Char(10), rawMode)
      .input('active', sql.Bit, newActive ? 1 : 0)
      .query(`
        UPDATE dbo.Paymode
        SET Active = @active, ModifyDate = GETDATE()
        WHERE RTRIM(UPPER(PayMode)) = @payMode;
      `);

    return res.status(200).json({
      success: true,
      message: `Payment mode '${rawMode}' is now ${newActive ? 'Active' : 'Inactive'}`,
      data: {
        payMode: rawMode,
        active: newActive,
        isActive: newActive,
      },
    });
  } catch (err) {
    console.error('[Paymode togglePaymodeStatus Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: err.message,
    });
  }
}

/**
 * 6. DELETE /api/paymodes/:payMode
 * Delete a payment mode from dbo.Paymode
 * Checks if payment mode is in use in CarWashOrder
 */
async function deletePaymode(req, res) {
  try {
    const rawMode = (req.params.payMode || '').trim().toUpperCase();
    if (!rawMode) {
      return res.status(400).json({ success: false, message: 'PayMode parameter is required' });
    }

    const pool = await getPool();

    // Check existence
    const check = await pool.request()
      .input('payMode', sql.Char(10), rawMode)
      .query(`SELECT TOP 1 PayMode, Description FROM dbo.Paymode WHERE RTRIM(UPPER(PayMode)) = @payMode;`);

    if (!check.recordset || check.recordset.length === 0) {
      return res.status(404).json({ success: false, message: `Payment mode '${rawMode}' not found` });
    }

    // Check usage in orders
    const orderUsageCheck = await pool.request()
      .input('payMode', sql.Char(10), rawMode)
      .query(`SELECT COUNT(1) AS TotalOrders FROM dbo.CarWashOrder WHERE RTRIM(UPPER(PayMode)) = @payMode;`);

    const totalOrders = orderUsageCheck.recordset[0]?.TotalOrders || 0;
    const force = req.query.force === 'true' || req.query.force === '1';

    if (totalOrders > 0 && !force) {
      return res.status(400).json({
        success: false,
        isUsedInOrders: true,
        orderCount: totalOrders,
        message: `Cannot delete payment mode '${rawMode}' because it is linked to ${totalOrders} order(s). You can deactivate it instead to preserve transaction history.`,
      });
    }

    // Perform delete
    await pool.request()
      .input('payMode', sql.Char(10), rawMode)
      .query(`DELETE FROM dbo.Paymode WHERE RTRIM(UPPER(PayMode)) = @payMode;`);

    return res.status(200).json({
      success: true,
      message: `Payment mode '${rawMode}' deleted successfully`,
    });
  } catch (err) {
    console.error('[Paymode deletePaymode Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete payment mode',
      error: err.message,
    });
  }
}

module.exports = {
  getPaymodes,
  getPaymodeById,
  createPaymode,
  updatePaymode,
  togglePaymodeStatus,
  deletePaymode,
};
