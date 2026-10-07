const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs/promises');
const { authenticateToken, requirePagePermission } = require('../middleware/auth');

const router = express.Router();
const mediaByMime = {
  'image/jpeg': { extension: '.jpg', type: 'image' },
  'image/png': { extension: '.png', type: 'image' },
  'image/webp': { extension: '.webp', type: 'image' },
  'video/mp4': { extension: '.mp4', type: 'video' },
  'video/webm': { extension: '.webm', type: 'video' },
  'video/quicktime': { extension: '.mov', type: 'video' }
};

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, crypto.randomBytes(18).toString('hex') + mediaByMime[file.mimetype].extension);
  }
});

// Only permit formats whose signatures are checked after upload.
const fileFilter = (req, file, cb) => {
  if (mediaByMime[file.mimetype]) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB hard cap; images are capped again after MIME validation
  }
});
const uploadSingle = (req, res, next) => upload.single('file')(req, res, error => {
  if (error) {
    const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge ? 'Le média dépasse la limite de 100 Mo.' : 'Téléversement invalide.'
    });
  }
  next();
});

// Upload endpoint
router.post('/', authenticateToken, requirePagePermission('stock', 'settings'), uploadSingle, (req, res) => {
  (async () => {
    if (!req.file) {
      return res.status(400).json({ message: 'Choisissez une image JPEG, PNG ou WebP.' });
    }

    const handle = await fs.open(req.file.path, 'r');
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    await handle.close();
    const bytes = header.subarray(0, bytesRead);
    const validSignature = req.file.mimetype === 'image/jpeg'
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : req.file.mimetype === 'image/png'
        ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : req.file.mimetype === 'image/webp'
          ? bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
          : req.file.mimetype === 'video/webm'
            ? bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
            : bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp';
    if (!validSignature) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ message: 'Le contenu du fichier ne correspond pas au média annoncé.' });
    }
    const mediaType = mediaByMime[req.file.mimetype].type;
    const sizeLimit = mediaType === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
    if (req.file.size > sizeLimit) {
      await fs.unlink(req.file.path);
      return res.status(413).json({ message: mediaType === 'image' ? 'Une image ne peut pas dépasser 10 Mo.' : 'La vidéo ne peut pas dépasser 100 Mo.' });
    }

    // Return the file URL
    const fileUrl = `/api/uploads/${req.file.filename}`;
    res.json({ file_url: fileUrl, media_type: mediaType });
  })().catch(async error => {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  });
});

module.exports = router;
