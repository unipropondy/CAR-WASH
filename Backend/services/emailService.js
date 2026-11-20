const nodemailer = require('nodemailer');
const { getPool } = require('../config/db');

/**
 * Core sendMail function
 * Attempts Hostinger REST Mail API first, falls back to SMTP via Nodemailer.
 */
async function sendMail({ to, subject, html, text, displayName = 'RedBay Car Wash' }) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!recipients.length) {
    throw new Error('No recipient email address specified.');
  }

  const apiKey = process.env.HOSTINGER_MAIL_API_KEY;
  const mailboxId = process.env.HOSTINGER_MAILBOX_RESOURCE_ID;
  const emailUser = process.env.EMAIL_USER || 'reports@uniprosg.com';
  const emailPass = process.env.EMAIL_PASS || 'zqdoliosuatgqtyu';
  const emailFrom = process.env.EMAIL_FROM || emailUser;

  // 1. Try Hostinger REST API
  if (apiKey && mailboxId) {
    try {
      const response = await fetch(`https://api.mail.hostinger.com/api/v1/mailboxes/${mailboxId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipients,
          displayName,
          subject,
          text: text || '',
          html: html || text || '',
        }),
      });

      if (response.ok) {
        console.log(`[EmailService] Email sent successfully via Hostinger REST API to: ${recipients.join(', ')}`);
        return { success: true, method: 'HOSTINGER_API', status: response.status };
      }

      const errText = await response.text();
      console.warn(`[EmailService] Hostinger API returned status ${response.status}: ${errText}. Falling back to SMTP...`);
    } catch (apiErr) {
      console.warn('[EmailService] Hostinger API failed, attempting SMTP fallback:', apiErr.message);
    }
  }

  // 2. Fallback to Nodemailer SMTP
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true, // SSL
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const info = await transporter.sendMail({
      from: `"${displayName}" <${emailFrom}>`,
      to: recipients.join(', '),
      subject,
      text: text || '',
      html: html || text || '',
    });

    console.log(`[EmailService] Email sent successfully via SMTP to ${recipients.join(', ')} (MessageId: ${info.messageId})`);
    return { success: true, method: 'SMTP', messageId: info.messageId };
  } catch (smtpErr) {
    console.error('[EmailService] SMTP send error:', smtpErr);
    throw new Error(`Failed to send email via both Hostinger API and SMTP: ${smtpErr.message}`);
  }
}

/**
 * Fetch configured report email from dbo.CompanySettings
 */
async function getReportRecipientEmail() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 1 ReportEmail, Email FROM dbo.CompanySettings;
    `);
    if (result.recordset.length > 0) {
      const row = result.recordset[0];
      return (row.ReportEmail || row.Email || '').trim();
    }
    return '';
  } catch (err) {
    console.error('[EmailService] Error fetching report email from CompanySettings:', err.message);
    return '';
  }
}

/**
 * Format currency number
 */
function fmtCurr(amount) {
  const num = Number(amount || 0);
  return '$' + num.toFixed(2);
}

/**
 * Format date nicely
 */
function fmtDate(d) {
  if (!d) return 'N/A';
  try {
    const dateObj = new Date(d);
    return dateObj.toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch (_) {
    return String(d);
  }
}

/**
 * Send Day End Report Email
 */
async function sendDayEndReportEmail(reportData, overrideRecipient = null) {
  try {
    const recipient = overrideRecipient || (await getReportRecipientEmail());
    if (!recipient) {
      console.log('[EmailService] No report email recipient configured in CompanySettings. Skipping Day End report email.');
      return { success: false, skipped: true, message: 'No recipient email configured in settings' };
    }

    const {
      dayId = 'N/A',
      businessDate = new Date().toISOString().slice(0, 10),
      startedBy = 'Staff Cashier',
      startedDate,
      endedBy = 'Staff Cashier',
      endedDate = new Date(),
      openingCash = 0,
      actualClosingCash = 0,
      expectedCash = 0,
      cashDifference = 0,
      totalOrders = 0,
      totalSales = 0,
      totalCustomerSales = 0,
      totalDealerSales = 0,
      cashSales = 0,
      cardSales = 0,
      onlineSales = 0,
      otherSales = 0,
      totalCashIn = 0,
      totalCashOut = 0,
      totalRefunds = 0,
      closingRemarks = '',
      tenders = [],
      packageBreakdown = [],
    } = reportData;

    const varianceLabel =
      cashDifference === 0
        ? '<span style="color: #16A34A; font-weight: bold;">BALANCED ($0.00)</span>'
        : cashDifference > 0
        ? `<span style="color: #2563EB; font-weight: bold;">SURPLUS (+${fmtCurr(cashDifference)})</span>`
        : `<span style="color: #DC2626; font-weight: bold;">SHORTAGE (${fmtCurr(cashDifference)})</span>`;

    // Tender rows
    const tenderRows = tenders && tenders.length > 0
      ? tenders.map(t => `
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 500;">${t.payMode || 'OTHER'}</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: center;">${t.count || 0}</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600;">${fmtCurr(t.amount)}</td>
        </tr>
      `).join('')
      : `
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0;">CASH</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: center;">-</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600;">${fmtCurr(cashSales)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0;">CARD</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: center;">-</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600;">${fmtCurr(cardSales)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0;">ONLINE / PAYNOW</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: center;">-</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600;">${fmtCurr(onlineSales)}</td>
        </tr>
      `;

    // Package rows
    const packageRows = packageBreakdown && packageBreakdown.length > 0
      ? packageBreakdown.map(p => `
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 500;">${p.PackageName || p.packageName || 'Wash Service'}</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: center;">${p.OrderCount || p.orderCount || 0}</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600;">${fmtCurr(p.TotalAmount || p.totalAmount)}</td>
        </tr>
      `).join('')
      : `
        <tr>
          <td colspan="3" style="padding: 12px 14px; text-align: center; color: #64748B;">No package breakdown available</td>
        </tr>
      `;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day End Business Report - RedBay Car Wash</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <div style="max-width: 680px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 28px 32px; color: #FFFFFF;">
      <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.9;">
        RED BAY CAR WASH • SYSTEM NOTIFICATION
      </div>
      <h1 style="margin: 8px 0 4px 0; font-size: 24px; font-weight: 800;">
        Daily End of Day Report
      </h1>
      <div style="font-size: 14px; opacity: 0.95;">
        Business Date: <strong>${businessDate}</strong> &nbsp;|&nbsp; Day #${dayId}
      </div>
    </div>

    <div style="padding: 28px 32px;">

      <!-- Session Meta Info -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #F1F5F9; border-radius: 8px; font-size: 13px;">
        <tr>
          <td style="padding: 10px 14px; color: #64748B;">Started By:</td>
          <td style="padding: 10px 14px; font-weight: 600;">${startedBy} (${fmtDate(startedDate)})</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; color: #64748B;">Closed By:</td>
          <td style="padding: 10px 14px; font-weight: 600;">${endedBy} (${fmtDate(endedDate)})</td>
        </tr>
        ${closingRemarks ? `
        <tr>
          <td style="padding: 10px 14px; color: #64748B;">Remarks:</td>
          <td style="padding: 10px 14px; font-weight: 500;">${closingRemarks}</td>
        </tr>` : ''}
      </table>

      <!-- Top KPI Summary Cards -->
      <table style="width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 24px;">
        <tr>
          <td style="width: 50%; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 12px; font-weight: 700; color: #1E40AF; text-transform: uppercase; letter-spacing: 0.5px;">TOTAL SALES REVENUE</div>
            <div style="font-size: 28px; font-weight: 800; color: #1E3A8A; margin-top: 4px;">${fmtCurr(totalSales)}</div>
            <div style="font-size: 12px; color: #3B82F6; margin-top: 2px;">Customer: ${fmtCurr(totalCustomerSales)} &nbsp;|&nbsp; Dealer: ${fmtCurr(totalDealerSales)}</div>
          </td>
          <td style="width: 50%; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">TOTAL VEHICLES WASHED</div>
            <div style="font-size: 28px; font-weight: 800; color: #14532D; margin-top: 4px;">${totalOrders}</div>
            <div style="font-size: 12px; color: #22C55E; margin-top: 2px;">Total completed wash orders</div>
          </td>
        </tr>
      </table>

      <!-- Cash Reconciliation Section -->
      <h3 style="font-size: 16px; font-weight: 700; margin: 24px 0 12px 0; color: #0F172A; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px;">
        💵 Cash Drawer Reconciliation
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
        <tr style="background: #F8FAFC;">
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0;">Opening Cash Float</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600;">${fmtCurr(openingCash)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0;">+ Cash Sales Received</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600; color: #16A34A;">+${fmtCurr(cashSales)}</td>
        </tr>
        <tr style="background: #F8FAFC;">
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0;">+ Cash In / Top-ups</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600;">+${fmtCurr(totalCashIn)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0;">- Cash Out / Expenses</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600; color: #DC2626;">-${fmtCurr(totalCashOut)}</td>
        </tr>
        ${totalRefunds > 0 ? `
        <tr style="background: #F8FAFC;">
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0;">- Cash Refunds</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600; color: #DC2626;">-${fmtCurr(totalRefunds)}</td>
        </tr>` : ''}
        <tr style="background: #F1F5F9; font-weight: 700;">
          <td style="padding: 12px 14px; border-top: 2px solid #CBD5E1; border-bottom: 1px solid #CBD5E1;">System Expected Cash</td>
          <td style="padding: 12px 14px; border-top: 2px solid #CBD5E1; border-bottom: 1px solid #CBD5E1; text-align: right; font-size: 15px;">${fmtCurr(expectedCash)}</td>
        </tr>
        <tr style="background: #FFFFFF; font-weight: 700;">
          <td style="padding: 12px 14px; border-bottom: 1px solid #CBD5E1;">Actual Counted Closing Cash</td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #CBD5E1; text-align: right; font-size: 15px;">${fmtCurr(actualClosingCash)}</td>
        </tr>
        <tr style="background: #FEF2F2; font-weight: 700;">
          <td style="padding: 12px 14px; border-bottom: 2px solid #F87171;">Cash Difference / Variance</td>
          <td style="padding: 12px 14px; border-bottom: 2px solid #F87171; text-align: right; font-size: 15px;">${varianceLabel}</td>
        </tr>
      </table>

      <!-- Tender / Payment Breakdown -->
      <h3 style="font-size: 16px; font-weight: 700; margin: 24px 0 12px 0; color: #0F172A; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px;">
        💳 Payment Methods Breakdown
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
        <thead>
          <tr style="background: #F1F5F9; color: #475569; font-size: 12px; text-transform: uppercase;">
            <th style="padding: 10px 14px; text-align: left;">Payment Method</th>
            <th style="padding: 10px 14px; text-align: center;">Transactions</th>
            <th style="padding: 10px 14px; text-align: right;">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          ${tenderRows}
        </tbody>
      </table>

      <!-- Services & Packages Breakdown -->
      <h3 style="font-size: 16px; font-weight: 700; margin: 24px 0 12px 0; color: #0F172A; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px;">
        🚿 Packages & Services Breakdown
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
        <thead>
          <tr style="background: #F1F5F9; color: #475569; font-size: 12px; text-transform: uppercase;">
            <th style="padding: 10px 14px; text-align: left;">Package / Service</th>
            <th style="padding: 10px 14px; text-align: center;">Wash Count</th>
            <th style="padding: 10px 14px; text-align: right;">Sales Total</th>
          </tr>
        </thead>
        <tbody>
          ${packageRows}
        </tbody>
      </table>

      <div style="background-color: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; padding: 14px; font-size: 12px; color: #64748B; text-align: center;">
        This is an automated operational report generated by <strong>RedBay Car Wash POS System</strong> upon day end closing.
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
REDBAY CAR WASH - DAILY END OF DAY REPORT
==========================================
Business Date: ${businessDate}
Day ID: #${dayId}
Started By: ${startedBy} (${fmtDate(startedDate)})
Closed By: ${endedBy} (${fmtDate(endedDate)})
Remarks: ${closingRemarks || 'None'}

KEY METRICS:
Total Sales Revenue: ${fmtCurr(totalSales)}
Total Customer Sales: ${fmtCurr(totalCustomerSales)}
Total Dealer Sales: ${fmtCurr(totalDealerSales)}
Total Washes / Orders: ${totalOrders}

CASH RECONCILIATION:
- Opening Cash Float: ${fmtCurr(openingCash)}
- Cash Sales: +${fmtCurr(cashSales)}
- Cash In: +${fmtCurr(totalCashIn)}
- Cash Out: -${fmtCurr(totalCashOut)}
- Expected Cash: ${fmtCurr(expectedCash)}
- Actual Closing Cash: ${fmtCurr(actualClosingCash)}
- Cash Variance: ${fmtCurr(cashDifference)} (${cashDifference === 0 ? 'BALANCED' : cashDifference > 0 ? 'SURPLUS' : 'SHORTAGE'})

PAYMENT BREAKDOWN:
- Cash Sales: ${fmtCurr(cashSales)}
- Card Sales: ${fmtCurr(cardSales)}
- Online / PayNow: ${fmtCurr(onlineSales)}
- Other: ${fmtCurr(otherSales)}

Generated automatically by RedBay Car Wash POS System.
    `.trim();

    const dateFormatted = (() => {
      try {
        if (!businessDate) return new Date().toISOString().slice(0, 10);
        const d = new Date(businessDate);
        if (isNaN(d.getTime())) return String(businessDate);
        return d.toISOString().slice(0, 10);
      } catch (_) {
        return String(businessDate);
      }
    })();

    const subject = `[RedBay Car Wash] Day End Report - Day #${dayId} (${dateFormatted})`;

    const sendResult = await sendMail({
      to: recipient,
      subject,
      html,
      text,
      displayName: 'RedBay Car Wash Reports',
    });

    return {
      success: true,
      recipient,
      subject,
      method: sendResult.method,
    };
  } catch (err) {
    console.error('[EmailService] Failed to send day end report email:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}

module.exports = {
  sendMail,
  getReportRecipientEmail,
  sendDayEndReportEmail,
};
