const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const kitchenRoutes = require('./routes/kitchen.routes');
const catalogRoutes = require('./routes/catalog.routes');

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'cloud-pool-api',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/kitchens', kitchenRoutes);
app.use('/api/catalog', catalogRoutes);

app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    ...(err.details && { details: err.details }),
    ...(config.nodeEnv !== 'production' && { stack: err.stack }),
  });
});

if (require.main === module) {
  server.listen(config.port, () => {
    console.log(`[CloudPool API] Listening on http://localhost:${config.port}`);
  });
}

module.exports = { app, server };
