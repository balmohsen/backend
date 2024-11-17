// backend/routes/certification.js

const express = require('express');
const router = express.Router();
const Certification = require('../models/Certification');
const User = require('../models/User'); // Import User model for notifications
const verifyToken = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { sendEmail } = require('../utils/email'); // Import sendEmail

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/'); // Ensure this directory exists
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, and PDF files are allowed.'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: fileFilter,
});

// POST /certification/submit - Submit a new certification form
router.post('/submit', verifyToken, upload.single('file'), async (req, res) => {
    try {
        const { contractName, description } = req.body;
        const file = req.file;

        // Find the manager
        const manager = await User.findOne({ role: 'manager' });
        if (!manager) {
            return res.status(500).json({ message: 'Manager not found.' });
        }

        // Create the submission
        const submission = new Certification({
            contractName,
            description,
            filePath: file ? file.path : null,
            submittedBy: req.user.id,
            status: 'Pending Manager',
            currentApprover: 'manager',
            auditTrail: [{
                role: 'user',
                action: 'Submitted',
                performedBy: req.user.username,
                reason: null,
            }],
        });

        await submission.save();

        // Send email to the manager
        const subject = 'New Submission Pending Your Approval';
        const text = `Hello ${manager.username},\n\nA new submission "${contractName}" has been submitted by ${req.user.username} and is pending your approval.\n\nBest Regards,\nCertification App`;
        const html = `<p>Hello <strong>${manager.username}</strong>,</p><p>A new submission "<strong>${contractName}</strong>" has been submitted by <strong>${req.user.username}</strong> and is pending your approval.</p><p>Best Regards,<br/>Certification App</p>`;

        await sendEmail(manager.email, subject, text, html);

        res.status(201).json({ message: 'Submission created and manager notified.' });
    } catch (err) {
        console.error('Error submitting certification:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

// POST /certification/approve - Approve a submission
router.post('/approve', verifyToken, async (req, res) => {
    try {
        const { submissionId } = req.body;
        const userRole = req.user.role.toLowerCase(); // 'manager', 'finance', 'vp', 'administrator'

        const submission = await Certification.findById(submissionId).populate('submittedBy');
        if (!submission) {
            return res.status(404).json({ message: 'Submission not found.' });
        }

        // Check if current user is the approver
        if (submission.currentApprover.toLowerCase() !== userRole) {
            return res.status(403).json({ message: 'You are not authorized to approve this submission.' });
        }

        // Define approval stages
        const approvalStages = ['manager', 'finance', 'vp', 'administrator'];

        // Find current stage index
        const currentIndex = approvalStages.indexOf(userRole);
        if (currentIndex === -1) {
            return res.status(400).json({ message: 'Invalid user role.' });
        }

        if (currentIndex < approvalStages.length -1) {
            // Move to next approver
            const nextApprover = approvalStages[currentIndex + 1];
            const nextStatus = `Pending ${nextApprover.charAt(0).toUpperCase() + nextApprover.slice(1)}`;

            submission.status = nextStatus;
            submission.currentApprover = nextApprover;
            submission.auditTrail.push({
                role: userRole,
                action: 'Approved',
                performedBy: req.user.username,
                reason: null,
            });

            await submission.save();

            // Notify next approver
            const nextApproverUser = await User.findOne({ role: nextApprover });
            if (nextApproverUser) {
                const subject = 'New Submission Pending Your Approval';
                const text = `Hello ${nextApproverUser.username},\n\nSubmission "${submission.contractName}" is now pending your approval.\n\nBest Regards,\nCertification App`;
                const html = `<p>Hello <strong>${nextApproverUser.username}</strong>,</p><p>Submission "<strong>${submission.contractName}</strong>" is now pending your approval.</p><p>Best Regards,<br/>Certification App</p>`;

                await sendEmail(nextApproverUser.email, subject, text, html);
            }

            // Notify user
            const user = await User.findById(submission.submittedBy);
            if (user) {
                const subject = 'Your Submission Has Been Approved';
                const text = `Hello ${user.username},\n\nYour submission "${submission.contractName}" has been approved by ${req.user.username}. It is now pending further approval.\n\nBest Regards,\nCertification App`;
                const html = `<p>Hello <strong>${user.username}</strong>,</p><p>Your submission "<strong>${submission.contractName}</strong>" has been approved by <strong>${req.user.username}</strong>. It is now pending further approval.</p><p>Best Regards,<br/>Certification App</p>`;

                await sendEmail(user.email, subject, text, html);
            }

            res.status(200).json({ message: 'Submission approved and next approver notified.' });
        } else {
            // Final approval
            submission.status = 'Approved';
            submission.currentApprover = null;
            submission.auditTrail.push({
                role: userRole,
                action: 'Approved',
                performedBy: req.user.username,
                reason: null,
            });

            await submission.save();

            // Notify user
            const user = await User.findById(submission.submittedBy);
            if (user) {
                const subject = 'Your Submission Has Been Fully Approved';
                const text = `Hello ${user.username},\n\nYour submission "${submission.contractName}" has been fully approved.\n\nBest Regards,\nCertification App`;
                const html = `<p>Hello <strong>${user.username}</strong>,</p><p>Your submission "<strong>${submission.contractName}</strong>" has been fully approved.</p><p>Best Regards,<br/>Certification App</p>`;

                await sendEmail(user.email, subject, text, html);
            }

            res.status(200).json({ message: 'Submission fully approved and user notified.' });
        }

    } catch (err) {
        console.error('Error approving submission:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

// Similarly, implement rejection and send back functionalities with email notifications

module.exports = router;
