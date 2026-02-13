const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { verifyAuth, verifyAdmin } = require('../middleware/firebaseAuth');
const { uploadLimiter } = require('../middleware/rateLimiter');

// Persistent storage directory for tweaks files
const TWEAKS_DIR = path.join(__dirname, '..', 'tweaks');
const META_PATH = path.join(TWEAKS_DIR, 'meta.json');

// Ensure tweaks directory exists
if (!fs.existsSync(TWEAKS_DIR)) {
  fs.mkdirSync(TWEAKS_DIR, { recursive: true });
}

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TWEAKS_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, safeName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are allowed'));
    }
  }
});

/**
 * Read current metadata
 */
function readMeta() {
  try {
    if (fs.existsSync(META_PATH)) {
      return JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    }
  } catch (error) {
    console.error('Failed to read tweaks meta:', error.message);
  }
  return null;
}

/**
 * Write metadata
 */
function writeMeta(meta) {
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), 'utf8');
}

/**
 * Delete the current file (if any) before uploading a new one
 */
function deleteCurrentFile() {
  const meta = readMeta();
  if (meta && meta.filename) {
    const filePath = path.join(TWEAKS_DIR, meta.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// POST /api/tweaks/upload - Admin uploads .zip file
router.post('/tweaks/upload', uploadLimiter, verifyAuth, verifyAdmin, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    // Delete previous file if it exists (and is different from the new one)
    const oldMeta = readMeta();
    if (oldMeta && oldMeta.filename && oldMeta.filename !== file.filename) {
      const oldPath = path.join(TWEAKS_DIR, oldMeta.filename);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Save metadata
    const meta = {
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user.email
    };
    writeMeta(meta);

    console.log(`✅ Lurked Tweaks uploaded: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB) by ${req.user.email}`);

    res.json({
      success: true,
      filename: meta.originalName,
      size: meta.size,
      uploadedAt: meta.uploadedAt
    });
  } catch (error) {
    console.error('Error uploading tweaks file:', error);
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: 'Failed to upload file' });
  }
});

// Handle multer errors
router.use('/tweaks/upload', (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large. Maximum size is 200MB.' });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
});

// GET /api/tweaks/info - Public file info
router.get('/tweaks/info', (req, res) => {
  const meta = readMeta();

  if (!meta || !meta.filename) {
    return res.json({ success: true, available: false });
  }

  // Verify the file still exists on disk
  const filePath = path.join(TWEAKS_DIR, meta.filename);
  if (!fs.existsSync(filePath)) {
    return res.json({ success: true, available: false });
  }

  res.json({
    success: true,
    available: true,
    filename: meta.originalName,
    size: meta.size,
    uploadedAt: meta.uploadedAt
  });
});

// GET /api/tweaks/download - Public file download
router.get('/tweaks/download', (req, res) => {
  const meta = readMeta();

  if (!meta || !meta.filename) {
    return res.status(404).json({ success: false, error: 'No file available for download' });
  }

  const filePath = path.join(TWEAKS_DIR, meta.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found on server' });
  }

  res.download(filePath, meta.originalName);
});

module.exports = router;
