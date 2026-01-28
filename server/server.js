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

app.use(cors({
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
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

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});