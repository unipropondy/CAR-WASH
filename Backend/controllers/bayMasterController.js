const { getPool, sql } = require('../config/db');

/**
 * BayMaster Controller
 * STRICT RULE: Bay Management operations strictly read/write dbo.BayMaster.
 * TableMaster is NOT used and remains strictly for restaurant POS.
 */

// Format row from BayMaster into consistent JSON representation
function formatBayRecord(row) {
  if (!row) return null;
  return {
    bayId: row.BayId,
    bayNumber: row.BayNumber,
    bayName: (row.BayName || `BAY ${row.BayNumber}`).trim(),
    bayType: (row.BayType || 'CAR WASH').trim(),
    bayStatus: (row.BayStatus || 'AVAILABLE').trim().toUpperCase(),
    xSize: row.XSize ?? 150,
    ySize: row.YSize ?? 200,
    xPos: row.XPos ?? 0,
    yPos: row.YPos ?? 0,
    customerName: row.CustomerName ? row.CustomerName.trim() : null,
    customerMobile: row.CustomerMobile ? row.CustomerMobile.trim() : null,
    vehicleNumber: row.VehicleNumber ? row.VehicleNumber.trim() : null,
    currentOrderId: row.CurrentOrderId ? row.CurrentOrderId.trim() : null,
    totalAmount: row.TotalAmount != null ? Number(row.TotalAmount) : 0,
    isLocked: Boolean(row.IsLocked),
    remarks: row.Remarks ? row.Remarks.trim() : null,
    createdBy: row.CreatedBy,
    createdOn: row.CreatedOn,
    modifiedBy: row.ModifiedBy,
    modifiedOn: row.ModifiedOn,
    status: row.Status != null ? Boolean(row.Status) : true,
  };
}

/**
 * 1. GET /api/carwash/bays
 * Fetch all bays dynamically from dbo.BayMaster
 */
async function getBays(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        BayId,
        BayNumber,
        BayName,
        BayType,
        BayStatus,
        XSize,
        YSize,
        XPos,
        YPos,
        CustomerName,
        CustomerMobile,
        VehicleNumber,
        CurrentOrderId,
        TotalAmount,
        IsLocked,
        Remarks,
        CreatedBy,
        CreatedOn,
        ModifiedBy,
        ModifiedOn,
        Status
      FROM dbo.BayMaster
      WHERE Status = 1 OR Status IS NULL
      ORDER BY BayNumber ASC;
    `);

    const bays = result.recordset.map(formatBayRecord);

    return res.status(200).json({
      success: true,
      count: bays.length,
      data: bays,
    });
  } catch (err) {
    console.error('[BayMaster getBays Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bays from BayMaster database',
      error: err.message,
    });
  }
}

/**
 * 2. GET /api/carwash/bays/:id
 * Fetch single bay from dbo.BayMaster by BayId (GUID) or BayNumber (int)
 */
async function getBayById(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const reqDb = pool.request();
    reqDb.input('id', sql.NVarChar(100), id);

    const isNumeric = /^\d+$/.test(id);
    let whereClause = `BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER)`;
    if (isNumeric) {
      reqDb.input('bayNumber', sql.Int, parseInt(id, 10));
      whereClause = `BayNumber = @bayNumber OR BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER)`;
    }

    const result = await reqDb.query(`
      SELECT 
        BayId, BayNumber, BayName, BayType, BayStatus,
        XSize, YSize, XPos, YPos,
        CustomerName, CustomerMobile, VehicleNumber,
        CurrentOrderId, TotalAmount, IsLocked, Remarks,
        CreatedBy, CreatedOn, ModifiedBy, ModifiedOn, Status
      FROM dbo.BayMaster
      WHERE ${whereClause};
    `);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: `Bay not found: ${id}` });
    }

    return res.status(200).json({
      success: true,
      data: formatBayRecord(result.recordset[0]),
    });
  } catch (err) {
    console.error('[BayMaster getBayById Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bay details',
      error: err.message,
    });
  }
}

/**
 * 3. POST /api/carwash/bays
 * Create a new bay record in dbo.BayMaster
 */
async function createBay(req, res) {
  try {
    const pool = await getPool();
    const {
      bayNumber,
      bayName,
      bayType = 'CAR WASH',
      bayStatus = 'AVAILABLE',
      xSize = 150,
      ySize = 200,
      xPos = 0,
      yPos = 0,
      remarks,
    } = req.body || {};

    if (!bayNumber || isNaN(parseInt(bayNumber, 10))) {
      return res.status(400).json({ success: false, message: 'bayNumber is required and must be an integer' });
    }

    const parsedNumber = parseInt(bayNumber, 10);
    const finalName = bayName || `BAY ${parsedNumber}`;

    const checkExisting = await pool.request()
      .input('bayNum', sql.Int, parsedNumber)
      .query(`SELECT BayNumber FROM dbo.BayMaster WHERE BayNumber = @bayNum;`);

    if (checkExisting.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Bay number ${parsedNumber} already exists in BayMaster`,
      });
    }

    const insertReq = pool.request();
    insertReq.input('bayNumber', sql.Int, parsedNumber);
    insertReq.input('bayName', sql.NVarChar(100), finalName);
    insertReq.input('bayType', sql.NVarChar(50), bayType);
    insertReq.input('bayStatus', sql.NVarChar(50), bayStatus.toUpperCase());
    insertReq.input('xSize', sql.Int, xSize);
    insertReq.input('ySize', sql.Int, ySize);
    insertReq.input('xPos', sql.Int, xPos);
    insertReq.input('yPos', sql.Int, yPos);
    insertReq.input('remarks', sql.NVarChar(500), remarks || null);

    const result = await insertReq.query(`
      DECLARE @newBayId UNIQUEIDENTIFIER = NEWID();

      INSERT INTO dbo.BayMaster (
        BayId, BayNumber, BayName, BayType, BayStatus,
        XSize, YSize, XPos, YPos,
        IsLocked, Remarks, CreatedOn, Status
      )
      OUTPUT INSERTED.*
      VALUES (
        @newBayId, @bayNumber, @bayName, @bayType, @bayStatus,
        @xSize, @ySize, @xPos, @yPos,
        0, @remarks, GETDATE(), 1
      );
    `);

    return res.status(201).json({
      success: true,
      message: `Bay ${finalName} created successfully in BayMaster`,
      data: formatBayRecord(result.recordset[0]),
    });
  } catch (err) {
    console.error('[BayMaster createBay Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create bay in BayMaster',
      error: err.message,
    });
  }
}

/**
 * 4. PUT /api/carwash/bays/:id
 * Update bay general properties & layout in dbo.BayMaster
 */
async function updateBay(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const {
      bayName,
      bayType,
      bayStatus,
      xSize,
      ySize,
      xPos,
      yPos,
      remarks,
      isLocked,
    } = req.body || {};

    const reqDb = pool.request();
    reqDb.input('id', sql.NVarChar(100), id);

    const isNumeric = /^\d+$/.test(id);
    let matchCondition = `BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER)`;
    if (isNumeric) {
      reqDb.input('bayNumber', sql.Int, parseInt(id, 10));
      matchCondition = `(BayNumber = @bayNumber OR BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER))`;
    }

    const updates = [`ModifiedOn = GETDATE()`];
    if (bayName !== undefined) {
      reqDb.input('bayName', sql.NVarChar(100), bayName);
      updates.push(`BayName = @bayName`);
    }
    if (bayType !== undefined) {
      reqDb.input('bayType', sql.NVarChar(50), bayType);
      updates.push(`BayType = @bayType`);
    }
    if (bayStatus !== undefined) {
      reqDb.input('bayStatus', sql.NVarChar(50), bayStatus.toUpperCase());
      updates.push(`BayStatus = @bayStatus`);
    }
    if (xSize !== undefined) {
      reqDb.input('xSize', sql.Int, parseInt(xSize, 10));
      updates.push(`XSize = @xSize`);
    }
    if (ySize !== undefined) {
      reqDb.input('ySize', sql.Int, parseInt(ySize, 10));
      updates.push(`YSize = @ySize`);
    }
    if (xPos !== undefined) {
      reqDb.input('xPos', sql.Int, parseInt(xPos, 10));
      updates.push(`XPos = @xPos`);
    }
    if (yPos !== undefined) {
      reqDb.input('yPos', sql.Int, parseInt(yPos, 10));
      updates.push(`YPos = @yPos`);
    }
    if (remarks !== undefined) {
      reqDb.input('remarks', sql.NVarChar(500), remarks);
      updates.push(`Remarks = @remarks`);
    }
    if (isLocked !== undefined) {
      reqDb.input('isLocked', sql.Bit, isLocked ? 1 : 0);
      updates.push(`IsLocked = @isLocked`);
    }

    const query = `
      UPDATE dbo.BayMaster
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE ${matchCondition};
    `;

    const result = await reqDb.query(query);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: `Bay not found: ${id}` });
    }

    return res.status(200).json({
      success: true,
      message: 'Bay updated successfully in BayMaster',
      data: formatBayRecord(result.recordset[0]),
    });
  } catch (err) {
    console.error('[BayMaster updateBay Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update bay in BayMaster',
      error: err.message,
    });
  }
}

/**
 * 5. PUT /api/carwash/bays/:id/status
 * Update bay status (e.g. AVAILABLE, IN_SERVICE, CLEANING, MAINTENANCE)
 */
async function updateBayStatus(req, res) {
  try {
    const { id } = req.params;
    const { bayStatus } = req.body || {};

    if (!bayStatus) {
      return res.status(400).json({ success: false, message: 'bayStatus is required' });
    }

    const pool = await getPool();
    const reqDb = pool.request();
    reqDb.input('id', sql.NVarChar(100), id);
    reqDb.input('bayStatus', sql.NVarChar(50), bayStatus.trim().toUpperCase());

    const isNumeric = /^\d+$/.test(id);
    let matchCondition = `BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER)`;
    if (isNumeric) {
      reqDb.input('bayNumber', sql.Int, parseInt(id, 10));
      matchCondition = `(BayNumber = @bayNumber OR BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER))`;
    }

    const result = await reqDb.query(`
      UPDATE dbo.BayMaster
      SET 
        BayStatus = @bayStatus,
        CustomerName = CASE WHEN @bayStatus = 'AVAILABLE' THEN NULL ELSE CustomerName END,
        CustomerMobile = CASE WHEN @bayStatus = 'AVAILABLE' THEN NULL ELSE CustomerMobile END,
        VehicleNumber = CASE WHEN @bayStatus = 'AVAILABLE' THEN NULL ELSE VehicleNumber END,
        CurrentOrderId = CASE WHEN @bayStatus = 'AVAILABLE' THEN NULL ELSE CurrentOrderId END,
        TotalAmount = CASE WHEN @bayStatus = 'AVAILABLE' THEN 0 ELSE TotalAmount END,
        ModifiedOn = GETDATE()
      OUTPUT INSERTED.*
      WHERE ${matchCondition};
    `);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: `Bay not found: ${id}` });
    }

    return res.status(200).json({
      success: true,
      message: `Bay status updated to ${bayStatus.toUpperCase()} in BayMaster`,
      data: formatBayRecord(result.recordset[0]),
    });
  } catch (err) {
    console.error('[BayMaster updateBayStatus Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update bay status',
      error: err.message,
    });
  }
}

/**
 * 6. PUT /api/carwash/bays/:id/assign
 * Assign customer and vehicle using respective columns in BayMaster
 */
async function assignBay(req, res) {
  try {
    const { id } = req.params;
    const {
      customerName,
      customerMobile,
      vehicleNumber,
      currentOrderId,
      totalAmount,
      remarks,
    } = req.body || {};

    const pool = await getPool();

    // Verify bay is not occupied by another active order in dbo.CarWashOrder
    const isNumeric = /^\d+$/.test(id);
    let targetBayNumber = isNumeric ? parseInt(id, 10) : null;
    if (!targetBayNumber) {
      const getNum = await pool.request().input('bId', sql.NVarChar(100), id).query(`
        SELECT BayNumber FROM dbo.BayMaster WHERE BayId = TRY_CAST(@bId AS UNIQUEIDENTIFIER);
      `);
      if (getNum.recordset.length) {
        targetBayNumber = getNum.recordset[0].BayNumber;
      }
    }

    if (targetBayNumber) {
      const conflictReq = pool.request();
      conflictReq.input('targetBayNumber', sql.Int, targetBayNumber);
      conflictReq.input('currentOrderNo', sql.NVarChar(50), currentOrderId ? String(currentOrderId) : '');
      const conflictResult = await conflictReq.query(`
        SELECT TOP 1 OrderId, OrderNo, VehicleNumber
        FROM dbo.CarWashOrder
        WHERE BayId = @targetBayNumber
          AND StatusCode IN (40, 50)
          AND OrderNo != @currentOrderNo;
      `);
      if (conflictResult.recordset.length > 0) {
        const busy = conflictResult.recordset[0];
        return res.status(409).json({
          success: false,
          message: `Bay ${targetBayNumber} is currently occupied by active order ${busy.OrderNo} (${busy.VehicleNumber}).`,
        });
      }
    }

    const reqDb = pool.request();
    reqDb.input('id', sql.NVarChar(100), id);
    reqDb.input('customerName', sql.NVarChar(150), customerName || null);
    reqDb.input('customerMobile', sql.NVarChar(20), customerMobile || null);
    reqDb.input('vehicleNumber', sql.NVarChar(50), vehicleNumber || null);
    reqDb.input('currentOrderId', sql.NVarChar(50), currentOrderId ? String(currentOrderId) : null);
    reqDb.input('totalAmount', sql.Decimal(10, 2), totalAmount != null ? Number(totalAmount) : 0);
    reqDb.input('remarks', sql.NVarChar(500), remarks || null);

    let matchCondition = `BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER)`;
    if (isNumeric) {
      reqDb.input('bayNumber', sql.Int, parseInt(id, 10));
      matchCondition = `(BayNumber = @bayNumber OR BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER))`;
    }

    const result = await reqDb.query(`
      UPDATE dbo.BayMaster
      SET 
        BayStatus = 'IN_SERVICE',
        CustomerName = @customerName,
        CustomerMobile = @customerMobile,
        VehicleNumber = @vehicleNumber,
        CurrentOrderId = @currentOrderId,
        TotalAmount = @totalAmount,
        Remarks = @remarks,
        ModifiedOn = GETDATE()
      OUTPUT INSERTED.*
      WHERE ${matchCondition};
    `);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: `Bay not found: ${id}` });
    }

    return res.status(200).json({
      success: true,
      message: 'Vehicle assigned to bay successfully in BayMaster',
      data: formatBayRecord(result.recordset[0]),
    });
  } catch (err) {
    console.error('[BayMaster assignBay Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign vehicle to bay in BayMaster',
      error: err.message,
    });
  }
}

/**
 * 7. PUT /api/carwash/bays/:id/release
 * Release bay back to AVAILABLE and clear occupancy in BayMaster
 */
async function releaseBay(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const reqDb = pool.request();
    reqDb.input('id', sql.NVarChar(100), id);

    const isNumeric = /^\d+$/.test(id);
    let matchCondition = `BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER)`;
    if (isNumeric) {
      reqDb.input('bayNumber', sql.Int, parseInt(id, 10));
      matchCondition = `(BayNumber = @bayNumber OR BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER))`;
    }

    const result = await reqDb.query(`
      UPDATE dbo.BayMaster
      SET 
        BayStatus = 'AVAILABLE',
        CustomerName = NULL,
        CustomerMobile = NULL,
        VehicleNumber = NULL,
        CurrentOrderId = NULL,
        TotalAmount = 0,
        ModifiedOn = GETDATE()
      OUTPUT INSERTED.*
      WHERE ${matchCondition};
    `);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: `Bay not found: ${id}` });
    }

    return res.status(200).json({
      success: true,
      message: 'Bay released and ready for wash in BayMaster',
      data: formatBayRecord(result.recordset[0]),
    });
  } catch (err) {
    console.error('[BayMaster releaseBay Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to release bay in BayMaster',
      error: err.message,
    });
  }
}

/**
 * 8. PUT /api/carwash/bays/layout
 * Batch update layout coordinates (XPos, YPos, XSize, YSize)
 */
async function updateLayout(req, res) {
  try {
    const { bays } = req.body || {};
    if (!Array.isArray(bays) || !bays.length) {
      return res.status(400).json({ success: false, message: 'bays array is required' });
    }

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const item of bays) {
        const itemReq = new sql.Request(transaction);
        itemReq.input('id', sql.NVarChar(100), String(item.bayId || item.bayNumber || item.id));
        itemReq.input('xPos', sql.Int, parseInt(item.xPos ?? 0, 10));
        itemReq.input('yPos', sql.Int, parseInt(item.yPos ?? 0, 10));
        itemReq.input('xSize', sql.Int, parseInt(item.xSize ?? 150, 10));
        itemReq.input('ySize', sql.Int, parseInt(item.ySize ?? 200, 10));

        const isNum = /^\d+$/.test(String(item.bayNumber || item.id));
        let match = `BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER)`;
        if (isNum) {
          itemReq.input('bayNumber', sql.Int, parseInt(item.bayNumber || item.id, 10));
          match = `(BayNumber = @bayNumber OR BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER))`;
        }

        await itemReq.query(`
          UPDATE dbo.BayMaster
          SET 
            XPos = @xPos,
            YPos = @yPos,
            XSize = @xSize,
            YSize = @ySize,
            ModifiedOn = GETDATE()
          WHERE ${match};
        `);
      }

      await transaction.commit();

      // Return updated list
      const updated = await pool.request().query(`
        SELECT * FROM dbo.BayMaster WHERE Status = 1 OR Status IS NULL ORDER BY BayNumber ASC;
      `);

      return res.status(200).json({
        success: true,
        message: 'Bay layout positions updated successfully in BayMaster',
        data: updated.recordset.map(formatBayRecord),
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('[BayMaster updateLayout Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update bay layout in BayMaster',
      error: err.message,
    });
  }
}

/**
 * 9. DELETE /api/carwash/bays/:id
 * Delete or deactivate bay in dbo.BayMaster
 */
async function deleteBay(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const isNumeric = /^\d+$/.test(id);
    let matchCondition = `BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER)`;
    const reqDb = pool.request();
    reqDb.input('id', sql.NVarChar(100), id);

    if (isNumeric) {
      reqDb.input('bayNumber', sql.Int, parseInt(id, 10));
      matchCondition = `(BayNumber = @bayNumber OR BayId = TRY_CAST(@id AS UNIQUEIDENTIFIER))`;
    }

    // Check if bay currently has an in-service car wash order
    let targetBayNumber = isNumeric ? parseInt(id, 10) : null;
    if (!targetBayNumber) {
      const getNum = await pool.request().input('bId', sql.NVarChar(100), id).query(`
        SELECT BayNumber FROM dbo.BayMaster WHERE BayId = TRY_CAST(@bId AS UNIQUEIDENTIFIER);
      `);
      if (getNum.recordset.length) targetBayNumber = getNum.recordset[0].BayNumber;
    }

    if (targetBayNumber) {
      const busyCheck = await pool.request()
        .input('bayNum', sql.Int, targetBayNumber)
        .query(`SELECT TOP 1 OrderId FROM dbo.CarWashOrder WHERE BayId = @bayNum AND StatusCode IN (40, 50)`);

      if (busyCheck.recordset.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Bay ${targetBayNumber} is currently occupied by an active wash order and cannot be deleted.`,
        });
      }
    }

    // Soft-delete by setting Status = 0
    const result = await reqDb.query(`
      UPDATE dbo.BayMaster
      SET Status = 0, BayStatus = 'MAINTENANCE', ModifiedOn = GETDATE()
      OUTPUT INSERTED.*
      WHERE ${matchCondition};
    `);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: `Bay not found: ${id}` });
    }

    return res.status(200).json({
      success: true,
      message: `Bay deactivated successfully in BayMaster.`,
      data: formatBayRecord(result.recordset[0]),
    });
  } catch (err) {
    console.error('[BayMaster deleteBay Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete bay in BayMaster',
      error: err.message,
    });
  }
}

module.exports = {
  getBays,
  getBayById,
  createBay,
  updateBay,
  updateBayStatus,
  assignBay,
  releaseBay,
  updateLayout,
  deleteBay,
};

