// backend/middleware/upload.js

const multer = require('multer');
const path = require('path');

// Configure storage settings for Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Ensure this directory exists
    },
    filename: function (req, file, cb) {
        // Rename the file to include the current timestamp
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

// Define file filter to accept only specific file types
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only images (jpeg, jpg, png) and PDFs are allowed.'));
    }
};

// Initialize Multer with the defined storage, file filter, and file size limits
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
    fileFilter: fileFilter,
});

module.exports = upload;
