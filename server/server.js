require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db'); 
const shipmentRoutes = require('./routes/shipmentRoutes');
const authController = require('./controllers/authController');
const verifyToken = require('./middleware/authMiddleware'); 
const kpiRoutes = require('./routes/kpiRoutes');
const app = express();
const PORT = process.env.PORT || 4000;
const logRoutes = require('./routes/logRoutes');

// Define allowed origins
const allowedOrigins = [
  'http://localhost:5173', // Dev Frontend
  'http://localhost:4173', // Preview Frontend (Offline Test)
  'http://127.0.0.1:5173', // Alternative Localhost
  'http://127.0.0.1:4173'  // Alternative Localhost
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
  credentials: true, // <--- This MUST be true
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`Request received: ${req.method} ${req.url}`);
    if (req.method === 'POST') console.log("Data sent:", req.body);
    next();
});


app.get('/', (req, res) => { res.send('K2Mac ILMS Backend is Running'); });

// --- ROUTES ---

// 1. PUBLIC ROUTES (No Login Required)
app.post('/api/login', authController.login); 
app.use('/api/users', require('./routes/userRoutes'));

// 2. PROTECTED ROUTES (Login Required)
// It runs BEFORE shipmentRoutes. If verifyToken fails, shipmentRoutes never runs.
app.use('/api/shipments', verifyToken, shipmentRoutes);
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/kpi', kpiRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/rates', require('./routes/ratesRoutes'));

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});