const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const apiRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Unified Health Platform API (Rogi Sathi)',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/v1/auth',
      health: '/api/v1/health',
      patients: '/api/v1/patients',
      providers: '/api/v1/providers',
      doctors: '/api/v1/doctors',
      pricing: '/api/v1/pricing',
    },
  });
});

// Mount API routes (both /api/v1 and /api for convenience)
app.use('/api/v1', apiRoutes);
app.use('/api', apiRoutes);

// 404 & Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
