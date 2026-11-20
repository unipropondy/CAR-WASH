// Backend/routes/yeahpay.js

const express = require('express');
const router = express.Router();
const YeahPayService = require('../services/yeahpay.service');  // ✅ Class
const sql = require('mssql');
const { getPool } = require('../config/db');

const FIXED_APP_ID = process.env.APP_ID || process.env.YEAPAY_APP_ID || 'bin38m42efz4ta6f';

// ✅ CREATE INSTANCE with config
const yeahpayService = new YeahPayService();

function broadcastTerminalStatus(io, tableId, amount, isCard, result, isSplit, splitRowId) {
    if (!io) return;
    const targetTableId = tableId || "COUNTER";
    
    let status = "failed";
    let message = "";
    const responseCode = result.code;
    
    if (result.success || responseCode === 0) {
        status = "success";
        message = `✅ $${parseFloat(amount).toFixed(2)} paid successfully`;
    } else if (responseCode === -1027) {
        status = "cancelled";
        message = `❌ Transaction cancelled on terminal`;
    } else if (responseCode === -1028 || responseCode === -1008) {
        status = "failed";
        message = `⏰ Transaction timeout`;
    } else {
        status = "failed";
        message = `❌ ${result.msg || result.error || 'Payment declined'}`;
    }

    console.log(`🔌 [Server] Broadcasting terminal sync for Table ${targetTableId} → Status: ${status}`);
    io.emit("terminal_payment_sync", {
        tableId: targetTableId,
        session: {
            tableId: targetTableId,
            status,
            message,
            method: isCard ? 'YEAHPAY CARD' : 'YEAHPAY PAYNOW',
            total: parseFloat(amount) || 0,
            isSplit: !!isSplit,
            splitRowId
        }
    });
}

/**
 * Helper to update Car Wash Order in dbo.CarWashOrder upon successful payment
 */
async function updateCarWashOrderPaid(orderId, payMode, paymentRef, cashierName = 'CASHIER') {
    if (!orderId) return null;
    const numericOrderId = parseInt(orderId, 10);
    if (!numericOrderId || isNaN(numericOrderId)) return null;

    try {
        const pool = await getPool();
        const checkRes = await pool.request()
            .input('orderId', sql.Int, numericOrderId)
            .query(`SELECT TOP 1 OrderId, StatusCode FROM dbo.CarWashOrder WITH (NOLOCK) WHERE OrderId = @orderId;`);

        if (!checkRes.recordset.length) return null;
        const currentCode = checkRes.recordset[0].StatusCode;
        const targetCode = currentCode < 30 ? 30 : currentCode;

        await pool.request()
            .input('orderId', sql.Int, numericOrderId)
            .input('payMode', sql.Char(10), payMode)
            .input('paymentRef', sql.NVarChar(100), paymentRef)
            .input('statusCode', sql.Int, targetCode)
            .input('changedBy', sql.NVarChar(50), cashierName)
            .query(`
                UPDATE dbo.CarWashOrder
                SET 
                    PaymentStatus = 'PAID',
                    StatusCode = @statusCode,
                    PayMode = @payMode,
                    PaymentReference = @paymentRef,
                    PaidDate = ISNULL(PaidDate, GETDATE()),
                    ModifiedBy = @changedBy,
                    ModifiedDate = GETDATE()
                WHERE OrderId = @orderId;
            `);

        console.log(`[YeahPay] Successfully updated CarWashOrder #${numericOrderId} to PAID (StatusCode: ${targetCode})`);
        return targetCode;
    } catch (dbErr) {
        console.error('[YeahPay Order Update Error]:', dbErr.message);
        return null;
    }
}

/**
 * Helper to resolve deviceSn and salt from dbo.Paymode if missing
 */
async function resolveDeviceDetails(requestedDeviceSn, requestedSalt, payMode) {
    let deviceSn = requestedDeviceSn;
    let salt = requestedSalt;

    if (!deviceSn) {
        try {
            const pool = await getPool();
            const pmRes = await pool.request()
                .input('payMode', sql.VarChar(50), payMode || '')
                .query(`
                    SELECT TOP 1 DeviceSN, DeviceSalt, YeahPayEnabled 
                    FROM dbo.Paymode WITH (NOLOCK)
                    WHERE ISNULL(YeahPayEnabled, 0) = 1
                    ORDER BY CASE WHEN RTRIM(UPPER(PayMode)) = UPPER(@payMode) THEN 0 ELSE 1 END;
                `);

            if (pmRes.recordset.length > 0) {
                const row = pmRes.recordset[0];
                deviceSn = deviceSn || (row.DeviceSN || '').trim();
                salt = salt || (row.DeviceSalt || '').trim();
            }
        } catch (e) {
            console.warn('[YeahPay Device Resolve Warning]:', e.message);
        }
    }

    return {
        deviceSn: deviceSn || process.env.YEAPAY_DEVICE_SN || '',
        salt: salt || process.env.YEAPAY_SALT || ''
    };
}

// 1. YeahPay PayNow Payment
router.post('/paynow-payment', async (req, res) => {
    try {
        let { amount, deviceSn, salt, tableId, orderId, isSplit, splitRowId, cashierName } = req.body;
        
        // Resolve order amount if orderId provided but amount missing
        if (orderId && (!amount || isNaN(amount))) {
            const pool = await getPool();
            const ord = await pool.request()
                .input('orderId', sql.Int, parseInt(orderId, 10))
                .query('SELECT TOP 1 TotalAmount FROM dbo.CarWashOrder WITH (NOLOCK) WHERE OrderId = @orderId;');
            if (ord.recordset.length) {
                amount = ord.recordset[0].TotalAmount;
            }
        }

        const resolved = await resolveDeviceDetails(deviceSn, salt, 'YEAHPAY_QR');
        deviceSn = resolved.deviceSn;
        salt = resolved.salt;

        console.log('📱 YeahPay PayNow:', { amount, deviceSn, salt: salt ? 'Yes' : 'No', tableId, orderId });
        
        if (!deviceSn) {
            return res.status(400).json({ 
                success: false, 
                code: -1, 
                msg: 'DeviceSN is required (configure in dbo.Paymode or pass in request)' 
            });
        }
        
        if (!amount || isNaN(amount)) {
            return res.status(400).json({
                success: false,
                code: -1,
                msg: 'Valid amount is required'
            });
        }

        // ✅ Call method on INSTANCE
        const result = await yeahpayService.processPayNowPayment({
            amount, 
            deviceSn, 
            salt, 
            appId: FIXED_APP_ID
        });
        
        // Extract or construct dynamic PayNow SGQR data
        const qrCodeData = result.data?.tradeScanPaymentResponse?.qrCode 
            || result.data?.tradeScanPaymentResponse?.codeUrl 
            || result.data?.qrCode 
            || result.data?.codeUrl
            || `00020101021226500009SG.PAYNOW01012021620240901234567803010520458125303702540${parseFloat(amount).toFixed(2)}5802SG5915RED BAY CARWASH6009SINGAPORE62190115${result.bizOrderId}6304`;
            
        result.qrCode = qrCodeData;
        result.qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=${encodeURIComponent(qrCodeData)}`;

        console.log('📤 YeahPay PayNow Result:', result);
        
        // Broadcast status via socket if attached
        const io = req.io || req.app?.get('io');
        broadcastTerminalStatus(io, tableId || orderId, amount, false, result, isSplit, splitRowId);
        
        // Update database if orderId exists
        if ((result.success || result.code === 0) && orderId) {
            await updateCarWashOrderPaid(orderId, 'YEAHPAY_QR', result.bizOrderId, cashierName);
        }

        res.json(result);
    } catch (error) {
        console.error('❌ YeahPay PayNow Error:', error);
        
        const failResult = { success: false, code: -1, msg: error.message };
        const io = req.io || req.app?.get('io');
        broadcastTerminalStatus(io, req.body.tableId || req.body.orderId, req.body.amount, false, failResult, req.body.isSplit, req.body.splitRowId);
        
        res.status(500).json(failResult);
    }
});

// 2. YeahPay Card Payment
router.post('/card-payment', async (req, res) => {
    try {
        let { amount, deviceSn, salt, tableId, orderId, isSplit, splitRowId, cashierName } = req.body;
        
        // Resolve order amount if orderId provided but amount missing
        if (orderId && (!amount || isNaN(amount))) {
            const pool = await getPool();
            const ord = await pool.request()
                .input('orderId', sql.Int, parseInt(orderId, 10))
                .query('SELECT TOP 1 TotalAmount FROM dbo.CarWashOrder WITH (NOLOCK) WHERE OrderId = @orderId;');
            if (ord.recordset.length) {
                amount = ord.recordset[0].TotalAmount;
            }
        }

        const resolved = await resolveDeviceDetails(deviceSn, salt, 'YEAHPAY_CARD');
        deviceSn = resolved.deviceSn;
        salt = resolved.salt;

        console.log('💳 YeahPay Card:', { amount, deviceSn, tableId, orderId });
        
        if (!deviceSn) {
            return res.status(400).json({ 
                success: false, 
                code: -1, 
                msg: 'DeviceSN is required (configure in dbo.Paymode or pass in request)' 
            });
        }

        if (!amount || isNaN(amount)) {
            return res.status(400).json({
                success: false,
                code: -1,
                msg: 'Valid amount is required'
            });
        }
        
        // ✅ Call method on INSTANCE
        const result = await yeahpayService.processCardPayment({
            amount, 
            deviceSn, 
            salt, 
            appId: FIXED_APP_ID
        });
        
        console.log('📤 YeahPay Card Result:', result);

        // Broadcast status via socket if attached
        const io = req.io || req.app?.get('io');
        broadcastTerminalStatus(io, tableId || orderId, amount, true, result, isSplit, splitRowId);
        
        // Update database if orderId exists
        if ((result.success || result.code === 0) && orderId) {
            await updateCarWashOrderPaid(orderId, 'YEAHPAY_CARD', result.bizOrderId, cashierName);
        }

        res.json(result);
    } catch (error) {
        console.error('❌ YeahPay Card Error:', error);

        const failResult = { success: false, code: -1, msg: error.message };
        const io = req.io || req.app?.get('io');
        broadcastTerminalStatus(io, req.body.tableId || req.body.orderId, req.body.amount, true, failResult, req.body.isSplit, req.body.splitRowId);
        
        res.status(500).json(failResult);
    }
});

// 3. Unified POS endpoint (supports both YEAHPAY_QR and YEAHPAY_CARD)
router.post('/process-payment', async (req, res) => {
    const { payMode } = req.body || {};
    const isCard = String(payMode).toUpperCase().includes('CARD');
    if (isCard) {
        return router.handle(Object.assign(req, { url: '/card-payment' }), res);
    } else {
        return router.handle(Object.assign(req, { url: '/paynow-payment' }), res);
    }
});

module.exports = router;
