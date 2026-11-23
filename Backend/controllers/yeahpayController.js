const sql = require('mssql');
const { getPool } = require('../config/db');
const YeahPayService = require('../services/yeahpay.service');

const FIXED_APP_ID = process.env.APP_ID || process.env.YEAPAY_APP_ID || 'bin38m42efz4ta6f';

// Single shared YeahPayService instance using embedded public and private keys
const yeahpayService = new YeahPayService();

/**
 * POST /api/carwash/payments/yeahpay
 * Initiates payment on the YeahPay Smart POS Terminal for a car wash order
 */
async function processOrderPayment(req, res) {
  try {
    const { orderId, payMode = 'YEAHPAY_QR', cashierName = 'CASHIER' } = req.body || {};
    const numericOrderId = parseInt(orderId, 10);

    if (!numericOrderId || isNaN(numericOrderId)) {
      return res.status(400).json({ success: false, message: 'Valid Order ID is required' });
    }

    const pool = await getPool();

    // 1. Fetch Order details from dbo.CarWashOrder
    const orderRes = await pool.request()
      .input('orderId', sql.Int, numericOrderId)
      .query(`
        SELECT TOP 1 
          OrderId, 
          OrderNo, 
          CustomerName, 
          VehicleNumber, 
          TotalAmount, 
          PaymentStatus, 
          StatusCode,
          DayId
        FROM dbo.CarWashOrder WITH (NOLOCK)
        WHERE OrderId = @orderId;
      `);

    if (!orderRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Car wash order not found' });
    }

    const order = orderRes.recordset[0];

    if (order.PaymentStatus === 'PAID') {
      return res.status(400).json({ success: false, message: 'This order has already been paid' });
    }

    if (order.StatusCode === 80 || order.PaymentStatus === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot process payment for a cancelled order' });
    }

    // 2. Fetch Terminal DeviceSN and DeviceSalt from dbo.Paymode
    const paymodeRes = await pool.request()
      .input('payMode', sql.VarChar(50), payMode)
      .query(`
        SELECT TOP 1 DeviceSN, DeviceSalt, YeahPayEnabled 
        FROM dbo.Paymode WITH (NOLOCK)
        WHERE RTRIM(UPPER(PayMode)) = UPPER(@payMode) 
           OR YeahPayEnabled = 1
        ORDER BY CASE WHEN RTRIM(UPPER(PayMode)) = UPPER(@payMode) THEN 0 ELSE 1 END;
      `);

    const pmRow = paymodeRes.recordset[0] || {};
    const deviceSn = (pmRow.DeviceSN || '').trim();
    const salt = (pmRow.DeviceSalt || '').trim();

    if (!deviceSn) {
      return res.status(400).json({
        success: false,
        message: 'No active YeahPay terminal DeviceSN configured in dbo.Paymode'
      });
    }

    // 3. Determine YeahPay method
    const isCard = String(payMode).toUpperCase().includes('CARD');
    const amount = Number(order.TotalAmount).toFixed(2);
    const bizOrderId = `CW_${order.OrderNo || order.OrderId}_${Date.now().toString().slice(-5)}`;

    console.log(`[YeahPay] Dispatching ${isCard ? 'CARD' : 'PAYNOW'} to Terminal ${deviceSn} for Order #${order.OrderId} ($${amount})`);

    // 4. Send request via YeahPayService instance
    let result;
    if (isCard) {
      result = await yeahpayService.processCardPayment({
        amount,
        deviceSn,
        salt,
        appId: FIXED_APP_ID,
        bizOrderId
      });
    } else {
      result = await yeahpayService.processPayNowPayment({
        amount,
        deviceSn,
        salt,
        appId: FIXED_APP_ID,
        bizOrderId
      });
    }

    if (result.success || result.code === 0) {
      // 5. Update dbo.CarWashOrder to PAID (StatusCode 30 = WAITING_ASSIGN)
      const targetStatusCode = order.StatusCode < 30 ? 30 : order.StatusCode;

      await pool.request()
        .input('orderId', sql.Int, numericOrderId)
        .input('payMode', sql.Char(10), payMode)
        .input('paymentRef', sql.NVarChar(100), result.bizOrderId || bizOrderId)
        .input('statusCode', sql.Int, targetStatusCode)
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

      // 6. Record Audit History if dbo.CarWashOrderHistory table exists
      try {
        await pool.request()
          .input('orderId', sql.Int, numericOrderId)
          .input('oldCode', sql.Int, order.StatusCode)
          .input('oldName', sql.NVarChar(50), 'DETAILS_SAVED')
          .input('newCode', sql.Int, targetStatusCode)
          .input('newName', sql.NVarChar(50), 'PAID')
          .input('remarks', sql.NVarChar(255), `YeahPay payment success: ${bizOrderId} via ${payMode}`)
          .input('changedBy', sql.NVarChar(50), cashierName)
          .query(`
            IF OBJECT_ID('dbo.CarWashOrderHistory', 'U') IS NOT NULL
            BEGIN
              INSERT INTO dbo.CarWashOrderHistory (
                OrderId, OldStatusCode, OldStatusName, NewStatusCode, NewStatusName, Remarks, ChangedBy, ChangedDate
              ) VALUES (
                @orderId, @oldCode, @oldName, @newCode, @newName, @remarks, @changedBy, GETDATE()
              )
            END
          `);
      } catch (histErr) {
        console.warn('[YeahPay History Warning]:', histErr.message);
      }

      return res.json({
        success: true,
        code: 0,
        message: 'Payment confirmed successfully via YeahPay Terminal',
        bizOrderId: result.bizOrderId || bizOrderId,
        orderId: numericOrderId,
        statusCode: targetStatusCode,
        data: result.data
      });
    } else {
      let friendlyMsg = result.msg || 'Payment failed';
      if (result.code === -1027) friendlyMsg = 'Transaction cancelled on the terminal.';
      if (result.code === -1028 || result.code === -1008) friendlyMsg = 'Transaction timed out on the terminal.';

      return res.status(400).json({
        success: false,
        code: result.code,
        message: friendlyMsg,
        data: result.data
      });
    }
  } catch (err) {
    console.error('[YeahPay Controller Error]:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message || 'Error communicating with YeahPay gateway'
    });
  }
}

module.exports = { processOrderPayment, yeahpayService };
