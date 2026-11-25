const express = require('express');
const router = express.Router();
const companySettingsController = require('../controllers/companySettingsController');

router.get('/', companySettingsController.getCompanySettings);
router.put('/', companySettingsController.updateCompanySettings);
router.post('/', companySettingsController.updateCompanySettings);

// Company logo & banner image endpoints (DB-driven)
router.get('/logo', companySettingsController.getCompanyLogo);
router.get('/banner', companySettingsController.getCompanyBanner);
router.post('/logo', companySettingsController.uploadCompanyLogo);
router.post('/banner', companySettingsController.uploadCompanyBanner);

module.exports = router;

