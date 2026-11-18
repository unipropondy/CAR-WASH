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

let iconColumnsChecked = false;
async function ensureIconColumns(pool) {
  if (iconColumnsChecked) return;
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ServiceCategoryMaster') AND name = 'IconData')
      BEGIN
        ALTER TABLE dbo.ServiceCategoryMaster ADD IconData VARBINARY(MAX) NULL, IconContentType NVARCHAR(200) NULL;
      END
    `);
    iconColumnsChecked = true;
  } catch (err) {
    console.warn('[ensureIconColumns warning]', err.message);
  }
}

// In-memory cache for ultra-fast kiosk response
let categoryCache = {
  data: null,
  timestamp: 0,
};

function invalidateCategoryCache() {
  categoryCache.data = null;
  categoryCache.timestamp = 0;
}

/**
 * 1. GET /api/service-categories or /api/categories
 * Retrieve categories from ServiceCategoryMaster
 * Query params: ?all=true, ?search=...
 */
async function getServiceCategories(req, res) {
  try {
    const { all, search } = req.query || {};
    const includeAll = all === 'true' || all === '1';

    // Serve from cache if active kiosk query
    if (!includeAll && !search && categoryCache.data && (Date.now() - categoryCache.timestamp < 120000)) {
      return res.status(200).json(categoryCache.data);
    }

    const pool = await getPool();
    await ensureIconColumns(pool);
    const request = pool.request();

    // Fast query: NEVER fetch raw ImageData and IconData VARBINARY blobs in list queries.
    let query = `
      SELECT 
        ServiceCategoryId,
        ServiceCategoryCode,
        CategoryName,
        Description,
        CASE WHEN ImageData IS NOT NULL AND DATALENGTH(ImageData) > 0 THEN 1 ELSE 0 END AS HasImage,
        ImageContentType,
        CASE WHEN IconData IS NOT NULL AND DATALENGTH(IconData) > 0 THEN 1 ELSE 0 END AS HasIcon,
        IconContentType,
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

    const categories = result.recordset.map((row) => {
      const hasImage = Boolean(row.HasImage);
      const hasIcon = Boolean(row.HasIcon);
      const version = row.CreatedDate ? new Date(row.CreatedDate).getTime() : 1;

      const imageUrl = `/api/service-categories/${row.ServiceCategoryId}/image?v=${version}`;
      const iconUrl = `/api/service-categories/${row.ServiceCategoryId}/icon?v=${version}`;

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
        iconContentType: row.IconContentType,
        iconUrl,
        hasIcon,
      };
    });

    const responsePayload = {
      success: true,
      count: categories.length,
      data: categories,
    };

    if (!includeAll && !search) {
      categoryCache.data = responsePayload;
      categoryCache.timestamp = Date.now();
    }

    return res.status(200).json(responsePayload);
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
 * 2b. GET /api/service-categories/:id/icon
 * Stream raw binary IconData or tailored SVG placeholder
 */
async function getCategoryIcon(req, res) {
  try {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).send('Invalid Category ID');
    }

    const pool = await getPool();
    await ensureIconColumns(pool);
    const request = pool.request();
    request.input('id', sql.Int, categoryId);

    const result = await request.query(`
      SELECT ServiceCategoryCode, IconData, IconContentType
      FROM dbo.ServiceCategoryMaster
      WHERE ServiceCategoryId = @id
    `);

    if (!result.recordset || result.recordset.length === 0) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(CATEGORY_SVGS.DEFAULT);
    }

    const row = result.recordset[0];

    if (!row.IconData || row.IconData.length === 0) {
      const svg = CATEGORY_SVGS[row.ServiceCategoryCode] || CATEGORY_SVGS.DEFAULT;
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }

    const contentType = row.IconContentType || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(row.IconData);
  } catch (err) {
    console.error('[getCategoryIcon Error]', err);
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
      imageData,
      iconData,
    } = req.body || {};

    if (!serviceCategoryCode || !serviceCategoryCode.trim()) {
      return res.status(400).json({ success: false, message: 'Category Code is required.' });
    }
    if (!categoryName || !categoryName.trim()) {
      return res.status(400).json({ success: false, message: 'Category Name is required.' });
    }

    const pool = await getPool();
    await ensureIconColumns(pool);

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

    let imgBuffer = null;
    let imgContentType = null;
    if (imageData && typeof imageData === 'string') {
      if (imageData.startsWith('data:')) {
        const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          imgContentType = match[1];
          imgBuffer = Buffer.from(match[2], 'base64');
        }
      } else {
        imgContentType = 'image/png';
        imgBuffer = Buffer.from(imageData, 'base64');
      }
    }

    let iconBuffer = null;
    let iconContentType = null;
    if (iconData && typeof iconData === 'string') {
      if (iconData.startsWith('data:')) {
        const match = iconData.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          iconContentType = match[1];
          iconBuffer = Buffer.from(match[2], 'base64');
        }
      } else {
        iconContentType = 'image/png';
        iconBuffer = Buffer.from(iconData, 'base64');
      }
    }

    const insertReq = pool.request();
    insertReq.input('code', sql.NVarChar(50), serviceCategoryCode.trim().toUpperCase());
    insertReq.input('name', sql.NVarChar(150), categoryName.trim());
    insertReq.input('desc', sql.NVarChar(500), description ? description.trim() : null);
    insertReq.input('order', sql.Int, parseInt(displayOrder || '1', 10));
    insertReq.input('active', sql.Bit, isActive ? 1 : 0);
    insertReq.input('imgData', sql.VarBinary(sql.MAX), imgBuffer);
    insertReq.input('imgContentType', sql.NVarChar(100), imgContentType);
    insertReq.input('iconData', sql.VarBinary(sql.MAX), iconBuffer);
    insertReq.input('iconContentType', sql.NVarChar(100), iconContentType);

    const result = await insertReq.query(`
      INSERT INTO dbo.ServiceCategoryMaster (
        ServiceCategoryCode,
        CategoryName,
        Description,
        DisplayOrder,
        IsActive,
        ImageData,
        ImageContentType,
        IconData,
        IconContentType,
        CreatedDate
      )
      OUTPUT INSERTED.ServiceCategoryId, INSERTED.ServiceCategoryCode, INSERTED.CategoryName, INSERTED.Description, INSERTED.DisplayOrder, INSERTED.IsActive, INSERTED.CreatedDate
      VALUES (
        @code,
        @name,
        @desc,
        @order,
        @active,
        @imgData,
        @imgContentType,
        @iconData,
        @iconContentType,
        GETDATE()
      );
    `);

    invalidateCategoryCache();
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
      imageData,
      iconData,
    } = req.body || {};

    const pool = await getPool();
    await ensureIconColumns(pool);
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
    if (imageData !== undefined) {
      if (imageData && typeof imageData === 'string') {
        let imgBuffer = null;
        let imgContentType = null;
        if (imageData.startsWith('data:')) {
          const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            imgContentType = match[1];
            imgBuffer = Buffer.from(match[2], 'base64');
          }
        } else {
          imgContentType = 'image/png';
          imgBuffer = Buffer.from(imageData, 'base64');
        }
        reqDb.input('imgData', sql.VarBinary(sql.MAX), imgBuffer);
        reqDb.input('imgContentType', sql.NVarChar(100), imgContentType);
        updates.push(`ImageData = @imgData, ImageContentType = @imgContentType`);
      } else if (imageData === null || imageData === '') {
        updates.push(`ImageData = NULL, ImageContentType = NULL`);
      }
    }
    if (iconData !== undefined) {
      if (iconData && typeof iconData === 'string') {
        let iconBuffer = null;
        let iconContentType = null;
        if (iconData.startsWith('data:')) {
          const match = iconData.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            iconContentType = match[1];
            iconBuffer = Buffer.from(match[2], 'base64');
          }
        } else {
          iconContentType = 'image/png';
          iconBuffer = Buffer.from(iconData, 'base64');
        }
        reqDb.input('iconData', sql.VarBinary(sql.MAX), iconBuffer);
        reqDb.input('iconContentType', sql.NVarChar(100), iconContentType);
        updates.push(`IconData = @iconData, IconContentType = @iconContentType`);
      } else if (iconData === null || iconData === '') {
        updates.push(`IconData = NULL, IconContentType = NULL`);
      }
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

    invalidateCategoryCache();
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

      invalidateCategoryCache();
      return res.status(200).json({
        success: true,
        message: 'Category has associated packages, deactivated successfully.',
      });
    }

    await pool.request()
      .input('id', sql.Int, categoryId)
      .query(`DELETE FROM dbo.ServiceCategoryMaster WHERE ServiceCategoryId = @id`);

    invalidateCategoryCache();
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
  getCategoryIcon,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
};
