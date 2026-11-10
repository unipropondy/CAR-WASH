const { getPool, sql } = require('../config/db');

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
      currency,
      currencySymbol,
      taxMode,
    } = req.body;

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
        .input('currency', sql.NVarChar(10), currency || 'SGD')
        .input('currencySymbol', sql.NVarChar(10), currencySymbol || '$')
        .input('taxMode', sql.NVarChar(20), taxMode || 'exclusive')
        .query(`
          INSERT INTO dbo.CompanySettings (
            Id, CompanyName, Address, GSTNo, GSTPercentage, Phone, Email, Currency, CurrencySymbol, TaxMode, UpdatedOn
          ) VALUES (
            '1', @companyName, @address, @gstNo, @gstPercentage, @phone, @email, @currency, @currencySymbol, @taxMode, GETDATE()
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

module.exports = {
  getCompanySettings,
  updateCompanySettings,
};

