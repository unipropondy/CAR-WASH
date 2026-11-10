const { sql, getPool } = require('../config/db');

/**
 * 1. GET /api/service-packages or /api/packages
 * Query params: ?categoryId=1, ?all=true, ?search=...
 * Retrieve packages with category names and features from SQL Server
 */
async function getPackages(req, res) {
  try {
    const categoryParam = req.query.categoryId || req.params.categoryId;
    const categoryId = categoryParam ? parseInt(categoryParam, 10) : null;
    const { all, search } = req.query || {};
    const includeAll = all === 'true' || all === '1';

    const pool = await getPool();
    const request = pool.request();

    if (categoryId !== null && !isNaN(categoryId)) {
      request.input('categoryId', sql.Int, categoryId);
    } else {
      request.input('categoryId', sql.Int, null);
    }

    let query = `
      SELECT 
        p.PackageId,
        p.ServiceCategoryId,
        c.CategoryName AS ServiceCategoryName,
        c.ServiceCategoryCode,
        p.PackageCode,
        p.PackageName,
        p.Description,
        p.Price,
        p.CurrencyCode,
        p.GSTPercent,
        p.IsTaxInclusive,
        p.DurationMinutes,
        p.DisplayOrder,
        p.IsActive,
        p.CreatedDate
      FROM dbo.ServicePackageMaster p
      LEFT JOIN dbo.ServiceCategoryMaster c ON p.ServiceCategoryId = c.ServiceCategoryId
      WHERE (@categoryId IS NULL OR p.ServiceCategoryId = @categoryId)
    `;

    if (!includeAll) {
      query += ` AND p.IsActive = 1`;
    }

    if (search && search.trim()) {
      request.input('search', sql.NVarChar(100), `%${search.trim()}%`);
      query += ` AND (p.PackageCode LIKE @search OR p.PackageName LIKE @search OR p.Description LIKE @search)`;
    }

    query += ` ORDER BY p.DisplayOrder ASC, p.PackageId ASC;`;

    const pkgResult = await request.query(query);

    // Fetch active features for these packages
    const featResult = await pool.request().query(`
      SELECT 
        FeatureId,
        PackageId,
        FeatureName,
        DisplayOrder,
        IsActive
      FROM dbo.ServicePackageFeature
      WHERE IsActive = 1
      ORDER BY DisplayOrder ASC, FeatureId ASC;
    `);

    // Group features by packageId
    const featuresByPkg = {};
    for (const f of featResult.recordset) {
      if (!featuresByPkg[f.PackageId]) {
        featuresByPkg[f.PackageId] = [];
      }
      featuresByPkg[f.PackageId].push({
        featureId: f.FeatureId,
        featureName: f.FeatureName,
        displayOrder: f.DisplayOrder,
      });
    }

    const packages = pkgResult.recordset.map((row) => ({
      packageId: row.PackageId,
      serviceCategoryId: row.ServiceCategoryId,
      serviceCategoryName: (row.ServiceCategoryName || '').trim(),
      serviceCategoryCode: (row.ServiceCategoryCode || '').trim(),
      packageCode: (row.PackageCode || '').trim(),
      packageName: (row.PackageName || '').trim(),
      description: row.Description ? row.Description.trim() : '',
      price: Number(row.Price),
      currencyCode: (row.CurrencyCode || 'SGD').trim(),
      gstPercent: Number(row.GSTPercent || 9),
      isTaxInclusive: Boolean(row.IsTaxInclusive),
      durationMinutes: row.DurationMinutes,
      displayOrder: row.DisplayOrder ?? 0,
      isActive: Boolean(row.IsActive),
      createdDate: row.CreatedDate,
      features: (featuresByPkg[row.PackageId] || []).map((f) => f.featureName),
      featureList: featuresByPkg[row.PackageId] || [],
    }));

    return res.status(200).json({
      success: true,
      count: packages.length,
      data: packages,
    });
  } catch (err) {
    console.error('[getPackages Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve service packages.',
      error: err.message,
    });
  }
}

/**
 * 2. GET /api/service-packages/:packageId/features
 */
async function getPackageFeatures(req, res) {
  try {
    const packageId = parseInt(req.params.packageId, 10);
    if (isNaN(packageId)) {
      return res.status(400).json({ success: false, message: 'Invalid Package ID' });
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('packageId', sql.Int, packageId);

    const result = await request.query(`
      SELECT 
        FeatureId,
        PackageId,
        FeatureName,
        DisplayOrder,
        IsActive
      FROM dbo.ServicePackageFeature
      WHERE PackageId = @packageId AND IsActive = 1
      ORDER BY DisplayOrder ASC, FeatureId ASC;
    `);

    return res.status(200).json({
      success: true,
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (err) {
    console.error('[getPackageFeatures Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve package features.',
      error: err.message,
    });
  }
}

/**
 * 3. POST /api/service-packages
 * Insert a new package and optional features
 */
async function createPackage(req, res) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      serviceCategoryId,
      packageCode,
      packageName,
      description,
      price,
      currencyCode = 'SGD',
      gstPercent = 9.0,
      isTaxInclusive = false,
      durationMinutes,
      displayOrder = 1,
      isActive = true,
      features = [],
    } = req.body || {};

    if (!serviceCategoryId) {
      return res.status(400).json({ success: false, message: 'Service Category ID is required.' });
    }
    if (!packageCode || !packageCode.trim()) {
      return res.status(400).json({ success: false, message: 'Package Code is required.' });
    }
    if (!packageName || !packageName.trim()) {
      return res.status(400).json({ success: false, message: 'Package Name is required.' });
    }
    if (price === undefined || isNaN(parseFloat(price))) {
      return res.status(400).json({ success: false, message: 'Valid package price is required.' });
    }

    // Duplicate check
    const dupCheck = pool.request();
    dupCheck.input('code', sql.NVarChar(50), packageCode.trim().toUpperCase());
    const dupRes = await dupCheck.query(`
      SELECT PackageId FROM dbo.ServicePackageMaster WHERE UPPER(PackageCode) = @code;
    `);
    if (dupRes.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Package Code "${packageCode}" already exists.`,
      });
    }

    await transaction.begin();

    const insertReq = new sql.Request(transaction);
    insertReq.input('catId', sql.Int, parseInt(serviceCategoryId, 10));
    insertReq.input('code', sql.NVarChar(50), packageCode.trim().toUpperCase());
    insertReq.input('name', sql.NVarChar(150), packageName.trim());
    insertReq.input('desc', sql.NVarChar(500), description ? description.trim() : null);
    insertReq.input('price', sql.Decimal(10, 2), parseFloat(price));
    insertReq.input('currency', sql.NVarChar(10), (currencyCode || 'SGD').trim());
    insertReq.input('gst', sql.Decimal(5, 2), parseFloat(gstPercent || 9));
    insertReq.input('taxInc', sql.Bit, isTaxInclusive ? 1 : 0);
    insertReq.input('duration', sql.Int, durationMinutes ? parseInt(durationMinutes, 10) : null);
    insertReq.input('order', sql.Int, parseInt(displayOrder || '1', 10));
    insertReq.input('active', sql.Bit, isActive ? 1 : 0);

    const result = await insertReq.query(`
      INSERT INTO dbo.ServicePackageMaster (
        ServiceCategoryId,
        PackageCode,
        PackageName,
        Description,
        Price,
        CurrencyCode,
        GSTPercent,
        IsTaxInclusive,
        DurationMinutes,
        DisplayOrder,
        IsActive,
        CreatedDate
      )
      OUTPUT INSERTED.PackageId, INSERTED.ServiceCategoryId, INSERTED.PackageCode, INSERTED.PackageName, INSERTED.Price, INSERTED.GSTPercent, INSERTED.IsActive, INSERTED.CreatedDate
      VALUES (
        @catId,
        @code,
        @name,
        @desc,
        @price,
        @currency,
        @gst,
        @taxInc,
        @duration,
        @order,
        @active,
        GETDATE()
      );
    `);

    const newPkg = result.recordset[0];
    const newPkgId = newPkg.PackageId;

    // Insert features if provided
    if (Array.isArray(features) && features.length > 0) {
      for (let i = 0; i < features.length; i++) {
        const feat = features[i];
        const featName = typeof feat === 'string' ? feat.trim() : feat.featureName?.trim();
        if (featName) {
          const featReq = new sql.Request(transaction);
          featReq.input('pkgId', sql.Int, newPkgId);
          featReq.input('fName', sql.NVarChar(250), featName);
          featReq.input('order', sql.Int, i + 1);

          await featReq.query(`
            INSERT INTO dbo.ServicePackageFeature (PackageId, FeatureName, DisplayOrder, IsActive, CreatedDate)
            VALUES (@pkgId, @fName, @order, 1, GETDATE());
          `);
        }
      }
    }

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: `Package "${packageName}" created successfully.`,
      data: newPkg,
    });
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {}
    console.error('[createPackage Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create package.',
      error: err.message,
    });
  }
}

/**
 * 4. PUT /api/service-packages/:id
 * Update package and optional features
 */
async function updatePackage(req, res) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    const packageId = parseInt(req.params.id, 10);
    if (isNaN(packageId)) {
      return res.status(400).json({ success: false, message: 'Invalid Package ID' });
    }

    const {
      serviceCategoryId,
      packageCode,
      packageName,
      description,
      price,
      currencyCode,
      gstPercent,
      isTaxInclusive,
      durationMinutes,
      displayOrder,
      isActive,
      features,
    } = req.body || {};

    await transaction.begin();

    const reqDb = new sql.Request(transaction);
    reqDb.input('id', sql.Int, packageId);

    const updates = [];
    if (serviceCategoryId !== undefined) {
      reqDb.input('catId', sql.Int, parseInt(serviceCategoryId, 10));
      updates.push(`ServiceCategoryId = @catId`);
    }
    if (packageCode !== undefined && packageCode.trim()) {
      reqDb.input('code', sql.NVarChar(50), packageCode.trim().toUpperCase());
      updates.push(`PackageCode = @code`);
    }
    if (packageName !== undefined && packageName.trim()) {
      reqDb.input('name', sql.NVarChar(150), packageName.trim());
      updates.push(`PackageName = @name`);
    }
    if (description !== undefined) {
      reqDb.input('desc', sql.NVarChar(500), description ? description.trim() : null);
      updates.push(`Description = @desc`);
    }
    if (price !== undefined) {
      reqDb.input('price', sql.Decimal(10, 2), parseFloat(price));
      updates.push(`Price = @price`);
    }
    if (currencyCode !== undefined) {
      reqDb.input('curr', sql.NVarChar(10), currencyCode.trim());
      updates.push(`CurrencyCode = @curr`);
    }
    if (gstPercent !== undefined) {
      reqDb.input('gst', sql.Decimal(5, 2), parseFloat(gstPercent));
      updates.push(`GSTPercent = @gst`);
    }
    if (isTaxInclusive !== undefined) {
      reqDb.input('taxInc', sql.Bit, isTaxInclusive ? 1 : 0);
      updates.push(`IsTaxInclusive = @taxInc`);
    }
    if (durationMinutes !== undefined) {
      reqDb.input('dur', sql.Int, durationMinutes ? parseInt(durationMinutes, 10) : null);
      updates.push(`DurationMinutes = @dur`);
    }
    if (displayOrder !== undefined) {
      reqDb.input('ord', sql.Int, parseInt(displayOrder, 10));
      updates.push(`DisplayOrder = @ord`);
    }
    if (isActive !== undefined) {
      reqDb.input('act', sql.Bit, isActive ? 1 : 0);
      updates.push(`IsActive = @act`);
    }

    if (updates.length > 0) {
      await reqDb.query(`
        UPDATE dbo.ServicePackageMaster
        SET ${updates.join(', ')}
        WHERE PackageId = @id;
      `);
    }

    // If features array is explicitly passed, refresh features
    if (Array.isArray(features)) {
      const delFeatReq = new sql.Request(transaction);
      delFeatReq.input('pkgId', sql.Int, packageId);
      await delFeatReq.query(`DELETE FROM dbo.ServicePackageFeature WHERE PackageId = @pkgId;`);

      for (let i = 0; i < features.length; i++) {
        const feat = features[i];
        const featName = typeof feat === 'string' ? feat.trim() : feat.featureName?.trim();
        if (featName) {
          const insFeatReq = new sql.Request(transaction);
          insFeatReq.input('pkgId', sql.Int, packageId);
          insFeatReq.input('fName', sql.NVarChar(250), featName);
          insFeatReq.input('order', sql.Int, i + 1);

          await insFeatReq.query(`
            INSERT INTO dbo.ServicePackageFeature (PackageId, FeatureName, DisplayOrder, IsActive, CreatedDate)
            VALUES (@pkgId, @fName, @order, 1, GETDATE());
          `);
        }
      }
    }

    await transaction.commit();

    const updatedRes = await pool.request()
      .input('id', sql.Int, packageId)
      .query(`SELECT * FROM dbo.ServicePackageMaster WHERE PackageId = @id`);

    return res.status(200).json({
      success: true,
      message: 'Package updated successfully.',
      data: updatedRes.recordset[0],
    });
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {}
    console.error('[updatePackage Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update package.',
      error: err.message,
    });
  }
}

/**
 * 5. DELETE /api/service-packages/:id
 * Soft delete or deactivate package
 */
async function deletePackage(req, res) {
  try {
    const packageId = parseInt(req.params.id, 10);
    if (isNaN(packageId)) {
      return res.status(400).json({ success: false, message: 'Invalid Package ID' });
    }

    const pool = await getPool();

    // Check if package is used in CarWashOrder
    const usageCheck = await pool.request()
      .input('id', sql.Int, packageId)
      .query(`SELECT TOP 1 OrderId FROM dbo.CarWashOrder WHERE PackageId = @id`);

    if (usageCheck.recordset.length > 0) {
      await pool.request()
        .input('id', sql.Int, packageId)
        .query(`UPDATE dbo.ServicePackageMaster SET IsActive = 0 WHERE PackageId = @id`);

      return res.status(200).json({
        success: true,
        message: 'Package has existing bookings, deactivated successfully.',
      });
    }

    // Remove features first then package
    await pool.request().input('id', sql.Int, packageId).query(`
      DELETE FROM dbo.ServicePackageFeature WHERE PackageId = @id;
      DELETE FROM dbo.ServicePackageMaster WHERE PackageId = @id;
    `);

    return res.status(200).json({
      success: true,
      message: 'Package deleted successfully from database.',
    });
  } catch (err) {
    console.error('[deletePackage Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete package.',
      error: err.message,
    });
  }
}

module.exports = {
  getPackages,
  getPackageFeatures,
  createPackage,
  updatePackage,
  deletePackage,
};
