// backend/routes/coc.js

const express = require('express');
const router = express.Router();
const Certification = require('../models/Certification'); // Adjust the path if necessary
const verifyToken = require('../middleware/auth'); // Authentication middleware
const upload = require('../middleware/upload'); // Multer upload middleware

// POST /api/coc/submit
router.post(
    '/submit',
    verifyToken, // Middleware to verify JWT token
    upload.fields([
        { name: 'projectManagerSignatureFile', maxCount: 1 },
        { name: 'vpSignatureFile', maxCount: 1 },
        { name: 'ssvpSignatureFile', maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            console.log('Received COC form data:', req.body);
            console.log('Received COC files:', req.files);

            const data = req.body;

            // 1. Parse the descriptions JSON string into an array
            let descriptions = [];
            if (data.descriptions) {
                try {
                    descriptions = JSON.parse(data.descriptions);
                    console.log('Parsed COC descriptions:', descriptions);
                } catch (parseError) {
                    console.error('Error parsing COC descriptions:', parseError);
                    return res.status(400).json({ message: 'Invalid format for descriptions.' });
                }
            } else {
                return res.status(400).json({ message: 'Missing fields for descriptions.' });
            }

            // Convert relevant fields to numbers
            descriptions = descriptions.map((desc, index) => {
                return {
                    ...desc,
                    quantityRequested: Number(desc.quantityRequested),
                    quantitySupplied: Number(desc.quantitySupplied),
                    totalBeforeVAT: Number(desc.totalBeforeVAT),
                    totalAfterVAT: Number(desc.totalAfterVAT),
                };
            });

            // 2. Validate that there are exactly 4 descriptions
            if (!Array.isArray(descriptions) || descriptions.length !== 4) {
                return res.status(400).json({ message: 'There must be exactly 4 description entries.' });
            }

            // 3. Further validation for each description entry
            for (let i = 0; i < descriptions.length; i++) {
                const desc = descriptions[i];
                if (
                    desc.description === undefined ||
                    desc.quantityRequested === undefined ||
                    desc.quantitySupplied === undefined ||
                    desc.totalBeforeVAT === undefined ||
                    desc.totalAfterVAT === undefined
                ) {
                    return res.status(400).json({ message: `Missing fields for description ${i + 1}` });
                }

                // Check if quantityRequested is a number
                if (typeof desc.quantityRequested !== 'number' || isNaN(desc.quantityRequested)) {
                    return res.status(400).json({ message: `Invalid type for quantityRequested in description ${i + 1}. Expected number.` });
                }

                // Check if quantitySupplied is a number
                if (typeof desc.quantitySupplied !== 'number' || isNaN(desc.quantitySupplied)) {
                    return res.status(400).json({ message: `Invalid type for quantitySupplied in description ${i + 1}. Expected number.` });
                }

                // Check if totalBeforeVAT is a number
                if (typeof desc.totalBeforeVAT !== 'number' || isNaN(desc.totalBeforeVAT)) {
                    return res.status(400).json({ message: `Invalid type for totalBeforeVAT in description ${i + 1}. Expected number.` });
                }

                // Check if totalAfterVAT is a number
                if (typeof desc.totalAfterVAT !== 'number' || isNaN(desc.totalAfterVAT)) {
                    return res.status(400).json({ message: `Invalid type for totalAfterVAT in description ${i + 1}. Expected number.` });
                }
            }

            // 4. Handle File Uploads (Optional)
            const projectManagerSignatureFile = req.files['projectManagerSignatureFile']
                ? req.files['projectManagerSignatureFile'][0].path
                : '';
            const vpSignatureFile = req.files['vpSignatureFile']
                ? req.files['vpSignatureFile'][0].path
                : '';
            const ssvpSignatureFile = req.files['ssvpSignatureFile']
                ? req.files['ssvpSignatureFile'][0].path
                : '';

            // 5. Create Certification Document
            const certification = new Certification({
                ...data,
                descriptions, // Use the parsed descriptions array
                projectManagerSignatureFile,
                vpSignatureFile,
                ssvpSignatureFile,
                submittedBy: req.user.username, // Assuming you have user info in req.user
                submittedAt: new Date(),
            });

            // 6. Save to MongoDB
            await certification.save();

            // 7. Respond with Success
            res.status(201).json({ message: 'COC form submitted successfully!' });
        } catch (err) {
            console.error('Error submitting COC form:', err);
            res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
        }
    }
);

module.exports = router;
