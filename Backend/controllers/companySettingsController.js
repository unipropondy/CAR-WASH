const { getPool, sql } = require('../config/db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

/**
 * GET /api/settings/company or /api/company-settings
 * Retrieve company settings from dbo.CompanySettings
 */
async function getCompanySettings(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 1
        Id,
        CompanyName,
        Address,
        GSTNo,
        ISNULL(GSTPercentage, 0) AS GSTPercentage,
        Phone,
        Email,
        ReportEmail,
        CashierName,
        ISNULL(Currency, 'SGD') AS Currency,
        ISNULL(CurrencySymbol, '$') AS CurrencySymbol,
        CompanyLogoUrl,
        HalalLogoUrl,
        ShowCompanyLogo,
        ShowHalalLogo,
        PrinterIP,
        TaxMode,
        UpdatedOn
      FROM dbo.CompanySettings
    `);

    if (result.recordset.length === 0) {
      // If table is completely empty, insert a baseline row
      await pool.request().query(`
        INSERT INTO dbo.CompanySettings (
          Id, CompanyName, Address, GSTNo, GSTPercentage, Currency, CurrencySymbol, UpdatedOn
        ) VALUES (
          '1', 'RED BAY CAR WASH', '48 Toh Guan Rd East, Singapore 608586', 'M90382711', 9.00, 'SGD', '$', GETDATE()
        );
      `);
      const newRow = await pool.request().query(`SELECT TOP 1 * FROM dbo.CompanySettings`);
      return res.json({ success: true, settings: newRow.recordset[0] });
    }

    res.json({
      success: true,
      settings: result.recordset[0],
    });
  } catch (err) {
    console.error('[CompanySettings] getCompanySettings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PUT /api/settings/company or POST /api/settings/company
 * Update company settings in dbo.CompanySettings
 */
async function updateCompanySettings(req, res) {
  try {
    const {
      companyName,
      address,
      gstNo,
      gstPercentage,
      phone,
      email,
      reportEmail,
      ReportEmail,
      currency,
      currencySymbol,
      taxMode,
    } = req.body;

    const finalReportEmail = reportEmail !== undefined ? reportEmail : ReportEmail;

    const pool = await getPool();

    // Check if a row exists
    const check = await pool.request().query(`SELECT TOP 1 Id FROM dbo.CompanySettings`);
    
    if (check.recordset.length === 0) {
      await pool.request()
        .input('companyName', sql.NVarChar(255), companyName || 'RED BAY CAR WASH')
        .input('address', sql.NVarChar(sql.MAX), address || '')
        .input('gstNo', sql.NVarChar(50), gstNo || '')
        .input('gstPercentage', sql.Decimal(10, 2), parseFloat(gstPercentage || 0))
        .input('phone', sql.NVarChar(50), phone || '')
        .input('email', sql.NVarChar(255), email || '')
        .input('reportEmail', sql.NVarChar(255), finalReportEmail || '')
        .input('currency', sql.NVarChar(10), currency || 'SGD')
        .input('currencySymbol', sql.NVarChar(10), currencySymbol || '$')
        .input('taxMode', sql.NVarChar(20), taxMode || 'exclusive')
        .query(`
          INSERT INTO dbo.CompanySettings (
            Id, CompanyName, Address, GSTNo, GSTPercentage, Phone, Email, ReportEmail, Currency, CurrencySymbol, TaxMode, UpdatedOn
          ) VALUES (
            '1', @companyName, @address, @gstNo, @gstPercentage, @phone, @email, @reportEmail, @currency, @currencySymbol, @taxMode, GETDATE()
          );
        `);
    } else {
      const existingId = check.recordset[0].Id;
      await pool.request()
        .input('id', sql.NVarChar(128), existingId)
        .input('companyName', sql.NVarChar(255), companyName !== undefined ? companyName : null)
        .input('address', sql.NVarChar(sql.MAX), address !== undefined ? address : null)
        .input('gstNo', sql.NVarChar(50), gstNo !== undefined ? gstNo : null)
        .input('gstPercentage', sql.Decimal(10, 2), gstPercentage !== undefined ? parseFloat(gstPercentage || 0) : null)
        .input('phone', sql.NVarChar(50), phone !== undefined ? phone : null)
        .input('email', sql.NVarChar(255), email !== undefined ? email : null)
        .input('reportEmail', sql.NVarChar(255), finalReportEmail !== undefined ? finalReportEmail : null)
        .input('currency', sql.NVarChar(10), currency !== undefined ? currency : null)
        .input('currencySymbol', sql.NVarChar(10), currencySymbol !== undefined ? currencySymbol : null)
        .input('taxMode', sql.NVarChar(20), taxMode !== undefined ? taxMode : null)
        .query(`
          UPDATE dbo.CompanySettings
          SET
            CompanyName = COALESCE(@companyName, CompanyName),
            Address = COALESCE(@address, Address),
            GSTNo = COALESCE(@gstNo, GSTNo),
            GSTPercentage = COALESCE(@gstPercentage, GSTPercentage),
            Phone = COALESCE(@phone, Phone),
            Email = COALESCE(@email, Email),
            ReportEmail = COALESCE(@reportEmail, ReportEmail),
            Currency = COALESCE(@currency, Currency),
            CurrencySymbol = COALESCE(@currencySymbol, CurrencySymbol),
            TaxMode = COALESCE(@taxMode, TaxMode),
            UpdatedOn = GETDATE()
          WHERE Id = @id;
        `);
    }

    const updated = await pool.request().query(`
      SELECT TOP 1
        Id,
        CompanyName,
        Address,
        GSTNo,
        ISNULL(GSTPercentage, 0) AS GSTPercentage,
        Phone,
        Email,
        ReportEmail,
        CashierName,
        ISNULL(Currency, 'SGD') AS Currency,
        ISNULL(CurrencySymbol, '$') AS CurrencySymbol,
        CompanyLogoUrl,
        HalalLogoUrl,
        PrinterIP,
        TaxMode,
        UpdatedOn
      FROM dbo.CompanySettings
    `);

    res.json({
      success: true,
      message: 'Company settings updated successfully',
      settings: updated.recordset[0],
    });
  } catch (err) {
    console.error('[CompanySettings] updateCompanySettings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

const LOGO_UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'logos');
if (!fs.existsSync(LOGO_UPLOADS_DIR)) {
  fs.mkdirSync(LOGO_UPLOADS_DIR, { recursive: true });
}

const logoStorage = multer.memoryStorage();
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid image format. Allowed: JPG, JPEG, PNG, WEBP.'), false);
  },
});

/**
 * GET /api/company-settings/logo
 * Stream the company logo from SQL Server LogoData
 */
async function getCompanyLogo(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT TOP 1 LogoData, LogoMimeType FROM dbo.CompanySettings WHERE LogoData IS NOT NULL`
    );
    const row = result.recordset && result.recordset[0];
    if (!row || !row.LogoData) {
      // Serve built-in fallback logo from disk
      const fallbackPath = path.join(__dirname, '..', '..', 'Frontend', 'assets', 'images', 'red_bay_logo.png');
      if (fs.existsSync(fallbackPath)) {
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send(fs.readFileSync(fallbackPath));
      }
      return res.status(404).json({ success: false, message: 'No company logo found.' });
    }
    res.set('Content-Type', row.LogoMimeType || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(row.LogoData);
  } catch (err) {
    console.error('[getCompanyLogo Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to serve company logo.' });
  }
}

/**
 * GET /api/company-settings/banner
 * Stream the company banner from SQL Server BannerData
 */
async function getCompanyBanner(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT TOP 1 BannerData, BannerMimeType FROM dbo.CompanySettings WHERE BannerData IS NOT NULL`
    );
    const row = result.recordset && result.recordset[0];
    if (!row || !row.BannerData) {
      const fallbackPath = path.join(__dirname, '..', '..', 'Frontend', 'assets', 'images', 'red_bay_banner.jpg');
      if (fs.existsSync(fallbackPath)) {
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send(fs.readFileSync(fallbackPath));
      }
      return res.status(404).json({ success: false, message: 'No company banner found.' });
    }
    res.set('Content-Type', row.BannerMimeType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(row.BannerData);
  } catch (err) {
    console.error('[getCompanyBanner Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to serve company banner.' });
  }
}

/**
 * POST /api/company-settings/logo
 * Upload a new company logo (multipart or base64)
 */
async function uploadCompanyLogo(req, res) {
  const multerMiddleware = logoUpload.single('logo');
  multerMiddleware(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    try {
      let imageBuffer = null;
      let mimeType = 'image/png';
      if (req.file) {
        imageBuffer = req.file.buffer;
        mimeType = req.file.mimetype || 'image/png';
      } else if (req.body && req.body.image) {
        const img = req.body.image;
        if (img.startsWith('data:')) {
          const match = img.match(/^data:([^;]+);base64,(.+)$/);
          if (match) { mimeType = match[1]; imageBuffer = Buffer.from(match[2], 'base64'); }
        } else {
          imageBuffer = Buffer.from(img, 'base64');
        }
      }
      if (!imageBuffer || imageBuffer.length === 0) {
        return res.status(400).json({ success: false, message: 'No image data provided.' });
      }
      const pool = await getPool();
      await pool.request()
        .input('logoData', sql.VarBinary(sql.MAX), imageBuffer)
        .input('logoMime', sql.NVarChar(100), mimeType)
        .query(`UPDATE dbo.CompanySettings SET LogoData = @logoData, LogoMimeType = @logoMime, UpdatedOn = GETDATE() WHERE Id = '1'`);
      return res.json({ success: true, message: 'Company logo updated successfully.' });
    } catch (e) {
      console.error('[uploadCompanyLogo Error]', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  });
}

/**
 * POST /api/company-settings/banner
 * Upload a new company banner
 */
async function uploadCompanyBanner(req, res) {
  const multerMiddleware = logoUpload.single('banner');
  multerMiddleware(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    try {
      let imageBuffer = null;
      let mimeType = 'image/jpeg';
      if (req.file) {
        imageBuffer = req.file.buffer;
        mimeType = req.file.mimetype || 'image/jpeg';
      } else if (req.body && req.body.image) {
        const img = req.body.image;
        if (img.startsWith('data:')) {
          const match = img.match(/^data:([^;]+);base64,(.+)$/);
          if (match) { mimeType = match[1]; imageBuffer = Buffer.from(match[2], 'base64'); }
        } else {
          imageBuffer = Buffer.from(img, 'base64');
        }
      }
      if (!imageBuffer || imageBuffer.length === 0) {
        return res.status(400).json({ success: false, message: 'No image data provided.' });
      }
      const pool = await getPool();
      await pool.request()
        .input('bannerData', sql.VarBinary(sql.MAX), imageBuffer)
        .input('bannerMime', sql.NVarChar(100), mimeType)
        .query(`UPDATE dbo.CompanySettings SET BannerData = @bannerData, BannerMimeType = @bannerMime, UpdatedOn = GETDATE() WHERE Id = '1'`);
      return res.json({ success: true, message: 'Company banner updated successfully.' });
    } catch (e) {
      console.error('[uploadCompanyBanner Error]', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  });
}

module.exports = {
  getCompanySettings,
  updateCompanySettings,
  getCompanyLogo,
  getCompanyBanner,
  uploadCompanyLogo,
  uploadCompanyBanner,
};

