const { getPool, sql } = require('../config/db');

/**
 * GET /api/carwash/addons
 * Query: ?activeOnly=true
 */
exports.getAddons = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const pool = await getPool();

    let query = `
      SELECT
        AddonId AS addonId,
        AddonCode AS addonCode,
        AddonName AS addonName,
        Category AS category,
        CustomerPrice AS customerPrice,
        DealerPrice AS dealerPrice,
        Icon AS icon,
        Description AS description,
        DisplayOrder AS displayOrder,
        IsActive AS isActive,
        CreatedDate AS createdDate,
        ModifiedDate AS modifiedDate
      FROM dbo.ServiceAddonMaster WITH (NOLOCK)
    `;

    if (activeOnly === 'true' || activeOnly === true) {
      query += ` WHERE IsActive = 1`;
    }

    query += ` ORDER BY Category DESC, DisplayOrder ASC, AddonName ASC;`;

    const result = await pool.request().query(query);

    return res.status(200).json({
      success: true,
      count: result.recordset.length,
      data: result.recordset.map((row) => ({
        ...row,
        customerPrice: Number(row.customerPrice),
        dealerPrice: Number(row.dealerPrice),
        isActive: Boolean(row.isActive),
      })),
    });
  } catch (error) {
    console.error('[AddonController] getAddons error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve add-on services.',
      error: error.message,
    });
  }
};

/**
 * POST /api/carwash/addons
 */
exports.createAddon = async (req, res) => {
  try {
    const {
      addonCode,
      addonName,
      category,
      customerPrice,
      dealerPrice,
      icon,
      description,
      displayOrder,
      isActive,
    } = req.body;

    if (!addonCode || !addonName) {
      return res.status(400).json({
        success: false,
        message: 'addonCode and addonName are required.',
      });
    }

    const pool = await getPool();

    const normalizedCode = addonCode.trim().toUpperCase().replace(/\s+/g, '_');
    const cat = category === 'INTERIOR' ? 'INTERIOR' : 'EXTERIOR';
    const cPrice = isNaN(parseFloat(customerPrice)) ? 0.0 : parseFloat(customerPrice);
    const dPrice = isNaN(parseFloat(dealerPrice)) ? cPrice * 0.75 : parseFloat(dealerPrice);
    const order = isNaN(parseInt(displayOrder, 10)) ? 1 : parseInt(displayOrder, 10);
    const active = isActive !== undefined ? (isActive ? 1 : 0) : 1;

    // Check duplicate code
    const dupCheck = await pool
      .request()
      .input('code', sql.NVarChar(50), normalizedCode)
      .query(`SELECT TOP 1 AddonId FROM dbo.ServiceAddonMaster WITH (NOLOCK) WHERE AddonCode = @code;`);

    if (dupCheck.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Addon code "${normalizedCode}" already exists.`,
      });
    }

    const insertResult = await pool
      .request()
      .input('code', sql.NVarChar(50), normalizedCode)
      .input('name', sql.NVarChar(150), addonName.trim())
      .input('cat', sql.NVarChar(30), cat)
      .input('cPrice', sql.Decimal(10, 2), cPrice)
      .input('dPrice', sql.Decimal(10, 2), dPrice)
      .input('icon', sql.NVarChar(50), icon || 'sparkles-outline')
      .input('desc', sql.NVarChar(500), description ? description.trim() : null)
      .input('order', sql.Int, order)
      .input('isActive', sql.Bit, active)
      .query(`
        INSERT INTO dbo.ServiceAddonMaster (
          AddonCode, AddonName, Category, CustomerPrice, DealerPrice, Icon, Description, DisplayOrder, IsActive, CreatedDate
        )
        OUTPUT INSERTED.AddonId
        VALUES (
          @code, @name, @cat, @cPrice, @dPrice, @icon, @desc, @order, @isActive, GETDATE()
        );
      `);

    return res.status(201).json({
      success: true,
      message: 'Add-on service created successfully.',
      addonId: insertResult.recordset[0].AddonId,
    });
  } catch (error) {
    console.error('[AddonController] createAddon error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create add-on service.',
      error: error.message,
    });
  }
};

/**
 * PUT /api/carwash/addons/:id
 */
exports.updateAddon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      addonCode,
      addonName,
      category,
      customerPrice,
      dealerPrice,
      icon,
      description,
      displayOrder,
      isActive,
    } = req.body;

    const pool = await getPool();
    const addonId = parseInt(id, 10);
    if (isNaN(addonId)) {
      return res.status(400).json({ success: false, message: 'Invalid addon ID.' });
    }

    const cat = category === 'INTERIOR' ? 'INTERIOR' : 'EXTERIOR';
    const cPrice = isNaN(parseFloat(customerPrice)) ? 0.0 : parseFloat(customerPrice);
    const dPrice = isNaN(parseFloat(dealerPrice)) ? cPrice * 0.75 : parseFloat(dealerPrice);
    const order = isNaN(parseInt(displayOrder, 10)) ? 1 : parseInt(displayOrder, 10);
    const active = isActive !== undefined ? (isActive ? 1 : 0) : 1;

    const updateReq = pool.request();
    updateReq.input('id', sql.Int, addonId);
    updateReq.input('name', sql.NVarChar(150), addonName ? addonName.trim() : '');
    updateReq.input('cat', sql.NVarChar(30), cat);
    updateReq.input('cPrice', sql.Decimal(10, 2), cPrice);
    updateReq.input('dPrice', sql.Decimal(10, 2), dPrice);
    updateReq.input('icon', sql.NVarChar(50), icon || 'sparkles-outline');
    updateReq.input('desc', sql.NVarChar(500), description !== undefined ? description.trim() : null);
    updateReq.input('order', sql.Int, order);
    updateReq.input('isActive', sql.Bit, active);

    let query = `
      UPDATE dbo.ServiceAddonMaster
      SET AddonName = @name,
          Category = @cat,
          CustomerPrice = @cPrice,
          DealerPrice = @dPrice,
          Icon = @icon,
          Description = @desc,
          DisplayOrder = @order,
          IsActive = @isActive,
          ModifiedDate = GETDATE()
    `;

    if (addonCode) {
      updateReq.input('code', sql.NVarChar(50), addonCode.trim().toUpperCase().replace(/\s+/g, '_'));
      query += `, AddonCode = @code `;
    }

    query += ` WHERE AddonId = @id;`;

    const result = await updateReq.query(query);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, message: 'Add-on service not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Add-on service updated successfully.',
    });
  } catch (error) {
    console.error('[AddonController] updateAddon error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update add-on service.',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/carwash/addons/:id
 */
exports.deleteAddon = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const addonId = parseInt(id, 10);
    if (isNaN(addonId)) {
      return res.status(400).json({ success: false, message: 'Invalid addon ID.' });
    }

    const result = await pool
      .request()
      .input('id', sql.Int, addonId)
      .query(`DELETE FROM dbo.ServiceAddonMaster WHERE AddonId = @id;`);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, message: 'Add-on service not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Add-on service deleted successfully.',
    });
  } catch (error) {
    console.error('[AddonController] deleteAddon error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete add-on service.',
      error: error.message,
    });
  }
};
