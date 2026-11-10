const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const userController = require('../controllers/userController');

const JWT_SECRET = process.env.JWT_SECRET || 'car-wash-secret-key-fallback';

function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    }
  } catch (err) {
    // Ignore invalid/expired token
  }
  next();
}

// 1. GET /api/users/groups - Retrieve all user groups
router.get('/groups', optionalAuth, userController.getUserGroups);

// 2. GET /api/users - List users with search
router.get('/', optionalAuth, userController.getUsers);

// 3. POST /api/users - Create new user
router.post('/', optionalAuth, userController.createUser);

// 4. PUT /api/users/:id - Update user
router.put('/:id', optionalAuth, userController.updateUser);

// 5. DELETE /api/users/:id - Disable or delete user
router.delete('/:id', optionalAuth, userController.deleteUser);

module.exports = router;
