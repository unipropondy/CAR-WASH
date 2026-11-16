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

// =========================================================================
// DEALER CREDIT & SETTLEMENT MANAGEMENT
// =========================================================================

const LOCAL_CREDIT_STORE_PATH = path.join(__dirname, '..', 'dealer_credit_store.json');

function loadLocalCreditStore() {
  try {
    if (fs.existsSync(LOCAL_CREDIT_STORE_PATH)) {
      const raw = fs.readFileSync(LOCAL_CREDIT_STORE_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[DealerController] Error reading local credit store:', e.message);
  }
  return { payments: [], bills: [] };
}

function saveLocalCreditStore(data) {
  try {
    fs.writeFileSync(LOCAL_CREDIT_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[DealerController] Error writing local credit store:', e.message);
  }
}

/**
 * 6. GET /api/dealers/credit/history
 * Comprehensive credit history: all dealer orders on credit with bill status, paid/outstanding amounts.
 * Query params: dealerId, status (ALL, PENDING, PARTIALLY_PAID, PAID), search, startDate, endDate
 */
async function getDealerCreditHistory(req, res) {
  try {
    const { dealerId, status = 'ALL', search = '', startDate, endDate } = req.query;
    const dId = dealerId ? parseInt(dealerId, 10) : null;

    try {
      const pool = await getPool(1, 500);
      const request = pool.request();
      const whereConditions = [
        `(o.DealerId IS NOT NULL OR RTRIM(LTRIM(o.PayMode)) = 'CREDIT')`
      ];

      if (dId && !isNaN(dId)) {
        request.input('dealerId', sql.Int, dId);
        whereConditions.push(`o.DealerId = @dealerId`);
      }

      if (status && status.toUpperCase() !== 'ALL') {
        const normStatus = status.trim().toUpperCase();
        request.input('status', sql.NVarChar(30), normStatus);
        whereConditions.push(`ISNULL(o.CreditStatus, 'PENDING') = @status`);
      }

      if (search && search.trim()) {
        request.input('search', sql.NVarChar(100), `%${search.trim()}%`);
        whereConditions.push(`(
          o.OrderNo LIKE @search OR
          o.VehicleNumber LIKE @search OR
          dm.DealerName LIKE @search OR
          dm.UniqueCode LIKE @search OR
          o.CustomerName LIKE @search
        )`);
      }

      if (startDate) {
        request.input('startDate', sql.DateTime, new Date(startDate));
        whereConditions.push(`o.CreatedDate >= @startDate`);
      }

      if (endDate) {
        request.input('endDate', sql.DateTime, new Date(endDate));
        whereConditions.push(`o.CreatedDate <= @endDate`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const query = `
        SELECT 
          o.OrderId,
          o.OrderNo,
          o.CreatedDate,
          o.DealerId,
          ISNULL(dm.DealerName, o.CustomerName) AS DealerName,
          ISNULL(dm.UniqueCode, 'DLR') AS DealerCode,
          dm.ContactNumber AS DealerPhone,
          dm.ContactPerson AS DealerContactPerson,
          o.VehicleNumber,
          o.VehicleTypeId,
          ISNULL(vt.VehicleTypeName, 'Standard') AS VehicleTypeName,
          o.PackageId,
          ISNULL(sp.PackageName, 'Standard Wash') AS PackageName,
          o.AdditionalServices,
          o.TotalAmount,
          ISNULL(o.PaidAmount, 0) AS PaidAmount,
          ISNULL(o.OutstandingAmount, CASE WHEN o.CreditStatus = 'PAID' THEN 0 ELSE o.TotalAmount END) AS OutstandingAmount,
          ISNULL(o.CreditStatus, CASE WHEN ISNULL(o.PaidAmount, 0) >= o.TotalAmount THEN 'PAID' ELSE 'PENDING' END) AS CreditStatus,
          o.StatusCode,
          o.PaymentStatus,
          o.DayId
        FROM dbo.CarWashOrder o
        LEFT JOIN dbo.DealerMaster dm ON o.DealerId = dm.DealerId
        LEFT JOIN dbo.VehicleTypeMaster vt ON o.VehicleTypeId = vt.VehicleTypeId
        LEFT JOIN dbo.ServicePackageMaster sp ON o.PackageId = sp.PackageId
        ${whereClause}
        ORDER BY o.CreatedDate DESC;
      `;

      const result = await request.query(query);

      // Fetch payment allocations for these orders
      const orderIds = result.recordset.map((r) => r.OrderId);
      let paymentMap = {};

      if (orderIds.length > 0) {
        try {
          const paymentsRes = await pool.request().query(`
            SELECT 
              pb.OrderId,
              pb.AllocatedAmount,
              pb.PreviousOutstanding,
              pb.NewOutstanding,
              pb.BillStatusAfterPayment,
              p.PaymentId,
              p.ReceiptNo,
              p.PaymentDate,
              p.PaymentMode,
              p.ReferenceNo,
              p.ProcessedBy,
              p.Remarks
            FROM dbo.DealerCreditPaymentBill pb
            JOIN dbo.DealerCreditPayment p ON p.PaymentId = pb.PaymentId
            ORDER BY p.PaymentDate DESC;
          `);
          paymentsRes.recordset.forEach((p) => {
            if (!paymentMap[p.OrderId]) paymentMap[p.OrderId] = [];
            paymentMap[p.OrderId].push({
              paymentId: p.PaymentId,
              receiptNo: p.ReceiptNo,
              paymentDate: p.PaymentDate,
              paymentMode: p.PaymentMode,
              allocatedAmount: Number(p.AllocatedAmount),
              previousOutstanding: Number(p.PreviousOutstanding),
              newOutstanding: Number(p.NewOutstanding),
              billStatusAfterPayment: p.BillStatusAfterPayment,
              referenceNo: p.ReferenceNo,
              remarks: p.Remarks,
              processedBy: p.ProcessedBy,
            });
          });
        } catch (pErr) {
          console.warn('[DealerController] paymentMap notice:', pErr.message);
        }
      }

      let totalCreditSales = 0;
      let totalPaidAmount = 0;
      let totalOutstandingAmount = 0;

      const items = result.recordset.map((r) => {
        const total = Number(r.TotalAmount);
        const paid = Number(r.PaidAmount);
        const outstanding = Number(r.OutstandingAmount);
        totalCreditSales += total;
        totalPaidAmount += paid;
        totalOutstandingAmount += outstanding;

        return {
          orderId: r.OrderId,
          billNumber: r.OrderNo,
          orderDateTime: r.CreatedDate,
          dealerId: r.DealerId,
          dealerName: r.DealerName,
          dealerCode: r.DealerCode,
          dealerPhone: r.DealerPhone,
          dealerContactPerson: r.DealerContactPerson,
          vehicleNumber: r.VehicleNumber,
          vehicleTypeId: r.VehicleTypeId,
          vehicleType: r.VehicleTypeName,
          packageId: r.PackageId,
          selectedPackage: r.PackageName,
          additionalServices: r.AdditionalServices || '-',
          totalAmount: total,
          paidAmount: paid,
          outstandingAmount: outstanding,
          creditStatus: r.CreditStatus, // 'PENDING' | 'PARTIALLY_PAID' | 'PAID'
          statusCode: r.StatusCode,
          paymentStatus: r.PaymentStatus,
          payments: paymentMap[r.OrderId] || [],
        };
      });

      return res.json({
        success: true,
        count: items.length,
        summary: {
          totalCreditSales: Number(totalCreditSales.toFixed(2)),
          totalPaidAmount: Number(totalPaidAmount.toFixed(2)),
          totalOutstandingAmount: Number(totalOutstandingAmount.toFixed(2)),
          totalBillsCount: items.length,
        },
        data: items,
      });
    } catch (dbErr) {
      console.warn('[DealerController.getDealerCreditHistory] DB offline, using local store:', dbErr.message);
    }

    // Fallback store
    const store = loadLocalCreditStore();
    let bills = store.bills || [];
    if (dId) bills = bills.filter((b) => b.dealerId === dId);
    if (status && status.toUpperCase() !== 'ALL') {
      bills = bills.filter((b) => (b.creditStatus || 'PENDING').toUpperCase() === status.toUpperCase());
    }
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      bills = bills.filter((b) => 
        (b.billNumber && b.billNumber.toLowerCase().includes(term)) ||
        (b.dealerName && b.dealerName.toLowerCase().includes(term)) ||
        (b.vehicleNumber && b.vehicleNumber.toLowerCase().includes(term))
      );
    }

    let totalCreditSales = 0;
    let totalPaidAmount = 0;
    let totalOutstandingAmount = 0;
    bills.forEach((b) => {
      totalCreditSales += Number(b.totalAmount || 0);
      totalPaidAmount += Number(b.paidAmount || 0);
      totalOutstandingAmount += Number(b.outstandingAmount || 0);
    });

    return res.json({
      success: true,
      count: bills.length,
      summary: {
        totalCreditSales: Number(totalCreditSales.toFixed(2)),
        totalPaidAmount: Number(totalPaidAmount.toFixed(2)),
        totalOutstandingAmount: Number(totalOutstandingAmount.toFixed(2)),
        totalBillsCount: bills.length,
      },
      data: bills,
    });
  } catch (err) {
    console.error('[DealerController.getDealerCreditHistory Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve credit history', error: err.message });
  }
}

/**
 * 7. GET /api/dealers/credit/outstanding
 * Unpaid and partially paid bills ready for settlement.
 * Query param: dealerId (optional)
 */
async function getDealerOutstandingBills(req, res) {
  try {
    const { dealerId } = req.query;
    const dId = dealerId ? parseInt(dealerId, 10) : null;

    try {
      const pool = await getPool(1, 500);
      const request = pool.request();
      const whereConditions = [
        `(o.DealerId IS NOT NULL OR RTRIM(LTRIM(o.PayMode)) = 'CREDIT')`,
        `ISNULL(o.OutstandingAmount, o.TotalAmount) > 0.001`,
        `ISNULL(o.CreditStatus, 'PENDING') IN ('PENDING', 'PARTIALLY_PAID')`
      ];

      if (dId && !isNaN(dId)) {
        request.input('dealerId', sql.Int, dId);
        whereConditions.push(`o.DealerId = @dealerId`);
      }

      const query = `
        SELECT 
          o.OrderId,
          o.OrderNo,
          o.CreatedDate,
          o.DealerId,
          ISNULL(dm.DealerName, o.CustomerName) AS DealerName,
          ISNULL(dm.UniqueCode, 'DLR') AS DealerCode,
          dm.ContactNumber AS DealerPhone,
          o.VehicleNumber,
          o.VehicleTypeId,
          ISNULL(vt.VehicleTypeName, 'Standard') AS VehicleTypeName,
          o.PackageId,
          ISNULL(sp.PackageName, 'Standard Wash') AS PackageName,
          o.AdditionalServices,
          o.TotalAmount,
          ISNULL(o.PaidAmount, 0) AS PaidAmount,
          ISNULL(o.OutstandingAmount, o.TotalAmount) AS OutstandingAmount,
          ISNULL(o.CreditStatus, 'PENDING') AS CreditStatus
        FROM dbo.CarWashOrder o
        LEFT JOIN dbo.DealerMaster dm ON o.DealerId = dm.DealerId
        LEFT JOIN dbo.VehicleTypeMaster vt ON o.VehicleTypeId = vt.VehicleTypeId
        LEFT JOIN dbo.ServicePackageMaster sp ON o.PackageId = sp.PackageId
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY o.CreatedDate ASC;
      `;

      const result = await request.query(query);

      let totalOutstanding = 0;
      const bills = result.recordset.map((r) => {
        const out = Number(r.OutstandingAmount);
        totalOutstanding += out;
        return {
          orderId: r.OrderId,
          billNumber: r.OrderNo,
          orderDateTime: r.CreatedDate,
          dealerId: r.DealerId,
          dealerName: r.DealerName,
          dealerCode: r.DealerCode,
          dealerPhone: r.DealerPhone,
          vehicleNumber: r.VehicleNumber,
          vehicleType: r.VehicleTypeName,
          selectedPackage: r.PackageName,
          additionalServices: r.AdditionalServices || '-',
          totalAmount: Number(r.TotalAmount),
          paidAmount: Number(r.PaidAmount),
          outstandingAmount: out,
          creditStatus: r.CreditStatus,
        };
      });

      return res.json({
        success: true,
        count: bills.length,
        totalOutstanding: Number(totalOutstanding.toFixed(2)),
        data: bills,
      });
    } catch (dbErr) {
      console.warn('[DealerController.getDealerOutstandingBills] DB offline, using local store:', dbErr.message);
    }

    const store = loadLocalCreditStore();
    let bills = (store.bills || []).filter(
      (b) => Number(b.outstandingAmount || 0) > 0.001 && ['PENDING', 'PARTIALLY_PAID'].includes(b.creditStatus)
    );
    if (dId) bills = bills.filter((b) => b.dealerId === dId);

    const totalOutstanding = bills.reduce((acc, b) => acc + Number(b.outstandingAmount || 0), 0);

    return res.json({
      success: true,
      count: bills.length,
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
      data: bills,
    });
  } catch (err) {
    console.error('[DealerController.getDealerOutstandingBills Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve outstanding bills', error: err.message });
  }
}

/**
 * 8. POST /api/dealers/credit/settle
 * Settle credit payment against selected bills.
 * Body: { dealerId, paymentAmount, paymentMode, referenceNo, remarks, processedBy, selectedBillIds, billAllocations }
 */
async function settleDealerCredit(req, res) {
  try {
    const {
      dealerId,
      paymentAmount,
      paymentMode = 'CASH',
      referenceNo = '',
      remarks = '',
      processedBy = 'BACKOFFICE',
      selectedBillIds = [],
      billAllocations = [],
    } = req.body || {};

    const dId = parseInt(dealerId, 10);
    const amount = Number(paymentAmount);

    if (!dId || isNaN(dId)) {
      return res.status(400).json({ success: false, message: 'Valid Dealer ID is required' });
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0' });
    }
    if (!paymentMode || !paymentMode.trim()) {
      return res.status(400).json({ success: false, message: 'Payment mode is required (Cash, Card, PayNow, etc.)' });
    }

    const cleanMode = paymentMode.trim().toUpperCase();

    // Generate unique Receipt Number: RCP-YYYYMMDD-XXXX
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}${mm}${dd}`;

    try {
      const pool = await getPool(1, 500);
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        // Fetch dealer details
        const dealerCheck = await new sql.Request(transaction)
          .input('dealerId', sql.Int, dId)
          .query(`SELECT DealerId, DealerName, UniqueCode FROM dbo.DealerMaster WHERE DealerId = @dealerId;`);

        const dealerName = dealerCheck.recordset[0]?.DealerName || `Dealer #${dId}`;

        // Fetch outstanding bills for this dealer
        let billQuery = `
          SELECT 
            OrderId, OrderNo, TotalAmount, 
            ISNULL(PaidAmount, 0) AS PaidAmount, 
            ISNULL(OutstandingAmount, TotalAmount) AS OutstandingAmount, 
            ISNULL(CreditStatus, 'PENDING') AS CreditStatus,
            StatusCode
          FROM dbo.CarWashOrder WITH (UPDLOCK, ROWLOCK)
          WHERE DealerId = @dealerId 
            AND ISNULL(OutstandingAmount, TotalAmount) > 0.001
            AND ISNULL(CreditStatus, 'PENDING') IN ('PENDING', 'PARTIALLY_PAID')
        `;

        const billReq = new sql.Request(transaction);
        billReq.input('dealerId', sql.Int, dId);

        if (Array.isArray(selectedBillIds) && selectedBillIds.length > 0) {
          const idsList = selectedBillIds.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n));
          if (idsList.length > 0) {
            billQuery += ` AND OrderId IN (${idsList.join(',')})`;
          }
        }

        billQuery += ` ORDER BY CreatedDate ASC;`;
        const billsResult = await billReq.query(billQuery);
        const bills = billsResult.recordset;

        if (bills.length === 0) {
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'No outstanding bills found for this dealer or selection.' });
        }

        // Determine allocations across bills
        let allocations = [];
        let remainingToAllocate = amount;

        if (Array.isArray(billAllocations) && billAllocations.length > 0) {
          allocations = billAllocations.map((a) => ({
            orderId: parseInt(a.orderId, 10),
            amount: Number(a.amount),
          }));
        } else {
          // Automatic sequential allocation: oldest bill first
          for (const b of bills) {
            if (remainingToAllocate <= 0) break;
            const billOut = Number(b.OutstandingAmount);
            const allocate = Math.min(billOut, remainingToAllocate);
            if (allocate > 0) {
              allocations.push({
                orderId: b.OrderId,
                amount: Number(allocate.toFixed(2)),
              });
              remainingToAllocate = Number((remainingToAllocate - allocate).toFixed(2));
            }
          }
        }

        const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
        if (totalAllocated <= 0) {
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Payment allocation could not be applied to any bill.' });
        }

        // Count receipts for today to generate next sequence
        const rcpSeq = await new sql.Request(transaction).query(`
          SELECT COUNT(*) AS todayReceipts FROM dbo.DealerCreditPayment 
          WHERE CAST(PaymentDate AS DATE) = CAST(GETDATE() AS DATE);
        `);
        const nextRcpNum = (rcpSeq.recordset[0]?.todayReceipts || 0) + 1;
        const receiptNo = `RCP-${datePrefix}-${String(nextRcpNum).padStart(4, '0')}`;

        // Insert into dbo.DealerCreditPayment
        const pInsertReq = new sql.Request(transaction);
        pInsertReq.input('receiptNo', sql.NVarChar(40), receiptNo);
        pInsertReq.input('dealerId', sql.Int, dId);
        pInsertReq.input('paymentAmount', sql.Decimal(18, 2), totalAllocated);
        pInsertReq.input('paymentMode', sql.NVarChar(30), cleanMode);
        pInsertReq.input('referenceNo', sql.NVarChar(100), referenceNo || null);
        pInsertReq.input('remarks', sql.NVarChar(500), remarks || `Payment settled against ${allocations.length} bill(s)`);
        pInsertReq.input('processedBy', sql.NVarChar(100), processedBy || 'BACKOFFICE');

        const pResult = await pInsertReq.query(`
          INSERT INTO dbo.DealerCreditPayment (
            ReceiptNo, DealerId, PaymentDate, PaymentAmount, PaymentMode, ReferenceNo, Remarks, ProcessedBy, CreatedDate
          )
          OUTPUT INSERTED.PaymentId, INSERTED.CreatedDate
          VALUES (
            @receiptNo, @dealerId, GETDATE(), @paymentAmount, @paymentMode, @referenceNo, @remarks, @processedBy, GETDATE()
          );
        `);

        const createdPaymentId = pResult.recordset[0].PaymentId;
        const paymentDate = pResult.recordset[0].CreatedDate;

        const settledBillsSummary = [];

        // Apply allocations to each bill
        for (const alloc of allocations) {
          const bill = bills.find((b) => b.OrderId === alloc.orderId);
          if (!bill) continue;

          const prevPaid = Number(bill.PaidAmount);
          const prevOut = Number(bill.OutstandingAmount);
          const allocatedAmt = alloc.amount;
          const newPaid = Number((prevPaid + allocatedAmt).toFixed(2));
          const newOut = Math.max(0, Number((prevOut - allocatedAmt).toFixed(2)));
          const isFullySettled = newOut <= 0.001;
          const newCreditStatus = isFullySettled ? 'PAID' : 'PARTIALLY_PAID';

          // Update CarWashOrder
          const updBillReq = new sql.Request(transaction);
          updBillReq.input('orderId', sql.Int, bill.OrderId);
          updBillReq.input('paidAmount', sql.Decimal(18, 2), newPaid);
          updBillReq.input('outstandingAmount', sql.Decimal(18, 2), newOut);
          updBillReq.input('creditStatus', sql.NVarChar(30), newCreditStatus);

          await updBillReq.query(`
            UPDATE dbo.CarWashOrder
            SET 
              PaidAmount = @paidAmount,
              OutstandingAmount = @outstandingAmount,
              CreditStatus = @creditStatus,
              PaidDate = CASE WHEN @creditStatus = 'PAID' THEN GETDATE() ELSE PaidDate END
            WHERE OrderId = @orderId;
          `);

          // Insert into dbo.DealerCreditPaymentBill
          const pbInsert = new sql.Request(transaction);
          pbInsert.input('paymentId', sql.Int, createdPaymentId);
          pbInsert.input('orderId', sql.Int, bill.OrderId);
          pbInsert.input('orderNo', sql.NVarChar(30), bill.OrderNo);
          pbInsert.input('allocatedAmount', sql.Decimal(18, 2), allocatedAmt);
          pbInsert.input('prevOut', sql.Decimal(18, 2), prevOut);
          pbInsert.input('newOut', sql.Decimal(18, 2), newOut);
          pbInsert.input('statusAfter', sql.NVarChar(30), newCreditStatus);

          await pbInsert.query(`
            INSERT INTO dbo.DealerCreditPaymentBill (
              PaymentId, OrderId, OrderNo, AllocatedAmount, PreviousOutstanding, NewOutstanding, BillStatusAfterPayment, CreatedDate
            ) VALUES (
              @paymentId, @orderId, @orderNo, @allocatedAmount, @prevOut, @newOut, @statusAfter, GETDATE()
            );
          `);

          // Audit trail in CarWashOrderStatusHistory
          const histReq = new sql.Request(transaction);
          histReq.input('orderId', sql.Int, bill.OrderId);
          histReq.input('oldStatus', sql.Int, bill.StatusCode);
          histReq.input('newStatus', sql.Int, bill.StatusCode);
          histReq.input('remarks', sql.NVarChar(500), `Dealer Credit Payment: $${allocatedAmt.toFixed(2)} received via ${cleanMode}. Receipt: ${receiptNo}. Status: ${newCreditStatus} (Remaining: $${newOut.toFixed(2)})`);
          histReq.input('changedBy', sql.NVarChar(100), processedBy || 'BACKOFFICE');

          await histReq.query(`
            INSERT INTO dbo.CarWashOrderStatusHistory (
              OrderId, OldStatusCode, NewStatusCode, Remarks, ChangedBy, ChangedDate
            ) VALUES (
              @orderId, @oldStatus, @newStatus, @remarks, @changedBy, GETDATE()
            );
          `);

          settledBillsSummary.push({
            orderId: bill.OrderId,
            orderNo: bill.OrderNo,
            allocatedAmount: allocatedAmt,
            previousOutstanding: prevOut,
            newOutstanding: newOut,
            creditStatus: newCreditStatus,
            isClosed: isFullySettled,
          });
        }

        await transaction.commit();

        return res.status(200).json({
          success: true,
          message: `Payment of $${totalAllocated.toFixed(2)} settled successfully for ${dealerName}. Receipt: ${receiptNo}`,
          data: {
            paymentId: createdPaymentId,
            receiptNo,
            dealerId: dId,
            dealerName,
            paymentDate,
            paymentAmount: totalAllocated,
            paymentMode: cleanMode,
            referenceNo: referenceNo || null,
            remarks: remarks || null,
            processedBy,
            settledBills: settledBillsSummary,
          },
        });
      } catch (txErr) {
        await transaction.rollback();
        throw txErr;
      }
    } catch (dbErr) {
      console.warn('[DealerController.settleDealerCredit] DB offline, using local store:', dbErr.message);
    }

    // Local Store Settlement Fallback
    const store = loadLocalCreditStore();
    const rcpNum = (store.payments || []).length + 1;
    const receiptNo = `RCP-${datePrefix}-${String(rcpNum).padStart(4, '0')}`;

    const bills = (store.bills || []).filter(
      (b) => b.dealerId === dId && Number(b.outstandingAmount || 0) > 0.001
    );

    let remaining = amount;
    const settledBills = [];

    for (const b of bills) {
      if (remaining <= 0) break;
      const bOut = Number(b.outstandingAmount || 0);
      const alloc = Math.min(bOut, remaining);
      if (alloc > 0) {
        b.paidAmount = Number(((b.paidAmount || 0) + alloc).toFixed(2));
        b.outstandingAmount = Number((bOut - alloc).toFixed(2));
        b.creditStatus = b.outstandingAmount <= 0.001 ? 'PAID' : 'PARTIALLY_PAID';
        remaining = Number((remaining - alloc).toFixed(2));

        settledBills.push({
          orderId: b.orderId,
          orderNo: b.billNumber,
          allocatedAmount: alloc,
          previousOutstanding: bOut,
          newOutstanding: b.outstandingAmount,
          creditStatus: b.creditStatus,
          isClosed: b.creditStatus === 'PAID',
        });
      }
    }

    const newPayment = {
      paymentId: Date.now(),
      receiptNo,
      dealerId: dId,
      dealerName: `Dealer #${dId}`,
      paymentDate: new Date().toISOString(),
      paymentAmount: amount - remaining,
      paymentMode: cleanMode,
      referenceNo,
      remarks,
      processedBy,
      settledBills,
    };

    if (!store.payments) store.payments = [];
    store.payments.push(newPayment);
    saveLocalCreditStore(store);

    return res.json({
      success: true,
      message: `Payment of $${newPayment.paymentAmount.toFixed(2)} settled successfully (local fallback). Receipt: ${receiptNo}`,
      data: newPayment,
    });
  } catch (err) {
    console.error('[DealerController.settleDealerCredit Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to settle dealer credit', error: err.message });
  }
}

/**
 * 9. GET /api/dealers/credit/payments
 * Retrieve complete payment and settlement receipt audit trail.
 * Query param: dealerId (optional)
 */
async function getDealerPaymentHistory(req, res) {
  try {
    const { dealerId } = req.query;
    const dId = dealerId ? parseInt(dealerId, 10) : null;

    try {
      const pool = await getPool(1, 500);
      const request = pool.request();
      let query = `
        SELECT 
          p.PaymentId,
          p.ReceiptNo,
          p.DealerId,
          ISNULL(dm.DealerName, CONCAT('Dealer #', p.DealerId)) AS DealerName,
          dm.UniqueCode AS DealerCode,
          p.PaymentDate,
          p.PaymentAmount,
          p.PaymentMode,
          p.ReferenceNo,
          p.Remarks,
          p.ProcessedBy,
          p.CreatedDate
        FROM dbo.DealerCreditPayment p
        LEFT JOIN dbo.DealerMaster dm ON p.DealerId = dm.DealerId
      `;

      if (dId && !isNaN(dId)) {
        request.input('dealerId', sql.Int, dId);
        query += ` WHERE p.DealerId = @dealerId`;
      }

      query += ` ORDER BY p.PaymentDate DESC;`;
      const result = await request.query(query);

      // Fetch settled bill details for these payments
      const paymentIds = result.recordset.map((r) => r.PaymentId);
      let billsMap = {};

      if (paymentIds.length > 0) {
        try {
          const pbRes = await pool.request().query(`
            SELECT 
              pb.PaymentId,
              pb.OrderId,
              pb.OrderNo,
              pb.AllocatedAmount,
              pb.PreviousOutstanding,
              pb.NewOutstanding,
              pb.BillStatusAfterPayment
            FROM dbo.DealerCreditPaymentBill pb
            ORDER BY pb.PaymentBillId ASC;
          `);
          pbRes.recordset.forEach((b) => {
            if (!billsMap[b.PaymentId]) billsMap[b.PaymentId] = [];
            billsMap[b.PaymentId].push({
              orderId: b.OrderId,
              billNumber: b.OrderNo,
              allocatedAmount: Number(b.AllocatedAmount),
              previousOutstanding: Number(b.PreviousOutstanding),
              newOutstanding: Number(b.NewOutstanding),
              billStatusAfterPayment: b.BillStatusAfterPayment,
            });
          });
        } catch (pbErr) {
          console.warn('[getDealerPaymentHistory] pb notice:', pbErr.message);
        }
      }

      const payments = result.recordset.map((p) => ({
        paymentId: p.PaymentId,
        receiptNo: p.ReceiptNo,
        dealerId: p.DealerId,
        dealerName: p.DealerName,
        dealerCode: p.DealerCode,
        paymentDate: p.PaymentDate,
        paymentAmount: Number(p.PaymentAmount),
        paymentMode: p.PaymentMode,
        referenceNo: p.ReferenceNo || '-',
        remarks: p.Remarks || '-',
        processedBy: p.ProcessedBy || 'BACKOFFICE',
        settledBills: billsMap[p.PaymentId] || [],
      }));

      return res.json({
        success: true,
        count: payments.length,
        data: payments,
      });
    } catch (dbErr) {
      console.warn('[DealerController.getDealerPaymentHistory] DB offline, using local store:', dbErr.message);
    }

    const store = loadLocalCreditStore();
    let payments = store.payments || [];
    if (dId) payments = payments.filter((p) => p.dealerId === dId);

    return res.json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (err) {
    console.error('[DealerController.getDealerPaymentHistory Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve payment history', error: err.message });
  }
}

/**
 * 10. GET /api/dealers/history/summary
 * Aggregated Dealer History & Visit Counts:
 * Dealer Name, Total Visits, Total Vehicles Serviced, Total Orders, Total Amount, Total Paid Amount, Total Outstanding Credit, Last Visit Date.
 */
async function getDealerVehicleHistorySummary(req, res) {
  try {
    try {
      const pool = await getPool(1, 500);
      const query = `
        SELECT 
          dm.DealerId,
          dm.UniqueCode,
          dm.DealerName,
          dm.ContactNumber,
          dm.ContactPerson,
          dm.BillingCycle,
          dm.IsActive,
          COUNT(o.OrderId) AS TotalOrders,
          COUNT(DISTINCT o.OrderId) AS TotalVisits,
          COUNT(DISTINCT o.VehicleNumber) AS TotalVehiclesServiced,
          ISNULL(SUM(o.TotalAmount), 0) AS TotalAmount,
          ISNULL(SUM(o.PaidAmount), 0) AS TotalPaidAmount,
          ISNULL(SUM(CASE WHEN ISNULL(o.CreditStatus, 'PENDING') IN ('PENDING', 'PARTIALLY_PAID') THEN ISNULL(o.OutstandingAmount, o.TotalAmount) ELSE 0 END), 0) AS TotalOutstandingCredit,
          MAX(o.CreatedDate) AS LastVisitDate
        FROM dbo.DealerMaster dm
        LEFT JOIN dbo.CarWashOrder o ON o.DealerId = dm.DealerId
        GROUP BY 
          dm.DealerId, dm.UniqueCode, dm.DealerName, dm.ContactNumber, dm.ContactPerson, dm.BillingCycle, dm.IsActive
        ORDER BY TotalOrders DESC, dm.DealerName ASC;
      `;

      const result = await pool.request().query(query);

      const summaries = result.recordset.map((r) => ({
        dealerId: r.DealerId,
        uniqueCode: r.UniqueCode,
        dealerName: r.DealerName,
        contactNumber: r.ContactNumber || '-',
        contactPerson: r.ContactPerson || '-',
        billingCycle: r.BillingCycle,
        isActive: Boolean(r.IsActive),
        totalVisits: Number(r.TotalVisits || 0),
        totalVehiclesServiced: Number(r.TotalVehiclesServiced || 0),
        totalOrders: Number(r.TotalOrders || 0),
        totalAmount: Number(Number(r.TotalAmount || 0).toFixed(2)),
        totalPaidAmount: Number(Number(r.TotalPaidAmount || 0).toFixed(2)),
        totalOutstandingCredit: Number(Number(r.TotalOutstandingCredit || 0).toFixed(2)),
        lastVisitDate: r.LastVisitDate || null,
      }));

      return res.json({
        success: true,
        count: summaries.length,
        data: summaries,
      });
    } catch (dbErr) {
      console.warn('[DealerController.getDealerVehicleHistorySummary] DB offline, using local store:', dbErr.message);
    }

    // Local fallback aggregation
    const store = loadLocalCreditStore();
    const bills = store.bills || [];
    const dealers = inMemoryDealers || [];

    const summaries = dealers.map((d) => {
      const dOrders = bills.filter((b) => b.dealerId === d.dealerId);
      const vehicles = new Set(dOrders.map((o) => o.vehicleNumber).filter(Boolean));
      const totalAmount = dOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      const totalPaid = dOrders.reduce((sum, o) => sum + Number(o.paidAmount || 0), 0);
      const totalOut = dOrders.reduce((sum, o) => sum + Number(o.outstandingAmount || 0), 0);
      const lastVisit = dOrders.length > 0 ? dOrders[0].orderDateTime : null;

      return {
        dealerId: d.dealerId,
        uniqueCode: d.uniqueCode,
        dealerName: d.dealerName,
        contactNumber: d.contactNumber || '-',
        contactPerson: d.contactPerson || '-',
        billingCycle: d.billingCycle,
        isActive: d.isActive,
        totalVisits: dOrders.length,
        totalVehiclesServiced: vehicles.size,
        totalOrders: dOrders.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        totalPaidAmount: Number(totalPaid.toFixed(2)),
        totalOutstandingCredit: Number(totalOut.toFixed(2)),
        lastVisitDate: lastVisit,
      };
    });

    return res.json({
      success: true,
      count: summaries.length,
      data: summaries,
    });
  } catch (err) {
    console.error('[DealerController.getDealerVehicleHistorySummary Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve vehicle history summary', error: err.message });
  }
}

/**
 * 11. GET /api/dealers/history/visits
 * Detailed visit history:
 * Visit Date & Time, Bill Number, Vehicle Number, Vehicle Type, Package Selected, Total Amount, Payment Status.
 * Query param: dealerId (optional)
 */
async function getDealerDetailedVisits(req, res) {
  try {
    const { dealerId, search } = req.query;
    const dId = dealerId ? parseInt(dealerId, 10) : null;

    try {
      const pool = await getPool(1, 500);
      const request = pool.request();
      const whereConditions = [
        `o.DealerId IS NOT NULL`
      ];

      if (dId && !isNaN(dId)) {
        request.input('dealerId', sql.Int, dId);
        whereConditions.push(`o.DealerId = @dealerId`);
      }

      if (search && search.trim()) {
        request.input('search', sql.NVarChar(100), `%${search.trim()}%`);
        whereConditions.push(`(
          o.OrderNo LIKE @search OR
          o.VehicleNumber LIKE @search OR
          dm.DealerName LIKE @search
        )`);
      }

      const query = `
        SELECT 
          o.OrderId,
          o.OrderNo,
          o.CreatedDate,
          o.DealerId,
          dm.DealerName,
          dm.UniqueCode AS DealerCode,
          o.VehicleNumber,
          ISNULL(vt.VehicleTypeName, 'Standard') AS VehicleTypeName,
          ISNULL(sp.PackageName, 'Standard Wash') AS PackageName,
          o.AdditionalServices,
          o.TotalAmount,
          ISNULL(o.PaidAmount, 0) AS PaidAmount,
          ISNULL(o.OutstandingAmount, 0) AS OutstandingAmount,
          ISNULL(o.CreditStatus, 'PENDING') AS CreditStatus,
          o.StatusCode,
          o.PaymentStatus
        FROM dbo.CarWashOrder o
        JOIN dbo.DealerMaster dm ON o.DealerId = dm.DealerId
        LEFT JOIN dbo.VehicleTypeMaster vt ON o.VehicleTypeId = vt.VehicleTypeId
        LEFT JOIN dbo.ServicePackageMaster sp ON o.PackageId = sp.PackageId
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY o.CreatedDate DESC;
      `;

      const result = await request.query(query);

      const visits = result.recordset.map((r) => ({
        orderId: r.OrderId,
        visitDateTime: r.CreatedDate,
        billNumber: r.OrderNo,
        dealerId: r.DealerId,
        dealerName: r.DealerName,
        dealerCode: r.DealerCode,
        vehicleNumber: r.VehicleNumber,
        vehicleType: r.VehicleTypeName,
        packageSelected: r.PackageName,
        additionalServices: r.AdditionalServices || '-',
        totalAmount: Number(r.TotalAmount),
        paidAmount: Number(r.PaidAmount),
        outstandingAmount: Number(r.OutstandingAmount),
        paymentStatus: r.CreditStatus, // 'PENDING' | 'PARTIALLY_PAID' | 'PAID'
        washStatus: r.PaymentStatus,
      }));

      return res.json({
        success: true,
        count: visits.length,
        data: visits,
      });
    } catch (dbErr) {
      console.warn('[DealerController.getDealerDetailedVisits] DB offline, using local store:', dbErr.message);
    }

    const store = loadLocalCreditStore();
    let visits = (store.bills || []).map((b) => ({
      orderId: b.orderId,
      visitDateTime: b.orderDateTime,
      billNumber: b.billNumber,
      dealerId: b.dealerId,
      dealerName: b.dealerName,
      dealerCode: b.dealerCode,
      vehicleNumber: b.vehicleNumber,
      vehicleType: b.vehicleType,
      packageSelected: b.selectedPackage,
      additionalServices: b.additionalServices || '-',
      totalAmount: Number(b.totalAmount),
      paidAmount: Number(b.paidAmount || 0),
      outstandingAmount: Number(b.outstandingAmount || 0),
      paymentStatus: b.creditStatus || 'PENDING',
      washStatus: 'PAID',
    }));

    if (dId) visits = visits.filter((v) => v.dealerId === dId);

    return res.json({
      success: true,
      count: visits.length,
      data: visits,
    });
  } catch (err) {
    console.error('[DealerController.getDealerDetailedVisits Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve detailed visits', error: err.message });
  }
}

module.exports = {
  getDealers,
  getDealerById,
  createDealer,
  updateDealer,
  deleteDealer,
  getDealerCreditHistory,
  getDealerOutstandingBills,
  settleDealerCredit,
  getDealerPaymentHistory,
  getDealerVehicleHistorySummary,
  getDealerDetailedVisits,
};

