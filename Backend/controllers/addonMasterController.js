const { getPool, sql } = require('../config/db');

/**
 * GET /api/carwash/addons or /api/service-addons
 * Query: ?activeOnly=true&packageId=1
 */
exports.getAddons = async (req, res) => {
  try {
    const { activeOnly, packageId } = req.query;
    const pool = await getPool();

    const request = pool.request();
    let whereClauses = [];

    if (activeOnly === 'true' || activeOnly === true) {
      whereClauses.push('a.IsActive = 1');
    }

    if (packageId) {
      const parsedPkgId = parseInt(packageId, 10);
      if (!isNaN(parsedPkgId)) {
        request.input('packageId', sql.Int, parsedPkgId);
        whereClauses.push(`a.AddonId IN (SELECT AddonId FROM dbo.ServicePackageAddonMapping WITH (NOLOCK) WHERE PackageId = @packageId)`);
      }
    }

    let query = `
      SELECT
        a.AddonId AS addonId,
        a.AddonCode AS addonCode,
        a.AddonName AS addonName,
        a.Category AS category,
        a.CustomerPrice AS customerPrice,
        a.DealerPrice AS dealerPrice,
        a.Icon AS icon,
        a.Description AS description,
        a.DisplayOrder AS displayOrder,
        a.IsActive AS isActive,
        a.CreatedDate AS createdDate,
        a.ModifiedDate AS modifiedDate
      FROM dbo.ServiceAddonMaster a WITH (NOLOCK)
    `;

    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(' AND ');
    }

    query += ` ORDER BY a.Category DESC, a.DisplayOrder ASC, a.AddonName ASC;`;

    const result = await request.query(query);

    // Fetch mappings for packages
    const mappingResult = await pool.request().query(`
      SELECT m.AddonId, m.PackageId, p.PackageName, p.PackageCode
      FROM dbo.ServicePackageAddonMapping m WITH (NOLOCK)
      JOIN dbo.ServicePackageMaster p WITH (NOLOCK) ON p.PackageId = m.PackageId
      ORDER BY p.DisplayOrder ASC, p.PackageName ASC;
    `);

    const packageMap = {};
    for (const row of mappingResult.recordset) {
      if (!packageMap[row.AddonId]) {
        packageMap[row.AddonId] = { ids: [], names: [], codes: [] };
      }
      packageMap[row.AddonId].ids.push(row.PackageId);
      packageMap[row.AddonId].names.push(row.PackageName);
      if (row.PackageCode) packageMap[row.AddonId].codes.push(row.PackageCode);
    }

    return res.status(200).json({
      success: true,
      count: result.recordset.length,
      data: result.recordset.map((row) => ({
        ...row,
        customerPrice: Number(row.customerPrice),
        dealerPrice: Number(row.dealerPrice),
        isActive: Boolean(row.isActive),
        packageIds: packageMap[row.addonId]?.ids || [],
        packageNames: packageMap[row.addonId]?.names || [],
        packageCodes: packageMap[row.addonId]?.codes || [],
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
      packageIds,
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

    const newAddonId = insertResult.recordset[0].AddonId;

    // Insert package mappings if provided
    if (Array.isArray(packageIds) && packageIds.length > 0) {
      for (const pkgId of packageIds) {
        const pId = parseInt(pkgId, 10);
        if (!isNaN(pId)) {
          await pool.request()
            .input('addonId', sql.Int, newAddonId)
            .input('pkgId', sql.Int, pId)
            .query(`
              IF NOT EXISTS (SELECT 1 FROM dbo.ServicePackageAddonMapping WHERE AddonId = @addonId AND PackageId = @pkgId)
              INSERT INTO dbo.ServicePackageAddonMapping (AddonId, PackageId, CreatedAt)
              VALUES (@addonId, @pkgId, GETDATE());
            `);
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Add-on service created successfully.',
      addonId: newAddonId,
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
      packageIds,
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

    // Update package mappings if provided
    if (packageIds !== undefined && Array.isArray(packageIds)) {
      await pool.request()
        .input('addonId', sql.Int, addonId)
        .query(`DELETE FROM dbo.ServicePackageAddonMapping WHERE AddonId = @addonId;`);

      for (const pkgId of packageIds) {
        const pId = parseInt(pkgId, 10);
        if (!isNaN(pId)) {
          await pool.request()
            .input('addonId', sql.Int, addonId)
            .input('pkgId', sql.Int, pId)
            .query(`
              IF NOT EXISTS (SELECT 1 FROM dbo.ServicePackageAddonMapping WHERE AddonId = @addonId AND PackageId = @pkgId)
              INSERT INTO dbo.ServicePackageAddonMapping (AddonId, PackageId, CreatedAt)
              VALUES (@addonId, @pkgId, GETDATE());
            `);
        }
      }
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

    // Delete mappings first
    await pool
      .request()
      .input('id', sql.Int, addonId)
      .query(`DELETE FROM dbo.ServicePackageAddonMapping WHERE AddonId = @id;`);

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
