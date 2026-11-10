/**
 * Controller for Kiosk Help Requests & Staff Notifications
 * Enables Kiosk customers to request staff assistance, sending real-time
 * notifications directly to the POS Cashier dashboard.
 */

// In-memory store for active help requests (fast, zero DB schema disruption)
let activeHelpRequests = [];

/**
 * 1. POST /api/carwash/help
 * Customer clicks "Help" button in Kiosk
 */
function requestHelp(req, res) {
  try {
    const {
      kioskId = 'KIOSK-01',
      location = 'Station #01',
      step = 'General',
      message = 'Customer requested assistance at kiosk terminal',
    } = req.body || {};

    const newRequest = {
      id: `HELP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      kioskId,
      location,
      step,
      message,
      status: 'PENDING',
      timestamp: new Date().toISOString(),
    };

    // Keep at most 20 recent requests, newest first
    activeHelpRequests = [newRequest, ...activeHelpRequests.filter(r => r.status === 'PENDING')].slice(0, 20);

    return res.status(201).json({
      success: true,
      message: 'Help request sent to POS cashier',
      data: newRequest,
    });
  } catch (err) {
    console.error('[HelpNotification requestHelp Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit help request',
      error: err.message,
    });
  }
}

/**
 * 2. GET /api/carwash/help
 * POS queries for active/pending help requests
 */
function getActiveHelpRequests(req, res) {
  try {
    const pending = activeHelpRequests.filter(r => r.status === 'PENDING');
    return res.status(200).json({
      success: true,
      count: pending.length,
      data: pending,
    });
  } catch (err) {
    console.error('[HelpNotification getActive Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch help requests',
      error: err.message,
    });
  }
}

/**
 * 3. PUT /api/carwash/help/:id/resolve
 * Cashier acknowledges / resolves a help request
 */
function resolveHelpRequest(req, res) {
  try {
    const { id } = req.params;
    const reqItem = activeHelpRequests.find(r => r.id === id);

    if (reqItem) {
      reqItem.status = 'RESOLVED';
      reqItem.resolvedAt = new Date().toISOString();
    }

    // Filter out resolved
    activeHelpRequests = activeHelpRequests.filter(r => r.id !== id);

    return res.status(200).json({
      success: true,
      message: 'Help request marked as resolved',
      data: reqItem || { id, status: 'RESOLVED' },
    });
  } catch (err) {
    console.error('[HelpNotification resolve Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to resolve help request',
      error: err.message,
    });
  }
}

/**
 * 4. DELETE /api/carwash/help
 * Clear all pending help requests
 */
function clearAllHelpRequests(req, res) {
  try {
    activeHelpRequests = [];
    return res.status(200).json({
      success: true,
      message: 'All help requests cleared',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to clear help requests',
      error: err.message,
    });
  }
}

module.exports = {
  requestHelp,
  getActiveHelpRequests,
  resolveHelpRequest,
  clearAllHelpRequests,
};

