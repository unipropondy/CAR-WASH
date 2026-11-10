const { sql, getPool } = require('../config/db');

// Fallback SVG icons based on category type when ImageData is not yet uploaded
const CATEGORY_SVGS = {
  CAR_WASH: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <circle cx="40" cy="40" r="38" fill="#EFF6FF"/>
  <!-- Shower Head -->
  <path d="M40 18 L40 28 M30 28 L50 28 C50 34 30 34 30 28 Z" stroke="#3B82F6" stroke-width="3" stroke-linecap="round" fill="#93C5FD"/>
  <!-- Water Drops -->
  <circle cx="34" cy="42" r="2.5" fill="#3B82F6"/>
  <circle cx="40" cy="40" r="2.5" fill="#3B82F6"/>
  <circle cx="46" cy="42" r="2.5" fill="#3B82F6"/>
  <circle cx="32" cy="52" r="2.5" fill="#60A5FA"/>
  <circle cx="40" cy="50" r="2.5" fill="#60A5FA"/>
  <circle cx="48" cy="52" r="2.5" fill="#60A5FA"/>
  <circle cx="36" cy="60" r="2" fill="#93C5FD"/>
  <circle cx="44" cy="60" r="2" fill="#93C5FD"/>
</svg>
`.trim(),

  POLISHING: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <circle cx="40" cy="40" r="38" fill="#FFFBEB"/>
  <!-- Central Sparkle -->
  <path d="M40 20 Q40 38 22 40 Q40 40 40 58 Q40 40 58 40 Q40 40 40 20 Z" fill="#F59E0B"/>
  <!-- Small Sparkle Top Right -->
  <path d="M55 22 Q55 30 47 31 Q55 31 55 39 Q55 31 63 31 Q55 31 55 22 Z" fill="#FBBF24"/>
  <!-- Small Sparkle Bottom Left -->
  <path d="M26 47 Q26 53 20 54 Q26 54 26 60 Q26 54 32 54 Q26 54 26 47 Z" fill="#FCD34D"/>
</svg>
`.trim(),

  ALCARE_CARE: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <circle cx="40" cy="40" r="38" fill="#F0FDF4"/>
  <!-- Shield -->
  <path d="M40 20 L58 26 C58 42 40 56 40 60 C40 56 22 42 22 26 Z" fill="#10B981" opacity="0.2"/>
  <path d="M40 22 L56 27 C56 41 40 54 40 58 C40 54 24 41 24 27 Z" stroke="#10B981" stroke-width="3" fill="none"/>
  <!-- Checkmark / Sparkle inside -->
  <path d="M33 39 L38 44 L48 34" stroke="#059669" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
`.trim(),

  DEFAULT: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <circle cx="40" cy="40" r="38" fill="#FEF2F2"/>
  <circle cx="40" cy="40" r="20" fill="#ED0712" opacity="0.15"/>
  <path d="M40 28 L40 52 M28 40 L52 40" stroke="#ED0712" stroke-width="4" stroke-linecap="round"/>
</svg>
`.trim(),
};

/**
 * 1. GET /api/service-categories or /api/categories
 * Retrieve categories from ServiceCategoryMaster
 * Query params: ?all=true, ?search=...
 */
async function getServiceCategories(req, res) {
  try {
    const { all, search } = req.query || {};
    const includeAll = all === 'true' || all === '1';

    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT 
        ServiceCategoryId,
        ServiceCategoryCode,
        CategoryName,
        Description,
        ImageData,
        ImageContentType,
        DisplayOrder,
        IsActive,
        CreatedDate
      FROM dbo.ServiceCategoryMaster
    `;

    const whereClauses = [];
    if (!includeAll) {
      whereClauses.push(`IsActive = 1`);
    }
    if (search && search.trim()) {
      request.input('search', sql.NVarChar(100), `%${search.trim()}%`);
      whereClauses.push(`(ServiceCategoryCode LIKE @search OR CategoryName LIKE @search OR Description LIKE @search)`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY DisplayOrder ASC, ServiceCategoryId ASC;`;

    const result = await request.query(query);

    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const categories = result.recordset.map((row) => {
      let imageUrl = null;
      const hasImage = Boolean(row.ImageData && row.ImageData.length > 0);

      if (hasImage) {
        const mime = row.ImageContentType || 'image/png';
        const base64 = Buffer.isBuffer(row.ImageData)
          ? row.ImageData.toString('base64')
          : Buffer.from(row.ImageData).toString('base64');
        imageUrl = `data:${mime};base64,${base64}`;
      } else {
        imageUrl = `${baseUrl}/api/service-categories/${row.ServiceCategoryId}/image`;
      }

      return {
        serviceCategoryId: row.ServiceCategoryId,
        serviceCategoryCode: (row.ServiceCategoryCode || '').trim(),
        categoryName: (row.CategoryName || '').trim(),
        description: row.Description ? row.Description.trim() : '',
        displayOrder: row.DisplayOrder ?? 0,
        isActive: Boolean(row.IsActive),
        createdDate: row.CreatedDate,
        imageContentType: row.ImageContentType,
        imageUrl,
        hasImage,
      };
    });

    return res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (err) {
    console.error('[getServiceCategories Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve service categories.',
      error: err.message,
    });
  }
}

/**
 * 2. GET /api/service-categories/:id/image
 * Stream raw binary ImageData or tailored SVG placeholder
 */
async function getCategoryImage(req, res) {
  try {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).send('Invalid Category ID');
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('id', sql.Int, categoryId);

    const result = await request.query(`
      SELECT ServiceCategoryCode, ImageData, ImageContentType
      FROM dbo.ServiceCategoryMaster
      WHERE ServiceCategoryId = @id
    `);

    if (!result.recordset || result.recordset.length === 0) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(CATEGORY_SVGS.DEFAULT);
    }

    const row = result.recordset[0];

    if (!row.ImageData || row.ImageData.length === 0) {
      const svg = CATEGORY_SVGS[row.ServiceCategoryCode] || CATEGORY_SVGS.DEFAULT;
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }

    const contentType = row.ImageContentType || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(row.ImageData);
  } catch (err) {
    console.error('[getCategoryImage Error]', err);
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(CATEGORY_SVGS.DEFAULT);
  }
}

/**
 * 3. POST /api/service-categories
 * Create new service category
 */
async function createServiceCategory(req, res) {
  try {
    const {
      serviceCategoryCode,
      categoryName,
      description,
      displayOrder = 1,
      isActive = true,
    } = req.body || {};

    if (!serviceCategoryCode || !serviceCategoryCode.trim()) {
      return res.status(400).json({ success: false, message: 'Category Code is required.' });
    }
    if (!categoryName || !categoryName.trim()) {
      return res.status(400).json({ success: false, message: 'Category Name is required.' });
    }

    const pool = await getPool();

    // Check duplicate code
    const dupCheck = pool.request();
    dupCheck.input('code', sql.NVarChar(50), serviceCategoryCode.trim().toUpperCase());
    const dupRes = await dupCheck.query(`
      SELECT ServiceCategoryId FROM dbo.ServiceCategoryMaster WHERE UPPER(ServiceCategoryCode) = @code
    `);
    if (dupRes.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Service Category Code "${serviceCategoryCode}" already exists.`,
      });
    }

    const insertReq = pool.request();
    insertReq.input('code', sql.NVarChar(50), serviceCategoryCode.trim().toUpperCase());
    insertReq.input('name', sql.NVarChar(150), categoryName.trim());
    insertReq.input('desc', sql.NVarChar(500), description ? description.trim() : null);
    insertReq.input('order', sql.Int, parseInt(displayOrder || '1', 10));
    insertReq.input('active', sql.Bit, isActive ? 1 : 0);

    const result = await insertReq.query(`
      INSERT INTO dbo.ServiceCategoryMaster (
        ServiceCategoryCode,
        CategoryName,
        Description,
        DisplayOrder,
        IsActive,
        CreatedDate
      )
      OUTPUT INSERTED.ServiceCategoryId, INSERTED.ServiceCategoryCode, INSERTED.CategoryName, INSERTED.Description, INSERTED.DisplayOrder, INSERTED.IsActive, INSERTED.CreatedDate
      VALUES (
        @code,
        @name,
        @desc,
        @order,
        @active,
        GETDATE()
      );
    `);

    return res.status(201).json({
      success: true,
      message: `Category "${categoryName}" created successfully.`,
      data: result.recordset[0],
    });
  } catch (err) {
    console.error('[createServiceCategory Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create service category.',
      error: err.message,
    });
  }
}

/**
 * 4. PUT /api/service-categories/:id
 * Update existing service category
 */
async function updateServiceCategory(req, res) {
  try {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, message: 'Invalid Category ID.' });
    }

    const {
      serviceCategoryCode,
      categoryName,
      description,
      displayOrder,
      isActive,
    } = req.body || {};

    const pool = await getPool();
    const reqDb = pool.request();
    reqDb.input('id', sql.Int, categoryId);

    const updates = [];

    if (serviceCategoryCode !== undefined && serviceCategoryCode.trim()) {
      reqDb.input('code', sql.NVarChar(50), serviceCategoryCode.trim().toUpperCase());
      updates.push(`ServiceCategoryCode = @code`);
    }
    if (categoryName !== undefined && categoryName.trim()) {
      reqDb.input('name', sql.NVarChar(150), categoryName.trim());
      updates.push(`CategoryName = @name`);
    }
    if (description !== undefined) {
      reqDb.input('desc', sql.NVarChar(500), description ? description.trim() : null);
      updates.push(`Description = @desc`);
    }
    if (displayOrder !== undefined) {
      reqDb.input('order', sql.Int, parseInt(displayOrder, 10));
      updates.push(`DisplayOrder = @order`);
    }
    if (isActive !== undefined) {
      reqDb.input('active', sql.Bit, isActive ? 1 : 0);
      updates.push(`IsActive = @active`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided for update.' });
    }

    const query = `
      UPDATE dbo.ServiceCategoryMaster
      SET ${updates.join(', ')}
      OUTPUT INSERTED.ServiceCategoryId, INSERTED.ServiceCategoryCode, INSERTED.CategoryName, INSERTED.Description, INSERTED.DisplayOrder, INSERTED.IsActive
      WHERE ServiceCategoryId = @id;
    `;

    const result = await reqDb.query(query);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: `Category ${categoryId} not found.` });
    }

    return res.status(200).json({
      success: true,
      message: 'Service category updated successfully.',
      data: result.recordset[0],
    });
  } catch (err) {
    console.error('[updateServiceCategory Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update service category.',
      error: err.message,
    });
  }
}

/**
 * 5. DELETE /api/service-categories/:id
 * Soft delete or deactivate category
 */
async function deleteServiceCategory(req, res) {
  try {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, message: 'Invalid Category ID.' });
    }

    const pool = await getPool();

    // Check if category has associated packages or orders
    const pkgCheck = await pool.request()
      .input('id', sql.Int, categoryId)
      .query(`SELECT TOP 1 PackageId FROM dbo.ServicePackageMaster WHERE ServiceCategoryId = @id`);

    if (pkgCheck.recordset.length > 0) {
      await pool.request()
        .input('id', sql.Int, categoryId)
        .query(`UPDATE dbo.ServiceCategoryMaster SET IsActive = 0 WHERE ServiceCategoryId = @id`);

      return res.status(200).json({
        success: true,
        message: 'Category has associated packages, deactivated successfully.',
      });
    }

    await pool.request()
      .input('id', sql.Int, categoryId)
      .query(`DELETE FROM dbo.ServiceCategoryMaster WHERE ServiceCategoryId = @id`);

    return res.status(200).json({
      success: true,
      message: 'Service category deleted successfully from database.',
    });
  } catch (err) {
    console.error('[deleteServiceCategory Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete service category.',
      error: err.message,
    });
  }
}

module.exports = {
  getServiceCategories,
  getCategoryImage,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
};
