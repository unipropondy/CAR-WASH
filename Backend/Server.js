const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
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
const userRoutes = require('./routes/userRoutes');
const dayManagementRoutes = require('./routes/dayManagementRoutes');
const dealerRoutes = require('./routes/dealerRoutes');
const { getPool } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api/users', userRoutes);
app.use('/api/dealers', dealerRoutes);
app.use('/api/day-management', dayManagementRoutes);
app.use('/api/carwash', carwashRoutes);
app.use('/api', authRoutes); // Allows both /api/login and /api/auth/login

// Fast Connectivity Ping
app.get('/api/ping', (req, res) => {
  res.status(200).json({ ok: true, status: 'UP', timestamp: new Date().toISOString() });
});

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    res.status(200).json({
      status: 'UP',
      service: 'RedBay Car Wash POS Backend',
      database: pool.connected ? 'CONNECTED' : 'DISCONNECTED',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  } catch (err) {
    res.status(500).json({
      status: 'DEGRADED',
      service: 'RedBay Car Wash POS Backend',
      database: 'DISCONNECTED',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Serve static frontend web build if present
const distPath = path.join(__dirname, '..', 'Frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Express 5 compatible SPA fallback
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// Root route (API info if no frontend build present)
app.get('/', (req, res) => {
  res.json({ message: 'Car Wash POS Backend API is running', status: 'ONLINE' });
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

// Start Server - Listen immediately for instant health checks
async function startServer() {
  const HOST = process.env.HOST || '0.0.0.0';

  app.listen(PORT, HOST, () => {
    console.log(`=========================================`);
    console.log(`Car Wash POS Backend running on http://${HOST}:${PORT}`);
    console.log(`Local Access: http://localhost:${PORT}/api/health`);
    
    // Dynamically list non-internal network IPs
    const interfaces = os.networkInterfaces();
    Object.keys(interfaces).forEach((name) => {
      interfaces[name]?.forEach((net) => {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`Network (${name}): http://${net.address}:${PORT}/api/health`);
        }
      });
    });
    console.log(`=========================================`);
  });

  // Connect to database asynchronously in the background
  try {
    await getPool();
    console.log('[Database] Initial connection established successfully.');
  } catch (err) {
    console.warn('[Database] Initial connection check failed. Will retry on request:', err.message);
  }
}

startServer();

module.exports = app;

