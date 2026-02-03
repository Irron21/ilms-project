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

// Trust Proxy (Required for Rate Limiting behind Nginx)
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());

// Scalability Middleware (Compression)
app.use(compression());

// Rate Limiting (General: 100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 300, 
  standardHeaders: true, 
  legacyHeaders: false,
});
app.use(limiter);

// Strict Rate Limiting for Login (5 attempts per hour)
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many login attempts, please try again later."
});

// Define allowed origins
const allowedOrigins = [
  '*', // Allow all origins (for development)
  'http://localhost',      // <--- ADD THIS (For Docker/Nginx on Port 80)
  'http://127.0.0.1',      // <--- ADD THIS (Just to be safe)
  'http://localhost:5173', 
  'http://localhost:4173', 
  'http://127.0.0.1:5173', 
  'http://127.0.0.1:4173'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => { res.send('K2Mac ILMS Backend is Running'); });


// 1. PUBLIC ROUTES (No Login Required)
app.post('/api/login', loginLimiter, authController.login); 
app.use('/api/users', require('./routes/userRoutes'));

// 2. PROTECTED ROUTES (Login Required)
// It runs BEFORE shipmentRoutes. If verifyToken fails, shipmentRoutes never runs.
app.use('/api/shipments', verifyToken, shipmentRoutes);
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
// Apply Redis caching to KPI routes (cache for 5 minutes)
app.use('/api/kpi', cache(300), kpiRoutes);
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
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
