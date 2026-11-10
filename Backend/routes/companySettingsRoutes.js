const express = require('express');
const router = express.Router();
const companySettingsController = require('../controllers/companySettingsController');

router.get('/', companySettingsController.getCompanySettings);
router.put('/', companySettingsController.updateCompanySettings);
router.post('/', companySettingsController.updateCompanySettings);

module.exports = router;

