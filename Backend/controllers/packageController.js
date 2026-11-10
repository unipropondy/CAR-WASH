const { sql, getPool } = require('../config/db');

/**
 * GET /api/service-packages or /api/packages
 * Query params: ?categoryId=1
 * Retrieve active packages with their active features from SQL Server
 */
async function getPackages(req, res) {
  try {
    const categoryParam = req.query.categoryId || req.params.categoryId;
    const categoryId = categoryParam ? parseInt(categoryParam, 10) : null;

    const pool = await getPool();
    const request = pool.request();

    if (categoryId !== null && !isNaN(categoryId)) {
      request.input('categoryId', sql.Int, categoryId);
    } else {
      request.input('categoryId', sql.Int, null);
    }

    // 1. Fetch active packages
    const pkgResult = await request.query(`
      SELECT 
        p.PackageId,
        p.ServiceCategoryId,
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
      FROM ServicePackageMaster p
      WHERE p.IsActive = 1
        AND (@categoryId IS NULL OR p.ServiceCategoryId = @categoryId)
      ORDER BY p.DisplayOrder ASC, p.PackageId ASC
    `);

    // 2. Fetch active features for these packages
    const featRequest = pool.request();
    if (categoryId !== null && !isNaN(categoryId)) {
      featRequest.input('categoryId', sql.Int, categoryId);
    } else {
      featRequest.input('categoryId', sql.Int, null);
    }

    const featResult = await featRequest.query(`
      SELECT 
        f.FeatureId,
        f.PackageId,
        f.FeatureName,
        f.DisplayOrder,
        f.IsActive
      FROM ServicePackageFeature f
      INNER JOIN ServicePackageMaster p ON f.PackageId = p.PackageId
      WHERE f.IsActive = 1
        AND p.IsActive = 1
        AND (@categoryId IS NULL OR p.ServiceCategoryId = @categoryId)
      ORDER BY f.DisplayOrder ASC, f.FeatureId ASC
    `);

    // Group features by packageId
    const featuresByPkg = {};
    for (const f of featResult.recordset) {
      if (!featuresByPkg[f.PackageId]) {
        featuresByPkg[f.PackageId] = [];
      }
      featuresByPkg[f.PackageId].push(f.FeatureName);
    }

    const packages = pkgResult.recordset.map((row) => ({
      packageId: row.PackageId,
      serviceCategoryId: row.ServiceCategoryId,
      packageCode: row.PackageCode,
      packageName: row.PackageName,
      description: row.Description || '',
      price: Number(row.Price),
      currencyCode: row.CurrencyCode || 'SGD',
      gstPercent: Number(row.GSTPercent || 9),
      isTaxInclusive: Boolean(row.IsTaxInclusive),
      durationMinutes: row.DurationMinutes,
      displayOrder: row.DisplayOrder,
      isActive: row.IsActive,
      features: featuresByPkg[row.PackageId] || [],
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
 * GET /api/service-packages/:packageId/features
 * Retrieve active features for a specific package
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
      FROM ServicePackageFeature
      WHERE PackageId = @packageId AND IsActive = 1
      ORDER BY DisplayOrder ASC, FeatureId ASC
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

module.exports = {
  getPackages,
  getPackageFeatures,
};

