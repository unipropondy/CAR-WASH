const express = require('express');
const router = express.Router();
const {
  getAccountTypes,
  getAccountTypeById,
  getAccountTypeImage,
  createAccountType,
  updateAccountType,
  deleteAccountType,
} = require('../controllers/accountTypeController');

router.get('/', getAccountTypes);
router.get('/:id', getAccountTypeById);
router.get('/:id/image', getAccountTypeImage);
router.post('/', createAccountType);
router.put('/:id', updateAccountType);
router.delete('/:id', deleteAccountType);

module.exports = router;
