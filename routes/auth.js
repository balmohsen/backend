// backend/routes/auth.js

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming you have a User model
const bcrypt = require('bcryptjs');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user by username
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Create JWT payload
        const payload = {
            id: user._id,
            username: user.username,
            role: user.role, // e.g., 'manager', 'finance', 'ssvp'
        };

        // Sign token
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ token, user: payload });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

module.exports = router;
