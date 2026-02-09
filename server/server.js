require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // Security Headers
const compression = require('compression'); // Gzip Compression
const rateLimit = require('express-rate-limit'); // Rate Limiting
const db = require('./config/db'); 
const redisClient = require('./config/redis'); // Redis Client
const shipmentRoutes = require('./routes/shipmentRoutes');
const authController = require('./controllers/authController');
const verifyToken = require('./middleware/authMiddleware'); 
const cache = require('./middleware/cacheMiddleware'); // Cache Middleware
const kpiRoutes = require('./routes/kpiRoutes');
const app = express();
const PORT = process.env.PORT || 4000;
const logRoutes = require('./routes/logRoutes');
const { ErrorReporting } = require('@google-cloud/error-reporting');
let errors;
if (process.env.NODE_ENV === 'production') {
    errors = new ErrorReporting();
}

// Trust Proxy (Required for Rate Limiting behind Nginx)
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());

// CORS - Must be BEFORE Rate Limiter to allow 429 responses to have CORS headers
app.use(cors({
  origin: true, // Reflects the request origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Scalability Middleware (Compression)
app.use(compression());

// Rate Limiting (General: 300 requests per minute)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 300, 
  standardHeaders: true, 
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later."
});
app.use(limiter);

// Strict Rate Limiting for Login (10 attempts every 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts, please try again later."
});

// // Define allowed origins
// const allowedOrigins = [
//   'http://localhost',      // <--- ADD THIS (For Docker/Nginx on Port 80)
//   'http://127.0.0.1',      // <--- ADD THIS (Just to be safe)
//   'http://localhost:5173', 
//   'http://localhost:4173', 
//   'http://127.0.0.1:5173', 
//   'http://127.0.0.1:4173'
// ];

// app.use(cors({
//   origin: function (origin, callback) {
//     // Allow requests with no origin (like mobile apps or curl requests)
//     if (!origin) return callback(null, true);
    
//     if (allowedOrigins.indexOf(origin) === -1) {
//       const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
//       return callback(new Error(msg), false);
//     }
//     return callback(null, true);
//   },
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
// }));

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => { res.send('K2Mac ILMS Backend is Running'); });


// 1. PUBLIC ROUTES (No Login Required)
app.post('/api/login', loginLimiter, authController.login);
app.post('/api/logout', verifyToken, authController.logout);

app.use('/api/users', require('./routes/userRoutes'));

// 2. PROTECTED ROUTES (Login Required)
// It runs BEFORE shipmentRoutes. If verifyToken fails, shipmentRoutes never runs.
app.use('/api/shipments', verifyToken, shipmentRoutes);
app.use('/api/vehicles', require('./routes/vehicleRoutes'));

// Use the smart wrapper instead of the direct cache
app.use('/api/kpi', kpiRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/rates', require('./routes/ratesRoutes'));
app.use('/api/adjustments', require('./routes/adjustmentsRoutes'));
app.use('/api/payments', require('./routes/paymentsRoutes'));

// Global error handler to prevent crashes
app.use((err, req, res, next) => {
  console.error('[ERROR]', err && err.stack ? err.stack : err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
});

// Safety nets for unexpected errors
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err && err.stack ? err.stack : err);
  console.error('Critical Error: Exiting process to ensure restart...');
  process.exit(1); // Force exit so process manager/docker/nodemon restarts it
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
  // Optional: process.exit(1) here too if you want strict handling
});

if (process.env.NODE_ENV === 'production' && errors) {
    app.use(errors.express);
}

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
