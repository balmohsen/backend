// backend/utils/email.js

const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Verify the transporter configuration
transporter.verify(function(error, success) {
    if (error) {
        console.error('SMTP configuration error:', error);
    } else {
        console.log('SMTP server is ready to take messages');
    }
});

/**
 * Sends an email.
 * @param {string} to - Recipient's email address.
 * @param {string} subject - Email subject.
 * @param {string} text - Plain text content.
 * @param {string} html - HTML content.
 */
const sendEmail = async (to, subject, text, html) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM, // Sender address
            to,
            subject,
            text,
            html,
        });
        console.log(`Email sent to ${to} with subject "${subject}"`);
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
        throw error; // Optional: Re-throw to handle it in calling functions
    }
};

module.exports = { sendEmail };
