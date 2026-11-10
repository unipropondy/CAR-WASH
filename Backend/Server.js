const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const packageRoutes = require('./routes/packageRoutes');
const carwashRoutes = require('./routes/carwashRoutes');
const bayRoutes = require('./routes/bayRoutes');
const salesReportRoutes = require('./routes/salesReportRoutes');
const printerRoutes = require('./routes/printerRoutes');
const companySettingsRoutes = require('./routes/companySettingsRoutes');
const { getPool } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicle-types', vehicleRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/service-categories', categoryRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/service-packages', packageRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/bays', bayRoutes);
app.use('/api/carwash/reports', salesReportRoutes);
app.use('/api/reports', salesReportRoutes);
app.use('/api/printers', printerRoutes);
app.use('/api/carwash/printers', printerRoutes);
app.use('/api/settings/company', companySettingsRoutes);
app.use('/api/company-settings', companySettingsRoutes);
app.use('/api/carwash', carwashRoutes);
app.use('/api', authRoutes); // Allows both /api/login and /api/auth/login

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    res.status(200).json({
      status: 'UP',
      database: pool.connected ? 'CONNECTED' : 'DISCONNECTED',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'DEGRADED',
      database: 'DISCONNECTED',
      error: err.message,
    });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Car Wash POS Backend API is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Start Server
async function startServer() {
  try {
    // Attempt initial database connection
    await getPool();
    console.log('[Database] Initial connection established successfully.');
  } catch (err) {
    console.warn('[Database] Initial connection check failed. Will retry on request:', err.message);
  }

  const HOST = process.env.HOST || '0.0.0.0';

  app.listen(PORT, HOST, () => {
    console.log(`=========================================`);
    console.log(`Car Wash POS Backend running on http://${HOST}:${PORT}`);
    console.log(`Local Access: http://localhost:${PORT}/api/health`);
    console.log(`Mobile LAN Access: http://192.168.0.128:${PORT}/api/health`);
    console.log(`=========================================`);
  });
}

startServer();

module.exports = app;

