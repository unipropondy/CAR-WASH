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
 * GET /api/service-categories or /api/categories
 * Retrieve all active categories from ServiceCategoryMaster
 */
async function getServiceCategories(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        ServiceCategoryId,
        ServiceCategoryCode,
        CategoryName,
        Description,
        ImageData,
        ImageContentType,
        DisplayOrder,
        IsActive
      FROM ServiceCategoryMaster
      WHERE IsActive = 1
      ORDER BY DisplayOrder ASC, ServiceCategoryId ASC
    `);

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
        // Fallback endpoint URL
        imageUrl = `${baseUrl}/api/service-categories/${row.ServiceCategoryId}/image`;
      }

      return {
        serviceCategoryId: row.ServiceCategoryId,
        serviceCategoryCode: row.ServiceCategoryCode,
        categoryName: row.CategoryName,
        description: row.Description || '',
        displayOrder: row.DisplayOrder,
        isActive: row.IsActive,
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
 * GET /api/service-categories/:id/image
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
      FROM ServiceCategoryMaster
      WHERE ServiceCategoryId = @id AND IsActive = 1
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

module.exports = {
  getServiceCategories,
  getCategoryImage,
};

