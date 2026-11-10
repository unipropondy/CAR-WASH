const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../services/authService');

const JWT_SECRET = process.env.JWT_SECRET || 'car-wash-secret-key-fallback';

/**
 * Handle user login
 * POST /api/auth/login or POST /api/login
 * Body: { userId, password } or { username, password }
 */
async function login(req, res) {
  try {
    const { userId, username, password } = req.body || {};
    const loginId = (userId || username || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both User ID and Password.',
      });
    }

    const { user, error } = await authenticateUser(loginId, password);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: error || 'Invalid User ID or Password',
      });
    }

    // Generate JWT token (do not embed sensitive info)
    const token = jwt.sign(
      {
        userId: user.userId,
        userCode: user.userCode,
        userName: user.userName,
        userGroupId: user.userGroupId,
        userGroupCode: user.userGroupCode,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        userId: user.userId,
        userCode: user.userCode,
        userName: user.userName,
        userGroupId: user.userGroupId,
        userGroupCode: user.userGroupCode,
        userGroupName: user.userGroupName,
      },
      token,
    });
  } catch (err) {
    console.error('[Login Controller Error]', err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during authentication. Please try again later.',
    });
  }
}

/**
 * Verify token / session
 * GET /api/auth/verify
 */
async function verifySession(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    return res.status(200).json({
      success: true,
      user: decoded,
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session',
    });
  }
}

module.exports = {
  login,
  verifySession,
};

