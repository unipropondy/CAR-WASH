const { sql, getPool } = require('../config/db');
const fs = require('fs');
const path = require('path');

// Local fallback store path
const LOCAL_STORE_PATH = path.join(__dirname, '..', 'dealers_store.json');

// Initial seed dealers
const INITIAL_DEALERS = [
  {
    dealerId: 1,
    uniqueCode: 'DLR-A-01',
    dealerName: 'Dealer A',
    contactNumber: '9123 4567',
    contactPerson: 'David Tan',
    address: '10 Toh Guan Road, #01-02, Singapore 608838',
    securityPin: '1234',
    billingCycle: 'Monthly 30-Day Credit',
    logoUrl: '',
    isActive: true,
    createdDate: new Date().toISOString(),
  },
  {
    dealerId: 2,
    uniqueCode: 'DLR-B-02',
    dealerName: 'Dealer B',
    contactNumber: '9234 5678',
    contactPerson: 'Ken Wong',
    address: '25 Kaki Bukit Road 4, #01-14 Synergy @ KB, Singapore 417800',
    securityPin: '2345',
    billingCycle: 'Monthly 30-Day Credit',
    logoUrl: '',
    isActive: true,
    createdDate: new Date().toISOString(),
  },
  {
    dealerId: 3,
    uniqueCode: 'DLR-C-03',
    dealerName: 'Dealer C',
    contactNumber: '9345 6789',
    contactPerson: 'Rachel Koh',
    address: '1 Bukit Batok Crescent, #02-05 WCEGA Plaza, Singapore 658064',
    securityPin: '3456',
    billingCycle: 'Fortnightly Credit',
    logoUrl: '',
    isActive: true,
    createdDate: new Date().toISOString(),
  },
  {
    dealerId: 4,
    uniqueCode: 'DLR-D-04',
    dealerName: 'Dealer D',
    contactNumber: '9456 7890',
    contactPerson: 'Raymond Lim',
    address: '50 Ubi Ave 3, #01-08 Frontier, Singapore 408866',
    securityPin: '4567',
    billingCycle: 'Monthly 30-Day Credit',
    logoUrl: '',
    isActive: true,
    createdDate: new Date().toISOString(),
  },
  {
    dealerId: 5,
    uniqueCode: 'DLR-E-05',
    dealerName: 'Dealer E - Apex Automotive',
    contactNumber: '9567 8901',
    contactPerson: 'Simon Teo',
    address: '180 Woodlands Industrial Park E5, Singapore 757512',
    securityPin: '5678',
    billingCycle: 'Monthly 30-Day Credit',
    logoUrl: '',
    isActive: true,
    createdDate: new Date().toISOString(),
  },
  {
    dealerId: 6,
    uniqueCode: 'DLR-F-06',
    dealerName: 'Dealer F - Red Line Fleet',
    contactNumber: '9678 9012',
    contactPerson: 'Alex Chong',
    address: '8 Soon Lee Road, Jurong Industrial Estate, Singapore 628073',
    securityPin: '6789',
    billingCycle: 'Weekly Credit Term',
    logoUrl: '',
    isActive: true,
    createdDate: new Date().toISOString(),
  },
];

// Helper to load local fallback dealers
function loadLocalDealers() {
  try {
    if (fs.existsSync(LOCAL_STORE_PATH)) {
      const raw = fs.readFileSync(LOCAL_STORE_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[DealerController] Error reading local dealers file:', e.message);
  }
  return [...INITIAL_DEALERS];
}

// Helper to save local fallback dealers
function saveLocalDealers(dealers) {
  try {
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(dealers, null, 2), 'utf8');
  } catch (e) {
    console.warn('[DealerController] Error writing local dealers file:', e.message);
  }
}

let inMemoryDealers = loadLocalDealers();

// Ensure MSSQL table exists
async function ensureDealerTable(pool) {
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DealerMaster')
      BEGIN
        CREATE TABLE dbo.DealerMaster (
          DealerId INT IDENTITY(1,1) PRIMARY KEY,
          UniqueCode NVARCHAR(50) NOT NULL UNIQUE,
          DealerName NVARCHAR(150) NOT NULL,
          ContactNumber NVARCHAR(50),
          ContactPerson NVARCHAR(100),
          Address NVARCHAR(500),
          SecurityPin NVARCHAR(20) DEFAULT '1234',
          BillingCycle NVARCHAR(100) DEFAULT 'Monthly 30-Day Credit',
          LogoData NVARCHAR(MAX),
          LogoContentType NVARCHAR(50),
          IsActive BIT DEFAULT 1,
          CreatedDate DATETIME DEFAULT GETDATE(),
          UpdatedDate DATETIME DEFAULT GETDATE()
        );
      END
    `);
  } catch (e) {
    console.warn('[DealerController] ensureDealerTable notice:', e.message);
  }
}

/**
 * 1. GET /api/dealers
 */
async function getDealers(req, res) {
  try {
    const { all, search } = req.query || {};
    const includeAll = all === 'true' || all === '1';

    try {
      const pool = await getPool(1, 500);
      await ensureDealerTable(pool);

      let query = `
        SELECT 
          DealerId,
          UniqueCode,
          DealerName,
          ContactNumber,
          ContactPerson,
          Address,
          SecurityPin,
          BillingCycle,
          LogoData,
          LogoContentType,
          IsActive,
          CreatedDate
        FROM dbo.DealerMaster
      `;

      const conditions = [];
      const request = pool.request();

      if (!includeAll) {
        conditions.push(`IsActive = 1`);
      }
      if (search && search.trim()) {
        request.input('search', sql.NVarChar(100), `%${search.trim()}%`);
        conditions.push(`(UniqueCode LIKE @search OR DealerName LIKE @search OR ContactNumber LIKE @search OR Address LIKE @search)`);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      query += ` ORDER BY DealerId ASC;`;

      const result = await request.query(query);

      if (result.recordset && result.recordset.length > 0) {
        const dealers = result.recordset.map((r) => ({
          dealerId: r.DealerId,
          uniqueCode: r.UniqueCode,
          dealerName: r.DealerName,
          contactNumber: r.ContactNumber || '',
          contactPerson: r.ContactPerson || '',
          address: r.Address || '',
          securityPin: r.SecurityPin || '1234',
          billingCycle: r.BillingCycle || 'Monthly 30-Day Credit',
          logoUrl: r.LogoData || '',
          isActive: Boolean(r.IsActive),
          createdDate: r.CreatedDate,
        }));

        return res.json({ success: true, count: dealers.length, data: dealers });
      }
    } catch (dbErr) {
      // Fallback to local storage
      console.warn('[DealerController] MSSQL offline, using fallback store:', dbErr.message);
    }

    // Local filter
    let list = inMemoryDealers;
    if (!includeAll) {
      list = list.filter((d) => d.isActive);
    }
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.uniqueCode.toLowerCase().includes(term) ||
          d.dealerName.toLowerCase().includes(term) ||
          (d.contactNumber && d.contactNumber.toLowerCase().includes(term)) ||
          (d.address && d.address.toLowerCase().includes(term))
      );
    }

    return res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    console.error('[DealerController.getDealers Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve dealers', error: err.message });
  }
}

/**
 * 2. GET /api/dealers/:id
 */
async function getDealerById(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const code = String(req.params.id);

    try {
      const pool = await getPool(1, 500);
      const request = pool.request();
      request.input('id', sql.Int, isNaN(id) ? -1 : id);
      request.input('code', sql.NVarChar(50), code);

      const result = await request.query(`
        SELECT * FROM dbo.DealerMaster WHERE DealerId = @id OR UniqueCode = @code
      `);

      if (result.recordset.length > 0) {
        const r = result.recordset[0];
        return res.json({
          success: true,
          data: {
            dealerId: r.DealerId,
            uniqueCode: r.UniqueCode,
            dealerName: r.DealerName,
            contactNumber: r.ContactNumber,
            contactPerson: r.ContactPerson,
            address: r.Address,
            securityPin: r.SecurityPin,
            billingCycle: r.BillingCycle,
            logoUrl: r.LogoData || '',
            isActive: Boolean(r.IsActive),
            createdDate: r.CreatedDate,
          },
        });
      }
    } catch (e) {
      // fallback
    }

    const found = inMemoryDealers.find(
      (d) => d.dealerId === id || d.uniqueCode.toLowerCase() === code.toLowerCase()
    );
    if (!found) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }
    return res.json({ success: true, data: found });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 3. POST /api/dealers
 */
async function createDealer(req, res) {
  try {
    const {
      uniqueCode,
      dealerName,
      contactNumber,
      contactPerson,
      address,
      securityPin = '1234',
      billingCycle = 'Monthly 30-Day Credit',
      logoUrl = '',
      isActive = true,
    } = req.body;

    if (!uniqueCode || !uniqueCode.trim()) {
      return res.status(400).json({ success: false, message: 'Unique Dealer Code/ID is required' });
    }
    if (!dealerName || !dealerName.trim()) {
      return res.status(400).json({ success: false, message: 'Dealer Name is required' });
    }

    const cleanCode = uniqueCode.trim().toUpperCase();
    const cleanName = dealerName.trim();

    // Check duplicate in memory first
    if (inMemoryDealers.some((d) => d.uniqueCode.toUpperCase() === cleanCode)) {
      return res.status(409).json({ success: false, message: `Dealer with Unique ID "${cleanCode}" already exists.` });
    }

    let createdId = Date.now();

    try {
      const pool = await getPool(1, 500);
      await ensureDealerTable(pool);

      const check = await pool.request()
        .input('code', sql.NVarChar(50), cleanCode)
        .query(`SELECT DealerId FROM dbo.DealerMaster WHERE UniqueCode = @code`);
      
      if (check.recordset.length > 0) {
        return res.status(409).json({ success: false, message: `Dealer with Unique ID "${cleanCode}" already exists in database.` });
      }

      const insertRes = await pool.request()
        .input('code', sql.NVarChar(50), cleanCode)
        .input('name', sql.NVarChar(150), cleanName)
        .input('phone', sql.NVarChar(50), contactNumber || '')
        .input('contactPerson', sql.NVarChar(100), contactPerson || '')
        .input('address', sql.NVarChar(500), address || '')
        .input('pin', sql.NVarChar(20), securityPin || '1234')
        .input('billingCycle', sql.NVarChar(100), billingCycle)
        .input('logo', sql.NVarChar(sql.MAX), logoUrl || '')
        .input('active', sql.Bit, isActive ? 1 : 0)
        .query(`
          INSERT INTO dbo.DealerMaster (
            UniqueCode, DealerName, ContactNumber, ContactPerson, Address, SecurityPin, BillingCycle, LogoData, IsActive, CreatedDate, UpdatedDate
          ) OUTPUT INSERTED.DealerId
          VALUES (
            @code, @name, @phone, @contactPerson, @address, @pin, @billingCycle, @logo, @active, GETDATE(), GETDATE()
          );
        `);

      if (insertRes.recordset.length > 0) {
        createdId = insertRes.recordset[0].DealerId;
      }
    } catch (e) {
      console.warn('[DealerController.createDealer] DB notice:', e.message);
    }

    const newDealer = {
      dealerId: createdId,
      uniqueCode: cleanCode,
      dealerName: cleanName,
      contactNumber: contactNumber || '',
      contactPerson: contactPerson || '',
      address: address || '',
      securityPin: securityPin || '1234',
      billingCycle,
      logoUrl: logoUrl || '',
      isActive: Boolean(isActive),
      createdDate: new Date().toISOString(),
    };

    inMemoryDealers.push(newDealer);
    saveLocalDealers(inMemoryDealers);

    return res.status(201).json({
      success: true,
      message: `Dealer "${cleanName}" created successfully`,
      data: newDealer,
    });
  } catch (err) {
    console.error('[DealerController.createDealer Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 4. PUT /api/dealers/:id
 */
async function updateDealer(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      uniqueCode,
      dealerName,
      contactNumber,
      contactPerson,
      address,
      securityPin,
      billingCycle,
      logoUrl,
      isActive,
    } = req.body;

    const idx = inMemoryDealers.findIndex((d) => d.dealerId === id || d.uniqueCode === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }

    const current = inMemoryDealers[idx];
    const updated = {
      ...current,
      uniqueCode: uniqueCode ? uniqueCode.trim().toUpperCase() : current.uniqueCode,
      dealerName: dealerName ? dealerName.trim() : current.dealerName,
      contactNumber: contactNumber !== undefined ? contactNumber : current.contactNumber,
      contactPerson: contactPerson !== undefined ? contactPerson : current.contactPerson,
      address: address !== undefined ? address : current.address,
      securityPin: securityPin !== undefined ? securityPin : current.securityPin,
      billingCycle: billingCycle !== undefined ? billingCycle : current.billingCycle,
      logoUrl: logoUrl !== undefined ? logoUrl : current.logoUrl,
      isActive: isActive !== undefined ? Boolean(isActive) : current.isActive,
      updatedDate: new Date().toISOString(),
    };

    try {
      const pool = await getPool(1, 500);
      await pool.request()
        .input('id', sql.Int, updated.dealerId)
        .input('code', sql.NVarChar(50), updated.uniqueCode)
        .input('name', sql.NVarChar(150), updated.dealerName)
        .input('phone', sql.NVarChar(50), updated.contactNumber || '')
        .input('contactPerson', sql.NVarChar(100), updated.contactPerson || '')
        .input('address', sql.NVarChar(500), updated.address || '')
        .input('pin', sql.NVarChar(20), updated.securityPin || '1234')
        .input('billingCycle', sql.NVarChar(100), updated.billingCycle)
        .input('logo', sql.NVarChar(sql.MAX), updated.logoUrl || '')
        .input('active', sql.Bit, updated.isActive ? 1 : 0)
        .query(`
          UPDATE dbo.DealerMaster
          SET 
            UniqueCode = @code,
            DealerName = @name,
            ContactNumber = @phone,
            ContactPerson = @contactPerson,
            Address = @address,
            SecurityPin = @pin,
            BillingCycle = @billingCycle,
            LogoData = @logo,
            IsActive = @active,
            UpdatedDate = GETDATE()
          WHERE DealerId = @id;
        `);
    } catch (e) {
      console.warn('[DealerController.updateDealer] DB notice:', e.message);
    }

    inMemoryDealers[idx] = updated;
    saveLocalDealers(inMemoryDealers);

    return res.json({
      success: true,
      message: `Dealer "${updated.dealerName}" updated successfully`,
      data: updated,
    });
  } catch (err) {
    console.error('[DealerController.updateDealer Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 5. DELETE /api/dealers/:id
 */
async function deleteDealer(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const idx = inMemoryDealers.findIndex((d) => d.dealerId === id || d.uniqueCode === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }

    const removed = inMemoryDealers.splice(idx, 1)[0];
    saveLocalDealers(inMemoryDealers);

    try {
      const pool = await getPool(1, 500);
      await pool.request()
        .input('id', sql.Int, removed.dealerId)
        .query(`DELETE FROM dbo.DealerMaster WHERE DealerId = @id`);
    } catch (e) {
      console.warn('[DealerController.deleteDealer] DB notice:', e.message);
    }

    return res.json({
      success: true,
      message: `Dealer "${removed.dealerName}" deleted successfully`,
    });
  } catch (err) {
    console.error('[DealerController.deleteDealer Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getDealers,
  getDealerById,
  createDealer,
  updateDealer,
  deleteDealer,
};

