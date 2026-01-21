require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db'); 
const shipmentRoutes = require('./routes/shipmentRoutes');
const authController = require('./controllers/authController');
const verifyToken = require('./middleware/authMiddleware'); 

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json());

app.use((req, res, next) => {
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

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});