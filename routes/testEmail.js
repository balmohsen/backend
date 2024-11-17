// backend/routes/testEmail.js

const express = require('express');
const router = express.Router();
const { sendEmail } = require('../utils/email');
const verifyToken = require('../middleware/auth');

// GET /test-email - Send a test email (Protected Route)
router.get('/test-email', verifyToken, async (req, res) => {
    try {
        const to = req.user.email; // Send to the authenticated user's email
        const subject = 'Test Email';
        const text = 'This is a test email sent from the Certification App.';
        const html = '<p>This is a <strong>test email</strong> sent from the Certification App.</p>';

        await sendEmail(to, subject, text, html);

        res.status(200).json({ message: 'Test email sent successfully.' });
    } catch (err) {
        console.error('Error sending test email:', err);
        res.status(500).json({ message: 'Failed to send test email.' });
    }
});

module.exports = router;
