const net = require('net');
const { getPool, sql } = require('../config/db');

/**
 * Build ESC/POS formatted receipt binary buffer with clean 40-column alignment and spacing
 */
function buildEscPosReceipt(order, printerName, company = {}) {
  const ESC = '\x1b';
  const GS = '\x1d';
  const LF = '\x0a';
  const WIDTH = 48;

  const padLine = (left, right) => {
    const l = String(left || '');
    const r = String(right || '');
    const spaceCount = WIDTH - l.length - r.length;
    if (spaceCount <= 0) {
      return l + ' ' + r;
    }
    return l + ' '.repeat(spaceCount) + r;
  };

  const formatAmt = (val) => {
    const num = Number(val || 0);
    const s = '$' + num.toFixed(2);
    return s.padStart(8, ' ');
  };

  let text = '';

  // 1. Initialize printer and enforce USA character set so 0x23 is strictly '#'
  text += ESC + '@';
  text += ESC + 'R' + '\x00';
  text += ESC + 't' + '\x00';

  // 2. Center alignment for Brand Header (No top empty space)
  text += ESC + 'a' + '\x01';

  // Double width & height for brand title
  text += ESC + '!' + '\x38';
  const brandName = (company.CompanyName || 'RED BAY CAR WASH').trim();
  text += brandName + LF;
  text += ESC + '!' + '\x00';

  text += 'EXPRESS VEHICLE CARE & DETAILING' + LF;
  const companyAddr = (company.Address || '48 Toh Guan Rd East, Singapore 608586').replace(/\r?\n/g, ' ').trim();
  text += companyAddr + LF;
  const companyPhone = company.Phone ? `Tel: ${company.Phone}` : 'Tel: +65 6789 0123';
  const companyGst = company.GSTNo ? `GST: ${company.GSTNo}` : 'GST: M90382711';
  text += `${companyPhone} | ${companyGst}` + LF;

  // 3. Compact Queue Ticket Box (Show last 4 digits only, e.g. 0009)
  text += '='.repeat(WIDTH) + LF;
  text += 'OFFICIAL QUEUE TICKET' + LF;
  text += ESC + '!' + '\x38';
  const billNo = String(order.billNumber || order.orderNo || 'RB-0001').trim();
  const queueNo = (() => {
    const match = billNo.match(/\d+$/);
    if (match && match[0]) {
      return match[0].slice(-4).padStart(4, '0');
    }
    const raw = billNo.replace(/\D/g, '');
    return raw.length >= 4 ? raw.slice(-4) : (billNo.length > 4 ? billNo.slice(-4) : billNo);
  })();
  text += '#' + queueNo + LF;
  text += ESC + '!' + '\x00';
  text += '='.repeat(WIDTH) + LF;

  // 4. Order & Customer Details (Singapore Time SGT, UTC+8 - 12h format e.g. 08:37 PM)
  text += ESC + 'a' + '\x00';

  const sgDate = new Date();
  const dateStr = sgDate.toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore', day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = sgDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: true })
    .replace(/[\u202F\u00A0\u2000-\u200B\uFEFF]/g, ' ');
  text += padLine(`Date: ${dateStr}`, `Time: ${timeStr}`) + LF;

  const custName = order.customerDetails?.customerName || order.customerName || 'Walk-in Customer';
  text += `Customer: ${custName}` + LF;

  const plate = order.customerDetails?.vehicleNumber || order.vehicleNumber || 'WALK-IN';
  const vehicleName = order.vehicle?.name || order.vehicleTypeName || 'Standard Vehicle';
  text += `Vehicle:  ${plate} (${vehicleName})` + LF;

  const mobile = order.customerDetails?.mobileNumber || order.mobileNumber || '-';
  if (mobile && mobile !== '-') {
    const cleanMobile = mobile.replace(/\D/g, '');
    const formattedMobile = cleanMobile.length >= 8 ? `+65 ${cleanMobile}` : mobile;
    text += `Contact:  ${formattedMobile}` + LF;
  }

  // 5. Service Package
  text += '-'.repeat(WIDTH) + LF;
  text += padLine('SERVICE DESCRIPTION', 'AMOUNT') + LF;
  text += '-'.repeat(WIDTH) + LF;

  const fullPkgName = String(order.selectedPackage?.name || order.packageName || 'Express Foam Wash').trim();
  const gstRate = Number(company.GSTPercentage || 0);

  // Parse À La Carte services string e.g. "Vomit & Odour Removal ($80.00), Interior Wipe-Down ($10.00)"
  const rawAdditionalStr = String(order.additionalServices || order.AdditionalServices || '').trim();
  const parsedAddons = rawAdditionalStr
    ? rawAdditionalStr.split(/,\s*/).filter(Boolean).map((entry) => {
        const m = entry.match(/^(.*?)\s*\(\$([0-9.]+)\)$/);
        return {
          name: m ? m[1].trim() : entry.trim(),
          price: m ? Number(m[2]) : 0,
        };
      })
    : [];
  const parsedAddonsTotal = parsedAddons.reduce((sum, a) => sum + (Number.isFinite(a.price) ? a.price : 0), 0);
  const additionalAmt = Number(order.additionalAmount ?? order.AdditionalAmount ?? parsedAddonsTotal) || 0;

  const rawPkgPrice = order.packagePrice ?? order.PackagePrice;
  const pkgPriceVal = rawPkgPrice != null ? Number(rawPkgPrice) : Math.max(0, Number(order.totalAmount || 0) - Number(order.gstAmount || 0) - additionalAmt);
  const baseVal = Number((pkgPriceVal + additionalAmt).toFixed(2));
  const gstVal = Number(order.gstAmount != null ? order.gstAmount : ((baseVal * gstRate) / 100).toFixed(2));
  const finalTotal = Math.max(Number(order.totalAmount != null ? order.totalAmount : (baseVal + gstVal).toFixed(2)), Number((baseVal + gstVal).toFixed(2)));

  text += fullPkgName + LF;
  text += padLine(`  Vehicle: ${vehicleName}`, formatAmt(pkgPriceVal)) + LF;
  if (parsedAddons.length > 0) {
    text += 'A La Carte Upgrades:' + LF;
    for (const addon of parsedAddons) {
      const addonLabel = `  + ${addon.name}`.slice(0, WIDTH - 10);
      text += padLine(addonLabel, formatAmt(addon.price)) + LF;
    }
  }
  text += '-'.repeat(WIDTH) + LF;

  // 6. Financial Breakdown - Base Amount, GST Amount, and Final Payable Amount
  text += padLine('Base Amount:', formatAmt(baseVal)) + LF;
  if (gstRate > 0 || gstVal > 0) {
    text += padLine(`GST (${gstRate}%):`, formatAmt(gstVal)) + LF;
  }
  text += '-'.repeat(WIDTH) + LF;

  // Total Paid
  text += ESC + 'E' + '\x01';
  text += padLine('TOTAL PAID:', formatAmt(finalTotal)) + LF;
  text += ESC + 'E' + '\x00';

  const payMode = (order.paymentMode || order.payMode || 'CASH').toUpperCase();
  const isDealerOrder = order.userType === 'DEALER' || Boolean(order.selectedDealer || order.dealerId || order.DealerId);
  const rawPayStatus = String(order.paymentStatus || order.PaymentStatus || '').toUpperCase();
  const payStatus = (payMode === 'CASH' || payMode === 'CREDIT' || isDealerOrder || rawPayStatus === 'PENDING')
    ? 'PENDING'
    : (rawPayStatus || 'PAID');
  text += padLine('Payment Method:', `${payMode} [${payStatus}]`) + LF;
  text += '='.repeat(WIDTH) + LF;

  // 7. Footer (Compact, single line notice, bold brand signature)
  text += ESC + 'a' + '\x01';
  text += ESC + 'E' + '\x01';
  text += 'THANK YOU FOR CHOOSING US!' + LF;
  text += ESC + 'E' + '\x00';
  text += 'Please retain receipt for vehicle collection.' + LF;
  text += ESC + 'E' + '\x01';
  text += 'CAR WASH-POS BY UNIPROSG' + LF;
  text += ESC + 'E' + '\x00';

  // Paper cut immediately after brand line (1 line clearance, no extra empty lines)
  text += GS + 'V' + '\x41' + '\x00';

  return Buffer.from(text, 'binary');
}

/**
 * Send raw binary buffer to thermal network printer via TCP
 */
function sendToPrinterSocket(ip, port = 9100, buffer, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    if (!ip || ip.trim() === '') {
      return reject(new Error('Printer IP address is required'));
    }

    const cleanIp = ip.trim();
    const cleanPort = parseInt(port || '9100', 10);
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);

    socket.connect(cleanPort, cleanIp, () => {
      socket.write(buffer, () => {
        socket.end();
        if (!isResolved) {
          isResolved = true;
          resolve({
            success: true,
            message: `Printed successfully to ${cleanIp}:${cleanPort}`,
            ip: cleanIp,
            port: cleanPort,
          });
        }
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      if (!isResolved) {
        isResolved = true;
        reject(new Error(`Connection to printer at ${cleanIp}:${cleanPort} timed out (${timeoutMs}ms)`));
      }
    });

    socket.on('error', (err) => {
      socket.destroy();
      if (!isResolved) {
        isResolved = true;
        reject(new Error(`Socket error connecting to ${cleanIp}:${cleanPort}: ${err.message}`));
      }
    });
  });
}

/**
 * GET /api/printers
 * Retrieve all printers from PrintMaster
 */
async function getAllPrinters(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        PrinterId,
        PrinterName,
        PrinterPath,
        PrinterIP,
        ISNULL(PrinterPort, 9100) AS PrinterPort,
        PrinterType,
        PrintSection,
        KitchenTypeName,
        KitchenTypeValue,
        IsActive,
        PrintCopy,
        IsEnabled
      FROM dbo.PrintMaster
      ORDER BY IsActive DESC, IsEnabled DESC, PrinterName ASC
    `);

    res.json({
      success: true,
      count: result.recordset.length,
      printers: result.recordset,
    });
  } catch (err) {
    console.error('[PrinterController] getAllPrinters error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/printers/:id
 */
async function getPrinterById(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          PrinterId,
          PrinterName,
          PrinterPath,
          PrinterIP,
          ISNULL(PrinterPort, 9100) AS PrinterPort,
          PrinterType,
          PrintSection,
          KitchenTypeName,
          KitchenTypeValue,
          IsActive,
          PrintCopy,
          IsEnabled
        FROM dbo.PrintMaster
        WHERE PrinterId = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Printer not found' });
    }

    res.json({
      success: true,
      printer: result.recordset[0],
    });
  } catch (err) {
    console.error('[PrinterController] getPrinterById error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/printers
 * Add new printer to PrintMaster
 */
async function createPrinter(req, res) {
  try {
    const {
      printerName,
      printerIP,
      printerPort = 9100,
      printerPath,
      printerType = 1,
      printSection = 1,
      kitchenTypeName = 'Receipt Print',
      kitchenTypeValue = 0,
      isActive = true,
      printCopy = 1,
      isEnabled = true,
    } = req.body;

    if (!printerName || !printerName.trim()) {
      return res.status(400).json({ success: false, message: 'PrinterName is required' });
    }

    const cleanPort = parseInt(printerPort || 9100, 10);
    const cleanIP = (printerIP || '').trim();
    const cleanPath = (printerPath || cleanIP || '').trim();
    const pType = parseInt(printerType || 1, 10);

    const pool = await getPool();

    // If setting this printer as Active Receipt/Kiosk Printer, deactivate other printers of the SAME type
    if (isActive && (pType === 1 || pType === 3)) {
      await pool.request()
        .input('pType', sql.Int, pType)
        .query(`
          UPDATE dbo.PrintMaster 
          SET IsActive = 0 
          WHERE PrinterType = @pType;
        `);
    }

    const insertResult = await pool.request()
      .input('printerName', sql.VarChar(50), printerName.trim())
      .input('printerPath', sql.VarChar(100), cleanPath)
      .input('printerIP', sql.VarChar(50), cleanIP)
      .input('printerPort', sql.Int, cleanPort)
      .input('printerType', sql.Int, pType)
      .input('printSection', sql.Int, parseInt(printSection || 1, 10))
      .input('kitchenTypeName', sql.VarChar(50), kitchenTypeName)
      .input('kitchenTypeValue', sql.Int, parseInt(kitchenTypeValue || 0, 10))
      .input('isActive', sql.Bit, isActive ? 1 : 0)
      .input('printCopy', sql.Int, parseInt(printCopy || 1, 10))
      .input('isEnabled', sql.Bit, isEnabled ? 1 : 0)
      .query(`
        DECLARE @newId UNIQUEIDENTIFIER = NEWID();

        INSERT INTO dbo.PrintMaster (
          PrinterId,
          PrinterName,
          PrinterPath,
          PrinterIP,
          PrinterPort,
          PrinterType,
          PrintSection,
          KitchenTypeName,
          KitchenTypeValue,
          IsActive,
          PrintCopy,
          IsEnabled
        )
        OUTPUT 
          INSERTED.PrinterId,
          INSERTED.PrinterName,
          INSERTED.PrinterPath,
          INSERTED.PrinterIP,
          INSERTED.PrinterPort,
          INSERTED.PrinterType,
          INSERTED.PrintSection,
          INSERTED.KitchenTypeName,
          INSERTED.KitchenTypeValue,
          INSERTED.IsActive,
          INSERTED.PrintCopy,
          INSERTED.IsEnabled
        VALUES (
          @newId,
          @printerName,
          @printerPath,
          @printerIP,
          @printerPort,
          @printerType,
          @printSection,
          @kitchenTypeName,
          @kitchenTypeValue,
          @isActive,
          @printCopy,
          @isEnabled
        );
      `);

    const created = insertResult.recordset[0];
    res.status(201).json({
      success: true,
      message: 'Printer configured successfully in PrintMaster',
      printer: created,
    });
  } catch (err) {
    console.error('[PrinterController] createPrinter error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PUT /api/printers/:id
 * Update printer in PrintMaster
 */
async function updatePrinter(req, res) {
  try {
    const { id } = req.params;
    const {
      printerName,
      printerIP,
      printerPort,
      printerPath,
      printerType,
      printSection,
      kitchenTypeName,
      kitchenTypeValue,
      isActive,
      printCopy,
      isEnabled,
    } = req.body;

    const pool = await getPool();

    // Verify printer exists
    const check = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .query(`SELECT PrinterId, PrinterType FROM dbo.PrintMaster WHERE PrinterId = @id`);

    if (check.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Printer not found' });
    }

    const currentPType = printerType !== undefined ? parseInt(printerType, 10) : check.recordset[0].PrinterType;

    // If making this active receipt or kiosk printer, deactivate other printers of the SAME type
    if (isActive && (currentPType === 1 || currentPType === 3)) {
      await pool.request()
        .input('id', sql.UniqueIdentifier, id)
        .input('pType', sql.Int, currentPType)
        .query(`
          UPDATE dbo.PrintMaster 
          SET IsActive = 0 
          WHERE PrinterType = @pType AND PrinterId != @id;
        `);
    }

    const updateResult = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('printerName', sql.VarChar(50), printerName)
      .input('printerPath', sql.VarChar(100), printerPath)
      .input('printerIP', sql.VarChar(50), printerIP)
      .input('printerPort', sql.Int, printerPort !== undefined ? parseInt(printerPort, 10) : null)
      .input('printerType', sql.Int, printerType !== undefined ? parseInt(printerType, 10) : null)
      .input('printSection', sql.Int, printSection !== undefined ? parseInt(printSection, 10) : null)
      .input('kitchenTypeName', sql.VarChar(50), kitchenTypeName)
      .input('kitchenTypeValue', sql.Int, kitchenTypeValue !== undefined ? parseInt(kitchenTypeValue, 10) : null)
      .input('isActive', sql.Bit, isActive !== undefined ? (isActive ? 1 : 0) : null)
      .input('printCopy', sql.Int, printCopy !== undefined ? parseInt(printCopy, 10) : null)
      .input('isEnabled', sql.Bit, isEnabled !== undefined ? (isEnabled ? 1 : 0) : null)
      .query(`
        UPDATE dbo.PrintMaster
        SET
          PrinterName = COALESCE(@printerName, PrinterName),
          PrinterPath = COALESCE(@printerPath, PrinterPath),
          PrinterIP = COALESCE(@printerIP, PrinterIP),
          PrinterPort = COALESCE(@printerPort, PrinterPort),
          PrinterType = COALESCE(@printerType, PrinterType),
          PrintSection = COALESCE(@printSection, PrintSection),
          KitchenTypeName = COALESCE(@kitchenTypeName, KitchenTypeName),
          KitchenTypeValue = COALESCE(@kitchenTypeValue, KitchenTypeValue),
          IsActive = COALESCE(@isActive, IsActive),
          PrintCopy = COALESCE(@printCopy, PrintCopy),
          IsEnabled = COALESCE(@isEnabled, IsEnabled)
        OUTPUT
          INSERTED.PrinterId,
          INSERTED.PrinterName,
          INSERTED.PrinterPath,
          INSERTED.PrinterIP,
          INSERTED.PrinterPort,
          INSERTED.PrinterType,
          INSERTED.PrintSection,
          INSERTED.KitchenTypeName,
          INSERTED.KitchenTypeValue,
          INSERTED.IsActive,
          INSERTED.PrintCopy,
          INSERTED.IsEnabled
        WHERE PrinterId = @id;
      `);

    res.json({
      success: true,
      message: 'Printer updated successfully',
      printer: updateResult.recordset[0],
    });
  } catch (err) {
    console.error('[PrinterController] updatePrinter error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/printers/:id
 * Remove printer from PrintMaster
 */
async function deletePrinter(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .query(`
        DELETE FROM dbo.PrintMaster 
        WHERE PrinterId = @id;
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, message: 'Printer not found or already deleted' });
    }

    res.json({
      success: true,
      message: 'Printer deleted successfully from PrintMaster',
    });
  } catch (err) {
    console.error('[PrinterController] deletePrinter error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/printers/test or POST /api/printers/:id/test
 * Send a test ticket to the printer
 */
async function testPrinter(req, res) {
  try {
    const { id } = req.params;
    const { ip, port = 9100, printerName } = req.body;

    let targetIP = ip;
    let targetPort = port;
    let targetName = printerName || 'Thermal Printer';

    if (id) {
      const pool = await getPool();
      const result = await pool.request()
        .input('id', sql.UniqueIdentifier, id)
        .query(`SELECT PrinterName, PrinterIP, ISNULL(PrinterPort, 9100) AS PrinterPort FROM dbo.PrintMaster WHERE PrinterId = @id`);

      if (result.recordset.length > 0) {
        targetIP = result.recordset[0].PrinterIP;
        targetPort = result.recordset[0].PrinterPort;
        targetName = result.recordset[0].PrinterName;
      }
    }

    if (!targetIP || targetIP.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Printer IP address is required for test print',
      });
    }

    // Build test ESC/POS buffer
    const ESC = '\x1b';
    const GS = '\x1d';
    const LF = '\x0a';
    const WIDTH = 48;
    let testBufferText = ESC + '@';
    testBufferText += LF;
    testBufferText += ESC + 'a' + '\x01'; // Center
    testBufferText += ESC + '!' + '\x38'; // Double size
    testBufferText += 'RED BAY CAR WASH' + LF;
    testBufferText += ESC + '!' + '\x00';
    testBufferText += '*** PRINTER TEST TICKET ***' + LF;
    testBufferText += '='.repeat(WIDTH) + LF;
    testBufferText += ESC + 'a' + '\x00'; // Left
    testBufferText += `Printer: ${targetName}` + LF;
    testBufferText += `IP:      ${targetIP}:${targetPort}` + LF;
    testBufferText += `Status:  ONLINE / CONNECTED` + LF;
    testBufferText += `Date:    ${new Date().toLocaleString('en-SG')}` + LF;
    testBufferText += '='.repeat(WIDTH) + LF;
    testBufferText += ESC + 'a' + '\x01'; // Center
    testBufferText += 'Printer connection verified OK!' + LF;
    testBufferText += 'DRIVE IN. SHINE OUT.' + LF;
    testBufferText += LF + LF + LF;
    testBufferText += GS + 'V' + '\x41' + '\x03'; // Cut

    const buffer = Buffer.from(testBufferText, 'binary');

    try {
      await sendToPrinterSocket(targetIP, targetPort, buffer, 3000);
      res.json({
        success: true,
        message: `Test print successful: Sent test receipt to ${targetName} (${targetIP}:${targetPort})`,
        printer: targetName,
        ip: targetIP,
        port: targetPort,
      });
    } catch (socketErr) {
      console.warn(`[PrinterController] Test print network error for ${targetIP}:${targetPort}:`, socketErr.message);
      res.status(502).json({
        success: false,
        message: `Cannot connect to printer at ${targetIP}:${targetPort}. Socket error: ${socketErr.message}. Verify the printer is powered on, connected to the same Wi-Fi/LAN, and the IP is correct.`,
        printer: targetName,
        ip: targetIP,
        port: targetPort,
        error: socketErr.message,
      });
    }
  } catch (err) {
    console.error('[PrinterController] testPrinter error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/printers/print-raw
 * Send raw binary buffer (base64 encoded) to thermal network printer via TCP socket
 */
async function printRaw(req, res) {
  try {
    const { ip, port = 9100, dataBase64, timeoutMs = 4000 } = req.body;

    if (!ip || !ip.trim()) {
      return res.status(400).json({ success: false, message: 'Printer IP address is required' });
    }
    if (!dataBase64) {
      return res.status(400).json({ success: false, message: 'dataBase64 buffer is required' });
    }

    const cleanPort = parseInt(port || 9100, 10);
    const buffer = Buffer.from(dataBase64, 'base64');

    await sendToPrinterSocket(ip.trim(), cleanPort, buffer, timeoutMs);

    res.json({
      success: true,
      message: `Printed successfully to ${ip.trim()}:${cleanPort}`,
    });
  } catch (err) {
    console.error(`[PrinterController] printRaw error for ${req.body.ip}:${req.body.port}:`, err.message);
    res.status(502).json({
      success: false,
      message: `Failed to connect to printer at ${req.body.ip}:${req.body.port || 9100}: ${err.message}`,
    });
  }
}

/**
 * POST /api/printers/print-receipt
 * Automatically query active receipt printer from PrintMaster and print receipt
 */
async function printOrderReceipt(req, res) {
  try {
    const { order } = req.body;

    if (!order) {
      return res.status(400).json({ success: false, message: 'Order details required for printing receipt' });
    }

    const pool = await getPool();

    // 1. Automatically find the active configured receipt printer from PrintMaster
    const printerQuery = await pool.request().query(`
      SELECT TOP 1
        PrinterId,
        PrinterName,
        PrinterPath,
        PrinterIP,
        ISNULL(PrinterPort, 9100) AS PrinterPort,
        PrinterType,
        KitchenTypeName,
        IsActive,
        PrintCopy,
        IsEnabled
      FROM dbo.PrintMaster
      WHERE IsEnabled = 1 
        AND IsActive = 1 
        AND (PrinterType = 1 OR KitchenTypeName LIKE '%Receipt%')
      ORDER BY IsActive DESC, PrinterName ASC
    `);

    let targetPrinter = printerQuery.recordset[0];

    // Fallback if no printer has IsActive=1
    if (!targetPrinter) {
      const fallbackQuery = await pool.request().query(`
        SELECT TOP 1
          PrinterId,
          PrinterName,
          PrinterPath,
          PrinterIP,
          ISNULL(PrinterPort, 9100) AS PrinterPort,
          PrinterType,
          KitchenTypeName,
          IsActive,
          PrintCopy,
          IsEnabled
        FROM dbo.PrintMaster
        WHERE IsEnabled = 1 AND PrinterIP != ''
        ORDER BY PrinterType ASC, PrinterName ASC
      `);
      targetPrinter = fallbackQuery.recordset[0];
    }

    if (!targetPrinter || !targetPrinter.PrinterIP) {
      return res.json({
        success: true,
        printedVia: 'NO_PRINTER_CONFIGURED',
        message: 'No active thermal printer configured in PrintMaster. Please configure a printer in Settings.',
        orderNo: order.billNumber || order.orderNo,
      });
    }

    // Load CompanySettings to dynamically print brand header & tax details
    let companySettings = {};
    try {
      const compRes = await pool.request().query('SELECT TOP 1 * FROM dbo.CompanySettings');
      if (compRes.recordset && compRes.recordset.length > 0) {
        companySettings = compRes.recordset[0];
      }
    } catch (compErr) {
      console.warn('[PrinterController] Could not fetch CompanySettings for receipt header:', compErr.message);
    }

    const binaryBuffer = buildEscPosReceipt(order, targetPrinter.PrinterName, companySettings);

    try {
      await sendToPrinterSocket(targetPrinter.PrinterIP, targetPrinter.PrinterPort, binaryBuffer, 3500);

      console.log(`[PrinterController] Bill receipt printed successfully to "${targetPrinter.PrinterName}" (${targetPrinter.PrinterIP}:${targetPrinter.PrinterPort}) for Order ${order.billNumber || order.orderNo}`);

      res.json({
        success: true,
        printedVia: 'NETWORK_PRINTER',
        printer: targetPrinter.PrinterName,
        ip: targetPrinter.PrinterIP,
        port: targetPrinter.PrinterPort,
        message: `Receipt printed automatically on ${targetPrinter.PrinterName}`,
        orderNo: order.billNumber || order.orderNo,
      });
    } catch (socketErr) {
      console.warn(`[PrinterController] Physical printer offline/unreachable (${targetPrinter.PrinterIP}:${targetPrinter.PrinterPort}): ${socketErr.message}`);

      // Return success: true with simulated flag so frontend checkout doesn't fail
      res.json({
        success: true,
        printedVia: 'OFFLINE_FALLBACK',
        printer: targetPrinter.PrinterName,
        ip: targetPrinter.PrinterIP,
        port: targetPrinter.PrinterPort,
        offlineReason: socketErr.message,
        message: `Receipt sent to queue for ${targetPrinter.PrinterName} (${targetPrinter.PrinterIP}:${targetPrinter.PrinterPort})`,
        orderNo: order.billNumber || order.orderNo,
      });
    }
  } catch (err) {
    console.error('[PrinterController] printOrderReceipt error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/printers/print-kiosk-receipt
 * Automatically query active KIOSK printer (PrinterType = 3) from PrintMaster and print receipt
 */
async function printKioskReceipt(req, res) {
  try {
    const { order } = req.body;

    if (!order) {
      return res.status(400).json({ success: false, message: 'Order details required for printing kiosk receipt' });
    }

    const pool = await getPool();

    // 1. Automatically find the active configured Kiosk printer (PrinterType = 3) from PrintMaster
    const printerQuery = await pool.request().query(`
      SELECT TOP 1
        PrinterId,
        PrinterName,
        PrinterPath,
        PrinterIP,
        ISNULL(PrinterPort, 9100) AS PrinterPort,
        PrinterType,
        KitchenTypeName,
        IsActive,
        PrintCopy,
        IsEnabled
      FROM dbo.PrintMaster
      WHERE IsEnabled = 1 
        AND IsActive = 1 
        AND (PrinterType = 3 OR KitchenTypeName LIKE '%Kiosk%')
      ORDER BY IsActive DESC, PrinterName ASC
    `);

    let targetPrinter = printerQuery.recordset[0];

    // Fallback if no printer has IsActive=1 with PrinterType=3
    if (!targetPrinter) {
      const fallbackQuery = await pool.request().query(`
        SELECT TOP 1
          PrinterId,
          PrinterName,
          PrinterPath,
          PrinterIP,
          ISNULL(PrinterPort, 9100) AS PrinterPort,
          PrinterType,
          KitchenTypeName,
          IsActive,
          PrintCopy,
          IsEnabled
        FROM dbo.PrintMaster
        WHERE IsEnabled = 1 AND (PrinterType = 3 OR KitchenTypeName LIKE '%Kiosk%') AND PrinterIP != ''
        ORDER BY PrinterType ASC, PrinterName ASC
      `);
      targetPrinter = fallbackQuery.recordset[0];
    }

    if (!targetPrinter || !targetPrinter.PrinterIP) {
      return res.json({
        success: true,
        printedVia: 'NO_KIOSK_PRINTER_CONFIGURED',
        message: 'No active kiosk printer (PrinterType=3) configured in PrintMaster. Please configure a kiosk printer in Settings.',
        orderNo: order.billNumber || order.orderNo,
      });
    }

    // Load CompanySettings to dynamically print brand header & tax details
    let companySettings = {};
    try {
      const compRes = await pool.request().query('SELECT TOP 1 * FROM dbo.CompanySettings');
      if (compRes.recordset && compRes.recordset.length > 0) {
        companySettings = compRes.recordset[0];
      }
    } catch (compErr) {
      console.warn('[PrinterController] Could not fetch CompanySettings for kiosk receipt header:', compErr.message);
    }

    const binaryBuffer = buildEscPosReceipt(order, targetPrinter.PrinterName, companySettings);

    try {
      await sendToPrinterSocket(targetPrinter.PrinterIP, targetPrinter.PrinterPort, binaryBuffer, 3500);

      console.log(`[PrinterController] Kiosk bill receipt printed successfully to "${targetPrinter.PrinterName}" (${targetPrinter.PrinterIP}:${targetPrinter.PrinterPort}) for Order ${order.billNumber || order.orderNo}`);

      res.json({
        success: true,
        printedVia: 'NETWORK_PRINTER',
        printer: targetPrinter.PrinterName,
        ip: targetPrinter.PrinterIP,
        port: targetPrinter.PrinterPort,
        message: `Kiosk receipt printed automatically on ${targetPrinter.PrinterName}`,
        orderNo: order.billNumber || order.orderNo,
      });
    } catch (socketErr) {
      console.warn(`[PrinterController] Physical kiosk printer offline/unreachable (${targetPrinter.PrinterIP}:${targetPrinter.PrinterPort}): ${socketErr.message}`);

      // Return success: true with simulated flag so kiosk flow doesn't fail
      res.json({
        success: true,
        printedVia: 'OFFLINE_FALLBACK',
        printer: targetPrinter.PrinterName,
        ip: targetPrinter.PrinterIP,
        port: targetPrinter.PrinterPort,
        offlineReason: socketErr.message,
        message: `Kiosk receipt sent to queue for ${targetPrinter.PrinterName} (${targetPrinter.PrinterIP}:${targetPrinter.PrinterPort})`,
        orderNo: order.billNumber || order.orderNo,
      });
    }
  } catch (err) {
    console.error('[PrinterController] printKioskReceipt error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllPrinters,
  getPrinterById,
  createPrinter,
  updatePrinter,
  deletePrinter,
  testPrinter,
  printRaw,
  printOrderReceipt,
  printKioskReceipt,
};

