const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const promotionController = require('../controllers/promotionController');

// Ensure upload directory exists
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'promotions');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext) {
      if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') ext = '.jpg';
      else if (file.mimetype === 'image/webp') ext = '.webp';
      else ext = '.png';
    }
    const uniqueSuffix = `promo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueSuffix);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  if (allowed.includes(ext) || allowedMimes.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image format. Allowed: JPG, JPEG, PNG, WEBP.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter,
});

// Middleware wrapper to gracefully handle multer errors (e.g. invalid format or field name)
// and still allow base64 fallback in req.body
function optionalMulter(req, res, next) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const uploadSingle = upload.single('image');
  uploadSingle(req, res, (err) => {
    if (err) {
      // If error is file format restriction
      if (err.message && err.message.includes('Invalid image format')) {
        return res.status(400).json({ success: false, message: err.message });
      }
      // If multipart error but maybe base64 JSON was submitted instead
      if (req.body && (req.body.image || req.body.imageData)) {
        return next();
      }
      return res.status(400).json({ success: false, message: err.message || 'File upload error.' });
    }
    next();
  });
}

// Routes
router.post('/upload', optionalMulter, promotionController.uploadPromotionImage);
router.get('/active', promotionController.getActivePromotions);
router.get('/', promotionController.getAllPromotions);
router.get('/:id/image', promotionController.getPromotionImageById);
router.get('/:id', promotionController.getPromotionById);
router.post('/', promotionController.createPromotion);
router.put('/:id', promotionController.updatePromotion);
router.delete('/:id', promotionController.deletePromotion);

module.exports = router;
