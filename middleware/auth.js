// backend/middleware/auth.js

const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided. Authorization denied.' });
    }

    const token = authHeader.split(' ')[1]; // Expecting "Bearer <token>"

    if (!token) {
        return res.status(401).json({ message: 'No token provided. Authorization denied.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
            id: decoded.id,
            username: decoded.username,
            role: decoded.role, // Ensure role is included in the token
        };
        next();
    } catch (err) {
        console.error('Token verification failed:', err);
        res.status(401).json({ message: 'Token is not valid.' });
    }
};

module.exports = verifyToken;
