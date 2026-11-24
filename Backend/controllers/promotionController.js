const path = require('path');
const fs = require('fs');
const { sql, getPool } = require('../config/db');

// Ensure uploads folder exists
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'promotions');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Handle promotional image upload (Multipart or Base64)
 * POST /api/promotions/upload
 */
async function uploadPromotionImage(req, res) {
  try {
    // 1. Check if uploaded via multer (multipart/form-data)
    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        // Remove invalid file
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: 'Invalid file format. Allowed formats: JPG, JPEG, PNG, WEBP.',
        });
      }

      const relativePath = `/uploads/promotions/${req.file.filename}`;
      return res.status(200).json({
        success: true,
        message: 'Image uploaded successfully.',
        imagePath: relativePath,
        fileName: req.file.filename,
      });
    }

    // 2. Check if uploaded via Base64 JSON payload: { image, fileName }
    const { image, fileName } = req.body || {};
    if (!image || typeof image !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'No image provided. Please upload an image file or provide a base64 image string.',
      });
    }

    let mimeType = 'image/png';
    let rawBase64 = image;
    let ext = '.png';

    if (image.startsWith('data:')) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1].toLowerCase();
        rawBase64 = match[2];
        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') ext = '.jpg';
        else if (mimeType === 'image/png') ext = '.png';
        else if (mimeType === 'image/webp') ext = '.webp';
        else {
          return res.status(400).json({
            success: false,
            message: `Unsupported image format: ${mimeType}. Allowed formats: JPG, JPEG, PNG, WEBP.`,
          });
        }
      }
    } else if (fileName) {
      const fExt = path.extname(fileName).toLowerCase();
      if (ALLOWED_EXTS.includes(fExt)) {
        ext = fExt;
      }
    }

    const buffer = Buffer.from(rawBase64, 'base64');
    if (buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or empty image data.',
      });
    }

    const uniqueName = `promo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    const targetFilePath = path.join(UPLOADS_DIR, uniqueName);

    fs.writeFileSync(targetFilePath, buffer);

    const relativePath = `/uploads/promotions/${uniqueName}`;
    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully.',
      imagePath: relativePath,
      fileName: uniqueName,
    });
  } catch (err) {
    console.error('[uploadPromotionImage Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload promotional image.',
      error: err.message,
    });
  }
}

/**
 * Format promotion record for client consumption
 */
function formatPromotionRow(row) {
  if (!row) return null;
  const formatDateOnly = (d) => {
    if (!d) return null;
    if (typeof d === 'string') return d.split('T')[0];
    if (d instanceof Date) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return String(d);
  };

  return {
    promotionId: row.PromotionId,
    promotionName: row.PromotionName,
    description: row.Description || '',
    imagePath: row.ImagePath,
    startDate: formatDateOnly(row.StartDate),
    endDate: formatDateOnly(row.EndDate),
    displayOrder: row.DisplayOrder,
    isActive: Boolean(row.IsActive),
    createdDate: row.CreatedDate,
    updatedDate: row.UpdatedDate,
  };
}

/**
 * GET /api/promotions
 * Retrieve all promotions (for Backoffice) or filtered
 */
async function getAllPromotions(req, res) {
  try {
    const { search, activeOnly } = req.query || {};
    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT 
        PromotionId,
        PromotionName,
        Description,
        ImagePath,
        CONVERT(varchar(10), StartDate, 120) AS StartDate,
        CONVERT(varchar(10), EndDate, 120) AS EndDate,
        DisplayOrder,
        IsActive,
        CreatedDate,
        UpdatedDate
      FROM dbo.KioskPromotionMaster
      WHERE 1=1
    `;

    if (activeOnly === 'true' || activeOnly === '1') {
      query += ` AND IsActive = 1`;
    }

    if (search && search.trim()) {
      request.input('search', sql.NVarChar(100), `%${search.trim()}%`);
      query += ` AND (PromotionName LIKE @search OR Description LIKE @search)`;
    }

    query += ` ORDER BY DisplayOrder ASC, PromotionId DESC;`;

    const result = await request.query(query);
    const promotions = (result.recordset || []).map(formatPromotionRow);

    return res.status(200).json({
      success: true,
      count: promotions.length,
      data: promotions,
    });
  } catch (err) {
    console.error('[getAllPromotions Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve promotions.',
      error: err.message,
    });
  }
}

/**
 * GET /api/promotions/active
 * Retrieve currently active promotions based on current date for Kiosk Idle Slideshow
 * Only active promotions within StartDate and EndDate (inclusive), ordered by DisplayOrder.
 */
async function getActivePromotions(req, res) {
  try {
    const pool = await getPool();
    const query = `
      SELECT 
        PromotionId,
        PromotionName,
        Description,
        ImagePath,
        CONVERT(varchar(10), StartDate, 120) AS StartDate,
        CONVERT(varchar(10), EndDate, 120) AS EndDate,
        DisplayOrder,
        IsActive,
        CreatedDate,
        UpdatedDate
      FROM dbo.KioskPromotionMaster
      WHERE IsActive = 1
        AND StartDate <= CAST(GETDATE() AS DATE)
        AND EndDate >= CAST(GETDATE() AS DATE)
      ORDER BY DisplayOrder ASC, PromotionId ASC;
    `;

    const result = await pool.request().query(query);
    const promotions = (result.recordset || []).map(formatPromotionRow);

    return res.status(200).json({
      success: true,
      count: promotions.length,
      data: promotions,
    });
  } catch (err) {
    console.error('[getActivePromotions Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve active promotions.',
      error: err.message,
    });
  }
}

/**
 * GET /api/promotions/:id
 * Retrieve single promotion by ID
 */
async function getPromotionById(req, res) {
  try {
    const promotionId = parseInt(req.params.id, 10);
    if (isNaN(promotionId)) {
      return res.status(400).json({ success: false, message: 'Invalid Promotion ID.' });
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('id', sql.Int, promotionId);

    const result = await request.query(`
      SELECT 
        PromotionId,
        PromotionName,
        Description,
        ImagePath,
        CONVERT(varchar(10), StartDate, 120) AS StartDate,
        CONVERT(varchar(10), EndDate, 120) AS EndDate,
        DisplayOrder,
        IsActive,
        CreatedDate,
        UpdatedDate
      FROM dbo.KioskPromotionMaster
      WHERE PromotionId = @id;
    `);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Promotion not found.' });
    }

    return res.status(200).json({
      success: true,
      data: formatPromotionRow(result.recordset[0]),
    });
  } catch (err) {
    console.error('[getPromotionById Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve promotion.',
      error: err.message,
    });
  }
}

/**
 * POST /api/promotions
 * Insert a new promotion record
 */
async function createPromotion(req, res) {
  try {
    const {
      promotionName,
      description,
      imagePath,
      startDate,
      endDate,
      displayOrder,
      isActive,
    } = req.body || {};

    if (!promotionName || !promotionName.trim()) {
      return res.status(400).json({ success: false, message: 'Promotion Name is required.' });
    }

    if (!imagePath || !imagePath.trim()) {
      return res.status(400).json({ success: false, message: 'Promotional Poster Image is required.' });
    }

    if (!startDate) {
      return res.status(400).json({ success: false, message: 'Start Date is required.' });
    }

    if (!endDate) {
      return res.status(400).json({ success: false, message: 'End Date is required.' });
    }

    // Validate date chronology
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid Start Date or End Date format.' });
    }

    if (start > end) {
      return res.status(400).json({ success: false, message: 'Start Date cannot be after End Date.' });
    }

    const pool = await getPool();
    const request = pool.request();

    request.input('name', sql.NVarChar(150), promotionName.trim());
    request.input('desc', sql.NVarChar(500), description ? description.trim() : null);
    request.input('img', sql.NVarChar(500), imagePath.trim());
    request.input('start', sql.Date, startDate);
    request.input('end', sql.Date, endDate);
    request.input('order', sql.Int, parseInt(displayOrder || '1', 10));
    request.input('active', sql.Bit, isActive !== undefined ? (isActive ? 1 : 0) : 1);

    const result = await request.query(`
      INSERT INTO dbo.KioskPromotionMaster (
        PromotionName,
        Description,
        ImagePath,
        StartDate,
        EndDate,
        DisplayOrder,
        IsActive,
        CreatedDate
      )
      OUTPUT 
        INSERTED.PromotionId,
        INSERTED.PromotionName,
        INSERTED.Description,
        INSERTED.ImagePath,
        CONVERT(varchar(10), INSERTED.StartDate, 120) AS StartDate,
        CONVERT(varchar(10), INSERTED.EndDate, 120) AS EndDate,
        INSERTED.DisplayOrder,
        INSERTED.IsActive,
        INSERTED.CreatedDate,
        INSERTED.UpdatedDate
      VALUES (
        @name,
        @desc,
        @img,
        @start,
        @end,
        @order,
        @active,
        GETDATE()
      );
    `);

    const created = formatPromotionRow(result.recordset[0]);

    return res.status(201).json({
      success: true,
      message: `Promotion "${promotionName}" created successfully.`,
      data: created,
    });
  } catch (err) {
    console.error('[createPromotion Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create promotion in database.',
      error: err.message,
    });
  }
}

/**
 * PUT /api/promotions/:id
 * Update an existing promotion record
 */
async function updatePromotion(req, res) {
  try {
    const promotionId = parseInt(req.params.id, 10);
    if (isNaN(promotionId)) {
      return res.status(400).json({ success: false, message: 'Invalid Promotion ID.' });
    }

    const {
      promotionName,
      description,
      imagePath,
      startDate,
      endDate,
      displayOrder,
      isActive,
    } = req.body || {};

    const pool = await getPool();

    // Check if exists
    const checkReq = pool.request();
    checkReq.input('id', sql.Int, promotionId);
    const existing = await checkReq.query('SELECT PromotionId FROM dbo.KioskPromotionMaster WHERE PromotionId = @id');
    if (!existing.recordset || existing.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Promotion not found.' });
    }

    const updates = [];
    const updateReq = pool.request();
    updateReq.input('id', sql.Int, promotionId);

    if (promotionName !== undefined && promotionName.trim()) {
      updateReq.input('name', sql.NVarChar(150), promotionName.trim());
      updates.push('PromotionName = @name');
    }

    if (description !== undefined) {
      updateReq.input('desc', sql.NVarChar(500), description ? description.trim() : null);
      updates.push('Description = @desc');
    }

    if (imagePath !== undefined && imagePath.trim()) {
      updateReq.input('img', sql.NVarChar(500), imagePath.trim());
      updates.push('ImagePath = @img');
    }

    if (startDate !== undefined && startDate) {
      updateReq.input('start', sql.Date, startDate);
      updates.push('StartDate = @start');
    }

    if (endDate !== undefined && endDate) {
      updateReq.input('end', sql.Date, endDate);
      updates.push('EndDate = @end');
    }

    if (displayOrder !== undefined) {
      updateReq.input('order', sql.Int, parseInt(displayOrder, 10));
      updates.push('DisplayOrder = @order');
    }

    if (isActive !== undefined) {
      updateReq.input('active', sql.Bit, isActive ? 1 : 0);
      updates.push('IsActive = @active');
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided for update.' });
    }

    updates.push('UpdatedDate = GETDATE()');

    const result = await updateReq.query(`
      UPDATE dbo.KioskPromotionMaster
      SET ${updates.join(', ')}
      OUTPUT 
        INSERTED.PromotionId,
        INSERTED.PromotionName,
        INSERTED.Description,
        INSERTED.ImagePath,
        CONVERT(varchar(10), INSERTED.StartDate, 120) AS StartDate,
        CONVERT(varchar(10), INSERTED.EndDate, 120) AS EndDate,
        INSERTED.DisplayOrder,
        INSERTED.IsActive,
        INSERTED.CreatedDate,
        INSERTED.UpdatedDate
      WHERE PromotionId = @id;
    `);

    const updated = formatPromotionRow(result.recordset[0]);

    return res.status(200).json({
      success: true,
      message: 'Promotion updated successfully.',
      data: updated,
    });
  } catch (err) {
    console.error('[updatePromotion Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update promotion.',
      error: err.message,
    });
  }
}

/**
 * DELETE /api/promotions/:id
 * Delete a promotion record and clean up image file if exists
 */
async function deletePromotion(req, res) {
  try {
    const promotionId = parseInt(req.params.id, 10);
    if (isNaN(promotionId)) {
      return res.status(400).json({ success: false, message: 'Invalid Promotion ID.' });
    }

    const pool = await getPool();
    const reqDb = pool.request();
    reqDb.input('id', sql.Int, promotionId);

    // Retrieve row first to get ImagePath
    const fetchRes = await reqDb.query(`
      SELECT PromotionId, PromotionName, ImagePath 
      FROM dbo.KioskPromotionMaster 
      WHERE PromotionId = @id;
    `);

    if (!fetchRes.recordset || fetchRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Promotion not found.' });
    }

    const promo = fetchRes.recordset[0];

    // Delete record from SQL Server
    const delReq = pool.request();
    delReq.input('id', sql.Int, promotionId);
    await delReq.query('DELETE FROM dbo.KioskPromotionMaster WHERE PromotionId = @id;');

    // Try deleting image file from disk if local relative path
    if (promo.ImagePath && promo.ImagePath.startsWith('/uploads/promotions/')) {
      const fileName = path.basename(promo.ImagePath);
      const filePath = path.join(UPLOADS_DIR, fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.warn('[deletePromotion file cleanup warning]', unlinkErr.message);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Promotion "${promo.PromotionName}" deleted successfully.`,
    });
  } catch (err) {
    console.error('[deletePromotion Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete promotion.',
      error: err.message,
    });
  }
}

module.exports = {
  uploadPromotionImage,
  getAllPromotions,
  getActivePromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
