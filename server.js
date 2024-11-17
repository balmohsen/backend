// backend/server.js

// Import Required Modules
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');
const LdapStrategy = require('passport-ldapauth');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
const morgan = require('morgan'); // For HTTP request logging
const helmet = require('helmet'); // For securing HTTP headers
const rateLimit = require('express-rate-limit'); // For rate limiting
const mongoSanitize = require('express-mongo-sanitize'); // For sanitizing data
const Joi = require('joi'); // For data validation
const testEmailRoutes = require('./routes/testEmail');

// Load environment variables from .env file
dotenv.config();

// Initialize Express App
const app = express();

app.use('/', testEmailRoutes);

// =======================
// Middleware Configuration
// =======================

// Set Security HTTP Headers
app.use(helmet());

// Enable CORS with Specific Origins
const allowedOrigins = ['http://10.3.52.185:3000']; // Add other origins if needed
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight OPTIONS requests
app.options('*', cors());

// HTTP Request Logger
app.use(morgan('combined'));

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use(limiter);

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For parsing URL-encoded data

// Data Sanitization against NoSQL Injection
app.use(mongoSanitize());

// Serve Uploaded Files Statistically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =======================
// MongoDB Connection
// =======================

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
  process.exit(1); // Exit process with failure
});

// =======================
// LDAP Configuration with Passport
// =======================

const LDAP_OPTIONS = {
  server: {
    url: process.env.LDAP_URL, // e.g., ldap://10.8.167.18:389
    bindDN: process.env.LDAP_BIND_DN, // e.g., CN=LandingSCV,CN=Users,DC=hstp,DC=sa
    bindCredentials: process.env.LDAP_BIND_CREDENTIALS, // e.g., A@a123456
    searchBase: process.env.LDAP_SEARCH_BASE, // e.g., DC=hstp,DC=sa
    searchFilter: process.env.LDAP_SEARCH_FILTER, // e.g., (sAMAccountName={{username}})
    reconnect: true, // Optional: Automatically reconnect if connection is lost
  },
};

// Initialize Passport with LDAP Strategy
passport.use(new LdapStrategy(LDAP_OPTIONS));
app.use(passport.initialize());

// =======================
// JWT Configuration
// =======================

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here'; // Replace with a strong secret

/**
 * Middleware to authenticate JWT tokens.
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    // Expected format: 'Bearer TOKEN'
    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.error('🔴 JWT Verification Error:', err);
        return res.status(403).json({ message: 'Forbidden: Invalid token' });
      }

      req.user = user; // Attach user info to request
      next();
    });
  } else {
    res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
};

// =======================
// Models
// =======================

const COC = require('./models/COC'); // Import the COC model
const User = require('./models/User'); // Import the User model

// =======================
// Routes
// =======================

const cocRoutes = require('./routes/coc');
const certificationRoutes = require('./routes/certification');
app.use('/api/coc', cocRoutes);
app.use('/api/certification', certificationRoutes);

// Health Check Route
app.get('/', (req, res) => {
  res.send('✅ Backend is running.');
});

// Login Route
app.post('/login', (req, res, next) => {
  passport.authenticate('ldapauth', { session: false }, async (err, user, info) => {
    if (err) {
      console.error('🔴 LDAP Authentication Error:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
    if (!user) {
      console.warn('⚠️ Authentication failed:', info);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    try {
      // Fetch or create user in the User collection
      let appUser = await User.findOne({ username: user.sAMAccountName });

      if (!appUser) {
        // If user doesn't exist, create with default role 'user'
        appUser = new User({ username: user.sAMAccountName, role: 'user' });
        await appUser.save();
      }

      // Generate JWT Token with role from the User collection
      const token = jwt.sign(
        { username: appUser.username, role: appUser.role },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      console.log('✅ Generated JWT Token:', token);
      console.log('🔍 Decoded Token Payload:', jwt.decode(token));

      return res.json({ token });
    } catch (dbError) {
      console.error('🔴 Database Error during login:', dbError);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  })(req, res, next);
});

// Assign Role Route (Admin Only)
app.post('/assign-role', authenticateJWT, async (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Access denied. Administrator only.' });
  }

  const { username, role } = req.body;

  if (!username || !role) {
    return res.status(400).json({ message: 'Username and role are required.' });
  }

  if (!['user', 'manager', 'vp', 'finance', 'administrator'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role specified.' });
  }

  try {
    let user = await User.findOne({ username });

    if (user) {
      user.role = role;
      await user.save();
      res.json({ message: `Role '${role}' updated for user '${username}'.` });
    } else {
      // If user doesn't exist in the User collection, create a new entry
      user = new User({ username, role });
      await user.save();
      res.json({ message: `User '${username}' created with role '${role}'.` });
    }
  } catch (err) {
    console.error('🔴 Error assigning role:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get All Users Route (Admin Only)
app.get('/users', authenticateJWT, async (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Access denied. Administrator only.' });
  }

  try {
    const users = await User.find({}, 'username role'); // Fetch username and role fields
    res.json({ users });
  } catch (err) {
    console.error('🔴 Error fetching users:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Submit COC Form Route
app.post('/coc-form', authenticateJWT, async (req, res) => {
  const {
    manager_id,
    vp_id,
    finance_reviewer_id,
    course_name,
    completion_date,
    score,
    comments,
  } = req.body;

  // Validate required fields using Joi
  const schema = Joi.object({
    manager_id: Joi.string().optional(),
    vp_id: Joi.string().optional(),
    finance_reviewer_id: Joi.string().optional(),
    course_name: Joi.string().required(),
    completion_date: Joi.date().required(),
    score: Joi.number().min(0).max(100).required(),
    comments: Joi.string().required(),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    console.warn('⚠️ Validation Error:', error.details[0].message);
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    const newCOC = new COC({
      user_id: req.user.username,
      manager_id: value.manager_id,
      vp_id: value.vp_id,
      finance_reviewer_id: value.finance_reviewer_id,
      course_name: value.course_name,
      completion_date: value.completion_date,
      score: value.score,
      comments: value.comments,
      status: 'Submitted',
      finance_status: 'Pending',
      manager_status: 'Pending',
      vp_status: 'Pending',
      current_approver: 'finance',
    });

    await newCOC.save();
    console.log('✅ COC saved:', newCOC);
    res.status(201).json({ message: 'COC submitted successfully.', coc: newCOC });
  } catch (err) {
    console.error('🔴 Error saving COC:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get COC Forms for Authenticated User or Admin
app.get('/coc-forms', authenticateJWT, async (req, res) => {
  const { username, role } = req.user;

  try {
    let forms;
    if (role === 'administrator') {
      // Admin can view all forms
      forms = await COC.find().sort({ createdAt: -1 });
    } else {
      // Regular users can view only their own forms
      forms = await COC.find({ user_id: username }).sort({ createdAt: -1 });
    }
    res.json({ forms });
  } catch (err) {
    console.error('🔴 Error fetching COC forms:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get Pending COC Forms for the Authenticated Approver
app.get('/pending-coc-forms', authenticateJWT, async (req, res) => {
  const userRole = req.user.role;

  // Only approvers can access this route
  if (!['finance', 'manager', 'vp'].includes(userRole)) {
    return res.status(403).json({ message: 'Access denied. Approvers only.' });
  }

  try {
    const pendingCOCs = await COC.find({ 
      current_approver: userRole, 
      status: 'Submitted' 
    }).sort({ createdAt: -1 });

    res.json({ forms: pendingCOCs });
  } catch (err) {
    console.error('🔴 Error fetching pending COC forms:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Approve or Reject COC Form Route
app.post('/approve-coc/:id', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'approve' or 'reject'
  const userRole = req.user.role;

  try {
    const coc = await COC.findById(id);
    if (!coc) {
      return res.status(404).json({ message: 'COC form not found.' });
    }

    // Determine if the user has the authority to approve at the current stage
    if (coc.current_approver !== userRole) {
      return res.status(403).json({ message: `You are not authorized to ${action} this form at its current stage.` });
    }

    if (action === 'approve') {
      switch (userRole) {
        case 'finance':
          coc.finance_status = 'Approved';
          coc.current_approver = 'manager';
          break;
        case 'manager':
          coc.manager_status = 'Approved';
          coc.current_approver = 'vp';
          break;
        case 'vp':
          coc.vp_status = 'Approved';
          coc.current_approver = 'completed';
          coc.status = 'Approved';
          break;
        default:
          return res.status(400).json({ message: 'Invalid role for approval.' });
      }
    } else if (action === 'reject') {
      switch (userRole) {
        case 'finance':
          coc.finance_status = 'Rejected';
          break;
        case 'manager':
          coc.manager_status = 'Rejected';
          break;
        case 'vp':
          coc.vp_status = 'Rejected';
          break;
        default:
          return res.status(400).json({ message: 'Invalid role for rejection.' });
      }
      coc.status = 'Rejected';
      coc.current_approver = 'completed';
    } else {
      return res.status(400).json({ message: 'Invalid action. Use "approve" or "reject".' });
    }

    await coc.save();
    res.json({ message: `COC form has been ${action}d successfully.`, coc });
  } catch (err) {
    console.error('🔴 Error processing approval:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// =======================
// Global Error Handling Middleware
// =======================

app.use((err, req, res, next) => {
  console.error('🔴 Global Error Handler:', err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    // Include stack trace only in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// =======================
// Fallback Route for Undefined Endpoints
// =======================

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// =======================
// Start the Server
// =======================

const PORT = process.env.PORT || 5000;
const HOST = '10.3.52.185'; // Allows external connections

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));

